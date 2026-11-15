# Edge cases

Run this list against the spec, then surface **at most 3**, ranked by likelihood for this specific flow. A checklist dump is noise. Each row names when it applies, so most rows will not.

## Data

| Applies when | Risk | Guard |
|---|---|---|
| The source can be empty | Empty report, blank email, zero-row success | `Condition` on `empty(...)`, then `Terminate` `Cancelled` or a "nothing due" message |
| More than one page of rows is expected | Silent truncation, missed records | Filter at the source, set `Top Count`, turn pagination on, respect the loop limit in `settings.md` |
| Source rows can duplicate | Double processing | Distinct filter, or `union(collection, collection)`; marker keyed by business ID |
| Fields can be null | Expression errors, broken concat | `coalesce(field, '')`, `if(empty(...))` guards |
| A row can be deleted mid-run | `Get item` fails for that row | Per-item isolation (P1) |
| A column was added recently | The flow cannot see the new field | Remove and re-add the action, then save |
| Files can exceed 100 MB | Action fails on message size | Enable chunking up to 1 GB, or send a link instead of the file |
| A file may be locked, checked out, or open | Read fails | Retry once after a delay, or read from a copy |
| File names contain `#`, `%`, or `?` | URL encoding breaks the path | Encode, or reuse the path returned by a `Get files` action instead of building it |
| Excel is the store | Locked file, stale table, the key list hits the 5,000 paginated-item cap, a per-row append is slow and budget-heavy above a few hundred rows, no concurrency control | Read-only Excel, batch above a few hundred rows (P14), keep the key table under 5,000 rows or move it to SharePoint |

## Time

| Applies when | Risk | Guard |
|---|---|---|
| Local time falls between 01:00 and 03:00 | DST skip or double run | Move the slot, or make the run idempotent |
| Date comparisons use `utcNow()` near midnight | Off-by-one day | Convert to the local zone first |
| Month-end logic uses a fixed day number | The 31st does not exist in every month | Use `startOfMonth(addMonths(..., 1))` arithmetic |
| The cadence is "last business day" | Runs on a weekend or holiday | Computed gate (P6) plus the holiday list (P5) |
| The flow can run longer than its cadence | Overlapping runs | Concurrency or marker (P7) |
| A run can cross midnight | "Today" differs between start and end | Capture the date key once at the start |
| The user asks for "by 09:00" | The trigger is best-effort, seconds late or early | Say it is approximate; promise no strict SLA |

## People

| Applies when | Risk | Guard |
|---|---|---|
| An approval is part of the flow | The run times out at 30 days and takes the pending approval with it | Finish inside 30 days and chase outside the flow, or store approvals in Dataverse (premium). See P13 |
| An approver may be on leave | The flow waits silently | Add a delegate or an escalation step |
| The sender is a shared mailbox | Send fails without permission | Grant Send As, test a send outside the flow first |
| Recipients include external or guest users | Blocked or quarantined | Confirm the tenant allows it |
| A distribution list is the recipient | Membership changes silently | Prefer a group mailbox or an explicit list |
| The owner leaves or changes role | The flow drops to Low and connections break | Service account owner plus a co-owner |
| Alerts go only to the maker | Nobody acts when the maker is away | Alert a channel, not a person |

## Platform

| Applies when | Risk | Guard |
|---|---|---|
| Anything has a side effect | Retry duplicates it | Retry policy `None`, or a marker |
| Short cadence plus a slow run | Overlap and duplicate writes | State concurrency explicitly |
| High action count or high cadence | The Low budget runs out | Run the arithmetic in `settings.md` |
| A connector is busy | 429 throttling | Back off, reduce action count, or slow down |
| A call can exceed 120 seconds | Synchronous timeout | Async pattern or `Do until` |
| DLP covers the connectors | The flow is suspended or will not save | Flow checker, then an admin |
| A seasonal flow sits idle for months | Auto-suspended | Note the return date; owners get a warning first |

## Money and compliance

| Applies when | Risk | Guard |
|---|---|---|
| The flow pays, invoices, or refunds | Duplicate financial side effect | Unique index plus concurrency 1 (P3), no exceptions |
| Personal data appears in inputs or outputs | Visible in run history | Secure inputs and outputs |
| An auditor will ask who did what | No trail | Audit row with the run key and item key |
| The flow acts on behalf of someone | Wrong attribution | Named sender plus a note in the alert |
| Legal retention applies | Data deleted on schedule or kept when it should not be | Decide retention before building |
