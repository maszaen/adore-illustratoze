import { ChevronRight, X, Plus, Lock, Check } from 'lucide-react';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStudioStore } from '../../state/useStudioStore';
import { useControlBarVisible, setControlBarVisible, resetWorkspaceChrome } from './workspaceChrome';
import type {
  ActiveModalType,
  UIThemeBrightness,
  Language,
  LiveEffectType,
} from '../../core/types';

export const WORKSPACE_PRESETS = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'essentials-classic', label: 'Essentials Classic' },
  { id: 'illustration', label: 'Illustration & Painting' },
  { id: 'typography', label: 'Typography' },
  { id: 'layout-print', label: 'Layout & Print' },
  { id: 'tracing', label: 'Tracing & Vectorizing' },
  { id: 'web', label: 'Web' },
] as const;

export const STUDIO_PANEL_LIST = [
  { id: 'properties', label: 'Properties', shortcut: '' },
  { id: 'layers', label: 'Layers', shortcut: 'F7' },
  { id: 'appearance', label: 'Appearance', shortcut: 'Shift+F6' },
  { id: 'color', label: 'Color', shortcut: 'F6' },
  { id: 'color-guide', label: 'Color Guide', shortcut: 'Shift+F3' },
  { id: 'swatches', label: 'Swatches', shortcut: '' },
  { id: 'gradient', label: 'Gradient', shortcut: 'Ctrl+F9' },
  { id: 'stroke', label: 'Stroke', shortcut: 'Ctrl+F10' },
  { id: 'transparency', label: 'Transparency', shortcut: 'Shift+Ctrl+F10' },
  { id: 'pathfinder', label: 'Pathfinder', shortcut: 'Shift+Ctrl+F9' },
  { id: 'align', label: 'Align', shortcut: 'Shift+F7' },
  { id: 'transform', label: 'Transform', shortcut: 'Shift+F8' },
  { id: 'brushes', label: 'Brushes', shortcut: 'F5' },
  { id: 'symbols', label: 'Symbols', shortcut: 'Shift+Ctrl+F11' },
  { id: 'graphic-styles', label: 'Graphic Styles', shortcut: 'Shift+F5' },
  { id: 'character', label: 'Character', shortcut: 'Ctrl+T' },
  { id: 'paragraph', label: 'Paragraph', shortcut: 'Alt+Ctrl+T' },
  { id: 'opentype', label: 'OpenType', shortcut: 'Alt+Shift+Ctrl+T' },
  { id: 'info', label: 'Info', shortcut: 'F8' },
  { id: 'magic-wand', label: 'Magic Wand', shortcut: '' },
  { id: 'artboards', label: 'Artboards', shortcut: '' },
  { id: 'image-trace', label: 'Image Trace', shortcut: '' },
  { id: 'asset-export', label: 'Asset Export', shortcut: '' },
  { id: 'history', label: 'History', shortcut: '' },
] as const;

type MenuCommand = { label: string; shortcut?: string; disabled?: boolean; checked?: boolean; onClick: () => void };
type MenuEntry = { divider: true } | MenuCommand;
type MenuNode = MenuEntry | { label: string; children: MenuCommand[] };

/** Group the existing commands without changing their handlers or availability. */
function nestMenuItems(items: MenuEntry[]): MenuNode[] {
  const result: MenuNode[] = [];
  const groups = new Map<string, { label: string; children: MenuCommand[] }>();
  for (const item of items) {
    if ('divider' in item) { result.push(item); continue; }
    const normalized = item.label.replace(/^Workspace: /, 'Workspace > ').replace(/^Document Color Mode: /, 'Document Color Mode > ');
    const split = normalized.indexOf(' > ');
    if (split < 0 && item.label !== 'Reset Current Workspace') { result.push(item); continue; }
    const parent = split < 0 ? 'Workspace' : normalized.slice(0, split);
    const label = split < 0 ? item.label : normalized.slice(split + 3);
    let group = groups.get(parent);
    if (!group) { group = { label: parent, children: [] }; groups.set(parent, group); result.push(group); }
    group.children.push({ ...item, label });
  }
  return result;
}

