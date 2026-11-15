# Patterns

Recipes for the four properties of a safe flow: contain, continue, report, idempotent. Every pattern uses free connectors unless it says otherwise.

## P1. One bad item must not end the run

Use when: `Apply to each` writes, sends, or updates per item.

1. Inside the loop, add a `Scope` named `Try item`.
2. Move the risky actions into it.
3. After the scope, still inside the loop, add `Log item failure`.
4. On `Log item failure`, `Settings` > `Run After`: tick `has failed` and `has timed out`.
5. Inside it, append the item key to an array variable, or `Create item` in a `Flow failures` list.
6. After the loop, add a `Condition` on the failure count. If above zero, alert with the count and the keys.

Why it works: the failure is handled inside the iteration, so the loop moves to the next item instead of failing the whole `Apply to each`.

Put `Terminate` outside the loop. Inside, it ends the flow, not the iteration.

If the loop writes in order, keep `Apply to each` concurrency at `1`. Raising it reorders writes and makes failures harder to attribute.

## P2. Catch the whole flow and report it

Use when: the flow has more than a couple of actions, or silence would be mistaken for success.

1. Wrap the main work in a `Scope` named `Try`.
2. After it, add a `Scope` named `Catch`.
3. On `Catch`, `Settings` > `Run After`: tick `has failed` and `has timed out`.
4. Inside `Catch`, add these actions.

```text
Compose Failed actions   ->  @filter(result('Try'), equals(item()?['status'], 'Failed'))
Compose Failure names    ->  @join(select(outputs('Failed_actions'), item()?['name']), ', ')
Compose Alert text       ->  @concat('Flow failed at ', formatDateTime(utcNow(), 'yyyy-MM-dd HH:mm'), ' UTC. Actions: ', outputs('Failure_names'))
Post message in Teams    ->  @{outputs('Alert_text')}
```

5. Optional, after the alert: `Terminate` with status `Failed`, so the run does not look green.
6. If `Catch` also fails, the run fails. That is acceptable; the alert is the last line of defense.

`result('Try')` returns the top-level action results inside the scope. It does not resolve nested loops beyond their own result entry.

## P3. A side effect happens once

Use when: the flow sends, creates, updates, approves, or pays, and can retry, overlap, or be resubmitted.

Pick the first guard that fits:

| Situation | Guard |
|---|---|
| The work recomputes or overwrites the same record | Nothing extra. Say why the repeat is harmless |
| One run at a time is enough | Trigger concurrency `On`, degree `1` |
| Another flow, a resubmit, or a manual run can overlap | Marker with a unique index, below |
| Several business items per run | One key per item, not one per run |

Keys must include the business key, not just the date. A daily run that handles 50 invoices needs 50 keys.

### Marker with a check (simple)

Store markers in a SharePoint list `Flow markers` with `RunKey` (single line), `Created` (date), `Status` (choice).

1. Before the side effect, `Compose` a key that is stable across re-runs.

```text
Run key     ->  @concat(formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd'), '-overdue-invoices')
With item   ->  @concat(formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd'), '-', items('Apply_to_each')?['ID'])
```

2. `Get items` from `Flow markers`, `Top Count` 1, filter query:

```text
@concat('RunKey eq ''', outputs('Run_key'), '''')
```

3. `Condition`: `@equals(length(outputs('Get_items')?['body/value']), 0)`. If true, do the work.
4. After a successful side effect, `Create item` with the same key.

Check-then-act is not atomic. Two overlapping runs can both pass step 3, so pair this with concurrency `On` degree `1`, or use the unique index.

### Marker with a unique index (atomic)

1. `Flow markers` > `RunKey` column settings: `Enforce unique values` = Yes, `Require that this column contains information` = Yes. The list creates a unique index on the column and rejects a second row with the same key.
2. Before the side effect, `Create item` with `Status` = `Claimed`. A second run's insert fails, so only one run proceeds.
3. Add a `Terminate` with status `Cancelled` directly after that `Create item`. On the `Terminate`, `Settings` > `Run After`: tick `has failed` only. The losing run ends quietly.
4. After the side effect, `Update item` the same row to `Status` = `Sent`.

