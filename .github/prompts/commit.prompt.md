---
name: commit
description: "Stage and commit uncommitted and untracked changes using Conventional Commits"
argument-hint: "[optional scope or message]"
agent: "agent"
---

Inspect all uncommitted changes and untracked files in the workspace:

1. **Inspect changes**: Check `git status` and diffs across all modified and untracked files.
2. **Group changes**: Group related changes into logical, atomic commits.
3. **Format messages**: Write each commit message following the Conventional Commits specification:
   - Format: `<type>[optional scope]: <description>`
   - Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`
   - Use imperative mood in the description (e.g., "add", not "added")
   - Keep the summary line under 72 characters
   - Apply user argument if specified: `${input:scope_or_message}`
4. **Safety checks**:
   - Never stage secrets, tokens, credentials, `.env` files, or build artifacts
   - Do not use force flags or bypass verification hooks
5. **Execute**: Stage the selected files and commit them.
