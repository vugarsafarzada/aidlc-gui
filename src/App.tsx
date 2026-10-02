import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BookOpen, Check, ChevronRight, CircleDot,
  Clock3, Command, FileCode2, FileText, Folder, FolderOpen, GitBranch, History,
  LayoutDashboard, Loader2, Menu, MessageSquareText, MoreHorizontal, Play, Plus,
  RefreshCw, Search, Settings as SettingsIcon, ShieldCheck, Sparkles, TerminalSquare,
  Trash2, Wrench, X,
} from "lucide-react";
import { Brand } from "./components/Brand";
import { MarkdownModal } from "./components/MarkdownModal";
import { StatusDot } from "./components/StatusDot";
import { TerminalPanel } from "./components/TerminalPanel";
import { commandForApproval, optionsCommand, workflowCommand, type CommandOptions } from "./lib/commands";
import {
  bootstrap, chooseProject, configureProject, openProject, refreshProject, removeRecent, saveSettings,
} from "./services/backend";
import type { ArtifactInfo, BootstrapState, PhaseInfo, ProjectSnapshot, Settings, StageInfo, ViewId } from "./types";

const NAV: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "workflow", label: "Workflow", icon: GitBranch },
  { id: "artifacts", label: "Artifacts", icon: FileText },
  { id: "history", label: "History", icon: History },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const initialSettings: Settings = {
  codexPath: "", aidlcPath: "", shell: "", theme: "dark", terminalFontSize: 13,
  terminalScrollback: 10000, openLastProject: true, debugMode: false,
};