The tradeoff, and you must state it:

- **Mark after send** can duplicate if the run dies between the send and the marker write, or if the send times out after delivery. A timed-out send is not proof of non-delivery: check Sent Items before resubmitting.
- **Claim before send** can lose the send if the run dies between claim and send. The claim row then blocks that key.

Claim before send needs a stale-claim sweep, and what the sweep does decides the failure mode:

- **Delete** the stale row. The key frees, so a resubmit can send, but a duplicate is possible if the original send landed. Favours not missing.
- **Set `Released` and alert a human.** The row and its key stay, so the send is lost until someone clears the row and resubmits. Favours not duplicating.

The sweep never sends anything by itself. Say which failure mode you chose, and who acts on the alert.

A duplicate-key failure and a broken insert look the same in run history: both end `Cancelled`. Read the error. If a silent drop is unacceptable, add a `Get items` on the same key after a failed claim: a row means another run owns it, no row means a real error, so alert.

`Enforce unique values` applies to simple column types such as single line of text. Set it before duplicates exist; enabling it fails if duplicates are already present. Test the rejection once by inserting the same key twice in a manual run.

## P4. Retries without duplicates

Use when: an action throttles or times out and the user wants retries.

- Best: retry policy `None` plus the P3 guard. The re-run checks the marker instead of blindly repeating.
- If the action must retry, keep the retry policy and guard the action with a marker. A retry after a partial success is exactly the duplicate case.
- Retry policy `None` on every send, post, create, and update unless there is a guard.
- A send that failed or timed out may already have been delivered. Check Sent Items before resubmitting.
- A `Do until` retry loop is worth it only when the failure is a known transient code you can test with a `Condition`. Otherwise it hides errors.

## P5. Skip weekends and holidays

Use when: the cadence is weekdays, or the business calendar matters.

1. `Compose Today local`.

```text
@formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd')
```

2. `Compose Holidays` with ISO dates, or `Get items` from a holiday list filtered to this year.
3. `Condition`: holiday or weekend.

```text
Is holiday       ->  @contains(outputs('Holidays'), outputs('Today_local'))
Is weekend       ->  @or(equals(dayOfWeek(outputs('Today_local')), 0), equals(dayOfWeek(outputs('Today_local')), 6))
Skip today       ->  @or(outputs('Is_holiday'), outputs('Is_weekend'))
```

`dayOfWeek` returns 0 for Sunday through 6 for Saturday.

4. If true, `Terminate` with status `Cancelled`. Cancelled is visibly different from failed.

Schedule a daily trigger and let the gate decide. The trigger cannot compute a holiday.

## P6. Last business day

Use when: month-end reporting or billing.

1. Compose the local date pieces.

```text
Local now          ->  @convertFromUtc(utcNow(), 'Central European Standard Time')
Today              ->  @formatDateTime(outputs('Local_now'), 'yyyy-MM-dd')
Last day           ->  @addDays(startOfMonth(addMonths(outputs('Local_now'), 1)), -1)
Last business day  ->  @if(equals(dayOfWeek(outputs('Last_day')), 6), addDays(outputs('Last_day'), -1), if(equals(dayOfWeek(outputs('Last_day')), 0), addDays(outputs('Last_day'), -2), outputs('Last_day')))
Run today?         ->  @equals(outputs('Today'), formatDateTime(outputs('Last_business_day'), 'yyyy-MM-dd'))
```

2. Schedule the flow daily at the hour the report is due.
3. `Condition`: today equals `Last business day`. If false, `Terminate` `Cancelled`.
4. If today is a holiday, apply P5. Decide and state which behavior the user wants: "last business day" or "last calendar day, rolled forward".

## P7. Overlap

Use when: the run can take longer than the interval.

1. Measure: run history shows the run duration. If duration is close to the cadence, overlap is guaranteed.
2. Pick one:
   - `Concurrency control` `On`, degree `1`. Clean, but a one-way door: turning it off again means deleting and re-adding the trigger.
   - A marker from P3.
   - Prove the work is idempotent, for example "recompute and overwrite the same row". Then overlap is harmless, and you say why.
