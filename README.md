# AIDLC-GUI

> A visual interface for AI-DLC

AIDLC-GUI is a cross-platform desktop workspace for developers who want the structure of [AWS Labs AI-DLC](https://github.com/awslabs/aidlc-workflows) without memorizing every command. It combines focused visual workflow controls with a real, fully interactive Codex terminal.

**AIDLC-GUI is an unofficial community interface for AWS Labs AI-DLC. It is not an AWS product.**

## Screenshots

Screenshots will be added with the first packaged release.

## Features

- One real Codex PTY shared by visual actions and direct terminal input
- Live ANSI output, stdin, resize, scrolling, copy/paste, Ctrl+C, and terminal restart
- Project readiness checks for Codex, AI-DLC, and the Codex harness configuration
- Recent projects with quick reopen and missing-folder detection
- AI-DLC overview with workflow, phase, stage, progress, agent, and approval state
- Current AI-DLC command controls, generated command previews, and advanced policy options
- Read-only workflow visualization sourced from `aidlc-state.md`
- Artifact discovery and an in-app Markdown viewer
- Human-readable history sourced from AI-DLC JSONL audit records
- Local settings for executable paths, terminal behavior, theme, and debug mode
- Native builds for macOS, Windows, and Linux

## Architecture

```text
React + xterm.js
       │ Tauri commands and events
       ▼
Rust application core
       │ portable-pty
       ▼
Interactive Codex CLI session
       │ $aidlc commands
       ▼
AWS Labs AI-DLC
```

AI-DLC remains the workflow source of truth. AIDLC-GUI reads its official project files and sends workflow actions through the same Codex terminal the user sees. It does not implement a second workflow engine and never edits AI-DLC state files directly.

## Installation

### npm

Packaged releases are designed for:

```bash
npm install -g aidlc-gui
aidlc-gui setup   # only needed when AI-DLC is missing
aidlc-gui
```

`aidlc-gui setup` preserves an existing AI-DLC installation. When AI-DLC is missing, it downloads the current official installer from the AWS Labs release URL and verifies that `aidlc --version` works. The npm package must include the matching binary under `binaries/<platform>-<arch>/` during release assembly.

### Desktop packages

Normal Tauri bundles are produced for:

- macOS (`.dmg` / `.app`)
- Windows (NSIS / MSI)
- Linux (AppImage / deb / rpm where supported by the build host)

## Requirements

- [Codex CLI](https://developers.openai.com/codex/cli/)
- [AI-DLC](https://github.com/awslabs/aidlc-workflows)
- Node.js 18+ and pnpm when building from source
- Rust and the platform-specific Tauri prerequisites when building the desktop app

## Development

```bash
pnpm install
pnpm tauri:dev
```

The browser-only UI preview is available with `pnpm dev`; it uses demo data and a simulated terminal notice. The Tauri app uses the real Rust PTY.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri:build
```

## Security model

- Project and artifact paths are canonicalized and artifact reads are restricted to the active project.
- GUI-generated workflow commands are visibly echoed in the terminal before dispatch.
- Prompt text is normalized and quoted before becoming an AI-DLC invocation.
- AI-DLC state is read-only; setup uses the official native `aidlc config --harness codex` command.
- Project data stays local and AIDLC-GUI makes no application-level calls to external services.
- Child processes are terminated when the terminal is restarted, the project changes, or the window exits.

## Relationship to AI-DLC

AI-DLC is developed by AWS Labs and has its own license, releases, documentation, and support channels. AIDLC-GUI is a separate community project. It provides visual control, a terminal interface, state reading, artifact viewing, and workflow visualization; AI-DLC remains responsible for all workflow behavior.

## License

MIT
