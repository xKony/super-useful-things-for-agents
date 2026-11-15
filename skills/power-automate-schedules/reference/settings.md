# Settings reference

Every knob the user must set, and every limit that decides whether the design works. Verified 2026-11-15 against the pages in `sources.md`. This file is the single home for the numbers.

## Trigger settings

| Setting | Where | Default | What to do |
|---|---|---|---|
| **Concurrency control** | Trigger > Settings | **Off** | Off means **unlimited concurrent runs**. Turn on with degree 1 to 100 (default 25) when overlap would duplicate work. Turning it on is a one-way door: undoing it means deleting and re-adding the trigger |
| **Trigger conditions** | Trigger > Settings | Empty | Cheap skip rule, evaluated before actions run. A filtered run shows as skipped and costs almost nothing |
| **Split on** | Trigger > Settings | Off | For array-returning event triggers, not `Recurrence`. Ignore for schedules |
| **Start time** | Parameters | None | Set it. A past anchor is the classic cause of "it runs at the wrong time" |
| **Time zone** | Parameters | Creator's zone | City or region zone, not `UTC`, when business time is local |

Concurrency details:

- Off: unlimited concurrent runs, and the waiting-run queue does not apply.
- On: 1 to 100 concurrent runs, default 25. Waiting runs allowed are 10 plus the degree.
- `Apply to each` has its own concurrency setting: default **1**, maximum **50**.
- If a schedule can overlap and the work is not idempotent, prefer concurrency **On, degree 1**. Otherwise use a marker (`patterns.md` P3). State the choice.

Trigger conditions:

- New designer: select the trigger > `Settings` tab > `Trigger conditions` > `Add`.
- Classic designer: trigger `...` > `Settings` > `Trigger conditions`.
- Write the expression with a leading `@`. If the field rejects it, retype without the `@`.
- This is the correct home for weekday and business-day gates. Trigger **inputs** freeze expressions at save time; trigger **conditions** are evaluated per event.
- A filtered run appears in run history as a skipped trigger check.

## Action settings

| Setting | Where | Default | What to do |
|---|---|---|---|
| **Action timeout** | Settings > General | Connector-defined | Cap long waits. It does not extend the 120-second synchronous request limit |
| **Retry policy** | Settings > Networking | Exponential | Set `None` on anything with a side effect |
| **Run after** | Settings > Run After | Success only | The only mechanism for catch branches and per-item isolation |
| **Secure inputs**, **Secure outputs** | Settings > Security | Off | On for tokens, salaries, personal data, anything visible in run history |
| **Static result** | Action > Testing tab | Off | Mock success or a failure code while testing |
| **Pagination** | Settings > Pagination | Off | On for large lists and tables. It multiplies action counts |
| **Chunking** | Settings > Content transfer | Off | On for files between 100 MB and 1 GB |

### Retry policy defaults

| Profile | Default retries | Shape |
|---|---|---|
| Low (Free, Microsoft 365, Plan 1) | 2 | Exponential |
| Medium/High without premium connectors | 8 | Exponential |
| Medium/High with premium connectors | 12 | Exponential |

Hard caps: 90 retry attempts, minimum delay 5 seconds, maximum delay 1 day.

Set `None` on: `Send an email`, `Post message`, `Create item`, `Update item`, `Start and wait for an approval`, and any other write or send. A retried send is a duplicate send, and a default policy can keep retrying for an hour. Idempotent reads can keep the default.

If the user wants retries on a side-effecting action, guard it with a marker, or wrap it in a `Do until` with a small cap and a `Delay`.

### Run after

Available outcomes: `is successful`, `has failed`, `is skipped`, `has timed out`.

- Catch branch: failed plus timed out.
- Continue after an optional step: add skipped.
- Per-item isolation: failed plus timed out on the logging action inside the loop.

Run after is per action and applies to the actions directly before it in the same container. It becomes a whole-flow try/catch only when the work sits inside a `Scope`.

## Flow-level settings

| Thing | Behavior | What to do |
|---|---|---|
| **Owner** | The flow uses the owner's license profile. If the owner leaves the org, the flow reverts to Low | Use a service account, or at minimum add a co-owner |
| **Connections** | A `Recurrence` flow runs on the maker's connections, not the viewer's | State whose account the mail and files come from |
| **Sharing** | Run-only vs edit access | Share run-only unless the person must maintain it |
| **Environment** | DLP policies can suspend a flow | If it will not save or run, check DLP first |
| **Solution** | Needed for child flows, connection references, and deployment | Recommend a solution once the flow is more than a personal script |
| **Environment variables** | Free, but trigger values cannot be parameterized in the designer without editing the definition JSON | Use one flow per environment, or accept a manual edit |

## Limits that decide the design

