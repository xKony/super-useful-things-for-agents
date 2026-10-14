# enable-ctrl-backspace.ps1
# Automates full-word Ctrl+Backspace deletion for PowerShell and coding agents (agy, opencode, etc.)

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "==> Enabling Ctrl+Backspace full-word deletion..." -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Configure PowerShell Profiles
# ------------------------------------------------------------------------------
$psProfileBlock = @"

# Fix Ctrl+Backspace to delete previous word across terminals and agents
Import-Module PSReadLine -ErrorAction SilentlyContinue
Set-PSReadLineKeyHandler -Key 'Ctrl+Backspace' -Function BackwardKillWord
Set-PSReadLineKeyHandler -Key 'Ctrl+h' -Function BackwardKillWord
Set-PSReadLineKeyHandler -Key 'Ctrl+?' -Function BackwardKillWord
"@

$profilePaths = @(
    (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "PowerShell\Microsoft.PowerShell_profile.ps1"),
    (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "WindowsPowerShell\Microsoft.PowerShell_profile.ps1")
)

foreach ($profilePath in $profilePaths) {
    $parentDir = Split-Path -Parent $profilePath
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    if (Test-Path $profilePath) {
        $existing = Get-Content -Path $profilePath -Raw
        if ($existing -notlike "*BackwardKillWord*") {
            Add-Content -Path $profilePath -Value $psProfileBlock
            Write-Host "  [+] Updated profile: $profilePath" -ForegroundColor Green
        } else {
            Write-Host "  [=] Profile already configured: $profilePath" -ForegroundColor DarkGray
        }
    } else {
        Set-Content -Path $profilePath -Value $psProfileBlock.TrimStart()
        Write-Host "  [+] Created profile: $profilePath" -ForegroundColor Green
    }
}

# ------------------------------------------------------------------------------
# 2. Configure Windows Terminal settings.json
# ------------------------------------------------------------------------------
$wtPackagePath = Get-ChildItem -Path "$env:LOCALAPPDATA\Packages" -Filter "Microsoft.WindowsTerminal_*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1

if ($wtPackagePath) {
    $wtSettingsPath = Join-Path $wtPackagePath.FullName "LocalState\settings.json"
    if (Test-Path $wtSettingsPath) {
        try {
            $rawJson = Get-Content -Path $wtSettingsPath -Raw
            $wtConfig = $rawJson | ConvertFrom-Json

            $actionsProperty = $null
            if ($wtConfig.PSObject.Properties.Match('actions').Count -gt 0) {
                $actionsProperty = 'actions'
            } elseif ($wtConfig.PSObject.Properties.Match('keybindings').Count -gt 0) {
                $actionsProperty = 'keybindings'
            }

            $hasBinding = $false
            if ($actionsProperty) {
                foreach ($item in $wtConfig.$actionsProperty) {
                    if ($item.keys -eq 'ctrl+backspace') {
                        $hasBinding = $true
                        break
                    }
                }
            }

            if (-not $hasBinding) {
                $newAction = [PSCustomObject]@{
                    command = [PSCustomObject]@{
                        action = "sendInput"
                        input  = "`u{0017}"
                    }
                    keys = "ctrl+backspace"
                }

                if ($actionsProperty) {
                    $currentList = [System.Collections.ArrayList]@($wtConfig.$actionsProperty)
                    $currentList.Add($newAction) | Out-Null
                    $wtConfig.$actionsProperty = $currentList
                } else {
                    $wtConfig | Add-Member -MemberType NoteProperty -Name "actions" -Value @($newAction)
                }

                $wtConfig | ConvertTo-Json -Depth 32 | Set-Content -Path $wtSettingsPath -Encoding UTF8
                Write-Host "  [+] Updated Windows Terminal: $wtSettingsPath" -ForegroundColor Green
            } else {
                Write-Host "  [=] Windows Terminal already has ctrl+backspace mapped." -ForegroundColor DarkGray
            }
        } catch {
            Write-Warning "Failed to automatically patch Windows Terminal settings: $($_.Exception.Message)"
        }
    }
}

# ------------------------------------------------------------------------------
# 3. Configure VS Code and Antigravity IDE Keybindings
# ------------------------------------------------------------------------------
$ideFolders = @(
    "$env:APPDATA\Antigravity\User",
    "$env:APPDATA\Antigravity IDE\User",
    "$env:APPDATA\Code\User"
)

$ideKeybinding = [PSCustomObject]@{
    key     = "ctrl+backspace"
    command = "workbench.action.terminal.sendSequence"
    args    = [PSCustomObject]@{ text = "`u{0017}" }
    when    = "terminalFocus"
}

foreach ($folder in $ideFolders) {
    if (Test-Path $folder) {
        $kbPath = Join-Path $folder "keybindings.json"
        if (Test-Path $kbPath) {
            try {
                $content = Get-Content -Path $kbPath -Raw
                $bindings = $content | ConvertFrom-Json
                $hasBinding = $false
                foreach ($b in $bindings) {
                    if ($b.key -eq 'ctrl+backspace' -and $b.command -like "*sendSequence*") {
                        $hasBinding = $true
                        break
                    }
                }
                if (-not $hasBinding) {
                    $list = [System.Collections.ArrayList]@($bindings)
                    $list.Add($ideKeybinding) | Out-Null
                    $list | ConvertTo-Json -Depth 10 | Set-Content -Path $kbPath -Encoding UTF8
                    Write-Host "  [+] Updated IDE keybindings: $kbPath" -ForegroundColor Green
                } else {
                    Write-Host "  [=] IDE keybindings already configured: $kbPath" -ForegroundColor DarkGray
                }
            } catch {
                Write-Warning "Failed to parse $($kbPath): $($_.Exception.Message)"
            }
        } else {
            @($ideKeybinding) | ConvertTo-Json -Depth 10 | Set-Content -Path $kbPath -Encoding UTF8
            Write-Host "  [+] Created IDE keybindings: $kbPath" -ForegroundColor Green
        }
    }
}

Write-Host "==> Setup complete! Ctrl+Backspace will now delete full words in PowerShell and coding agents." -ForegroundColor Green
