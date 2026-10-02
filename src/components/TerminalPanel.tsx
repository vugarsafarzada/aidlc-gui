import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ChevronDown, Maximize2, Minimize2, RotateCcw, TerminalSquare } from "lucide-react";
import { isTauri, resizeTerminal, startTerminal, stopTerminal, writeTerminal } from "../services/backend";
import type { TerminalExit, TerminalOutput } from "../types";

function themeColor(token: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function ansiColor(token: string) {
  return themeColor(token).match(/\d+/g)?.slice(0, 3).join(";") ?? "250;250;250";
}

interface Props {
  projectPath: string;
  fontSize: number;
  scrollback: number;
  height: number;
  expanded?: boolean;
  onHeightChange: (value: number) => void;
  onExpandedChange?: (value: boolean) => void;
  onReady?: (send: (command: string) => void) => void;
}

export function TerminalPanel({ projectPath, fontSize, scrollback, height, expanded: controlledExpanded, onHeightChange, onExpandedChange, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;

  const setExpanded = (value: boolean) => {
    setLocalExpanded(value);
    onExpandedChange?.(value);
  };

  const beginResize = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    setExpanded(true);
    const resize = (moveEvent: MouseEvent) => {
      const maximum = Math.max(220, window.innerHeight - 120);
      onHeightChange(Math.min(maximum, Math.max(170, window.innerHeight - moveEvent.clientY)));
    };
    const finish = () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", finish);
    };
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", finish);
  };

  const send = useCallback((command: string) => {
    const sessionId = sessionRef.current;
    const terminal = terminalRef.current;
    if (!terminal || !sessionId) return;
    terminal.write(`\r\n\x1b[38;2;${ansiColor("--accent")}m› GUI\x1b[0m \x1b[38;2;${ansiColor("--text")}m${command}\x1b[0m\r\n`);
    void writeTerminal(sessionId, `${command}\r`);
    terminal.focus();
  }, []);

  useEffect(() => onReady?.(send), [onReady, send]);

  const launch = useCallback(async () => {
    const term = terminalRef.current;
    if (!term || !fitRef.current) return;
    if (sessionRef.current) await stopTerminal(sessionRef.current).catch(() => undefined);
    term.reset();
    term.write(`\x1b[38;2;${ansiColor("--accent")}mStarting Codex in this project…\x1b[0m\r\n`);
    const started = await startTerminal(projectPath, term.rows, term.cols);
    sessionRef.current = started.sessionId;
    setRunning(true);
    if (!isTauri()) {
      term.write("\x1b[2mBrowser preview uses a simulated terminal. Launch the Tauri app for a real Codex PTY.\x1b[0m\r\n\r\n");
      term.write(`\x1b[38;2;${ansiColor("--accent")}m╭─ AIDLC-GUI preview ───────────────────────────────╮\x1b[0m\r\n`);
      term.write("│ Codex and AI-DLC share this terminal in desktop mode. │\r\n");
      term.write(`\x1b[38;2;${ansiColor("--accent")}m╰───────────────────────────────────────────────────╯\x1b[0m\r\n`);
    }
  }, [projectPath]);

  useEffect(() => {
    let disposed = false;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
      fontSize,
      fontWeight: 450,
      lineHeight: 1.28,
      scrollback,
      allowTransparency: true,
      macOptionIsMeta: true,
      theme: {
        background: themeColor("--bg"),
        foreground: themeColor("--text"),
        cursor: themeColor("--accent"),
        cursorAccent: themeColor("--bg"),
        selectionBackground: themeColor("--selection"),
        black: themeColor("--base-01"), red: themeColor("--red"), green: themeColor("--green"), yellow: themeColor("--orange"),
        blue: themeColor("--blue"), magenta: themeColor("--pink"), cyan: themeColor("--cyan"), white: themeColor("--base-1"),
        brightBlack: themeColor("--base-03"), brightRed: themeColor("--red"), brightGreen: themeColor("--green"), brightYellow: themeColor("--orange"),
        brightBlue: themeColor("--blue"), brightMagenta: themeColor("--purple"), brightCyan: themeColor("--turquoise"), brightWhite: themeColor("--base-1"),
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    terminalRef.current = term;
    fitRef.current = fit;
    if (hostRef.current) {
      term.open(hostRef.current);
      if (hostRef.current.clientHeight > 10 && hostRef.current.clientWidth > 10) fit.fit();
    }
    const dataDisposable = term.onData((data) => {
      if (sessionRef.current) void writeTerminal(sessionRef.current, data);
    });
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (disposed || !hostRef.current || hostRef.current.clientHeight <= 10 || hostRef.current.clientWidth <= 10) return;
        fit.fit();
        if (sessionRef.current) void resizeTerminal(sessionRef.current, term.rows, term.cols);
      });
    });
    if (hostRef.current) resizeObserver.observe(hostRef.current);
    let unlistenOutput: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;
    if (isTauri()) {
      void listen<TerminalOutput>("terminal-output", ({ payload }) => {
        if (payload.sessionId === sessionRef.current) term.write(payload.data);
      }).then((fn) => { unlistenOutput = fn; });
      void listen<TerminalExit>("terminal-exit", ({ payload }) => {
        if (payload.sessionId !== sessionRef.current) return;
        setRunning(false);
        term.write(`\r\n\x1b[38;2;${ansiColor("--danger")}mCodex exited${payload.code == null ? "" : ` (${payload.code})`}.\x1b[0m\r\n`);
      }).then((fn) => { unlistenExit = fn; });
    }
    void launch();
    return () => {
      disposed = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      unlistenOutput?.();
      unlistenExit?.();
      if (sessionRef.current) void stopTerminal(sessionRef.current);
      sessionRef.current = null;
      term.dispose();
      terminalRef.current = null;
    };
  }, [projectPath]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.fontSize = fontSize;
    window.requestAnimationFrame(() => {
      if (hostRef.current && hostRef.current.clientHeight > 10 && hostRef.current.clientWidth > 10) fitRef.current?.fit();
    });
  }, [fontSize, scrollback, expanded]);

  return (
    <section className={`terminal-panel ${expanded ? "terminal-panel--expanded" : ""}`} style={{ height: expanded ? height : 34 }}>
      <div className="terminal-panel__bar" onMouseDown={beginResize}>
        <div className="terminal-panel__title">
          <TerminalSquare size={15} />
          <strong>Interactive terminal</strong>
          <span className={`terminal-state ${running ? "terminal-state--on" : ""}`}>{running ? "Codex connected" : "Stopped"}</span>
        </div>
        <div className="terminal-panel__actions">
          <button className="icon-button" onClick={() => void launch()} title="Restart terminal"><RotateCcw size={14} /></button>
          <button className="icon-button" onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse terminal" : "Expand terminal"}>
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="icon-button" onClick={() => setExpanded(false)} title="Minimize"><ChevronDown size={15} /></button>
        </div>
      </div>
      <div ref={hostRef} className="terminal-host" />
    </section>
  );
}
