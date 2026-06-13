import { useSyncExternalStore } from "react";

const STORAGE_KEY = "hermes.chat.drawerOpen";

type Listener = () => void;

function readInitial(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "false") return false;
    if (raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

let drawerOpen = readInitial();
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function getChatDrawerOpen(): boolean {
  return drawerOpen;
}

export function setChatDrawerOpen(next: boolean): void {
  if (drawerOpen === next) return;
  drawerOpen = next;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  emit();
}

export function toggleChatDrawerOpen(): void {
  setChatDrawerOpen(!drawerOpen);
}

export function subscribeChatDrawerOpen(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatDrawerOpen(): [boolean, (v: boolean) => void] {
  const open = useSyncExternalStore(
    subscribeChatDrawerOpen,
    getChatDrawerOpen,
    () => true,
  );
  return [open, setChatDrawerOpen];
}
