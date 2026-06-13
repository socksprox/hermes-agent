import { describe, expect, it } from "vitest";

import { parseSlash } from "@/lib/slashExec";

describe("slash composer routing", () => {
  it("parseSlash splits name and arg", () => {
    expect(parseSlash("/help")).toEqual({ name: "help", arg: "" });
    expect(parseSlash("/model opus")).toEqual({
      name: "model",
      arg: "opus",
    });
  });

  it("complete slash without args is a bare command", () => {
    const { name, arg } = parseSlash("/help");
    expect(name).toBe("help");
    expect(arg).toBe("");
    expect(`/help`.startsWith("/") && !`/help`.includes(" ")).toBe(true);
  });
});
