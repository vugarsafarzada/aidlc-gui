use crate::models::{TerminalExit, TerminalOutput, TerminalStarted};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::Path,
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

struct Session {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

#[derive(Default)]
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, Session>>,
}

impl TerminalManager {
    pub fn start(
        &self,
        app: AppHandle,
        project_path: &Path,
        codex_path: &str,
        rows: u16,
        cols: u16,
    ) -> Result<TerminalStarted, String> {
        self.stop_all();
        let system = native_pty_system();
        let pair = system.openpty(PtySize {
            rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0,
        }).map_err(|error| format!("Could not create terminal: {error}"))?;
        let executable = if codex_path.trim().is_empty() { "codex" } else { codex_path.trim() };
        let mut command = CommandBuilder::new(executable);
        command.cwd(project_path);
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command.env("FORCE_COLOR", "1");
        let child = pair.slave.spawn_command(command).map_err(|error| format!("Could not start Codex: {error}"))?;
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().map_err(|error| format!("Could not attach terminal output: {error}"))?;
        let writer = pair.master.take_writer().map_err(|error| format!("Could not attach terminal input: {error}"))?;
        let session_id = Uuid::new_v4().to_string();
        let session = Session {
            writer: Arc::new(Mutex::new(writer)), master: Arc::new(Mutex::new(pair.master)), child: Arc::new(Mutex::new(child)),
        };
        self.sessions.lock().map_err(|_| "Terminal manager is unavailable")?.insert(session_id.clone(), session);
        let reader_session = session_id.clone();
        thread::spawn(move || {
            let mut buffer = [0_u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => {
                        let data = String::from_utf8_lossy(&buffer[..count]).to_string();
                        let _ = app.emit("terminal-output", TerminalOutput { session_id: reader_session.clone(), data });
                    }
                    Err(_) => break,
                }
            }
            let _ = app.emit("terminal-exit", TerminalExit { session_id: reader_session, code: None });
        });
        Ok(TerminalStarted { session_id, command: executable.to_string() })
    }

    pub fn write(&self, id: &str, data: &str) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|_| "Terminal manager is unavailable")?;
        let session = sessions.get(id).ok_or("Terminal session is no longer active")?;
        let mut writer = session.writer.lock().map_err(|_| "Terminal input is unavailable")?;
        writer.write_all(data.as_bytes()).and_then(|_| writer.flush()).map_err(|error| format!("Could not write to terminal: {error}"))
    }

    pub fn resize(&self, id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|_| "Terminal manager is unavailable")?;
        let session = sessions.get(id).ok_or("Terminal session is no longer active")?;
        let result = session.master.lock().map_err(|_| "Terminal is unavailable")?.resize(PtySize {
            rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0,
        }).map_err(|error| format!("Could not resize terminal: {error}"));
        result
    }

    pub fn stop(&self, id: &str) -> Result<(), String> {
        let session = self.sessions.lock().map_err(|_| "Terminal manager is unavailable")?.remove(id);
        if let Some(session) = session {
            let _ = session.child.lock().map_err(|_| "Terminal process is unavailable")?.kill();
        }
        Ok(())
    }

    pub fn stop_all(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, session) in sessions.drain() {
                if let Ok(mut child) = session.child.lock() { let _ = child.kill(); }
            }
        }
    }
}
