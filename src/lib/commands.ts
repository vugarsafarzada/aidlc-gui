export type CommandOptions = {
  scope?: string;
  depth?: string;
  testStrategy?: string;
  review?: string;
  guardPolicy?: string;
  sensors?: boolean;
  learnings?: boolean;
  summaryConfirmation?: boolean;
  planApproval?: boolean;
};

function quote(value: string): string {
  const clean = value.replace(/[\r\n\0]/g, " ").trim();
  return `"${clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function workflowCommand(action: string, value?: string): string {
  const commands: Record<string, string> = {
    start: "$aidlc",
    resume: "$aidlc",
    status: "$aidlc --status",
    doctor: "$aidlc --doctor",
    park: "$aidlc park",
    teamBoard: "$aidlc team-board --snapshot",
    intents: "$aidlc intent",
    spaces: "$aidlc space",
    help: "$aidlc --help",
  };
  if (action === "prompt") return `$aidlc ${quote(value || "")}`;
  if (action === "stage") return `$aidlc --stage ${quote(value || "")}`;
  if (action === "phase") return `$aidlc --phase ${quote(value || "")}`;
  return commands[action] || "$aidlc --help";
}

export function optionsCommand(options: CommandOptions): string {
  const parts = ["$aidlc"];
  if (options.scope) parts.push("--scope", quote(options.scope));
  if (options.depth) parts.push("--depth", options.depth);
  if (options.testStrategy) parts.push("--test-strategy", options.testStrategy);
  if (options.review) parts.push("--review", options.review);
  if (options.guardPolicy) parts.push("--guard-policy", options.guardPolicy);
  if (options.sensors !== undefined) parts.push("--sensors", options.sensors ? "on" : "off");
  if (options.learnings !== undefined) parts.push("--learnings", options.learnings ? "on" : "off");
  if (options.summaryConfirmation !== undefined) parts.push("--summary-confirmation", options.summaryConfirmation ? "on" : "off");
  if (options.planApproval !== undefined) parts.push("--plan-approval", options.planApproval ? "on" : "off");
  return parts.join(" ");
}

export function commandForApproval(approved: boolean, feedback?: string): string {
  return approved ? "Approve" : `Request changes: ${feedback?.replace(/[\r\n]+/g, " ").trim() || "Please revise the proposal."}`;
}