| Limit | Value | Notes |
|---|---|---|
| Actions per flow | 500 | Above roughly 20, split for readability and cost |
| Nesting depth | 8 | Child flows reset the count |
| Variables per flow | 250 | Prefer `Compose` over variables where possible |
| Minimum recurrence | 60 seconds | Below that, use a different mechanism |
| Recurrence wake-up gap | 5 minutes on Microsoft 365 and Dynamics 365 plans, 15 minutes on Free | A recurrence that fires sooner is queued, not run, so a 1-minute schedule behaves like 5 |
| Maximum recurrence interval | 500 days | |
| Run duration | 30 days | Includes a pending approval, which is lost when the run times out |
| Run retention in storage | 30 days | The UI shows a 28-day run history |
| `Apply to each` array items | 5,000 Low, 100,000 others | Filter at the source |
| `Apply to each` concurrency | 1 to 50, default 1 | Per loop, separate from trigger concurrency |
| Paginated items | 5,000 Low, 100,000 others | |
| `Do until` iterations | 60 default, 5,000 max | Always set a cap |
| Message size | 100 MB, 1 GB with chunking | |
| Synchronous outbound request | 120 seconds | Use async polling or `Do until` for longer work |
| Requests per 5 minutes | 100,000 | Per flow version |
| Requests per 24 hours | 10,000 Low, 200,000 Medium, 500,000 High | Transition-period figures |
| Concurrent outbound calls | 500 Low, 2,500 others | |

One action execution is one request. Failed actions, retries, and pagination requests also count. Individual connectors usually have tighter limits than the platform, so check the connector page when a flow is busy.

The 10,000 / 200,000 / 500,000 figures are **transition-period** limits. Enforcement for cloud flows under user licenses phases in starting April 2027; after that a user's flows share the user's action limit, so splitting work across more flows does not add capacity.

### Budget arithmetic for Low

| Cadence | Runs per day | Actions per run inside 10,000 requests |
|---|---|---|
| Every 5 minutes | 288 | about 34 |
| Every 15 minutes | 96 | about 104 |
| Every 30 minutes | 48 | about 208 |
| Hourly | 24 | about 416 |
| Daily | 1 | not binding |

If the estimate is close to the ceiling, cut actions, filter at the source, or reduce the cadence. Retries can blow through the estimate without showing up as extra runs.

### Office Scripts limits

`Run script` is part of the Excel Online (Business) connector, which is standard on Microsoft 365. Office Scripts needs a business Microsoft 365 license; E1 and F3 can run scripts from a flow but have no in-Excel integration. The flow runs the script as the connection owner, so the same ownership rule applies.

| Limit | Value | Notes |
|---|---|---|
| Synchronous timeout | 120 seconds | Split the script or chunk the rows |
| Request and response | 5 MB | Keep the payload under the smaller cap |
| `Run script` parameter | 30,000,000 bytes (28.6 MB) | Pass a text payload, not a wide table |
| `Run script` calls | 1,600 per user per day | Resets at 00:00 UTC |
| Range size | 5 million cells | One read or write |
| External calls | `fetch` is blocked | Scripts run outside your network |
| Workbook | 25 MB, `.xlsx` or `.xlsb` | ISO strict format fails |

At 2,000 rows, a per-row loop with a scope and a write is 4,000 requests per run. Two runs a day is 8,000, before reads. A batch script is one call per workbook.

Changing a script's parameters or return type means re-adding the `Run script` action. `Run script` reads the script from the maker's OneDrive; `Run script from SharePoint library` reads it from a site, which is the right choice for a team flow.

## Auto-suspension

| Condition | Consequence |
|---|---|
| Trigger or actions failing continuously for 14 days | Flow is turned off |
| No trigger activity for 90 days | Flow may be turned off. Premium and Process licenses are exempt |
| Consistently throttled for 14 days | Flow is turned off |

Owners and co-owners get a warning before inactivity suspension. Mention co-ownership when the flow matters.

## Licensing

| License | What it gives |
|---|---|
| Free | Cloud flows with standard connectors, without sharing |
| Microsoft 365 | Standard connectors, Low profile |
| Power Automate Premium | Premium and custom connectors, Microsoft Dataverse storage, higher request limits |

- The performance profile follows the **owner's** license, not the editor's or the viewer's.
- If the owner leaves the organization, the flow drops to Low, which changes both retry behavior and daily budget.
- A premium connector anywhere in the flow means every person who edits or manually runs it needs a premium license. Scheduled runs still use the owner's connections.
- To check a user's plan: `Settings` > `View My Licenses`. To check a connector: the connector list shows a `PREMIUM` badge.

Premium connectors and Dataverse are **not** part of Microsoft 365. A Dataverse table means a Power Automate Premium license, and the same applies to `HTTP`, SQL Server, and the rest of the premium list in `SKILL.md`.
