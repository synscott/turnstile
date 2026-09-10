# Sprint 03: introduced Rust findings

Scope: Sprint 3 of the [governing build plan](../../docs/build-plan.md), building on
the accepted Sprint 2 candidate mechanism. This is an implementation/evidence
handoff, not director acceptance, an independent review receipt, or an OMP gate.
The director owns acceptance and permission to commit.

## Reproduce and evidence

From the project root, with Python 3.11+, Cargo, Clippy, and a native Rust linker:

```text
python tools/probe_rust_attribution.py
python tools/probe_rust_candidates.py
python tools/probe_rust_quality.py
```

[Dated public-safe evidence](../../docs/sprint-03-results.json) records the exact
versions, input hashes, commands, outcomes, source-relative primary/child spans,
original-tree hashes, and expectations. The attribution probe constructs its own
disposable crates from the selected fixtures; it uses no private source packet or
reference checkout. Its generated-source uncertainty case executes a real build
script. Each process retains the checker's 60-second deadline. Reproduce when
implementation, fixtures, compiler, analyzer, selection, or Cargo context changes.

The recorded revised run passed all 46 attribution expectations across 23 scenarios,
all 51 existing candidate expectations, and all four selected-quality expectations.
The retained cases distinguish:

- Existing debt after unrelated line insertion, including CRLF-to-LF conversion,
  and debt in an unchanged sibling of the edited file.
- Trailing comments on primary lock lines and indentation-only edits, including
  comment-looking text inside raw Rust literals without treating it as a comment.
- Added lock debt, and introduction by an await while the primary lock line stays
  unchanged. The latter is not an added-primary-line overlap test.
- An additional held await at a lock already producing one warning: the secondary
  await spans expand even though the number of warnings does not.
- A partial repair that removes one held await while preserving another: the
  surviving relationships remain existing debt, not a newly expanded diagnostic.
- One old violation repaired while another is introduced with the same lock/await
  text in a different function, preserving the total warning count.
- Repair of a violation and repair of an uncompilable original into a clean
  candidate, without requiring an irrelevant baseline check.
- Visible candidate compilation/unavailability failures and a successful candidate
  with findings whose genuinely required baseline fails compilation.
- New referenced modules (both bad and good), a new auto-discovered binary target,
  and mixed new-file/sibling findings with both successful and failing baselines.
- Generated diagnostic sources outside the captured source context: uncertainty is
  explicit, not silently called preexisting or clean.

Throwaway isolated mutations retained the real API and Clippy execution. Removing
child-span comparison failed the expanded-await regressions, including an await
after a comment-looking raw literal. Replacing subset continuity with exact
equality failed the partial-repair regression. The unmodified implementation
passes those probes. Mutation copies were deleted without changing real sources.

Independent review of the preceding frozen revision identified false introductions
for trailing comments, indentation, and partial repair despite its green author
probe. The revised retained regressions cover those gaps. A fresh subprocess with
asserted import origins also ran the reviewer's exact three constructed source
transitions against the revised API: all returned zero introduced findings and
one preexisting diagnostic, with unchanged originals. This author recheck is not
independent acceptance of the revised snapshot.

Throwaway source-view instrumentation observed two constructions for two captured
sources and four raw duplicate diagnostics. Clippy's UTF-8 byte offsets avoid
full-source decoding; views are built lazily once per relevant captured file.
This is allocation/call-count evidence, not an elapsed-time performance claim or
a retained test pinning implementation call counts.

## Current API and requiredness

`tools/rust_candidates.py` remains the single preparation/analysis owner:
`CargoContext`, `TextEdit`, and `analyze_candidate(context, target, edits=[...])`
or `analyze_candidate(context, target, content="...")` retain their calling shape.
This is still a unique-text preparation primitive, not OMP's edit grammar.

The exact candidate is checked first and must pass the existing compilation
reachability control. The original workspace is never changed or autofixed.
Result semantics now distinguish attributed findings from the whole Cargo check:

- `candidate_check` preserves the raw candidate checker result, including all
  selected diagnostics (which Cargo may duplicate across lib/test targets), other
  diagnostics, command, outcome, and diagnostic root.
- Top-level `findings` contains introduced or newly expanded selected diagnostics.
  `preexisting_findings` contains source-matched existing diagnostics;
  `ambiguous_findings` contains those whose source identity cannot be established.
  Identical source-backed lib/test diagnostic occurrences are collapsed in these
  partitions; raw checker evidence is not altered.
