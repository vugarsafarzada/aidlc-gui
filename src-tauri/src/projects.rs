use crate::models::{
    ActivityInfo, ArtifactInfo, PhaseInfo, ProjectSnapshot, StageInfo, StageStatus,
};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use walkdir::{DirEntry, WalkDir};

const PHASES: [&str; 5] = ["Initialization", "Ideation", "Inception", "Construction", "Operation"];

fn allowed_entry(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    !matches!(name.as_ref(), ".git" | "node_modules" | "target" | "dist" | ".next" | "vendor")
}

pub fn canonical_project(path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|error| format!("Could not open project: {error}"))?;
    if !path.is_dir() {
        return Err("The selected project path is not a folder.".into());
    }
    Ok(path)
}

fn find_named_files(root: &Path, names: &[&str], max_depth: usize) -> Vec<PathBuf> {
    WalkDir::new(root)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(allowed_entry)
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && names.iter().any(|name| entry.file_name() == *name))
        .map(|entry| entry.into_path())
        .collect()
}

fn modified_millis(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn readable_name(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch: char| ch == '*' || ch == '`' || ch == '#' || ch == ':' || ch == '-' || ch.is_whitespace())
        .split(['-', '_'])
        .filter(|word| !word.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            chars.next().map(|first| first.to_uppercase().collect::<String>() + chars.as_str()).unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn slug(value: &str) -> String {
    value.to_lowercase().chars().map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' }).collect::<String>().split('-').filter(|item| !item.is_empty()).collect::<Vec<_>>().join("-")
}

fn field(content: &str, keys: &[&str]) -> Option<String> {
    for line in content.lines() {
        let clean = line.trim().trim_start_matches(['-', '*', '|', ' ']).trim();
        let lower = clean.to_lowercase();
        for key in keys {
            let key_lower = key.to_lowercase();
            if lower.starts_with(&key_lower) {
                let value = clean[key.len()..].trim_start_matches([':', '|', '*', '`', ' ']).trim_end_matches('|').trim().trim_matches(['*', '`', ' ']);
                if !value.is_empty() && value != "—" && value != "-" {
                    return Some(readable_name(value));
                }
            }
        }
    }
    None
}

fn phase_from_heading(line: &str) -> Option<String> {
    let normalized = line.trim_matches(['#', '*', ' ', ':']).to_lowercase();
    PHASES.iter().find(|phase| normalized.contains(&phase.to_lowercase())).map(|value| value.to_string())
}

fn parse_checkbox(line: &str) -> Option<(StageStatus, String)> {
    let clean = line.trim().trim_start_matches(['-', '*', ' ']).trim();
    if clean.len() < 4 || !clean.starts_with('[') { return None; }
    let marker = clean.chars().nth(1)?;
    if clean.chars().nth(2)? != ']' { return None; }
    let status = match marker {
        'x' | 'X' | '✓' => StageStatus::Completed,
        '-' | '~' => StageStatus::Skipped,
        '!' => StageStatus::Failed,
        _ => StageStatus::Pending,
    };
    let name = clean[3..].trim().split('|').next().unwrap_or_default().trim().trim_matches(['*', '`']);
    if name.is_empty() { None } else { Some((status, readable_name(name))) }
}

fn stages_from_markdown(content: &str, current_phase: Option<&str>, current_stage: Option<&str>, waiting: bool) -> Vec<PhaseInfo> {
    let mut grouped: BTreeMap<String, Vec<StageInfo>> = BTreeMap::new();
    let mut active_phase = current_phase.unwrap_or("Workflow").to_string();
    for line in content.lines() {
        if line.trim_start().starts_with('#') {
            if let Some(phase) = phase_from_heading(line) { active_phase = phase; }
        }
        if let Some((mut status, name)) = parse_checkbox(line) {
            if current_stage.is_some_and(|current| slug(current) == slug(&name)) && status == StageStatus::Pending {
                status = if waiting { StageStatus::Waiting } else { StageStatus::Running };
            }
            grouped.entry(active_phase.clone()).or_default().push(StageInfo {
                id: slug(&name), name, phase: active_phase.clone(), status, agent: None, details: None,
            });
        }
    }
    let mut result = Vec::new();
    for known in PHASES {
        if let Some(stages) = grouped.remove(known) { result.push(phase(known.to_string(), stages)); }
    }
    for (name, stages) in grouped { result.push(phase(name, stages)); }
    result
}

fn phase(name: String, stages: Vec<StageInfo>) -> PhaseInfo {
    let status = if stages.iter().any(|stage| stage.status == StageStatus::Failed) { StageStatus::Failed }
    else if stages.iter().any(|stage| stage.status == StageStatus::Waiting) { StageStatus::Waiting }
    else if stages.iter().any(|stage| stage.status == StageStatus::Running) { StageStatus::Running }
    else if !stages.is_empty() && stages.iter().all(|stage| matches!(stage.status, StageStatus::Completed | StageStatus::Skipped)) { StageStatus::Completed }
    else { StageStatus::Pending };
    PhaseInfo { name, status, stages }
}

fn relative_string(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/")
}

fn infer_stage(path: &Path) -> Option<String> {
    let value = path.to_string_lossy().to_lowercase();
    [
        ("requirements", "Requirements Analysis"), ("user-stor", "User Stories"), ("domain", "Domain Design"),
        ("architecture", "Architecture Design"), ("plan", "Code Planning"), ("test", "Testing"),
        ("deploy", "Deployment"), ("intent", "Intent Capture"), ("scope", "Scope Definition"),
    ].into_iter().find(|(token, _)| value.contains(token)).map(|(_, stage)| stage.to_string())
}

fn discover_artifacts(root: &Path, state_path: Option<&Path>) -> Vec<ArtifactInfo> {
    let search_root = state_path.and_then(Path::parent).unwrap_or(root);
    let mut artifacts: Vec<_> = WalkDir::new(search_root)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_entry(allowed_entry)
        .filter_map(Result::ok)
        .filter(|entry| {
            entry.file_type().is_file()
                && matches!(entry.path().extension().and_then(|ext| ext.to_str()), Some("md" | "json" | "yaml" | "yml" | "txt"))
                && entry.file_name() != "aidlc-state.md"
                && !entry.path().to_string_lossy().contains("runtime-graph")
                && !entry.path().to_string_lossy().contains("stage-graph")
        })
        .filter_map(|entry| {
            let path = entry.into_path();
            let metadata = fs::metadata(&path).ok()?;
            Some(ArtifactInfo {
                name: path.file_name()?.to_string_lossy().to_string(),
                relative_path: relative_string(root, &path),
                path: path.to_string_lossy().to_string(),
                stage: infer_stage(&path),
                modified_at: modified_millis(&path),
                size: metadata.len(),
            })
        }).collect();
    artifacts.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    artifacts.truncate(250);
    artifacts
}

fn value_text(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| value.get(*key)).and_then(|value| value.as_str().map(ToOwned::to_owned).or_else(|| value.as_i64().map(|number| number.to_string())))
}

fn discover_activity(root: &Path) -> Vec<ActivityInfo> {
    let mut paths = find_named_files(root, &["audit.jsonl", "audit-log.jsonl", "events.jsonl"], 9);
    paths.sort_by_key(|path| std::cmp::Reverse(modified_millis(path)));
    let mut events = Vec::new();
    for path in paths.into_iter().take(4) {
        let Ok(content) = fs::read_to_string(path) else { continue };
        for (index, line) in content.lines().rev().take(100).enumerate() {
            let Ok(value) = serde_json::from_str::<Value>(line) else { continue };
            let kind = value_text(&value, &["event", "type", "kind", "action"]).unwrap_or_else(|| "activity".into());
            let title = value_text(&value, &["title", "message", "summary", "event"]).unwrap_or_else(|| readable_name(&kind));
            let lower = format!("{kind} {title}").to_lowercase();
            if lower.contains("debug") || lower.contains("heartbeat") || lower.contains("token") { continue; }
            let status = if lower.contains("fail") || lower.contains("error") { StageStatus::Failed }
                else if lower.contains("approval") || lower.contains("wait") { StageStatus::Waiting }
                else if lower.contains("start") || lower.contains("running") { StageStatus::Running }
                else { StageStatus::Completed };
            events.push(ActivityInfo {
                id: value_text(&value, &["id"]).unwrap_or_else(|| format!("{}-{index}", modified_millis(root))),
                kind: readable_name(&kind), title, detail: value_text(&value, &["detail", "description", "stage", "agent"]),
                timestamp: value_text(&value, &["timestamp", "time", "createdAt", "created_at"]), status,
            });
        }
    }
    events.truncate(100);
    events
}

fn configured(root: &Path) -> bool {
    [".codex/skills/aidlc/SKILL.md", ".codex/skills/aidlc", ".claude/skills/aidlc/SKILL.md", "aidlc"]
        .iter().any(|candidate| root.join(candidate).exists())
}

fn path_context(path: Option<&Path>) -> (Option<String>, Option<String>) {
    let Some(path) = path else { return (None, None) };
    let parts: Vec<_> = path.components().map(|part| part.as_os_str().to_string_lossy().to_string()).collect();
    let space = parts.iter().position(|part| part == "spaces").and_then(|index| parts.get(index + 1)).cloned();
    let intent = parts.iter().position(|part| part == "intents").and_then(|index| parts.get(index + 1)).cloned();
    (space, intent)
}

pub fn inspect(path: &str) -> Result<ProjectSnapshot, String> {
    let root = canonical_project(path)?;
    let mut states = find_named_files(&root, &["aidlc-state.md"], 10);
    states.sort_by_key(|path| std::cmp::Reverse(modified_millis(path)));
    let state_path = states.first().cloned();
    let content = state_path.as_ref().and_then(|path| fs::read_to_string(path).ok()).unwrap_or_default();
    let current_phase = field(&content, &["current phase", "phase"]);
    let current_stage = field(&content, &["current stage", "stage"]);
    let current_agent = field(&content, &["current agent", "active agent", "agent"]);
    let scope = field(&content, &["scope"]);
    let depth = field(&content, &["depth"]);
    let lower = content.to_lowercase();
    let pending_approval = lower.contains("awaiting approval") || lower.contains("waiting for approval") || lower.contains("approval pending") || lower.contains("gate: open");
    let phases = stages_from_markdown(&content, current_phase.as_deref(), current_stage.as_deref(), pending_approval);
    let all_stages = phases.iter().flat_map(|phase| phase.stages.iter()).count();
    let completed = phases.iter().flat_map(|phase| phase.stages.iter()).filter(|stage| matches!(stage.status, StageStatus::Completed | StageStatus::Skipped)).count();
    let progress = if all_stages == 0 { 0 } else { ((completed * 100) / all_stages).min(100) as u8 };
    let artifacts = discover_artifacts(&root, state_path.as_deref());
    let activity = discover_activity(&root);
    let last_activity = state_path.as_ref().map(|path| modified_millis(path).to_string());
    let (current_space, current_intent) = path_context(state_path.as_deref());
    let name = root.file_name().map(|value| value.to_string_lossy().to_string()).unwrap_or_else(|| "Project".into());
    Ok(ProjectSnapshot {
        path: root.to_string_lossy().to_string(), name, configured: configured(&root),
        state_path: state_path.as_ref().map(|path| relative_string(&root, path)), current_intent, current_space,
        current_phase, current_stage, current_agent, scope, depth, progress, pending_approval,
        pending_approval_since: None, last_activity, phases, artifacts, activity, warnings: Vec::new(),
    })
}

pub fn secure_artifact(project_path: &str, artifact_path: &str) -> Result<PathBuf, String> {
    let root = canonical_project(project_path)?;
    let artifact = fs::canonicalize(artifact_path).map_err(|error| format!("Could not open artifact: {error}"))?;
    if !artifact.starts_with(&root) || !artifact.is_file() {
        return Err("Artifact access is limited to files inside the active project.".into());
    }
    Ok(artifact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_status_fields_and_checkboxes() {
        let text = "## Current Status\n**Current Phase**: Construction\n**Current Stage**: code-generation\n### Construction\n- [x] Code Planning\n- [ ] Code Generation\n- [ ] Testing\n";
        assert_eq!(field(text, &["current phase"]), Some("Construction".into()));
        let phases = stages_from_markdown(text, Some("Construction"), Some("Code Generation"), false);
        assert_eq!(phases[0].stages[1].status, StageStatus::Running);
    }

    #[test]
    fn normalizes_stage_slugs() {
        assert_eq!(slug("Requirements Analysis"), "requirements-analysis");
    }
}
