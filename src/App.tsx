import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStudioStore } from './state/useStudioStore';
import { useKeyboardShortcuts } from './core/shortcuts/useKeyboardShortcuts';
import { HomeDashboard } from './components/home/HomeDashboard';
import { TopMenuBar } from './components/workspace/TopMenuBar';
import { ControlBar } from './components/workspace/ControlBar';
import { useControlBarVisible } from './components/workspace/workspaceChrome';
import { CanvasContextMenu } from './components/workspace/CanvasContextMenu';
import { LeftToolbar } from './components/workspace/LeftToolbar';
import { DockManager } from './components/workspace/DockManager';
import { BottomStatusBar } from './components/workspace/BottomStatusBar';
import { renderStudioPanel } from './components/panels/PanelRegistry';
import { StudioModals } from './components/modals/StudioModals';
import { StudioCanvas } from './components/canvas/StudioCanvas';
import {
  saveProjectToDb,
  saveCrashRecoverySnapshot,
  getCrashRecoverySnapshot,
  clearCrashRecoverySnapshot,
} from './core/io/db';
import { createAutosaveCoordinator } from './core/io/autosave';
import { importAdlozeFile, exportDocumentAsAdlozeFile } from './core/io/adlozeIo';
import { parseSvgStringToVectorNodes } from './core/io/svgIo';
import { createDefaultDocument } from './core/presets/defaultPresets';
import { createRectangleAnchors, makeAnchorId } from './core/math/bezier';
import type { StudioDocument, UIThemeBrightness, VectorNode } from './core/types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function getImageNaturalDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: Math.max(24, img.naturalWidth || 400),
        height: Math.max(24, img.naturalHeight || 300),
      });
    };
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = dataUrl;
  });
}

