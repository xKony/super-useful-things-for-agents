# GitHub Copilot Prompt Files (`.prompt.md`)

This directory contains reusable prompt files for GitHub Copilot in Visual Studio Code.

## How It Works

Prompt files placed in `.github/prompts/*.prompt.md` are automatically recognized by GitHub Copilot in VS Code.

- **Slash command**: Open Copilot Chat and type `/commit` (or `/` to view all available prompts).
- **Command Palette**: Run `Chat: Run Prompt...` and select the prompt.
- **Editor button**: Open any `.prompt.md` file and click the Run button at the top of the editor.

## Available Prompts

| File | Slash Command | Description |
| --- | --- | --- |
| [commit.prompt.md](commit.prompt.md) | `/commit` | Stage and commit uncommitted and untracked changes using Conventional Commits |
