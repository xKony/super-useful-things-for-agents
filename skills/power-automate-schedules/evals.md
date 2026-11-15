# Evals

Run every prompt against the skill with a clean context. A prompt passes only if every "must" is present and every "must not" is absent. Ship bar: 11 of 11.

## Contract checks that apply to all prompts

- The shape matches the question: Design for "build it", Triage for "why did it", Short for a small flow.
- The shape is the simplest one that satisfies the safety contract; no branch, variable, loop, or child flow the requirement does not need.
- The first sentence answers.
- Every answer that describes a flow has a mermaid diagram with quoted labels and 12 nodes or fewer; a settings-only fix or a capability question has none.
- Prose is at most about 15 lines. Tables, steps, diagram, and code blocks are free.
- Three warnings or fewer.
- Free connectors only, unless premium is explicitly flagged in Constraints.
- Any number matches `reference/settings.md` or a fetch cited in the answer.
- Every verify step runs today. A manual run, a static result, or a temporary short interval replaces waiting for the schedule.
- Every send or write names its duplicate guard.
- Above a few hundred writes in one run, the design states the batch alternative or the request cost.
- Concurrency and time zone are stated with their consequence.

## Prompts

| # | Prompt | Must include | Must not include |
|---|---|---|---|
| 1 | "Every morning I pull overdue invoices from a SharePoint list, check them, and email finance. Build it." | Spec block with six slots, diagram, numbered designer steps, settings table, failure policy, local time zone stated | More than 2 questions, premium connector, JSON |
| 2 | "One bad row shouldn't kill the whole run." | Per-item isolation with a scope inside the loop, a run-after failure action, a summary alert, a warning that `Resubmit` replays succeeded rows | A single catch around the loop only |
| 3 | "It sent the same email three times this morning." | Triage shape, Diagnosis first, retry as the likely cause with the Low default of 2 retries, only the settings and steps that change, marker or concurrency fix | A full spec block, a rebuilt flow |
| 4 | "Run it daily at 02:30 Amsterdam time." | DST skip and double-run warning, marker or a moved slot, named city zone, the offset in the label described as display only | A bare `UTC` zone, treating the offset in the label as fixed, "wait and see" |
| 5 | "Store the dedupe marker in Dataverse." | Premium flagged, free SharePoint alternative offered, unique index named as the atomic option, the lost-send vs duplicate tradeoff stated | Silently designing with Dataverse, claiming SharePoint cannot enforce uniqueness |
| 6 | "Every 5 minutes, about 40 actions." | Budget arithmetic: 288 runs, 11,520 requests, over the 10,000 Low limit, with a fix | Approving the design as-is |
| 7 | "It didn't run this morning." | Ordered checks: on, trigger banner, DLP, connections, skipped condition, license, time zone | Random guesses, no order |
| 8 | "Give me the JSON so I can paste it." | Code View and Peek code are read-only, no JSON path, designer clicks instead, no diagram | Fabricated JSON, telling the user to enable editing |
| 9 | "Weekly." | Assumes weekday and time, states the assumptions, asks at most 2 questions, still delivers a design | Blocking on questions with a blank answer |
| 10 | "Weekdays at 09:00 and 17:00." | Two runs per day, hours listed together, minutes 0 | Four runs, or two separate triggers |
| 11 | "Excel 1 has 4,000 matching rows. Append them to Excel 2 at 07:00 and 15:00 every weekday." | A batch option (`Run script` on both workbooks, or on the destination alone) with the 120 s / 5 MB limits, or a budget-correct row cap; the 100 calls/60 seconds throttle named; per-row isolation if the loop is kept; trigger concurrency 1 | An uncapped per-row loop claimed to fit the budget; one script writing both workbooks; more than 3 warnings |

## Stop-the-line failures

Any of these fails the prompt outright:

- Invents a designer path that does not exist.
- Quotes a price.
- Says "wait until tomorrow and see" as the only verification, or requires waiting for the next scheduled run at all.
- Hides a premium connector inside a free design.
- Omits the failure policy on a flow with a side effect.
- Omits the concurrency statement.
- Claims a run fits the request budget without counting the actions that execute once per loop item.
- Produces more than 3 warnings, or a paragraph longer than the budget.
- Puts `utcNow()` in a trigger input.
- Rebuilds a flow the user asked to diagnose.
- Calls a check-then-act marker atomic, or claims SharePoint cannot enforce uniqueness.
- Describes the offset in a time zone label as a fixed offset.

## Re-running

Re-run after any change to `SKILL.md`, `reference/settings.md`, `reference/patterns.md`, `reference/designing.md`, or `reference/triage.md`. Re-verify the pinned numbers at the same time. Re-run prompt 11 after any change to P14 or the Office Scripts limits.
