# Sprint 05: native OMP write gate

Status: **ACCEPTED — exact Sprint 5 revision, by director Main.**
Accepted snapshot: `0fce5955af950c2d7e0a4d9e667727ba1aaff5700bbd6f866b201320f62d000b`.
Author: `sprint-five-write`; independent reviewer: `sprint-five-review`.
Main owns acceptance, sequencing and commit authorization; serialized acceptance
bookkeeping and a public-only commit were explicitly authorized after review.
This work implements only approved Sprint 5 from the [build plan](../../docs/build-plan.md).
It does not authorize Sprint 6 or mark the overall product complete.

## Contract and ownership

The same Turnstile checker now covers native WriteTool local file creation and
whole-file replacement. The existing Python staged Cargo-context/attribution owner
is unchanged. Only `no_findings` permits. Bad writes and required-check failures
stay unapplied, and actual findings/failure causes return through native tool feedback.
The [operator contract](../../docs/omp-edit-gate.md) is the canonical coverage guide.

`write_prepared` is owned by the actual WriteTool after its normal path and
hashline display-prefix cleaning, not by a `tool_call` approximation or replacement
writer. The event distinguishes final effective execute arguments from the complete
final UTF-8 candidate. It supplies one native create/update operation with the same
seven keys consumed for edit. No target parent creation, file write, snapshot or
chmod precedes permission. Native write revalidates argument, path, preimage and
ancestor identities, including missing target parents, before release.

The SDK shares the existing prepared emitter and managed `ctx.exec` owner between
edit and write. Direct and same-tool delegated writes wait for checker process-tree
and temporary-root cleanup before completion on timeout, abort and shutdown. Saved
executors reject late launches; concurrent handler scopes remain independent.
There is no second timeout owner, parser, EditStore, global exec interception or
policy framework. Rust, the accepted addon and Python source are unchanged.

With an enabled listener, unsupported archive/member, database-row, remote/handler,
conflict-splice and device-dispatch routes are held visibly before dispatch, rather
than silently bypassing analysis. Native cleaning precedes analysis; later ACP or
formatting transformations are refused. Absent/disabled Turnstile adds no listener
and leaves ordinary native routes available. `local://` resolves through the existing
local owner and must still fall within the analyzer's explicit Cargo context.

## Reproduction and evidence

The source runtime remains pinned upstream `61b1b8aef634334eaf1412afd003a763e1d1b9c1`
(18.1.16), on accepted project base `dcaac34b78da9d571a07997384bc976bffc5c2b7`.
The accepted Sprint 4 snapshot and full independent receipt remain unchanged;
see [Sprint 4](sprint-04.md). The addon SHA256 is still
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
No native rebuild, global configuration/install change, remote publication,
shared-index mutation or commit was performed by this author delivery.

Private reproducible commands, from this project root:

```text
python .loopx/sprint05/patch-proof.py
python .loopx/sprint05/run-proof.py
```

The patch proof restores **one cumulative patch against pristine upstream**, never
on top of a patched runtime, and verifies every cumulative source postimage and
unchanged addon. See the [runtime guide](../../patches/omp-edit-veto.md).
The proof runner records exact argv, exit code, stdout/stderr and source hashes in
`.loopx/sprint05/verification.json`; the individual `run-*.json` records are raw
command evidence. Its explicit surface is:

- Real `createAgentSession` → native WriteTool → real Cargo/Clippy: bad/good local
  creates and replacements, direct and same-tool delegated calls, final effective
  arguments, BOM/Unicode/CRLF bytes, opt-in/failure controls and special-route refusal.
- Native release controls: stale target bytes, same-byte identity replacement and
  missing-ancestor change, plus a real checker held open while surrounding context
  changes. The intentionally exercised post-check context race is documented as
  outside the observation guarantee, not reported as a fixed race.
- Live Cargo parent/child observed before direct/delegated timeout, abort and
  shutdown; both gone and managed temporary roots removed before tool completion.
  Concurrent cancellation and noncooperative-handler/late-executor controls.
- Direct native WriteTool controls for native cleaning, invalid text/preimages,
  argument drift, abort-at-release, formatting closure/configuration, ACP refusal,
  older formatting batches and unguarded native archive creation. These controls
  use injected deny hooks, not a claimed Cargo check; the real consumer cases above
  separately own that proof.
- Accepted S4 real-native consumer smoke copied to an owned private script and
  output directory, preserving historical scripts/receipts. SDK and extension
  typechecks plus only the named focused regression files in the receipt.

Missing write capability/managed context cases are injected controls, not a genuine
old-SDK deployment claim. This sprint makes no new real-model call: the actual native
consumer suffices for approved write acceptance. Accepted S4 model evidence remains
attributed to S4. The author results above remain distinct from the independent
reproduction and director acceptance below.

