"""Source-backed continuity for the selected Clippy guard/await relationships.

Compiler byte spans are matched inside uniquely anchored source regions. This is
not Rust parsing or a proof of arbitrary semantic causality; comments and literals
are never stripped from source, and indistinguishable occurrences stay uncertain.
"""

from bisect import bisect_right
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path


def _source_view(source):
    # Clippy byte offsets address UTF-8 bytes directly. No per-span full-file
    # decoding or splitting is needed, including for duplicate lib/test findings.
    return source, source.splitlines(keepends=True)


def _span_blocks(original, candidate):
    old, old_lines = original
    new, new_lines = candidate
    old_counts = Counter(line.strip() for line in old_lines)
    new_counts = Counter(line.strip() for line in new_lines)
    anchors = {line for line in old_counts if old_counts[line] == new_counts[line] == 1}

    def regions(lines):
        result = {}
        anchor = None
        offset = 0
        for line in lines:
            start = result[anchor][0] if anchor in result else offset
            offset += len(line)
            result[anchor] = (start, offset)
            normalized = line.strip()
            if normalized in anchors:
                anchor = normalized
        return result

    # Whitespace normalization identifies anchors only, never diagnostic content.
    # Bind regions BEFORE the byte diff: a global greedy diff can transplant a
    # repaired function's body into another function that newly acquires the bug.
    old_regions, new_regions = regions(old_lines), regions(new_lines)
    blocks = []
    for anchor, (new_start, new_end) in new_regions.items():
        if anchor not in old_regions:
            continue
        old_start, old_end = old_regions[anchor]
        old_region, new_region = old[old_start:old_end], new[new_start:new_end]
        for block in SequenceMatcher(None, old_region, new_region, autojunk=False).get_matching_blocks():
            if not block.size:
                continue
            equal = old_region[block.a:block.a + block.size]
            if any(region.find(equal) != region.rfind(equal) for region in (old_region, new_region)):
                continue
            blocks.append((new_start + block.b, old_start + block.a, block.size))
    blocks.sort()
    return blocks, [block[0] for block in blocks]


def _spans(diagnostic):
    for span in diagnostic["spans"]:
        yield span
    for child in diagnostic.get("children", []):
        yield from _spans(child)


def attribute(baseline, candidate, original_sources, candidate_sources, baseline_root, candidate_root):
    """Return introduced, preexisting, ambiguous; preserve raw evidence separately.

    Source dictionaries contain captured context-relative bytes. A surviving
    subset of a known primary's related spans is existing debt, not expansion.
    """
    views = {}
    maps = {}

    def view(sources, relative):
        key = (id(sources), relative)
        if key not in views:
            views[key] = _source_view(sources[relative])
        return views[key]

    def identity(diagnostic, sources, root, workspace, remap):
        locations, context, primary = set(), [], set()
        uncertain = primary_uncertain = False
        for index, span in enumerate(_spans(diagnostic)):
            path = (Path(workspace) / span["file_name"]).resolve()
            if not path.is_relative_to(root):
                return None, None, None
            relative = path.relative_to(root).as_posix()
            if relative not in sources:
                return None, None, None
            source = view(sources, relative)[0]
            start, end = span["byte_start"], span["byte_end"]
            if not 0 <= start < end <= len(source):
                return None, None, None
            shape = (relative, source[start:end], span["is_primary"], span.get("label"))
            context.append(shape)
            span_uncertain = False
            if remap and original_sources.get(relative) != source:
                if relative not in maps:
                    original_view = view(original_sources, relative) if relative in original_sources else _source_view(b"")
                    maps[relative] = _span_blocks(original_view, view(sources, relative))
                blocks, starts = maps[relative]
                block_index = bisect_right(starts, start) - 1
                if block_index < 0 or end > blocks[block_index][0] + blocks[block_index][2]:
                    uncertain = span_uncertain = True
                else:
                    new_start, old_start, _ = blocks[block_index]
                    start, end = start + old_start - new_start, end + old_start - new_start
            location = (shape, start, end)
            locations.add(location)
            if index < len(diagnostic["spans"]) and span["is_primary"]:
                primary.add(location)
                primary_uncertain |= span_uncertain
        if not primary:
            return None, None, None
        header = ((diagnostic.get("code") or {}).get("code"), diagnostic["level"], diagnostic["message"])
        return ((header, frozenset(locations)) if not uncertain else None,
                (header, Counter(context)), (header, frozenset(primary)) if not primary_uncertain else None)

    old_primaries = {}
    old_contexts = []
    for diagnostic in baseline["findings"]:
        key, context, primary = identity(diagnostic, original_sources, baseline_root,
                                         baseline["diagnostic_root"], False)
        if key is not None:
            old_primaries.setdefault(primary, set()).add(key[1])
        if context is not None:
            old_contexts.append(context)
    introduced, preexisting, ambiguous = [], [], []
    seen = set()
    for diagnostic in candidate["findings"]:
        raw_key, _, _ = identity(diagnostic, candidate_sources, candidate_root,
                                 candidate["diagnostic_root"], False)
        if raw_key is not None and raw_key in seen:
            continue
        if raw_key is not None:
            seen.add(raw_key)
        key, context, primary = identity(diagnostic, candidate_sources, candidate_root,
                                         candidate["diagnostic_root"], True)
        if key is not None and any(key[1] <= locations for locations in old_primaries.get(primary, ())):
            preexisting.append(diagnostic)
        elif primary is not None and primary not in old_primaries:
            introduced.append(diagnostic)
        elif context is None or (key is None and any(context[0] == old[0] and context[1] <= old[1]
                                                     for old in old_contexts)):
            ambiguous.append(diagnostic)
        else:
            introduced.append(diagnostic)
    return introduced, preexisting, ambiguous
