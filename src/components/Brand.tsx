import { Command } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand__mark"><Command size={17} strokeWidth={2.4} /></div>
      {!compact && <div><strong>AIDLC</strong><span>GUI</span></div>}
    </div>
  );
}
