# Sprint 06: bounded native revision loop

Status: **ACCEPTED — exact Sprint 6 revision, by director Main.**
Accepted snapshot: `a3e13fed39d89ff66a3d355384083745bcdf251db31fc20755d21930057cb34e`.
Author: `sprint-six-retries`. Main owns sequencing, acceptance, shared indices and
commit authorization. No child agents were used. This implements only Sprint 6
of the [build plan](../../docs/build-plan.md), on accepted base
`7b8154e744b9edcd92dc8605aee711ef5e0afa82`; it does not start Sprint 7.

## Contract and ownership

The [operator contract](../../docs/omp-edit-gate.md) is canonical. Optional
`maxRejections` is a positive safe integer, default 3. One loaded extension owns
cumulative debt shared across native edit/write, arguments, paths and same-tool
delegation. Each prepared check synchronously reserves a slot; failures charge
it, and successful checks release only their own reservation. Concurrent capacity
holds do not falsely exhaust or abort clean checks. Successes, no-ops and session
events do not reset prior debt; reload/restart explicitly constructs fresh state.

The rejection reaching the bound latches exhaustion. Held actions never execute,
subsequent mutations launch no checker, and the real OMP abort operation stops the
offending turn. Later read-only work remains usable. Fatal startup config/capability
failures stop an attempted mutation immediately with a distinct zero-check reason.
Absent/disabled configuration still installs no gate. There is no retry scheduler,
persistent counter, replay/autofix, new timeout owner, exception ticket or `no_rly`.

Minimal success validation preserves the existing analyzer contract: final
`no_findings`, empty final findings, and candidate-check exit 0/build-finished
`[true]`. It does not demand candidate outcome `no_findings`, Rust reachability
fields for non-Rust operations, or duplicate attribution logic. Python/Rust and
the native addon remain unchanged.

A reproduced SDK owner bug required Main's narrow authorization: cancellation
while managed temporary-root cleanup was pending could return a success-shaped
result after the native action was aborted, incorrectly refunding rejection debt.
`ManagedExecScope.exec` now checks its merged cancellation signal after
`execCommand` (including cleanup) settles, setting the owned result's `killed`
flag without copying it. Pending/drain ownership and ordinary `api.exec` are
unchanged. A focused existing-file regression suspends actual cleanup in an
isolated child and covers parent abort, command signal abort and scope close.

## Concrete proof

Reproduce from the project root using the accepted local dependencies:

```text
python .loopx/sprint06/patch-proof.py
python .loopx/sprint06/complete-proof.py
```

`.loopx/sprint06/verification.json` binds all final commands, results and production
hashes. Individual `run-*.json` files retain stdout/stderr and argv.

- **22 native consumer scenarios passed.** Real source `createAgentSession`, normal
  runtime initialization and native tools exercise distinct bad A/B/C candidates,
  exact checker invocation counts/canonical bytes, limit 1/default 3, cross-tool,
  path/no-op/delegation and `/new` non-reset, acceptable pre-limit repair, fresh
  loaded-instance reset, invalid/absent/disabled config and missing executables.
- Real Cargo preserves legitimate no-Rust and preexisting-finding success cases.
  Empty/malformed/missing-check/contradictory output controls are explicitly
  injected checker faults through the actual native consumer, not claimed Cargo
  responses. The missing-check control released bytes before the witness guard
  and holds afterward; `red-missing-check.json` preserves the expected red.
- Two concurrent real Cargo checks can occupy all slots; an additional request
  holds for capacity with no checker/abort, both clean operations then execute,
  and a subsequent clean operation remains usable.
- **Four actual cleanup-window controls passed:** direct/delegated abort and
  timeout, suspending only the real `oe-*` removal after successful checker exit.
  Native targets remain unchanged, cancelled results are charged, and the next
  attempt stays exhausted with one checker invocation. The pre-fix native abort
  followed by an incorrectly permitted 350-byte write is preserved in
  `red-cleanup-cancellation.json`.
- Existing `edit-prepared.test.ts`: **5 pass, 0 fail, 30 expectations**. Extension
  and coding-agent SDK typechecks passed. The known pristine Windows colon-path
  failures were not rerun, hidden or suppressed; no broad suite was run.
- **Actual source CLI/model:** three distinct proposed bad writes caused exactly
  three checker invocations, canonical bytes stayed unchanged, requested trial D
  never ran, one terminal `agent_end` occurred and the CLI exited 0. Exhaustion
  reached stderr while stdout stayed parseable JSON. A fresh filesystem read of
  the actual session transcript found the displayable exhaustion message. No
  automatic extra model turn was queued. The final driver explicitly uses a
  project-private `--session-dir`.

