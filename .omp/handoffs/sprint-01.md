# Sprint 01: first Rust quality check

Dated execution evidence: 2026-09-10. Scope: analyzer fit only, under
[the approved build plan](../../docs/build-plan.md). No OMP hook, candidate edit
reconstruction, retry controller, exception journal, or PR integration was built.
This handoff records repository work, not a LoopX task-state transition or an
independent review approval.

## Result and reproduction

Run from the project root:

```text
python tools/probe_rust_quality.py
```

Requires Python 3.11+ and installed Rust/Cargo/Clippy on PATH. No Python packages,
Rust dependencies, network access, or linker are needed for these library checks.
The probe emits JSON and exits 0 only when all four expected cases pass; an unmet
expectation or unavailable real toolchain exits 1. Each child invocation has a
60-second timeout. Temporary crates and build output live under the ignored
`target/quality-probe/` and are removed when the probe exits normally.

[Exact recorded results](../../docs/sprint-01-results.json) contain invocations,
source SHA-256 digests, raw diagnostics, exit codes, completion markers, and
supplementary verification. These are dated observations, not a promise about
other toolchains. Rerun after changes to the probe, fixtures, compiler, analyzer,
Cargo configuration, or analyzed crate context.
The probe and fixture inputs have repository-local LF checkout attributes so
Windows newline conversion does not invalidate their recorded byte digests.

Observed toolchain: `rustc 1.96.1 (31fca3adb 2026-06-26)`,
`cargo 1.96.1 (356927216 2026-06-26)`,
`clippy 0.1.96 (31fca3adb2 2026-06-26)`;
`x86_64-pc-windows-msvc`, LLVM 22.1.2, Python 3.11.15.

| Constructed case | Observed analyzer result | Probe classification |
|---|---|---|
| `bad.rs`: synchronous mutex guard remains live across delivery await | Exit 0, successful build, one `clippy::await_holding_lock` at `lib.rs:7:9`; await at line 9 | `findings` |
| `good.rs`: copy snapshot under a short lexical lock scope, then await delivery | Exit 0, successful build, no diagnostics | `no_findings` |
| Good case plus a deliberately invalid return type | Exit 101, failed build, Rust `E0308`, no selected quality finding | `checker_failure` |
| Deliberately nonexistent analyzer executable | `FileNotFoundError`, no process exit code | `checker_failure` |

The bad case is valid Rust; its quality warning is not a syntax/type error. Both
bad and good exit 0 because the selected lint is explicitly enabled as a warning.
Exit status alone therefore cannot distinguish findings from a clean check.
Conversely, zero selected findings does not make a failed check clean. The probe
requires exit 0, exactly one successful Cargo `build-finished` event, and no error
diagnostics before assigning either successful outcome.

Supplementary checks exercised the consumer, not just Clippy:

- A real process that exits 0 without any Cargo output is `checker_failure`.
- An in-memory mutation changing the selected lint from `--force-warn` to
  `--allow` makes the bad case return `no_findings`; the whole probe exits 1 because
  `bad_reports_lock` is false. The tracked implementation was not modified.

## Selection, provenance, and limitations

Selected existing rule:
[`clippy::await_holding_lock`](https://rust-lang.github.io/rust-clippy/rust-1.96.0/index.html#await_holding_lock).
It recognizes non-async-aware mutex guards live across await points; it is not a
regex or a general judgment about abstraction quality.

The privately supplied Rust example seed's “Do not hold unrelated work behind a
network await” pair motivates this experiment. Both runnable fixtures are newly
constructed teaching examples, not copied private source or discovered defects.
The seed illustrated an async lock. This narrower probe deliberately uses
`std::sync::Mutex`, which the selected diagnostic supports, and handles poisoning
as an error. Both cases snapshot before delivery; only guard lifetime changes.
A generic delivery future may suspend. No actual network operation is performed.

This establishes one configured check over this pair, not automatic coverage of
all supplied principles, async mutex contention, cancellation safety, global
correctness, or deadlock freedom. Small-function and ignored-result heuristics
were not selected: their acceptability depends on domain meaning and required
versus best-effort contracts that a blanket syntax rule would erase.

Upstream documents false positives for an explicit `drop(guard)` before await.
The passing fixture uses a lexical scope instead. That limitation is documented,
not claimed resolved or independently retested here. Do not turn this probe into
a universal policy against all lock/await combinations.

## Context contract for Sprint 02

The executable probe copies a fixture into `lib.rs` of a fresh, standalone Cargo
library using `fixtures/await-holding-lock/Cargo.toml`: edition 2021, no dependencies,
no build scripts, no features, and an explicit `[workspace]` boundary. Each case
gets a new target directory, preventing reuse of earlier case artifacts. Cargo
may generate its dependency-free lockfile inside that disposable crate.

The analyzer invocation is:

```text
cargo clippy --offline --manifest-path <case>/Cargo.toml --target-dir <case>/target --lib --message-format=json -- -A clippy::all --force-warn clippy::await_holding_lock
```

Only this Clippy quality rule is selected; ordinary Rust compile errors remain
visible. Ambient Rust flags/wrappers and `CLIPPY_ARGS` are cleared by the probe;
normal Cargo configuration is still inherited. This is a trusted local probe,
not a sandbox for arbitrary manifests or a reusable production adapter.

Sprint 02 must preserve the real crate's required modules, dependencies, feature
selection, and compiler context when preparing candidate files. A copied
standalone file is sufficient only for these fixtures. Preserve the three-way
outcome distinction and the bad-case positive control. The JSON diagnostic
`lib.rs` spans refer to the disposable crate; candidate-to-original mapping is
not implemented. Build/check failure cannot authorize an edit.

Next bounded scope: reconstruct existing-file edits and new-file writes apart
from real targets, with sufficient checker context. Do not begin that sprint in
this session. Local commit only; no push or remote publication is authorized.
