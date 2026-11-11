import type { WorkspaceDockLayout } from './DockManager';
import { PANEL_METADATA_MAP } from '../panels/PanelRegistry';

export interface StoredDockWorkspace {
  version: 1;
  layout: WorkspaceDockLayout;
  rightOuterWidth: number;
  rightInnerWidth: number;
}

const key = (preset: string) => `adore.workspace.v1.${preset}`;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));

/** Treat persisted UI state as untrusted; obsolete/partial layouts fall back to defaults. */
export function readDockWorkspace(preset: string): StoredDockWorkspace | null {
  try {
    const data = JSON.parse(localStorage.getItem(key(preset)) || 'null') as StoredDockWorkspace | null;
    if (!data || data.version !== 1 || !data.layout || !finite(data.rightOuterWidth) || !finite(data.rightInnerWidth)) return null;
    const layout = data.layout;
    const cols = [layout.leftColumn, layout.rightInnerColumn, layout.rightOuterColumn, layout.bottomRow];
    if (!cols.every(Array.isArray) || !Array.isArray(layout.floatingWindows)) return null;
    const ids = new Set<string>();
    const groups = [...layout.leftColumn, ...layout.rightInnerColumn, ...layout.rightOuterColumn, ...layout.bottomRow, ...layout.floatingWindows];
    if (!groups.every(group => {
      if (!group || typeof group.id !== 'string' || !Array.isArray(group.tabs) || !group.tabs.length || !group.tabs.includes(group.activeTab)) return false;
      return group.tabs.every(id => {
        if (typeof id !== 'string' || !PANEL_METADATA_MAP[id] || ids.has(id)) return false;
        ids.add(id);
        return true;
      });
    })) return null;
    if (!layout.floatingWindows.every(win => finite(win.x) && finite(win.y) && finite(win.width) && finite(win.height))) return null;
    layout.floatingWindows = layout.floatingWindows.map(win => ({
      ...win,
      width: clamp(win.width, 220, Math.max(220, window.innerWidth - 20)),
      height: clamp(win.height, 160, Math.max(160, window.innerHeight - 30)),
      x: clamp(win.x, 0, window.innerWidth - 120),
      y: clamp(win.y, 0, window.innerHeight - 50),
    }));
    return { version: 1, layout, rightOuterWidth: clamp(data.rightOuterWidth, 220, 460), rightInnerWidth: clamp(data.rightInnerWidth, 220, 460) };
  } catch {
    return null;
  }
}

export function saveDockWorkspace(preset: string, data: StoredDockWorkspace): void {
  try { localStorage.setItem(key(preset), JSON.stringify(data)); } catch { /* Storage is optional. */ }
}