### Final author outcomes

- **42 write scenarios passed:** 25 production-session cases, 10 direct-owner
  controls and 7 additional lifecycle/failure controls.
- **24 S4 native consumer scenarios passed** against the final Sprint 5 source.
- SDK coding-agent and separately scoped Turnstile extension **typechecks passed**.
- The six-file focused SDK run is **128 pass / 2 fail, 437 expectations**, not green.
  Both failures are in unchanged `write-read-selector-misfire.test.ts` on Windows:
  - `lets non-empty content deliberately create a selector-shaped filename`:
    `ENOENT` at the actual native write of
    `src/components/LoraSelector.tsx:1-260:raw`; post-execute assertions were not reached.
  - `keeps an existing literal file whose name looks like a selector list writable`:
    `ENOENT` creating `report:1-2;archive:3-4` in fixture setup, before tool invocation
    or production assertions.
  An isolated pristine pinned WriteTool (only import relocation) reproduced the
  first error; the second reproduced in the same setup primitive. No tests were
  skipped, changed or re-pinned. Exact evidence: `.loopx/sprint05/stock-colon-proof.json`.
- The first final-proof attempt also exposed an owned stale-context fixture marker
  left from an earlier run and a wrong `tsgo.js` command path. The fixture now
  removes that marker before running, and the command uses installed `bin/tsgo`.
  Only those two failed commands were rerun; both passed. Production source was
  unchanged. Original raw command failures remain in `first-attempt-*.json`, and
  `.loopx/sprint05/proof-corrections.json` binds the correction and qualification.
- Pristine patch restoration reproduced **all 23 cumulative postimages**. The patch
  SHA256 is `5fcd1552eca0b8f7dd98f9e8b4da2d7835a40c3874f438bc078abe0ef4672496`.


## Frozen review package

`.loopx/materials/sprint05-review.json` identifies the canonical exact-file manifest,
digest-addressed immutable archive and source-bound verification receipt. The archive
contains this handoff, governing build/operator/patch contracts, all cumulative source
postimages, unchanged Python owner/fixtures, proof scripts and raw observations.
The snapshot ID is the SHA256 of recursively key-sorted compact ASCII JSON plus LF;
each member has an exact size and SHA256. Freeze reopens the archive and verifies
all members. Review must use a separate restored copy, verify this manifest, and
identify the exact snapshot in its own receipt. Changing source or governing
instructions requires a new snapshot and review; an author freeze is not acceptance.

## Independent review and Main acceptance

The independent reviewer recommended `ACCEPT_BOUNDED_SPRINT5_WRITE_GATE_REVISION`
with no current findings for this exact snapshot. Main inspected the full receipt
and accepted only bounded Sprint 5. Receipt:
`.loopx/s5-review/review-0fce5955.json`, SHA256
`1f8c30bf8d50d689c4f7d93e9ccc9ec26f1379e8a46c4fe16d3d4089b942e707`.
Director acceptance and public commit/path receipts are
`.loopx/materials/sprint05-acceptance.json` and `.loopx/materials/sprint05-commit.json`.

The reviewer verified all 95 frozen payloads, separately restored pristine
upstream, applied the cumulative patch once and verified all 23 postimages plus
the actually loaded unchanged addon. Workspace imports resolved its own restored
SDK, not mutable author sources. Independent execution reproduced all **42 author
write cases**, then added **four independently authored adversaries** covering
native cleaning, frozen-event mutation, parent replacement and externally created
missing targets. Two further genuine old-SDK/new-gate write refusals held existing
and absent targets without launching a checker.

Author S4 regression/type results and the **128 pass / 2 fail** focused SDK result
were inspected as source-bound evidence, not claimed reviewer reruns. The exact
Windows/pristine attribution and both author/reviewer proof corrections remain
preserved. Review shares the host/toolchain and makes no new model-run or
independent-machine claim. Live acceptance bookkeeping does not rewrite the
immutable archive, prior accepted/rejected evidence, production source or patch.


## Limits and continuation

Only `clippy::await_holding_lock` is selected. Passing is not global correctness or
safety. Cargo build scripts/proc macros and native permission fallback writers are
trusted infrastructure, not sandboxed arbitrary extension code. Filesystem freshness
is observational: transient write-and-restore and mutation after the last check are
outside the guarantee. Ordinary I/O failure after release has no rollback promise;
forced OS termination cannot guarantee cleanup. Configuration is a startup snapshot.

Main explicitly authorized exclusive serialized updates to this handoff and both
shared indices, acceptance/commit receipts, and the intended public-only Sprint 5
commit. No Sprint 6 retry/disclosure/exception/storage behavior is included.
Next is a **fresh bounded Sprint 6 worker** under Main's sequencing authority;
this worker does not start it. Sprint 5 acceptance is not overall build completion.
