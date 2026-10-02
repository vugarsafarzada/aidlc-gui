import type { StageStatus } from "../types";

export function StatusDot({ status, pulse = false }: { status: StageStatus | "online" | "offline"; pulse?: boolean }) {
  return <span className={`status-dot status-dot--${status} ${pulse ? "status-dot--pulse" : ""}`} aria-label={status} />;
}
