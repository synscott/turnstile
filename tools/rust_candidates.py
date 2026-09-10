"""Prepare one Rust candidate in a copied, trusted local Cargo context.

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
    try:
        candidate.write_bytes(candidate_bytes + f'\ncompile_error!("{marker}");\n'.encode())
        observed = check(control, control_environment, cwd=cwd)
        reached = any(
            diagnostic["level"] == "error" and diagnostic["message"] == marker
            and any(span["is_primary"] and (
                (workspace_root / span["file_name"]).resolve() == candidate.resolve()
            ) for span in diagnostic["spans"])
            for diagnostic in observed.get("diagnostics", [])
        )
        return reached, {
            "reached_as_rust": reached,
            "exit_code": observed.get("exit_code"),
            "error": observed.get("error"),
        }
    finally:
        candidate.write_bytes(candidate_bytes)


def analyze_candidate(context, target, *, edits=None, content=None, cargo="cargo"):
    """Analyze sequential unique-text edits OR a full UTF-8 write, never apply it.

    Paths are relative to context.root. The caller encloses the workspace and
    relative local dependencies, and selects the original Cargo invocation cwd.
    Once inputs are snapshotted, returns unchanged-input evidence. Preflight
    failures before that point do not claim verified immutability. No release exists.
    """
    result = {"outcome": "checker_failure", "findings": []}
    root = Path(context.root).absolute()
    before = None
    try:
        if _linked(root):
            raise CandidateError("context root cannot be a link/reparse point")
        root = root.resolve(strict=True)
        target_relative = _relative(target)
        manifest_relative = _relative(context.manifest)
        cwd_relative = _relative(context.cwd)
        if target_relative.suffix != ".rs":
            raise CandidateError("candidate must be a Rust file")
        if (edits is None) == (content is None):
            raise CandidateError("provide exactly one of edits or content")
        # Relocation cannot silently drop configuration above the supplied root.
        for parent in root.parents:
            if any((parent / name).is_file() for name in (
                ".cargo/config", ".cargo/config.toml", "rust-toolchain", "rust-toolchain.toml"
            )):
                raise CandidateError("context root excludes ancestor Cargo/toolchain configuration")
        before = _snapshot(root)
        original_path = root / target_relative
        original = original_path.read_bytes() if original_path.is_file() else None
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
        candidate_bytes = text.encode("utf-8")
        result.update(
            target=target_relative.as_posix(),
            operation="edit" if edits is not None else "write",
            original_sha256=_digest(original) if original is not None else None,
            candidate_sha256=_digest(candidate_bytes),
        )
        environment = os.environ.copy()
        if any(environment.get(name) for name in ("RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "CLIPPY_ARGS")):
            raise CandidateError("custom compiler wrappers/CLIPPY_ARGS are unsupported")
        with tempfile.TemporaryDirectory(prefix="turnstile-candidate-") as temporary:
            copied = Path(temporary) / "context"
            copied.mkdir()
            for source in _files(root):
                destination = copied / source.relative_to(root)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            if _snapshot(copied) != before:
                raise CandidateError("context changed while copying")
            for path in _files(copied):
                if path.name == "Cargo.toml" or path.relative_to(copied).as_posix().endswith((".cargo/config", ".cargo/config.toml")):
                    _validate_toml(path, copied)
            candidate = copied / target_relative
            candidate.parent.mkdir(parents=True, exist_ok=True)
            candidate.write_bytes(candidate_bytes)
            manifest = copied / manifest_relative
            cwd = copied / cwd_relative
            target_dir = Path(temporary) / "build"
            # Cargo/rustc output and generated lockfiles belong only to the copy.
            environment["CARGO_TARGET_DIR"] = str(target_dir)
            environment["CARGO_BUILD_BUILD_DIR"] = str(target_dir / "intermediate")
            metadata_command = [cargo, "metadata", "--offline", "--format-version=1",
                                "--manifest-path", str(manifest), *_selection(context)]
            metadata_process = run(metadata_command, environment, cwd=cwd)
            if metadata_process.returncode != 0:
                result.update(error="cargo_metadata_failed", stderr=metadata_process.stderr,
                              exit_code=metadata_process.returncode)
            else:
                metadata = json.loads(metadata_process.stdout)
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
                result.update(check(command, environment, cwd=cwd))
                result["diagnostic_root"] = metadata["workspace_root"]
                if candidate.read_bytes() != candidate_bytes:
                    raise CandidateError("Cargo changed candidate bytes during analysis")
                if result["outcome"] != "checker_failure":
                    reached, control = _compiled(
                        candidate, candidate_bytes, command, environment, cwd, target_dir,
                        Path(metadata["workspace_root"]),
                    )
                    result["candidate_compiled"] = reached
                    result["reachability_control"] = control
                    if not reached:
                        result.update(outcome="checker_failure", error="candidate_not_compiled")
            # Returned diagnostics refer to stable context-relative locations.
            serialized = json.dumps(result)
            for old, new in ((str(copied), "<candidate>"), (copied.as_posix(), "<candidate>"),
                             (str(Path(temporary)), "<scratch>"), (Path(temporary).as_posix(), "<scratch>")):
                serialized = serialized.replace(json.dumps(old)[1:-1], new)
            result = json.loads(serialized)
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        result.update(outcome="checker_failure", error=f"{type(error).__name__}: {error}")
    finally:
        if before is not None:
            try:
                after = _snapshot(root)
                result["originals_unchanged"] = after == before
                result["original_snapshot_sha256"] = _digest(json.dumps(before, sort_keys=True).encode())
                if after != before:
                    result.update(outcome="checker_failure", error="original_context_changed")
            except (OSError, CandidateError) as error:
                result.update(outcome="checker_failure", originals_unchanged=False,
                              error=f"original_context_unverifiable: {error}")
    return result
