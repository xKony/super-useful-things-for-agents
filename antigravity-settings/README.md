# Antigravity CLI (`agy`) Hardened Default Settings

This directory contains recommended and security-hardened default configuration settings for the Antigravity CLI (`agy`).

---

## Target File Location

The Antigravity CLI reads its configuration from `settings.json` located at:

- **Windows**: `%USERPROFILE%\.gemini\antigravity-cli\settings.json`  
  *(typically `C:\Users\<username>\.gemini\antigravity-cli\settings.json`)*
- **macOS / Linux**: `~/.gemini/antigravity-cli/settings.json`

> **Note**: Antigravity enforces a hardcoded system protection boundary that blocks the AI assistant from editing `settings.json` directly. This is by design to prevent agents from modifying their own security boundaries. You must edit or copy this file manually.

---

## Key Security & Workflow Hardening

### 1. Regex Guard for Deletion Commands
Standard prefix matching like `"command(Remove-Item)"` only catches commands that **start directly** with `Remove-Item`. If a command wraps the deletion in an `if` block, script, or pipeline (e.g., `if (Test-Path ...) { Remove-Item ... }`), prefix matching fails and falls back to `allow: command(*)`.

Our template uses word-boundary regex:
```json
"command(regex:(?i).*\\b(?:Remove-Item|rm|rmdir|del|ri)\\b.*)"
```
- `(?i)`: Case-insensitive (catches `Remove-Item`, `remove-item`, `RM`, `del`, etc.).
- `\b`: Word boundaries to prevent false positives on harmless words.
- Matches anywhere in the command line, ensuring script-wrapped deletions **always prompt for interactive confirmation**.

### 2. Critical Credential Protection (`deny`)
Prevents the agent from accidentally reading or leaking sensitive secrets, SSH keys, or cloud credentials:
- `~/.ssh/*`, `**/id_rsa*`, `**/id_ed25519*`
- `**/.aws/credentials*`
- `**/.env*`

### 3. Git Destructive Safeguards (`ask`)
Requires manual confirmation before running irreversible git commands:
- `git clean` (deleting untracked files)
- `git reset --hard` (discarding uncommitted work)
- `git push --force` / `git push -f`
- Standard `git push`

### 4. Disk & System Safety (`ask`)
Prompts before executing system-level or destructive disk operations:
- `format`, `diskpart`
- `shutdown`, `reboot`, `poweroff`

---

## Installation Helper

To install this template to your Antigravity CLI configuration on Windows, run:

```powershell
.\apply-agy-settings.ps1
```

Or copy manually:

```powershell
Copy-Item .\settings.json "$env:USERPROFILE\.gemini\antigravity-cli\settings.json" -Force
```
