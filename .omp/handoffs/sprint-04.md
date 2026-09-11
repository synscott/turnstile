# Sprint 04: native OMP edit gate

Status: **ACCEPTED — exact corrected Sprint 4 revision, by director Main.**
Accepted snapshot:
`7c82e5f348a1a91172ed08bc6088b62849925ad2e87ecbf3b74b79ff5248a05f`.
Independent reviewer `sprint-four-gate-review` recommended
`ACCEPT_BOUNDED_SPRINT4_MANAGED_EXEC_REVISION` with no current findings.
Exact successor review: `.loopx/s4gate-review/review-7c82e5f.json`;
director acceptance: `.loopx/materials/sprint04-acceptance.json`.
The original `2657b99f589a1f490b3db5a3076818e64fd24f5064e43118bc672ebf027d27d6`
snapshot, complete `REQUEST_CHANGES` receipt, archive, and delegated cancellation
dissent remain preserved. They are not retroactively approved.
The original implementation worker crossed a compaction recovery boundary and
was retired. `managed-exec-recovery` completed bounded verification/packaging,
then director-authorized serialized acceptance bookkeeping and public-only commit.
This sprint did not fit one unbroken implementation session. The approved
acceptance criteria are unchanged; the director owns sequencing. Next: Sprint 5.
All three prerequisites remain director-accepted. Python's accepted prerequisite
commit is `4d82a733b5e884b112979830a6809eee21562240` (reviewed snapshot
`7fd744183c9cfb79504b1db6048bde374ed24e985c798e05f547d296fa65bf29`).
Sprints 1–3 and their historical acceptance evidence remain unchanged.

The current user explicitly approved maintaining and building a patched
project-local OMP runtime: “no overbuilding, keep to our design principles.”
This supersedes `BLOCKED_PENDING_USER_DEPLOYMENT_DECISION`; the prior
research-only restriction is historical, not a current prohibition. Project-local
runtime source acquisition, toolchain and dependency builds are now authorized.
Leave global OMP, reference repositories, and global safety settings untouched;
no publication. The director has accepted all three prerequisites.

## Historical stock boundary and evidence

The inspected installed agent and native packages are `18.1.16`. The upstream tag
and npm provenance payloads identify source commit
`61b1b8aef634334eaf1412afd003a763e1d1b9c1`; seven relevant installed source/binding
files match that commit's Git blob identities. Provenance signatures and
bit-reproducible native output have not been independently verified. The later
unmodified local build and runtime proof are accepted; see the
[baseline handoff](omp-local-baseline.md).

In the originally inspected stock runtime, `EditTool` owns its native `EditSession`,
policy, and shared `EditStore`. Stock supported extension context can invoke the same native tool but cannot inspect its
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

## Accepted prerequisites and next scope

The authorized bounded prerequisite work is now accepted:

1. **Accepted:** unmodified, pinned project-local OMP baseline build, actual source
   CLI launch with normal FCC/plugin context, and ordinary native `EditSession`
   behavior. See the [baseline handoff](omp-local-baseline.md).
2. **Accepted:** the same-owner complete native-edit veto before canonical mutation,
   preserving native reconstruction and execution semantics. See the
   [native handoff](omp-edit-veto.md) for separate author/reviewer identities,
   exact snapshot/addon, independent controls, evidence correction, and limits.
3. **Accepted:** Extending the existing Rust candidate owner to analyze one complete staged Cargo
   context, including jointly dependent updates, moves, deletes, creates, and
   relevant context changes. Preserve current APIs and meaningful probes;
   per-file analysis against unstaged siblings is not equivalent.
4. **Accepted:** exact corrected original Sprint 4 integration and real-model proof, including independently reproduced managed-execution lifecycle controls; see the delivery and review below.

Keep the change bounded: no new parser, duplicate `EditStore`, generic policy
framework, speculative configurability, or unrelated fixes.

