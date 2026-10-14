# PowerShell & Coding Agents: Full-Word Ctrl+Backspace Fix

In Windows environments, pressing `Ctrl + Backspace` often fails to delete the preceding word. Instead, it deletes only a single character, outputs a square box, or prints `^H`.

This problem occurs across two distinct layers:
1. **In PowerShell (`pwsh` / `powershell.exe`)**: `PSReadLine` binds `Ctrl+h` (ASCII `0x08`, what Windows terminals send when pressing `Ctrl+Backspace`) to `BackwardDeleteChar` (single character delete).
2. **Inside Coding Agents & TUIs (`agy`, `opencode`, Claude Code, Aider, Python REPL)**: Once an interactive agent takes control of the terminal, `PSReadLine` is inactive. The agent runs in raw terminal mode and expects the Unix standard Word Erase sequence `\u0017` (`Ctrl+W`). Because Windows terminals send `0x08` (`Ctrl+H`), the agent treats it as regular backspace.

---

## Quick Setup (Automated)

Run the included automated setup script in PowerShell:

```powershell
.\enable-ctrl-backspace.ps1
```

Or from Bash (Git Bash / WSL / MSYS2):

```bash
./enable-ctrl-backspace.sh
```

The script automatically configures:
- PowerShell 7 and Windows PowerShell 5.1 profiles.
- Windows Terminal keybindings (`sendInput: \u0017`).
- VS Code and Antigravity IDE terminal keybindings.

---

## Manual Setup Instructions

If you prefer to configure this manually, follow the three steps below.

### 1. PowerShell Profiles (Native PowerShell)

Add the following lines to your PowerShell profile:

- **PowerShell 7 (`pwsh`)**: `~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`
- **Windows PowerShell 5.1**: `~\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`

```powershell
# Bind word deletion to Ctrl+Backspace, Ctrl+h, and Ctrl+?
Import-Module PSReadLine -ErrorAction SilentlyContinue
Set-PSReadLineKeyHandler -Key 'Ctrl+Backspace' -Function BackwardKillWord
Set-PSReadLineKeyHandler -Key 'Ctrl+h' -Function BackwardKillWord
Set-PSReadLineKeyHandler -Key 'Ctrl+?' -Function BackwardKillWord
```

Reload your profile in an open shell:
```powershell
. $PROFILE
```

---

### 2. Windows Terminal (For Coding Agents & TUIs)

Open Windows Terminal settings (`Ctrl + ,` or edit `settings.json` located at:
`%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_*\LocalState\settings.json`).

Under the `"actions"` array, add:

```json
"actions": [
  {
    "command": {
      "action": "sendInput",
      "input": "\u0017"
    },
    "keys": "ctrl+backspace"
  }
]
```

> **Why `\u0017`?**
> `\u0017` is the ASCII control character for `Ctrl+W` (Word Erase / `WERASE`). When Windows Terminal translates `Ctrl+Backspace` into `\u0017`, interactive CLI agents (`agy`, `opencode`, Python, Node) receive the standard word deletion signal and delete the full word.

---

### 3. VS Code & Antigravity IDE (Integrated Terminal)

Open your user keyboard shortcuts file (`keybindings.json`):
- **Antigravity IDE**: `%APPDATA%\Antigravity\User\keybindings.json` and `%APPDATA%\Antigravity IDE\User\keybindings.json`
- **VS Code**: `%APPDATA%\Code\User\keybindings.json`

Add the following keybinding:

```json
[
  {
    "key": "ctrl+backspace",
    "command": "workbench.action.terminal.sendSequence",
    "args": {
      "text": "\u0017"
    },
    "when": "terminalFocus"
  }
]
```

---

## Verification

1. **PowerShell**: Type `Get-ChildItem -Path` and press `Ctrl + Backspace`. `-Path` should be erased completely.
2. **Coding Agents (`agy`, `opencode`)**: Launch `agy` or `opencode`, type several words in the prompt, and press `Ctrl + Backspace`. The last word should be erased cleanly without printing `^H`.