function timeAgo(value?: string | number | null) {
  if (!value) return "No activity yet";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function App() {
  const [boot, setBoot] = useState<BootstrapState | null>(null);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(270);
  const sendRef = useRef<(command: string) => void>(() => undefined);

  const loadProject = useCallback(async (path: string) => {
    setLoading(true); setError("");
    try { setProject(await openProject(path)); }
    catch (reason) { setError(String(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    bootstrap().then((state) => {
      setBoot(state);
      const recent = state.settings.openLastProject ? state.recents.find((item) => item.exists) : undefined;
      if (recent) void loadProject(recent.path); else setLoading(false);
    }).catch((reason) => { setError(String(reason)); setLoading(false); });
  }, [loadProject]);

  useEffect(() => {
    if (!boot) return;
    const preference = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      const theme = boot.settings.theme === "system"
        ? (preference.matches ? "light" : "dark")
        : boot.settings.theme;
      document.documentElement.dataset.theme = theme;
    };
    applyTheme();
    preference.addEventListener("change", applyTheme);
    return () => preference.removeEventListener("change", applyTheme);
  }, [boot?.settings.theme]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setInterval(() => {
      refreshProject(project.path).then(setProject).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [project?.path]);

  const pickProject = async () => {
    const path = await chooseProject();
    if (path) await loadProject(path);
  };

  const send = useCallback((command: string) => {
    sendRef.current(command);
    setTerminalExpanded(true);
  }, []);

  if (loading && !boot) return <div className="splash"><Brand /><Loader2 className="spin" size={22} /></div>;
  if (!boot) return <div className="splash"><Brand /><p className="error-text">{error || "Unable to start AIDLC-GUI."}</p></div>;

  if (!project) return <Welcome boot={boot} onChoose={pickProject} onOpen={loadProject} onRemove={async (path) => { await removeRecent(path); setBoot(await bootstrap()); }} error={error} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__top"><Brand /><button className="icon-button sidebar__menu"><Menu size={16} /></button></div>
        <nav className="sidebar__nav">
          <span className="nav-label">Workspace</span>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? "nav-item--active" : ""}`} onClick={() => { setActiveView(id); if (id === "terminal") setTerminalExpanded(true); }}>
              <Icon size={16} /><span>{label}</span>
              {id === "workflow" && project.pendingApproval && <span className="nav-badge">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar__project">
          <span className="nav-label">Active project</span>
          <button className="project-switcher" onClick={pickProject}>
            <span className="project-icon"><Folder size={16} /></span>
            <span><strong>{project.name}</strong><small>{project.path}</small></span>
            <MoreHorizontal size={15} />
          </button>
        </div>
        <div className="sidebar__foot">
          <div className="unofficial"><ShieldCheck size={14} /><span>Local-first<br /><small>Unofficial community app</small></span></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>{project.name}</span><ChevronRight size={13} /><strong>{NAV.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar__actions">
            <button className="search-button"><Search size={14} /><span>Quick find</span><kbd>⌘ K</kbd></button>
            <div className="connection-pill"><StatusDot status={boot.tools.codexAvailable ? "online" : "offline"} pulse={boot.tools.codexAvailable} />{boot.tools.codexAvailable ? "Codex connected" : "Codex missing"}</div>
          </div>
        </header>
        <div className={`content ${terminalExpanded ? "content--with-terminal" : ""}`} style={{ paddingBottom: terminalExpanded ? terminalHeight - 12 : undefined }}>
          {error && <div className="inline-alert inline-alert--error"><AlertTriangle size={16} />{error}<button onClick={() => setError("")}><X size={14} /></button></div>}
          {activeView === "overview" && <Overview project={project} boot={boot} onSend={send} onNavigate={setActiveView} onRefresh={() => refreshProject(project.path).then(setProject)} />}
          {activeView === "workflow" && <Workflow project={project} onSend={send} />}
          {activeView === "artifacts" && <Artifacts project={project} />}
          {activeView === "history" && <HistoryView project={project} />}
          {activeView === "terminal" && <TerminalFocus />}
          {activeView === "settings" && <SettingsView settings={boot.settings} tools={boot.tools} onSave={async (settings) => setBoot(await saveSettings(settings))} />}
        </div>
        <TerminalPanel projectPath={project.path} fontSize={boot.settings.terminalFontSize} scrollback={boot.settings.terminalScrollback} height={terminalHeight} onHeightChange={setTerminalHeight} expanded={terminalExpanded || activeView === "terminal"} onExpandedChange={setTerminalExpanded} onReady={(sendCommand) => { sendRef.current = sendCommand; }} />
      </main>
    </div>
  );
}

function Welcome({ boot, onChoose, onOpen, onRemove, error }: { boot: BootstrapState; onChoose: () => void; onOpen: (path: string) => void; onRemove: (path: string) => void; error: string }) {
  return (
    <main className="welcome">
      <div className="welcome__glow" />
      <header className="welcome__header"><Brand /><div className="unofficial-tag">Unofficial community interface</div></header>
      <section className="welcome__hero">
        <div className="eyebrow"><Sparkles size={14} /> Structured development, made visible</div>
        <h1>Your AI-DLC workflow,<br /><span>in one focused workspace.</span></h1>
        <p>A polished visual layer for AWS Labs AI-DLC—with a real Codex terminal always within reach.</p>
        <button className="primary-button primary-button--large" onClick={onChoose}><FolderOpen size={17} /> Open a project <ArrowRight size={16} /></button>
        {error && <p className="error-text">{error}</p>}
      </section>
      <section className="welcome__bottom">
        <div className="recents">
          <div className="section-title"><div><span>Recent projects</span><small>Pick up where you left off</small></div></div>
          {boot.recents.length === 0 ? (
            <button className="recent-empty" onClick={onChoose}><Plus size={17} /><span><strong>Open your first project</strong><small>Choose any local project folder</small></span></button>
          ) : boot.recents.map((item) => (
            <div className={`recent-row ${!item.exists ? "recent-row--missing" : ""}`} key={item.path}>
              <button onClick={() => item.exists && onOpen(item.path)} disabled={!item.exists}><span className="recent-icon"><Folder size={17} /></span><span><strong>{item.name}</strong><small>{item.path}</small></span><time>{item.exists ? timeAgo(item.openedAt) : "Missing"}</time><ChevronRight size={15} /></button>
              <button className="recent-remove" onClick={() => onRemove(item.path)} title="Remove from recents"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="readiness">
          <div className="section-title"><div><span>System readiness</span><small>Local tools detected on this machine</small></div></div>
          <ToolRow label="Codex CLI" available={boot.tools.codexAvailable} detail={boot.tools.codexVersion} />
          <ToolRow label="AI-DLC" available={boot.tools.aidlcAvailable} detail={boot.tools.aidlcVersion} />
        </div>
      </section>
      <footer className="welcome__footer"><span>AIDLC-GUI is an unofficial community interface for AWS Labs AI-DLC. It is not an AWS product.</span><span>Local-first · No project data leaves your machine</span></footer>
    </main>
  );
}

function ToolRow({ label, available, detail }: { label: string; available: boolean; detail?: string | null }) {
  return <div className="tool-row"><span className={`tool-icon ${available ? "tool-icon--ok" : "tool-icon--bad"}`}>{available ? <Check size={15} /> : <X size={15} />}</span><span><strong>{label}</strong><small>{detail || (available ? "Available" : "Not found")}</small></span><span className={available ? "success-text" : "error-text"}>{available ? "Ready" : "Action needed"}</span></div>;
}

function Overview({ project, boot, onSend, onNavigate, onRefresh }: { project: ProjectSnapshot; boot: BootstrapState; onSend: (value: string) => void; onNavigate: (view: ViewId) => void; onRefresh: () => void }) {
  const [prompt, setPrompt] = useState("");
  const runPrompt = () => { if (prompt.trim()) { onSend(workflowCommand("prompt", prompt)); setPrompt(""); } };
  const currentStages = project.phases.flatMap((phase) => phase.stages).slice(-5);
  return (
    <div className="page overview-page">
      <div className="page-heading">
        <div><div className="eyebrow">Project overview</div><h2>{project.name}</h2><p className="path-line"><Folder size={13} />{project.path}</p></div>
        <button className="secondary-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
      </div>
      {!project.configured && <SetupBanner project={project} onConfigured={onRefresh} />}
      {project.pendingApproval && (
        <div className="approval-banner"><div className="approval-banner__icon"><MessageSquareText size={19} /></div><div><strong>AI-DLC is waiting for your approval</strong><span>{project.currentStage || "Current stage"} needs a response before the workflow can continue.</span></div><button className="secondary-button" onClick={() => onSend(commandForApproval(false))}>Request changes</button><button className="primary-button" onClick={() => onSend(commandForApproval(true))}><Check size={14} /> Approve</button></div>
      )}
      <div className="overview-grid">
        <section className="main-column">
          <div className="prompt-panel">
            <div className="prompt-panel__top"><div><Sparkles size={17} /><strong>What would you like AI-DLC to work on?</strong></div><span>Sent to your active Codex session</span></div>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runPrompt(); }} placeholder="Describe a feature, bug, or change…" rows={4} />
            <div className="prompt-panel__foot"><span><kbd>⌘</kbd> <kbd>↵</kbd> to run</span><button className="primary-button" disabled={!prompt.trim()} onClick={runPrompt}><Play size={14} fill="currentColor" /> Run workflow</button></div>
          </div>
          <section className="panel workflow-snapshot">
            <div className="panel__header"><div><span className="panel-kicker">Current workflow</span><h3>{project.currentIntent || "No active intent"}</h3></div><button className="link-button" onClick={() => onNavigate("workflow")}>View workflow <ArrowRight size={13} /></button></div>
            <div className="progress-block"><div className="progress-meta"><span>{project.currentPhase || "Not started"} · {project.currentStage || "Choose an action"}</span><strong>{project.progress}%</strong></div><div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div></div>
            <div className="stage-strip">{currentStages.map((stage) => <StageMini key={stage.id} stage={stage} />)}</div>
          </section>
        </section>
        <aside className="side-column">
          <section className="panel status-panel"><div className="panel__header"><div><span className="panel-kicker">Environment</span><h3>Project health</h3></div><CircleDot size={17} className="muted" /></div>
            <StatusRow label="Codex CLI" value={boot.tools.codexAvailable ? "Available" : "Missing"} ok={boot.tools.codexAvailable} />
            <StatusRow label="AI-DLC" value={boot.tools.aidlcVersion?.replace(/^aidlc\s+/i, "") || "Missing"} ok={boot.tools.aidlcAvailable} />
            <StatusRow label="Project config" value={project.configured ? "Configured" : "Not configured"} ok={project.configured} />
            <StatusRow label="Active space" value={project.currentSpace || "—"} ok={Boolean(project.currentSpace)} />
          </section>
          <section className="panel quick-actions"><div className="panel__header"><div><span className="panel-kicker">Commands</span><h3>Quick actions</h3></div><Command size={16} className="muted" /></div>
            <div className="action-grid">
              <QuickAction icon={Play} label="Start" onClick={() => onSend(workflowCommand("start"))} />
              <QuickAction icon={RefreshCw} label="Resume" onClick={() => onSend(workflowCommand("resume"))} />
              <QuickAction icon={Activity} label="Status" onClick={() => onSend(workflowCommand("status"))} />
              <QuickAction icon={Wrench} label="Doctor" onClick={() => onSend(workflowCommand("doctor"))} />
            </div>
            <button className="wide-action" onClick={() => { setPrompt(""); document.querySelector<HTMLTextAreaElement>(".prompt-panel textarea")?.focus(); }}><Plus size={14} /> New intent</button>
          </section>
          <section className="last-activity"><Clock3 size={14} /><div><span>Last activity</span><strong>{timeAgo(project.lastActivity)}</strong></div></section>
        </aside>
      </div>
    </div>
  );
}

function SetupBanner({ project, onConfigured }: { project: ProjectSnapshot; onConfigured: () => void }) {
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  const configure = async () => { setWorking(true); try { setMessage(await configureProject(project.path)); onConfigured(); } catch (reason) { setMessage(String(reason)); } finally { setWorking(false); } };
  return <div className="setup-banner"><AlertTriangle size={18} /><div><strong>AI-DLC is not configured in this project</strong><span>Configure the Codex harness to enable workflow controls and project state.</span>{message && <small>{message}</small>}</div><button className="primary-button" onClick={configure} disabled={working}>{working && <Loader2 className="spin" size={14} />} Configure project</button></div>;
}

function StageMini({ stage }: { stage: StageInfo }) { return <div className={`stage-mini stage-mini--${stage.status}`}><span>{stage.status === "completed" ? <Check size={12} /> : stage.status === "running" || stage.status === "waiting" ? <span className="stage-pulse" /> : <span />}</span><small>{stage.name}</small></div>; }
function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div className="status-row"><span>{label}</span><span><StatusDot status={ok ? "completed" : "failed"} />{value}</span></div>; }
function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Play; label: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><Icon size={16} /><span>{label}</span></button>; }

function Workflow({ project, onSend }: { project: ProjectSnapshot; onSend: (command: string) => void }) {
  const [selected, setSelected] = useState<StageInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<CommandOptions>({ scope: "", depth: project.depth?.toLowerCase() || "standard", testStrategy: "standard", review: "advisory", guardPolicy: "strict" });
  const generated = optionsCommand(options);
  const sendGenerated = () => {
    const changesScope = options.scope && options.scope !== project.scope?.toLowerCase();
    if (!changesScope || window.confirm(`Change this workflow to the “${options.scope}” scope? AI-DLC will recalculate pending stages.`)) onSend(generated);
  };
  return <div className="page workflow-page">
    <div className="page-heading"><div><div className="eyebrow">Workflow map</div><h2>{project.currentIntent || "AI-DLC workflow"}</h2><p>Official state from {project.statePath || "the selected project"}</p></div><div className="row"><button className="secondary-button" onClick={() => onSend(workflowCommand("teamBoard"))}>Team board</button><button className="primary-button" onClick={() => onSend(workflowCommand("resume"))}><Play size={14} /> Resume</button></div></div>
    <div className="workflow-layout">
      <div className="phase-map">
        {project.phases.length ? project.phases.map((phase, index) => <Phase key={phase.name} phase={phase} index={index} selected={selected?.id} onSelect={setSelected} />) : <EmptyState icon={GitBranch} title="No workflow state yet" detail="Start an intent to see phases and stages here." action="Start workflow" onAction={() => onSend(workflowCommand("start"))} />}
      </div>
      <aside className="workflow-inspector panel">
        <span className="panel-kicker">Inspector</span>
        {selected ? <><h3>{selected.name}</h3><div className={`status-chip status-chip--${selected.status}`}><StatusDot status={selected.status} />{selected.status}</div><dl><dt>Phase</dt><dd>{selected.phase}</dd><dt>Agent</dt><dd>{selected.agent || "Not assigned"}</dd><dt>Details</dt><dd>{selected.details || "No additional details were recorded."}</dd></dl><button className="wide-action" onClick={() => onSend(workflowCommand("stage", selected.id))}>Jump to this stage</button></> : <div className="inspector-empty"><GitBranch size={28} /><strong>Select a stage</strong><span>Inspect official state and available actions.</span></div>}
      </aside>
    </div>
    <section className="advanced-panel panel"><button className="advanced-panel__toggle" onClick={() => setShowAdvanced(!showAdvanced)}><div><span className="panel-kicker">Command builder</span><h3>Advanced workflow controls</h3></div><ChevronRight className={showAdvanced ? "rotate" : ""} size={17} /></button>{showAdvanced && <div className="advanced-panel__body"><div className="command-palette"><button onClick={() => onSend("$aidlc park")}>Park workflow<code>$aidlc park</code></button><button onClick={() => onSend("$aidlc intent")}>Intent manager<code>$aidlc intent</code></button><button onClick={() => onSend("$aidlc space")}>Space manager<code>$aidlc space</code></button><button onClick={() => onSend("$aidlc knowledge list")}>Knowledge<code>$aidlc knowledge list</code></button><button onClick={() => onSend("$aidlc plugin list")}>Plugins<code>$aidlc plugin list</code></button><button onClick={() => onSend("$aidlc config list")}>Configuration<code>$aidlc config list</code></button></div><div className="form-grid"><Select label="Scope" value={options.scope || ""} values={["", "enterprise", "feature", "mvp", "poc", "bugfix", "refactor", "infra", "security-patch", "classic", "workshop", "express"]} onChange={(scope) => setOptions({ ...options, scope })} /><Select label="Depth" value={options.depth || ""} values={["minimal", "standard", "comprehensive"]} onChange={(depth) => setOptions({ ...options, depth })} /><Select label="Test strategy" value={options.testStrategy || ""} values={["minimal", "standard", "comprehensive"]} onChange={(testStrategy) => setOptions({ ...options, testStrategy })} /><Select label="Review" value={options.review || ""} values={["adversarial", "advisory", "none"]} onChange={(review) => setOptions({ ...options, review })} /><Select label="Guard policy" value={options.guardPolicy || ""} values={["strict", "relaxed", "off"]} onChange={(guardPolicy) => setOptions({ ...options, guardPolicy })} /></div><div className="toggle-row"><Toggle label="Sensors" checked={options.sensors !== false} onChange={(sensors) => setOptions({ ...options, sensors })} /><Toggle label="Learnings" checked={options.learnings !== false} onChange={(learnings) => setOptions({ ...options, learnings })} /><Toggle label="Summary confirmation" checked={options.summaryConfirmation !== false} onChange={(summaryConfirmation) => setOptions({ ...options, summaryConfirmation })} /><Toggle label="Plan approval" checked={options.planApproval !== false} onChange={(planApproval) => setOptions({ ...options, planApproval })} /></div><div className="command-preview"><span>Generated command</span><code>{generated}</code><button className="primary-button" onClick={sendGenerated}><Play size={13} /> Send</button></div></div>}</section>
  </div>;
}

function Phase({ phase, index, selected, onSelect }: { phase: PhaseInfo; index: number; selected?: string; onSelect: (stage: StageInfo) => void }) {
  return <section className={`phase phase--${phase.status}`}><div className="phase__head"><span className="phase__number">{String(index + 1).padStart(2, "0")}</span><div><h3>{phase.name}</h3><span>{phase.stages.filter((stage) => stage.status === "completed" || stage.status === "skipped").length} of {phase.stages.length} stages</span></div><div className={`status-chip status-chip--${phase.status}`}><StatusDot status={phase.status} />{phase.status}</div></div><div className="phase__stages">{phase.stages.map((stage) => <button className={`stage-row ${selected === stage.id ? "stage-row--selected" : ""}`} key={stage.id} onClick={() => onSelect(stage)}><span className={`stage-state stage-state--${stage.status}`}>{stage.status === "completed" ? <Check size={13} /> : stage.status === "failed" ? <X size={13} /> : <span />}</span><span><strong>{stage.name}</strong><small>{stage.agent || stage.details || ""}</small></span><ChevronRight size={14} /></button>)}</div></section>;
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item || "current"} value={item}>{item ? item[0].toUpperCase() + item.slice(1) : "Use current"}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle__track"><span /></span><span>{label}</span></label>; }

function Artifacts({ project }: { project: ProjectSnapshot }) {
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState<ArtifactInfo | null>(null);
  const artifacts = useMemo(() => project.artifacts.filter((item) => `${item.name} ${item.relativePath} ${item.stage}`.toLowerCase().includes(query.toLowerCase())), [project.artifacts, query]);
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Generated output</div><h2>Artifacts</h2><p>{project.artifacts.length} files discovered for the active intent</p></div><label className="inline-search"><Search size={14} /><input placeholder="Filter artifacts" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>{artifacts.length ? <div className="artifact-list"><div className="artifact-list__head"><span>Name</span><span>Stage</span><span>Modified</span><span>Size</span></div>{artifacts.map((artifact) => <button key={artifact.path} onClick={() => setSelected(artifact)}><span className="file-icon"><FileCode2 size={16} /></span><span><strong>{artifact.name}</strong><small>{artifact.relativePath}</small></span><span>{artifact.stage || "—"}</span><time>{timeAgo(artifact.modifiedAt)}</time><span>{artifact.size < 1024 ? `${artifact.size} B` : `${(artifact.size / 1024).toFixed(1)} KB`}</span><ChevronRight size={14} /></button>)}</div> : <EmptyState icon={FileText} title="No artifacts found" detail="Artifacts from the active AI-DLC intent will appear here." />}{selected && <MarkdownModal projectPath={project.path} artifact={selected} onClose={() => setSelected(null)} />}</div>;
}

function HistoryView({ project }: { project: ProjectSnapshot }) {
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">Audit trail</div><h2>Activity history</h2><p>Human-readable events derived from AI-DLC audit data</p></div></div>{project.activity.length ? <div className="timeline">{project.activity.map((event) => <div className="timeline__event" key={event.id}><span className={`timeline__dot timeline__dot--${event.status}`} /><div><div><strong>{event.title}</strong><time>{timeAgo(event.timestamp)}</time></div>{event.detail && <p>{event.detail}</p>}<span className="event-kind">{event.kind}</span></div></div>)}</div> : <EmptyState icon={History} title="No activity recorded" detail="Workflow events will appear after AI-DLC starts an intent." />}</div>;
}

function TerminalFocus() { return <div className="page terminal-focus"><div className="eyebrow">Direct session</div><h2>Codex terminal</h2><p>The terminal below is the same live PTY used by every visual control. GUI commands are shown before they are sent.</p></div>; }

function SettingsView({ settings, tools, onSave }: { settings: Settings; tools: BootstrapState["tools"]; onSave: (value: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings); const [saved, setSaved] = useState(false);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => { setDraft({ ...draft, [key]: value }); setSaved(false); };
  return <div className="page settings-page"><div className="page-heading"><div><div className="eyebrow">Preferences</div><h2>Settings</h2><p>Paths and display options are stored locally on this machine.</p></div><button className="primary-button" onClick={() => onSave(draft).then(() => setSaved(true))}>{saved ? <Check size={14} /> : null}{saved ? "Saved" : "Save changes"}</button></div><section className="settings-section panel"><div><h3>Executables</h3><p>Leave paths empty to use the executable on PATH.</p></div><div className="settings-fields"><label className="field"><span>Codex executable path</span><input value={draft.codexPath} onChange={(event) => update("codexPath", event.target.value)} placeholder={tools.codexPath || "codex"} /><small>{tools.codexAvailable ? `Detected: ${tools.codexVersion}` : "Codex was not found"}</small></label><label className="field"><span>AI-DLC executable path</span><input value={draft.aidlcPath} onChange={(event) => update("aidlcPath", event.target.value)} placeholder={tools.aidlcPath || "aidlc"} /><small>{tools.aidlcAvailable ? `Detected: ${tools.aidlcVersion}` : "AI-DLC was not found"}</small></label><label className="field"><span>Default terminal shell</span><input value={draft.shell} onChange={(event) => update("shell", event.target.value)} placeholder="Use system default" /></label></div></section><section className="settings-section panel"><div><h3>Appearance & terminal</h3><p>Terminal changes apply immediately after saving.</p></div><div className="settings-fields"><Select label="Theme" value={draft.theme} values={["dark", "light", "system"]} onChange={(value) => update("theme", value as Settings["theme"])} /><label className="field"><span>Terminal font size</span><input type="number" min="10" max="24" value={draft.terminalFontSize} onChange={(event) => update("terminalFontSize", Number(event.target.value))} /></label><label className="field"><span>Terminal scrollback lines</span><input type="number" min="1000" max="100000" step="1000" value={draft.terminalScrollback} onChange={(event) => update("terminalScrollback", Number(event.target.value))} /></label></div></section><section className="settings-section panel"><div><h3>Behavior</h3><p>Choose what AIDLC-GUI restores and displays.</p></div><div className="settings-fields"><Toggle label="Automatically open the last project" checked={draft.openLastProject} onChange={(value) => update("openLastProject", value)} /><Toggle label="Developer / debug mode" checked={draft.debugMode} onChange={(value) => update("debugMode", value)} /></div></section></div>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }: { icon: typeof History; title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><span><Icon size={25} /></span><h3>{title}</h3><p>{detail}</p>{action && <button className="primary-button" onClick={onAction}>{action}</button>}</div>; }

export default App;