Interactive/RPC notification wiring uses the existing API but was not separately
visually exercised. Direct native reads after exhaustion passed; there was no
additional real-model read-only follow-up turn. `/new` was exercised; actual
branch/compaction workflows were not rerun. Their non-reset follows the unchanged
loaded-instance state owner, not a persistent-session recovery claim.

## Runtime identity, corrections and cleanup

Pristine upstream remains `61b1b8aef634334eaf1412afd003a763e1d1b9c1` (18.1.16).
The new cumulative patch SHA256 is
`03dcbb379b32d8e07f994e7bda6966426ee37b6d5f8c5e9e198f0c2b2248c9cd`.
Pristine restoration reproduced all **23** cumulative postimages. The addon is
unchanged: `676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
See the [runtime guide](../../patches/omp-edit-veto.md); never apply the cumulative
patch over an already patched tree. Earlier Sprint 5 frozen artifacts remain
unchanged and accepted only for their original revision.

Owned proof setup corrections included Windows current-directory deletion,
native replace argument names, inherited/read-only managed contexts, normal SDK
runtime initialization, preload syntax and exact patch line-ending preservation.
They were fixture/instrument corrections, not suppressed production failures.
The actual cleanup-window red was independently distinguished from an artificial
handler delay after a fully settled executor; that arbitrary post-settlement delay
is not claimed fixed. Cancellation through actual managed cleanup is covered.

Initial model probes used normal default session storage unintentionally. Exact
probe-created session files were identified by recorded path or matching dedicated
workspace/header and unique experiment prompt, preserved byte-for-byte privately,
then individually removed; only an empty containing directory was removed. Normal
authentication, settings and unrelated sessions were untouched. Only the affected
model proof was rerun with explicit project-private storage. Private provenance
is in `session-cleanup-provenance.json` and `pre-private-*` records. Public docs do
not expose those paths. Owned throwaway workspaces are removed after proof; raw
receipts and executable private evidence remain available.

## Review boundary and limits

`.loopx/materials/sprint06-review.json` points to the canonical exact-file manifest
and digest-addressed archive, containing governing instructions, public changes,
all cumulative runtime postimages and private executable evidence. It references
the accepted pristine archive/dependency closure and unchanged addon instead of
duplicating a runtime installation. Review must restore a separate copy, verify
all manifest members and identify that exact snapshot. Author proof/freezing does
not grant acceptance or commit permission; shared indices remain Main-owned.

### Independent review and Main acceptance

Main inspected the full independent receipt and accepted only this bounded
Sprint 6 revision and the narrow managed-cleanup cancellation fix. Reviewer:
`sprint-six-review`; receipt `.loopx/s6-review/review-a3e13fed.json`, SHA256
`72664558ed57dfcd64d014b510e7f04b9f15c7998453a3dd9b89e5b956e89c9a`.
The reviewer verified all 85 frozen payloads and 23 cumulative postimages in a
separate pristine restoration with its own source imports and the unchanged
loaded addon. Independent execution reproduced 22 consumer and four cleanup
cases, five retained tests, nine additional adversaries and seven prior lifecycle
controls. The old owner independently failed the cancellation/native-budget
oracle and retained regression; the frozen new owner passed.

The reviewer independently parsed the author's source-bound model evidence and
retrieved the persisted notice with the actual SessionManager reader; this was
not another model request. The first two tool results contained Clippy feedback;
the third was `Interrupted by user` from the real abort. Exhaustion and the last
rejection remained separately visible in **two stderr notices and one persisted
custom notice**. No TUI visual or reviewer-model execution is claimed. Prior
source-qualified failures, red receipts and session-storage correction provenance
remain preserved.

Main exclusively authorized serialized acceptance bookkeeping and the intended
public-only commit. Receipts are `.loopx/materials/sprint06-acceptance.json` and
`.loopx/materials/sprint06-commit.json`. This bookkeeping does not rewrite frozen
source/evidence. Next is a **fresh bounded Sprint 7 worker** under Main's authority;
this worker does not start it, and Sprint 6 acceptance is not product completion.

The budget is per loaded extension, not global or durable. Other tools and
arbitrary extensions are not policed. No check is retrospectively cancelled after
its managed result fully settles. Native path/bytes/freshness/cleanup ownership
remains as accepted; post-observation filesystem races, trusted Cargo build code,
ordinary post-permission I/O failures and forced host termination retain the
previously documented limits. Passing only means the configured check passed.
