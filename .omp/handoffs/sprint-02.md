# Sprint 02: isolated Rust candidates

Scope: candidate preparation and analysis under the [approved build plan](../../docs/build-plan.md).
This handoff reports implementation and measured behavior, not independent approval
or an OMP execution gate. The director owns acceptance and sequencing.

## Reproduce and evidence

From the project root, with Python 3.11+ and Rust/Cargo/Clippy installed:

```text
python tools/probe_rust_candidates.py
python tools/probe_rust_quality.py
```

Both commands emit JSON and return zero only when their expectations hold.
[Dated evidence](../../docs/sprint-02-results.json) records exact versions, input
hashes, commands, diagnostics, outcomes, and independently snapshotted original
fixture bytes. The fixtures are constructed by the probe in temporary directories;
no reference repository or private source packet is used. No network dependency
is required. The VCS-exclusion control compiles a real `build.rs`, so the Sprint 2
probe requires a working native Rust linker as well as Cargo/Clippy. The shared
checker retains the 60-second per-process deadline. Reproduce after changing the
implementation, fixtures, compiler, analyzer, configuration, or crate context.

The probe exercises existing-file edits, full replacement, and referenced new
module writes. Bad/good/bad alternation verifies positive lock diagnostics and
clean near-matches without carrying compiler artifacts between attempts. A
workspace sibling module, local path dependency, feature-selected module, and
required compiler cfg from `.cargo/config.toml` must all survive relocation.
Compilation failures, missing Cargo, nonunique/missing edits, traversal, escaping
local dependencies, and linked context entries remain visible failures. Windows
junction creation is exercised where symlink privilege is unavailable; the report
names the link type or explicitly records unavailable link creation.

Orphan files, feature-excluded files, inner-cfg-disabled modules, and files read
only by `include_str!` are not reported analyzed-clean. Sequential edits also
exercise UTF-8 and CRLF byte preservation. Whole-source-tree hashes, including
manifests and a preexisting lockfile, are compared independently after successful
and failed checks; proposed new real files remain absent.
An invocation from the nested package directory also passes, with diagnostic
paths resolved against Cargo's workspace root rather than the invocation cwd.

A real build script observes whether VCS metadata reached the copied workspace.
Absent `.git`, regular `.git` worktree-pointer files, and `.git` directories all
pass the exclusion check. The retained regression failed for the regular-file
case before its owning enumeration mechanism was fixed, while the two controls
passed. Whole-tree equality also verifies that original metadata stays unchanged.
A separate in-memory experiment shows that an unrelated Rust `unused_variables`
warning no longer fails Sprint 1's selected-rule near-match expectation.

## Preparation API

`tools/rust_candidates.py` exposes:

- `CargoContext(root, manifest, cwd=".", features=(), no_default_features=False,
  all_features=False, package=None, target=None)`.
- `TextEdit(old, new)` and `analyze_candidate(context, target, edits=[...])`.
- `analyze_candidate(context, target, content="...")` for creation or replacement.

`manifest`, `cwd`, and `target` are relative to `root`. The root must enclose the
workspace and its relative local path dependencies; `cwd` preserves the original
Cargo invocation directory and its configuration lookup. Feature selection and
optional package/target triple are explicit. Checks use `--all-targets` within the
selected package scope. This is a small exact-text preparation primitive, **not
OMP's edit grammar**. Native integration must reuse OMP's own reconstruction
semantics rather than translating native patches through a competing parser.

Edits apply sequentially to decoded UTF-8 text. Each nonempty old string must
occur exactly once in the current candidate; ambiguous, absent, empty, or
missing-file edits fail. Writes supply complete UTF-8 text and may create parent
directories only inside the disposable copy. Neither operation releases or
applies anything to the source workspace.

The result preserves Sprint 1's `findings`, `no_findings`, and `checker_failure`
outcomes, with original/candidate SHA-256 hashes and source-relative target
identity. Candidate preparation failures also use `checker_failure` with a visible
cause; an empty findings list alone never means success. Once the original
context is snapshotted, the result includes unchanged-input evidence. Failures
before snapshot capture do not claim verified immutability.

## Context and reachability

Ordinary context files are copied, preserving file metadata without retaining
hardlink identity. `.git` and `target` entries are excluded as both regular files
and directories; candidate paths cannot name them. Every attempt receives fresh
build directories. Cargo metadata
runs against the copy and verifies that local package manifests and target roots
remain inside it. Generated lockfiles and Cargo outputs belong to the copy.

`tools/rust_checker.py` owns the selected rule, process deadline, subprocess
execution, and Cargo JSON outcome classification. Both probes and the candidate
analyzer consume it directly; it does not depend on probe fixtures or a project
root. Invocation cwd is explicit. The candidate quality command uses `--offline`,
`--all-targets`, JSON diagnostics, and the existing forced warning for
`clippy::await_holding_lock`. It does not use `--fix` or rewrite proposals.

A successful Cargo invocation alone cannot prove a proposed module was checked.
After checking the exact candidate bytes, a separate build with an appended
`compile_error!` marker verifies that the same file is reached **as Rust**, under
its actual cfgs. Merely appearing in rustc dep-info is insufficient because text
includes also appear there. The reachability control uses separate build output;
its intentional error is not confused with the candidate's analyzer findings.
Candidate bytes are restored inside the temporary copy in `finally`, then the
entire copy is removed on normal exit or handled failure. If the marker is not
observed at that candidate path, the result is `candidate_not_compiled`, not clean.
This control covers ordinary Rust modules/crate roots; unusual expression-fragment
includes that cannot accept the marker fail visibly rather than gain unsupported
coverage. Diagnostics preserve Cargo workspace-relative paths, identified by
`diagnostic_root`; absolute copied paths use `<candidate>` and temporary build
paths use `<scratch>`.

## Trust boundary and limits

This is **trusted local Cargo execution**, as in Sprint 1. Copying isolates
candidate files and build outputs; it is **not an OS sandbox**. Build scripts,
procedural macros, toolchain programs, and Cargo-home configuration remain trusted
code. Deliberately malicious execution can access absolute real filesystem paths;
this implementation makes no protection claim against it. Dependencies must be
available offline. Required compiler/build prerequisites that are absent remain
checker failures, not fallback context-free checks.

Relative workspace/local dependency layouts and in-root Cargo configuration are
preserved. Unsupported absolute Cargo configuration paths, escaping relative
Cargo paths, symlinks/junctions/reparse entries, and ancestor Cargo/toolchain
configuration excluded from the supplied root are rejected visibly. Custom
compiler wrappers and `CLIPPY_ARGS` are rejected rather than silently discarded.
Other ambient compiler flags and Cargo-home configuration are inherited; callers
must supply a trusted, valid original compiler context. This is not a portable
rewrite engine for arbitrary absolute-path manifests or a concurrent filesystem
snapshot service. Before/after hashing detects changed originals but cannot
prevent concurrent writers or prove absence of transient write-and-restore
behavior. No code restores or autofixes the real source tree.

Findings still describe the whole selected Cargo check, including preexisting or
sibling findings; they are **not** introduced-finding judgments. Passing means
this configured check passed for an actually reached candidate, not global code
correctness, safety, or coverage of all lock/await combinations.

## Continuation boundary

The next approved scope is Sprint 3: distinguish introduced findings using
original/candidate context without added-line-overlap causation shortcuts. No
introduced-finding comparison, native OMP hook, retry controller, exception store,
no_rly release, commit disclosure, or PR integration is implemented here. Start
that work only in its fresh director-authorized worker scope. Local commits
require director review; no push or publication is authorized.
