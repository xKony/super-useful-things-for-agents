# apply-agy-settings.ps1
# Backs up existing settings and applies the hardened Antigravity CLI configuration template

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$sourceFile = Join-Path $PSScriptRoot "settings.json"
$targetDir  = Join-Path $env:USERPROFILE ".gemini\antigravity-cli"
$targetFile = Join-Path $targetDir "settings.json"

Write-Host "==> Applying Antigravity CLI Settings..." -ForegroundColor Cyan

if (-not (Test-Path $sourceFile)) {
    Write-Error "Source settings file not found: $sourceFile"
}

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Write-Host "  [+] Created target directory: $targetDir" -ForegroundColor Green
}

if (Test-Path $targetFile) {
    $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $backupFile = Join-Path $targetDir "settings.json.bak-$timestamp"
    Copy-Item -Path $targetFile -Destination $backupFile -Force
    Write-Host "  [+] Created backup: $backupFile" -ForegroundColor Yellow
}

# Copy template directly to target
Copy-Item -Path $sourceFile -Destination $targetFile -Force
Write-Host "  [+] Successfully applied settings to: $targetFile" -ForegroundColor Green
Write-Host "==> Antigravity CLI permissions and defaults are now active!" -ForegroundColor Green
