# Browser helper — upper-bound / corrupted save errors

Guide for debugging and mitigating save failures that show absurd limits (e.g. `999234892842934`) even when the user entered normal data. Same data often works after closing the tab and reopening.

---

## Symptom pattern

| Clue | What it usually means |
|------|------------------------|
| Absurd upper bound in error message | Corrupted internal/hidden value, not user input |
| User did not type huge numbers | Validator is reading stale or computed state |
| Same details work after tab close + reopen | **In-memory SPA / [DIALOG] state** is broken, not the data itself |
| Fails only on **Save** | Hidden fields, client model, or payload differ from visible UI |

**Conclusion:** This is almost always **stale client-side state**, not bad typing.

---

## Common causes ([SPA] / [DIALOG] apps)

1. Previous [DIALOG] not fully destroyed — IDs/counters from last [RECORD] still in memory
2. **Hidden inputs** hold garbage while visible fields look correct
3. Client-side form model out of sync with DOM
4. Split date fields (day / month / year) combined into invalid value on save
5. Validation state from an earlier failed save never cleared
6. Placeholder or max-int values (`Number.MAX_SAFE_INTEGER`, etc.) left in fields

---

## Investigation checklist (do BEFORE closing the tab)

### 1. Console

Save once with DevTools open. Note any red errors and stack traces at the moment of failure.

### 2. Scan all fields (including hidden)

Paste in Console:

```javascript
document.querySelectorAll('input, select, textarea').forEach(el => {
  if (el.type === 'hidden' || el.value.length > 20 || /^\d{10,}$/.test(el.value)) {
    console.log(el.name || el.id || el.type, '=', el.value, el);
  }
});
```

Find the field whose value matches (or is close to) the number in the error. Record `name`, `id`, and `type`.

### 3. Network tab

- Filter XHR/fetch on Save
- Open the failed request → **Payload** / **Request**
- Search for the huge number in the body

The bad value is often only in the request, not on screen.

### 4. Compare broken vs fresh tab

After reopening the tab (when save works), run the same field scan. Diff which fields differ.

### 5. Session pattern

Note what happened before the error:

- Several [DIALOG] instances opened/closed?
- Switched [RECORD] without full page refresh?
- Wizard back/next?
- Prior error on same page?

Helps distinguish [DIALOG] lifecycle bugs from a specific field bug.

---

## What the bookmarklet CAN do

### A. Pre-save scrub (recommended)

Run immediately before Save / submit:

```javascript
function scrubCorruptedFields(root) {
  root = root || document;
  root.querySelectorAll('input, select, textarea').forEach(function (el) {
    var v = el.value;
    if (/^\d{12,}$/.test(v) || (v !== '' && !isNaN(v) && Number(v) > 1e15)) {
      console.warn('[helper] cleared corrupted field', el.name || el.id, v);
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
```

Hook Save buttons and form `submit` (capture phase: `true`).

### B. Recompute hidden fields from visible ones

If scan finds e.g. `[HIDDEN_DATE_FIELD]` wrong but day/month/year selects are correct, rebuild hidden value from dropdowns before save (field names TBD per [APP]).

### C. Soft reset instead of closing tab

1. Close [DIALOG] (Cancel / X) if possible  
2. Re-open same flow  
3. **Restore** from `DraftStore` (localStorage)

Avoids full tab close while clearing some in-memory state.

### D. Auto-save on save failure

On error banner or failed network response:

- Call `DraftStore.save()` immediately  
- Log corrupted field scan to Console  

User keeps work; you get data for the next targeted fix.

### E. [DIALOG] observer

On each new [DIALOG]:

- Run scrub on open  
- Optionally clear known-bad hidden fields by `name`/`id` once identified  

---

## What the bookmarklet CANNOT fix

- Server-side business rules (duplicate ID, permissions, DB constraints)
- Broken minified JS with no stable hook (fragile to patch)
- Errors that require real data correction on the backend

---

## Fix workflow

1. Reproduce once; **do not close tab** until scan + Network are done  
2. Identify field(s) with absurd values (`name` / `id`)  
3. Add targeted rule to pre-save scrub or recompute logic  
4. Keep **DraftStore** + 30d TTL for recovery if save still fails  
5. Optional: "Fix & retry" button = scrub → restore draft → user clicks Save again  

---

## Fields to document when found (fill in locally — do not commit)

| Field name/id | Visible or hidden? | Bad value example | When it appears | Fix applied |
|---------------|-------------------|-------------------|-----------------|-------------|
|               |                   |                   |                 |             |

---

## Related files in this repo

- `draft-recovery.js` — draft save/restore, 30-day expiry
- `test-localstorage-google.js` — localStorage smoke test
- `bookmarklet-localstorage-test.txt` — one-line bookmarklet for storage test

---

## Usage reminder

```javascript
DraftStore.init({ recordId: '[RECORD-ID]', autoRestore: true, ttlDays: 30 });
```

After identifying bad fields, add pre-save hooks to the same script or a small `pre-save-scrub.js` module bundled with the bookmarklet.