3. State the choice. Off means unlimited concurrent runs.

## P8. Test without waiting

- `Test` > `Manually` with a source filter that matches one row.
- `Testing` tab on the side-effecting action > `Enable Static Result`. The flow treats it as successful and skips the real send.
- Static result can also mock a failure code, which is the only sane way to test `Catch`.
- A temporary `Minute` interval for five minutes, then revert.
- `Resubmit` a failed run after fixing the flow. It replays the original inputs, so it ignores source changes made since, and it repeats every side effect that already succeeded.

## P9. Wait until a local time

Use when: the run starts early, or a step must happen after a fixed local hour.

```text
Delay until   ->  @convertToUtc(concat(formatDateTime(convertFromUtc(utcNow(), 'Central European Standard Time'), 'yyyy-MM-dd'), 'T09:00:00'), 'Central European Standard Time')
```

A timestamp in the past returns immediately, so this delays, it does not schedule. Use it inside a run, not instead of `Recurrence`.

## P10. Nothing to do

Use when: an empty source would produce an empty report or a blank email.

```text
No rows   ->  @empty(outputs('Get_items')?['body/value'])
```

If true: `Terminate` `Cancelled`, or post a short "nothing due today" message. Choose one and say which. A silent run is acceptable only when someone monitors the absence of a message, which nobody does.

## P11. Child flow

Use when: the same work appears in several flows, or one item's failure must be fully isolated.

- Child flows require a solution. `Run a child flow` is free.
- A child flow failure still surfaces as a failed action in the parent, so the parent needs P1 or P2.
- Good for a shared "notify owner" or "write audit row" routine.

## P12. Failure summary a human can act on

Include three things in every alert:

1. Flow name.
2. Local time of the failure.
3. The failed action names, or the failed item keys.

Skip fragile run URLs. Tell the user to open run history and find the run by time, or paste the run link from there once.

## P13. Approval that outlives the run

Use when: an approval may sit for weeks.

A run lives 30 days. When the run times out, a pending approval goes with it, and a `Do until` cannot extend the run.

- Free: finish inside 30 days. Chase the approver from Teams or the Approvals app, and set that expectation before building.
- Premium: store approvals in Dataverse. A later flow can then act on a response after the original run has timed out.
- When the business process routinely takes longer than 30 days, say so in Constraints before building.

## P14. Hundreds of rows in one run

Use when: `Apply to each` writes more than a few hundred rows to Excel, or the key list has outgrown the 5,000-item pagination cap. At two actions per row, 2,000 rows is 4,000 requests; two runs a day is 8,000 before reads. The Excel connector also throttles at 100 calls per 60 seconds per connection.

1. Put a `Run script` on the source workbook. Read the table with `getRangeBetweenHeaderAndTotal().getValues()`, filter in TypeScript, and return the rows as one text payload.
2. Put a `Run script` on the destination workbook. Parse the payload, read the key column, drop blank keys and keys already present, then `addRows` once and write the batch with one `setValues`. Return the appended, skipped, and failed counts plus the failed keys.
3. Map the first script's `result` into the second script's parameter. After the second, send one email with the counts and keys.
4. Wrap both scripts in the P2 `Try`/`Catch`, and keep trigger concurrency at `1`. The scripts remove the gap between two flow actions, not the race between two runs.

Why it works: one connector call per workbook replaces one per row, so the 100 calls per 60 seconds throttle, the 5,000-item pagination cap, and most of the request budget disappear. A timed-out script may have written before it failed; the dedupe makes the next run or a retry finish the job instead of duplicating it.

Catch per row inside the script and return the failed keys. A thrown error fails the whole batch, which breaks the per-item isolation that P1 gives you.

Limits: 120 seconds, 5 MB per request or response, 30 MB per parameter, 1,600 calls per user per day (`settings.md`). Pass only the columns the destination needs. `Run script` reads the script from the maker's OneDrive; `Run script from SharePoint library` keeps a team flow's script with the site. If both tables are in one workbook, one script can read, dedupe, and write.
