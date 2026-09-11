# Sprint 10: ordinary server-side PR disclosure check

Status: **ACCEPTED — original Sprint 10, exact reviewed successor, by Main.**
Author: `sprint-ten-pr-check`; no children. Base commit:
`0aa49dff795357c6b94874881ed9cb09059c282d`. Main owns sequencing, acceptance,
shared indices and commit authorization. No Sprint 11 work or remote write occurred.
Accepted snapshot:
`e804aeabc4b1c57a56565012df13fdded0fb65f5f8e6aad5c59a99904b83c383`.

## Contract and source ownership

The canonical [operator contract](../../docs/omp-edit-gate.md#server-side-pr-disclosure-snapshots)
describes the ordinary trusted `pull_request_target` workflow, exact head-SHA
Checks API publication and complete immutable `base..head` all-parent range.
`tools/turnstile-pr-check.ts` is the concrete consumer; the workflow is
`.github/workflows/turnstile-disclosures.yml`. The consumer imports the existing
commit reader/parser and existing full-record validator. No new schema, receipt
service, endpoint option, special submission tool or PR skill exists.

Only trusted reporting code at the event's immutable `github.sha` is checked out.
The PR is read as data through fixed GitHub.com API/Git origins. No head checkout,
head dependencies/config/hooks/submodules, private store or token-bearing Git
configuration file is executed or published. Full histories are fetched into an
owned temporary bare repository. The only write permission is `checks: write`.

Each run owns only its API-returned check ID. The visible name includes PR number
and full base SHA, while the check is explicitly attached to the selected head.
Concurrent events cannot update each other's check IDs. Fresh PR reads before
fetch and just before successful completion cancel observed stale pairs. Old
same-head retarget reports remain distinctly identified historical snapshots.
These are dynamic pair-specific informational checks, not a fixed required
branch-protection quality check. There is no concurrency queue, poller or
base-only-push refresh. Post-observation races and suppressed/missing GitHub events
are explicitly not an atomic continuously-current guarantee.

## Authorized shared-owner correction

Actual production CLI evidence at `.loopx/sprint10/malformed-marker-red.json`
showed a column-zero `Turnstile-Disclosure:{bad}` message reported success/zero.
Main explicitly authorized the minimal additional ownership of
`tools/turnstile-commits.ts`: its existing parser recognizes the exact column-zero
key and rejects a missing required space. Canonical full S9 wire and unrelated
prose are unchanged. No fuzzy recovery or second parser was added.

The same original immutable object now fails through the production server CLI.
Actual ordinary native Git hooks reject missing/tab/empty separators without
moving HEAD; canonical full real S9 data and non-marker prose still commit.
Other accepted Sprint 9 semantics are unchanged, not broadly reimplemented or
wholesale rerun. The accepted full-record dependency remains the Sprint 9 exact
snapshot `0b0273e2b46dfe5edc9716af3e55f64b89d70e46eef8bd2a49d7c8bf854ae952`.

## Executable proof and independent oracles

The frozen handoff is `.loopx/sprint10/materials/review.json`. Its canonical exact
file manifest/digest and archive include owned source, governing contracts,
official-source receipts, executable private proof, raw receipts and dependency
identity. Review must verify hashes and run from an independent own copy; author
claims and a completed worker turn are not acceptance.

Private drivers under `.loopx/sprint10/`:

- `prove.py`: independently authors native Git objects and full JSON from the
  accepted actual S9 record, then executes the real report CLI. Covers clean and
  empty ranges, long full messages, complete multiple records, merge and side
  history, new/force-replaced head addition/removal, base/range changes, malformed
  records, unreadable UTF-8, shallow/missing history, size refusal and hostile data.
- `protocol.py`, `server.py`, `transport.ts`: executes the actual production
  `github` entrypoint and workflow run command. A **private-only** Bun preload
  redirects its fixed origins to loopback. Git fetch really uses native smart
  HTTP against `git http-backend`; the independent receiver records all API
  requests. Exercises exact head publication, freshness cancellation, overlapping
  same-head retarget success/failure, API/fetch/identity errors, and an explicitly
  injected cleanup refusal. It is a local protocol exercise, **not GitHub service
  verification**. No real credential is supplied.
- `marker.py`: ordinary Windows Git hook and original server-CLI red/green proof.
- `complete.py`: reproducible bounded driver and final scoped proof receipts.

Independent JSON/HTML decoding checks every full published envelope, native Git
set/object readers check range membership and immutable messages, and protocol
receipts check exact check-ID ownership and conclusions. Real Chromium displayed
both full disclosure blocks and malicious payload as text with no executable
script, link or image nodes. That proves local HTML-block rendering, not GitHub's
Markdown sanitizer or actual PR Checks presentation.

Initial proof-oracle/setup failures remain in the archive: a word-specific
unknown assertion despite an explicit not-zero failure summary; Python removal
of read-only Git fixture objects; missing fixture hooks/info directories after
empty-template init; and LF-versus-actual-CRLF message comparison. Corrections and
original raw failures remain attributed, not relabeled product successes.

## Runtime, limits and continuation

Production selects hosted Linux and Bun 1.4.2; direct consumer imports do not
invoke the Windows-only local hook installer. Local runtime proof used native
Bun/Git for Windows. WSL lists Ubuntu but actual launch fails
`HCS_E_SERVICE_NOT_AVAILABLE`; no host feature/global configuration was altered.
Linux execution therefore remains unobserved here. There is no configured
approved remote: workflow delivery, repository permissions, fork service
association and actual GitHub UI cannot be exercised locally. No push, PR,
check-run creation on GitHub, remote/auth/configuration change or live PR claim
was made.

Git/API/input/output limits fail visibly without clean partial sampling.
Rendering exposes validated public commit data, not an authorization proof or a
secret-classification guarantee. Cleanup/publication failures remain failed or
unconfirmed; abrupt process/host termination is not a completion guarantee.
Scoped typechecks and one exact touched-file style pass follow logic proof;
no broad suite or known Windows colon-path rerun is part of this sprint.
A final local protocol counterexample distinguished a mismatched PR-number API
response from a genuinely stale pair. The consumer now refuses that invalid
identity as failure before freshness comparison. The pre-correction exact source,
red result and successor scoped type/protocol evidence remain preserved privately.

## Independent review and Main acceptance

Main read the full initial review and the exact successor identity, S10-R1
resolution, inherited-proof and limits sections, then accepted **only**
`e804aeabc4b1c57a56565012df13fdded0fb65f5f8e6aad5c59a99904b83c383`
for original Sprint 10 under the approved informational event-snapshot,
native-Windows and local-protocol limits. Reviewer: `sprint-ten-pr-review`;
receipt `.loopx/s10-review/review-e804aeab.json`, SHA256
`bf420f4d172ebeb827d226f678d78aca7da5a7d33b0742f560fba12a517edb6b`.
There are no open findings.

The reviewer verified the exact successor manifest/archive and all 413 payloads,
including both nested fixture archives. Of the prior 411 payloads, only the
operator-guide timeout prose changed; all 410 others retained exact identities.
S10-R1 now distinguishes the private helper's two-minute deadline, the shared
reader's lack of a per-call timeout, the hosted ten-minute whole-job cap and the
standalone CLI's lack of that hosted cap. No accepted S9 mechanism was changed
to repair prose.

Inherited exact-source evidence includes the reviewer's own-copy replay of
seven author-designed history groups, five protocol groups and native marker
checks; seven reviewer-designed groups, two genuine guard-mutant red/green
oracles and five independent transport-refusal scenarios; scoped types and
local Chromium inert rendering. The doc-only successor was verified through
exact delta and source/proof identity, not a redundant runtime rerun.
Original review `.loopx/s10-review/review-2dc9c866.json`, all reds, setup
corrections, objections and source proof remain preserved.

Acceptance does not claim live GitHub service/PR verification, Linux runtime,
provider inference, installed Sprint 11, fixed required branch-protection checks,
global quality, authenticated intent or atomic continuously-current reporting.
The canonical operator contract and original exact reviews retain all boundaries.

Main transferred exclusive acceptance bookkeeping and authorized the intended
public-only commit. Exact receipts are
`.loopx/materials/sprint10-acceptance.json` and
`.loopx/materials/sprint10-commit.json`; both exact-name indices point to this
accepted evidence. No production source, workflow or operator-guide edit or
formatting followed review. Next is Main's **fresh bounded Sprint 11 worker**
for the actual installed test build. This worker does not begin Sprint 11 and
remains available only until Main retires it.
