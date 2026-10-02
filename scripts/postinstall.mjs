import { spawnSync } from "node:child_process";

if (process.env.AIDLC_GUI_SKIP_CHECK === "1") process.exit(0);
const installed = spawnSync("aidlc", ["--version"], { stdio: "ignore", shell: false }).status === 0;
if (!installed) {
  console.log("\nAIDLC-GUI: AI-DLC was not found. Run `aidlc-gui setup` to install it from the official AWS Labs release.\n");
}
