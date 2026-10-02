export type ViewId = "overview" | "workflow" | "artifacts" | "history" | "terminal" | "settings";

export type StageStatus = "completed" | "running" | "waiting" | "pending" | "skipped" | "failed";

export interface StageInfo {
  id: string;
  name: string;
  phase: string;
  status: StageStatus;
  agent?: string | null;
  details?: string | null;
}

export interface PhaseInfo {
  name: string;
  status: StageStatus;
  stages: StageInfo[];
}

export interface ArtifactInfo {
  name: string;
  path: string;
  relativePath: string;
  stage?: string | null;
  modifiedAt: number;
  size: number;
}

export interface ActivityInfo {
  id: string;
  kind: string;
  title: string;
  detail?: string | null;
  timestamp?: string | null;
  status: StageStatus;
}

export interface ProjectSnapshot {
  path: string;
  name: string;
  configured: boolean;
  statePath?: string | null;
  currentIntent?: string | null;
  currentSpace?: string | null;
  currentPhase?: string | null;
  currentStage?: string | null;
  currentAgent?: string | null;
  scope?: string | null;
  depth?: string | null;
  progress: number;
  pendingApproval: boolean;
  pendingApprovalSince?: string | null;
  lastActivity?: string | null;
  phases: PhaseInfo[];
  artifacts: ArtifactInfo[];
  activity: ActivityInfo[];
  warnings: string[];
}

export interface ToolStatus {
  codexAvailable: boolean;
  codexPath?: string | null;
  codexVersion?: string | null;
  aidlcAvailable: boolean;
  aidlcPath?: string | null;
  aidlcVersion?: string | null;
}

export interface RecentProject {
  path: string;
  name: string;
  openedAt: number;
  exists: boolean;
}

export interface Settings {
  codexPath: string;
  aidlcPath: string;
  shell: string;
  theme: "dark" | "light" | "system";
  terminalFontSize: number;
  terminalScrollback: number;
  openLastProject: boolean;
  debugMode: boolean;
}

export interface BootstrapState {
  settings: Settings;
  recents: RecentProject[];
  tools: ToolStatus;
}

export interface TerminalOutput {
  sessionId: string;
  data: string;
}

export interface TerminalExit {
  sessionId: string;
  code?: number | null;
}

export interface TerminalStarted {
  sessionId: string;
  command: string;
}
