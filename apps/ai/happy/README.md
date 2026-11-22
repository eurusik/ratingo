# Happy

Happy reviews pull requests. It runs as its own Railway service (`apps/ai/happy`, Dockerfile and `railway.json` here) and reads untrusted pull request content, so it holds only its own credentials.

Step 1 is the manual CLI. Step 2 (this) adds automatic triggering through a GitHub App in **shadow mode**: Happy publishes one check run named `Happy` with the conclusion `neutral`. It never comments on or reviews a pull request and never approves anything, so CodeRabbit keeps working next to it.

## How a review starts

| Event                                                                                                                                                                 | Result                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pull_request` `opened`, `ready_for_review`, `reopened`                                                                                                               | one review of the head commit                                                                                                                                           |
| `issue_comment` starting with `@happy-on-duty scan` or `@happy-on-duty review` (or the aliases `/happy scan`, `/happy review`), from an owner, member or collaborator | a fresh review, forced for a trivial pull request and published even if it would be skipped; incremental when a previous review exists, `review full` forces a full one |
| `pull_request` `synchronize` (a new push)                                                                                                                             | ignored on purpose: review once when the PR is ready                                                                                                                    |
| drafts, repositories outside `HAPPY_ALLOWED_REPOS`, fork authors outside `HAPPY_ALLOWED_AUTHORS`                                                                      | ignored                                                                                                                                                                 |

The webhook controller verifies `X-Hub-Signature-256` over the raw body with a constant-time compare, enqueues a BullMQ job (`REDIS_URL`) and answers `202`. The job id is repository + pull request + head commit, so a redelivery is one job. A worker (concurrency 1) runs the review and publishes the check. Before publishing it re-reads the pull request and skips if it is closed, merged, or its head is no longer the reviewed commit. A pull request that Happy skips (trivial, docs only, too large) gets no check unless a collaborator asked with a command.

## Commands

A command is the first non-blank text of a comment on a pull request, in any letter case: `@happy-on-duty scan`, `@happy-on-duty review`, `/happy scan` or `/happy review`. Text after it is allowed. A command inside a code block, inline code or a quote does not trigger anything. The mention handle is the constant `HAPPY_MENTION_HANDLE` (default `happy-on-duty`); the GitHub App `happy-for-ratingo` still does the work and publishes the check run.

`/happy review` is smart: when Happy has already reviewed an earlier commit of the pull request and that commit is still an ancestor of the head, it reviews only the new commits and reports what happened to its earlier findings. `/happy review full` (also `@happy-on-duty review full`, `scan full`) always reviews the whole pull request.

An explicit command reviews a trivial pull request that would otherwise be skipped. It does not lift the `too_large` skip, and docs-only pull requests stay skipped.

## Internal API for Veronica

Veronica (`apps/ai/veronica`) asks Happy about pull requests over the Railway private network (`http://happy.railway.internal:8080` on Railway, where `PORT` is set by the platform). Happy listens on `::` for that. The public hostname must keep serving only `/`, `/health` and `POST /webhooks/github`.

| Request                                       | Result                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/pull-requests/:number/review` | enqueues a review of the head commit (the same job as `/happy review`, published even for a trivial PR) and answers at once: `queued`, `already_running`, `already_reviewed`, `skipped` with `reason` (`closed`, `merged`, `untrusted_fork`) or `not_found`. Optional body `{"mode": "auto" \| "full"}`, default `auto`; anything else is 400 |
| `GET /internal/pull-requests/:number/review`  | `not_found`, or `found` with `headSha`, `reviewPending` and `result` (status, voice line, summary, finding counts by severity, questions, coverage, the commit it was for, `current`, check-run URL, and `review` with `mode`, `baseSha`, `fullReason`, `files` and `statusCounts`) or `null`                                                 |
| `GET /internal/pull-requests`                 | `ok` with up to six open pull requests, most recently updated first (number, title, author, `updatedAt`)                                                                                                                                                                                                                                      |

Auth is `Authorization: Bearer <HAPPY_SERVICE_TOKEN>`. Without `HAPPY_SERVICE_TOKEN` the API is disabled and answers 404, as it does to any request carrying a public proxy header (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`...). A wrong token is 401. The repository is the first entry of `HAPPY_ALLOWED_REPOS`.

