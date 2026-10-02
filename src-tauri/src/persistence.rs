use crate::models::PersistedState;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub persisted: Mutex<PersistedState>,
    pub file_path: PathBuf,
}

impl AppState {
    pub fn load(app: &AppHandle) -> Self {
        let file_path = app
            .path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("aidlc-gui"))
            .join("state.json");
        let persisted = fs::read_to_string(&file_path)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        Self { persisted: Mutex::new(persisted), file_path }
    }

    pub fn save(&self) -> Result<(), String> {
        let state = self.persisted.lock().map_err(|_| "Application state is unavailable")?;
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("Could not create app settings directory: {error}"))?;
        }
        let content = serde_json::to_string_pretty(&*state).map_err(|error| error.to_string())?;
        fs::write(&self.file_path, content).map_err(|error| format!("Could not save settings: {error}"))
    }
}