export const App: React.FC = () => {
  const store = useStudioStore();
  const showHomeScreen = useStudioStore((s) => s.showHomeScreen);
  const workspace = useStudioStore((s) => s.activeWorkspace);
  const showControlBar = useControlBarVisible(workspace);
  const uiBrightness: UIThemeBrightness = useStudioStore((s) => s.uiBrightness || 'dark');
  const pasteboardMatchUI = useStudioStore((s) => s.pasteboardMatchUI);
  const activeDocument = useStudioStore((s) => s.documents[s.activeDocumentId] || s.document);

  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const [crashRecoveryBanner, setCrashRecoveryBanner] = useState<{
    id: string;
    document: StudioDocument;
    savedAt: number;
  } | null>(null);

  const dragCounterRef = useRef(0);
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const placeFileInputRef = useRef<HTMLInputElement>(null);

  // Bind global Adobe Illustrator CC keyboard shortcuts
  useKeyboardShortcuts(true);

  // Apply Adobe Illustrator UI Brightness theme class & data attributes
  const themeClassName = `theme-${uiBrightness}`;

  useEffect(() => {
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const allThemeClasses = [
      'theme-dark',
      'theme-medium-dark',
      'theme-medium-light',
      'theme-light',
    ];

    rootEl.classList.remove(...allThemeClasses);
    bodyEl.classList.remove(...allThemeClasses);
    rootEl.classList.add(themeClassName);
    bodyEl.classList.add(themeClassName);

    rootEl.setAttribute('data-ui-theme', uiBrightness);
    rootEl.setAttribute('data-theme', uiBrightness);
    rootEl.setAttribute('data-pasteboard', pasteboardMatchUI ? 'match' : 'white');
  }, [uiBrightness, pasteboardMatchUI, themeClassName]);

  // Each page session has its own recovery records; unresolved earlier sessions
  // remain untouched until the user chooses Restore or Dismiss.
  useEffect(() => {
    let cancelled = false;
    if (!showHomeScreen) getCrashRecoverySnapshot().then(snapshot => {
      if (!cancelled) setCrashRecoveryBanner(snapshot ? {id:snapshot.id, document:snapshot.document, savedAt:snapshot.savedAt} : null);
    }).catch(() => { if (!cancelled) store.setStatusMessage('Recovery storage unavailable. Export a backup of your work.'); });
    return () => { cancelled = true; };
  }, [showHomeScreen]);

  const autosaveRef = useRef<ReturnType<typeof createAutosaveCoordinator> | null>(null);
  if (!autosaveRef.current) autosaveRef.current = createAutosaveCoordinator(
    async doc => {
      const results = await Promise.allSettled([saveCrashRecoverySnapshot(doc, true), saveProjectToDb(doc)]);
      if (results.some(result => result.status === 'rejected')) throw new Error('Storage write failed');
    },
    () => useStudioStore.getState().setStatusMessage('Autosave failed. Export a backup and check browser storage.'),
  );
  const firstDocument = useRef(activeDocument);
  useEffect(() => {
    if (firstDocument.current === activeDocument) return;
    firstDocument.current = activeDocument;
    if (activeDocument) autosaveRef.current!.schedule(activeDocument);
  }, [activeDocument]);
  useEffect(() => {
    const flush = () => autosaveRef.current?.flushAll();
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  // Unified File Ingestion (.adloze, .svg, .png, .jpg, .webp)
  const processIncomingFiles = useCallback(
    async (files: FileList | File[], mode: 'open' | 'place' = 'open') => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const s = useStudioStore.getState();
      const currentDoc = s.getActiveDocument();
      const activeAb =
        currentDoc.artboards.find((a) => a.id === currentDoc.activeArtboardId) ||
        currentDoc.artboards[0] || { x: 0, y: 0, width: 1200, height: 800 };

      for (const file of fileArray) {
        const lowerName = file.name.toLowerCase();

        try {
          // 1. Native .adloze Archive
          if (lowerName.endsWith('.adloze')) {
            const { document: unpackedDoc } = await importAdlozeFile(file);
            await saveProjectToDb(unpackedDoc);
            s.openDocument(unpackedDoc);
            s.setShowHomeScreen(false);
            s.setStatusMessage(`Opened project "${unpackedDoc.name}"`);
            continue;
          }

          // 2. Vector SVG File (.svg)
          if (lowerName.endsWith('.svg') || file.type === 'image/svg+xml') {
            const svgText = await file.text();
            const targetLayer =
              currentDoc.layers.find((l) => l.id === currentDoc.activeLayerId) ||
              currentDoc.layers[0];
            const parsed = parseSvgStringToVectorNodes(
              svgText,
              targetLayer ? targetLayer.id : 'layer-1'
            );

            if (s.showHomeScreen && mode === 'open') {
              const newDoc = createDefaultDocument({
                name: file.name.replace(/\.svg$/i, '.adloze'),
                width: Math.max(100, Math.round(parsed.viewBox.width || 1200)),
                height: Math.max(100, Math.round(parsed.viewBox.height || 800)),
                unit: 'px',
                colorMode: 'RGB',
                includeSampleArtwork: false,
              });
              const firstLayer = newDoc.layers[0];
              for (const node of parsed.nodes) {
                node.layerId = firstLayer.id;
                newDoc.nodes[node.id] = node;
                if (!node.parentId) {
                  firstLayer.nodeIds.push(node.id);
                }
              }
              await saveProjectToDb(newDoc);
              s.openDocument(newDoc);
              s.setShowHomeScreen(false);
              s.setStatusMessage(`Imported SVG "${file.name}" (${parsed.nodes.length} objects)`);
            } else {
              const importedTopIds: string[] = [];
              s.updateDocument((d) => {
                const layer =
                  d.layers.find((l) => l.id === d.activeLayerId) || d.layers[0];
                if (!layer) return;
                for (const node of parsed.nodes) {
                  node.layerId = layer.id;
                  d.nodes[node.id] = node;
                  if (!node.parentId) {
                    layer.nodeIds.push(node.id);
                    importedTopIds.push(node.id);
                  }
                }
              }, `Import SVG "${file.name}"`);
              if (importedTopIds.length > 0) {
                s.selectNodes(importedTopIds, false);
              }
              s.setShowHomeScreen(false);
              s.setStatusMessage(`Placed SVG "${file.name}" (${parsed.nodes.length} vector nodes)`);
            }
            continue;
          }

          // 3. Raster Images (.png, .jpg, .jpeg, .webp)
          if (
            file.type.startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)
          ) {
            const dataUrl = await readFileAsDataUrl(file);
            const dims = await getImageNaturalDimensions(dataUrl);
            const maxDim = 640;
            const scale =
              dims.width > maxDim || dims.height > maxDim
                ? Math.min(maxDim / dims.width, maxDim / dims.height)
                : 1;
            const w = Math.max(24, Math.round(dims.width * scale));
            const h = Math.max(24, Math.round(dims.height * scale));
            const x = Math.round(activeAb.x + (activeAb.width - w) / 2);
            const y = Math.round(activeAb.y + (activeAb.height - h) / 2);

            const targetLayer =
              currentDoc.layers.find((l) => l.id === currentDoc.activeLayerId) ||
              currentDoc.layers[0];

            const imageNode: VectorNode = {
              id: makeAnchorId('img'),
              name: `<Image: ${file.name}>`,
              type: 'image',
              layerId: targetLayer ? targetLayer.id : 'layer-1',
              visible: true,
              locked: false,
              x,
              y,
              width: w,
              height: h,
              rotation: 0,
              points: createRectangleAnchors(x, y, w, h),
              closed: true,
              imageUrl: dataUrl,
              fills: [
                {
                  id: makeAnchorId('fill'),
                  visible: true,
                  type: 'solid',
                  color: '#ffffff',
                  opacity: 1,
                  blendMode: 'normal',
                },
              ],
              strokes: [],
              effects: [],
              opacity: 1,
              blendMode: 'normal',
            };

            s.addNode(imageNode, `Place Image "${file.name}"`);
            s.setShowHomeScreen(false);
            s.setStatusMessage(
              `Placed raster image "${file.name}" (${w}×${h}px) — Select "Image Trace" in Control Bar to vectorize`
            );
          }
        } catch (err) {
          console.error('Error importing dropped/selected file:', err);
          s.setStatusMessage(`Failed to import "${file.name}"`);
        }
      }
    },
    []
  );

  // Listen for custom file import/place/save events from TopMenuBar & Keyboard Shortcuts
  useEffect(() => {
    const onImportEvent = (e: Event) => {
      const file = (e as CustomEvent)?.detail?.file as File | undefined;
      if (file) processIncomingFiles([file], 'open');
    };
    const onPlaceEvent = (e: Event) => {
      const file = (e as CustomEvent)?.detail?.file as File | undefined;
      if (file) processIncomingFiles([file], 'place');
    };
    const onTriggerOpen = () => openFileInputRef.current?.click();
    const onTriggerPlace = () => placeFileInputRef.current?.click();

    // Provide saveProjectArchive helper on store instance if invoked from TopMenuBar
    const stateAny = useStudioStore.getState() as any;
    if (!stateAny.saveProjectArchive) {
      useStudioStore.setState({
        saveProjectArchive: () => {
          const doc = useStudioStore.getState().getActiveDocument();
          saveProjectToDb(doc).catch(() => {});
          exportDocumentAsAdlozeFile(doc);
        },
        importFile: (file: File) => processIncomingFiles([file], 'open'),
        placeArtworkFile: (file: File) => processIncomingFiles([file], 'place'),
      } as any);
    }

    window.addEventListener('ai-import-file', onImportEvent);
    window.addEventListener('ai-place-file', onPlaceEvent);
    window.addEventListener('ai-trigger-open-file', onTriggerOpen);
    window.addEventListener('ai-trigger-place-file', onTriggerPlace);

    return () => {
      window.removeEventListener('ai-import-file', onImportEvent);
      window.removeEventListener('ai-place-file', onPlaceEvent);
      window.removeEventListener('ai-trigger-open-file', onTriggerOpen);
      window.removeEventListener('ai-trigger-place-file', onTriggerPlace);
    };
  }, [processIncomingFiles]);

  // Window Drag-and-Drop Handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      dragCounterRef.current += 1;
      setIsDraggingFileOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFileOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFileOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await processIncomingFiles(e.dataTransfer.files, 'open');
    }
  };

  return (
    <div
      className={`ai-studio-root ${themeClassName}`}
      data-ui-theme={uiBrightness}
      data-theme={uiBrightness}
      data-pasteboard={pasteboardMatchUI ? 'match' : 'white'}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'var(--ai-bg-app)',
        color: 'var(--ai-text-primary)',
      }}
    >
      {/* Hidden File Inputs for Keyboard Shortcut Ctrl+O and Shift+Ctrl+P */}
      <input
        ref={openFileInputRef}
        type="file"
        accept=".adloze,.svg,image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processIncomingFiles(e.target.files, 'open');
          }
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={placeFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.svg,.adloze"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processIncomingFiles(e.target.files, 'place');
          }
          e.currentTarget.value = '';
        }}
      />

      {/* Crash Recovery Notification Bar (if unsaved session detected on startup) */}
      {crashRecoveryBanner && !showHomeScreen && (
        <div
          style={{
            height: 26,
            backgroundColor: '#2d2314',
            borderBottom: '1px solid #ff9a00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            fontSize: 11,
            color: '#ffffff',
            zIndex: 300,
            flexShrink: 0,
          }}
        >
          <span>
            ⚠ Recovered autosave snapshot available: <strong>{crashRecoveryBanner.document.name}</strong> (
            {new Date(crashRecoveryBanner.savedAt).toLocaleTimeString()})
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="ai-btn active"
              style={{ height: 19, padding: '0 8px', fontSize: 10 }}
              onClick={async () => {
                try {
                  const docToRestore = crashRecoveryBanner.document;
                  await saveProjectToDb(docToRestore);
                  store.openDocument(docToRestore);
                  await clearCrashRecoverySnapshot(crashRecoveryBanner.id);
                  const next = await getCrashRecoverySnapshot();
                  setCrashRecoveryBanner(next ? {id:next.id, document:next.document, savedAt:next.savedAt} : null);
                } catch { store.setStatusMessage('Recovery failed. Your recovery snapshot was not intentionally discarded; check browser storage.'); }
              }}
            >
              Restore Document
            </button>
            <button
              type="button"
              className="ai-btn"
              style={{ height: 19, padding: '0 8px', fontSize: 10 }}
              onClick={async () => {
                try {
                  await clearCrashRecoverySnapshot(crashRecoveryBanner.id);
                  const next = await getCrashRecoverySnapshot();
                  setCrashRecoveryBanner(next ? {id:next.id, document:next.document, savedAt:next.savedAt} : null);
                } catch { store.setStatusMessage('Could not dismiss recovery snapshot. Check browser storage.'); }
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main View Switcher: HomeDashboard vs. Adobe Illustrator CC Studio Workspace */}
      {showHomeScreen ? (
        <HomeDashboard onClose={() => store.setShowHomeScreen(false)} />
      ) : (
        <>
          {/* Top Application Menu Bar & Multi-Document Tabs */}
          <TopMenuBar />

          {/* Contextual Sub-Header Control Bar */}
          {showControlBar && <ControlBar />}

          {/* Center Studio Workspace Area: Left Toolbar + Infinite Vector Canvas + Dockable Panels */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden',
              position: 'relative',
              minHeight: 0,
            }}
          >
            <LeftToolbar />

            <DockManager renderPanel={renderStudioPanel}>
              <CanvasContextMenu><StudioCanvas /></CanvasContextMenu>
            </DockManager>
          </div>

          {/* Bottom Status Bar */}
          <BottomStatusBar />
        </>
      )}

      {/* Studio Modals (New Document, Export for Screens, Image Trace, Recolor Artwork, etc.) */}
      <StudioModals />

      {/* Drag-and-Drop Overlay */}
      {isDraggingFileOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(20, 115, 230, 0.24)',
            border: '3px dashed #1473e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--ai-bg-panel)',
              border: '1px solid var(--ai-border-focus)',
              borderRadius: 6,
              padding: '20px 32px',
              boxShadow: 'var(--ai-shadow-floating)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ai-text-primary)' }}>
              Drop File into Adore Illustratoze Studio
            </div>
            <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)', marginTop: 6 }}>
              Supports native <strong>.adloze</strong> archives, <strong>.svg</strong> vector artwork, and{' '}
              <strong>.png / .jpg / .webp</strong> raster images
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