Results are read back from the `Happy` check run of the commit. Its summary ends with a hidden `<!-- happy:result:v2 ... -->` marker (base64url JSON with the result, the reviewed commit, the scope and the tracked findings). The v1 marker is still read, as a result without tracked state; check runs published before any marker existed come back with status `unknown`. The last marker in the summary wins. Only check runs created by Happy's own GitHub App are read. No database is involved.

## Incremental review

State lives only in the hidden marker of the `Happy` check run (see below), so there is no database.

| Situation                                                                               | Mode        | What the summary says                                   |
| --------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| a complete earlier review exists and its commit is an ancestor of the head              | incremental | «Переглянув нові коміти abc1234..def5678 (3 файли)»     |
| no earlier review is found (first review, or the old commit left the PR after a rebase) | full        | «Повне рев’ю: попереднього рев’ю … не знайдено»         |
| the history diverged (force-push) or went behind                                        | full        | «Повне рев’ю: історію гілки переписано …»               |
| the GitHub compare failed                                                               | full        | «Повне рев’ю: GitHub не віддав порівняння …»            |
| the earlier marker is untrusted or has no tracked state (published before v2)           | full        | «Повне рев’ю: стан минулого рев’ю не вдалося прочитати» |
| the earlier review was incomplete (stopped early, coverage gaps)                        | full        | «Повне рев’ю: минуле рев’ю було неповним»               |
| a full review was asked (`/happy review full`, `mode: "full"`)                          | full        | «Повне рев’ю: повне рев’ю запросили явно»               |

In incremental mode the model sees only the diff of the new commits (limited to files still in the pull request); the whole pull request stays available as read-only context through the tools. A new finding must be on a line the new commits changed. When the new commits touch only ignored files, no model is called.

Each earlier open finding gets a status in the summary and in the marker:

- ✅ resolved: its file was touched and the code excerpt is gone;
- ⚠️ still open: the excerpt is still there and the new commits did not change the lines around it;
- ❓ needs re-check: the lines around it changed, or the file could not be read; the model gives a verdict in the same run, and a finding without a verdict stays ❓;
- 🆕 new.

The summary shows the counts, the full current list and the resolved ones once. Resolved findings leave the tracked state after that. A full review sends every earlier finding to the model as ❓.

## Check title voice

Happy speaks in one line, only in the check title and the first line of the check summary. Findings, questions and coverage notes stay factual. All lines live in `src/modules/review/domain/constants/check-voice.constants.ts`.

| Situation                           | Line                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| nothing found, coverage complete    | Периметр чистий. Проходь.                                     |
| any critical finding                | Стоп. Так далі не поїде.                                      |
| any major finding                   | Затримую на вході: є що виправити.                            |
| coverage gap (no critical or major) | Оглянув не все: ось що пропустив.                             |
| only minor or nit findings          | Пропускаю, але дещо записав.                                  |
| only questions                      | Маю питання до водія.                                         |
| trivial pull request, no command    | Цей сам доїде, огляд не потрібен.                             |
| too large                           | Вантаж завеликий для одного огляду. Розбий на кілька заїздів. |
| release checklist                   | Список вантажу на виїзд.                                      |
| daily budget exhausted              | Зміна закінчилась. Завтра огляну.                             |

Other skip reasons keep the plain title `Пропущено: <reason>`.

Pull requests from `development` into `main` get a release checklist instead of a code review: migrations in the diff (with risky statements flagged), new environment variable names, changed apps and packages, dependency changes. It is plain code over the diff, with no model call and no cost.

## Precision gates

