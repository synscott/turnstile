# Sprint 04: native OMP edit gate

Status: **APPROVED_PREREQUISITES_IN_PROGRESS.** Sprints 1–3 are
accepted; Sprint 3 was locally committed as
`c19c6f1515d38e0fdb2ab708eed3f8937155b7ff`. Sprint 4 Python staged-context prerequisite is director-accepted (`7fd744183c9cfb79504b1db6048bde374ed24e985c798e05f547d296fa65bf29`), native-veto prerequisite remains outstanding. Sprint 4 itself is not implemented or fully accepted.

The current user explicitly approved maintaining and building a patched
project-local OMP runtime: “no overbuilding, keep to our design principles.”
This supersedes `BLOCKED_PENDING_USER_DEPLOYMENT_DECISION`; the prior
research-only restriction is historical, not a current prohibition. Project-local
runtime source acquisition, toolchain and dependency builds are now authorized.
Leave global OMP, reference repositories, and global safety settings untouched;
no publication. The director has accepted the unmodified local OMP baseline;
complete staged Cargo-context prerequisite is director-accepted, native-veto prerequisite remains outstanding.

## Native boundary and evidence

The inspected installed agent and native packages are `18.1.16`. The upstream tag
and npm provenance payloads identify source commit
`61b1b8aef634334eaf1412afd003a763e1d1b9c1`; seven relevant installed source/binding
files match that commit's Git blob identities. Provenance signatures and
bit-reproducible native output have not been independently verified. The later
unmodified local build and runtime proof are accepted; see the
[baseline handoff](omp-local-baseline.md).

The actual `EditTool` owns its native `EditSession`, policy, and shared `EditStore`.
Supported extension context can invoke the same native tool but cannot inspect its
complete prepared edit or veto that preparation at the write boundary. The native
API exposes `apply(writer)`; even its final, non-streaming preview contains diff
metadata rather than complete candidate bytes.

Experiments against the installed native bindings established:

- Rejecting the first writer request preserved the fixture files and snapshots.
- Returning a successful writer response without persisting bytes changed the
  native snapshot while disk remained unchanged: `apply` is not a safe dry-run.
- Rejecting the second request left the first file and snapshot changed, although
  the whole-call result reported an error with an empty file list. Per-file
  validation cannot guarantee that a held multi-file edit stays unapplied.

Independent reviewer experiments against the installed libraries also found:

- An unresolved first writer promise prevented delivery of the second candidate;
  rejecting it ended the call without delivering that candidate. Collecting all
  candidates before acknowledging any writer is not supported.
- After a settled preview, an intervening disk change appeared in the candidate
  delivered at apply time. Preview analysis does not bind later execution bytes.
- The actual `ExtensionRunner` gave a later handler the original input even when
  a preceding handler returned revised input. Moving early analysis to the end
  of the handler order is therefore insufficient.

These are installed-library/runtime experiments, not a real CLI/model gate proof.

Source inspection located the existing whole-call preparation owner:
`crates/pi-edit/src/session.rs::Session::apply` stages a `Vec<StagedFile>` before
writing; `crates/pi-natives/src/edit.rs` exposes it through N-API. A deny seam could
reuse that owner and parser, but staging's no-op/provenance state effects,
cancellation, original-input revalidation, and writer content transformations
need explicit contracts. Reinterpreting hashline, duplicating `EditStore`, using
permission fallbacks as policy, or treating preview diffs as final candidates are
not acceptable substitutes.

Detailed commands, observations, source identities, and environment qualifications
remain in the existing local-only receipts, reachable through the private material
index. This public handoff intentionally omits private receipt paths and machine
metadata.

## Approved prerequisites — in progress

The user's approval authorizes fresh bounded implementation scopes for:

1. **Accepted:** unmodified, pinned project-local OMP baseline build, actual source
   CLI launch with normal FCC/plugin context, and ordinary native `EditSession`
   behavior. See the [baseline handoff](omp-local-baseline.md).
2. Implementing a same-owner complete native-edit veto boundary before canonical
   mutation, preserving native reconstruction and execution semantics.
3. **Accepted:** Extending the existing Rust candidate owner to analyze one complete staged Cargo
   context, including jointly dependent updates, moves, deletes, creates, and
   relevant context changes. Preserve current APIs and meaningful probes;
   per-file analysis against unstaged siblings is not equivalent.
4. Returning to original Sprint 4 integration and real-model acceptance proof.

Keep the change bounded: no new parser, duplicate `EditStore`, generic policy
framework, speculative configurability, or unrelated fixes.

The director accepted the baseline after reviewing its build, native edit, actual
source CLI and cache-isolation evidence. Project-private `nightly-2026-08-08`,
N-API CLI `3.7.2`, and the frozen dependency closure were obtained, and the existing
Windows Cargo/N-API host route succeeded. The actual local addon identity and
pristine Rust/TypeScript manifest are recorded in the baseline receipt. Historical
source/build research remains unchanged; its missing-tool observations no longer
describe the accepted baseline. No native veto or Turnstile gate is proved by it.

## Unchanged acceptance and continuation

The [approved build plan](../../docs/build-plan.md) now records these prerequisites;
all original eleven deliverables and acceptance criteria remain unchanged. Original
Sprint 4 acceptance still requires an explicitly enabled isolated workspace, a
real bad native edit withheld before canonical mutation, the actual finding
reaching the model, and a repaired replacement executing. Required-check failures
must hold visibly. No native operation or multi-file semantics have been removed
from scope.

Write-tool integration and the remaining retry, disclosure, exception, commit,
PR, and final installed-test work remain in their existing later sprints. This
handoff records a director-accepted Python prerequisite and accepted baseline; the
native-veto prerequisite remains outstanding, and the native-model integration
proof is not yet accepted. The current user approval, accepted baseline, and three
historical prerequisite receipts are reachable through the private material index;
historical approval-pending restrictions are superseded while observations and
hashes remain preserved. Notify the user when the remaining prerequisites are verified and
original Sprint 4 can resume under `/vibe`.
