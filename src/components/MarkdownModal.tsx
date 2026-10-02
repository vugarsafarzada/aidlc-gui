import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, FileText, FolderOpen, X } from "lucide-react";
import { openArtifact, readArtifact, revealArtifact } from "../services/backend";
import type { ArtifactInfo } from "../types";

export function MarkdownModal({ projectPath, artifact, onClose }: { projectPath: string; artifact: ArtifactInfo; onClose: () => void }) {
  const [content, setContent] = useState("Loading…");
  const [error, setError] = useState("");

  useEffect(() => {
    readArtifact(projectPath, artifact.path).then(setContent).catch((reason) => setError(String(reason)));
  }, [artifact.path, projectPath]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <article className="artifact-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div className="artifact-modal__name"><FileText size={17} /><div><strong>{artifact.name}</strong><span>{artifact.relativePath}</span></div></div>
          <div className="row">
            <button className="secondary-button" onClick={() => void openArtifact(projectPath, artifact.path)}><ExternalLink size={14} /> Open</button>
            <button className="secondary-button" onClick={() => void revealArtifact(projectPath, artifact.path)}><FolderOpen size={14} /> Reveal</button>
            <button className="icon-button" onClick={onClose}><X size={17} /></button>
          </div>
        </header>
        <div className="markdown-body">{error ? <p className="error-text">{error}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}</div>
      </article>
    </div>
  );
}
