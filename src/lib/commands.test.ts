import { describe, expect, it } from "vitest";
import { commandForApproval, optionsCommand, workflowCommand } from "./commands";

describe("AI-DLC command generation", () => {
  it("builds current workflow commands", () => {
    expect(workflowCommand("status")).toBe("$aidlc --status");
    expect(workflowCommand("park")).toBe("$aidlc park");
  });

  it("quotes prompt text and removes line breaks", () => {
    expect(workflowCommand("prompt", 'Build a "fast" API\nnow')).toBe('$aidlc "Build a \\"fast\\" API now"');
  });

  it("builds typed options", () => {
    expect(optionsCommand({ scope: "feature", depth: "minimal", sensors: false })).toBe('$aidlc --scope "feature" --depth minimal --sensors off');
  });

  it("keeps approval responses readable", () => {
    expect(commandForApproval(false, "Add tests\nfirst")).toBe("Request changes: Add tests first");
  });
});
