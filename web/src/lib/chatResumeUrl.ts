/** Parse `?resume=` from a location search string. */
export function getResumeParamFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("resume");
  return value?.trim() || null;
}

export function isChatRoutePath(pathname: string): boolean {
  return (pathname.replace(/\/$/, "") || "/") === "/chat";
}

/** True when the URL signals an active chat session (sidebar session mode). */
export function shouldDrillChatSidebar(pathname: string, search: string): boolean {
  return isChatRoutePath(pathname) && !!getResumeParamFromSearch(search);
}
