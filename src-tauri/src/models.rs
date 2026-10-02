use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub codex_path: String,
    pub aidlc_path: String,
    pub shell: String,
    pub theme: String,
    pub terminal_font_size: u16,
    pub terminal_scrollback: u32,
    pub open_last_project: bool,
    pub debug_mode: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            codex_path: String::new(),
            aidlc_path: String::new(),
            shell: String::new(),
            theme: "dark".into(),
            terminal_font_size: 13,
            terminal_scrollback: 10_000,
            open_last_project: true,
            debug_mode: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub path: String,
    pub name: String,
    pub opened_at: u64,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersistedState {
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub recents: Vec<RecentProject>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub codex_available: bool,
    pub codex_path: Option<String>,
    pub codex_version: Option<String>,
    pub aidlc_available: bool,
    pub aidlc_path: Option<String>,
    pub aidlc_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapState {
    pub settings: Settings,
    pub recents: Vec<RecentProject>,
    pub tools: ToolStatus,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StageStatus {
    Completed,
    Running,
    Waiting,
    Pending,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageInfo {
    pub id: String,
    pub name: String,
    pub phase: String,
    pub status: StageStatus,
    pub agent: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseInfo {
    pub name: String,
    pub status: StageStatus,
    pub stages: Vec<StageInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactInfo {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub stage: Option<String>,
    pub modified_at: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityInfo {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub detail: Option<String>,
    pub timestamp: Option<String>,
    pub status: StageStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub path: String,
    pub name: String,
    pub configured: bool,
    pub state_path: Option<String>,
    pub current_intent: Option<String>,
    pub current_space: Option<String>,
    pub current_phase: Option<String>,
    pub current_stage: Option<String>,
    pub current_agent: Option<String>,
    pub scope: Option<String>,
    pub depth: Option<String>,
    pub progress: u8,
    pub pending_approval: bool,
    pub pending_approval_since: Option<String>,
    pub last_activity: Option<u64>,
    pub phases: Vec<PhaseInfo>,
    pub artifacts: Vec<ArtifactInfo>,
    pub activity: Vec<ActivityInfo>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExit {
    pub session_id: String,
    pub code: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStarted {
    pub session_id: String,
    pub command: String,
}
