import { describe, expect, it } from "vitest";

import { toChatMessagesFromGateway } from "./chatMessages";

describe("toChatMessagesFromGateway", () => {
  it("maps gateway text rows to chat messages", () => {
    const rows = [
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi there" },
    ];
    expect(toChatMessagesFromGateway(rows).map((m) => [m.role, m.content])).toEqual([
      ["user", "hello"],
      ["assistant", "hi there"],
    ]);
  });

  it("attaches tool rows to the next assistant message", () => {
    const rows = [
      { role: "user", text: "run" },
      { role: "tool", name: "terminal", context: "ls" },
      { role: "assistant", text: "done" },
    ];
    const out = toChatMessagesFromGateway(rows);
    expect(out).toHaveLength(2);
    expect(out[1]?.toolCalls?.[0]?.name).toBe("terminal");
  });

  it("returns empty for non-arrays", () => {
    expect(toChatMessagesFromGateway(null)).toEqual([]);
  });
});
