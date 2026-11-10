import React from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { ColorSwatchButton } from '../primitives/ColorSwatchButton';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { AlignIcon } from '../primitives/IllustratorIcons';
import type {
  VectorNode,
  ArtboardItem,
  AlignOp,
  UnitType,
} from '../../core/types';

const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Trebuchet MS',
  'Impact',
  'Verdana',
];

const WIDTH_PROFILES = [
  { id: 'uniform', label: 'Uniform' },
  { id: 'taper-both', label: 'Width Profile 1 (Taper Both)' },
  { id: 'wave', label: 'Width Profile 2 (Wave)' },
  { id: 'taper-end', label: 'Width Profile 3 (Taper End)' },
  { id: 'triangle', label: 'Width Profile 4 (Triangle)' },
  { id: 'calligraphic', label: 'Width Profile 5 (Calligraphic)' },
];

const TRACE_PRESETS = [
  { id: 'bw-logo', label: 'Black and White Logo' },
  { id: 'high-fidelity', label: 'High Fidelity Photo' },
  { id: 'low-fidelity', label: 'Low Fidelity Photo' },
  { id: '3-colors', label: '3 Colors' },
  { id: '6-colors', label: '6 Colors' },
  { id: '16-colors', label: '16 Colors' },
  { id: 'grayscale', label: 'Shades of Gray' },
  { id: 'sketched', label: 'Sketched Art' },
  { id: 'silhouettes', label: 'Silhouettes' },
  { id: 'line-art', label: 'Line Art' },
];

