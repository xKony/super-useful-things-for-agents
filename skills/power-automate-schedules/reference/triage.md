# Triage

Diagnose in order of cost: the flow's state, its connections, and its run history before any rebuild. Ask for a screenshot only after the cheap checks fail.

Match the symptom, then read down the table. Row order is the order to check.

## It did not run at all

| # | Check | Fix |
|---|---|---|
| 1 | Flow is off | Turn it on |
| 2 | Trigger error banner: "There's a problem with the flow's trigger" | The service failed to register the trigger. Check IP allowlists, then edit and save the flow twice to force re-registration |
| 3 | DLP policy | If saving shows "disabled by your organization", the connectors are blocked. An admin must change the policy |
| 4 | Broken connection | `More` > `Connections` > `Fix connection`. An expired password or a token lifetime policy are common causes |
| 5 | Trigger condition | A run with a skipped trigger check means the condition was false. Review `Settings` > `Trigger conditions` |
| 6 | Premium connector without a license | `Details` > `Plan`. The connector list shows a `PREMIUM` badge |
| 7 | Throttling or budget | `Analytics` > `Actions` chart. Consistently throttled flows are turned off after 14 days |
| 8 | Inactivity | No trigger activity for 90 days can turn the flow off. Premium and Process licenses are exempt. Owners get a warning first |
| 9 | Time zone or start time | A wrong zone, or an anchor in the past, shifts every run |
| 10 | Environment URL changed | Edit and save each flow to re-register triggers |
| 11 | Wrong environment | The flow exists in another environment you are not looking at |

## It ran twice

| # | Check | Fix |
|---|---|---|
| 1 | Concurrency control off, which is the default, and the run lasts longer than the cadence | Overlapping runs. Set concurrency `On`, degree `1`, or add a marker |
| 2 | The flow was turned off and on | A polling trigger processes the backlog, producing a burst. Delete and recreate if the backlog must not run |
| 3 | Retry policy duplicating an action | Set retries to `None` on sends and writes, or guard with a marker |
| 4 | Two copies in different environments | Disable one |
| 5 | A 02:xx local schedule on the DST fall-back day | Make the run idempotent, or move the slot |
| 6 | Manual resubmit | Expected. The marker is what makes it safe |
| 7 | Duplicate inputs from the source | Normal at scale. Idempotency is the fix, not a bug hunt |

## It ran late

| # | Check | Fix |
|---|---|---|
| 1 | Trigger wake-up gap | A recurrence trigger wakes at a license-dependent interval. On Microsoft 365, a run less than 5 minutes after the last one is queued; on Free, 15 minutes. A "9:00" run can start minutes later |
| 2 | Queue behind concurrency | With concurrency on, extra triggers wait or drop. Check waiting runs |
| 3 | Throttling | 429s or a busy connector. Reduce actions, slow the cadence |
| 4 | Previous run still going | Concurrency off does not queue, it overlaps |
| 5 | Service incident | `Help + support` for active outages |

The recurrence trigger is best-effort and can fire seconds early or late, by design.

## It ran but did nothing

| # | Check | Fix |
|---|---|---|
| 1 | Trigger condition false | The run shows as skipped |
| 2 | Source returned zero rows | Filter typo, wrong list, wrong view, permissions returning empty instead of erroring |
| 3 | Wrong property in the loop | `body` vs `body/value` |
| 4 | Condition inverted | Read the expression out loud |
| 5 | Action skipped by run-after | Check the run-after matrix on the skipped action |

## Green run, wrong outcome

| # | Check | Fix |
|---|---|---|
| 1 | Static result left on | `Testing` tab > disable static result |
| 2 | Secure outputs hiding evidence | Expected. Check the real destination, not the run history |
| 3 | Sent from the wrong identity | A recurrence flow runs on the maker's connections |
| 4 | Recipient list stale | State lives in a list or a `Compose`, not in someone's head |
| 5 | Approval never resumed | The run, and the pending approval, ended at 30 days |

## Failed, nobody knew

| # | Check | Fix |
|---|---|---|
| 1 | No catch branch | Add P2 from `patterns.md` |
| 2 | Retries still running | The default policy can retry for about an hour on higher profiles |
| 3 | Alert sent to a person | Send to a channel or shared mailbox |
| 4 | Catch branch itself failed | Keep the catch branch tiny: compose text, post message, terminate |
| 5 | Flow auto-turned off after 14 days of errors | Fix the root cause, then confirm alerts fire |

## Evidence

- Run history is the first place to look; a skipped trigger check and a failed action look different there.
- `Analytics` > `Actions` shows action volume, the fastest way to spot a budget or throttling problem.
- `Flow checker` catches structural errors before a save, including DLP violations.