The director accepted the baseline after reviewing its build, native edit, actual
source CLI and cache-isolation evidence. Project-private `nightly-2026-08-08`,
N-API CLI `3.7.2`, and the frozen dependency closure were obtained, and the existing
Windows Cargo/N-API host route succeeded. The actual local addon identity and
pristine Rust/TypeScript manifest are recorded in the baseline receipt. Historical
source/build research remains unchanged; its missing-tool observations no longer
describe the accepted baseline. No native veto or Turnstile gate is proved by it.

The native prerequisite exposes complete persisted operations through `edit_prepared`
and detects actual loaded-addon support through `supportsEditPrepared()`. Required
integrations must hold on a missing/false capability rather than trust stock unknown-event
registration. The accepted direct-writer contract requires formatting and auto-repair
disabled, no relevant transforming ACP route, and no older formatting batch; prior
permitted diagnostics still drain when the final edit is denied. These are the accepted
integration conditions, not permission to narrow the original multi-file/model proof.

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
handoff preserves prerequisite acceptance separately from the new author delivery.
The director continues to own acceptance and both shared navigation indices.
The earlier readiness notification was delivered before original Sprint 4 resumed.

## Corrected Sprint 4 author delivery

Implementation author: `sprint-four-gate`; bounded recovery verification/packaging
and later director-authorized acceptance bookkeeping: `managed-exec-recovery`.
No child workers, Rust/addon changes, global configuration/install changes, or
publication. Product and SDK source remained frozen throughout recovery and
acceptance; all 42 recorded file identities matched at recovery entry.
The recovery witness is `.loopx/materials/sprint04-compaction-handoff.json`;
the new recovery receipt is `.loopx/materials/sprint04-recovery-verification.json`.

### Owning lifecycle correction

The old independent review found that a delegated native call's synthetic
`invoke-edit-*` ID did not match outer `tool_result` cleanup ownership. Canonical
files stayed held, but live Cargo parent/child processes and temporary context
survived delegated timeout/abort completion. Independent red/green reproduction
resolved this objection only for the accepted corrected revision.

The correction binds optional `ctx.exec` to each `edit_prepared` handler's
managed scope. The existing executor owns process-tree settlement, stdin, and
isolated temporary roots with child-only `TEMP`/`TMP`/`TMPDIR`. The runner owns
the existing single handler timeout, closes/cancels/drains registered work on
completion/abort/timeout/shutdown, isolates concurrent scopes, and rejects saved
executors after closure. It does not await arbitrary noncooperative handler
promises. Native TypeScript also awaits a started prepared check when native
abort settles first. Ordinary `api.exec` remains caller-owned.

This changes exactly four SDK TypeScript owners plus upstream extension docs.
The public [native patch](../../patches/omp-edit-veto.md) is one cumulative
patch against pristine pin `61b1b8aef634334eaf1412afd003a763e1d1b9c1`,
not an ordered patch chain. Its SHA256 is
`db3a5f54db14aea1ddb60915ad602622f5582c1f86523a1db04ed5362f67df8f`.
Author restoration reproduced all 22 postimages, with 17 accepted source paths
unchanged. Rust and addon identity remain unchanged; the actual loaded addon is
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.

`extensions/turnstile.ts` now requires managed `ctx.exec` before launch and sends
the complete unchanged vector/context through stdin. The Python `--staged`
bridge reads binary stdin and explicitly decodes UTF-8. Request-file transport,
pending ID maps, and `tool_result` cleanup are removed. The existing staged owner
still prepares/redacts output and removes copied context before its final
original-byte/directory-semantics observation. Only `no_findings` permits.
See the [operator contract](../../docs/omp-edit-gate.md).

### Exact final author evidence

The private `.loopx/materials/sprint04-verification.json` binds final source
hashes and raw receipts. Recovery inspected completed receipts rather than
rerunning all previous behavioral checks:

- Native/production smoke: **24 scenarios**, including all five modes,
  complete ordered vectors and effective arguments; explicit config/capability
  controls; UTF-8/BOM/CRLF; direct and delegated timeout/abort/shutdown with live
  Cargo parent/child observed before cancellation and gone before completion;
  delegated inner-return temp removal; independent concurrent cancellation; and
  noncooperative handler closure with late launch rejection. The author's
  missing-context case is injected, **not** a genuine old-SDK execution claim.
  The independent reviewer subsequently proved genuine old-SDK refusal and
  the revised lifecycle controls against a separately restored runtime.