- `outcome="no_findings"` means a reached, successful candidate has no introduced
  findings and no unresolved required attribution. It does not mean the whole
  crate has no existing debt or that unconfigured rules passed.
- `outcome="findings"` identifies introduced diagnostics. An expanded diagnostic
  retains all primary and child spans; this does not assert that every await
  listed within that diagnostic was newly added.
- `outcome="checker_failure"` remains visibly held for required analysis failure,
  reachability failure, changed/unverifiable original inputs, or unresolved
  attribution. Consumers must use the outcome, never an empty findings list as a
  success signal. Known intrinsic new-file findings can coexist with this failure.

Baseline requiredness follows the evidence actually needed:

1. A successful candidate with no selected findings needs no original analysis to
   prove zero introduced findings. `baseline.status="not_required"` records
   `candidate_has_no_findings`; no baseline check is run or reported passed.
   This permits repairing an uncompilable original.
2. If the target was genuinely absent, diagnostics whose primary and child source
   spans are wholly in that new source are intrinsically introduced. A baseline
   is not required for those diagnostics. No empty module or synthetic valid
   original is invented. This preserves new referenced-module writes even when
   the original crate cannot compile until that file is created.
3. Remaining diagnostics require a real original Cargo check in a separate copy
   and fresh build directory of the same captured context, with the same Cargo
   selection. `baseline.status="required"` carries its complete `check` result.
   Failed required analysis yields `required_baseline_failed`; it never earns a
   clean result. Other new-file findings do not excuse an unresolved sibling.
4. A candidate/preparation failure leaves `baseline.status="not_run"`, with its
   reason, rather than claiming baseline success.

## Attribution mechanism and ceiling

`tools/rust_attribution.py` owns bounded source-backed diagnostic comparison, not
a policy catalog or Rust parser. Paths resolve against each Cargo workspace root
and become context-relative identities. Matching uses rule/message/level, exact
compiler-highlighted bytes for primary **and child** spans, and byte locations
mapped through compact unchanged ranges. Each source region is tied to its
preceding common unique source anchor before matching; repeated blocks without
unique identity do not gain authority from a global greedy diff's tie-break.
Whitespace normalization identifies anchors only. Actual highlighted bytes remain
exact; comments and literal contents are never stripped or parsed. This permits
ordinary comment/indentation changes without equating findings in different
functions or losing the equal-count repair/add transition.

A mapped primary occurrence absent from baseline findings establishes a new
finding even when related spans changed. The candidate's mapped relationships
must be a subset of **one coherent baseline diagnostic at that same primary**
to count as preexisting. Shrinking its held-await set is a partial repair;
expanding it is newly introduced debt. This never unions unrelated baseline
occurrences. Unmappable equivalent context remains ambiguous, preserving related
span multiplicity rather than collapsing repeated `await` highlights. Generated
or external source not present in the captured hashes cannot establish continuity
and remains visibly uncertain where attribution is required.

This is diagnostic differencing for the one selected Clippy rule, not a proof of
arbitrary semantic causality. Large reorganizations or repeated indistinguishable
source regions can require explicit uncertainty. Future evidence of a supported
ordinary-source case that cannot be distinguished would justify a narrower
source-identity refinement, not an unrequested general semantic parser.

The [Sprint 2 trust/context limits](sprint-02.md#trust-boundary-and-limits) continue:
trusted local Cargo execution is not an OS sandbox; build scripts, proc macros,
toolchains, and Cargo-home configuration remain trusted. Copies and fresh build
outputs prevent ordinary target mutation, not malicious absolute-path writes or
concurrent writers. Before/after whole-original-tree hashing detects lasting
changes; it cannot prove the absence of transient write-and-restore behavior.
Public diagnostics redact disposable paths as `<candidate>`, `<baseline>`, and
`<scratch>` while preserving source-relative locations.

## Review and continuation boundary

The director receives a local-private immutable snapshot and a sorted exact-file
SHA-256 manifest including the governing plan and implementation/fixture/docs
closure. The snapshot ID is the SHA-256 of the persisted manifest bytes. The
reviewer must verify that identity from its own copy; these author observations
do not substitute for the independent review. Raw author command output is kept
privately alongside the review handoff. No local commit is authorized by this file.

The next approved product scope is Sprint 4's explicitly enabled native OMP edit
gate. No hook/tool execution release, write integration, retry controller,
exception store, `no_rly`, disclosure, commit, or PR integration is implemented
here. No global settings/hooks or reference checkouts were changed, no child
agents were created, and no push/publication or LoopX control-plane call occurred.
