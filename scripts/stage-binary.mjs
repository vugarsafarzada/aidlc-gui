import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = process.platform === "win32" ? "aidlc-gui.exe" : "aidlc-gui";
const rustTarget = process.argv[2] || process.env.CARGO_BUILD_TARGET;
const source = join(root, "src-tauri", "target", ...(rustTarget ? [rustTarget] : []), "release", executable);
if (!existsSync(source)) throw new Error(`Release binary not found at ${source}. Run the Tauri build first.`);
const targetDir = join(root, "binaries", `${process.platform}-${process.arch}`);
const target = join(targetDir, executable);
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
if (process.platform !== "win32") chmodSync(target, 0o755);
console.log(`Staged ${target}`);
