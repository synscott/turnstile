# Native edit veto — implementation handoff

Status: **DIRECTOR_ACCEPTED — bounded native prerequisite.**
Implementation author: `omp-native-edit-veto`. Independent reviewer:
`native-veto-review`. The director accepted the exact reviewed snapshot after
reading the independent receipt; author and reviewer are distinct.
Baseline ownership transferred after acceptance of `0f28fc3`; its receipt remains unchanged.

## Deliverables and identity

- Public patch: `patches/omp-edit-veto.patch`.
- Restore/build/opt-in guide: `patches/omp-edit-veto.md`.
- Exact upstream pin: `can1357/oh-my-pi@61b1b8aef634334eaf1412afd003a763e1d1b9c1` (18.1.16).
- Frozen review manifest: `.loopx/materials/omp-edit-veto-review-manifest.json`.
  Its SHA256 identifies `omp-edit-veto-review-<manifest-sha256>.zip` beside it.
- Verification record: `.loopx/materials/omp-edit-veto-verification.json`;
  final artifact index: `.loopx/materials/omp-edit-veto-result.json`.
- Loaded Windows modern addon SHA256:
  `676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
  A digest-named private copy is retained for independent loading.

The archive contains exact changed upstream files, the pristine source archive,
patch/guide/the historical author handoff, and private verification evidence.
Source, addon, patch, and frozen author receipts remain unchanged. This public
handoff records subsequent acceptance, not a replacement of that frozen history.

## Contract

Optional `edit_prepared` is a deny-only, whole-call boundary after native staging and
before canonical writes or candidate-state commits. Permission consumes the same
owned staged vector. Effective execute arguments, path/disk state, and semantic store
revision are checked; default-off streamed behavior is retained. Operation JSON has
all seven required keys and explicit nulls, complete persisted preimages/finals,
native replay order, and original move-source identity.

Required integrations must check `api.supportsEditPrepared?.() === true`. This queries
the loaded native `EditSession.supportsPreparedGuard()` marker. Patched SDK plus stock
addon holds visibly. Stock SDK accepts an unknown event silently: absence/false must
install an existing `tool_call` blocker, not merely fail extension registration.

Guarded direct-writer support requires formatting and auto-repair disabled, no relevant
ACP transforming route, and no older formatting-enabled batch. Settings are not changed.
A held final edit safely drains earlier permitted diagnostics without formatting and
consumes that batch. No filesystem rollback is promised after write release.

## Author verification and limits

- Final compiled addon exercised native multi-file deny/allow, mutation/cancellation,
  bytes/path/store freshness, Windows junction rebinding, BOM/CRLF, non-UTF-8 holds,
  moves/collisions, CUT/PUT provenance, and noop rejection bookkeeping.
- Focused Rust integrations: 38 passed across six suites.
- SDK/ACP/stream-abort integrations: 14 passed, 58 assertions; SDK types and scoped lint pass.
- Actual source CLI: normal configured FCC/plugin discovery, successful RPC state and
  command queries, extension capability true, and exact addon digest. No model request.
- Actual project-local rust-analyzer syntax diagnostic survived allowed-first/denied-last
  batching; custom-linter regression also checks returned metadata and batch consumption.
- Genuine published stock18.1.16 addon and pristine SDK demonstrate the deployment hazard
  and both supported fail-closed remedies. No prototype/callback mocks were substituted.
- Patch restoration checked every one of 21 resulting file hashes against the built source.

At author freeze, broader runs were non-green: two path-policy unit failures and one
hashline tag-recovery fixture failure on Windows. The author retained exact unchanged
owner/helper hashes but did not claim those hashes alone proved the broader changed
call chain unrelated. That historical qualification remains in the frozen receipt.

Raw producer JSON for independent Python interoperability is retained separately at
`.loopx/materials/omp-edit-prepared-payload.json` with SHA256
`da802b2d167b08a6c307cfb4e98023f963c21d064be0f28664da063cb40a4d0d`;
its unchanged fixture is `.loopx/s4run/edit-prepared-consumer`.

## Independent review and director acceptance

The independent receipt is `.loopx/materials/omp-edit-veto-independent-review.json`;
the current acceptance and overall readiness records are
`.loopx/materials/omp-edit-veto-acceptance.json` and
`.loopx/materials/sprint04-prerequisites-readiness.json`.
The director accepted snapshot
`a90b6cb5c57023574b3a73e6a685e7cc6e1df6dd20c9679d7f969fece4525f77`
and the addon identified above, with no blocking findings or source changes.

- The reviewer verified the exact archive, manifest, restored source, and loaded
  addon in a separate copy, then exercised independently authored native, SDK, and
  writer-boundary consumers plus a genuine stock-addon bypass/control.
- The reviewer's original-pristine runtime control reproduced the same hashline
  tag-recovery failure. This particular failure is a pinned-baseline/platform
  limitation, not newly introduced by the patch; it is not a full-suite-green claim.
- **Author oracle correction:** `Settings.isolated` overrides shadow a later
  lower-precedence `Settings.set`, so the author's captured-formatter smoke did not
  establish effective `true → false`. The reviewer's separate mutable-setting probe
  explicitly observed that transition and the required captured-formatting hold.
  This corrects the evidence attribution, not the implementation.

All three Sprint 4 prerequisites are accepted. The Python prerequisite is committed
as `4d82a733b5e884b112979830a6809eee21562240`. Return to
[Sprint 4](sprint-04.md) under `/vibe` for the original native integration and real
model hold/feedback/repair proof; that Sprint 4 work is **not implemented or accepted**.

This delivers the native prerequisite, not the later Turnstile integration/model
feedback-and-repair acceptance criterion. Acceptance delivery updates only the
authorized handoff/navigation records. No Python analyzer, global installation,
credential/config, or publication changes are part of this delivery.
