# Designing the flow

Read this when the user describes a manual process and wants a schedule. Output rules live in `SKILL.md`; this file is the judgment.

## Intake: six slots

Fill all six from what the user said. Ask about at most two gaps, then proceed with defaults and say so.

| Slot | Fill with | Default when unstated |
|---|---|---|
| **Trigger** | Cadence, local time, days, time zone | Weekdays at 08:00 in the user's time zone |
| **Source** | System, container (list, table, folder, mailbox), key fields, rough volume | SharePoint list, under 1,000 rows |
| **Transform** | What changes between source and output, and every decision | Direct pass-through, no transformation |
| **Output** | Who receives what, where, in which format | Email to the requester, one per run |
| **Failure** | What must never happen twice, who must hear about failure, what may be skipped | Marker in SharePoint, Teams alert to the owner |
| **Constraints** | License, premium blockers, personal data, deadlines, owner | Microsoft 365, free connectors, no personal data |

Volume matters more than it looks. It picks the loop limit, the pagination setting, and whether the design needs a child flow.

## Manual step to flow construct

| The user says | Build |
|---|---|
| "Every morning", "each Monday", "hourly" | `Recurrence` trigger |
| "When a row changes" | An event trigger, not a schedule. Polling burns budget; an event trigger is instant and free |
| "If the invoice is overdue" | `Get items` with an OData filter at the source |
| "For each invoice" | `Apply to each` |
| "If amount is over 10k" | `Condition` |
| "Depending on the category" | `Switch` |
| "Wait for my manager" | `Start and wait for an approval`; see P13 for waits that can outlive a run |
| "Chase them until they answer" | `Do until` plus `Delay`, with an iteration cap |
| "Attach the PDF" | `Get file content` plus an attachment field |
| "Tell me when it breaks" | `Scope` plus a run-after branch plus Teams |
| "Don't send it twice" | A duplicate guard from `patterns.md` P3 |
| "Skip holidays" | A date list plus a `Condition`; recipe in P5 |
| "Write the result down" | SharePoint `Create item` or `Update item` |

Shape rules:

- Filter at the source. Every action inside `Apply to each` multiplies by the item count and burns the Low budget.
- One loop per source. Nested loops are a nesting-depth and budget risk.
- Above about 20 actions, split into a parent and child flow, or into phases. The 500-action limit is not the real constraint; readability and cost are.

## Trigger selection

| Need | Trigger |
|---|---|
| Fixed cadence | `Recurrence` |
| Fixed cadence plus a cheap skip rule | `Recurrence` plus trigger conditions (see `settings.md`) |
| Wait until a local time inside a run | `Delay until` with a UTC timestamp |
| Ad hoc or testing | `Manually trigger a flow` |
| React to a row or file | Event trigger, not `Recurrence` |

## Recurrence fields

| Field | Meaning |
|---|---|
| `Frequency` | Second, Minute, Hour, Day, Week, Month |
| `Interval` | Multiplier on frequency. Minimum interval 60 seconds, maximum 500 days. The license adds a wake-up gap, and a shorter interval is queued rather than run (see `settings.md`) |
| `Start time` | Anchor in `YYYY-MM-DDTHH:MM:SSZ`. An anchor in the past can make the trigger fire immediately, which is the usual cause of "it ran ahead of schedule" |
| `Time zone` | Named Windows zone. The offset in the label is display only. Pick the city or region that matches the business |
| `On these days` | Days of week when `Frequency` is Week |
| `At these hours`, `At these minutes` | Advanced. These combine, they do not pair up |
| `Month` | Runs on the same day of month as the anchor. Day selection is limited; last-day logic belongs in actions |

`At these hours` and `At these minutes` multiply. Hours `8,13` with minutes `0,30` gives four runs: 08:00, 08:30, 13:00, 13:30. State this when you use both.

### Common cadences

| Ask | Settings |
|---|---|
| Every 15 minutes | Minute, interval 15 |
| Hourly on the hour | Hour, interval 1, minutes `0` |
| Weekdays at 08:00 | Week, interval 1, Mon to Fri, hours `8`, minutes `0` |
| Monday 09:30 | Week, interval 1, Monday, hours `9`, minutes `30` |
| Every two weeks | Week, interval 2, anchored on the intended week |
| 1st of the month 07:00 | Month, interval 1, anchor on the 1st, hours `7`, minutes `0` |
| Daily at 06:00 and 18:00 | Day, interval 1, hours `6,18`, minutes `0` |
| Last business day | Daily trigger plus the gate in P6 |

## Free-connector state choices

The non-obvious ones. Everything else comes from the stack in `SKILL.md`.

| Need | Free choice | Why not the alternative |
|---|---|---|
| Store a marker or state | SharePoint list | Dataverse is premium |
| Store configuration (recipients, thresholds) | SharePoint list, or `Compose` in the flow | Environment variables are free, but trigger values still need a definition edit |
| Holiday list | SharePoint list of ISO dates | A hardcoded `Compose` array needs a flow edit for every new holiday |
| Alert | Teams chat or channel, or Outlook | `HTTP` is premium |
| Approval | Approvals connector | A custom approval table is work with no gain |
| Read a mailbox | Office 365 Outlook | Graph `HTTP` calls are premium |

If the requirement truly needs premium, say it once in Constraints, name the connector, and offer the free approximation. The steps stay free.

## Time zones and DST

- `utcNow()` is UTC. Convert before comparing dates, or a run at 23:30 local sees tomorrow.

```text
Local date   ->  @formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd')
Local time   ->  @formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'HH:mm')
```

- Every dropdown entry is a Windows zone. The offset in the label is display only; what matters is the DST rule. `UTC` never shifts, a city zone does.
- A daily run between 01:00 and 03:00 local can be skipped when clocks spring forward and can run twice when they fall back. Keep the slot outside that window, or make the run idempotent.
- `Start time` is a UTC-shaped string read together with the time zone field. An anchor in the past fires on save.

## Date and time expressions

| Need | Expression |
|---|---|
| UTC now | `@utcNow()` |
| Local now | `@convertFromUtc(utcNow(), 'Central European Standard Time')` |
| Local date key | `@formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd')` |
| Add days | `@addDays(utcNow(), 7)` |
| Add negative days | `@addDays(utcNow(), -1)` |
| Same day next month | `@addMonths(utcNow(), 1)` |
| First of this month | `@startOfMonth(utcNow())` |
| Local 09:00 as UTC | `@convertToUtc(concat(formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd'), 'T09:00:00'), 'Central European Standard Time')` |
| Empty array | `@empty(outputs('Get_items')?['body/value'])` |
| Row count | `@length(outputs('Get_items')?['body/value'])` |

`convertFromUtc` and `convertToUtc` take Windows zone names, the same strings the trigger dropdown uses. Weekday gates and month-end arithmetic live in `patterns.md` P5 and P6.

## Splitting flows

Split when any of these is true:

- Different cadence.
- Different owner or audience.
- One part may be retried without repeating the other.
- Above about 20 actions.
- A failure in part A must not block part B.

A child flow is free, solution-aware, and callable with `Run a child flow`.
