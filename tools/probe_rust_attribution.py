"""Real Clippy discrimination probes for introduced selected-rule findings."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import tempfile

from rust_candidates import CargoContext, TextEdit, analyze_candidate
from rust_checker import RULE, TIMEOUT, run


ROOT = Path(__file__).resolve().parents[1]


def snapshot(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


def probe():
    good = (ROOT / "fixtures/await-holding-lock/good.rs").read_text(encoding="utf-8")
    bad = (ROOT / "fixtures/await-holding-lock/bad.rs").read_text(encoding="utf-8")
    report = {"observed_at_utc": datetime.now(timezone.utc).isoformat(), "rule": RULE,
              "python": platform.python_version(), "platform": platform.system(),
              "timeout_seconds_per_process": TIMEOUT, "versions": {}, "cases": {}, "expectations": {}}
    for name, command in (("rustc", ["rustc", "--version", "--verbose"]),
                          ("cargo", ["cargo", "--version"]), ("clippy", ["cargo", "clippy", "--version"])):
        process = run(command, os.environ.copy(), cwd=ROOT)
        if process.returncode:
            raise RuntimeError(f"{name} version unavailable")
        report["versions"][name] = process.stdout.strip()

    with tempfile.TemporaryDirectory(prefix="turnstile-attribution-probe-") as temporary:
        root = Path(temporary)

        def exercise(name, original, proposal, *, target="src/lib.rs", extra=None, edits=False, cargo="cargo"):
            crate = root / name
            (crate / "src").mkdir(parents=True)
            (crate / "Cargo.toml").write_text(
                '[package]\nname="attribution-probe"\nversion="0.0.0"\nedition="2021"\n', encoding="utf-8")
            if original is not None:
                path = crate / target
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(original.encode("utf-8"))
            for relative, text in (extra or {}).items():
                path = crate / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(text.encode("utf-8"))
            before = snapshot(crate)
            args = {"edits": [TextEdit(original, proposal)]} if edits else {"content": proposal}
            result = analyze_candidate(CargoContext(crate, "Cargo.toml"), target, cargo=cargo, **args)
            report["cases"][name] = {"original_inputs_sha256": before, "result": result}
            report["expectations"][name + "_immutable"] = (
                before == snapshot(crate) and result.get("originals_unchanged") is True)
            return result

        def expect(name, value):
            report["expectations"][name] = bool(value)

        def selected(result, line, file="src/lib.rs"):
            return (result["outcome"] == "findings" and len(result["findings"]) == 1
                    and result["findings"][0]["code"]["code"] == RULE
                    and any(s["is_primary"] and s["line_start"] == line
                            and s["file_name"].replace("\\", "/") == file
                            for s in result["findings"][0]["spans"]))

        shifted = exercise("unrelated_line_shift", bad, "// unrelated header\n\n" + bad, edits=True)
        expect("shifted_existing_does_not_block", shifted["outcome"] == "no_findings"
               and len(shifted["preexisting_findings"]) == 1 and not shifted["findings"]
               and shifted["baseline"]["check"]["outcome"] == "findings")
        normalized = exercise("crlf_line_shift", bad.replace("\n", "\r\n"), "// header\n" + bad)
        expect("line_endings_do_not_create_debt", normalized["outcome"] == "no_findings"
               and len(normalized["preexisting_findings"]) == 1)
        for name, proposed in (
            ("trailing_primary_comment", bad.replace('poisoned")?;', 'poisoned")?; // unrelated explanation')),
            ("indentation_only", bad.replace("    ", "        ")),
        ):
            trivia = exercise(name, bad, proposed)
            expect(name + "_preserves_existing_debt", trivia["outcome"] == "no_findings"
                   and not trivia["findings"] and len(trivia["preexisting_findings"]) == 1)
        literal_source = bad.replace('"state lock poisoned"', 'r#"// text, not /* a comment */"#')
        literal_comment = exercise("comment_after_raw_literal", literal_source,
                                   literal_source.replace('"#)?;', '"#)?; // actual comment'))
        expect("raw_literal_is_not_stripped_as_comment", literal_comment["outcome"] == "no_findings"
               and len(literal_comment["preexisting_findings"]) == 1)
        sibling = exercise("sibling_existing", "mod sibling;\npub const VALUE: u8 = 1;\n",
                           "mod sibling;\npub const VALUE: u8 = 2;\n", extra={"src/sibling.rs": bad})
        expect("whole_selection_existing_does_not_block", sibling["outcome"] == "no_findings"
               and len(sibling["preexisting_findings"]) == 1)
        added = exercise("added_violation", good, bad, edits=True)
        expect("added_lock_finding", selected(added, 7))
        without_await = bad.replace("    delivery.await;\n", "")
        await_added = exercise("unchanged_primary_new_await", without_await, bad, edits=True)
        expect("await_addition_on_unchanged_lock", selected(await_added, 7)
               and await_added["baseline"]["check"]["outcome"] == "no_findings"
               and without_await.splitlines()[6] == bad.splitlines()[6])
        expanded_source = bad.replace("    delivery.await;", "    delivery.await;\n    std::future::ready(()).await;")
        expanded = exercise("additional_held_await", bad, expanded_source)
        expect("secondary_await_expands_existing_finding", selected(expanded, 7)
               and expanded["baseline"]["check"]["outcome"] == "findings"
               and any(len(c["spans"]) == 2 for c in expanded["findings"][0]["children"]))
        reduced = exercise("partial_repair_removes_await", expanded_source, bad)
        expect("removing_a_cause_does_not_introduce_debt", reduced["outcome"] == "no_findings"
               and not reduced["findings"] and len(reduced["preexisting_findings"]) == 1
               and any(len(c["spans"]) == 1 for c in reduced["preexisting_findings"][0]["children"]))
        literal_expansion = exercise("held_await_after_raw_literal", bad, bad.replace(
            "    delivery.await;", '    delivery.await;\n    let _text = r#"// not a comment"#; std::future::ready(()).await;'))
        expect("raw_literal_does_not_hide_new_await", selected(literal_expansion, 7)
               and any(len(c["spans"]) == 2 for c in literal_expansion["findings"][0]["children"]))
        repaired = exercise("repaired_violation", bad, good)
        compile_repaired = exercise("repaired_compile_error", 'pub fn broken() -> u8 { "bad" }\n', good)
        for name, result in (("repair", repaired), ("compile_repair", compile_repaired)):
            expect(name + "_clean_without_baseline", result["outcome"] == "no_findings"
                   and result["baseline"]["status"] == "not_required" and "check" not in result["baseline"])
        required_failure = exercise("required_baseline_failure", 'pub fn broken() -> u8 { "bad" }\n', bad)
        expect("required_baseline_failure_holds", required_failure["outcome"] == "checker_failure"
               and required_failure.get("error") == "required_baseline_failed"
               and required_failure["candidate_check"]["outcome"] == "findings"
               and required_failure["baseline"]["check"]["outcome"] == "checker_failure"
               and any((d.get("code") or {}).get("code") == "E0308"
                       for d in required_failure["baseline"]["check"].get("diagnostics", [])))
        candidate_failure = exercise("candidate_compile_failure", bad, 'pub fn broken() -> u8 { "bad" }\n')
        expect("candidate_failure_never_clean", candidate_failure["outcome"] == "checker_failure"
               and candidate_failure["baseline"]["status"] == "not_run"
               and any((d.get("code") or {}).get("code") == "E0308"
                       for d in candidate_failure["candidate_check"].get("diagnostics", [])))
        unavailable = exercise("checker_unavailable", good, bad, cargo=str(root / "missing-cargo"))
        expect("unavailable_never_clean", unavailable["outcome"] == "checker_failure"
               and unavailable["baseline"]["status"] == "not_run")
        new_bad = exercise("new_referenced_bad", None, bad, target="src/new.rs", extra={"src/lib.rs": "pub mod new;\n"})
        new_good = exercise("new_referenced_good", None, good, target="src/new.rs", extra={"src/lib.rs": "pub mod new;\n"})
        expect("new_referenced_violation_intrinsic", selected(new_bad, 7, "src/new.rs")
               and new_bad["baseline"]["status"] == "not_required" and new_bad["original_sha256"] is None)
        expect("new_referenced_good_remains_supported", new_good["outcome"] == "no_findings"
               and new_good["candidate_compiled"] and new_good["baseline"]["status"] == "not_required")
        new_bin = exercise("new_auto_target", None, bad + "\nfn main() {}\n", target="src/bin/new.rs",
                           extra={"src/lib.rs": "pub const VALUE: u8 = 1;\n"})
        expect("new_auto_target_is_intrinsic", selected(new_bin, 7, "src/bin/new.rs")
               and new_bin["baseline"]["status"] == "not_required")
        mixed = exercise("new_file_with_unresolved_sibling", None, bad, target="src/new.rs",
                         extra={"src/lib.rs": "pub mod new;\nmod sibling;\n", "src/sibling.rs": bad})
        expect("new_intrinsic_does_not_clear_unknown_sibling", mixed["outcome"] == "checker_failure"
               and mixed.get("error") == "required_baseline_failed" and len(mixed["findings"]) == 1)
        mixed_known = exercise("new_file_with_known_sibling", None, bad + "\nfn main() {}\n",
                               target="src/bin/new.rs", extra={"src/lib.rs": bad})
        expect("new_and_existing_partitioned", selected(mixed_known, 7, "src/bin/new.rs")
               and len(mixed_known["preexisting_findings"]) == 1
               and mixed_known["baseline"]["check"]["outcome"] == "findings")
        generated_library = 'include!(concat!(env!("OUT_DIR"), "/generated.rs"));\n'
        generated = exercise("generated_source_ambiguity", generated_library,
                             "// unrelated header\n" + generated_library,
                             extra={"build.rs": 'fn main() {\n'
                                    '    let output = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());\n'
                                    '    std::fs::write(output.join("generated.rs"), r###"' + bad + '"###).unwrap();\n'
                                    '}\n'})
        expect("unavailable_source_identity_is_not_clean", generated["outcome"] == "checker_failure"
               and generated.get("error") == "attribution_ambiguous"
               and generated["ambiguous_findings"] and not generated["findings"]
               and generated["baseline"]["check"]["outcome"] == "findings")

        def function(name, held):
            body = ('    let guard = state.lock().unwrap();\n'
                    '    let value = *guard;\n')
            body += ('    std::future::ready(()).await;\n    drop(guard);\n' if held else
                     '    drop(guard);\n\n')
            return f'pub async fn {name}(state: &std::sync::Mutex<u64>) -> u64 {{\n' + body + '    value\n}\n'

        original_swap = function("first", True) + "\n" + function("second", False)
        candidate_swap = function("first", False) + "\n" + function("second", True)
        swapped = exercise("equal_count_repair_and_add", original_swap, candidate_swap)
        expect("equal_counts_do_not_erase_new_occurrence", selected(swapped, 10)
               and not swapped["preexisting_findings"]
               and len(swapped["candidate_check"]["findings"]) == len(swapped["baseline"]["check"]["findings"]))

    report["input_sha256"] = {
        name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        for name in ("tools/rust_candidates.py", "tools/rust_attribution.py", "tools/rust_checker.py",
                     "tools/probe_rust_attribution.py", "fixtures/await-holding-lock/bad.rs",
                     "fixtures/await-holding-lock/good.rs")}
    report["passed"] = all(report["expectations"].values())
    serialized = json.dumps(report, indent=2)
    for old in (temporary, Path(temporary).as_posix()):
        serialized = serialized.replace(json.dumps(old)[1:-1], "<probe>")
    print(serialized)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(probe())
