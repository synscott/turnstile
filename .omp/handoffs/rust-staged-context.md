# Rust complete staged Cargo context

Scope: Director accepted the Python prerequisite on snapshot `7fd744183c9cfb79504b1db6048bde374ed24e985c798e05f547d296fa65bf29`, implementation author: `rust-staged-context`, independent reviewer: `staged-context-review`. Original Sprint 4 native integration/model proof is not accepted.

## API and native input

`tools/rust_candidates.py` exposes `analyze_staged(context, operations, *, cargo="cargo")`. `CargoContext` remains explicit: root, manifest, cwd and Cargo selection are supplied; no workspace discovery is added. The existing `analyze_candidate(..., edits=[TextEdit(...)])` and `analyze_candidate(..., content=...)` prepare through the same analysis mechanism.

Each operation uses the frozen native fields `op`, `path`, `displayPath`, `moveTo`, `before`, `after`, and `moveBefore`. The vector is already in **native staged/writer order**, not necessarily textual section order. Paths are absolute native-resolved filesystem paths inside the trusted root. The owner applies its existing relative-path, escape and reparse-point defenses.

- `before` and `moveBefore` are exact original UTF-8 **pre-call** images, including BOM and line endings; null means absent. A create can overwrite and therefore have non-null `before`.
- Validate every image against one untouched baseline copy before replaying anything. Do not compare later preimages with intermediate outputs.
- Replay native operations in order: create/update write exact `after`, delete removes, move writes destination then removes source, noop does not write. Do not reconstruct native grammar, reorder, or add collision/overwrite restrictions.
- Keep the last surviving writer for each output. Its attribution origin is that operation's original source, never the replay-time occupant or overwritten destination. Baseline occurrence ownership binds to the final physical primary occurrence: lib/test compilation variants at that same occurrence may share it, but a second final path/byte range cannot reuse it when a move plus a later write duplicates the source.
- After a write materializes a path, resolve its actual filesystem canonical identity for final-output bookkeeping. Initially absent native spellings such as `fresh.rs` and `FRESH.rs` can alias on a case-insensitive filesystem; the later writer wins without a universal casefold. Deletion bookkeeping likewise resolves the actual materialized source.
- Validate Cargo manifests/configuration before and after replay. Run the combined selection against the final copied context, not independent file proposals against unstaged siblings.

## Results and coverage

The existing `outcome`, `findings`, `preexisting_findings`, `ambiguous_findings`, `candidate_check`, and baseline-requiredness contract remains. Only `outcome="no_findings"` means the required selected analysis completed without introduced or unresolved findings. Empty finding lists alone never authorize release.

`staged_sources` records final written-path hashes and their original source paths. `reachability` records real compile-error controls for each **surviving written `.rs` file**. `candidate_compiled` is present only when such files were individually controlled, and is true only when all were reached as Rust. Deleted, moved-away and overwritten intermediate outputs are not tested as though they survived. Existing single-file callers retain their `reachability_control` result.

`coverage.status` distinguishes `not_run`, `checker_failure`, `context_checked`, `written_rust_checked`, and `unreached_rust`. An empty vector, noop-only, deletion-only or manifest/config-only proposal still runs Cargo. A successful context-only check reports `context_checked`, not a vacuous `candidate_compiled=true`; it makes no per-file analysis claim for non-Rust writes.

Findings wholly in genuinely new captured sources can be introduced without a baseline check. Other findings require the real original Cargo context. Required baseline failure remains a visible block and retains its actual checker evidence; known introduced findings survive it and other required failures. Raw candidate, baseline and reachability checker results preserve commands, diagnostics and causes rather than converting unavailable/failed checks to a pass.

Captured candidate and baseline source/config bytes are checked for cross-file mutation, even in files without findings, after Cargo and the compiler controls. Ordinary **unstaged** Cargo.lock refreshes remain Cargo-owned; explicitly staged lockfile bytes must match exactly and are not exempt. Generated diagnostic sources are not promoted into captured-source identity. Before return, both original file bytes and the observed Windows directory semantics consumed by copying/replay are revalidated. `original_snapshot_sha256` identifies the captured file-hash map; `directory_semantics` carries relative-path `before`/`after` observations and an `unchanged` result. Boolean values describe directory case sensitivity; null records an initially absent proposed-parent segment, alongside observations of its existing ancestor. `originals_unchanged` requires both file and observed-directory inputs to remain unchanged. Semantic drift returns `checker_failure` with `original_directory_semantics_changed`, even when copied Cargo succeeded. The owner never intentionally writes or autofixes the original tree.

## Reproduce and evidence

From the project root with Python 3.11+, the ordinary stable Rust toolchain, Cargo, Clippy and the native linker:

```text
python tools/probe_rust_staged.py
python tools/probe_rust_candidates.py
python tools/probe_rust_attribution.py
python tools/probe_rust_quality.py
```

The [dated public-safe results](../../docs/rust-staged-context-results.json) record versions, exact input hashes, commands, checker outcomes/causes, coverage and assertions. The latest corrected runs passed 63 staged-context expectations across 32 scenarios, 51 existing candidate expectations, 46 existing attribution expectations, and all four quality-rule expectations. Current raw author evidence is private at `.loopx/materials/rust-staged-context-freshness-proof.json`; preceding proof records remain preserved.

