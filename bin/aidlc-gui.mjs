#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore", shell: false }).status === 0;
}

async function setup() {
  if (commandExists("aidlc")) {
    const result = spawnSync("aidlc", ["--version"], { encoding: "utf8", shell: false });
    console.log(`AI-DLC is already installed (${(result.stdout || result.stderr).trim()}). Keeping the existing installation.`);
    return;
  }
  console.log("AI-DLC is not installed. Installing from the current official AWS Labs release…");
  if (process.platform === "win32") {
    const result = spawnSync("powershell.exe", [
      "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
      "irm https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 | iex",
    ], { stdio: "inherit", shell: false });
    if (result.status !== 0) throw new Error("The official AI-DLC PowerShell installer failed.");
  } else {
    const url = "https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh";
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`Could not download the official AI-DLC installer (${response.status}).`);
    const directory = mkdtempSync(join(tmpdir(), "aidlc-gui-setup-"));
    const installer = join(directory, "install.sh");
    try {
      writeFileSync(installer, await response.text(), { mode: 0o700 });
      chmodSync(installer, 0o700);
      const result = spawnSync("sh", [installer], { stdio: "inherit", shell: false });
      if (result.status !== 0) throw new Error("The official AI-DLC installer failed.");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  if (!commandExists("aidlc")) {
    throw new Error("AI-DLC installed, but this terminal cannot find it yet. Open a new terminal and run `aidlc --version`.");
  }
  console.log("AI-DLC setup complete.");
}

function launch() {
  const executable = process.platform === "win32" ? "aidlc-gui.exe" : "aidlc-gui";
  const platform = `${process.platform}-${process.arch}`;
  const candidates = [
    process.env.AIDLC_GUI_BINARY,
    join(packageRoot, "binaries", platform, executable),
    join(packageRoot, "src-tauri", "target", "release", executable),
    join(packageRoot, "src-tauri", "target", "debug", executable),
  ].filter(Boolean);
  const binary = candidates.find((candidate) => existsSync(candidate));
  if (!binary) {
    console.error(`No AIDLC-GUI binary was found for ${platform}.`);
    console.error("If you installed from source, run `pnpm tauri:build`. Package maintainers must include binaries/<platform-arch>/aidlc-gui in the npm release.");
    process.exit(1);
  }
  const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit", shell: false, windowsHide: false });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

try {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "--help" || action === "-h") console.log("AIDLC-GUI\n\n  aidlc-gui          Launch the desktop app\n  aidlc-gui setup    Install AI-DLC using the current official installer\n  aidlc-gui --help   Show this help");
  else launch();
} catch (error) {
  console.error(`AIDLC-GUI: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