export const ControlBar: React.FC = () => {
  const store = useStudioStore() as any;

  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const unit: UnitType = doc.unit || 'px';
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const activeTool: string = store.activeTool || 'select';
  const hideAllPanels: boolean = Boolean(store.hideAllPanels);
  const screenMode: string = store.screenMode || 'normal';

  if (hideAllPanels || screenMode === 'fullscreen') {
    return null;
  }

  const selectedNodes: VectorNode[] = selectedIds
    .map((id) => nodesMap[id])
    .filter(Boolean);
  const primaryNode: VectorNode | undefined = selectedNodes[0];

  const fillColor: string =
    primaryNode?.fills?.[0]?.visible === false || primaryNode?.fills?.[0]?.type === 'none'
      ? 'none'
      : primaryNode?.fills?.[0]?.color ?? store.currentFillColor ?? store.activeFillColor ?? '#ffffff';

  const strokeColor: string =
    primaryNode?.strokes?.[0]?.visible === false || !primaryNode?.strokes?.[0]?.color
      ? store.currentStrokeColor ?? store.activeStrokeColor ?? '#000000'
      : primaryNode.strokes[0].color;

  const strokeWeight: number =
    primaryNode?.strokes?.[0]?.weight ?? store.currentStrokeWeight ?? store.activeStrokeWeight ?? 1;

  const opacityPercent: number = Math.round(
    (primaryNode?.opacity !== undefined ? primaryNode.opacity : 1) * 100
  );

  const artboards: ArtboardItem[] = doc.artboards || [];
  const activeArtboard: ArtboardItem | undefined =
    artboards.find((a) => a.id === doc.activeArtboardId) || artboards[0];

  const isArtboardMode = activeTool === 'artboard';
  const isAnchorMode =
    activeTool === 'direct-select' ||
    activeTool === 'pen' ||
    activeTool === 'add-anchor' ||
    activeTool === 'delete-anchor' ||
    activeTool === 'anchor-point' ||
    activeTool === 'curvature' ||
    activeTool === 'lasso' ||
    activeTool === 'scissors';
  const isTextMode =
    activeTool.includes('type') || primaryNode?.type === 'text';
  const isImageMode = primaryNode?.type === 'image';
  const isLivePaintOrBlendMode =
    activeTool === 'live-paint-bucket' ||
    activeTool === 'live-paint-select' ||
    activeTool === 'shape-builder' ||
    activeTool === 'blend' ||
    primaryNode?.type === 'live-paint-group' ||
    primaryNode?.type === 'envelope' ||
    primaryNode?.type === 'blend';

  const isShapeWithCorners =
    primaryNode?.type === 'rectangle' ||
    primaryNode?.type === 'polygon' ||
    primaryNode?.type === 'star' ||
    (primaryNode?.points || []).some((p) => p.pointType === 'corner' && !p.handleIn && !p.handleOut);

  // Helper mutations
  const mutateSelectedNodes = (
    mutator: (node: VectorNode) => void,
    historyLabel = 'Update Selection'
  ) => {
    if (typeof store.updateNodes === 'function') {
      store.updateNodes(selectedIds, mutator, historyLabel);
      return;
    }
    if (typeof store.pushHistory === 'function') {
      store.pushHistory(historyLabel);
    }
    useStudioStore.setState((s: any) => {
      const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
      const targetDoc = next.document || next.activeDocument;
      if (!targetDoc || !targetDoc.nodes) return next;
      for (const id of next.selectedIds || []) {
        if (targetDoc.nodes[id]) {
          mutator(targetDoc.nodes[id]);
        }
      }
      return next;
    });
  };

  const handleSetFill = (color: string) => {
    if (typeof store.setCurrentFillColor === 'function') {
      store.setCurrentFillColor(color);
      return;
    }
    useStudioStore.setState({ currentFillColor: color } as any);
    mutateSelectedNodes((n) => {
      if (!n.fills || n.fills.length === 0) {
        n.fills = [
          {
            id: `fill-${Date.now()}`,
            visible: color !== 'none',
            type: color === 'none' ? 'none' : 'solid',
            color,
            opacity: 1,
            blendMode: 'normal',
          },
        ];
      } else {
        n.fills[0].color = color;
        n.fills[0].type = color === 'none' ? 'none' : 'solid';
        n.fills[0].visible = color !== 'none';
      }
    }, 'Change Fill Color');
  };

  const handleSetStroke = (color: string) => {
    if (typeof store.setCurrentStrokeColor === 'function') {
      store.setCurrentStrokeColor(color);
      return;
    }
    useStudioStore.setState({ currentStrokeColor: color } as any);
    mutateSelectedNodes((n) => {
      if (!n.strokes || n.strokes.length === 0) {
        n.strokes = [
          {
            id: `stroke-${Date.now()}`,
            visible: color !== 'none',
            color,
            weight: strokeWeight || 1,
            cap: 'butt',
            join: 'miter',
            miterLimit: 10,
            align: 'center',
            dashArray: [],
            opacity: 1,
            blendMode: 'normal',
          },
        ];
      } else {
        n.strokes[0].color = color;
        n.strokes[0].visible = color !== 'none';
      }
    }, 'Change Stroke Color');
  };

  const handleSetStrokeWeight = (weight: number) => {
    if (typeof store.setCurrentStrokeWeight === 'function') {
      store.setCurrentStrokeWeight(weight);
      return;
    }
    useStudioStore.setState({ currentStrokeWeight: weight } as any);
    mutateSelectedNodes((n) => {
      if (!n.strokes || n.strokes.length === 0) {
        n.strokes = [
          {
            id: `stroke-${Date.now()}`,
            visible: weight > 0,
            color: strokeColor === 'none' ? '#000000' : strokeColor,
            weight,
            cap: 'butt',
            join: 'miter',
            miterLimit: 10,
            align: 'center',
            dashArray: [],
            opacity: 1,
            blendMode: 'normal',
          },
        ];
      } else {
        n.strokes[0].weight = weight;
        n.strokes[0].visible = weight > 0;
      }
    }, 'Change Stroke Weight');
  };

  const handleSetOpacity = (pct: number) => {
    const norm = Math.max(0, Math.min(100, pct)) / 100;
    if (typeof store.setSelectionOpacity === 'function') {
      store.setSelectionOpacity(norm);
      return;
    }
    mutateSelectedNodes((n) => {
      n.opacity = norm;
    }, 'Change Opacity');
  };

  const handleAlign = (op: AlignOp) => {
    if (typeof store.alignNodes === 'function') {
      store.alignNodes(op);
      return;
    }
    if (typeof store.alignSelection === 'function') {
      store.alignSelection(op);
      return;
    }
    if (selectedNodes.length === 0) return;
    const ab = activeArtboard || { x: 0, y: 0, width: 800, height: 600 };
    const useArtboard = selectedNodes.length === 1;
    const minX = useArtboard ? ab.x : Math.min(...selectedNodes.map((n) => n.x));
    const minY = useArtboard ? ab.y : Math.min(...selectedNodes.map((n) => n.y));
    const maxX = useArtboard
      ? ab.x + ab.width
      : Math.max(...selectedNodes.map((n) => n.x + n.width));
    const maxY = useArtboard
      ? ab.y + ab.height
      : Math.max(...selectedNodes.map((n) => n.y + n.height));

    mutateSelectedNodes((n) => {
      if (op === 'left') n.x = minX;
      else if (op === 'center-h') n.x = (minX + maxX) / 2 - n.width / 2;
      else if (op === 'right') n.x = maxX - n.width;
      else if (op === 'top') n.y = minY;
      else if (op === 'center-v') n.y = (minY + maxY) / 2 - n.height / 2;
      else if (op === 'bottom') n.y = maxY - n.height;
    }, `Align ${op}`);
  };

  const handleOpenModal = (modal: string) => {
    if (typeof store.setActiveModal === 'function') {
      store.setActiveModal(modal);
    } else {
      useStudioStore.setState({ activeModal: modal } as any);
    }
  };

  const getSelectionTypeBadge = (): string => {
    if (isArtboardMode) return 'Artboard';
    if (selectedNodes.length === 0) return 'No Selection';
    if (selectedNodes.length > 1) return `${selectedNodes.length} Objects`;
    const t = primaryNode?.type || 'path';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div className="ai-controlbar">
      {/* Selection Context Type Badge */}
      <span
        style={{
          fontWeight: 700,
          color: 'var(--ai-text-primary)',
          fontSize: 11,
          minWidth: 74,
          flexShrink: 0,
        }}
      >
        {getSelectionTypeBadge()}
      </span>

      <div className="ai-controlbar-sep" />

      {/* ====================================================================
          MODE A: ARTBOARD CONTEXTUAL BAR
         ==================================================================== */}
      {isArtboardMode && activeArtboard ? (
        <>
          <span style={{ color: 'var(--ai-text-secondary)' }}>Preset:</span>
          <select
            className="ai-select"
            value="custom"
            onChange={(e) => {
              const presets: Record<string, [number, number]> = {
                a4: [595.28, 841.89],
                letter: [612, 792],
                hd: [1920, 1080],
                square: [1080, 1080],
                mobile: [393, 852],
              };
              const dim = presets[e.target.value];
              if (dim && typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ width: dim[0], height: dim[1] });
              } else if (dim) {
                useStudioStore.setState((s: any) => {
                  const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
                  const targetDoc = next.document || next.activeDocument;
                  const ab = targetDoc?.artboards?.find((a: any) => a.id === activeArtboard.id);
                  if (ab) {
                    ab.width = dim[0];
                    ab.height = dim[1];
                  }
                  return next;
                });
              }
            }}
          >
            <option value="custom">Custom</option>
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="letter">Letter (8.5 × 11 in)</option>
            <option value="hd">Web HD (1920 × 1080 px)</option>
            <option value="square">Social Square (1080 × 1080 px)</option>
            <option value="mobile">iPhone Pro (393 × 852 px)</option>
          </select>

          <span style={{ color: 'var(--ai-text-secondary)' }}>Name:</span>
          <input
            type="text"
            className="ai-input"
            value={activeArtboard.name}
            onChange={(e) => {
              const val = e.target.value;
              if (typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ name: val });
              } else {
                useStudioStore.setState((s: any) => {
                  const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
                  const targetDoc = next.document || next.activeDocument;
                  const ab = targetDoc?.artboards?.find((a: any) => a.id === activeArtboard.id);
                  if (ab) ab.name = val;
                  return next;
                });
              }
            }}
            style={{ width: 110 }}
          />

          <div className="ai-controlbar-sep" />

          <button
            type="button"
            className="ai-btn"
            title="New Artboard"
            onClick={() => {
              if (typeof store.addArtboard === 'function') {
                store.addArtboard();
              } else {
                useStudioStore.setState((s: any) => {
                  const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
                  const targetDoc = next.document || next.activeDocument;
                  if (targetDoc && targetDoc.artboards) {
                    const last = targetDoc.artboards[targetDoc.artboards.length - 1] || activeArtboard;
                    const newAb: ArtboardItem = {
                      id: `ab-${Date.now()}`,
                      name: `Artboard ${targetDoc.artboards.length + 1}`,
                      x: last.x + last.width + 80,
                      y: last.y,
                      width: last.width,
                      height: last.height,
                      orientation: last.orientation || 'landscape',
                      showCenterMark: false,
                      showCrossHairs: false,
                      showVideoSafeAreas: false,
                    };
                    targetDoc.artboards.push(newAb);
                    targetDoc.activeArtboardId = newAb.id;
                  }
                  return next;
                });
              }
            }}
          >
            + New Artboard
          </button>

          <button
            type="button"
            className={`ai-btn ${store.moveArtworkWithArtboard !== false ? 'active' : ''}`}
            title="Move/Copy Artwork with Artboard"
            onClick={() => {
              const cur = store.moveArtworkWithArtboard !== false;
              useStudioStore.setState({ moveArtworkWithArtboard: !cur } as any);
            }}
          >
            Move Artwork with Artboard
          </button>

          <div className="ai-controlbar-sep" />

          <NumericScrubInput
            label="X:"
            value={activeArtboard.x}
            unit={unit}
            width={62}
            onChange={(v) => {
              if (typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ x: v });
              }
            }}
          />
          <NumericScrubInput
            label="Y:"
            value={activeArtboard.y}
            unit={unit}
            width={62}
            onChange={(v) => {
              if (typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ y: v });
              }
            }}
          />
          <NumericScrubInput
            label="W:"
            value={activeArtboard.width}
            unit={unit}
            min={10}
            width={64}
            onChange={(v) => {
              if (typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ width: v });
              }
            }}
          />
          <NumericScrubInput
            label="H:"
            value={activeArtboard.height}
            unit={unit}
            min={10}
            width={64}
            onChange={(v) => {
              if (typeof store.updateActiveArtboard === 'function') {
                store.updateActiveArtboard({ height: v });
              }
            }}
          />
        </>
      ) : (
        <>
          {/* ================================================================
              SHARED FILL, STROKE, WEIGHT & OPACITY CONTROLS
             ================================================================ */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ColorSwatchButton
              color={fillColor}
              onChange={handleSetFill}
              allowColorPicker
              size={18}
              title="Fill Color (Click to change)"
            />
            <ColorSwatchButton
              color={strokeColor}
              onChange={handleSetStroke}
              allowColorPicker
              isStroke
              size={18}
              title="Stroke Color (Click to change)"
            />
          </div>

          <div className="ai-controlbar-sep" />

          {/* Stroke Weight */}
          <NumericScrubInput
            label="Stroke:"
            value={strokeWeight}
            onChange={handleSetStrokeWeight}
            unit="pt"
            min={0}
            max={500}
            step={0.5}
            width={52}
            title="Stroke Weight (pt)"
          />

          {/* Variable Width Profile Dropdown */}
          <select
            className="ai-select"
            title="Variable Width Profile"
            value={primaryNode?.strokes?.[0]?.widthProfileId || 'uniform'}
            onChange={(e) => {
              const profileId = e.target.value;
              mutateSelectedNodes((n) => {
                if (n.strokes?.[0]) {
                  n.strokes[0].widthProfileId = profileId;
                }
              }, 'Set Variable Width Profile');
            }}
            style={{ width: 92 }}
          >
            {WIDTH_PROFILES.map((wp) => (
              <option key={wp.id} value={wp.id}>
                {wp.label}
              </option>
            ))}
          </select>

          {/* Brush Selector */}
          <select
            className="ai-select"
            title="Brush Definition"
            value={primaryNode?.strokes?.[0]?.brushId || 'basic'}
            onChange={(e) => {
              const brushId = e.target.value;
              mutateSelectedNodes((n) => {
                if (n.strokes?.[0]) {
                  n.strokes[0].brushId = brushId === 'basic' ? undefined : brushId;
                }
              }, 'Apply Brush');
            }}
            style={{ width: 88 }}
          >
            <option value="basic">Basic</option>
            {(doc.brushes || []).map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="ai-controlbar-sep" />

          {/* Opacity */}
          <NumericScrubInput
            label="Opacity:"
            value={opacityPercent}
            onChange={handleSetOpacity}
            suffix="%"
            min={0}
            max={100}
            step={1}
            decimals={0}
            width={46}
            title="Object Opacity (0% – 100%)"
          />

          {/* Recolor Artwork Wheel Trigger */}
          <button
            type="button"
            className="ai-icon-btn"
            title="Recolor Artwork (Interactive Harmony Color Wheel)"
            onClick={() => handleOpenModal('recolor-artwork')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8H8V1.5Z" fill="#ff4f4f" />
              <path d="M14.5 8A6.5 6.5 0 0 1 8 14.5V8H14.5Z" fill="#4fcf5f" />
              <path d="M8 14.5A6.5 6.5 0 0 1 1.5 8H8V14.5Z" fill="#1473e6" />
              <path d="M1.5 8A6.5 6.5 0 0 1 8 1.5V8H1.5Z" fill="#ff9a00" />
            </svg>
          </button>

          <div className="ai-controlbar-sep" />

          {/* ================================================================
              MODE B: ANCHOR POINT / DIRECT SELECTION CONTROLS
             ================================================================ */}
          {isAnchorMode && (
            <>
              <span style={{ color: 'var(--ai-text-secondary)', fontSize: 10.5 }}>Convert:</span>
              <button
                type="button"
                className="ai-btn"
                title="Convert selected anchor points to Corner"
                onClick={() => {
                  if (typeof store.convertSelectedAnchors === 'function') {
                    store.convertSelectedAnchors('corner');
                  } else {
                    mutateSelectedNodes((n) => {
                      n.points = (n.points || []).map((pt) => ({
                        ...pt,
                        pointType: 'corner',
                        handleIn: undefined,
                        handleOut: undefined,
                      }));
                    }, 'Convert Anchors to Corner');
                  }
                }}
              >
                ⟁ Corner
              </button>
              <button
                type="button"
                className="ai-btn"
                title="Convert selected anchor points to Smooth Bezier"
                onClick={() => {
                  if (typeof store.convertSelectedAnchors === 'function') {
                    store.convertSelectedAnchors('smooth');
                  } else {
                    mutateSelectedNodes((n) => {
                      n.points = (n.points || []).map((pt) => ({
                        ...pt,
                        pointType: 'smooth',
                        handleIn: pt.handleIn || { x: pt.x - 20, y: pt.y },
                        handleOut: pt.handleOut || { x: pt.x + 20, y: pt.y },
                      }));
                    }, 'Convert Anchors to Smooth');
                  }
                }}
              >
                ⌒ Smooth
              </button>
              <button
                type="button"
                className="ai-btn"
                title="Cut Path at Selected Anchor Points (Scissors)"
                onClick={() => {
                  if (typeof store.cutPathAtSelectedAnchors === 'function') {
                    store.cutPathAtSelectedAnchors();
                  } else {
                    mutateSelectedNodes((n) => {
                      n.closed = false;
                    }, 'Cut Path');
                  }
                }}
              >
                ✂ Cut
              </button>
              <button
                type="button"
                className="ai-btn"
                title="Connect Selected End Points (Join Ctrl+J)"
                onClick={() => {
                  if (typeof store.joinSelectedPaths === 'function') {
                    store.joinSelectedPaths();
                  } else {
                    mutateSelectedNodes((n) => {
                      n.closed = true;
                    }, 'Join Path');
                  }
                }}
              >
                ⊶ Join
              </button>
              <div className="ai-controlbar-sep" />
            </>
          )}

          {/* ================================================================
              MODE C: TEXT / TYPOGRAPHY CONTROLS
             ================================================================ */}
          {isTextMode && (
            <>
              <select
                className="ai-select"
                title="Font Family"
                value={primaryNode?.textStyle?.fontFamily || 'Inter'}
                onChange={(e) => {
                  const fam = e.target.value;
                  mutateSelectedNodes((n) => {
                    if (n.textStyle) n.textStyle.fontFamily = fam;
                  }, 'Change Font Family');
                }}
                style={{ width: 108 }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <select
                className="ai-select"
                title="Font Style"
                value={primaryNode?.textStyle?.fontStyle || 'Regular'}
                onChange={(e) => {
                  const st = e.target.value;
                  mutateSelectedNodes((n) => {
                    if (n.textStyle) n.textStyle.fontStyle = st;
                  }, 'Change Font Style');
                }}
                style={{ width: 76 }}
              >
                <option value="Regular">Regular</option>
                <option value="Italic">Italic</option>
                <option value="Medium">Medium</option>
                <option value="Bold">Bold</option>
                <option value="Black">Black</option>
              </select>

              <NumericScrubInput
                label="Size:"
                value={primaryNode?.textStyle?.fontSize ?? 24}
                unit="pt"
                min={1}
                max={1296}
                width={52}
                onChange={(sz) => {
                  mutateSelectedNodes((n) => {
                    if (n.textStyle) n.textStyle.fontSize = sz;
                  }, 'Change Font Size');
                }}
              />

              <button
                type="button"
                className="ai-btn"
                title="Create Outlines (Convert Text to Editable Bezier Paths - Shift+Ctrl+O)"
                onClick={() => {
                  if (typeof store.createOutlinesFromText === 'function') {
                    store.createOutlinesFromText();
                  } else if (typeof store.createOutlines === 'function') {
                    store.createOutlines();
                  }
                }}
              >
                Create Outlines
              </button>

              <button
                type="button"
                className="ai-btn"
                title="Make Envelope Warp (Alt+Shift+Ctrl+W)"
                onClick={() => handleOpenModal('envelope-warp')}
              >
                Make Envelope
              </button>

              <div className="ai-controlbar-sep" />
            </>
          )}

          {/* ================================================================
              MODE D: BITMAP IMAGE & IMAGE TRACE CONTROLS
             ================================================================ */}
          {isImageMode && (
            <>
              <button
                type="button"
                className="ai-btn active"
                title="Open Image Trace (Bitmap to Vector Engine)"
                onClick={() => handleOpenModal('image-trace')}
              >
                Image Trace
              </button>
              <select
                className="ai-select"
                title="Image Trace Preset"
                defaultValue="bw-logo"
                onChange={() => handleOpenModal('image-trace')}
                style={{ width: 120 }}
              >
                {TRACE_PRESETS.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ai-btn"
                title="Expand Traced Artwork into Editable Vector Paths"
                onClick={() => {
                  if (typeof store.expandImageTrace === 'function') {
                    store.expandImageTrace();
                  } else if (typeof store.expandAppearance === 'function') {
                    store.expandAppearance();
                  }
                }}
              >
                Expand
              </button>
              <div className="ai-controlbar-sep" />
            </>
          )}

          {/* ================================================================
              MODE E: LIVE PAINT / ENVELOPE / BLEND CONTROLS
             ================================================================ */}
          {isLivePaintOrBlendMode && (
            <>
              <button
                type="button"
                className="ai-btn"
                onClick={() => handleOpenModal('envelope-warp')}
              >
                Make Envelope
              </button>
              <button
                type="button"
                className="ai-btn"
                onClick={() => handleOpenModal('blend-options')}
              >
                Blend Options
              </button>
              <button
                type="button"
                className="ai-btn"
                onClick={() => {
                  if (typeof store.expandAppearance === 'function') {
                    store.expandAppearance();
                  }
                }}
              >
                Expand
              </button>
              <div className="ai-controlbar-sep" />
            </>
          )}

          {/* ================================================================
              QUICK ALIGNMENT BUTTONS
             ================================================================ */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            {(
              [
                { op: 'left', title: 'Horizontal Align Left' },
                { op: 'center-h', title: 'Horizontal Align Center' },
                { op: 'right', title: 'Horizontal Align Right' },
                { op: 'top', title: 'Vertical Align Top' },
                { op: 'center-v', title: 'Vertical Align Center' },
                { op: 'bottom', title: 'Vertical Align Bottom' },
              ] as const
            ).map((al) => (
              <button
                key={al.op}
                type="button"
                className="ai-icon-btn"
                title={al.title}
                disabled={selectedNodes.length === 0}
                onClick={() => handleAlign(al.op)}
              >
                <AlignIcon op={al.op} size={13} />
              </button>
            ))}
          </div>

          <div className="ai-controlbar-sep" />

          {/* ================================================================
              TRANSFORM X / Y / W / H NUMERIC SCRUB INPUTS
             ================================================================ */}
          <NumericScrubInput
            label="X:"
            value={primaryNode?.x ?? 0}
            unit={unit}
            disabled={!primaryNode}
            width={58}
            onChange={(val) => {
              mutateSelectedNodes((n) => {
                const dx = val - n.x;
                n.x = val;
                n.points = (n.points || []).map((p) => ({
                  ...p,
                  x: p.x + dx,
                  handleIn: p.handleIn ? { x: p.handleIn.x + dx, y: p.handleIn.y } : undefined,
                  handleOut: p.handleOut ? { x: p.handleOut.x + dx, y: p.handleOut.y } : undefined,
                }));
              }, 'Transform X');
            }}
          />
          <NumericScrubInput
            label="Y:"
            value={primaryNode?.y ?? 0}
            unit={unit}
            disabled={!primaryNode}
            width={58}
            onChange={(val) => {
              mutateSelectedNodes((n) => {
                const dy = val - n.y;
                n.y = val;
                n.points = (n.points || []).map((p) => ({
                  ...p,
                  y: p.y + dy,
                  handleIn: p.handleIn ? { x: p.handleIn.x, y: p.handleIn.y + dy } : undefined,
                  handleOut: p.handleOut ? { x: p.handleOut.x, y: p.handleOut.y + dy } : undefined,
                }));
              }, 'Transform Y');
            }}
          />
          <NumericScrubInput
            label="W:"
            value={primaryNode?.width ?? 0}
            unit={unit}
            min={1}
            disabled={!primaryNode}
            width={58}
            onChange={(val) => {
              mutateSelectedNodes((n) => {
                const oldW = Math.max(1, n.width);
                const sx = val / oldW;
                n.width = val;
                n.points = (n.points || []).map((p) => ({
                  ...p,
                  x: n.x + (p.x - n.x) * sx,
                  handleIn: p.handleIn
                    ? { x: n.x + (p.handleIn.x - n.x) * sx, y: p.handleIn.y }
                    : undefined,
                  handleOut: p.handleOut
                    ? { x: n.x + (p.handleOut.x - n.x) * sx, y: p.handleOut.y }
                    : undefined,
                }));
              }, 'Transform Width');
            }}
          />
            <NumericScrubInput
              label="H:"
              value={primaryNode?.height ?? 0}
              unit={unit}
              min={1}
              disabled={!primaryNode}
              width={58}
              onChange={(val) => {
                mutateSelectedNodes((n) => {
                  const oldH = Math.max(1, n.height);
                  const sy = val / oldH;
                  n.height = val;
                  n.points = (n.points || []).map((p) => ({
                    ...p,
                    y: n.y + (p.y - n.y) * sy,
                    handleIn: p.handleIn
                      ? { x: p.handleIn.x, y: n.y + (p.handleIn.y - n.y) * sy }
                      : undefined,
                    handleOut: p.handleOut
                      ? { x: p.handleOut.x, y: n.y + (p.handleOut.y - n.y) * sy }
                      : undefined,
                  }));
                }, 'Transform Height');
              }}
            />

            {isShapeWithCorners && primaryNode && (
              <>
                <div className="ai-controlbar-sep" />
                <NumericScrubInput
                  label="Corners:"
                  value={primaryNode.cornerRadius ?? primaryNode.points?.[0]?.cornerRadius ?? 0}
                  unit={unit}
                  min={0}
                  max={Math.round(Math.min(primaryNode.width, primaryNode.height) / 2)}
                  width={54}
                  title="Live Corner Radius (pt/px)"
                  onChange={(val) => {
                    mutateSelectedNodes((n) => {
                      n.cornerRadius = val;
                      n.points = (n.points || []).map((p) =>
                        p.pointType === 'corner' ? { ...p, cornerRadius: val } : p
                      );
                    }, 'Set Corner Radius');
                  }}
                />
                <select
                  className="ai-select"
                  title="Corner Type (Round / Inverted Round / Chamfer)"
                  value={primaryNode.cornerType || primaryNode.points?.[0]?.cornerType || 'round'}
                  onChange={(e) => {
                    const cType = e.target.value as 'round' | 'inverted' | 'chamfer';
                    mutateSelectedNodes((n) => {
                      n.cornerType = cType;
                      n.points = (n.points || []).map((p) =>
                        p.pointType === 'corner' ? { ...p, cornerType: cType } : p
                      );
                    }, `Corner Style: ${cType}`);
                  }}
                  style={{ width: 76 }}
                >
                  <option value="round">╭ Round</option>
                  <option value="inverted">╰ Inverted</option>
                  <option value="chamfer">╱ Chamfer</option>
                </select>
              </>
            )}
        </>
      )}
    </div>
  );
};

export default ControlBar;
