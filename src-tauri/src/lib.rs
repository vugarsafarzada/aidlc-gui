mod models;
mod persistence;
mod projects;
mod terminal;

use models::{
    BootstrapState, ProjectSnapshot, RecentProject, Settings, TerminalStarted, ToolStatus,
};
use persistence::AppState;
use std::{
    fs,
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State, WindowEvent};
use terminal::TerminalManager;

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}

fn resolve_tool(configured: &str, fallback: &str) -> Option<String> {
    let target = if configured.trim().is_empty() {
        fallback
    } else {
        configured.trim()
    };
    which::which(target)
        .ok()
        .map(|path| path.to_string_lossy().to_string())
        .or_else(|| {
            let path = Path::new(target);
            path.is_file().then(|| path.to_string_lossy().to_string())
        })
}

fn version(executable: Option<&String>) -> Option<String> {
    let executable = executable?;
    let output = Command::new(executable).arg("--version").output().ok()?;
    let text = if output.stdout.is_empty() {
        &output.stderr
    } else {
        &output.stdout
    };
    let value = String::from_utf8_lossy(text)
        .lines()
        .next()?
        .trim()
        .to_string();
    (!value.is_empty()).then_some(value)
}

fn tools(settings: &Settings) -> ToolStatus {
    let codex_path = resolve_tool(&settings.codex_path, "codex");
    let aidlc_path = resolve_tool(&settings.aidlc_path, "aidlc");
    ToolStatus {
        codex_available: codex_path.is_some(),
        codex_version: version(codex_path.as_ref()),
        codex_path,
        aidlc_available: aidlc_path.is_some(),
        aidlc_version: version(aidlc_path.as_ref()),
        aidlc_path,
    }
}

fn bootstrap_value(state: &State<'_, AppState>) -> Result<BootstrapState, String> {
    let mut persisted = state
        .persisted
        .lock()
        .map_err(|_| "Application state is unavailable")?;
    for recent in &mut persisted.recents {
        recent.exists = Path::new(&recent.path).is_dir();
    }
    let settings = persisted.settings.clone();
    let recents = persisted.recents.clone();
    drop(persisted);
    Ok(BootstrapState {
        tools: tools(&settings),
        settings,
        recents,
    })
}

#[tauri::command]
fn bootstrap(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    bootstrap_value(&state)
}

#[tauri::command]
fn choose_project() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Open a project in AIDLC-GUI")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn inspect_project(path: String) -> Result<ProjectSnapshot, String> {
    projects::inspect(&path)
}

#[tauri::command]
fn open_project(path: String, state: State<'_, AppState>) -> Result<ProjectSnapshot, String> {
    let snapshot = projects::inspect(&path)?;
    {
        let mut persisted = state
            .persisted
            .lock()
            .map_err(|_| "Application state is unavailable")?;
        persisted
            .recents
            .retain(|recent| recent.path != snapshot.path);
        persisted.recents.insert(
            0,
            RecentProject {
                path: snapshot.path.clone(),
                name: snapshot.name.clone(),
                opened_at: now_millis(),
                exists: true,
            },
        );
        persisted.recents.truncate(10);
    }
    state.save()?;
    Ok(snapshot)
}

#[tauri::command]
fn remove_recent(path: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .persisted
        .lock()
        .map_err(|_| "Application state is unavailable")?
        .recents
        .retain(|recent| recent.path != path);
    state.save()
}

#[tauri::command]
fn save_settings(settings: Settings, state: State<'_, AppState>) -> Result<BootstrapState, String> {
    if !(10..=24).contains(&settings.terminal_font_size) {
        return Err("Terminal font size must be between 10 and 24.".into());
    }
    if !(1_000..=100_000).contains(&settings.terminal_scrollback) {
        return Err("Terminal scrollback must be between 1,000 and 100,000 lines.".into());
    }
    state
        .persisted
        .lock()
        .map_err(|_| "Application state is unavailable")?
        .settings = settings;
    state.save()?;
    bootstrap_value(&state)
}

#[tauri::command]
fn configure_project(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let project = projects::canonical_project(&path)?;
    let settings = state
        .persisted
        .lock()
        .map_err(|_| "Application state is unavailable")?
        .settings
        .clone();
    let executable = resolve_tool(&settings.aidlc_path, "aidlc")
        .ok_or("AI-DLC is not installed. Run `aidlc-gui setup` first.")?;
    let output = Command::new(executable)
        .args(["config", "--harness", "codex"])
        .current_dir(project)
        .output()
        .map_err(|error| format!("Could not run AI-DLC configuration: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(if stdout.is_empty() {
            "AI-DLC configured for Codex.".into()
        } else {
            stdout
        })
    } else {
        Err(if stderr.is_empty() {
            "AI-DLC configuration failed.".into()
        } else {
            stderr
        })
    }
}

#[tauri::command]
fn read_artifact(project_path: String, artifact_path: String) -> Result<String, String> {
    let path = projects::secure_artifact(&project_path, &artifact_path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 2 * 1024 * 1024 {
        return Err("Artifact is larger than the 2 MB viewer limit.".into());
    }
    fs::read_to_string(path).map_err(|error| format!("Artifact is not readable text: {error}"))
}

#[tauri::command]
fn reveal_artifact(project_path: String, artifact_path: String) -> Result<(), String> {
    let path = projects::secure_artifact(&project_path, &artifact_path)?;
    opener::reveal(path).map_err(|error| format!("Could not reveal artifact: {error}"))
}

#[tauri::command]
fn open_artifact(project_path: String, artifact_path: String) -> Result<(), String> {
    let path = projects::secure_artifact(&project_path, &artifact_path)?;
    opener::open(path).map_err(|error| format!("Could not open artifact: {error}"))
}

#[tauri::command]
fn terminal_start(
    app: AppHandle,
    project_path: String,
    rows: u16,
    cols: u16,
    state: State<'_, AppState>,
    terminal: State<'_, TerminalManager>,
) -> Result<TerminalStarted, String> {
    let project = projects::canonical_project(&project_path)?;
    let settings = state
        .persisted
        .lock()
        .map_err(|_| "Application state is unavailable")?
        .settings
        .clone();
    let executable = resolve_tool(&settings.codex_path, "codex")
        .ok_or("Codex CLI was not found. Set its path in Settings.")?;
    terminal.start(app, &project, &executable, rows, cols)
}

#[tauri::command]
fn terminal_write(
    session_id: String,
    data: String,
    terminal: State<'_, TerminalManager>,
) -> Result<(), String> {
    if data.len() > 1024 * 1024 {
        return Err("Terminal input is too large.".into());
    }
    terminal.write(&session_id, &data)
}

#[tauri::command]
fn terminal_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    terminal: State<'_, TerminalManager>,
) -> Result<(), String> {
    terminal.resize(&session_id, rows, cols)
}

#[tauri::command]
fn terminal_stop(session_id: String, terminal: State<'_, TerminalManager>) -> Result<(), String> {
    terminal.stop(&session_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = AppState::load(app.handle());
            app.manage(state);
            app.manage(TerminalManager::default());
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                window.state::<TerminalManager>().stop_all();
            }
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            choose_project,
            inspect_project,
            open_project,
            remove_recent,
            save_settings,
            configure_project,
            read_artifact,
            open_artifact,
            reveal_artifact,
            terminal_start,
            terminal_write,
            terminal_resize,
            terminal_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AIDLC-GUI");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_tools_from_path_without_shell_interpolation() {
        assert!(resolve_tool("", "rustc").is_some());
        assert!(resolve_tool("definitely-not-an-aidlc-gui-tool", "ignored").is_none());
    }
}
