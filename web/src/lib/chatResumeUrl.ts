/** Active chat session id (`?resume=`). */
export function getResumeParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("resume");
  return value?.trim() || null;
}

export function isChatRoutePath(pathname: string): boolean {
  return (pathname.replace(/\/$/, "") || "/") === "/chat";
}

/** Query flag: chat sidebar is in the drilled-down session list mode. */
export const CHAT_SESSIONS_SIDEBAR_PARAM = "sessions";

export function hasSessionsSidebarParam(search: string): boolean {
  const value = new URLSearchParams(search).get(CHAT_SESSIONS_SIDEBAR_PARAM);
  if (value === null) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" || trimmed === "1" || trimmed === "true";
}

/** True when the URL requests the drilled session sidebar on /chat. */
export function shouldDrillChatSidebar(pathname: string, search: string): boolean {
  return isChatRoutePath(pathname) && hasSessionsSidebarParam(search);
}

export function withSessionsSidebarParam(
  params: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(CHAT_SESSIONS_SIDEBAR_PARAM, "1");
  return next;
}

export function withoutSessionsSidebarParam(
  params: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(CHAT_SESSIONS_SIDEBAR_PARAM);
  return next;
}

/** Drop chat-session query state when starting a blank chat. */
export function clearChatSessionQueryParams(
  params: URLSearchParams,
): URLSearchParams {
  const next = withoutSessionsSidebarParam(params);
  next.delete("resume");
  return next;
}
