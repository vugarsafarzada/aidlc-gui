# AIDLC-GUI

> A visual interface for AI-DLC

AIDLC-GUI is a desktop application for working with [AWS Labs AI-DLC](https://github.com/awslabs/aidlc-workflows). It shows the state of your AI-DLC workflow (phases, stages, approvals, artifacts and audit history) next to a live, fully interactive Codex terminal, and turns common AI-DLC commands into buttons and forms.

> **Disclaimer:** AIDLC-GUI is an independent open source community project for AWS Labs AI-DLC. It is not an AWS product and is not affiliated with or endorsed by AWS.

## Overview

AI-DLC runs inside an agent session as a set of `$aidlc` commands, and keeps its workflow state, artifacts and audit logs as files in your project. That works well, but it means remembering command flags and opening Markdown files by hand to see where a workflow stands.

AIDLC-GUI puts those pieces into one window:

- It starts the Codex CLI in a real pseudo-terminal inside your project folder.
- It reads the AI-DLC files in the project and presents them as an overview, a workflow map, an artifact browser and an activity timeline.
- When you click a workflow button, it types the matching `$aidlc` command into that same terminal, so you can always see exactly what was sent and keep typing yourself.

AIDLC-GUI does not run its own workflow engine and does not edit AI-DLC state files. AI-DLC stays in charge of how the workflow behaves.

## Features

- **Embedded Codex terminal:** a real PTY session with colors, input, resizing, scrollback, clickable links and a restart button.
- **Visual commands, same terminal:** every GUI action is echoed in the terminal (prefixed with `› GUI`) and then sent to the running Codex session.
- **Readiness checks:** detects the Codex CLI and the `aidlc` CLI (path and version), and whether the project has been configured for the Codex harness.
- **One-click project setup:** runs `aidlc config --harness codex` in the project when it is not configured yet.
- **Recent projects:** the last 10 projects, with reopen, remove, and detection of folders that no longer exist.
- **Workflow overview:** current intent, space, phase, stage, agent, scope, depth, progress percentage and pending approvals, refreshed every 5 seconds.
- **Workflow map:** phases and stages parsed from `aidlc-state.md`, with a stage inspector and a "Jump to this stage" action.
- **Approval shortcuts:** Approve and Request changes buttons when AI-DLC is waiting for a decision.
- **Command builder:** a form for scope, depth, test strategy, review mode, guard policy and on/off flags that previews the generated `$aidlc` command before sending it.
- **Artifact browser:** lists files from the active intent folder, with filtering, an in-app Markdown viewer, and Open / Reveal in the system file manager.
- **Activity history:** a readable timeline built from AI-DLC audit files (Markdown audit logs and JSONL event logs).
- **Local settings:** executable paths, theme (dark, light, system), terminal font size and scrollback, and reopening the last project on start.
- **Browser preview mode:** `pnpm dev` runs the UI with demo data for interface work without the desktop shell.

## How It Works

```text
┌──────────────────────────────────────────────┐
│ React UI (overview, workflow, artifacts,     │
│ history, settings) + xterm.js terminal       │
└───────────────┬──────────────────────────────┘
                │ Tauri commands and events
┌───────────────▼──────────────────────────────┐
│ Rust backend                                 │
│  - project reader (state, artifacts, audit)  │
│  - PTY manager (portable-pty)                │
│  - settings and recent projects              │
└───────┬───────────────────────────┬──────────┘
        │ reads files               │ spawns in project folder
┌───────▼──────────┐       ┌────────▼──────────┐
│ Project files    │       │ Codex CLI session │
│ aidlc/ ...       │◄──────┤ runs $aidlc       │
│ aidlc-state.md   │ writes│ (AI-DLC skill)    │
│ audit/, artifacts│       └───────────────────┘
└──────────────────┘
```

1. When you open a folder, the Rust backend scans it and builds a project snapshot.
2. The terminal panel starts `codex` in that folder through a PTY. Output streams to xterm.js; keystrokes stream back.
3. GUI actions write a `$aidlc ...` line into the PTY, exactly as if you typed it.
4. AI-DLC (running inside Codex) updates its own files. The GUI re-reads the project every 5 seconds and updates the views.

### Where the data comes from

| View | Source |
| --- | --- |
| Workflow state | The most recently modified `aidlc-state.md` in the project (searched up to 10 levels deep). Fields such as `Current Phase`, `Current Stage`, `Current Agent`, `Scope` and `Depth` are read from it, and stages come from its checkbox lists grouped under phase headings. |
| Intent and space | The `spaces/<space>/intents/<intent>/` segments of the state file path. |
| Artifacts | `.md`, `.json`, `.yaml`, `.yml` and `.txt` files in the folder containing the state file, excluding `audit/` folders, the state file itself and graph files (up to 250, newest first). The stage label is guessed from the file path. |
| History | Markdown files inside `audit/` folders (events separated by `---`, with `**Event**:` / `**Timestamp**:` fields), plus `audit.jsonl`, `audit-log.jsonl` and `events.jsonl` files. Noise such as heartbeats and usage events is filtered out. |
| Project configured | `.codex/config.toml`, an AI-DLC skill at `.agents/skills/aidlc/SKILL.md` or `.codex/skills/aidlc/SKILL.md`, and an `aidlc/` folder all exist. |

The parsing is tolerant by design, because it reads human-oriented Markdown. If AI-DLC changes its file layout, some views may show less detail until the reader is updated.

## Interface

- **Welcome screen:** open a project folder, reopen a recent one, and check whether Codex CLI and AI-DLC are installed.
- **Overview:** project health, workflow progress, a prompt box ("Run workflow" sends `$aidlc "<your text>"`), quick actions (Start, Resume, Status, Doctor), and a setup banner if the project is not configured.
- **Workflow:** the phase and stage map, a stage inspector, Resume and Team board buttons, and the advanced command builder.
- **Artifacts:** searchable list of artifact files with stage, modified time and size; click one to read it in the viewer.
- **History:** timeline of AI-DLC audit events.
- **Terminal:** the shared Codex terminal. It docks at the bottom of every view and can be resized, expanded, collapsed or restarted.
- **Settings:** executable paths, appearance and terminal options, and startup behavior.

### Commands sent by the GUI

| Control | Text sent to the Codex session |
| --- | --- |
| Start / Resume | `$aidlc` |
| Status | `$aidlc --status` |
| Doctor | `$aidlc --doctor` |
| Run workflow (prompt box) | `$aidlc "<prompt>"` |
| Jump to this stage | `$aidlc --stage "<stage-id>"` |
| Team board | `$aidlc team-board --snapshot` |
| Park workflow / Intent manager / Space manager | `$aidlc park` / `$aidlc intent` / `$aidlc space` |
| Knowledge / Plugins / Configuration | `$aidlc knowledge list` / `$aidlc plugin list` / `$aidlc config list` |
| Command builder | `$aidlc --scope ... --depth ... --test-strategy ... --review ... --guard-policy ... --sensors on/off --learnings on/off --summary-confirmation on/off --plan-approval on/off` |
| Approve | `Approve` |
| Request changes | `Request changes: Please revise the proposal.` |

The approval buttons send plain replies into the conversation; AI-DLC decides how to interpret them. Changing the scope in the command builder asks for confirmation first.

## Installation

### From source (works today)

```bash
git clone https://github.com/vugarsafarzada/aidlc-gui.git
cd aidlc-gui
pnpm install
pnpm tauri:build
```

This builds the desktop app and its installers (see [Build](#build)), and copies the release binary to `binaries/<platform>-<arch>/`. You can then install the bundle from `src-tauri/target/release/bundle/`, or start the app through the launcher:

```bash
node bin/aidlc-gui.mjs          # launch the desktop app
node bin/aidlc-gui.mjs setup    # install AI-DLC if it is missing
node bin/aidlc-gui.mjs --help
```

Running `pnpm link --global` in the repository makes the same launcher available as `aidlc-gui`.

The launcher looks for the app binary in this order: the `AIDLC_GUI_BINARY` environment variable, `binaries/<platform>-<arch>/`, `src-tauri/target/release/`, then `src-tauri/target/debug/`.

### npm (prepared, not yet published)

The repository contains an npm launcher and a release workflow that, on a `v*` tag, builds binaries and publishes the `aidlc-gui` package. The package is **not on the npm registry yet**. Once it is published, installation will be:

```bash
npm install -g aidlc-gui
aidlc-gui setup   # only needed if AI-DLC is not installed
aidlc-gui
```

The release workflow currently produces binaries for macOS on Apple Silicon (`darwin-arm64`), Linux x64 and Windows x64. On other platforms the npm launcher will report that no binary was found.

### AI-DLC setup helper

`aidlc-gui setup` checks for an existing `aidlc` command and leaves it untouched if found. Otherwise it downloads and runs the official installer from the latest AWS Labs release (`install.sh` on macOS and Linux, `install.ps1` through PowerShell on Windows), then verifies that `aidlc --version` works. You can also install AI-DLC yourself by following the [AI-DLC documentation](https://github.com/awslabs/aidlc-workflows).

When the package is installed, a postinstall check prints a reminder if `aidlc` is not found. Set `AIDLC_GUI_SKIP_CHECK=1` to skip it.

## Requirements

### Runtime

- [Codex CLI](https://developers.openai.com/codex/cli/), available on `PATH` or configured in Settings. The terminal starts Codex directly, so it is required to use the terminal and all workflow buttons.
- [AI-DLC](https://github.com/awslabs/aidlc-workflows) (`aidlc` CLI), used for project configuration. The AI-DLC skill must be set up in the project for `$aidlc` commands to work.
- Node.js 18 or newer, only for the `aidlc-gui` launcher and `setup` command.
- Platform webview required by Tauri (WebKit on macOS, WebKitGTK on Linux, WebView2 on Windows). macOS 10.15 or newer.

### Development

- Node.js 18+ (CI uses Node 22) and pnpm (CI uses pnpm 11)
- Rust stable toolchain
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform. On Ubuntu, CI installs `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev` and `patchelf`.

## Development

```bash
pnpm install
pnpm tauri:dev      # desktop app with hot reload and the real PTY
pnpm dev            # browser-only UI preview with demo data (no real terminal)
```

Other scripts from `package.json`:

| Command | Purpose |
| --- | --- |
| `pnpm build` | Type-check and build the frontend into `dist/` |
| `pnpm preview` | Serve the built frontend |
| `pnpm typecheck` | Run the TypeScript compiler without output |
| `pnpm test` | Run frontend unit tests (Vitest) |
| `pnpm tauri` | Run the Tauri CLI |
| `pnpm stage:binary` | Copy a built release binary into `binaries/<platform>-<arch>/` |

Rust checks and tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

The Rust tests cover state parsing, project inspection against a fixture project, tool resolution, and (on Unix) real PTY output and process termination.

## Build

```bash
pnpm tauri:build
```

This runs `tauri build` and then stages the binary for the npm launcher. The Tauri configuration uses `"targets": "all"`, so the bundle formats depend on the host you build on:

- **macOS:** `.app` and `.dmg`
- **Windows:** MSI and NSIS installers
- **Linux:** `.deb`, `.rpm` and AppImage

Bundles are written to `src-tauri/target/release/bundle/`. Cross-compiling is not configured; build on each target platform.

The `Build` GitHub workflow runs the checks above on every push and pull request, and builds the desktop app on macOS (Apple Silicon), Ubuntu 22.04 and Windows. The builds are not signed or notarized.

## Project Architecture

```text
src/                     React + TypeScript frontend
  App.tsx                Views: welcome, overview, workflow, artifacts, history, settings
  components/            Terminal panel (xterm.js), Markdown viewer, shared UI
  lib/commands.ts        Builds and quotes $aidlc command strings
  services/backend.ts    Tauri command wrappers, plus demo data for browser preview
src-tauri/               Tauri 2 desktop shell
  src/lib.rs             Tauri commands, tool detection, project configuration
  src/projects.rs        Reads aidlc-state.md, artifacts and audit logs
  src/terminal.rs        PTY sessions via portable-pty
  src/persistence.rs     Settings and recent projects (state.json)
bin/aidlc-gui.mjs        npm launcher and `setup` command
scripts/                 postinstall check and binary staging
```

- **Frontend:** React 18, Vite, xterm.js, react-markdown with GitHub-flavored Markdown, lucide icons.
- **Desktop shell:** Tauri 2. The frontend talks to Rust only through the registered Tauri commands and the `terminal-output` / `terminal-exit` events.
- **Terminal layer:** one active Codex session at a time. It is stopped when you restart the terminal, switch projects or close the window.
- **AI-DLC integration:** file reading for display, `aidlc config --harness codex` for project setup, and `$aidlc` commands typed into Codex for everything else.

## Security and Local Data

- **Settings and recents** are stored in a `state.json` file in the platform's app config directory (for example `~/Library/Application Support/dev.vugarsafarzada.aidlc-gui/` on macOS).
- **Project files are read, not written.** The app never edits AI-DLC state files. The only command it runs on its own is `aidlc config --harness codex`, and only when you click Configure project.
- **Artifact access is limited to the open project.** Paths are canonicalized (resolving symlinks) and must stay inside the project folder; the viewer refuses files over 2 MB.
- **Processes are started without a shell.** Codex and `aidlc` are launched directly, so paths and arguments are not shell-interpolated.
- **Prompt text is sanitized** before it becomes a `$aidlc` command: line breaks are removed and quotes and backslashes are escaped.
- **Visible commands.** Everything the GUI sends to the terminal is shown in the terminal first.
- **Network:** the app itself makes no network requests (the webview content security policy only allows local and IPC connections). Codex, AI-DLC and any tools they run follow their own network behavior, and `aidlc-gui setup` downloads the AI-DLC installer from GitHub.

Codex runs with your user permissions inside the project folder, just like running it from your own terminal. Review what you approve.

## Known Limitations

- The npm package is not published yet (see [Installation](#installation)).
- The "Default terminal shell" and "Developer / debug mode" settings are saved but not used yet; the terminal always starts Codex directly.
- Workflow, artifact and history views depend on parsing AI-DLC's Markdown files and may lag behind changes in AI-DLC's file format.
- Release binaries are planned only for macOS Apple Silicon, Linux x64 and Windows x64.
- Screenshots are not included yet.

## Relationship to AI-DLC

- [AI-DLC](https://github.com/awslabs/aidlc-workflows) is developed and maintained by AWS Labs, with its own license, releases, documentation and support channels.
- AIDLC-GUI is a separate project. It does not replace, fork or bundle AI-DLC.
- AI-DLC remains responsible for its own workflow behavior: stages, approvals, agents and the files it writes. AIDLC-GUI only displays that information and sends commands to it.
- Issues with AI-DLC itself should be reported to the AI-DLC repository; issues with this interface belong here.

## Contributing

Contributions are welcome.

1. Open an issue to report a bug or discuss a change before starting larger work.
2. Fork the repository and create a branch.
3. Run `pnpm typecheck`, `pnpm test` and `cargo test --manifest-path src-tauri/Cargo.toml` before opening a pull request.
4. Keep AI-DLC as the source of truth: the GUI should read AI-DLC files and send AI-DLC commands, not reimplement workflow logic.

## Author

**Vugar Safarzada**

GitHub: https://github.com/vugarsafarzada

AIDLC-GUI was created and is maintained by Vugar Safarzada.

## License

[MIT](LICENSE)
