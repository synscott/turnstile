"""Real Cargo controls for native-vector replay, move identity and context coverage."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

from rust_candidates import CargoContext, analyze_candidate, analyze_staged
from rust_checker import RULE, run


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = '[package]\nname="staged-probe"\nversion="0.0.0"\nedition="2021"\n'


def snapshot(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


def probe():
    bad = (ROOT / "fixtures/await-holding-lock/bad.rs").read_text(encoding="utf-8")
    good = (ROOT / "fixtures/await-holding-lock/good.rs").read_text(encoding="utf-8")
    expanded = bad.replace("    delivery.await;", "    delivery.await;\n    std::future::ready(()).await;")
    report = {"observed_at_utc": datetime.now(timezone.utc).isoformat(), "rule": RULE,
              "versions": {}, "cases": {}, "expectations": {}}
    for name, command in (("rustc", ["rustc", "--version", "--verbose"]),
                          ("cargo", ["cargo", "--version"]), ("clippy", ["cargo", "clippy", "--version"])):
        process = run(command, os.environ.copy(), cwd=ROOT)
        if process.returncode:
            raise RuntimeError(f"{name} unavailable")
        report["versions"][name] = process.stdout.strip()

    with tempfile.TemporaryDirectory(prefix="sp-") as temporary:
        def exercise(name, files, changes, *, context=None, corrupt=None, single=None):
            root = Path(temporary) / str(len(report["cases"]))
            files = {"Cargo.toml": MANIFEST, **files}
            for relative, text in files.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(text.encode("utf-8"))
            before = snapshot(root)
            operations = []
            for op, path, after, destination in changes:
                operations.append({"op": op, "path": str(root / path), "displayPath": path,
                                   "before": files.get(path), "after": after,
                                   "moveTo": str(root / destination) if destination is not None else None,
                                   "moveBefore": files.get(destination) if destination is not None else None})
            if corrupt:
                corrupt(operations)
            selection = CargoContext(root, "Cargo.toml", **(context or {}))
            if single:
                result = analyze_candidate(selection, single[0], content=single[1])
            else:
                result = analyze_staged(selection, operations)
            report["cases"][name] = {"original_inputs_sha256": before, "result": result}
            report["expectations"][name + "_immutable"] = (
                snapshot(root) == before and result.get("originals_unchanged") is True)
            return result

        def expect(name, condition):
            report["expectations"][name] = bool(condition)

        def clean(result):
            return result["outcome"] == "no_findings" and not result["findings"]

        files = {"src/lib.rs": "mod value;\npub fn value() -> u8 { value::get() }\n",
                 "src/value.rs": "pub fn get() -> u8 { 1 }\n"}
        new_lib = files["src/lib.rs"].replace("u8", "String")
        new_value = 'pub fn get() -> String { "one".into() }\n'
        single = exercise("unstaged_sibling_fails", files, [], single=("src/lib.rs", new_lib))
        combined = exercise("jointly_necessary", files, [
            ("update", "src/lib.rs", new_lib, None), ("update", "src/value.rs", new_value, None)])
        expect("combined_context_not_independent_files", single["outcome"] == "checker_failure"
               and clean(combined) and combined.get("candidate_compiled") is True
               and all(c["reached_as_rust"] for c in combined["reachability"].values()))

        files = {"src/lib.rs": "pub mod old;\n", "src/old.rs": bad}
        for name, after in (("move_existing", bad), ("move_expanded", expanded)):
            result = exercise(name, files, [("move", "src/old.rs", after, "src/new.rs"),
                                           ("update", "src/lib.rs", "pub mod new;\n", None)])
            expect(name + "_attribution", (clean(result) and len(result["preexisting_findings"]) == 1)
                   if name == "move_existing" else result["outcome"] == "findings" and len(result["findings"]) == 1)
        duplicate = exercise("move_and_recreate_source", files, [
            ("move", "src/old.rs", bad, "src/new.rs"), ("update", "src/old.rs", bad, None),
            ("update", "src/lib.rs", "pub mod old;\npub mod new;\n", None)])
        expect("duplicated_old_occurrence_is_new", duplicate["outcome"] == "findings"
               and len(duplicate["findings"]) == 1 and len(duplicate["preexisting_findings"]) == 1)

        variants = (
            "use std::sync::Mutex;\n"
            "pub async fn held(m: &Mutex<u8>) {\n"
            "    let guard = m.lock().unwrap();\n"
            "    std::future::ready(()).await;\n"
            "    #[cfg(test)]\n"
            "    std::future::ready(()).await;\n"
            "    drop(guard);\n}\n")
        variant_files = {"src/lib.rs": "pub mod old;\n", "src/old.rs": variants}
        variant_move = [("move", "src/old.rs", variants, "src/new.rs"),
                        ("update", "src/lib.rs", "pub mod new;\n", None)]
        for name, operations in (
            ("variant_empty", []),
            ("variant_noop", [("noop", "src/old.rs", variants, None)]),
            ("variant_move", variant_move),
        ):
            result = exercise(name, variant_files, operations)
            expect(name + "_same_occurrence_stays_preexisting", clean(result)
                   and len(result["preexisting_findings"]) == 2
                   and len(result["candidate_check"]["findings"]) == 2
                   and len(result["baseline"]["check"]["findings"]) == 2)
        duplicated_variants = exercise("variant_move_recreate", variant_files, [
            *variant_move, ("update", "src/old.rs", variants, None),
            ("update", "src/lib.rs", "pub mod old;\npub mod new;\n", None)])
        expect("variant_contexts_cannot_excuse_copied_occurrence",
               duplicated_variants["outcome"] == "findings"
               and len(duplicated_variants["findings"]) == 2
               and len(duplicated_variants["preexisting_findings"]) == 2)

        b_debt = bad.replace("snapshot_and_deliver", "second")
        chain = exercise("overlapping_move_sources", {
            "src/lib.rs": "pub mod a;\npub mod b;\npub mod c;\n",
            "src/a.rs": good, "src/b.rs": b_debt, "src/c.rs": good}, [
                ("move", "src/a.rs", good, "src/b.rs"),
                ("move", "src/b.rs", b_debt, "src/c.rs"),
                ("update", "src/lib.rs", "pub mod c;\n", None)])
        expect("second_move_uses_original_source", clean(chain) and len(chain["preexisting_findings"]) == 1
               and set(chain["reachability"]) == {"src/lib.rs", "src/c.rs"})
        collision = exercise("last_destination_wins", {"src/lib.rs": "pub mod a;\npub mod b;\n",
                                                       "src/a.rs": bad, "src/b.rs": good}, [
            ("move", "src/a.rs", expanded, "src/c.rs"), ("move", "src/b.rs", good, "src/c.rs"),
            ("update", "src/lib.rs", "pub mod c;\n", None)])
        expect("overwritten_bad_intermediate_not_analyzed", clean(collision))
        if os.name == "nt":
            # Native preserves both initially absent spellings; the Windows
            # filesystem, not a textual fold, determines the surviving output.
            for name, first, last in (("alias_last_good", bad, good), ("alias_last_bad", good, bad)):
                result = exercise(name, {"src/lib.rs": "pub mod fresh;\n"}, [
                    ("create", "src/fresh.rs", first, None),
                    ("create", "src/FRESH.rs", last, None)])
                expect(name + "_follows_actual_alias_order",
                       (clean(result) if name == "alias_last_good" else
                        result["outcome"] == "findings" and len(result["findings"]) == 1)
                       and result.get("candidate_compiled") is True)
            alias_move = exercise("alias_move_origin", {
                "src/lib.rs": "pub mod a;\npub mod b;\n", "src/a.rs": good, "src/b.rs": bad}, [
                    ("move", "src/a.rs", good, "src/fresh.rs"),
                    ("move", "src/b.rs", bad, "src/FRESH.rs"),
                    ("update", "src/lib.rs", "pub mod fresh;\n", None)])
            expect("aliased_last_move_keeps_original_debt", clean(alias_move)
                   and len(alias_move["preexisting_findings"]) == 1)
        overwrite = exercise("create_overwrite", {"src/lib.rs": good}, [("create", "src/lib.rs", bad, None)])
        expect("create_overwrite_retains_baseline", overwrite["outcome"] == "findings"
               and overwrite["baseline"]["status"] == "required")
        noop_order = exercise("noop_after_update", {"src/lib.rs": good}, [
            ("update", "src/lib.rs", bad, None), ("noop", "src/lib.rs", good, None)])
        expect("noop_does_not_restore_original_bytes", noop_order["outcome"] == "findings")
        for name, operations in (("noop_only", [("noop", "src/lib.rs", good, None)]),
                                 ("delete_only", [("delete", "src/orphan.rs", None, None)]),
                                 ("empty_vector", [])):
            result = exercise(name, {"src/lib.rs": good, "src/orphan.rs": bad}, operations)
            expect(name + "_honest_context_coverage", clean(result)
                   and result["candidate_check"]["build_finished"] == [True]
                   and result["coverage"]["status"] == "context_checked" and "candidate_compiled" not in result)
        deletion = exercise("delete_with_module_change", files, [
            ("delete", "src/old.rs", None, None), ("update", "src/lib.rs", good, None)])
        expect("deleted_source_not_reachability_target", clean(deletion)
               and set(deletion["reachability"]) == {"src/lib.rs"})
        feature_manifest = MANIFEST + '[features]\ndefault=[]\ndebt=[]\n'
        feature = exercise("manifest_enables_debt", {"Cargo.toml": feature_manifest,
            "src/lib.rs": '#[cfg(feature="debt")]\npub mod old;\n', "src/old.rs": bad}, [
                ("update", "Cargo.toml", feature_manifest.replace("default=[]", 'default=["debt"]'), None)])
        expect("manifest_change_introduces_existing_source_debt", feature["outcome"] == "findings"
               and feature["coverage"]["status"] == "context_checked" and "candidate_compiled" not in feature)
        excluded = exercise("written_file_excluded", {"Cargo.toml": feature_manifest,
            "src/lib.rs": '#[cfg(feature="debt")]\npub mod old;\n', "src/old.rs": good}, [
                ("update", "src/old.rs", bad, None)])
        expect("remaining_rust_requires_reachability", excluded["outcome"] == "checker_failure"
               and excluded.get("error") == "candidate_not_compiled")
        mixed = exercise("new_finding_and_required_failure", {"src/lib.rs": "pub mod new;\npub mod old;\n",
                                                               "src/old.rs": bad}, [
            ("create", "src/new.rs", bad, None), ("create", "src/orphan.rs", good, None)])
        expect("known_new_finding_survives_other_failures", mixed["outcome"] == "checker_failure"
               and mixed.get("error") == "required_baseline_failed" and len(mixed["findings"]) == 1
               and mixed["reachability"]["src/orphan.rs"]["reached_as_rust"] is False
               and mixed["baseline"]["check"]["outcome"] == "checker_failure")

        for name, corrupt in (
            ("wrong_create_preimage", lambda ops: ops[0].update(before=None)),
            ("wrong_move_destination", lambda ops: ops[0].update(moveBefore="incorrect")),
            ("sequential_not_precall_image", lambda ops: ops[1].update(before=bad)),
        ):
            changes = ([("create", "src/lib.rs", bad, None)] if name == "wrong_create_preimage" else
                       [("move", "src/lib.rs", bad, "src/dest.rs")] if name == "wrong_move_destination" else
                       [("update", "src/lib.rs", bad, None), ("update", "src/lib.rs", good, None)])
            result = exercise(name, {"src/lib.rs": good, "src/dest.rs": good}, changes, corrupt=corrupt)
            expect(name + "_rejected_before_cargo", result["outcome"] == "checker_failure"
                   and "candidate_check" not in result and "stale native preimage" in result.get("error", ""))
        escaped = exercise("staged_manifest_escape", {"src/lib.rs": good}, [
            ("update", "Cargo.toml", MANIFEST + '[dependencies]\noutside={path="../outside"}\n', None)])
        expect("post_replay_manifest_validated", escaped["outcome"] == "checker_failure"
               and "Cargo path escapes context" in escaped.get("error", "") and "candidate_check" not in escaped)
        config = exercise("staged_config_escape", {"src/lib.rs": good}, [
            ("create", ".cargo/config.toml", '[build]\nrustc-wrapper="outside"\n', None)])
        expect("post_replay_config_validated", config["outcome"] == "checker_failure"
               and "compiler wrappers" in config.get("error", ""))
        lock = exercise("staged_lockfile_refresh", {"src/lib.rs": good}, [
            ("create", "Cargo.lock", "version = 4\n", None)])
        expect("staged_lockfile_bytes_are_not_exempt", lock["outcome"] == "checker_failure"
               and "Cargo changed captured source bytes: Cargo.lock" in lock.get("error", ""))
        mutation = exercise("cross_file_build_mutation", {
            "src/lib.rs": "mod sibling;\n", "src/sibling.rs": good,
            "build.rs": 'fn main() { std::fs::write("src/sibling.rs", "pub fn changed() {}\\n").unwrap(); }\n'}, [
                ("update", "src/lib.rs", "mod sibling;\n// staged\n", None)])
        expect("unreported_sibling_mutation_is_not_clean", mutation["outcome"] == "checker_failure"
               and "Cargo changed captured source bytes: src/sibling.rs" in mutation.get("error", ""))

        if os.name == "nt":
            for name, existing_parent in (("directory_semantic_drift", True),
                                          ("new_parent_semantic_drift", False)):
                root = Path(temporary) / str(len(report["cases"]))
                (root / "src").mkdir(parents=True)
                output = root / "out"
                if existing_parent:
                    output.mkdir()
                original_output = json.dumps(str(output))
                files = {
                    "Cargo.toml": MANIFEST,
                    "src/lib.rs": '#[path="../out/fresh.rs"]\npub mod fresh;\n',
                    "build.rs": (
                        'fn main() {\n'
                        f'    let original = {original_output};\n'
                        '    std::fs::create_dir_all(original).unwrap();\n'
                        '    let status = std::process::Command::new("fsutil.exe")\n'
                        '        .args(["file", "setCaseSensitiveInfo", original, "enable"])\n'
                        '        .status().unwrap();\n'
                        '    assert!(status.success());\n}\n'),
                }
                for relative, text in files.items():
                    (root / relative).write_bytes(text.encode("utf-8"))
                before = snapshot(root)
                operations = [
                    {"op": "create", "path": str(output / path), "displayPath": "out/" + path,
                     "before": None, "after": text, "moveTo": None, "moveBefore": None}
                    for path, text in (("fresh.rs", bad), ("FRESH.rs", good))]
                try:
                    result = analyze_staged(CargoContext(root, "Cargo.toml"), operations)
                    report["cases"][name] = {"original_inputs_sha256": before, "result": result}
                    expect(name + "_held_despite_clean_copied_cargo",
                           result["outcome"] == "checker_failure"
                           and result.get("error") == "original_directory_semantics_changed"
                           and result["candidate_check"]["outcome"] == "no_findings"
                           and result.get("candidate_compiled") is True
                           and result.get("originals_unchanged") is False
                           and snapshot(root) == before)
                    # Independent filesystem oracle: changed semantics preserve
                    # both names instead of overwriting the first physical file.
                    lower, upper = output / "fresh.rs", output / "FRESH.rs"
                    lower.write_bytes(b"lower")
                    upper.write_bytes(b"upper")
                    expect(name + "_actual_semantics_changed",
                           not lower.samefile(upper) and lower.read_bytes() == b"lower"
                           and upper.read_bytes() == b"upper")
                    lower.unlink(missing_ok=True)
                    upper.unlink(missing_ok=True)
                finally:
                    if output.exists():
                        reset = subprocess.run(
                            ["fsutil.exe", "file", "setCaseSensitiveInfo", str(output), "disable"],
                            capture_output=True, text=True, timeout=10)
                        if reset.returncode:
                            raise RuntimeError("failed to reset disposable directory case flag: " + reset.stderr)

    report["input_sha256"] = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in (
        "tools/rust_candidates.py", "tools/rust_attribution.py", "tools/rust_checker.py",
        "tools/probe_rust_staged.py", "fixtures/await-holding-lock/bad.rs", "fixtures/await-holding-lock/good.rs")}
    report["passed"] = all(report["expectations"].values())
    serialized = json.dumps(report, indent=2)
    for old in (temporary, Path(temporary).as_posix()):
        serialized = serialized.replace(json.dumps(old)[1:-1], "<probe>")
    print(serialized)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(probe())