- **Evidence.** Every finding carries `evidence {path, line, excerpt}`. The file is read at the head commit and the finding is kept as a finding only if that line contains the excerpt (at least 8 non-space characters, or the whole line). Otherwise it is demoted to a question.
- **Check catalog** (`agent/checks/<area>/<id>.md`, 12 checks mined from Ratingo's own fix history). Each file has frontmatter (`id`, `paths` globs, `triggers` regexes over added diff lines, optional `rule` as `file.md#Heading`, `severity_cap`) and six short sections: what to verify, evidence required, report only when, do not report, a real bug, a looks-risky-but-fine case. Code selects checks deterministically from the changed paths and added lines (`domain/policies/check-selector.ts`, at most 5 per PR, bodies sorted by id so the prompt prefix stays cacheable); the `fast` model may add at most 2 more from the same list, each citing a changed file. A referenced repository rule section is read from the base branch and appended; if it does not exist yet the check stands on its own text and the review logs that. Findings carry `checkId`; a finding naming an unselected check is dropped and severity is lowered to the check's cap. The catalog is validated with zod at boot, so a broken check fails the deploy. The counter `app.ai.happy.check.events` has `check_id` and `outcome` (`selected`, `finding`, `question`) labels, limited to catalog ids.
- **Report gate** in `agent/prompts/review.md`: changed-code evidence, a concrete failure scenario, try to disprove it, missing context is not a defect, one root cause is one finding.
- **Precedents** (`domain/policies/precedents.ts`), decided on structured fields (topic, category, path, cited line), never on message text: environment variables are trusted, no denial-of-service advice, React XSS only with `dangerouslySetInnerHTML`, nothing in Markdown files, no security or performance findings in test files.
- **Questions.** Unproven findings are shown as "Питання до автора", separate from findings and capped at 5.
- **Coverage honesty.** Truncated listing, a stopped run, a failed tool call, an unreadable evidence file or a file list instead of diffs add a "Покриття неповне" section that lists the files not reviewed carefully. With a gap Happy never writes "Зауважень немає".
- **File priority** (`domain/policies/file-priority.ts`, tiers in `domain/constants/file-priority.constants.ts`). Before triage the code ranks the reviewable files into tiers: files hit by a selected check (paths and triggers), domain code, application code, infrastructure and migrations, config and DI modules, tests and fixtures, then manifests, docs and generated files. Inside a tier new files come first, then more changed lines, then path. The `fast` model sees the tier of each file and may only reorder files inside a tier. The careful set takes the ranked list up to 40 files; check and domain files are always taken, and lower tiers stop being added once the focus files pass 1500 changed lines, so they cannot push the diff out of the prompt. The "not reviewed carefully" list uses the same order.
- **Size guard.** Above 1500 changed lines or 120k characters of diff in the focus files the prompt carries only the file list with changed line ranges and the model reads files with tools. Above 6000 changed reviewable lines the pull request is skipped as `too_large`.
- **Prompt caching.** The Anthropic adapter sets a request-level cache breakpoint plus breakpoints on the system prompt and the last tool, so system, rules, cards and the diff in the first message are a cached prefix across agent-loop turns. Each finished run logs `cacheReadTokens` and `cacheWriteTokens`. Check a real run: after the first turn `cacheReadTokens` must be above 0 (`railway logs`, event `ai.run.finished`).

## Setting up the GitHub App

Permissions (nothing else): **Contents: read, Pull requests: read, Issues: read, Checks: write, Metadata: read**. Events: `pull_request`, `issue_comment`. GitHub requires Issues: read for the `issue_comment` event; without it the manifest is rejected with "Default events are not supported by permissions: issue_comment".

1. Deploy the Railway service first so it has a public URL (see the variables below; the service will not start without the App variables, so set placeholders and update them in step 5).
2. Serve the manifest page locally and open it:

   ```bash
   cd apps/ai/happy/github-app && python3 -m http.server 8787
   ```

   Open `http://localhost:8787/create-app.html`, enter the public URL of the Happy service and press the button. GitHub shows the app with the manifest values (`github-app-manifest.json`); confirm. Create it under the account that owns the repository.

3. GitHub redirects to the repository with `?code=...` in the address. Within one hour exchange it (the response contains the app id, the private key and the webhook secret; do not paste them anywhere public):

   ```bash
   curl -s -X POST https://api.github.com/app-manifests/CODE/conversions
   ```

4. Install the app on the `eurusik/ratingo` repository only (Settings, Developer settings, GitHub Apps, Install App, Only select repositories).
5. Set the Railway variables below and redeploy. In the app's Advanced tab the recent deliveries should show `202`.

Test: open a non-draft pull request with a few code changes, or comment `@happy-on-duty scan` on one. A check named `Happy` with a neutral result appears within a minute or two.

## Profile and avatar

`github-app/avatar.png` is the badge for Happy. Upload it in two places:

- the GitHub App `happy-for-ratingo`: Settings, Developer settings, GitHub Apps, Edit, Display information, Upload a logo;
- the machine account `happy-on-duty`: Settings, Public profile, Profile picture.

The machine account exists only so Happy can be tagged. It has no token in Railway and runs nothing; the App does the work.

## Railway variables

Names only; values are secrets or per-environment.

| Variable                                                    | Purpose                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `PORT`                                                      | HTTP port (default 3005)                                                                    |
| `REDIS_URL`                                                 | BullMQ queue and the durable daily spend counter                                            |
| `GITHUB_APP_ID`                                             | numeric app id                                                                              |
| `GITHUB_APP_PRIVATE_KEY`                                    | the PEM private key; newlines may be written as `\n`                                        |
| `GITHUB_WEBHOOK_SECRET`                                     | webhook secret, at least 16 characters                                                      |
| `GITHUB_API_URL`                                            | optional, GitHub Enterprise only                                                            |
| `HAPPY_ALLOWED_REPOS`                                       | comma-separated `owner/repo` list                                                           |
| `HAPPY_ALLOWED_AUTHORS`                                     | optional, fork authors that may be reviewed                                                 |
| `HAPPY_MENTION_HANDLE`                                      | optional, login that commands mention (default `happy-on-duty`)                             |
| `HAPPY_SERVICE_TOKEN`                                       | optional, bearer token of the internal API for Veronica (24+ characters); unset disables it |
| `AI_MODEL_FAST`, `AI_MODEL_REVIEW`                          | model refs; default `stub:...` runs no real model                                           |
| `ANTHROPIC_API_KEY`                                         | required when a model ref is `anthropic:...`                                                |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | telemetry                                                                                   |

Keep one replica: the worker runs one job at a time and the budgets (`$0.60` per run, `$3` per day) are counted per service.

## Local use

```bash
npm run review --workspace=@ratingo/ai-happy -- owner/repo 123
```

The CLI keeps using a personal access token (`GITHUB_TOKEN`) and never publishes anything.

## Eval set

`eval/` holds 36 labelled cases and 4 incremental ones (`eval/incremental-cases.ts`): 12 base cases (5 real defects, 4 protected negatives that look risky but are guarded, 3 unknown cases that should become questions) and, for every check in the catalog, one real bug and one looks-risky-but-fine fixture trimmed from the commits that fixed or justified them (`eval/check-cases`, each cites its `source`). A jest spec fails CI if a check lacks either fixture, if its frontmatter is invalid or if the selector would not pick the check for its own fixtures and a scorer for precision, recall, false positives on protected negatives and the share of unknown cases answered with a question.

```bash
npm run eval --workspace=@ratingo/ai-happy
```

On the default stub model this only checks the structure (the structure is also checked by the unit tests `eval/catalog.spec.ts` and `eval/cases.spec.ts`, which CI runs). For a real run, which costs a few cents and is manual:

```bash
AI_MODEL_FAST=anthropic:claude-haiku-5-5 AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5 ANTHROPIC_API_KEY=... npm run eval --workspace=@ratingo/ai-happy
```

The incremental cases run a review with a previous result and a new commit: a fix commit resolves a finding, an unrelated commit keeps it open, a new bug appears in the new commit, and a force-push falls back to a full review. The run prints `incremental cases with a deterministic outcome` (mode, reason and finding statuses decided without a model; 4/4 expected, also with the stub) and `incremental cases where the new bug was found` (needs a real model; 0/1 with the stub).

Compare the numbers with the previous run before changing a prompt, a card or a precedent.