- SDK regressions: coding-agent type check succeeds; **93 tests pass, 0 fail,
  250 expectations** across the three named focused test files in the receipt.
  No project-wide suite-green claim. Existing Python quality, candidate,
  attribution, and staged probes all pass; historical public reports were
  restored byte-for-byte.
- Real configured `openai-codex/gpt-5.5` CLI: **two native edit calls**. The first
  bad candidate was held with the actual `clippy::await_holding_lock` finding;
  the model then authored a distinct match-expression repair that executed.
  Authored arguments equal native effective input, with managed context
  observed and all seven operation keys retained. The final run has **no
  intermediate no-op**; earlier no-op transcripts remain historical evidence.
- Canonical original SHA256:
  `3cbf1109d6289afba941d4feeced27d180c23eba2cf064140afb13eb4adf3bfa`;
  final model-authored repair:
  `f45a1260f193a099c157535dd8857f3ee76d94e9928cecbb99a751ba5d9e2fc1`.
  Recovery ran `python .loopx/sprint04/canonical-proof.py` against that current
  repair: direct actual Cargo/Clippy exit 0, `build-finished=true`, zero selected
  findings, unchanged canonical bytes, and owned build target removed. The
  replaced old canonical receipt was stale and is not cited for current code.
- Separate real-model unavailable-Cargo run: **one native edit call**, held with
  `checker_failure` and empty findings; canonical bytes remain original. The
  model explicitly reports checker unavailability and does not claim lint
  success, repair, or bypass. Raw positive/negative streams, native boundaries,
  addon observations, and final reports are retained unchanged.

### Review and limits

The new digest-addressed archive includes exact product/SDK postimages, cumulative
patch, governing instructions, proof scripts, raw observations, recovery witness,
and original dissent. Its canonical manifest is reopened and every member's
size/hash verified. The old rejected archive remains preserved. The successor
review identifies the exact new snapshot, not the mutable author tree.
The reviewer restored a separate pristine runtime, applied the cumulative patch
once, and verified all 22 postimages and the unchanged accepted addon. The
reviewer reran all 24 production scenarios, its own delegated red/green probe,
genuine old-SDK/new-gate refusal, direct canonical Clippy, and independent final
model/source evidence assertions. Author SDK/Python suite results remained
attributed source-bound evidence, not claimed reviewer reruns. The review shares
the Windows host/toolchain and makes no independent-machine or new model-run
claim. Main read the full successor review and accepted that exact revision.

Private immutable review navigation: `.loopx/materials/sprint04-review.json`.
Post-review recovery receipt: `.loopx/materials/sprint04-recovery-delivery.json`.
Public commit/path receipt: `.loopx/materials/sprint04-commit.json`.
Acceptance bookkeeping updates this live handoff and indices only; frozen source,
archive, historical receipts, and original dissent are not rewritten.

Only `clippy::await_holding_lock` is selected; passing is not global correctness
or safety. Native parsing/replay/store semantics, ACP/formatter conflict checks,
and regular LSP diagnostic draining retain the accepted prerequisite scope.
There is no second real rust-analyzer proof. Original-context checks are
observations, not filesystem transactions: transient write-and-restore and
post-observation changes remain outside the promise. Trusted Cargo build scripts
are not sandboxed. I/O errors after permission may partially apply a vector;
forced OS-level host termination has no cleanup guarantee. Configuration remains
a startup snapshot.

Next is **Sprint 5: gate OMP writes**, with bad file creations/replacements held
and acceptable writes executed through the same owning mechanism. No Sprint 5
implementation is included here. Bounded retries, `no_rly`, durable disclosures,
ordinary commit/PR policy, and installed-test coverage remain their later sprints.
Sprint 4 acceptance is not overall build completion.
