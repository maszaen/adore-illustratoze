import { useSyncExternalStore } from 'react';

const key = (workspace: string) => `adore.workspace.chrome.v1.${workspace}`;
const eventName = 'ai-workspace-chrome';
export function isControlBarVisible(workspace: string): boolean {
  try {
    const value = localStorage.getItem(key(workspace));
    if (value === 'true' || value === 'false') return value === 'true';
  } catch { /* Storage is optional. */ }
  return workspace !== 'essentials';
}
export function setControlBarVisible(workspace: string, value: boolean): void {
  try { localStorage.setItem(key(workspace), String(value)); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(eventName));
}
export function resetWorkspaceChrome(workspace: string): void {
  try { localStorage.removeItem(key(workspace)); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(eventName));
}
export function useControlBarVisible(workspace: string): boolean {
  return useSyncExternalStore(
    callback => { window.addEventListener(eventName, callback); return () => window.removeEventListener(eventName, callback); },
    () => isControlBarVisible(workspace),
    () => workspace !== 'essentials',
  );
}
