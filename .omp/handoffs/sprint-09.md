# Sprint 09: ordinary commit disclosure fulfillment

Status: **ACCEPTED — exact bounded B and original full Sprint 9, by director Main.**
Author: `sprint-nine-fulfillment`; no children. Main owns sequencing, shared
indices, acceptance and commit authorization. Scope is original Sprint 9 bounded
B on accepted base `270bc44a8894a868e34fb3a9446b016d1cb8ec9a`; no Sprint 10,
server-side PR check or remote publication is implemented.
Accepted snapshot: `0b0273e2b46dfe5edc9716af3e55f64b89d70e46eef8bd2a49d7c8bf854ae952`.

## Contract and ownership

The [operator contract](../../docs/omp-edit-gate.md#successful-publication-and-pending-fulfillment)
is canonical. Existing `tools/turnstile-commits.ts` owns actual native Git
prepare/reference/post-commit lifecycle evidence, immutable full messages/trees,
Git-canonical coverage and the call to the concrete SQLite owner.
`tools/turnstile-disclosures.ts` adds exact-full-row acknowledgment inside its
existing validated immediate transaction. Schema, record/wire shape and CLI
commands are unchanged. No special commit tool, Bash parser, command classifier,
ref policy, receipt service or migration framework is added.

Preparation records no success. Only the checked immutable new OID can become
validated; only its matching successful HEAD callback can mark it committed.
Unrelated `AUTO_MERGE` callbacks cannot erase that evidence. Post-commit requires
matching native PID/creation identity, both OIDs, current HEAD, exact published
full envelope and complete fresh canonical images. Missing/mismatched evidence
visibly retains records. Preparation-only private witnesses, including inert
predecessor witnesses, never acquire success; ended generations remain cleanable.

Coverage is Git's representation under observed attributes/clean filters, not raw
checkout equality or proof that the original candidate was applied. Two complete
raw/canonical observations plus a final non-converting observation check file and
ancestor identities, exact spelling, configuration, attributes and filter
stability. Ordinary files and deletion absence are supported. Partial paths or
hunks retain records; later complete repairs can fulfill them. Unapplied/reverted
intent can be explicitly carried in an ordinary disclosure-only `--allow-empty`
commit. Every previous full message disclosure must survive ordinary amend,
regardless of current SQL or diff relevance, including amendment to the parent
tree. Rebase/history policy remains outside scope.

Acknowledgment validates all rows/schema inside `BEGIN IMMEDIATE`, compares the
entire published record including timestamp, deletes only the exact live row and
checks deletion/readback. New or same-ID changed/reinserted records remain pending.
Postref storage failure cannot undo Git success. Known acknowledgment counts are
preserved; witness-cleanup failures are reported separately. A generic error
without an established storage outcome reports unknown acknowledgment and directs
the ordinary pending reader and retry of outstanding records, never auto-amend.

## Runnable proof and independent oracles

The exact freeze pointer is
`.loopx/sprint09-fulfillment/materials/review.json`; its canonical manifest and
archive bind source, governing contracts, executable proofs, raw results,
fixture-state archive and dependency identity. The independent reviewer must
verify all hashes and execute from its own copy. Author proof is not acceptance.
Reproduce with accepted local Bun/native Windows Git/PowerShell/SDK dependencies:

```text
python .loopx/sprint09-fulfillment/complete.py
```

The driver executes dedicated ordinary-Git lifecycle, adversarial, concurrency,
affected-A-invariant and actual native OMP scenarios. Independent Python SQLite
and `git cat-file`/tree/index readers check observable results rather than the
production formatter's round trip. Synthetic domain-valid records are expressly
fixture data except the separate actual native chain below.

Proof covers successful complete publication, partial path/staged-hunk/vector,
moves/deletes, later repairs, disclosure-only preimages and ordinary amendments
of retired records back to parent trees. Actual CRLF and clean-filter cases prove
Git representation versus raw bytes; partial filtered images, unstable clean
drivers and a second-driver canonical mutation retain records. Exact-phase
negative source copies remove only success or complete-coverage guards and
wrongly delete outstanding records; production counterparts retain them.

Native successful HEAD evidence survives actual `AUTO_MERGE` callbacks to
post-commit. Missing/mismatched/preparation-only witnesses retain visibly,
including the accepted unclassified private-witness-deletion bypass. Actual
failed editor/message stripping, missing/corrupt/malformed/triggered/locked
storage, postref storage failures and retries are covered. A separate SQLite
connection holds an exclusive postref lock. A real clean driver reinserts a
same-ID changed-timestamp row after selection but before acknowledgment; the
transaction preserves it. Another introduces a DELETE-IGNORE trigger at that
phase and the owner rejects it. Private database/case-alias staging and missing
prepare-hook denials preserve exact staged entries and HEAD.

### Real native producer and fresh consumers

Fresh source OMP SDK sessions use the accepted deployed extension and real native
WriteTool/Cargo checker: bad write is held without changing canonical bytes,
explicit `no_rly` arms the exact attempt, identical native write releases and
creates an actual SQL record. A separate fresh source OMP session retrieves that
exact record through the real context runner and `convertToLlm` non-system data
path, then executes ordinary `git add` and `git commit` through the actual native
BashTool. Independent Python SQL and immutable Git message/tree oracles verify
the complete exact envelope, committed native bytes and an empty pending store.
Another fresh actual OMP reader no longer reports that pending record.

This is actual source/native production execution, not a fake tool echo or a
special commit API. The reader attribution is SDK context-runner/model-message
conversion, not provider inference: no model request or substituted provider
transport is used. All launches have explicit private `--session-dir`, XDG and
temporary roots while retaining normal authentication/context/FCC discovery.
No global sessions/settings/reference/remote mutation is performed.

## Runtime and limitations

Accepted runtime remains upstream
`61b1b8aef634334eaf1412afd003a763e1d1b9c1` / `18.1.16`, cumulative patch SHA256
`03dcbb379b32d8e07f994e7bda6966426ee37b6d5f8c5e9e198f0c2b2248c9cd`, addon SHA256
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
Extension, SDK, Python checker, Rust, patch and addon remain unchanged. Accepted A
is exact `5d14033824233ffa9d8db954b0878bef3b69fb8d07f126ec494d647fa82ff5b7`;
accepted real S8 is exact
`41e9efc3ad91dece126b82c99725add843023eba29164965be833fadd3941c96`.

Git/FS/SQLite observations are not a cross-resource transaction. Later records
and arbitrary OS writes after observations, transient write-and-restore,
operator hook/private-state/configuration changes and history rewriting remain
bounded as documented. Trusted clean drivers are not sandboxed. No hardware
power-loss, unsupported-platform/linked-worktree, TUI visual, PR or global source
quality guarantee is claimed. Failed/partial obligations remain discoverable
through ordinary storage and fresh OMP readers.

Only one exact touched-source style pass and a scoped typecheck are included;
no broad suite or known pristine Windows colon-path rerun. Owned temporary
workspaces/runtime state are archived with hashes before removal. Frozen prior
scripts/receipts are not mutated. Reviewed production source and operator guide
remain fixed; only Main-authorized acceptance bookkeeping follows the exact
independent review.

Proof corrections retain their original raw failure evidence: a missing-witness
notice assertion initially inspected a subsequent cat-file call's stderr;
a private driver import initially recursed through its own filename; an index
preservation assertion initially compared native Git's mutable index stat-cache
bytes rather than complete staged entries. These were proof-oracle errors, not
suppressed product failures.

## Rejected first revision and owning corrections

Independent review rejected
`ad015a00379ab4d080325e139b86b7dd21e24896c5550b1f60eedc8d5968f65d`.
Its immutable manifest/archive, author proof and exact reviewer reds remain
preserved. Passing the original author groups did not cover these findings.

An actual Windows no-delete handle let acknowledgment commit before witness
unlink failed with `EBUSY`. The original generic catch then falsely asserted the
rows were not retired. Witness cleanup now reports its own failure without
overwriting the known SQL result. Generic post-success errors without a known
storage outcome report unknown acknowledgment and the ordinary reader/retry path.
The owned SQLite transaction/close exits were inspected; no storage schema or
new lifecycle mechanism is introduced.

Actual `a.` and `dir./a` Windows aliases resolved to uncommitted files while
directory enumeration lacked those exact spellings. The first implementation
mistook that for absence and retired explicitly published intents. Every
unlisted component now requires native Windows file/directory-not-found;
a resolvable alias is refused, not supported or normalized. Bun's exact-name
lookup was independently falsified as a sufficient absence check: it returned
`ENOENT` where normal Windows I/O resolved an alias. The owner reuses the already
qualified PowerShell with standard .NET lookup only for unlisted components,
passing the path as environment data rather than interpolating commands. The
successor proof uses actual trailing-dot/space file and ancestor lookups, existing
case refusal, OS-generated short names where available, legitimate absent
deletes and ordinary exact-path success.

## Independent review and Main acceptance

Main read the complete exact review and accepted only
`0b0273e2b46dfe5edc9716af3e55f64b89d70e46eef8bd2a49d7c8bf854ae952`
for bounded B and original full Sprint 9 under the accepted A/Windows boundaries.
Reviewer: `sprint-nine-fulfillment-review`; receipt
`.loopx/s9-fulfillment-review/review-0b0273e2.json`, SHA256
`aeb02662bcb7eead3342f2dd1710a982343617852d3bdc076410ab2ecde5d986`.
There are no open findings. R1/R2 are resolved against this exact successor.

The reviewer verified the exact manifest, all nested evidence identities and
accepted dependency hashes, then used its own copy for 21 independently authored
groups plus 14 attributed author adversaries, 406 logged fixture commands, a
scoped typecheck and a fresh actual native chain. Real no-delete handles preserve
known acknowledged/retained SQL outcomes; later preparation cleans released
witnesses. Actual leaf/ancestor/short-name aliases retain, genuine absence
fulfills, and native lookup errors/path-as-data cases are explicit.

Fresh actual source OMP native/Cargo hold -> `no_rly` -> release -> fresh
non-system record reader -> native Bash Git -> independent immutable
message/tree/SQLite -> fresh valid-empty reader passed. This is not a wholesale
independent rerun of all seven author components, provider/model inference,
substituted transport, installed Sprint 11, TUI visual or PR verification.

Rejected `ad015a00`, all original counterexamples, the failed naive Bun lookup,
and A's original private-witness bypass/dissent remain preserved, not relabeled
green. Main transferred exclusive acceptance bookkeeping and authorized the
intended public-only commit. Exact receipts are
`.loopx/materials/sprint09-acceptance.json` and
`.loopx/materials/sprint09-commit.json`; both exact-name indices link the reviewed
source, proof and history. No production/operator-guide edit or formatting
followed review. Next is Main's **fresh bounded Sprint 10 worker**. This author
does not begin Sprint 10.
