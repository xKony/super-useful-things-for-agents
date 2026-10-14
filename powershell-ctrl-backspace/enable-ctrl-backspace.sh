#!/usr/bin/env bash
# enable-ctrl-backspace.sh
# Enables Ctrl+Backspace full-word deletion for Bash and runs the PowerShell automation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Configuring Ctrl+Backspace for Bash / Readline..."

# 1. Configure Readline (.inputrc) for Git Bash / WSL / Linux terminals
INPUTRC="${HOME}/.inputrc"
touch "${INPUTRC}"

if ! grep -q "backward-kill-word" "${INPUTRC}"; then
    cat << 'EOF' >> "${INPUTRC}"

# Fix Ctrl+Backspace to delete previous word
"\C-h": backward-kill-word
"\C-?": backward-kill-word
EOF
    echo "  [+] Updated ~/.inputrc"
else
    echo "  [=] ~/.inputrc already configured."
fi

# 2. Trigger the PowerShell script if powershell / pwsh is available on Windows
if command -v powershell.exe &>/dev/null; then
    echo "==> Triggering Windows / PowerShell configuration via powershell.exe..."
    powershell.exe -ExecutionPolicy Bypass -File "$(cygpath -w "${SCRIPT_DIR}/enable-ctrl-backspace.ps1" 2>/dev/null || wslpath -w "${SCRIPT_DIR}/enable-ctrl-backspace.ps1" 2>/dev/null || echo "${SCRIPT_DIR}/enable-ctrl-backspace.ps1")"
elif command -v pwsh &>/dev/null; then
    echo "==> Triggering Windows / PowerShell configuration via pwsh..."
    pwsh -ExecutionPolicy Bypass -File "${SCRIPT_DIR}/enable-ctrl-backspace.ps1"
fi

echo "==> Bash and PowerShell configuration complete!"
