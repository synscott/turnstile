"""Bounded Cargo JSON diagnostic execution for the selected Rust quality rule."""

import json
import subprocess


RULE = "clippy::await_holding_lock"
TIMEOUT = 60


def run(command, environment, *, cwd):
    return subprocess.run(
        command, cwd=cwd, env=environment, capture_output=True,
        text=True, encoding="utf-8", errors="replace", timeout=TIMEOUT,
    )


def check(command, environment, *, cwd):
    result = {"command": command, "outcome": "checker_failure", "findings": []}
    try:
        process = run(command, environment, cwd=cwd)
    except (OSError, subprocess.TimeoutExpired) as error:
        result["error"] = type(error).__name__
        return result

    result.update(exit_code=process.returncode, stderr=process.stderr)
    try:
        messages = [json.loads(line) for line in process.stdout.splitlines() if line.strip()]
        finished = [m["success"] for m in messages if m["reason"] == "build-finished"]
        diagnostics = [m["message"] for m in messages if m["reason"] == "compiler-message"]
        result["diagnostics"] = diagnostics
        result["build_finished"] = finished
        result["findings"] = [
            d for d in diagnostics if (d.get("code") or {}).get("code") == RULE
        ]
        if (process.returncode == 0 and finished == [True]
                and not any(d["level"] == "error" for d in diagnostics)):
            result["outcome"] = "findings" if result["findings"] else "no_findings"
        else:
            result["error"] = "unsuccessful_or_incomplete_check"
    except (ValueError, KeyError, TypeError) as error:
        result["error"] = "invalid_checker_output: " + type(error).__name__
        result["stdout"] = process.stdout
    return result
