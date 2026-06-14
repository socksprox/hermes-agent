import { describe, expect, it } from "vitest";

import {
  CHAT_SESSIONS_SIDEBAR_PARAM,
  clearChatSessionQueryParams,
  getResumeParamFromSearch,
  hasSessionsSidebarParam,
  isChatRoutePath,
  shouldDrillChatSidebar,
  withSessionsSidebarParam,
  withoutSessionsSidebarParam,
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

  it("detects sessions sidebar param", () => {
    expect(hasSessionsSidebarParam(`?${CHAT_SESSIONS_SIDEBAR_PARAM}=1`)).toBe(
      true,
    );
    expect(hasSessionsSidebarParam(`?${CHAT_SESSIONS_SIDEBAR_PARAM}=true`)).toBe(
      true,
    );
    expect(hasSessionsSidebarParam(`?${CHAT_SESSIONS_SIDEBAR_PARAM}`)).toBe(
      true,
    );
    expect(hasSessionsSidebarParam("?resume=x")).toBe(false);
  });

  it("drills sidebar only with sessions param on /chat", () => {
    expect(
      shouldDrillChatSidebar("/chat", `?resume=x&${CHAT_SESSIONS_SIDEBAR_PARAM}=1`),
    ).toBe(true);
    expect(shouldDrillChatSidebar("/chat", "?resume=x")).toBe(false);
    expect(shouldDrillChatSidebar("/chat", "")).toBe(false);
    expect(shouldDrillChatSidebar("/sessions", `?${CHAT_SESSIONS_SIDEBAR_PARAM}=1`)).toBe(
      false,
    );
  });

  it("mutates sessions sidebar param", () => {
    const base = new URLSearchParams("?resume=abc&profile=dev");
    expect(withSessionsSidebarParam(base).get(CHAT_SESSIONS_SIDEBAR_PARAM)).toBe(
      "1",
    );
    expect(withSessionsSidebarParam(base).get("resume")).toBe("abc");

    const drilled = withSessionsSidebarParam(base);
    expect(withoutSessionsSidebarParam(drilled).has(CHAT_SESSIONS_SIDEBAR_PARAM)).toBe(
      false,
    );
    expect(withoutSessionsSidebarParam(drilled).get("resume")).toBe("abc");

    const cleared = clearChatSessionQueryParams(drilled);
    expect(cleared.has("resume")).toBe(false);
    expect(cleared.has(CHAT_SESSIONS_SIDEBAR_PARAM)).toBe(false);
    expect(cleared.get("profile")).toBe("dev");
  });
});