export const TopMenuBar: React.FC = () => {
  const store = useStudioStore() as any;

  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const documents: any[] =
    store.documents && Array.isArray(store.documents) && store.documents.length > 0
      ? store.documents
      : store.documents && typeof store.documents === 'object' && Object.keys(store.documents).length > 0
      ? Object.values(store.documents)
      : [doc];
  const activeDocumentId: string = store.activeDocumentId || doc.id || 'doc-1';

  const uiTheme: UIThemeBrightness = store.uiBrightness || store.uiTheme || 'dark';
  const language: Language = store.language || 'en';
  const activeWorkspace: string = store.activeWorkspace || 'essentials-classic';
  const controlBarVisible = useControlBarVisible(activeWorkspace);
  const viewMode: string = store.viewMode || 'preview';
  const screenMode: string = store.screenMode || 'normal';
  const showRulers: boolean = store.showRulers ?? true;
  const showGrid: boolean = Boolean(store.showGrid);
  const snapToGrid: boolean = Boolean(store.snapToGrid);
  const showSmartGuides: boolean = store.showSmartGuides ?? true;
  const showGuides: boolean = store.showGuides ?? true;
  const lockGuides: boolean = Boolean(store.lockGuides);
  const showTransparencyGrid: boolean = Boolean(store.showTransparencyGrid);
  const showPerspectiveGrid: boolean = Boolean(store.showPerspectiveGrid);
  const showBoundingBox: boolean = store.showBoundingBox ?? true;
  const showEdges: boolean = store.showEdges ?? true;

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const hasSelection = selectedIds.length > 0;
  const isolatedGroupId: string | null = store.isolatedGroupId || store.isolationGroupId || null;

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [submenu, setSubmenu] = useState<{ label: string; items: MenuCommand[]; anchor: HTMLElement } | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);

  // Sync UI theme attribute on documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node) && !submenuRef.current?.contains(e.target as Node)) {
        setOpenMenu(null); setSubmenu(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useLayoutEffect(() => {
    const menu = menuBarRef.current?.querySelector<HTMLElement>('.ai-menubar-dropdown');
    if (!menu) return;
    const fit = () => {
      menu.style.left = '0px';
      menu.style.width = 'max-content';
      const contentWidth = Math.max(228, ...Array.from(menu.querySelectorAll<HTMLElement>('.ai-dropdown-item')).map(item => {
        const label = item.querySelector<HTMLElement>('.ai-dropdown-label');
        const shortcut = item.querySelector<HTMLElement>('.ai-shortcut');
        return (label?.scrollWidth || 0) + (shortcut?.scrollWidth || 0) + 56;
      }));
      menu.style.width = `${contentWidth}px`;
      const rect = menu.getBoundingClientRect();
      menu.style.left = `${-Math.max(0, rect.right - window.innerWidth + 6)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [openMenu]);
  useLayoutEffect(() => {
    const menu = submenuRef.current;
    if (!menu || !submenu) return;
    const fit = () => {
      menu.style.width = 'max-content';
      const contentWidth = Math.max(200, ...Array.from(menu.querySelectorAll<HTMLElement>('.ai-dropdown-item')).map(item => (item.querySelector<HTMLElement>('.ai-dropdown-label')?.scrollWidth || 0) + (item.querySelector<HTMLElement>('.ai-shortcut')?.scrollWidth || 0) + 56));
      menu.style.width = `${contentWidth}px`;
      const anchor = submenu.anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      menu.style.left = `${Math.max(4, anchor.right + width <= window.innerWidth - 4 ? anchor.right - 1 : anchor.left - width + 1)}px`;
      menu.style.top = `${Math.max(4, Math.min(anchor.top, window.innerHeight - height - 4))}px`;
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [submenu]);
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (submenu) { submenu.anchor.focus(); setSubmenu(null); } else setOpenMenu(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openMenu, submenu]);

  if (screenMode === 'fullscreen') {
    return null;
  }

  const closeMenuAndRun = (fn: () => void) => {
    setOpenMenu(null);
    setSubmenu(null);
    fn();
  };

  const openModal = (modal: ActiveModalType) => {
    closeMenuAndRun(() => {
      if (typeof store.setActiveModal === 'function') {
        store.setActiveModal(modal);
      } else if (typeof store.openModal === 'function') {
        store.openModal(modal);
      } else {
        useStudioStore.setState({ activeModal: modal } as any);
      }
    });
  };

  const toggleFlag = (key: string, current: boolean) => {
    closeMenuAndRun(() => {
      const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      if (typeof store[setterName] === 'function') {
        store[setterName](!current);
      } else {
        useStudioStore.setState({ [key]: !current } as any);
      }
    });
  };

  const triggerStoreAction = (methodNames: string[], ...args: any[]) => {
    closeMenuAndRun(() => {
      for (const name of methodNames) {
        if (typeof store[name] === 'function') {
          store[name](...args);
          return;
        }
      }
    });
  };

  const applyLiveEffectToSelection = (effectType: LiveEffectType, name: string, defaultParams: Record<string, any>) => {
    closeMenuAndRun(() => {
      if (typeof store.addLiveEffectToSelection === 'function') {
        store.addLiveEffectToSelection(effectType, defaultParams);
        return;
      }
      if (typeof store.addLiveEffect === 'function') {
        store.addLiveEffect(effectType, defaultParams);
        return;
      }
      useStudioStore.setState((s: any) => {
        const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
        const targetDoc = next.document || next.activeDocument;
        if (!targetDoc || !targetDoc.nodes) return next;
        const ids: string[] = next.selectedIds || [];
        for (const id of ids) {
          const node = targetDoc.nodes[id];
          if (node) {
            node.effects = [
              ...(node.effects || []),
              {
                id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: effectType,
                name,
                enabled: true,
                params: defaultParams,
              },
            ];
          }
        }
        return next;
      });
    });
  };

  const handleSwitchWorkspace = (wsId: string) => {
    if (wsId === 'reset') {
      resetWorkspaceChrome(activeWorkspace);
      if (typeof store.resetWorkspace === 'function') {
        store.resetWorkspace();
      }
      window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: activeWorkspace, reset: true } }));
      return;
    }
    if (typeof store.setActiveWorkspace === 'function') {
      store.setActiveWorkspace(wsId);
    } else {
      useStudioStore.setState({ activeWorkspace: wsId } as any);
    }
    window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: wsId } }));
  };

  const handleOpenPanel = (panelId: string) => {
    closeMenuAndRun(() => {
      if (typeof store.togglePanel === 'function') {
        store.togglePanel(panelId);
      }
      window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId } }));
    });
  };

  const handleGoHome = () => {
    if (typeof store.setAppView === 'function') {
      store.setAppView('home');
    } else if (typeof store.setShowHomeScreen === 'function') {
      store.setShowHomeScreen(true);
    } else {
      useStudioStore.setState({ appView: 'home', showHomeScreen: true } as any);
    }
  };

  const menus: {
    id: string;
    label: string;
    labelId: string;
    items: (
      | { divider: true }
      | {
          label: string;
          shortcut?: string;
          disabled?: boolean;
          checked?: boolean;
          onClick: () => void;
        }
    )[];
  }[] = [
    {
      id: 'file',
      label: 'File',
      labelId: 'Berkas',
      items: [
        { label: 'New Document...', shortcut: 'Ctrl+N', onClick: () => openModal('new-document') },
        {
          label: 'Open Project (.adloze / .svg)...',
          shortcut: 'Ctrl+O',
          onClick: () => closeMenuAndRun(() => fileInputRef.current?.click()),
        },
        {
          label: 'Place Artwork / Image...',
          shortcut: 'Shift+Ctrl+P',
          onClick: () => closeMenuAndRun(() => placeInputRef.current?.click()),
        },
        { divider: true },
        {
          label: 'Save Project (.adloze)',
          shortcut: 'Ctrl+S',
          onClick: () => triggerStoreAction(['saveProjectArchive', 'exportAdloze', 'saveDocument']),
        },
        { divider: true },
        {
          label: 'Export for Screens...',
          shortcut: 'Alt+Ctrl+E',
          onClick: () => openModal('export-screens'),
        },
        {
          label: 'Export SVG Options...',
          shortcut: '',
          onClick: () => openModal('export-svg'),
        },
        {
          label: 'Export Print-Ready PDF (Bleed & Crop Marks)...',
          shortcut: '',
          onClick: () => openModal('export-pdf'),
        },
        {
          label: 'Save for Web (Legacy)...',
          shortcut: 'Alt+Shift+Ctrl+S',
          onClick: () => openModal('save-for-web'),
        },
        { divider: true },
        {
          label: 'Document Color Mode: RGB Color',
          checked: (doc.colorMode || 'RGB') === 'RGB',
          onClick: () =>
            triggerStoreAction(['setDocumentColorMode', 'setColorMode'], 'RGB'),
        },
        {
          label: 'Document Color Mode: CMYK Color',
          checked: doc.colorMode === 'CMYK',
          onClick: () =>
            triggerStoreAction(['setDocumentColorMode', 'setColorMode'], 'CMYK'),
        },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      labelId: 'Sunting',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => triggerStoreAction(['undo']) },
        { label: 'Redo', shortcut: 'Shift+Ctrl+Z', onClick: () => triggerStoreAction(['redo']) },
        { divider: true },
        {
          label: 'Cut',
          shortcut: 'Ctrl+X',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['cutSelection', 'cut']),
        },
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['copySelection', 'copy']),
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          onClick: () => triggerStoreAction(['pasteSelection', 'paste'], 'normal'),
        },
        {
          label: 'Paste in Front',
          shortcut: 'Ctrl+F',
          onClick: () => triggerStoreAction(['pasteInFront', 'pasteSelection', 'paste'], 'front'),
        },
        {
          label: 'Paste in Back',
          shortcut: 'Ctrl+B',
          onClick: () => triggerStoreAction(['pasteInBack', 'pasteSelection', 'paste'], 'back'),
        },
        {
          label: 'Paste in Place',
          shortcut: 'Shift+Ctrl+V',
          onClick: () => triggerStoreAction(['pasteInPlace', 'pasteSelection', 'paste'], 'place'),
        },
        {
          label: 'Paste on All Artboards',
          shortcut: 'Alt+Shift+Ctrl+V',
          onClick: () => triggerStoreAction(['pasteOnAllArtboards']),
        },
        { divider: true },
        {
          label: 'Recolor Artwork...',
          shortcut: '',
          onClick: () => openModal('recolor-artwork'),
        },
        { divider: true },
        {
          label: 'Keyboard Shortcuts...',
          shortcut: 'Alt+Shift+Ctrl+K',
          onClick: () => openModal('keyboard-shortcuts'),
        },
        {
          label: 'Preferences (UI Theme & Units)...',
          shortcut: 'Ctrl+K',
          onClick: () => openModal('preferences'),
        },
      ],
    },
    {
      id: 'object',
      label: 'Object',
      labelId: 'Objek',
      items: [
        {
          label: 'Transform > Transform Again',
          shortcut: 'Ctrl+D',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['transformAgain', 'duplicateSelection']),
        },
        {
          label: 'Transform > Transform Each...',
          shortcut: 'Alt+Shift+Ctrl+D',
          disabled: !hasSelection,
          onClick: () => openModal('transform-each'),
        },
        { divider: true },
        {
          label: 'Arrange > Bring to Front',
          shortcut: 'Shift+Ctrl+]',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['arrangeSelection', 'bringToFront'], 'front'),
        },
        {
          label: 'Arrange > Bring Forward',
          shortcut: 'Ctrl+]',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['arrangeSelection', 'bringForward'], 'forward'),
        },
        {
          label: 'Arrange > Send Backward',
          shortcut: 'Ctrl+[',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['arrangeSelection', 'sendBackward'], 'backward'),
        },
        {
          label: 'Arrange > Send to Back',
          shortcut: 'Shift+Ctrl+[',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['arrangeSelection', 'sendToBack'], 'back'),
        },
        { divider: true },
        {
          label: 'Group',
          shortcut: 'Ctrl+G',
          disabled: selectedIds.length < 2,
          onClick: () => triggerStoreAction(['groupSelection', 'groupSelected']),
        },
        {
          label: 'Ungroup',
          shortcut: 'Shift+Ctrl+G',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['ungroupSelection', 'ungroupSelected']),
        },
        {
          label: 'Lock Selection',
          shortcut: 'Ctrl+2',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['lockSelection']),
        },
        {
          label: 'Unlock All',
          shortcut: 'Alt+Ctrl+2',
          onClick: () => triggerStoreAction(['unlockAll']),
        },
        {
          label: 'Hide Selection',
          shortcut: 'Ctrl+3',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['hideSelection']),
        },
        {
          label: 'Show All',
          shortcut: 'Alt+Ctrl+3',
          onClick: () => triggerStoreAction(['showAll']),
        },
        { divider: true },
        {
          label: 'Expand Appearance',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['expandAppearance', 'expandSelection']),
        },
        {
          label: 'Path > Join',
          shortcut: 'Ctrl+J',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['joinSelectedPaths', 'joinPaths']),
        },
        {
          label: 'Path > Outline Stroke',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['outlineStrokeSelection', 'outlineStroke']),
        },
        {
          label: 'Path > Offset Path...',
          disabled: !hasSelection,
          onClick: () => openModal('offset-path'),
        },
        {
          label: 'Path > Simplify...',
          disabled: !hasSelection,
          onClick: () => openModal('simplify-path'),
        },
        {
          label: 'Path > Split Into Grid...',
          disabled: !hasSelection,
          onClick: () => openModal('split-into-grid'),
        },
        {
          label: 'Path > Clean Up Stray Points',
          onClick: () => triggerStoreAction(['cleanUpDocument', 'cleanUp']),
        },
        { divider: true },
        {
          label: 'Blend > Make',
          shortcut: 'Alt+Ctrl+B',
          disabled: selectedIds.length < 2,
          onClick: () => triggerStoreAction(['makeBlend']),
        },
        {
          label: 'Blend > Blend Options...',
          onClick: () => openModal('blend-options'),
        },
        {
          label: 'Envelope Distort > Make with Warp...',
          shortcut: 'Alt+Shift+Ctrl+W',
          disabled: !hasSelection,
          onClick: () => openModal('envelope-warp'),
        },
        {
          label: 'Envelope Distort > Make with Mesh...',
          shortcut: 'Alt+Ctrl+M',
          disabled: !hasSelection,
          onClick: () => openModal('envelope-mesh'),
        },
        {
          label: 'Live Paint > Make',
          shortcut: 'Alt+Ctrl+X',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['makeLivePaintGroup']),
        },
        {
          label: 'Pattern > Make...',
          onClick: () => openModal('pattern-maker'),
        },
        {
          label: 'Clipping Mask > Make',
          shortcut: 'Ctrl+7',
          disabled: selectedIds.length < 2,
          onClick: () => triggerStoreAction(['makeClippingMask']),
        },
        {
          label: 'Clipping Mask > Release',
          shortcut: 'Alt+Ctrl+7',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['releaseClippingMask']),
        },
        {
          label: 'Compound Path > Make',
          shortcut: 'Ctrl+8',
          disabled: selectedIds.length < 2,
          onClick: () => triggerStoreAction(['makeCompoundPath']),
        },
        {
          label: 'Compound Path > Release',
          shortcut: 'Alt+Shift+Ctrl+8',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['releaseCompoundPath']),
        },
        {
          label: 'Graph > Data...',
          onClick: () => openModal('graph-data'),
        },
      ],
    },
    {
      id: 'type',
      label: 'Type',
      labelId: 'Tipografi',
      items: [
        {
          label: 'Create Outlines',
          shortcut: 'Shift+Ctrl+O',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['createOutlinesFromText', 'createOutlines']),
        },
        { divider: true },
        {
          label: 'Change Case > UPPERCASE',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['changeTextCase'], 'uppercase'),
        },
        {
          label: 'Change Case > lowercase',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['changeTextCase'], 'lowercase'),
        },
        {
          label: 'Change Case > Title Case',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['changeTextCase'], 'titlecase'),
        },
        { divider: true },
        {
          label: 'Convert Point Type ↔ Area Type (fixed at creation)',
          disabled: true,
          onClick: () => triggerStoreAction(['toggleTextTypeMode']),
        },
        { divider: true },
        {
          label: 'Character Panel',
          shortcut: 'Ctrl+T',
          onClick: () => handleOpenPanel('character'),
        },
      ],
    },
    {
      id: 'select',
      label: 'Select',
      labelId: 'Seleksi',
      items: [
        {
          label: 'All',
          shortcut: 'Ctrl+A',
          onClick: () => triggerStoreAction(['selectAll']),
        },
        {
          label: 'All on Active Artboard',
          shortcut: 'Alt+Ctrl+A',
          onClick: () => triggerStoreAction(['selectAllOnActiveArtboard', 'selectAll']),
        },
        {
          label: 'Deselect',
          shortcut: 'Shift+Ctrl+A',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['deselectAll', 'clearSelection']),
        },
        {
          label: 'Inverse',
          onClick: () => triggerStoreAction(['invertSelection']),
        },
        { divider: true },
        {
          label: 'Same > Fill & Stroke',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['selectSame'], 'fill-stroke'),
        },
        {
          label: 'Same > Fill Color',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['selectSame'], 'fill'),
        },
        {
          label: 'Same > Stroke Color',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['selectSame'], 'stroke'),
        },
        {
          label: 'Same > Stroke Weight',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['selectSame'], 'stroke-weight'),
        },
        {
          label: 'Same > Opacity',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['selectSame'], 'opacity'),
        },
        { divider: true },
        {
          label: 'Object > Text Objects',
          onClick: () => triggerStoreAction(['selectByType'], 'text'),
        },
        {
          label: 'Object > Clipping Masks',
          onClick: () => triggerStoreAction(['selectByType'], 'clipping-group'),
        },
        {
          label: 'Save Selection',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['saveCurrentSelection']),
        },
      ],
    },
    {
      id: 'effect',
      label: 'Effect',
      labelId: 'Efek Live',
      items: [
        {
          label: '3D and Materials > Extrude & Bevel...',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('extrude-3d', '3D Extrude & Bevel', {
              depth: 18,
              angleX: -18,
              angleY: 24,
              color: '#1a1a1a',
            }),
        },
        { divider: true },
        {
          label: 'Convert to Shape > Rounded Rectangle',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('convert-to-shape', 'Convert to Shape', {
              shape: 'rounded-rectangle',
              extraWidth: 12,
              extraHeight: 8,
              cornerRadius: 8,
            }),
        },
        {
          label: 'Distort & Transform > Pucker & Bloat',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('pucker-bloat', 'Pucker & Bloat', { amount: 25 }),
        },
        {
          label: 'Distort & Transform > Roughen',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('roughen', 'Roughen', { size: 5, detail: 10 }),
        },
        {
          label: 'Distort & Transform > Transform Effect (Copies)',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('transform-effect', 'Transform Effect', {
              scaleX: 95,
              scaleY: 95,
              moveX: 12,
              moveY: 8,
              angle: 15,
              copies: 4,
            }),
        },
        {
          label: 'Distort & Transform > Twist',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('twist', 'Twist', { angle: 45 }),
        },
        {
          label: 'Distort & Transform > Zig Zag',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('zig-zag', 'Zig Zag', {
              size: 6,
              ridges: 5,
              points: 'smooth',
            }),
        },
        { divider: true },
        {
          label: 'Path > Offset Path (Live)',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('offset-path', 'Offset Path', {
              offset: 6,
              joins: 'miter',
            }),
        },
        { divider: true },
        {
          label: 'Stylize > Drop Shadow',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('drop-shadow', 'Drop Shadow', {
              dx: 4,
              dy: 4,
              blur: 6,
              opacity: 0.55,
              color: '#000000',
            }),
        },
        {
          label: 'Stylize > Outer Glow',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('outer-glow', 'Outer Glow', {
              blur: 10,
              opacity: 0.75,
              color: '#00d9ff',
            }),
        },
        {
          label: 'Stylize > Round Corners',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('round-corners', 'Round Corners', { radius: 12 }),
        },
        {
          label: 'Stylize > Scribble',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('scribble', 'Scribble', {
              angle: 45,
              spacing: 4,
              strokeWidth: 1.5,
            }),
        },
        { divider: true },
        {
          label: 'Warp > Arc...',
          disabled: !hasSelection,
          onClick: () => openModal('envelope-warp'),
        },
        {
          label: 'Blur > Gaussian Blur',
          disabled: !hasSelection,
          onClick: () =>
            applyLiveEffectToSelection('gaussian-blur', 'Gaussian Blur', { radius: 6 }),
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      labelId: 'Tampilan',
      items: [
        {
          label: viewMode === 'outline' ? 'GPU Preview' : 'Outline (Wireframe)',
          shortcut: 'Ctrl+Y',
          checked: viewMode === 'outline',
          onClick: () =>
            closeMenuAndRun(() => {
              const next = viewMode === 'outline' ? 'preview' : 'outline';
              if (typeof store.setViewMode === 'function') store.setViewMode(next);
              else useStudioStore.setState({ viewMode: next } as any);
            }),
        },
        {
          label: 'Trim View (Hide Bleed & Pasteboard)',
          checked: viewMode === 'trim',
          onClick: () =>
            closeMenuAndRun(() => {
              const next = viewMode === 'trim' ? 'preview' : 'trim';
              if (typeof store.setViewMode === 'function') store.setViewMode(next);
              else useStudioStore.setState({ viewMode: next } as any);
            }),
        },
        { divider: true },
        {
          label: 'Zoom In',
          shortcut: 'Ctrl++',
          onClick: () => triggerStoreAction(['zoomIn']),
        },
        {
          label: 'Zoom Out',
          shortcut: 'Ctrl+-',
          onClick: () => triggerStoreAction(['zoomOut']),
        },
        {
          label: 'Fit Artboard in Window',
          shortcut: 'Ctrl+0',
          onClick: () => triggerStoreAction(['fitArtboardInWindow', 'resetViewport']),
        },
        {
          label: 'Actual Size (100%)',
          shortcut: 'Ctrl+1',
          onClick: () =>
            closeMenuAndRun(() => {
              if (typeof store.setZoom === 'function') store.setZoom(1);
              else useStudioStore.setState({ zoom: 1 } as any);
            }),
        },
        { divider: true },
        {
          label: 'Show Rulers',
          shortcut: 'Ctrl+R',
          checked: showRulers,
          onClick: () => toggleFlag('showRulers', showRulers),
        },
        {
          label: 'Show Bounding Box',
          shortcut: 'Shift+Ctrl+B',
          checked: showBoundingBox,
          onClick: () => toggleFlag('showBoundingBox', showBoundingBox),
        },
        {
          label: 'Show Edges',
          shortcut: 'Ctrl+H',
          checked: showEdges,
          onClick: () => toggleFlag('showEdges', showEdges),
        },
        {
          label: 'Smart Guides',
          shortcut: 'Ctrl+U',
          checked: showSmartGuides,
          onClick: () => toggleFlag('showSmartGuides', showSmartGuides),
        },
        {
          label: 'Show Grid',
          shortcut: "Ctrl+'",
          checked: showGrid,
          onClick: () => toggleFlag('showGrid', showGrid),
        },
        {
          label: 'Snap to Grid',
          shortcut: "Shift+Ctrl+'",
          checked: snapToGrid,
          onClick: () => toggleFlag('snapToGrid', snapToGrid),
        },
        {
          label: 'Show Perspective Grid',
          shortcut: 'Shift+Ctrl+I',
          checked: showPerspectiveGrid,
          onClick: () => toggleFlag('showPerspectiveGrid', showPerspectiveGrid),
        },
        {
          label: 'Show Transparency Grid',
          shortcut: 'Shift+Ctrl+D',
          checked: showTransparencyGrid,
          onClick: () => toggleFlag('showTransparencyGrid', showTransparencyGrid),
        },
        { divider: true },
        {
          label: 'Guides > Show Guides',
          shortcut: 'Ctrl+;',
          checked: showGuides,
          onClick: () => toggleFlag('showGuides', showGuides),
        },
        {
          label: 'Guides > Lock Guides',
          shortcut: 'Alt+Ctrl+;',
          checked: lockGuides,
          onClick: () => toggleFlag('lockGuides', lockGuides),
        },
        {
          label: 'Guides > Make Guides from Selection',
          shortcut: 'Ctrl+5',
          disabled: !hasSelection,
          onClick: () => triggerStoreAction(['makeGuidesFromSelection']),
        },
        {
          label: 'Guides > Clear Guides',
          onClick: () => triggerStoreAction(['clearGuides']),
        },
      ],
    },
    {
      id: 'window',
      label: 'Window',
      labelId: 'Jendela Panel',
      items: [
        ...WORKSPACE_PRESETS.map((ws) => ({
          label: `Workspace: ${ws.label}`,
          checked: activeWorkspace === ws.id,
          onClick: () => closeMenuAndRun(() => handleSwitchWorkspace(ws.id)),
        })),
        {
          label: 'Reset Current Workspace',
          onClick: () => closeMenuAndRun(() => handleSwitchWorkspace('reset')),
        },
        { divider: true as const },
        { label: 'Control', checked: controlBarVisible, onClick: () => closeMenuAndRun(() => setControlBarVisible(activeWorkspace, !controlBarVisible)) },
        { divider: true as const },
        ...STUDIO_PANEL_LIST.map((p) => ({
          label: p.label,
          shortcut: p.shortcut || undefined,
          onClick: () => handleOpenPanel(p.id),
        })),
      ],
    },
    {
      id: 'help',
      label: 'Help',
      labelId: 'Bantuan',
      items: [
        {
          label: 'Keyboard Shortcuts Reference...',
          shortcut: 'Alt+Shift+Ctrl+K',
          onClick: () => openModal('keyboard-shortcuts'),
        },
        {
          label: 'UI Brightness & Unit Preferences...',
          shortcut: 'Ctrl+K',
          onClick: () => openModal('preferences'),
        },
        { divider: true },
        {
          label: 'Return to Home Dashboard & Starter Templates',
          onClick: () => closeMenuAndRun(handleGoHome),
        },
      ],
    },
  ];

  return (
    <div ref={menuBarRef} style={{ flexShrink: 0, userSelect: 'none' }}>
      {/* Row 1: Main Application Menu Bar */}
      <header className="ai-menubar">
        {/* Left: Ai Badge, Home Button, and Dropdown Menus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Authentic Ai Badge */}
          <div className="ai-brand-badge" title="Adore Illustratoze CC">
            Ai
          </div>

          {/* Home Dashboard Button */}
          <button
            type="button"
            className="ai-icon-btn"
            onClick={handleGoHome}
            title="Home Screen / Project Dashboard"
            style={{ marginRight: 2 }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 7.2L8 2L14 7.2V13.5H10V9.5H6V13.5H2V7.2Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Top-Level Menus */}
          {menus.map((menu) => (
            <div key={menu.id} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`ai-menu-trigger ${openMenu === menu.id ? 'active' : ''}`}
                aria-haspopup="menu" aria-expanded={openMenu === menu.id}
                onClick={() => { setSubmenu(null); setOpenMenu(openMenu === menu.id ? null : menu.id); }}
                onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSubmenu(null); setOpenMenu(menu.id); requestAnimationFrame(() => menuBarRef.current?.querySelector<HTMLButtonElement>('.ai-menubar-dropdown [role="menuitem"]:not(:disabled)')?.focus()); } }}
                onMouseEnter={() => {
                  if (openMenu !== null && openMenu !== menu.id) { setSubmenu(null); setOpenMenu(menu.id); }
                }}
              >
                {language === 'id' ? menu.labelId : menu.label}
              </button>

              {openMenu === menu.id && (
                <div className="ai-dropdown-menu ai-menubar-dropdown" role="menu" aria-label={`${menu.label} menu`} onScroll={() => setSubmenu(null)} onKeyDown={event => {
                  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                  event.preventDefault();
                  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                  buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
                }}>
                  {nestMenuItems(menu.items).map((item, idx) =>
                    'divider' in item ? <div key={`div-${idx}`} className="ai-dropdown-divider" role="separator" /> :
                    'children' in item ? <button key={item.label} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={submenu?.label === item.label}
                      className="ai-dropdown-item" onMouseEnter={e => setSubmenu({ label: item.label, items: item.children, anchor: e.currentTarget })}
                      onClick={e => setSubmenu({ label: item.label, items: item.children, anchor: e.currentTarget })}
                      onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSubmenu({ label: item.label, items: item.children, anchor: e.currentTarget }); requestAnimationFrame(() => submenuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()); } }}>
                      <span className="ai-dropdown-label">{item.label}</span><ChevronRight size={14} aria-hidden="true" />
                    </button> : <button key={item.label} type="button" role="menuitem" className="ai-dropdown-item" disabled={item.disabled}
                      onMouseEnter={() => setSubmenu(null)} onClick={item.onClick}>
                      {item.checked && <span className="ai-menu-check"><Check size={13} aria-hidden="true" /></span>}
                      <span className="ai-dropdown-label" title={item.label}>{item.label}</span>
                      {item.shortcut && <span className="ai-shortcut">{item.shortcut}</span>}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: View Mode Indicator and Workspace Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* GPU Preview Badge */}
          <span
            title="Current view mode"
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 2,
              backgroundColor: 'var(--ai-bg-input)',
              border: '1px solid var(--ai-border-subtle)',
              color: 'var(--ai-text-secondary)',
            }}
          >
            {viewMode === 'outline' ? 'Outline' : 'Preview'}
          </span>

          {/* Workspace Switcher Dropdown */}
          <select
            className="ai-select"
            title="Switch Adobe Illustrator Workspace Layout"
            value={activeWorkspace}
            onChange={(e) => handleSwitchWorkspace(e.target.value)}
            style={{ height: 21, minWidth: 138, fontWeight: 500 }}
          >
            {WORKSPACE_PRESETS.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.label}
              </option>
            ))}
            <option value="reset">Reset Workspace</option>
          </select>
        </div>
      </header>

      {submenu && createPortal(<div ref={submenuRef} className="ai-dropdown-menu ai-submenu" role="menu" aria-label={`${submenu.label} submenu`}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); submenu.anchor.focus(); setSubmenu(null); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          }
        }}>
        {submenu.items.map(item => <button key={item.label} type="button" role="menuitem" className="ai-dropdown-item" disabled={item.disabled} onClick={item.onClick}>
          {item.checked && <span className="ai-menu-check"><Check size={13} aria-hidden="true" /></span>}
          <span className="ai-dropdown-label" title={item.label}>{item.label}</span>{item.shortcut && <span className="ai-shortcut">{item.shortcut}</span>}
        </button>)}
      </div>, document.body)}

      {/* Row 2: Document Tabs Bar + Isolation Mode Breadcrumb */}
      <div className="ai-doctabs-bar" role="tablist" aria-label="Open documents">
        {documents.map((d: any, index: number) => {
          const docId = d.id || `doc-${index}`;
          const isActive = docId === activeDocumentId || documents.length === 1;
          const zoomPct = Math.round((store.zoom ?? 1) * 100);
          return (
            <div
              key={docId}
              className={`ai-doctab ${isActive ? 'active' : ''}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              title={d.name || 'Untitled-1'}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + documents.length) % documents.length;
                  store.switchDocument(documents[next].id);
                  (e.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next] as HTMLElement | undefined)?.focus();
                }
              }}
              onClick={() => {
                if (typeof store.switchDocument === 'function') {
                  store.switchDocument(docId);
                } else if (typeof store.setActiveDocumentId === 'function') {
                  store.setActiveDocumentId(docId);
                }
              }}
            >
              <span className="ai-doctab-name">{d.name || 'Untitled-1'}</span>
              {isActive && <span className="ai-doctab-meta">{zoomPct}% · {d.colorMode || 'RGB'}</span>}
              {documents.length > 1 && (
                <button
                  type="button"
                  title="Close Document Tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Close "${d.name || 'Untitled'}"? Make sure your work is saved locally or exported first.`)) {
                      store.closeDocument(docId);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ai-text-secondary)',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}

        {/* + New Document Tab Button */}
        <button
          type="button"
          className="ai-icon-btn"
          title="New Document Tab (Ctrl+N)"
          onClick={() => openModal('new-document')}
          style={{ width: 20, height: 20, marginBottom: 2 }}
        >
          <Plus size={14} aria-hidden="true" />
        </button>

        {/* Isolation Mode Breadcrumb Indicator */}
        {isolatedGroupId && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 10px',
              backgroundColor: 'var(--ai-accent-blue)',
              color: '#ffffff',
              borderRadius: '2px 2px 0 0',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Lock size={13} aria-hidden="true" /><span>Isolation Mode: {store.getActiveDocument?.()?.nodes?.[isolatedGroupId]?.name || '<Group>'}</span>
            <button
              type="button"
              onClick={() => {
                if (typeof store.exitIsolationMode === 'function') {
                  store.exitIsolationMode();
                } else {
                  useStudioStore.setState({ isolatedGroupId: null } as any);
                }
              }}
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: 'none',
                color: '#ffffff',
                borderRadius: 2,
                padding: '1px 6px',
                cursor: 'pointer',
                fontSize: 10,
              }}
            >
              Exit (Esc)
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Inputs for Open (.adloze/.svg) and Place Image */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".adloze,.svg,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (typeof store.importFile === 'function') {
              store.importFile(file);
            } else {
              window.dispatchEvent(new CustomEvent('ai-import-file', { detail: { file } }));
            }
          }
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={placeInputRef}
        type="file"
        accept="image/*,.svg"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (typeof store.placeArtworkFile === 'function') {
              store.placeArtworkFile(file);
            } else {
              window.dispatchEvent(new CustomEvent('ai-place-file', { detail: { file } }));
            }
          }
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
};

export default TopMenuBar;
