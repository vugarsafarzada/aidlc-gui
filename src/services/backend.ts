import { invoke } from "@tauri-apps/api/core";
import type { BootstrapState, ProjectSnapshot, Settings, TerminalStarted } from "../types";

export const isTauri = () => "__TAURI_INTERNALS__" in window;

const demoSettings: Settings = {
  codexPath: "",
  aidlcPath: "",
  shell: "",
  theme: "dark",
  terminalFontSize: 13,
  terminalScrollback: 10000,
  openLastProject: true,
  debugMode: false,
};

export const demoSnapshot: ProjectSnapshot = {
  path: "/Users/demo/projects/stellar-console",
  name: "stellar-console",
  configured: true,
  statePath: "aidlc/spaces/default/intents/260924-console/aidlc-state.md",
  currentIntent: "console",
  currentSpace: "default",
  currentPhase: "Construction",
  currentStage: "Code Generation",
  currentAgent: "Software Developer",
  scope: "Feature",
  depth: "Standard",
  progress: 62,
  pendingApproval: true,
  pendingApprovalSince: "12 minutes ago",
  lastActivity: new Date().toISOString(),
  warnings: [],
  phases: [
    { name: "Initialization", status: "completed", stages: [{ id: "workspace-detection", name: "Workspace Detection", phase: "Initialization", status: "completed" }] },
    { name: "Ideation", status: "completed", stages: [{ id: "intent-capture", name: "Intent Capture", phase: "Ideation", status: "completed" }, { id: "scope-definition", name: "Scope Definition", phase: "Ideation", status: "completed" }] },
    { name: "Inception", status: "completed", stages: [{ id: "requirements-analysis", name: "Requirements Analysis", phase: "Inception", status: "completed" }, { id: "domain-design", name: "Domain Design", phase: "Inception", status: "completed" }] },
    { name: "Construction", status: "waiting", stages: [{ id: "code-generation", name: "Code Generation", phase: "Construction", status: "waiting", agent: "Software Developer", details: "Waiting for plan approval" }, { id: "testing", name: "Testing", phase: "Construction", status: "pending" }] },
    { name: "Operation", status: "pending", stages: [{ id: "deployment", name: "Deployment", phase: "Operation", status: "pending" }] },
  ],
  artifacts: [
    { name: "requirements.md", path: "/demo/requirements.md", relativePath: "aidlc/artifacts/requirements.md", stage: "Requirements Analysis", modifiedAt: Date.now() - 7200000, size: 4200 },
    { name: "domain-design.md", path: "/demo/domain-design.md", relativePath: "aidlc/artifacts/domain-design.md", stage: "Domain Design", modifiedAt: Date.now() - 4200000, size: 8100 },
    { name: "implementation-plan.md", path: "/demo/implementation-plan.md", relativePath: "aidlc/artifacts/implementation-plan.md", stage: "Code Planning", modifiedAt: Date.now() - 900000, size: 5600 },
  ],
  activity: [
    { id: "1", kind: "approval", title: "Plan approval requested", detail: "Code Generation is waiting for your decision", timestamp: new Date(Date.now() - 720000).toISOString(), status: "waiting" },
    { id: "2", kind: "artifact", title: "Implementation plan created", detail: "implementation-plan.md", timestamp: new Date(Date.now() - 900000).toISOString(), status: "completed" },
    { id: "3", kind: "stage", title: "Domain Design completed", timestamp: new Date(Date.now() - 4200000).toISOString(), status: "completed" },
  ],
};

export async function bootstrap(): Promise<BootstrapState> {
  if (!isTauri()) return { settings: demoSettings, recents: [], tools: { codexAvailable: true, codexVersion: "codex-cli 0.160.0", aidlcAvailable: true, aidlcVersion: "aidlc 2.9.0" } };
  return invoke("bootstrap");
}

export async function chooseProject(): Promise<string | null> {
  if (!isTauri()) return demoSnapshot.path;
  return invoke("choose_project");
}

export async function openProject(path: string): Promise<ProjectSnapshot> {
  if (!isTauri()) return { ...demoSnapshot, path, name: path.split(/[\\/]/).pop() || "Project" };
  return invoke("open_project", { path });
}

export async function refreshProject(path: string): Promise<ProjectSnapshot> {
  if (!isTauri()) return demoSnapshot;
  return invoke("inspect_project", { path });
}

export async function removeRecent(path: string): Promise<void> {
  if (!isTauri()) return;
  return invoke("remove_recent", { path });
}

export async function saveSettings(settings: Settings): Promise<BootstrapState> {
  if (!isTauri()) return { settings, recents: [], tools: { codexAvailable: true, codexVersion: "codex-cli 0.160.0", aidlcAvailable: true, aidlcVersion: "aidlc 2.9.0" } };
  return invoke("save_settings", { settings });
}

export async function configureProject(path: string): Promise<string> {
  if (!isTauri()) return "Demo mode: configuration complete.";
  return invoke("configure_project", { path });
}

export async function readArtifact(projectPath: string, artifactPath: string): Promise<string> {
  if (!isTauri()) return `# ${artifactPath.split("/").pop()}\n\nThis is a browser preview. Open AIDLC-GUI through Tauri to read project artifacts.`;
  return invoke("read_artifact", { projectPath, artifactPath });
}

export async function revealArtifact(projectPath: string, artifactPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke("reveal_artifact", { projectPath, artifactPath });
}

export async function openArtifact(projectPath: string, artifactPath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke("open_artifact", { projectPath, artifactPath });
}

export async function startTerminal(projectPath: string, rows: number, cols: number): Promise<TerminalStarted> {
  if (!isTauri()) return { sessionId: "demo", command: "codex" };
  return invoke("terminal_start", { projectPath, rows, cols });
}

export async function writeTerminal(sessionId: string, data: string): Promise<void> {
  if (!isTauri()) return;
  return invoke("terminal_write", { sessionId, data });
}

export async function resizeTerminal(sessionId: string, rows: number, cols: number): Promise<void> {
  if (!isTauri()) return;
  return invoke("terminal_resize", { sessionId, rows, cols });
}

export async function stopTerminal(sessionId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke("terminal_stop", { sessionId });
}
