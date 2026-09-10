"""Sprint 01 only: prove one Clippy diagnostic, not an edit gate."""

import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

from rust_checker import RULE, TIMEOUT, check, run


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path("fixtures/await-holding-lock")


def probe():
    if Path.cwd().resolve() != ROOT:
        raise RuntimeError("Run this probe from the project root")
    environment = os.environ.copy()
    # Use a fresh target per case; ambient flags/wrappers must not bypass Clippy.
    for name in ("RUSTFLAGS", "CARGO_ENCODED_RUSTFLAGS", "RUSTC_WRAPPER",
                 "RUSTC_WORKSPACE_WRAPPER", "CLIPPY_ARGS"):
        environment.pop(name, None)

    versions = {}
    for name, command in (
        ("rustc", ["rustc", "--version", "--verbose"]),
        ("cargo", ["cargo", "--version"]),
        ("clippy", ["cargo", "clippy", "--version"]),
    ):
        process = run(command, environment, cwd=ROOT)
        if process.returncode != 0 or not process.stdout.strip():
            raise RuntimeError(f"{name} version check failed: {process.stderr}")
        versions[name] = process.stdout.strip()

    inputs = [FIXTURES / "Cargo.toml", FIXTURES / "bad.rs", FIXTURES / "good.rs",
              Path("tools/probe_rust_quality.py"), Path("tools/rust_checker.py")]
    report = {
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "rule": RULE,
        "versions": versions,
        "python": platform.python_version(),
        "platform": platform.system() + " " + platform.machine(),
        "input_sha256": {p.as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
        "timeout_seconds_per_process": TIMEOUT,
        "cases": {},
    }
    target = Path("target/quality-probe")
    target.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="run-", dir=target) as temporary:
        scratch = Path(temporary)
        for name in ("bad", "good", "compiler_failure", "unavailable"):
            crate = scratch / name
            crate.mkdir()
            (crate / "Cargo.toml").write_bytes((FIXTURES / "Cargo.toml").read_bytes())
            source = (FIXTURES / ("bad.rs" if name == "bad" else "good.rs")).read_text(encoding="utf-8")
            if name == "compiler_failure":
                source += '\npub fn broken() -> u64 { "not a number" }\n'
            (crate / "lib.rs").write_text(source, encoding="utf-8")
            cargo = str(scratch / "missing-cargo") if name == "unavailable" else "cargo"
            command = [
                cargo, "clippy", "--offline", "--manifest-path", str(crate / "Cargo.toml"),
                "--target-dir", str(crate / "target"), "--lib", "--message-format=json",
                "--", "-A", "clippy::all", "--force-warn", RULE,
            ]
            report["cases"][name] = check(command, environment, cwd=ROOT)

    cases = report["cases"]
    # Independently expected diagnostic identity and source span, not merely a nonzero count.
    bad = cases["bad"]
    bad_spans = [s for d in bad["findings"] for s in d["spans"] if s["is_primary"]]
    expectations = {
        "bad_reports_lock": (
            bad["outcome"] == "findings" and bad["exit_code"] == 0
            and len(bad["findings"]) == 1
            and any(s["line_start"] == 7 and s["file_name"].endswith("lib.rs") for s in bad_spans)
        ),
        "near_match_passes": (
            cases["good"]["outcome"] == "no_findings"
        ),
        "compiler_failure_is_not_clean": (
            cases["compiler_failure"]["outcome"] == "checker_failure"
            and cases["compiler_failure"].get("exit_code") not in (None, 0)
            and any((d.get("code") or {}).get("code") == "E0308"
                    for d in cases["compiler_failure"].get("diagnostics", []))
        ),
        "unavailable_is_not_clean": (
            cases["unavailable"]["outcome"] == "checker_failure"
            and cases["unavailable"].get("error") == "FileNotFoundError"
        ),
    }
    report["expectations"] = expectations
    report["passed"] = all(expectations.values())
    # Cargo includes absolute crate paths in stderr; published evidence stays public-safe.
    serialized = json.dumps(report, indent=2, ensure_ascii=False)
    for root in (str(ROOT), ROOT.as_posix()):
        serialized = serialized.replace(json.dumps(root)[1:-1], "<project>")
    print(serialized)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    try:
        sys.exit(probe())
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(json.dumps({"passed": False, "outcome": "checker_failure", "error": str(error)}))
        sys.exit(1)
