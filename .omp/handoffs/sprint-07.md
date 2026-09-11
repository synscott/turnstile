# Sprint 07: pending disclosure persistence

Status: **ACCEPTED — exact corrected Sprint 7 revision, by director Main.**
Accepted snapshot: `8546796741fd45e6fd8b61c1b549d8f011b54a318d7e6600474c2972411b8c66`.
Author: `sprint-seven-disclosures`. Main owns sequencing, shared indices,
acceptance and commit authorization. No children were used. This scope implements
only Sprint 7 of the [build plan](../../docs/build-plan.md), on accepted base
`935298286c85da36a3eff3c0fe278d013b24f079`; it does not start Sprint 8.

## Contract and ownership

The [operator contract](../../docs/omp-edit-gate.md#pending-disclosure-storage)
defines provisioning, schema, publication, failure states and recovery. One
concrete Bun SQLite module, `tools/turnstile-disclosures.ts`, owns the fixed
`.omp/turnstile-disclosures.sqlite` in the explicitly selected launch workspace.
That workspace also owns `.omp/turnstile.json`; record paths are relative to
**that workspace**, not an inferred Git root. No Git discovery is added.

The existing enabled configuration witnesses expected state. Read and append
never create a missing store. Explicit initialization requires absent/disabled
configuration and an exclusively new target; initialization is not a reset or
recovery command. Missing, valid empty, corrupt and unavailable remain distinct.
Restore the original database after loss; do not describe lost obligations as
cleared. A failed initialization can leave an invalid file and is not an atomic
publication guarantee.

Pending rows contain exact-attempt and selected-finding digests, concrete relative
file effects with before/after hashes, finding rule/path/line/message and reason.
The writer derives the content ID and timestamp. No raw authored source, receipt
service, migration/policy framework, generic store interface or runtime process
is added. SQLite transactions serialize supported writers; identical input
returns the existing record. Owned schema/version and every returned row are
validated; malformed entries and triggers attached to the owned pending table
are refused. Append validates under the same write transaction and checks both
the inserted-row count and exact stored bytes before committing. No per-prompt
whole SQLite integrity sweep is performed.

Rows are descriptive disclosure **data**, not self-minted approval. No caller's
claim of a prior hold is accepted as authority. No `no_rly` tool, exact-hold
release, automatic retirement or Git hook exists. Sprint 8 must independently
bind the held attempt/finding and record before release. Sprint 9 can resolve
the launch-workspace prefix into Git and use the file effects for partial-commit
relevance. Neither consumer is implemented by this sprint.

The actual extension publishes startup/session-switch snapshots and rereads the
store through OMP's existing `context` event. Only its ephemeral custom message
is replaced in provider context, not the system prompt or stored transcript.
Repeated context construction does not append full-record dumps. Changed data
or errors reach ordinary notifications and print/JSON stderr. Startup snapshots
are displayable session messages. Errors state that pending state is unknown;
normal quality checking remains active, with no exception permission available.

## Concrete author proof

From the project root with the accepted local Bun/runtime dependencies:

```text
python .loopx/sprint07/run.py storage
python .loopx/sprint07/run.py consumer
python .loopx/sprint07/lifecycle.py
python .loopx/sprint07/run.py gating
python .loopx/sprint07/run.py types
```

Private command receipts preserve argv, exit status, raw stdout/stderr and source
identity. The final verification receipt and immutable snapshot pointer live in
`.loopx/sprint07/verification.json` and `.loopx/materials/sprint07-review.json`.
These author artifacts do not confer acceptance or commit permission.

- Storage proof covers a real writer in separate Bun processes, an independent
  direct-SQL row oracle, reopen, idempotent concurrent duplicates, distinct
  competing writers, enabled-init refusal, loss/read/write refusal without
  recreation, exact restoration, zero-byte/non-SQLite/schema-version/malformed
  row and attached-trigger failures, unavailable directory targets and actual
  exclusive-lock read and write failures. All records are explicitly **synthetic exception data**;
  no authorized override or release is claimed.
- The source consumer loads the deployed extension by file path through real
  `createAgentSession` and standard runtime initialization. It discovers the
  exact written record, converts the real context result into non-system model
  messages, and exercises a live external writer, transcript non-growth,
  `/new`, target loss and restoration. Real native bad-write hold and acceptable
  repair still use Cargo and preserve the held target bytes.
- Fresh independent source sessions exercise missing, empty, corrupt,
  malformed-row, attached-trigger and unavailable state in both JSON and print mode, using their
  normal no-UI notification path. Stderr and startup/session data retain the
  distinction. Separate `SessionManager.open` processes retrieve those persisted
  notices. Unrelated launch workspaces do not inherit another workspace's rows.
- The existing focused native gating test reports **5 pass, 0 fail, 30
  expectations**. The extension/storage typecheck passes. No broad suite or
  known pristine Windows colon-path failures were rerun or suppressed.

Every actual session consumer receives an explicit project-private
`--session-dir` argument; runtime XDG and temporary paths are also private.
No model-provider request was needed or performed. These are actual source OMP
consumer and persisted-session-reader checks, not a fabricated model report,
TUI visual inspection, branch workflow or provider-backed compaction claim.
Context-loss correctness is exercised with an empty context through the real
runner API, including conversion to the model-message representation.

## Runtime identity and evidence boundary

The runtime remains upstream `61b1b8aef634334eaf1412afd003a763e1d1b9c1` / `18.1.16`
with accepted cumulative patch SHA256
`03dcbb379b32d8e07f994e7bda6966426ee37b6d5f8c5e9e198f0c2b2248c9cd`
and addon SHA256
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
SDK, Python checker/candidate owner, Rust and addon are unchanged. Accepted
Sprint 6 exact review remains `a3e13fed39d89ff66a3d355384083745bcdf251db31fc20755d21930057cb34e`.
Old frozen artifacts and scripts are not mutated.

The private digest-addressed archive includes source, governing instructions,
executable proofs and raw output, plus accepted runtime identity pointers.
An independent reviewer must verify its canonical exact-file manifest and
reproduce in a separately owned copy. Main alone records acceptance and
updates shared indices. The author retains the same bounded session for review
findings and an explicitly authorized public-only commit.

The initial consumer probe assumed a held native call returned an error-shaped
value; the actual native wrapper throws. That fixture assumption was corrected
and its failed raw receipt retained. No product failure was suppressed by that
correction. Owned throwaway workspaces/runtime state are removed after final
proof, with exact cleanup and raw evidence retained privately.

Independent review rejected the first snapshot
`58f5c233fc1a95ea81650d4db7f870c9a039e42377c78f68b15f8f17f436886c`:
SQLite BEFORE INSERT IGNORE and AFTER INSERT DELETE triggers could negate the
write while the old owner returned a success-shaped record. The old author
proofs passed but missed that malformed-schema case. Reviewer-owned red evidence
is preserved with the rejected immutable archive. The owning repair rejects
attached triggers and requires an observed exact insert inside the same write
transaction; successor storage and actual OMP error-consumer proofs cover it.

## Independent review and Main acceptance

Main inspected the full exact successor receipt and accepted only corrected
Sprint 7. Reviewer: `sprint-seven-review`; receipt
`.loopx/s7-review/review-85467967.json`, SHA256
`b5802b558f08638cba0afcd609b460e8290d886abec772f9a67528ba3c3bc67d`.
The reviewer verified all 88 frozen payloads, reused only the hash-verified
accepted S6 runtime read-only, and ran the new source from its own copy.

Independent reproduction passed the full author proof, 19 independently authored
adversarial outcomes across 67 fresh-process calls, ignored/deleted/changed
insert controls and competing schema-writer transaction consistency. Actual
`Agent.prompt`/agent-loop execution reached the SDK context transform and a
capture-and-throw provider transport: exact records, live writer freshness,
loss/restoration and `/new` reached ordinary non-system data messages without
repeated transcript dumps. This was not network access or model inference.
A fresh `SessionManager.open` recovered both exact records. Absent/disabled
configuration retained native unguarded behavior and created no store.

Old snapshot `58f5c233fc1a95ea81650d4db7f870c9a039e42377c78f68b15f8f17f436886c`
remains rejected; its immutable archive and attributed reviewer red are preserved.
Only the successor's owned-schema/transaction/readback repair is accepted.
Synthetic descriptive records prove persistence, not an authorized held
exception, `no_rly` release, retirement, commit policy or overall product completion.

Main exclusively authorized serialized acceptance bookkeeping and the intended
public-only commit. Receipts are `.loopx/materials/sprint07-acceptance.json` and
`.loopx/materials/sprint07-commit.json`; both indices link the exact source,
review and proof chain. Frozen source/evidence and SDK/Python/patch/addon remain
unchanged. Next is a **fresh bounded Sprint 8 worker** under Main's authority.
This worker does not begin Sprint 8.

## Limits

SQLite `synchronous=FULL` with DELETE journaling is the concrete durability
mechanism. Successful commits/reopen and competing-process behavior were
exercised, not hardware power loss. OS/filesystem synchronization, arbitrary
external writers and post-observation replacement races are not strengthened
into a sandbox guarantee. Initialization/configuration changes require ordinary
operator coordination. Deleting or disabling the witness deliberately remains
possible with local OS access. No reset, backup service or automatic retirement
is provided. Disclosure data alone cannot release a mutation or prove authority.
