# Native Git disclosure message boundary

Status: **ACCEPTED — exact prerequisite A revision, by director Main.**
This is bounded prerequisite A, not completed Sprint 9. Main owns sequencing,
shared indices, acceptance and commit authorization. Author `sprint-nine-commits`
used no children. Base: `0444d1c0c168a87309067520795830fbe9c9afc6`.
Accepted snapshot: `5d14033824233ffa9d8db954b0878bef3b69fb8d07f126ec494d647fa82ff5b7`.

## Scope and contract

The [ordinary Git operator contract](../../docs/omp-edit-gate.md#ordinary-git-disclosure-boundary)
is canonical. `tools/turnstile-commits.ts` installs direct native Bun hooks only in
explicitly selected Windows Git fixtures, injects relevant real S7 pending rows,
and checks finalized immutable Git messages/trees at the deny-capable prepared
reference transaction. The S7 record validator is extracted and reused without
changing the SQLite schema, row shape, append authority or native gating.

The minimal versioned message carries the explicit workspace prefix and complete
record with fixed authorization-intent semantics. Partial index/hunk relevance
is conservative, not a claim that an excepted candidate was applied. No record
is deleted or acknowledged by this prerequisite. No PR workflow, SDK, Python
checker, Rust, runtime patch or addon change is included. No root hooks, index or
refs were changed during implementation/proof; the final public commit requires
Main's separate authorization.

Native Git-for-Windows `2.44.0.windows.1` experiments establish that direct Bun
hook processes share the actual Git parent PID and Windows process creation
time. Shell `$PPID` was `1` and rejected; Bun's parent through a shell wrapper was
also not the Git process. Trace2 only worked with externally supplied environment
and was rejected as an installation dependency. The implementation uses a small
read-only standard Windows process StartTime query, not process-command parsing,
FFI, a service, a lease framework or caller-claimed commit success.

Preparation witnesses are private and per native Git process, scoped by PID and
creation identity. They do not authorize anything. Immutable final Git objects,
actual old/new HEAD transitions and freshly validated workspace records own the
message decision. Ended/reused process witnesses are cleaned without deleting a
live concurrent invocation's witness. Ref filtering precedes cleanup: Git's
post-success `AUTO_MERGE` aborted/prepared/committed sequence is not a failed HEAD
commit. Other refs/reset/fetch/rebase do not acquire ordinary-commit authority.

Replacement-message amend is deliberately not guessed. Actual `--amend -m/-F`
prepare arguments are indistinguishable from ordinary explicit messages. A final
amendment that drops relevant original disclosures fails visibly; ordinary
`--amend -c HEAD`, `--no-edit`, or an explicitly retained complete block repairs it.

## Proof and exact review material

Private drivers and immutable raw command/SQLite/Git observations are under
`.loopx/sprint09-boundary/`. From a separate review copy with Bun, native Windows
Git and PowerShell:

```text
python .loopx/sprint09-boundary/prove.py
python .loopx/sprint09-boundary/adversaries.py
```

These are actual ordinary Git commands and real S7 SQLite producer/reader calls.
Their records are explicitly **synthetic disclosure data**, not S8 no_rly
application/authorization evidence. B owns real S8 and fresh OMP integration.
Independent oracles use Git cat-file/show/log/tree/index and Python SQLite,
not merely the message formatter's round trip.

The proof covers exact full messages, partial path and actual staged hunks,
subsequent repairs, move/create/delete effects, unrelated/empty commits, amend
refusal/repair, editor/scissors/configured cleanup, late distinct records and
retry, precommit/--no-verify failures, missing/corrupt/triggered/locked storage,
real Windows path-casing refusal, setup ownership/idempotency/privacy/index
preservation and a real Windows exclusion-file write lock forcing precise setup
rollback. Native PID/start observations include a current-PID/wrong-creation-time
reset control and actual postcommit witness observation after AUTO_MERGE events.

One initial adversarial oracle incorrectly expected an editor's later `git add`
to alter Git's already-loaded commit tree. Actual Git committed the original
prepared image and retained the editor's new canonical/index image. The corrected
oracle independently checks both images, the outstanding record, and the later
repair commit. The original failed raw receipt remains preserved, not relabeled
as a product failure or a successful check.

The exact manifest/archive pointer is
`.loopx/sprint09-boundary/materials/review.json`. It includes source, governing
contracts, executable proofs, raw outputs, cleanup inventory and accepted runtime
identity. Independent review must verify every file/hash and use its own copy;
Main alone records acceptance. Frozen evidence is never overwritten.

## Rejected revision and bounded successor

Snapshot `2106e25afaaa0267eabd47462ef031f8a19424c94991ab150ad72127399959df`
was rejected after independent review; its archive and red evidence remain
unchanged. The reviewer demonstrated three precursor-loss cases. Main required
the surviving reference hook to visibly refuse missing/no-op/replaced prepare
hooks by exact owned-byte validation. The original editor case that directly
deletes the valid private witness remains a demonstrated operator-state bypass,
not a fixed or validated path. This matches the original documented OS/private
state boundary; Main declined command inspection, broader ref admission, Trace2,
Git patches and duplicate witness infrastructure. Reviewer objection and Main's
adjudication are retained separately; ordinary message-only tampering stays denied.

Independent review also demonstrated real privacy leaks with a `work[1]`
workspace prefix and a pre-staged `.OMP` alias. The owning successor uses one
exact database/sidecar family, literal Git-ignore escaping, and conservative
case-alias refusal in setup, effective-index and final-tree checks. It neither
case-folds ordinary source identity nor discards the user's staged data.
No-witness transactions are expressly unclassified/unchecked; B cannot treat
their absence as commit validation or acknowledgment evidence.

## B lifecycle policy and remaining Sprint 9

Main accepted this policy for a **fresh B worker**, not implementation in A:
fulfillment means publishing the exact complete intent record in an actual
verified successful Git commit while all affected Git-tree images match current
canonical workspace images, including absence for deletes. It does not require
proving that the original candidate was applied, nor exact recorded-after hashes
when later repairs are completely represented.

Concrete cases:

- A record affects `a` and `b`; only `a` commits while canonical `b` remains changed:
  carry the full record, retain it because the tree does not cover canonical `b`.
- One hunk commits as `H` while canonical `a` is complete `X`: disclose, retain.
- Both files are later repaired to `R` and `S`, fully committed, and every affected
  tree image equals canonical content: an exact full committed disclosure can
  fulfill the obligation even when `R/S` differ from recorded candidate hashes.
- A recorded intent is followed by native refusal, or all work is reverted to the
  recorded preimage: an unrelated commit does not automatically disclose/retire.
  The author can explicitly include the complete intent in an ordinary
  disclosure-only commit; complete canonical coverage then fulfills disclosure
  without inventing candidate application or requiring a special commit tool.
- Any commit failure, remaining unstaged affected content, missing full disclosure,
  unreadable state, or inconsistent fresh observations retains the record visibly.

B must implement the concrete owner acknowledgment only after verified successful
Git evidence and fresh complete canonical coverage. Exact live-row comparison in
an immediate validated SQLite transaction must preserve newly arrived or
reinserted records. Post-success storage failure cannot undo Git success: report
it and keep obligations outstanding. Git/tree, filesystem and SQLite observation
are not a cross-resource transaction; post-observation OS writes and later records
must be bounded honestly. Real S8 records, actual fresh OMP pending-data reader
and ordinary OMP Git execution remain B acceptance, not inferred from this proof.

The original [Sprint 9 acceptance](../../docs/build-plan.md) remains unchanged and
unfinished. A's independent acceptance must precede Main's fresh B worker. Do not
begin Sprint 10.

## Runtime and limitations

Accepted runtime identity remains upstream
`61b1b8aef634334eaf1412afd003a763e1d1b9c1` / `18.1.16`, patch SHA256
`03dcbb379b32d8e07f994e7bda6966426ee37b6d5f8c5e9e198f0c2b2248c9cd`, addon SHA256
`676bd3c3699e8a7c0f5ca350939d4340b32be64e7e6a38a873d7d2c259658b0f`.
S8 accepted snapshot remains `41e9efc3ad91dece126b82c99725add843023eba29164965be833fadd3941c96`.
No broad suites, known Windows colon-path reruns, model requests, global sessions,
remote/publication, or S9 completion claims are part of A.

Local hooks/settings and arbitrary OS writes remain operator-controlled. Setup
rollback is a caught-failure guarantee under quiescent installation, not an
atomic multi-file install across forced termination. Windows path casing
ambiguities and unsupported linked-worktree/platform layouts are visibly refused.
The boundary carries descriptive data; it is not an adversarial sandbox or a
proof of overall source quality.

## Independent review and Main acceptance

Main read the full successor review and accepted **only** exact snapshot
`5d14033824233ffa9d8db954b0878bef3b69fb8d07f126ec494d647fa82ff5b7` as prerequisite A
under the explicitly adjudicated operator-state boundary, not completed Sprint 9.
Reviewer `git-disclosure-boundary-review` reported no open in-scope findings:
`.loopx/s9-boundary-review/review-5d140338.json`, SHA256
`ca8e49ab2bcfb5c3bc0c586933159a4a0b6156a624bfcfaf8530873b4234bd08`.

The reviewer verified the exact manifest and worked in its own copy, executing
53 independent outcome groups across 613 real commands. R1a/R2/R3 were resolved
with actual ref/message, SQLite, complete artifact-family privacy, final-tree,
concurrent invocation and installer rollback oracles. Reviewer recipes were
independently authored; this was not an independent rerun of the author's
typecheck or OMP/model execution. All accepted runtime source/addon identities
remain unchanged.

Rejected `2106e25a` and its raw privacy/precursor red evidence remain rejected and
preserved. R1b, deliberate deletion of the private witness, remains an explicitly
demonstrated unclassified/unchecked operator-state bypass. Reviewer dissent and
Main's adjudication are retained; that bypass is not claimed fixed or validated.

Main transferred exclusive serialized acceptance bookkeeping and authorized the
intended public-only commit. Exact receipts are
`.loopx/materials/git-disclosure-boundary-acceptance.json` and
`.loopx/materials/git-disclosure-boundary-commit.json`; both shared indices point
to the reviewed snapshot, proof and rejection/adjudication chain. No production
or operator-guide logic edit or formatting followed review.

Next is Main's **fresh B worker** for complete canonical-coverage acknowledgment
and real S8/fresh OMP end-to-end proof. Full Sprint 9 remains unfinished. This
worker does not implement B or begin Sprint 10.
