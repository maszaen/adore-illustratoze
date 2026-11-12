import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePlus,
  FolderOpen,
  Grid,
  Home,
  Layers,
  LayoutTemplate,
  List,
  MoreVertical,
  Copy,
  Download,
  Edit3,
  Trash2,
  Search,
  Settings,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import type { StudioDocument } from '../../core/types';
import {
  STARTER_TEMPLATES,
  createDefaultDocument,
  type StarterTemplateItem,
} from '../../core/presets/defaultPresets';
import {
  listProjectsFromDb,
  saveProjectToDb,
  deleteProjectFromDb,
  duplicateProjectInDb,
  renameProjectInDb,
  getCrashRecoverySnapshot,
  clearCrashRecoverySnapshot,
  type StoredProjectRecord,
} from '../../core/io/db';
import { exportDocumentAsAdlozeFile, importAdlozeFile } from '../../core/io/adlozeIo';
import { exportDocumentToSvgString, parseSvgStringToVectorNodes } from '../../core/io/svgIo';

type HomeNavTab = 'home' | 'projects' | 'templates';

export interface HomeDashboardProps {
  onClose?: () => void;
}

function darkenAccent(color: string): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return 'var(--ai-text-primary)';
  return `#${match.slice(1).map(value => Math.round(parseInt(value, 16) * 0.52).toString(16).padStart(2, '0')).join('')}`;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onClose }) => {
  const store = useStudioStore() as any;
  const language: 'id' | 'en' = store.language || 'en';
  const lightTheme = store.uiBrightness === 'light' || store.uiBrightness === 'medium-light';

  const [navTab, setNavTab] = useState<HomeNavTab>('home');
  const [projects, setProjects] = useState<StoredProjectRecord[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'artboards'>('updated');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [recoveryDoc, setRecoveryDoc] = useState<{
    document: StudioDocument;
    savedAt: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = async () => {
    const [projList, recovery] = await Promise.all([
      listProjectsFromDb(),
      getCrashRecoverySnapshot(),
    ]);
    setProjects(projList);
    if (recovery && recovery.dirty && recovery.document) {
      setRecoveryDoc({ document: recovery.document, savedAt: recovery.savedAt });
    }
  };

  useEffect(() => {
    refreshData().catch(() => setHomeError(language === 'id' ? 'Tidak dapat memuat proyek lokal.' : 'Could not load local projects.'));
  }, []);

  const enterStudioWithDocument = async (doc: StudioDocument): Promise<boolean> => {
    try {
    await saveProjectToDb(doc);
    if (typeof store.openDocument === 'function') {
      store.openDocument(doc);
    } else if (typeof store.loadDocument === 'function') {
      store.loadDocument(doc);
    } else {
      useStudioStore.setState((state: any) => ({
        ...state,
        document: doc,
        activeDocument: doc,
        activeDocumentId: doc.id,
        documents: { ...(state.documents || {}), [doc.id]: doc },
        selectedIds: [],
        selectedNodeIds: [],
        showHomeScreen: false,
      }));
    }

    if (typeof store.setShowHomeScreen === 'function') {
      store.setShowHomeScreen(false);
    } else if (typeof store.setShowHomeDashboard === 'function') {
      store.setShowHomeDashboard(false);
    } else {
      useStudioStore.setState({ showHomeScreen: false } as any);
    }
    onClose?.();
    return true;
    } catch (err) {
      console.error('Failed to open project:', err);
      setHomeError(language === 'id' ? 'Proyek tidak dapat disimpan atau dibuka. Periksa penyimpanan perangkat.' : 'Could not save or open the project. Check device storage and try again.');
      return false;
    }
  };

  const openModal = (modalName: 'new-document' | 'preferences') => {
    if (typeof store.setActiveModal === 'function') {
      store.setActiveModal(modalName);
    } else if (typeof store.openModal === 'function') {
      store.openModal(modalName);
    } else {
      useStudioStore.setState({ activeModal: modalName } as any);
    }
  };

  const handleOpenStarterTemplate = async (tpl: StarterTemplateItem) => {
    const built = tpl.buildDocument();
    built.id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await enterStudioWithDocument(built);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHomeError(null);
    try {
      if (file.name.toLowerCase().endsWith('.adloze')) {
        const { document: unpacked } = await importAdlozeFile(file);
        await enterStudioWithDocument(unpacked);
      } else if (file.name.toLowerCase().endsWith('.svg')) {
        const svgText = await file.text();
        const parsed = parseSvgStringToVectorNodes(svgText, 'layer-artwork');
        const newDoc = createDefaultDocument({
          name: file.name.replace(/\.svg$/i, '.adloze'),
          width: Math.max(100, Math.round(parsed.viewBox.width)),
          height: Math.max(100, Math.round(parsed.viewBox.height)),
          unit: 'px',
          colorMode: 'RGB',
          includeSampleArtwork: false,
        });
        const targetLayer = newDoc.layers[0];
        for (const node of parsed.nodes) {
          node.layerId = targetLayer.id;
          newDoc.nodes[node.id] = node;
          if (!node.parentId) {
            targetLayer.nodeIds.push(node.id);
          }
        }
        await enterStudioWithDocument(newDoc);
      }
    } catch (err) {
      console.error('Failed to open file:', err);
      setHomeError(language === 'id' ? 'File tidak dapat dibuka. Periksa format atau coba lagi.' : 'Could not open the file. Check the format or try again.');
    } finally {
      e.target.value = '';
    }
  };

  const handleOpenProject = async (proj: StoredProjectRecord) => {
    await enterStudioWithDocument(proj.document);
  };

  const handleDuplicateProject = async (id: string) => {
    await duplicateProjectInDb(id);
    setMenuOpenId(null);
    await refreshData();
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Delete this local project? This cannot be undone.')) return;
    await deleteProjectFromDb(id);
    setMenuOpenId(null);
    await refreshData();
  };

  const handleCommitRename = async (id: string) => {
    if (renameText.trim()) {
      await renameProjectInDb(id, renameText.trim());
      await refreshData();
    }
    setRenamingId(null);
  };

  const templatePreviews = useMemo(() => Object.fromEntries(STARTER_TEMPLATES.map(template => {
    const document = template.buildDocument();
    const svg = exportDocumentToSvgString(document, { responsive: true });
    return [template.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`];
  })), []);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => !q || p.name.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'artboards') return b.artboardCount - a.artboardCount;
      return b.updatedAt - a.updatedAt;
    });
  }, [projects, searchQuery, sortBy]);

  return (
    <div
      className="ai-home-dashboard"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        background: 'var(--ai-bg-app)',
        color: 'var(--ai-text-primary)',
        fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
        fontSize: 12,
        userSelect: 'none',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".adloze,.svg"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="ai-home-sidebar"
        style={{
          width: 228,
          background: 'var(--ai-bg-header)',
          borderRight: '1px solid #141414',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: 3,
          flexShrink: 0,
        }}
      >
        {/* Brand Header */}
        <div className="ai-home-brand"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 8px 16px 8px',
            borderBottom: '1px solid var(--ai-border-subtle)',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: '#330000',
              border: '1px solid #ff9a00',
              color: '#ff9a00',
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: -0.5,
            }}
          >
            Ai
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ai-text-primary)' }}>
              Adore Illustratoze
            </div>
            <div style={{ fontSize: 10, color: 'var(--ai-text-secondary)' }}>Vector design studio</div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <button className="ai-home-primary"
          onClick={() => openModal('new-document')}
          style={{
            height: 34,
            borderRadius: 17,
            background: '#1473e6',
            border: 'none',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            marginBottom: 1,
          }}
        >
          <FilePlus size={15} />
          {language === 'id' ? 'Dokumen baru' : 'New document'}
        </button>

        <button className="ai-home-secondary"
          onClick={() => fileInputRef.current?.click()}
          style={{
            height: 32,
            borderRadius: 16,
            background: 'transparent',
            border: '1px solid #5a5a5a',
            color: 'var(--ai-text-primary)',
            fontWeight: 500,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            marginBottom: 6,
          }}
        >
          <FolderOpen size={14} />
          {language === 'id' ? 'Buka file' : 'Open file'}
        </button>

        {/* Navigation Links */}
        {(
          [
            {
              id: 'home',
              label: language === 'id' ? 'Beranda' : 'Home',
              icon: <Home size={15} />,
            },
            {
              id: 'projects',
              label: language === 'id' ? 'Proyek Saya (Lokal)' : 'My Projects (Local)',
              icon: <Layers size={15} />,
            },
            {
              id: 'templates',
              label: language === 'id' ? 'Template Siap Pakai' : 'Starter Templates',
              icon: <LayoutTemplate size={15} />,
            },
          ] as const
        ).map((item) => {
          const active = navTab === item.id;
          return (
            <button
              key={item.id}
              className="ai-home-nav-item" aria-current={active ? 'page' : undefined}
              onClick={() => setNavTab(item.id)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 5,
                background: active ? 'var(--ai-bg-hover)' : 'transparent',
                border: 'none',
                color: active ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)',
                fontWeight: active ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="ai-home-spacer" style={{ flex: 1 }} />

        <button
          onClick={() => openModal('preferences')}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 5,
            background: 'transparent',
            border: 'none',
            color: 'var(--ai-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Settings size={15} />
          <span>{language === 'id' ? 'Preferensi...' : 'Preferences...'}</span>
        </button>

        <button
          onClick={() => {
            if (typeof store.setShowHomeScreen === 'function') {
              store.setShowHomeScreen(false);
            } else if (typeof store.setShowHomeDashboard === 'function') {
              store.setShowHomeDashboard(false);
            } else {
              useStudioStore.setState({ showHomeScreen: false } as any);
            }
            onClose?.();
          }}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 5,
            background: 'var(--ai-bg-panel)',
            border: '1px solid var(--ai-border-subtle)',
            color: '#ff9a00',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>{language === 'id' ? 'Kembali ke Kanvas' : 'Return to Studio'}</span>
          <ArrowRight size={14} />
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="ai-home-main"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <header className="ai-home-welcome">
          <div>
            <p className="ai-home-eyebrow">ADORE ILLUSTRATOZE</p>
            <h1>{language === 'id' ? 'Ruang untuk berkarya.' : 'Make something meaningful.'}</h1>
            <p>{language === 'id' ? 'Mulai dari dokumen baru, buka file, atau lanjutkan proyek lokalmu.' : 'Start a new document, open a file, or pick up a local project.'}</p>
          </div>
          <div className="ai-home-local-note"><CheckCircle2 size={15} aria-hidden="true" />{language === 'id' ? 'Proyek tersimpan di perangkat ini' : 'Projects are stored on this device'}</div>
        </header>
        {homeError && <div className="ai-home-error" role="alert">{homeError}<button type="button" aria-label="Dismiss error" onClick={() => setHomeError(null)}>×</button></div>}

        {/* Crash Recovery Banner if available */}
        {recoveryDoc && (
          <div
            style={{
              background: 'var(--ai-bg-elevated)',
              border: '1px solid #ff9a00',
              borderRadius: 6,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color="#ff9a00" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                  Unsaved Session Recovery Available: "{recoveryDoc.document.name}"
                </div>
                <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>
                  Autosaved at {new Date(recoveryDoc.savedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  const docToRestore = recoveryDoc.document;
                  if (await enterStudioWithDocument(docToRestore)) {
                    await clearCrashRecoverySnapshot();
                    setRecoveryDoc(null);
                  }
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  background: '#ff9a00',
                  color: '#1a1a1a',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Recover Session
              </button>
              <button
                onClick={async () => {
                  await clearCrashRecoverySnapshot();
                  setRecoveryDoc(null);
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--ai-text-secondary)',
                  border: '1px solid var(--ai-border-subtle)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* PROJECT LIST MANAGER (Shown on Home and My Projects tabs) */}
        {(navTab === 'home' || navTab === 'projects') && (
          <section className="ai-home-projects" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className="ai-home-projects-heading"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div className="ai-home-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                  {language === 'id' ? 'Proyek terbaru' : 'Recent projects'} (
                  {filteredProjects.length})
                </h3>
              </div>

              {/* Search, Sort & View Controls */}
              <div className="ai-home-project-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="ai-home-search"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Search
                    size={13}
                    color="#9e9e9e"
                    style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    aria-label={language === 'id' ? 'Cari proyek' : 'Search projects'}
                    placeholder={language === 'id' ? 'Cari proyek...' : 'Search projects...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      height: 28,
                      width: 210,
                      paddingLeft: 26,
                      paddingRight: 8,
                      borderRadius: 4,
                      background: 'var(--ai-bg-input)',
                      border: '1px solid var(--ai-border-subtle)',
                      color: 'var(--ai-text-primary)',
                      fontSize: 11,
                    }}
                  />
                </div>

                <select aria-label={language === 'id' ? 'Urutkan proyek' : 'Sort projects'}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 4,
                    background: 'var(--ai-bg-input)',
                    border: '1px solid var(--ai-border-subtle)',
                    color: 'var(--ai-text-primary)',
                    fontSize: 11,
                  }}
                >
                  <option value="updated">Sort: Last Modified</option>
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="artboards">Sort: Artboards</option>
                </select>

                <div
                  style={{
                    display: 'flex',
                    background: 'var(--ai-bg-input)',
                    border: '1px solid var(--ai-border-subtle)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Grid View" aria-label="Grid view" aria-pressed={viewMode === 'grid'}
                    style={{
                      width: 28,
                      height: 26,
                      border: 'none',
                      background: viewMode === 'grid' ? '#1473e6' : 'transparent',
                      color: viewMode === 'grid' ? '#ffffff' : 'var(--ai-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Grid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List View" aria-label="List view" aria-pressed={viewMode === 'list'}
                    style={{
                      width: 28,
                      height: 26,
                      border: 'none',
                      background: viewMode === 'list' ? '#1473e6' : 'transparent',
                      color: viewMode === 'list' ? '#ffffff' : 'var(--ai-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div
                style={{
                  background: 'var(--ai-bg-header)',
                  border: '1px dashed #3f3f3f',
                  borderRadius: 8,
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--ai-text-secondary)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ai-text-primary)', marginBottom: 4 }}>
                  {searchQuery.trim() ? (language === 'id' ? 'Tidak ada proyek yang cocok' : 'No projects match your search') : (language === 'id' ? 'Belum ada proyek lokal' : 'No local projects yet')}
                </div>
                <div style={{ fontSize: 11 }}>
                  {searchQuery.trim() ? (language === 'id' ? 'Coba kata kunci lain.' : 'Try a different search.') : (language === 'id' ? 'Buat dokumen baru atau buka file untuk mulai berkarya.' : 'Create a document or open a file to get started.')}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(230px, 100%), 1fr))',
                  gap: 14,
                }}
              >
                {filteredProjects.map((proj) => (
                  <div
                    key={proj.id}
                    style={{
                      background: 'var(--ai-bg-header)',
                      border: '1px solid var(--ai-border-subtle)',
                      borderRadius: 8,
                      overflow: 'visible',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      zIndex: menuOpenId === proj.id ? 21 : 'auto',
                    }}
                  >
                    <div
                      role="button" tabIndex={0} aria-label={`Open ${proj.name}`}
                      onClick={() => handleOpenProject(proj)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleOpenProject(proj); } }}
                      style={{
                        height: 128,
                        background: '#1a1a1a',
                        borderBottom: '1px solid var(--ai-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        borderTopLeftRadius: 7,
                        borderTopRightRadius: 7,
                      }}
                    >
                      {proj.thumbnailDataUrl ? (
                        <img
                          src={proj.thumbnailDataUrl}
                          alt={proj.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <Layers size={28} color="#555" />
                      )}
                    </div>

                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {renamingId === proj.id ? (
                        <input
                          type="text"
                          value={renameText}
                          autoFocus
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={() => handleCommitRename(proj.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitRename(proj.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          style={{
                            height: 22,
                            background: 'var(--ai-bg-app)',
                            border: '1px solid #1473e6',
                            color: 'var(--ai-text-primary)',
                            borderRadius: 3,
                            padding: '0 6px',
                            fontSize: 12,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span
                            onClick={() => handleOpenProject(proj)}
                            style={{
                              fontWeight: 600,
                              color: 'var(--ai-text-primary)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {proj.name}
                          </span>
                          <button
                            aria-label={`Actions for ${proj.name}`} aria-expanded={menuOpenId === proj.id}
                            onClick={() =>
                              setMenuOpenId(menuOpenId === proj.id ? null : proj.id)
                            }
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--ai-text-secondary)',
                              cursor: 'pointer',
                              padding: 2,
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      )}

                      <div style={{ fontSize: 10, color: 'var(--ai-text-secondary)' }}>
                        {Math.round(proj.width)} × {Math.round(proj.height)} {proj.unit} •{' '}
                        {proj.colorMode} • {proj.artboardCount} Artboard(s)
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ai-text-muted)' }}>
                        Modified {new Date(proj.updatedAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Context Action Dropdown */}
                    {menuOpenId === proj.id && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 36,
                          background: 'var(--ai-bg-panel)',
                          border: '1px solid var(--ai-border-subtle)',
                          borderRadius: 6,
                          padding: 4,
                          zIndex: 20,
                          minWidth: 150,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                        }}
                      >
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setRenamingId(proj.id);
                            setRenameText(proj.name);
                          }}
                          style={actionMenuBtnStyle}
                        >
                          <Edit3 size={12} /> Rename
                        </button>
                        <button
                          onClick={() => handleDuplicateProject(proj.id)}
                          style={actionMenuBtnStyle}
                        >
                          <Copy size={12} /> Duplicate
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            exportDocumentAsAdlozeFile(proj.document, proj.name);
                          }}
                          style={actionMenuBtnStyle}
                        >
                          <Download size={12} /> Export .adloze
                        </button>
                        <button
                          onClick={() => handleDeleteProject(proj.id)}
                          style={{ ...actionMenuBtnStyle, color: '#ff6b6b' }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* LIST VIEW */
              <div
                className="ai-home-table-wrap"
                style={{
                  background: 'var(--ai-bg-header)',
                  border: '1px solid var(--ai-border-subtle)',
                  borderRadius: 8,
                  overflow: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--ai-bg-panel-header)',
                        color: 'var(--ai-text-secondary)',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--ai-border-subtle)',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>Project Name</th>
                      <th style={{ padding: '8px 12px' }}>Dimensions</th>
                      <th style={{ padding: '8px 12px' }}>Color Mode</th>
                      <th style={{ padding: '8px 12px' }}>Artboards</th>
                      <th style={{ padding: '8px 12px' }}>Modified</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((proj) => (
                      <tr
                        key={proj.id}
                        style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}
                      >
                        <td
                          onClick={() => handleOpenProject(proj)}
                          style={{
                            padding: '8px 12px',
                            fontWeight: 600,
                            color: 'var(--ai-text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {proj.name}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--ai-text-secondary)' }}>
                          {Math.round(proj.width)} × {Math.round(proj.height)} {proj.unit}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--ai-text-secondary)' }}>{proj.colorMode}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--ai-text-secondary)' }}>
                          {proj.artboardCount}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--ai-text-secondary)' }}>
                          {new Date(proj.updatedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => handleOpenProject(proj)}
                              style={listSmallBtnStyle}
                            >
                              Open
                            </button>
                            <button
                              onClick={() => handleDuplicateProject(proj.id)}
                              style={listSmallBtnStyle}
                            >
                              Duplicate
                            </button>
                            <button
                              onClick={() => exportDocumentAsAdlozeFile(proj.document, proj.name)}
                              style={listSmallBtnStyle}
                            >
                              .adloze
                            </button>
                            <button
                              onClick={() => handleDeleteProject(proj.id)}
                              style={{ ...listSmallBtnStyle, color: '#ff6b6b' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {/* STARTER TEMPLATES GALLERY (Shown on Home and Templates tabs) */}
        {(navTab === 'home' || navTab === 'templates') && (
          <section>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8,
                marginBottom: 12,
              }}
            >
              <div className="ai-home-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                  {language === 'id'
                    ? 'Template awal'
                    : 'Starter templates'}
                </h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>
                Editable vector artwork to make your own
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(245px, 100%), 1fr))',
                gap: 14,
              }}
            >
              {STARTER_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id} role="button" tabIndex={0} className="ai-home-card"
                  onClick={() => handleOpenStarterTemplate(tpl)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleOpenStarterTemplate(tpl); } }}
                  style={{
                    background: 'var(--ai-bg-header)',
                    border: '1px solid var(--ai-border-subtle)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Vector Artwork Thumbnail Preview */}
                  <div
                    style={{
                      height: 116,
                      background: `radial-gradient(circle at 30% 30%, ${tpl.previewAccent}33, #141414 80%)`,
                      borderBottom: '1px solid var(--ai-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <img src={templatePreviews[tpl.id]} alt="" className="ai-home-template-preview" />
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(0,0,0,0.65)',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                    >
                      {tpl.colorMode}
                    </span>
                  </div>

                  <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, color: lightTheme ? darkenAccent(tpl.previewAccent) : tpl.previewAccent, fontWeight: 600 }}>
                      {tpl.category}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)', lineHeight: 1.35 }}>
                      {tpl.description}
                    </div>
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: 8,
                        fontSize: 10,
                        color: 'var(--ai-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>{tpl.dimensionsLabel}</span>
                      <span style={{ color: '#1473e6', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Open →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};

const actionMenuBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'transparent',
  border: 'none',
  color: 'var(--ai-text-primary)',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  borderRadius: 4,
  textAlign: 'left',
};

const listSmallBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 4,
  background: 'var(--ai-bg-hover)',
  border: '1px solid #4a4a4a',
  color: 'var(--ai-text-primary)',
  fontSize: 10,
  cursor: 'pointer',
};

export default HomeDashboard;
