import { describe, expect, it } from "vitest";

import {
  getResumeParamFromSearch,
  isChatRoutePath,
  shouldDrillChatSidebar,
} from "./chatResumeUrl";

describe("chatResumeUrl", () => {
  it("parses resume from search", () => {
    expect(getResumeParamFromSearch("?resume=abc&profile=dev")).toBe("abc");
    expect(getResumeParamFromSearch("")).toBeNull();
    expect(getResumeParamFromSearch("?resume=")).toBeNull();
  });

  it("detects chat route paths", () => {
    expect(isChatRoutePath("/chat")).toBe(true);
    expect(isChatRoutePath("/chat/")).toBe(true);
    expect(isChatRoutePath("/sessions")).toBe(false);
  });

  it("drills sidebar when chat has resume param", () => {
    expect(shouldDrillChatSidebar("/chat", "?resume=20260614_114839_b36c82")).toBe(
      true,
    );
    expect(shouldDrillChatSidebar("/chat", "")).toBe(false);
    expect(shouldDrillChatSidebar("/sessions", "?resume=x")).toBe(false);
  });
});