The retained staged probe discriminates jointly necessary edits from single-file compilation failure; pure moves from expanded debt and duplicated occurrences; original-source move chains and last-destination-wins collisions; create-overwrite and noop ordering; deletion and manifest feature activation; excluded Rust files; intrinsic new findings alongside required baseline/reachability failures; stale create/source/destination images; staged manifest/config escapes; exact staged lockfiles; and a real build script mutating an otherwise undiagnosed sibling. Each ordinary case independently hashes its original tree before/after.

Throwaway real-Cargo smoke additionally proved BOM/CRLF byte handling and visible `original_context_changed` after a disposable build script deliberately modified an original sibling. A throwaway isolated mutation removed move-origin mapping: the same pure move changed from zero introduced/one preexisting to one introduced/zero preexisting. Its first fixture used Windows text-mode newline conversion and was correctly rejected as a stale preimage; corrected exact-byte fixtures reached the intended oracle. Temporary smoke/mutation workspaces were removed.

Independent review of snapshot `60859cc3be94adbec154013d1634489fe5e6c0df950e5e6c0018145043be1086` found a real false introduction: one guard with a common await plus a `#[cfg(test)]` await produces distinct lib/test variants at the same physical occurrence. The old consumed set treated the second variant as a copied occurrence. The corrected owner binds each remapped baseline primary to its final raw primary, allowing known variants at that same occurrence without removing duplicate-source protection. Retained real `--all-targets` regressions cover empty, noop, move and move/recreate variants. An asserted-import fresh subprocess also exercised the reviewer's exact four input/proposal sets: all three unchanged/moved cases returned zero introduced/two preexisting; the real duplicate still returned one introduced/one preexisting, with every original tree unchanged. This author recheck is not independent acceptance.

The director also relayed the native owner's compiled-addon proof that two initially absent create spellings `src/fresh.rs` then `src/FRESH.rs` remain two ordered native operations but write one physical file on the tested Windows filesystem. The preceding Python replay incorrectly kept two expected-source entries. Real Cargo/native-schema regressions now prove bad-then-good returns `no_findings`, good-then-bad reports an introduced finding, and aliased move destinations retain the last writer's original-source debt. Those cases preserve original trees. This is Python analysis proof using the confirmed native contract, not an author claim to have exercised the OMP integration.

The existing faithful-copy boundary now queries Windows `FileCaseSensitiveInfo` for original/copied directories, including an existing empty original parent that the copy has not materialized. A mismatch or unavailable query fails visibly; the analyzer does not alter directory flags or emulate another filesystem. Throwaway local `fsutil` fixtures proved that a case-sensitive original directory actually kept `fresh.rs` and `FRESH.rs` as distinct physical files, and that the analyzer rejected its case-insensitive copy before Cargo, for both populated and empty original directories. Default case-insensitive Windows contexts passed the alias Cargo regressions. This support/fidelity proof is Windows-specific, not a new broad portability guarantee.

Independent review of `e05ae54c08d9abb1e58659294b28cd399d474bfac80acccadda0727902539d4b` then identified a false permit: a real build script enabled case sensitivity on an original empty output directory during Cargo, while file-byte snapshots stayed identical. Setup-only source/copy equality did not establish freshness. The revised owner retains the original directory observations and re-queries those same paths before return; WinAPI bindings initialize once and one directory-query helper serves capture and recheck. Initially absent proposed-parent segments are retained too, so creating a new empty case-sensitive parent cannot evade an ancestor-only check.

Retained real-Cargo regressions exercise both an existing empty parent's flag flip and an initially absent parent created case-sensitive by the build script. Copied Cargo remains clean and reached, but the API now reports semantic drift and `originals_unchanged=false`; file-byte snapshots remain identical. An independent physical-file oracle proves the changed original directory keeps differently cased names distinct. Each fixture resets its private directory flag before cleanup. Populated/empty setup-mismatch controls and the prior occurrence/alias regressions remain green. No reviewer original path was executed or modified.

## Review and limits

Current private review navigation is `.loopx/materials/rust-staged-context-freshness-review.json`: it points to a new immutable exact-file snapshot and canonical SHA-256 manifest containing all three corrections. The snapshot ID hashes the persisted manifest bytes. All preceding snapshots/receipts remain preserved as historical author evidence. These are historical author-only proof records and do not constitute current director acceptance, which is captured in shared-index updates and later commits.

This remains trusted local Cargo execution, not a hermetic sandbox: build scripts, proc macros, toolchains and Cargo-home configuration are trusted. File hashing and the relevant directory-semantic rechecks detect lasting observed-input changes, not transient write-and-restore, filesystem transactions, arbitrary filesystem metadata, or mutation after the API returns. Generated/external source continuity remains explicitly ambiguous. Large indistinguishable source reorganizations can still be ambiguous under the bounded Sprint 3 attribution algorithm. Only `clippy::await_holding_lock` is selected; passing is not a global correctness/safety claim.

No native tree, addon, project-private nightly build, global installation/settings, reference repository, shared index, retry/override/storage/commit/PR/model-loop mechanism was changed. No child workers, commit, push or publication were performed. No real OMP integration claim is made here.
