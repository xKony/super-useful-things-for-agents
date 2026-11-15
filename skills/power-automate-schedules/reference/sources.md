# Sources

Every fact in this skill was read from Microsoft Learn on **2026-11-15** unless marked *listed only*. Fetch a *listed only* page before citing it.

## Read and verified

| Topic | URL |
|---|---|
| Limits, concurrency, retry defaults, budgets, transition period, auto-suspension | https://learn.microsoft.com/en-us/power-automate/limits-and-config |
| Designer settings: timeout, retry defaults, run after, security, static result | https://learn.microsoft.com/en-us/power-automate/flows-designer |
| Creating a scheduled flow, recurrence fields, start time, time zone | https://learn.microsoft.com/en-us/power-automate/run-scheduled-tasks |
| Trigger troubleshooting: skipped conditions, DLP, connections, duplicates, wake-up gap, frozen expressions, polling backlog | https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-run-issues/triggers-troubleshoot |
| License types: Free vs Microsoft 365 vs Premium, premium connectors, Dataverse storage | https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types |
| Modern approvals, including the 30-day run limit and the Dataverse pattern | https://learn.microsoft.com/en-us/power-automate/modern-approvals |
| SharePoint unique index exists as a field property | https://learn.microsoft.com/en-us/dotnet/api/microsoft.sharepoint.client.field.enforceuniquevalues |

The last page confirms the platform property, not the maker UI path or how the connector surfaces the rejection. Test the rejection once before relying on it.
| Microsoft Learn MCP server | https://learn.microsoft.com/en-us/training/support/mcp |

## Listed only, fetch before citing

| Topic | URL |
|---|---|
| Connector catalog and `PREMIUM` badges | https://learn.microsoft.com/en-us/connectors/ |
| Request limits and allocations | https://learn.microsoft.com/en-us/power-platform/admin/api-request-limits-allocations |
| Sharing and permissions | https://learn.microsoft.com/en-us/power-automate/guide-to-cloud-flow-sharing-permissions |
| Fixing failed flows | https://learn.microsoft.com/en-us/power-automate/fix-flow-failures |
| Solution-aware flows and ALM | https://learn.microsoft.com/en-us/power-automate/overview-solution-flows |
| Data loss prevention | https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention |
| Workflow expression functions | https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-functions-reference |
| Platform limit guidance | https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/understand-limits |
| Parallel execution guidance | https://learn.microsoft.com/en-us/power-automate/guidance/coding-guidelines/implement-parallel-execution |

## Fetch order

1. **MCP tools**, if present: `microsoft_docs_search` then `microsoft_docs_fetch`. No auth, free, refreshed daily by Microsoft.
2. **Learn search API**, no auth, returns canonical URLs and `lastUpdatedDate`:

```text
https://learn.microsoft.com/api/search?search=<url-encoded terms>&locale=en-us&$top=5
```

3. **Direct fetch** of a URL above.

## Balance rule

Fetch when the claim is falsifiable by Microsoft changing a number, a price, a badge, or a label:

- limits, request budgets, retry counts
- licensing and premium classification
- preview vs GA status
- exact designer wording and menu paths
- connector availability in a tenant

Skip the fetch for semantics the skill already encodes, such as "concurrency off means overlapping runs". When you do fetch, cite the page in one line at the bottom of the answer.

If nothing is reachable, answer from the baked text and add:

```text
Unverified: docs not reachable (baked content verified 2026-11-15).
```

## Review cadence

Re-verify this file every 90 days, or immediately when a user reports a mismatch between the skill and their portal. Update the date at the top of `SKILL.md` and in this file together.

Numbers most likely to drift, in order: retry defaults, concurrency defaults, request budgets and the April 2027 transition, premium classification, designer labels, approval behavior.

## Attribution

See `NOTICE.md`. Microsoft Learn text is CC BY 4.0; the skill paraphrases and restructures it rather than copying it.
