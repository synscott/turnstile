# Sprint 08: exact held-attempt no_rly

Status: **ACCEPTED — exact Sprint 8 revision, by director Main.**
Accepted snapshot: `41e9efc3ad91dece126b82c99725add843023eba29164965be833fadd3941c96`.
Author: `sprint-eight-no-rly`. Main owns sequencing, shared indices, acceptance
and commit authorization. No children were used. Scope is only Sprint 8 of the
[build plan](../../docs/build-plan.md), on accepted base
`797f08b69243bceb513dc74493e5d535fcf20cba`. No Git/PR/retirement policy or Sprint 9
is implemented.

## Owning contract

The [operator contract](../../docs/omp-edit-gate.md#explicit-last-resort-no_rly)
is canonical. Only `extensions/turnstile.ts` changes production behavior. The
existing concrete SQLite owner and its schema remain unchanged. A real native
prepared hold supplies the exact effective input/mode/ordered vector digest,
original Cargo-context snapshot and sole selected introduced finding. The model
cannot manufacture that provenance with a boolean or an existing database row.

Explicit `no_rly({hold, finding, reason})` arms one immediately next native call.
The nonempty public-safe rationale is an author judgment, not machine proof
that every alternative was attempted. There is no new co-signer or human-only
stage. Arming requires the prior held call to have finished and no competing
observed call/check. The first prepared callback consumes the arm, requires sole
outer ownership and exact freshly checked candidate/context/finding agreement,
and records synchronously before returning native permission. Another observed
call or preparation invalidates the in-flight exception. Same-tool delegated
`invoke-*` prepared IDs are deliberately not equated to outer tool IDs.

Other findings, ambiguous attribution, compilation/required-check/storage
failures and native authority guards stay held. Native editing/writing remains
the only byte writer. Successful exception release does not refund prior S6
rejections; exhaustion never authorizes an exception. A limit of one leaves no
no_rly window. Session lifecycle invalidates live exception state without
resetting rejection debt. Durable records describe attempted authorization, not
confirmed application, and may survive a later native refusal or I/O failure.

## Concrete proof and reproduction

Private executable proof, raw outputs, corrected fixture failures and the
source-bound verification receipt are under `.loopx/sprint08/`. Reproduce from
the root of a separate review copy using the accepted runtime/dependencies:

```text
python .loopx/sprint08/complete.py
```

The complete driver uses fresh private workspaces and explicit project-private
session directories, XDG and temporary roots. Actual sessions retain normal
OMP authentication and context/skill discovery; the API probes configure only
their isolated native tool settings. The actual source CLI/model uses normal
configuration and no alternate provider transport.

Exercised behavior includes:

- Real source/native/Cargo positive write and edit release, both direct and
  supported same-tool delegation; write creation and an apply_patch vector with
  move, create and delete effects. Independent SQLite and filesystem observations
  see the committed disclosure while canonical bytes are still the preimage.
- Changed arguments (including different path spelling yielding identical bytes),
  changed originals/context, intervening/cross-tool calls, wrong finding, replay,
  new session, competing calls and simultaneous delegated preparations. Abort
  cleanup leaves ordinary repair usable. Exception success preserves old debt;
  subsequent rejection exhausts the same loaded gate.
- Actual multiple findings, compile failure, missing Cargo and preexisting-finding
  and non-Rust success paths. Explicit injected checker-fault controls cover
  missing success witness, malformed output, unresolved attribution, unknown
  rule and failed build witness; these are not described as Cargo outputs.
- Lost, corrupt, attached-trigger and genuinely write-locked SQLite prevent
  release with a visible cause. Native device/format controls remain active.
  A post-record native preimage change prevents application while retaining the
  attempted-authorization record.
- An actual configured `gpt-5.5` source CLI session performs held write -> no_rly
  -> identical native write. Raw JSON stream, session, native checker output,
  direct SQLite rows and canonical boundary observations are preserved. A fresh
  actual session retrieves that real record as non-system disclosure data and
  refuses the old token; the ordinary SessionManager reader opens its transcript.
- A private mutation control removes only exact-attempt digest comparison. The
  changed-argument rejection oracle goes red: changed bytes apply and a record
  appears. Production source is never mutated for that control.

No broad suite or known pristine Windows colon-path rerun is included. Permanent
new tests were not added merely to duplicate the private consumer proof. The
existing native guard tests and exact touched-source type/style checks are
recorded separately.

## Corrections and evidence identity

Preserved fixture failures are not suppressed product results: native replace
requires `old_string`/`new_string`; runtime formatting must use the effective
settings override rather than a lower-precedence set; SessionManager.open is
asynchronous; provider message text must be inspected without double-JSON
escaping. The initial injected schema builder attempt was corrected to the
existing injected TypeBox interface. The formatting fixture's earlier successful
write did not establish that formatting was enabled; the corrected probe asserts
the effective setting before checking the native refusal.

The immutable manifest/archive pointer is
`.loopx/materials/sprint08-review.json`. It includes source, governing contracts,
executable proofs, raw observations and accepted runtime identity. The independent
reviewer verified the manifest and worked in its own copy. Main alone records
acceptance and authorizes public commits; frozen source/evidence remain unchanged.

The runtime remains pinned upstream
`61b1b8aef634334eaf1412afd003a763e1d1b9c1` / `18.1.16`, cumulative patch SHA256
`03dcbb379b32d8e07f994e7bda6966426ee37b6d5f8c5e9e198f0c2b2248c9cd`, addon SHA256
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
SDK, Python, Rust, patch and addon are unchanged. Accepted Sprint 7 remains
snapshot `8546796741fd45e6fd8b61c1b549d8f011b54a318d7e6600474c2972411b8c66`;
its disclosure rows are data, not authority.

## Independent review and Main acceptance

Main read the full independent receipt and accepted only snapshot
`41e9efc3ad91dece126b82c99725add843023eba29164965be833fadd3941c96`.
Reviewer: `sprint-eight-review`; receipt `.loopx/s8-review/review-41e9efc3.json`,
SHA256 `ed6b23f6cac8b3e0a854f552710df8d3e09d9eb3a9a6e7f1aa10ff5ae0a61fc8`.
No open findings were reported. All 233 frozen payloads and accepted runtime
identities were verified before independent execution.

The reviewer reran all 37 author native/Cargo scenarios, the typecheck and five
existing native tests (30 assertions). Ten independently authored native cases
also passed, including direct/delegated positives, same-byte argument changes,
wrong hold, second arm, double preparation and real early delegated completion.
A separate Python SQLite connection observed the committed record while native
canonical bytes were still unchanged. Removing only exact-attempt comparison
made the independent argument-change oracle red; the exact production source
then passed the same control.

The actual author `gpt-5.5` stream/session/SQLite/canonical evidence was
independently parsed, not replaced by a model's success claim. A fresh actual
session and SessionManager reader recovered a real no_rly record and refused
old authority. The reviewer's provider-context proof used actual Agent.prompt
and SDK context transforms with a substituted capture-and-throw transport; it
was not another network/model inference request. The agent-end control used
production runner dispatch during a real suspended check, not actual provider
termination. Baseline/witness fault controls were explicit post-Cargo injections.

Main exclusively authorized serialized acceptance bookkeeping and the intended
public-only commit. The receipts are `.loopx/materials/sprint08-acceptance.json`
and `.loopx/materials/sprint08-commit.json`; both indices retain exact review and
source/proof pointers. No source/store/SDK/Python/patch/addon changes or formatter
run followed review. Next is a **fresh bounded Sprint 9 worker** under Main's
sequencing authority. This worker does not begin Sprint 9.

## Limits

The one-use state is loaded-extension-local, not a generic ticket service or
sandbox for arbitrary extension/OS writes. Invalidation is at actually observed
boundaries, not retrospective cancellation after native permission. Trusted
Cargo build scripts, post-observation filesystem races and ordinary partial
native I/O failure retain the accepted runtime's limits. SQLite durability is
bounded by its committed/read-back transaction and OS/filesystem synchronization;
hardware power loss is not claimed tested. UI evidence is real CLI output, not
TUI visual inspection. Passing means the configured checks passed or the exact
named finding was explicitly excepted, not global correctness or safety.
