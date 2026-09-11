"""Analyze final staged bytes in a copied, trusted local Cargo context.

This is a Python preparation API, not OMP's edit grammar or an execution gate.
Cargo/build scripts/proc macros are trusted code: the copy is not an OS sandbox.
"""

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PureWindowsPath
import shutil
import stat
import subprocess
import tempfile
import tomllib

from rust_checker import RULE, check, run
from rust_attribution import attribute, _spans


if os.name == "nt":
    import ctypes
    _kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _create_directory_handle = _kernel32.CreateFileW
    _create_directory_handle.argtypes = [
        ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p,
        ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
    _create_directory_handle.restype = ctypes.c_void_p
    _query_file_info = _kernel32.GetFileInformationByHandleEx
    _query_file_info.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
    _close_handle = _kernel32.CloseHandle
    _close_handle.argtypes = [ctypes.c_void_p]


class CandidateError(ValueError):
    """The proposed bytes or required context cannot be prepared faithfully."""


@dataclass(frozen=True)
class TextEdit:
    old: str
    new: str


@dataclass(frozen=True)
class CargoContext:
    root: Path
    manifest: str
    cwd: str = "."
    features: tuple[str, ...] = ()
    no_default_features: bool = False
    all_features: bool = False
    package: str | None = None
    target: str | None = None


def _relative(value):
    path = Path(value)
    if path.is_absolute() or PureWindowsPath(value).drive or ".." in path.parts:
        raise CandidateError(f"path must remain relative to context: {value}")
    if any(part in (".git", "target") for part in path.parts):
        raise CandidateError("candidate/context paths cannot name excluded output or VCS directories")
    return path


def _linked(path):
    info = path.lstat()
    return path.is_symlink() or bool(
        getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT
    )


def _files(root):
    if _linked(root):
        raise CandidateError("context root cannot be a link/reparse point")
    def fail(error):
        raise error

    for directory, names, files in os.walk(root, followlinks=False, onerror=fail):
        base = Path(directory)
        # Cargo output and VCS administration are not source context.
        names[:] = [name for name in names if name not in (".git", "target")]
        files = [name for name in files if name not in (".git", "target")]
        for name in names + files:
            path = base / name
            if _linked(path):
                raise CandidateError(f"linked/reparse-point context entry: {path.relative_to(root)}")
            if path.is_file():
                yield path
            elif not path.is_dir():
                raise CandidateError(f"non-regular context entry: {path.relative_to(root)}")


def _digest(data):
    return hashlib.sha256(data).hexdigest()


def _snapshot(root):
    return {path.relative_to(root).as_posix(): _digest(path.read_bytes()) for path in _files(root)}


def _validate_toml(path, root):
    """Reject relocations we cannot preserve, rather than analyze a thinner crate."""
    data = tomllib.loads(path.read_text(encoding="utf-8"))

    def visit(value, key=""):
        if isinstance(value, dict):
            for child_key, child in value.items():
                visit(child, child_key)
        elif isinstance(value, list):
            for child in value:
                visit(child, key)
        elif isinstance(value, str):
            if Path(value).is_absolute() or PureWindowsPath(value).drive:
                raise CandidateError(f"absolute Cargo configuration path unsupported: {path.relative_to(root)}")
            if key in ("rustc-wrapper", "rustc-workspace-wrapper") and value:
                raise CandidateError("custom compiler wrappers in Cargo configuration are unsupported")
            if key in ("path", "paths", "build", "workspace", "members", "default-members",
                       "exclude", "directory", "local-registry"):
                base = path.parent.parent if path.parent.name == ".cargo" else path.parent
                resolved = (base / value).resolve()
                if not resolved.is_relative_to(root):
                    raise CandidateError(f"Cargo path escapes context: {path.relative_to(root)}")
    visit(data)


def _selection(context):
    args = []
    if context.features:
        args += ["--features", ",".join(context.features)]
    if context.no_default_features:
        args.append("--no-default-features")
    if context.all_features:
        args.append("--all-features")
    return args


def _compiled(candidate, candidate_bytes, command, environment, cwd, target_dir, workspace_root):
    # Dep-info alone also lists include_str!/include_bytes! inputs. A separate
    # compile-error control proves this file is reached as Rust, under its cfgs.
    marker = "turnstile_candidate_reachability_" + _digest(candidate_bytes)
    control = command.copy()
    control[control.index("--target-dir") + 1] = str(target_dir / "reachability")
    control_environment = environment.copy()
    control_environment["CARGO_BUILD_BUILD_DIR"] = str(target_dir / "reachability-build")
    control_bytes = candidate_bytes + f'\ncompile_error!("{marker}");\n'.encode()
    try:
        candidate.write_bytes(control_bytes)
        observed = check(control, control_environment, cwd=cwd)
        if candidate.read_bytes() != control_bytes:
            raise CandidateError("Cargo changed reachability control bytes")
        reached = any(
            diagnostic["level"] == "error" and diagnostic["message"] == marker
            and any(span["is_primary"] and (
                (workspace_root / span["file_name"]).resolve() == candidate.resolve()
            ) for span in diagnostic["spans"])
            for diagnostic in observed.get("diagnostics", [])
        )
        return reached, {"reached_as_rust": reached, "check": observed,
                         "exit_code": observed.get("exit_code"), "error": observed.get("error")}
    finally:
        candidate.write_bytes(candidate_bytes)


def _check_context(context, copied, target_dir, environment, cargo):
    """Run the same Cargo selection for either exact source context."""
    manifest = copied / _relative(context.manifest)
    cwd = copied / _relative(context.cwd)
    environment = environment.copy()
    environment["CARGO_TARGET_DIR"] = str(target_dir)
    environment["CARGO_BUILD_BUILD_DIR"] = str(target_dir / "intermediate")
    metadata_command = [cargo, "metadata", "--offline", "--format-version=1",
                        "--manifest-path", str(manifest), *_selection(context)]
    try:
        process = run(metadata_command, environment, cwd=cwd)
        if process.returncode != 0:
            return {"outcome": "checker_failure", "findings": [], "error": "cargo_metadata_failed",
                    "command": metadata_command, "stderr": process.stderr, "exit_code": process.returncode}
        metadata = json.loads(process.stdout)
        if not Path(metadata["workspace_root"]).resolve().is_relative_to(copied):
            raise CandidateError("Cargo workspace escapes copied context")
        for package in metadata["packages"]:
            if package["source"] is None:
                paths = [package["manifest_path"], *(t["src_path"] for t in package["targets"])]
                if any(not Path(p).resolve().is_relative_to(copied) for p in paths):
                    raise CandidateError("local Cargo package/target escapes copied context")
        command = [cargo, "clippy", "--offline", "--manifest-path", str(manifest),
                   "--target-dir", str(target_dir), "--all-targets", "--message-format=json",
                   *_selection(context)]
        if context.package:
            command += ["--package", context.package]
        if context.target:
            command += ["--target", context.target]
        command += ["--", "-A", "clippy::all", "--force-warn", RULE]
        result = check(command, environment, cwd=cwd)
        result["diagnostic_root"] = metadata["workspace_root"]
        return result
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        return {"outcome": "checker_failure", "findings": [], "error": f"{type(error).__name__}: {error}"}


def _sources(observed, copied, expected):
    sources = {}
    for diagnostic in observed["findings"]:
        for span in _spans(diagnostic):
            path = (Path(observed["diagnostic_root"]) / span["file_name"]).resolve()
            if not path.is_relative_to(copied):
                continue
            relative = path.relative_to(copied).as_posix()
            if relative in sources or relative not in expected:
                continue
            data = path.read_bytes()
            if _digest(data) != expected[relative]:
                raise CandidateError("Cargo changed diagnostic source bytes during analysis")
            sources[relative] = data
    return sources


def _directory_case_sensitive(directory):
    """Query one Windows directory; None records a not-yet-existing parent."""
    if not directory.exists():
        return None
    handle = _create_directory_handle(str(directory), 0x80, 7, None, 3, 0x02000000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        info = ctypes.c_uint32()
        # FileCaseSensitiveInfo / FILE_CS_FLAG_CASE_SENSITIVE_DIR.
        if not _query_file_info(handle, 23, ctypes.byref(info), ctypes.sizeof(info)):
            raise ctypes.WinError(ctypes.get_last_error())
        return bool(info.value & 1)
    finally:
        _close_handle(handle)


def _check_case_semantics(original, copied, observed):
    """Retain original observations, not merely source/copy equality at setup."""
    if os.name != "nt":
        return
    sensitive = _directory_case_sensitive(original)
    if observed.setdefault(original.as_posix(), sensitive) != sensitive:
        raise CandidateError("original directory case sensitivity changed")
    if sensitive != _directory_case_sensitive(copied):
        raise CandidateError("original/copied directory case sensitivity differs")


def _copy_context(root, copied, expected, directory_semantics):
    copied.mkdir()
    directories = {Path(".")}
    for source in _files(root):
        directories.update(source.relative_to(root).parents)
        destination = copied / source.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    if _snapshot(copied) != expected:
        raise CandidateError("context changed while copying")
    for relative in directories:
        _check_case_semantics(root / relative, copied / relative, directory_semantics)


def _validate_context(copied):
    for path in _files(copied):
        if path.name == "Cargo.toml" or path.relative_to(copied).as_posix().endswith(
                (".cargo/config", ".cargo/config.toml")):
            _validate_toml(path, copied)


def _verify_sources(copied, expected, absent=(), written=()):
    # Cargo owns ordinary lockfile refreshes; explicitly staged lockfile bytes,
    # like every captured source/config input, must still be checked exactly.
    for relative, digest in expected.items():
        if Path(relative).name == "Cargo.lock" and relative not in written:
            continue
        if _digest((copied / relative).read_bytes()) != digest:
            raise CandidateError(f"Cargo changed captured source bytes: {relative}")
    if any((copied / relative).exists() for relative in absent):
        raise CandidateError("Cargo recreated a staged deletion")


def _staged_operations(root, copied, operations, directory_semantics):
    """Validate every image against the untouched copy before any replay."""
    def relative(value):
        if not isinstance(value, str) or not Path(value).is_absolute():
            raise CandidateError("native path must be absolute")
        path = Path(value)
        if ".." in path.parts or not path.is_relative_to(root):
            raise CandidateError("native path escapes context")
        resolved = path.resolve()
        if not resolved.is_relative_to(root):
            raise CandidateError("native resolved path escapes context")
        parent = resolved.parent
        while not parent.exists():
            _check_case_semantics(parent, copied / parent.relative_to(root), directory_semantics)
            parent = parent.parent
        copied_parent = copied / parent.relative_to(root)
        if not copied_parent.exists():
            # Empty original directories are not copied; check the semantics
            # inherited when the candidate materializes a path beneath them.
            while not copied_parent.exists():
                copied_parent = copied_parent.parent
            _check_case_semantics(parent, copied_parent, directory_semantics)
        return _relative(resolved.relative_to(root).as_posix()).as_posix()

    def image(path, text):
        if text is not None and not isinstance(text, str):
            raise CandidateError("native preimage must be UTF-8 text or null")
        expected = None if text is None else text.encode("utf-8")
        source = copied / path
        actual = source.read_bytes() if source.is_file() else None
        if source.is_dir() or actual != expected:
            raise CandidateError(f"stale native preimage: {path}")
        return expected

    prepared = []
    for operation in operations:
        op = operation["op"]
        if op not in ("create", "update", "delete", "move", "noop"):
            raise CandidateError("unsupported native operation")
        path = relative(operation["path"])
        if not isinstance(operation["displayPath"], str):
            raise CandidateError("native displayPath must be text")
        before = image(path, operation["before"])
        after = operation["after"]
        if op == "delete":
            if after is not None:
                raise CandidateError("delete after must be null")
        elif not isinstance(after, str) and not (op == "noop" and after is None):
            raise CandidateError("native after must be exact UTF-8 text")
        after = after.encode("utf-8") if after is not None else None
        if op == "noop" and after != before:
            raise CandidateError("noop after must equal original")
        destination = None
        if op == "move":
            destination = relative(operation["moveTo"])
            image(destination, operation["moveBefore"])
        elif operation["moveTo"] is not None or operation["moveBefore"] is not None:
            raise CandidateError("non-move destination must be null")
        prepared.append((op, path, destination, before, after))
    return prepared


def analyze_staged(context, operations, *, cargo="cargo"):
    """Analyze a complete native staged vector, in order, without real mutation.

    Paths are absolute under explicit CargoContext.root. before/moveBefore are
    exact PRE-CALL UTF-8 images; after is already native-persisted text. No grammar
    parsing or collision policy belongs here. Context-only operations still run
    Cargo; only surviving written .rs files require individual compiler controls.
    """
    return _analyze(context, lambda root, copied, result: operations, cargo)


def analyze_candidate(context, target, *, edits=None, content=None, cargo="cargo"):
    """Prepare unique-text edits OR a full UTF-8 Rust write through the same owner."""
    def prepare(root, copied, result):
        relative = _relative(target)
        if relative.suffix != ".rs":
            raise CandidateError("candidate must be a Rust file")
        if (edits is None) == (content is None):
            raise CandidateError("provide exactly one of edits or content")
        source = copied / relative
        original = source.read_bytes() if source.is_file() else None
        if edits is not None:
            if original is None:
                raise CandidateError("edit target does not exist")
            if not edits:
                raise CandidateError("edit list is empty")
            text = original.decode("utf-8")
            for edit in edits:
                if not edit.old or text.count(edit.old) != 1:
                    raise CandidateError("each edit must match exactly once in the current candidate")
                text = text.replace(edit.old, edit.new, 1)
        else:
            if not isinstance(content, str):
                raise CandidateError("write content must be UTF-8 text")
            text = content
        result.update(target=relative.as_posix(), operation="edit" if edits is not None else "write",
                      original_sha256=_digest(original) if original is not None else None,
                      candidate_sha256=_digest(text.encode("utf-8")))
        return [{"op": "update" if original is not None else "create",
                 "path": str(root / relative), "displayPath": relative.as_posix(),
                 "moveTo": None, "before": original.decode("utf-8") if original is not None else None,
                 "after": text, "moveBefore": None}]
    return _analyze(context, prepare, cargo)


def _analyze(context, prepare, cargo):
    temporary = None
    result = {"outcome": "checker_failure", "findings": [], "preexisting_findings": [],
              "ambiguous_findings": [], "baseline": {"status": "not_run", "reason": "candidate_not_verified"}}
    root = Path(context.root).absolute()
    before = None
    directory_semantics = {}
    try:
        if _linked(root):
            raise CandidateError("context root cannot be a link/reparse point")
        root = root.resolve(strict=True)
        _relative(context.manifest)
        cwd_relative = _relative(context.cwd)
        for parent in root.parents:
            if any((parent / name).is_file() for name in (
                ".cargo/config", ".cargo/config.toml", "rust-toolchain", "rust-toolchain.toml"
            )):
                raise CandidateError("context root excludes ancestor Cargo/toolchain configuration")
        before = _snapshot(root)
        environment = os.environ.copy()
        if any(environment.get(name) for name in ("RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "CLIPPY_ARGS")):
            raise CandidateError("custom compiler wrappers/CLIPPY_ARGS are unsupported")
        # Short components keep ordinary Windows linker outputs below MAX_PATH.
        with tempfile.TemporaryDirectory(prefix="ts-") as temporary:
            copied = Path(temporary) / "c"
            baseline_root = Path(temporary) / "b"
            _copy_context(root, copied, before, directory_semantics)
            _validate_context(copied)
            operations = _staged_operations(root, copied, prepare(root, copied, result), directory_semantics)
            expected = before.copy()
            origins = {relative: relative for relative in before}
            written = {}
            absent = set()
            for op, path, destination, original, after in operations:
                if op == "noop":
                    continue
                if op != "delete":
                    output = destination if op == "move" else path
                    candidate = copied / output
                    candidate.parent.mkdir(parents=True, exist_ok=True)
                    candidate.write_bytes(after)
                    # Canonicalize only after materialization: initially absent
                    # native names can alias on this filesystem, without casefolding.
                    output = candidate.resolve(strict=True).relative_to(copied).as_posix()
                    expected[output] = _digest(after)
                    # Frozen original identity, NOT the occupant left by prior ops.
                    origins[output] = path if original is not None else None
                    written[output] = after
                    absent.discard(output)
                if op in ("delete", "move"):
                    removed = (copied / path).resolve().relative_to(copied).as_posix()
                    (copied / path).unlink(missing_ok=True)
                    expected.pop(removed, None)
                    origins.pop(removed, None)
                    written.pop(removed, None)
                    absent.add(removed)
            absent = {p for p in absent if not (copied / p).exists()}
            _validate_context(copied)
            rust_targets = {p: data for p, data in written.items() if Path(p).suffix == ".rs"}
            result["staged_sources"] = {
                p: {"sha256": expected[p], "original_path": origins[p]} for p in written}
            result["coverage"] = {"status": "not_run", "rust_targets": list(rust_targets)}
            cwd = copied / cwd_relative
            target_dir = Path(temporary) / "t"
            candidate_check = _check_context(context, copied, target_dir, environment, cargo)
            result.update(candidate_check)
            result["candidate_check"] = candidate_check
            result["findings"] = []
            _verify_sources(copied, expected, absent, written)
            result["coverage"]["status"] = (
                "checker_failure" if candidate_check["outcome"] == "checker_failure" else "context_checked")
            if candidate_check["outcome"] != "checker_failure":
                controls = {}
                for relative, data in rust_targets.items():
                    reached, control = _compiled(
                        copied / relative, data, candidate_check["command"], environment, cwd, target_dir,
                        Path(candidate_check["diagnostic_root"]))
                    controls[relative] = control
                    _verify_sources(copied, expected, absent, written)
                result["reachability"] = controls
                if rust_targets:
                    result["candidate_compiled"] = all(c["reached_as_rust"] for c in controls.values())
                    result["coverage"]["status"] = (
                        "written_rust_checked" if result["candidate_compiled"] else "unreached_rust")
                    if "target" in result:
                        result["reachability_control"] = next(iter(controls.values()))
                    if not result["candidate_compiled"]:
                        result.update(outcome="checker_failure", error="candidate_not_compiled")
            if candidate_check["findings"]:
                candidate_sources = _sources(candidate_check, copied, expected)
                intrinsic, remaining = [], []
                for diagnostic in candidate_check["findings"]:
                    spans = list(_spans(diagnostic))
                    paths = [(Path(candidate_check["diagnostic_root"]) / s["file_name"]).resolve() for s in spans]
                    wholly_new = paths and all(
                        p.is_relative_to(copied) and p.relative_to(copied).as_posix() in candidate_sources
                        and origins.get(p.relative_to(copied).as_posix(), p.relative_to(copied).as_posix()) is None
                        for p in paths)
                    (intrinsic if wholly_new else remaining).append(diagnostic)
                empty = {"findings": [], "diagnostic_root": str(copied)}
                introduced, _, ambiguous = attribute(
                    empty, {**candidate_check, "findings": intrinsic}, {}, candidate_sources, copied, copied)
                result.update(findings=introduced, ambiguous_findings=ambiguous)
                preexisting = []
                if remaining:
                    result["baseline"] = {"status": "required"}
                    _copy_context(root, baseline_root, before, directory_semantics)
                    baseline = _check_context(context, baseline_root, Path(temporary) / "bt", environment, cargo)
                    result["baseline"] = {"status": "required", "check": baseline}
                    _verify_sources(baseline_root, before)
                    if baseline["outcome"] == "checker_failure":
                        result.update(outcome="checker_failure", error="required_baseline_failed")
                    else:
                        original_sources = _sources(baseline, baseline_root, before)
                        for relative in candidate_sources:
                            origin = origins.get(relative, relative)
                            if origin in before and origin not in original_sources:
                                original_sources[origin] = (baseline_root / origin).read_bytes()
                        new, preexisting, uncertain = attribute(
                            baseline, {**candidate_check, "findings": remaining}, original_sources,
                            candidate_sources, baseline_root, copied, origins)
                        introduced.extend(new)
                        ambiguous.extend(uncertain)
                else:
                    result["baseline"] = {"status": "not_required", "reason": "findings_wholly_in_new_file"}
                result.update(findings=introduced, preexisting_findings=preexisting, ambiguous_findings=ambiguous)
                if result["outcome"] != "checker_failure":
                    if ambiguous:
                        result.update(outcome="checker_failure", error="attribution_ambiguous")
                    else:
                        result["outcome"] = "findings" if introduced else "no_findings"
            elif result["outcome"] != "checker_failure":
                result["baseline"] = {"status": "not_required", "reason": "candidate_has_no_findings"}
            _verify_sources(copied, expected, absent, written)
            result["analyzed_sources_unchanged"] = True
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        result.update(outcome="checker_failure", error=f"{type(error).__name__}: {error}")
    finally:
        if temporary is not None:
            # Finish response preparation before the final original-context observation.
            serialized = json.dumps(result)
            for path, label in ((copied, "<candidate>"), (baseline_root, "<baseline>"),
                                (Path(temporary), "<scratch>")):
                for old in (str(path), path.as_posix()):
                    serialized = serialized.replace(json.dumps(old)[1:-1], label)
            result = json.loads(serialized)
        if before is not None:
            try:
                after = _snapshot(root)
                result["originals_unchanged"] = after == before
                result["original_snapshot_sha256"] = _digest(json.dumps(before, sort_keys=True).encode())
                if directory_semantics:
                    result["directory_semantics"] = {
                        "before": {Path(p).relative_to(root).as_posix(): value
                                   for p, value in directory_semantics.items()}}
                    current_semantics = {p: _directory_case_sensitive(Path(p)) for p in directory_semantics}
                    semantics_unchanged = current_semantics == directory_semantics
                    result["directory_semantics"].update(
                        after={Path(p).relative_to(root).as_posix(): value
                               for p, value in current_semantics.items()},
                        unchanged=semantics_unchanged)
                    if not semantics_unchanged:
                        result.update(outcome="checker_failure", originals_unchanged=False,
                                      error="original_directory_semantics_changed")
                if after != before:
                    result.update(outcome="checker_failure", error="original_context_changed")
            except (OSError, CandidateError) as error:
                result.update(outcome="checker_failure", originals_unchanged=False,
                              error=f"original_context_unverifiable: {error}")
    return result


def _staged_cli(request):
    """JSON transport only; the existing staged owner makes every analysis decision."""
    context = request["context"]
    allowed = {"root", "manifest", "cwd", "features", "no_default_features",
               "all_features", "package", "target"}
    if not isinstance(context, dict) or set(context) - allowed:
        raise ValueError("invalid Cargo context fields")
    for name in ("root", "manifest"):
        if not isinstance(context.get(name), str) or not context[name]:
            raise ValueError(f"context.{name} must be a nonempty string")
    for name in ("cwd", "package", "target"):
        if name in context and (not isinstance(context[name], str) or not context[name]):
            raise ValueError(f"context.{name} must be a nonempty string")
    for name in ("no_default_features", "all_features"):
        if name in context and not isinstance(context[name], bool):
            raise ValueError(f"context.{name} must be boolean")
    if "features" in context and (not isinstance(context["features"], list)
            or any(not isinstance(f, str) or not f for f in context["features"])):
        raise ValueError("context.features must be an array of nonempty strings")
    root = Path(request["workspace"]) / _relative(context["root"])
    if Path(tempfile.gettempdir()).resolve().is_relative_to(root.resolve()):
        raise ValueError("checker temporary directory must be outside the selected Cargo root")
    return analyze_staged(CargoContext(**{**context, "root": root}),
                          request["operations"], cargo=request["cargo"])


if __name__ == "__main__":
    import argparse
    import sys
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staged", action="store_true", required=True, help="read UTF-8 JSON from stdin")
    parser.parse_args()
    try:
        response = _staged_cli(json.loads(sys.stdin.buffer.read().decode("utf-8")))
    except (OSError, ValueError, KeyError, TypeError) as error:
        response = {"outcome": "checker_failure", "findings": [],
                    "error": f"{type(error).__name__}: {error}"}
    print(json.dumps(response, ensure_ascii=True))
