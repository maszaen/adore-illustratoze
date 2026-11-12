import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MoreHorizontal } from 'lucide-react';
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


export const ControlBar: React.FC = () => {
  const store = useStudioStore() as any;

  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const unit: UnitType = doc.unit || 'px';
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const activeTool: string = store.activeTool || 'select';
  const hideAllPanels: boolean = Boolean(store.hideAllPanels);
  const screenMode: string = store.screenMode || 'normal';

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

  // Responsive collapsing: measure the bar after each render and collapse one more step while it
  // overflows. Width or mode changes start again from the fully expanded layout.
  const barRef = useRef<HTMLDivElement>(null);
  const stepCountRef = useRef(0);
  const [collapsed, setCollapsed] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const layoutKey = [barWidth, isArtboardMode, isAnchorMode, isTextMode, isImageMode, isLivePaintOrBlendMode, isShapeWithCorners && !!primaryNode, selectedIds.length > 0, primaryNode?.type, store.language].join('|');
  const lastLayoutKey = useRef('');
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setBarWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [hideAllPanels, screenMode]);
  useLayoutEffect(() => {
    if (lastLayoutKey.current !== layoutKey) {
      lastLayoutKey.current = layoutKey;
      if (collapsed !== 0) { setCollapsed(0); return; }
    }
    const bar = barRef.current;
    if (bar && bar.scrollWidth > bar.clientWidth + 1 && collapsed < stepCountRef.current) setCollapsed(collapsed + 1);
  });
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

  // --------------------------------------------------------------------------
  // Control groups. Each group can show inline, as a compact dropdown, or move
  // into the "More" menu when the bar is too narrow (see COLLAPSE_ORDER).
  // --------------------------------------------------------------------------
  const setArtboardPreset = (value: string) => {
    const presets: Record<string, [number, number]> = {
      a4: [595.28, 841.89],
      letter: [612, 792],
      hd: [1920, 1080],
      square: [1080, 1080],
      mobile: [393, 852],
    };
    const dim = presets[value];
    if (dim && typeof store.updateActiveArtboard === 'function') {
      store.updateActiveArtboard({ width: dim[0], height: dim[1] });
    }
  };
  const moveArtworkWithArtboard = store.moveArtworkWithArtboard !== false;
  const toggleMoveArtwork = () => useStudioStore.setState({ moveArtworkWithArtboard: !moveArtworkWithArtboard } as any);
  const addNewArtboard = () => { if (typeof store.addArtboard === 'function') store.addArtboard(); };

  const ALIGN_OPS = [
    { op: 'left', title: 'Horizontal Align Left' },
    { op: 'center-h', title: 'Horizontal Align Center' },
    { op: 'right', title: 'Horizontal Align Right' },
    { op: 'top', title: 'Vertical Align Top' },
    { op: 'center-v', title: 'Vertical Align Center' },
    { op: 'bottom', title: 'Vertical Align Bottom' },
  ] as const;

  const anchorActions = [
    { label: 'Corner', icon: '⟁', title: 'Convert selected anchor points to Corner', run: () => {
      if (typeof store.convertSelectedAnchors === 'function') store.convertSelectedAnchors('corner');
      else mutateSelectedNodes((n) => { n.points = (n.points || []).map((pt) => ({ ...pt, pointType: 'corner', handleIn: undefined, handleOut: undefined })); }, 'Convert Anchors to Corner');
    } },
    { label: 'Smooth', icon: '⌒', title: 'Convert selected anchor points to Smooth Bezier', run: () => {
      if (typeof store.convertSelectedAnchors === 'function') store.convertSelectedAnchors('smooth');
      else mutateSelectedNodes((n) => { n.points = (n.points || []).map((pt) => ({ ...pt, pointType: 'smooth', handleIn: pt.handleIn || { x: pt.x - 20, y: pt.y }, handleOut: pt.handleOut || { x: pt.x + 20, y: pt.y } })); }, 'Convert Anchors to Smooth');
    } },
    { label: 'Cut', icon: '✂', title: 'Cut Path at Selected Anchor Points (Scissors)', run: () => {
      if (typeof store.cutPathAtSelectedAnchors === 'function') store.cutPathAtSelectedAnchors();
      else mutateSelectedNodes((n) => { n.closed = false; }, 'Cut Path');
    } },
    { label: 'Join', icon: '⊶', title: 'Connect Selected End Points (Join Ctrl+J)', run: () => {
      if (typeof store.joinSelectedPaths === 'function') store.joinSelectedPaths();
      else mutateSelectedNodes((n) => { n.closed = true; }, 'Join Path');
    } },
  ];

  const createOutlines = () => {
    if (typeof store.createOutlinesFromText === 'function') store.createOutlinesFromText();
    else if (typeof store.createOutlines === 'function') store.createOutlines();
  };

  const groups: ControlGroup[] = [];
  if (isArtboardMode && activeArtboard) {
    groups.push({
      id: 'ab-preset', label: 'Preset',
      inline: (
        <span className="ai-controlbar-group">
          <span className="ai-controlbar-label">Preset:</span>
          <select className="ai-select" value="custom" onChange={(e) => setArtboardPreset(e.target.value)} title="Artboard size preset">
            <option value="custom">Custom</option>
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="letter">Letter (8.5 × 11 in)</option>
            <option value="hd">Web HD (1920 × 1080 px)</option>
            <option value="square">Social Square (1080 × 1080 px)</option>
            <option value="mobile">iPhone Pro (393 × 852 px)</option>
          </select>
        </span>
      ),
    });
    groups.push({
      id: 'ab-name', label: 'Name',
      inline: (
        <span className="ai-controlbar-group">
          <span className="ai-controlbar-label">Name:</span>
          <input type="text" className="ai-input" value={activeArtboard.name} aria-label="Artboard name"
            onChange={(e) => { if (typeof store.updateActiveArtboard === 'function') store.updateActiveArtboard({ name: e.target.value }); }}
            style={{ width: 110 }} />
        </span>
      ),
    });
    groups.push({
      id: 'ab-actions', label: 'Artboard',
      inline: (
        <span className="ai-controlbar-group">
          <button type="button" className="ai-btn" title="New Artboard" onClick={addNewArtboard}>+ New Artboard</button>
          <button type="button" className={`ai-btn ${moveArtworkWithArtboard ? 'active' : ''}`} title="Move/Copy Artwork with Artboard" aria-pressed={moveArtworkWithArtboard} onClick={toggleMoveArtwork}>
            Move Artwork with Artboard
          </button>
        </span>
      ),
      compact: (
        <ControlDropdown label="Artboard" title="Artboard actions">
          {(close) => <>
            <DropdownItem onClick={() => { close(); addNewArtboard(); }}>New Artboard</DropdownItem>
            <DropdownItem checked={moveArtworkWithArtboard} onClick={() => { close(); toggleMoveArtwork(); }}>Move Artwork with Artboard</DropdownItem>
          </>}
        </ControlDropdown>
      ),
    });
    groups.push({
      id: 'ab-bounds', label: 'Position & size',
      inline: (
        <span className="ai-controlbar-group">
          <NumericScrubInput label="X:" value={activeArtboard.x} unit={unit} width={62} onChange={(v) => store.updateActiveArtboard?.({ x: v })} />
          <NumericScrubInput label="Y:" value={activeArtboard.y} unit={unit} width={62} onChange={(v) => store.updateActiveArtboard?.({ y: v })} />
          <NumericScrubInput label="W:" value={activeArtboard.width} unit={unit} min={10} width={64} onChange={(v) => store.updateActiveArtboard?.({ width: v })} />
          <NumericScrubInput label="H:" value={activeArtboard.height} unit={unit} min={10} width={64} onChange={(v) => store.updateActiveArtboard?.({ height: v })} />
        </span>
      ),
    });
  } else {
    groups.push({
      id: 'paint', label: 'Fill & stroke color',
      inline: (
        <span className="ai-controlbar-group" style={{ gap: 4 }}>
          <ColorSwatchButton color={fillColor} onChange={handleSetFill} allowColorPicker size={18} title="Fill Color (Click to change)" />
          <ColorSwatchButton color={strokeColor} onChange={handleSetStroke} allowColorPicker isStroke size={18} title="Stroke Color (Click to change)" />
        </span>
      ),
    });
    groups.push({
      id: 'stroke', label: 'Stroke weight',
      inline: (
        <NumericScrubInput label="Stroke:" value={strokeWeight} onChange={handleSetStrokeWeight} unit="pt" min={0} max={500} step={0.5} width={52} title="Stroke Weight (pt)" />
      ),
    });
    groups.push({
      id: 'stroke-style', label: 'Stroke profile & brush',
      inline: (
        <span className="ai-controlbar-group">
          <select className="ai-select" title="Variable Width Profile" aria-label="Variable Width Profile"
            value={primaryNode?.strokes?.[0]?.widthProfileId || 'uniform'}
            onChange={(e) => { const profileId = e.target.value; mutateSelectedNodes((n) => { if (n.strokes?.[0]) n.strokes[0].widthProfileId = profileId; }, 'Set Variable Width Profile'); }}
            style={{ width: 92 }}>
            {WIDTH_PROFILES.map((wp) => <option key={wp.id} value={wp.id}>{wp.label}</option>)}
          </select>
          <select className="ai-select" title="Brush Definition" aria-label="Brush Definition"
            value={primaryNode?.strokes?.[0]?.brushId || 'basic'}
            onChange={(e) => { const brushId = e.target.value; mutateSelectedNodes((n) => { if (n.strokes?.[0]) n.strokes[0].brushId = brushId === 'basic' ? undefined : brushId; }, 'Apply Brush'); }}
            style={{ width: 88 }}>
            <option value="basic">Basic</option>
            {(doc.brushes || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </span>
      ),
    });
    groups.push({
      id: 'opacity', label: 'Opacity',
      inline: (
        <NumericScrubInput label="Opacity:" value={opacityPercent} onChange={handleSetOpacity} suffix="%" min={0} max={100} step={1} decimals={0} width={46} title="Object Opacity (0% – 100%)" />
      ),
    });
    groups.push({
      id: 'recolor', label: 'Recolor',
      inline: (
        <button type="button" className="ai-icon-btn" title="Recolor Artwork (Interactive Harmony Color Wheel)" aria-label="Recolor Artwork" onClick={() => handleOpenModal('recolor-artwork')}>
          <RecolorIcon />
        </button>
      ),
      menu: (
        <button type="button" className="ai-btn" onClick={() => handleOpenModal('recolor-artwork')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RecolorIcon /> Recolor Artwork…
        </button>
      ),
    });
    if (isAnchorMode) {
      groups.push({
        id: 'anchor', label: 'Convert anchors',
        inline: (
          <span className="ai-controlbar-group">
            <span className="ai-controlbar-label">Convert:</span>
            {anchorActions.map((a) => (
              <button key={a.label} type="button" className="ai-btn" title={a.title} onClick={a.run}>{a.icon} {a.label}</button>
            ))}
          </span>
        ),
        compact: (
          <ControlDropdown label="Convert" title="Convert, cut or join anchor points">
            {(close) => anchorActions.map((a) => (
              <DropdownItem key={a.label} title={a.title} onClick={() => { close(); a.run(); }}>{a.icon} {a.label}</DropdownItem>
            ))}
          </ControlDropdown>
        ),
      });
    }
    if (isTextMode) {
      // A stack such as "Inter, system-ui" is shown by its first family; a listed family is selected directly.
      const rawFamily = primaryNode?.textStyle?.fontFamily || 'Inter';
      const firstFamily = rawFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Inter';
      const familyValue = FONT_FAMILIES.includes(firstFamily) ? firstFamily : rawFamily;
      groups.push({
        id: 'text', label: 'Character',
        inline: (
          <span className="ai-controlbar-group">
            <select className="ai-select" title="Font Family" aria-label="Font Family"
              value={familyValue}
              onChange={(e) => { const fam = e.target.value; mutateSelectedNodes((n) => { if (n.textStyle) n.textStyle.fontFamily = fam; }, 'Change Font Family'); }}
              style={{ width: 108 }}>
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              {!FONT_FAMILIES.includes(familyValue) && (
                <option value={familyValue} title={familyValue}>{firstFamily}</option>
              )}
            </select>
            <select className="ai-select" title="Font Style" aria-label="Font Style"
              value={primaryNode?.textStyle?.fontStyle || 'Regular'}
              onChange={(e) => { const st = e.target.value; mutateSelectedNodes((n) => { if (n.textStyle) n.textStyle.fontStyle = st; }, 'Change Font Style'); }}
              style={{ width: 84 }}>
              {['Regular', 'Italic', 'Bold', 'Bold Italic'].map((s) => <option key={s} value={s}>{s}</option>)}
              {primaryNode?.textStyle?.fontStyle && !['Regular', 'Italic', 'Bold', 'Bold Italic'].includes(primaryNode.textStyle.fontStyle) && (
                <option value={primaryNode.textStyle.fontStyle}>{primaryNode.textStyle.fontStyle}</option>
              )}
            </select>
            <NumericScrubInput label="Size:" value={primaryNode?.textStyle?.fontSize ?? 24} unit="pt" min={1} max={1296} width={52}
              onChange={(sz) => { mutateSelectedNodes((n) => { if (n.textStyle) n.textStyle.fontSize = sz; }, 'Change Font Size'); }} />
          </span>
        ),
      });
      groups.push({
        id: 'text-actions', label: 'Type actions',
        inline: (
          <span className="ai-controlbar-group">
            <button type="button" className="ai-btn" title="Create Outlines (Convert Text to Editable Bezier Paths - Shift+Ctrl+O)" onClick={createOutlines}>Create Outlines</button>
            <button type="button" className="ai-btn" title="Make Envelope Warp (Alt+Shift+Ctrl+W)" onClick={() => handleOpenModal('envelope-warp')}>Make Envelope</button>
          </span>
        ),
      });
    }
    if (isImageMode) {
      groups.push({
        id: 'image', label: 'Image',
        inline: (
          <span className="ai-controlbar-group">
            <button type="button" className="ai-btn active" title="Open Image Trace (Bitmap to Vector Engine)" onClick={() => handleOpenModal('image-trace')}>Image Trace</button>
            <button type="button" className="ai-btn" disabled title="Live trace is not available yet; use Image Trace to create vectors.">Expand</button>
          </span>
        ),
      });
    }
    if (isLivePaintOrBlendMode) {
      groups.push({
        id: 'live', label: 'Blend & envelope',
        inline: (
          <span className="ai-controlbar-group">
            <button type="button" className="ai-btn" onClick={() => handleOpenModal('envelope-warp')}>Make Envelope</button>
            <button type="button" className="ai-btn" onClick={() => handleOpenModal('blend-options')}>Blend Options</button>
            <button type="button" className="ai-btn" onClick={() => { if (typeof store.expandAppearance === 'function') store.expandAppearance(); }}>Expand</button>
          </span>
        ),
      });
    }
    groups.push({
      id: 'align', label: 'Align',
      inline: (
        <span className="ai-controlbar-group" style={{ gap: 1 }}>
          {ALIGN_OPS.map((al) => (
            <button key={al.op} type="button" className="ai-icon-btn" title={al.title} aria-label={al.title} disabled={selectedNodes.length === 0} onClick={() => handleAlign(al.op)}>
              <AlignIcon op={al.op} size={13} />
            </button>
          ))}
        </span>
      ),
      compact: (
        <ControlDropdown label={<AlignIcon op="left" size={13} />} title="Align selection" disabled={selectedNodes.length === 0}>
          {(close) => ALIGN_OPS.map((al) => (
            <DropdownItem key={al.op} onClick={() => { close(); handleAlign(al.op); }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlignIcon op={al.op} size={13} />{al.title}</span>
            </DropdownItem>
          ))}
        </ControlDropdown>
      ),
    });
    groups.push({
      id: 'transform', label: 'Position & size',
      inline: (
        <span className="ai-controlbar-group">
          <NumericScrubInput label="X:" value={primaryNode?.x ?? 0} unit={unit} disabled={!primaryNode} width={58}
            onChange={(val) => { mutateSelectedNodes((n) => { const dx = val - n.x; n.x = val; n.points = (n.points || []).map((p) => ({ ...p, x: p.x + dx, handleIn: p.handleIn ? { x: p.handleIn.x + dx, y: p.handleIn.y } : undefined, handleOut: p.handleOut ? { x: p.handleOut.x + dx, y: p.handleOut.y } : undefined })); }, 'Transform X'); }} />
          <NumericScrubInput label="Y:" value={primaryNode?.y ?? 0} unit={unit} disabled={!primaryNode} width={58}
            onChange={(val) => { mutateSelectedNodes((n) => { const dy = val - n.y; n.y = val; n.points = (n.points || []).map((p) => ({ ...p, y: p.y + dy, handleIn: p.handleIn ? { x: p.handleIn.x, y: p.handleIn.y + dy } : undefined, handleOut: p.handleOut ? { x: p.handleOut.x, y: p.handleOut.y + dy } : undefined })); }, 'Transform Y'); }} />
          <NumericScrubInput label="W:" value={primaryNode?.width ?? 0} unit={unit} min={1} disabled={!primaryNode} width={58}
            onChange={(val) => { mutateSelectedNodes((n) => { const sx = val / Math.max(1, n.width); n.width = val; n.points = (n.points || []).map((p) => ({ ...p, x: n.x + (p.x - n.x) * sx, handleIn: p.handleIn ? { x: n.x + (p.handleIn.x - n.x) * sx, y: p.handleIn.y } : undefined, handleOut: p.handleOut ? { x: n.x + (p.handleOut.x - n.x) * sx, y: p.handleOut.y } : undefined })); }, 'Transform Width'); }} />
          <NumericScrubInput label="H:" value={primaryNode?.height ?? 0} unit={unit} min={1} disabled={!primaryNode} width={58}
            onChange={(val) => { mutateSelectedNodes((n) => { const sy = val / Math.max(1, n.height); n.height = val; n.points = (n.points || []).map((p) => ({ ...p, y: n.y + (p.y - n.y) * sy, handleIn: p.handleIn ? { x: p.handleIn.x, y: n.y + (p.handleIn.y - n.y) * sy } : undefined, handleOut: p.handleOut ? { x: p.handleOut.x, y: n.y + (p.handleOut.y - n.y) * sy } : undefined })); }, 'Transform Height'); }} />
        </span>
      ),
    });
    if (isShapeWithCorners && primaryNode) {
      groups.push({
        id: 'corners', label: 'Corners',
        inline: (
          <span className="ai-controlbar-group">
            <NumericScrubInput label="Corners:" value={primaryNode.cornerRadius ?? primaryNode.points?.[0]?.cornerRadius ?? 0} unit={unit} min={0}
              max={Math.round(Math.min(primaryNode.width, primaryNode.height) / 2)} width={54} title="Live Corner Radius (pt/px)"
              onChange={(val) => { mutateSelectedNodes((n) => { n.cornerRadius = val; n.points = (n.points || []).map((p) => p.pointType === 'corner' ? { ...p, cornerRadius: val } : p); }, 'Set Corner Radius'); }} />
            <select className="ai-select" title="Corner Type (Round / Inverted Round / Chamfer)" aria-label="Corner Type"
              value={primaryNode.cornerType || primaryNode.points?.[0]?.cornerType || 'round'}
              onChange={(e) => { const cType = e.target.value as 'round' | 'inverted' | 'chamfer'; mutateSelectedNodes((n) => { n.cornerType = cType; n.points = (n.points || []).map((p) => p.pointType === 'corner' ? { ...p, cornerType: cType } : p); }, `Corner Style: ${cType}`); }}
              style={{ width: 76 }}>
              <option value="round">Round</option>
              <option value="inverted">Inverted</option>
              <option value="chamfer">Chamfer</option>
            </select>
          </span>
        ),
      });
    }
  }

  // Ordered collapse steps, least important first. A group can first shrink to a compact
  // dropdown and later move into the "More" menu. Missing groups are skipped.
  const COLLAPSE_ORDER: { id: string; to: 'compact' | 'overflow' }[] = isArtboardMode
    ? [
        { id: 'ab-actions', to: 'compact' },
        { id: 'ab-name', to: 'overflow' },
        { id: 'ab-actions', to: 'overflow' },
        { id: 'ab-preset', to: 'overflow' },
        { id: 'ab-bounds', to: 'overflow' },
      ]
    : [
        { id: 'recolor', to: 'overflow' },
        { id: 'stroke-style', to: 'overflow' },
        { id: 'text-actions', to: 'overflow' },
        { id: 'live', to: 'overflow' },
        { id: 'anchor', to: 'compact' },
        { id: 'align', to: 'compact' },
        { id: 'image', to: 'overflow' },
        { id: 'corners', to: 'overflow' },
        { id: 'opacity', to: 'overflow' },
        { id: 'anchor', to: 'overflow' },
        { id: 'align', to: 'overflow' },
        { id: 'stroke', to: 'overflow' },
        { id: 'text', to: 'overflow' },
        { id: 'transform', to: 'overflow' },
      ];
  const present = new Set(groups.map((g) => g.id));
  const steps = COLLAPSE_ORDER.filter((s) => present.has(s.id) && (s.to === 'overflow' || groups.find((g) => g.id === s.id)?.compact));
  stepCountRef.current = steps.length;
  const state = new Map<string, 'compact' | 'overflow'>();
  for (const s of steps.slice(0, Math.min(collapsed, steps.length))) state.set(s.id, s.to);

  if (hideAllPanels || screenMode === 'fullscreen') {
    return null;
  }

  const visibleGroups = groups.filter((g) => state.get(g.id) !== 'overflow');
  const overflowGroups = groups.filter((g) => state.get(g.id) === 'overflow');

  return (
    <div className="ai-controlbar" ref={barRef} data-collapsed-steps={collapsed}>
      {/* Selection Context Type Badge */}
      <span className="ai-controlbar-badge">{getSelectionTypeBadge()}</span>

      {visibleGroups.map((g) => (
        <React.Fragment key={g.id}>
          <div className="ai-controlbar-sep" />
          {state.get(g.id) === 'compact' && g.compact ? g.compact : g.inline}
        </React.Fragment>
      ))}

      {overflowGroups.length > 0 && (
        <>
          <div className="ai-controlbar-sep" />
          <ControlDropdown label={<><MoreHorizontal size={14} aria-hidden="true" /><span>More</span></>} title="More controls" panel>
            {() => overflowGroups.map((g) => (
              <div key={g.id} className="ai-controlbar-overflow-row">
                <span className="ai-controlbar-overflow-label">{g.label}</span>
                <div className="ai-controlbar-overflow-controls">{g.menu ?? g.compact ?? g.inline}</div>
              </div>
            ))}
          </ControlDropdown>
        </>
      )}
    </div>
  );
};

function RecolorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8H8V1.5Z" fill="#ff4f4f" />
      <path d="M14.5 8A6.5 6.5 0 0 1 8 14.5V8H14.5Z" fill="#4fcf5f" />
      <path d="M8 14.5A6.5 6.5 0 0 1 1.5 8H8V14.5Z" fill="#1473e6" />
      <path d="M1.5 8A6.5 6.5 0 0 1 8 1.5V8H1.5Z" fill="#ff9a00" />
    </svg>
  );
}

interface ControlGroup {
  id: string;
  /** Shown as the row title in the "More" menu. */
  label: string;
  inline: React.ReactNode;
  /** Smaller dropdown form used when space is short. */
  compact?: React.ReactNode;
  /** Form used inside the "More" menu (defaults to compact, then inline). */
  menu?: React.ReactNode;
}

/** A button that opens a menu (or a panel of controls) below it, portaled so it is never clipped. */
function ControlDropdown({ label, title, children, disabled, panel }: {
  label: React.ReactNode; title: string; disabled?: boolean; panel?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = menuRef.current?.offsetWidth ?? 220;
      const height = menuRef.current?.offsetHeight ?? 0;
      const top = anchor.bottom + height + 4 > window.innerHeight ? Math.max(4, anchor.top - height - 2) : anchor.bottom + 2;
      setPosition({ left: Math.max(4, Math.min(anchor.left, window.innerWidth - width - 4)), top });
    };
    place();
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open]);
  return (
    <>
      <button ref={buttonRef} type="button" className={`ai-btn ai-controlbar-menu-btn ${open ? 'active' : ''}`} title={title} aria-label={typeof label === 'string' ? undefined : title}
        aria-haspopup={panel ? 'dialog' : 'menu'} aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)}>
        {label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className={`ai-dropdown-menu ai-controlbar-popover${panel ? ' is-panel' : ''}`} role={panel ? 'dialog' : 'menu'} aria-label={title}
          style={{ left: position?.left ?? -9999, top: position?.top ?? -9999 }}>
          {children(close)}
        </div>,
        document.body
      )}
    </>
  );
}

function DropdownItem({ children, onClick, checked, title }: { children: React.ReactNode; onClick: () => void; checked?: boolean; title?: string }) {
  return (
    <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} className="ai-dropdown-item" title={title} onClick={onClick}>
      {checked && <span className="ai-menu-check"><Check size={13} aria-hidden="true" /></span>}
      <span className="ai-dropdown-label">{children}</span>
    </button>
  );
}

export default ControlBar;
