import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Type as TypeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Underline,
  Strikethrough,
  Link2,
  Unlink2,
  WrapText,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import {
  getLoadedCustomFonts,
  loadCustomFontFile,
  convertTextNodeToOutlines,
  LoadedCustomFont,
} from '../../core/io/opentypeHelper';
import type { TextStyle, VectorNode } from '../../core/types';

export interface TypographyPanelProps {
  initialTab?: 'character' | 'paragraph' | 'opentype';
  showTabs?: boolean;
}

export const BUILT_IN_FONTS = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Helvetica Neue',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Fira Code',
  'Impact',
];

export const FONT_STYLES = [
  'Regular',
  'Italic',
  'Medium',
  'SemiBold',
  'Bold',
  'Bold Italic',
  'Black',
];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontStyle: 'Regular',
  fontSize: 36,
  leading: 43.2,
  kerning: 0,
  tracking: 0,
  horizontalScale: 100,
  verticalScale: 100,
  baselineShift: 0,
  characterRotation: 0,
  textCase: 'normal',
  underline: false,
  strikethrough: false,
  align: 'left',
  indentLeft: 0,
  indentRight: 0,
  indentFirstLine: 0,
  spaceBefore: 0,
  spaceAfter: 0,
  hyphenation: true,
  typeMode: 'point',
  vertical: false,
  pathFlip: false,
  pathEffect: 'rainbow',
  textWrap: false,
  textWrapOffset: 6,
};

export const TypographyPanel: React.FC<TypographyPanelProps> = ({
  initialTab = 'character',
  showTabs = true,
}) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { nodes: {}, layers: [] };
  const unit = doc.unit || 'pt';

  const [activeTab, setActiveTab] = useState<'character' | 'paragraph' | 'opentype'>(initialTab);
  const [customFonts, setCustomFonts] = useState<LoadedCustomFont[]>(() =>
    getLoadedCustomFonts()
  );
  const [fontStatus, setFontStatus] = useState<string | null>(null);
  const [justifyMode, setJustifyMode] = useState<
    'left' | 'center' | 'right' | 'justify-left' | 'justify-center' | 'justify-right' | 'justify-all'
  >('left');

  // OpenType feature state
  const [otFeatures, setOtFeatures] = useState({
    ligatures: true,
    contextualAlternates: true,
    discretionaryLigatures: false,
    swash: false,
    stylisticSet: 'none',
    fractions: false,
    ordinals: false,
    titlingAlternates: false,
  });

  const fontFileInputRef = useRef<HTMLInputElement>(null);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedNodes: VectorNode[] = useMemo(
    () => selectedIds.map((id) => nodesMap[id]).filter(Boolean),
    [selectedIds, nodesMap]
  );
  const primaryTextNode: VectorNode | null =
    selectedNodes.find((n) => n.type === 'text') || selectedNodes[0] || null;

  const otherTextNodes: VectorNode[] = useMemo(
    () =>
      Object.values(nodesMap).filter(
        (n) => n && n.type === 'text' && n.id !== primaryTextNode?.id
      ),
    [nodesMap, primaryTextNode?.id]
  );

  const currentStyle: TextStyle = useMemo(() => {
    if (primaryTextNode?.textStyle) {
      return { ...DEFAULT_TEXT_STYLE, ...primaryTextNode.textStyle };
    }
    return { ...DEFAULT_TEXT_STYLE, ...(store.defaultTextStyle || {}) };
  }, [primaryTextNode, store.defaultTextStyle]);

  const updateTextStyle = (partial: Partial<TextStyle>, label = 'Update Typography') => {
    useStudioStore.setState((state: any) => ({ defaultTextStyle: { ...(state.defaultTextStyle || DEFAULT_TEXT_STYLE), ...partial } } as any));
    store.updateNodes(selectedIds, (node: VectorNode) => {
      if (node.type === 'text') node.textStyle = { ...(node.textStyle || DEFAULT_TEXT_STYLE), ...partial };
    }, label);
  };

  const handleUploadFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadCustomFontFile(file);
      setCustomFonts(getLoadedCustomFonts());
      updateTextStyle({ fontFamily: loaded.familyName, fontStyle: loaded.styleName }, 'Load Custom Font');
      setFontStatus(`Loaded font "${loaded.familyName}" (${loaded.styleName})`);
      setTimeout(() => setFontStatus(null), 3000);
    } catch {
      setFontStatus('Failed to parse font file. Ensure valid .ttf/.otf/.woff');
      setTimeout(() => setFontStatus(null), 3000);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateOutlines = () => {
    if (!primaryTextNode) return;
    if (typeof store.createOutlinesFromText === 'function') {
      store.createOutlinesFromText();
      return;
    }

    // Build compatible input for convertTextNodeToOutlines and normalize result to StudioDocument schema
    const legacyInput: any = {
      ...primaryTextNode,
      text: primaryTextNode.textContent || 'Vector Text',
      fontSize: currentStyle.fontSize,
      tracking: currentStyle.tracking,
      lineHeight: currentStyle.leading / Math.max(1, currentStyle.fontSize),
      fontFamily: currentStyle.fontFamily,
      fill: primaryTextNode.fills?.[0]?.color || '#ffffff',
      stroke: primaryTextNode.strokes?.[0]?.color || 'none',
      strokeWidth: primaryTextNode.strokes?.[0]?.weight || 0,
    };

    const outlinedRaw: any = convertTextNodeToOutlines(legacyInput);

    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      const layerId = primaryTextNode.layerId || d.activeLayerId || 'layer-1';
      const groupId = `outlines-${Date.now()}`;
      const childIds: string[] = [];

      const rawChildren: any[] = Array.isArray(outlinedRaw.children)
        ? outlinedRaw.children
        : [];

      rawChildren.forEach((chNode, idx) => {
        const cid = `${groupId}-char-${idx}`;
        childIds.push(cid);
        const normalizedChar: VectorNode = {
          id: cid,
          name: chNode.name || `<Compound Path> #${idx + 1}`,
          type: 'compound-path',
          layerId,
          parentId: groupId,
          visible: true,
          locked: false,
          x: chNode.x ?? primaryTextNode.x + idx * 20,
          y: chNode.y ?? primaryTextNode.y,
          width: chNode.width ?? 20,
          height: chNode.height ?? currentStyle.fontSize,
          rotation: 0,
          points: (chNode.points || []).map((pt: any, pIdx: number) => ({
            id: pt.id || `pt-${idx}-${pIdx}`,
            x: pt.x,
            y: pt.y,
            handleIn: pt.handleIn || undefined,
            handleOut: pt.handleOut || undefined,
            pointType: pt.pointType || 'corner',
          })),
          closed: true,
          fillRule: 'evenodd',
          fills: JSON.parse(JSON.stringify(primaryTextNode.fills || [])),
          strokes: JSON.parse(JSON.stringify(primaryTextNode.strokes || [])),
          effects: [],
          opacity: primaryTextNode.opacity ?? 1,
          blendMode: primaryTextNode.blendMode ?? 'normal',
        };
        d.nodes[cid] = normalizedChar;
      });

      const groupNode: VectorNode = {
        id: groupId,
        name: `<Group> (${(primaryTextNode.textContent || 'Text').slice(0, 14)} Outlines)`,
        type: 'group',
        layerId,
        visible: true,
        locked: false,
        x: outlinedRaw.x ?? primaryTextNode.x,
        y: outlinedRaw.y ?? primaryTextNode.y,
        width: outlinedRaw.width ?? primaryTextNode.width,
        height: outlinedRaw.height ?? primaryTextNode.height,
        rotation: primaryTextNode.rotation || 0,
        points: d.nodes[childIds[0]]?.points || [],
        closed: true,
        fills: JSON.parse(JSON.stringify(primaryTextNode.fills || [])),
        strokes: JSON.parse(JSON.stringify(primaryTextNode.strokes || [])),
        effects: JSON.parse(JSON.stringify(primaryTextNode.effects || [])),
        opacity: primaryTextNode.opacity ?? 1,
        blendMode: primaryTextNode.blendMode ?? 'normal',
        children: childIds,
      };

      delete d.nodes[primaryTextNode.id];
      d.nodes[groupId] = groupNode;

      const layer = (d.layers || []).find((l: any) => l.id === layerId);
      if (layer && Array.isArray(layer.nodeIds)) {
        layer.nodeIds = layer.nodeIds.map((id: string) =>
          id === primaryTextNode.id ? groupId : id
        );
      }
      next.selectedIds = [groupId];
      next.selectedNodeIds = [groupId];
      return next;
    });
    setFontStatus('Converted live text to editable Bezier vector outlines (Shift+Ctrl+O).');
    setTimeout(() => setFontStatus(null), 2800);
  };

  const allFontFamilies = useMemo(() => {
    const customNames = customFonts.map((f) => f.familyName);
    return Array.from(new Set([...customNames, ...BUILT_IN_FONTS]));
  }, [customFonts]);

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Sub-Tabs: Character (Ctrl+T) | Paragraph (Alt+Ctrl+T) | OpenType */}
      {showTabs && (
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a]">
        {[
          { id: 'character' as const, label: 'Character' },
          { id: 'paragraph' as const, label: 'Paragraph' },
          { id: 'opentype' as const, label: 'OpenType' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 font-medium border-r border-[#1a1a1a] ${
              activeTab === tab.id
                ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
                : 'text-[#9e9e9e] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      )}

      {/* ====================================================================
          TAB 1: CHARACTER PANEL (Ctrl+T)
          ==================================================================== */}
      {activeTab === 'character' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          {/* Live Text Content Quick Editor when a text object is selected */}
          {primaryTextNode && primaryTextNode.type === 'text' && (
            <div className="space-y-1">
              <span className="text-[10px] text-[#9e9e9e]">Text String:</span>
              <input
                value={primaryTextNode.textContent || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  store.updateNode(primaryTextNode.id, { textContent: val }, 'Edit Text');
                }}
                className="ai-input w-full"
                placeholder="Type text..."
              />
            </div>
          )}

          {/* Font Family Selector + Local Font Upload (.ttf/.otf/.woff) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#b0b0b0]">Font Family:</span>
              <button
                onClick={() => fontFileInputRef.current?.click()}
                className="px-1.5 py-0.5 rounded bg-[#292929] hover:bg-[#1473e6] border border-[#1a1a1a] text-[9px] flex items-center gap-1"
                title="Upload Custom Local Font (.ttf, .otf, .woff) via opentype.js"
              >
                <Upload size={10} />
                <span>Upload Font</span>
              </button>
              <input
                ref={fontFileInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleUploadFont}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-1.5">
              <select
                value={currentStyle.fontFamily}
                onChange={(e) => updateTextStyle({ fontFamily: e.target.value }, 'Font Family')}
                className="ai-select w-full"
              >
                {allFontFamilies.map((fam) => (
                  <option key={fam} value={fam}>
                    {fam}
                  </option>
                ))}
              </select>

              <select
                value={currentStyle.fontStyle}
                onChange={(e) => updateTextStyle({ fontStyle: e.target.value }, 'Font Style')}
                className="ai-select w-full"
              >
                {FONT_STYLES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Size, Leading, Kerning, Tracking */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 border-t border-[#222222]">
            <NumericScrubInput
              label="Size:"
              value={currentStyle.fontSize}
              unit={unit}
              min={1}
              max={1200}
              width={54}
              onChange={(sz) =>
                updateTextStyle({ fontSize: sz, leading: Math.round(sz * 1.2 * 10) / 10 }, 'Font Size')
              }
            />
            <NumericScrubInput
              label="Leading:"
              value={currentStyle.leading}
              unit={unit}
              min={1}
              max={1500}
              width={54}
              onChange={(ld) => updateTextStyle({ leading: ld }, 'Leading')}
            />
            <NumericScrubInput
              label="Kerning:"
              value={currentStyle.kerning}
              min={-500}
              max={1000}
              width={54}
              onChange={(kr) => updateTextStyle({ kerning: kr }, 'Kerning')}
            />
            <NumericScrubInput
              label="Tracking:"
              value={currentStyle.tracking}
              min={-500}
              max={2000}
              step={10}
              width={54}
              onChange={(tr) => updateTextStyle({ tracking: tr }, 'Tracking')}
            />
          </div>

          {/* Vertical/Horizontal Scale, Baseline Shift, Character Rotation */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 border-t border-[#222222]">
            <NumericScrubInput
              label="V-Scale:"
              value={currentStyle.verticalScale}
              suffix="%"
              min={10}
              max={500}
              width={52}
              onChange={(vs) => updateTextStyle({ verticalScale: vs }, 'Vertical Scale')}
            />
            <NumericScrubInput
              label="H-Scale:"
              value={currentStyle.horizontalScale}
              suffix="%"
              min={10}
              max={500}
              width={52}
              onChange={(hs) => updateTextStyle({ horizontalScale: hs }, 'Horizontal Scale')}
            />
            <NumericScrubInput
              label="Baseline:"
              value={currentStyle.baselineShift}
              unit="pt"
              min={-200}
              max={200}
              width={52}
              onChange={(bs) => updateTextStyle({ baselineShift: bs }, 'Baseline Shift')}
            />
            <NumericScrubInput
              label="Rotate:"
              value={currentStyle.characterRotation}
              suffix="°"
              min={-180}
              max={180}
              width={52}
              onChange={(rot) => updateTextStyle({ characterRotation: rot }, 'Character Rotation')}
            />
          </div>

          {/* Case & Decoration Toggles: All Caps, Small Caps, Superscript, Subscript, Underline, Strikethrough */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]">
            <div className="flex items-center gap-1">
              {[
                { id: 'uppercase' as const, label: 'TT', title: 'All Caps' },
                { id: 'small-caps' as const, label: 'Tt', title: 'Small Caps' },
                { id: 'superscript' as const, label: 'T¹', title: 'Superscript' },
                { id: 'subscript' as const, label: 'T₁', title: 'Subscript' },
              ].map((btn) => {
                const isActive = currentStyle.textCase === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() =>
                      updateTextStyle({
                        textCase: isActive ? 'normal' : btn.id,
                      })
                    }
                    title={btn.title}
                    className={`w-6 h-6 rounded text-[10px] font-bold border ${
                      isActive
                        ? 'bg-[#1473e6] border-[#1473e6] text-white'
                        : 'bg-[#292929] border-[#1a1a1a]'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}

              <button
                onClick={() => updateTextStyle({ underline: !currentStyle.underline })}
                title="Underline"
                className={`w-6 h-6 rounded flex items-center justify-center border ${
                  currentStyle.underline
                    ? 'bg-[#1473e6] border-[#1473e6] text-white'
                    : 'bg-[#292929] border-[#1a1a1a]'
                }`}
              >
                <Underline size={12} />
              </button>

              <button
                onClick={() => updateTextStyle({ strikethrough: !currentStyle.strikethrough })}
                title="Strikethrough"
                className={`w-6 h-6 rounded flex items-center justify-center border ${
                  currentStyle.strikethrough
                    ? 'bg-[#1473e6] border-[#1473e6] text-white'
                    : 'bg-[#292929] border-[#1a1a1a]'
                }`}
              >
                <Strikethrough size={12} />
              </button>
            </div>

            {/* Create Outlines (Shift+Ctrl+O) */}
            <button
              onClick={handleCreateOutlines}
              disabled={!primaryTextNode}
              title="Create Outlines (Shift+Ctrl+O) — Convert live text to editable Bezier paths"
              className="px-2 py-1 rounded bg-[#1473e6] hover:bg-[#0d66d0] disabled:opacity-40 text-white text-[10px] font-medium"
            >
              Create Outlines
            </button>
          </div>

          {fontStatus && (
            <div className="px-2 py-1 rounded bg-[#1473e6]/25 border border-[#1473e6] text-[10px]">
              {fontStatus}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: PARAGRAPH PANEL (Alt+Ctrl+T)
          ==================================================================== */}
      {activeTab === 'paragraph' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          {/* 7 Align / Justify Buttons */}
          <div>
            <span className="block text-[10px] text-[#b0b0b0] mb-1">Alignment & Justification:</span>
            <div className="grid grid-cols-7 gap-1">
              {[
                { id: 'left' as const, align: 'left' as const, title: 'Align Left', lbl: '⫷' },
                { id: 'center' as const, align: 'center' as const, title: 'Align Center', lbl: '⫿' },
                { id: 'right' as const, align: 'right' as const, title: 'Align Right', lbl: '⫸' },
                { id: 'justify-left' as const, align: 'justify' as const, title: 'Justify with Last Line Aligned Left', lbl: '☰L' },
                { id: 'justify-center' as const, align: 'justify' as const, title: 'Justify with Last Line Aligned Center', lbl: '☰C' },
                { id: 'justify-right' as const, align: 'justify' as const, title: 'Justify with Last Line Aligned Right', lbl: '☰R' },
                { id: 'justify-all' as const, align: 'justify' as const, title: 'Justify All Lines', lbl: '☰A' },
              ].map((b) => {
                const isSelected =
                  justifyMode === b.id ||
                  (currentStyle.align === b.align && b.id === b.align);
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setJustifyMode(b.id);
                      updateTextStyle({ align: b.align }, `Paragraph Align: ${b.title}`);
                    }}
                    title={b.title}
                    className={`h-6 rounded text-[10px] border flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#1473e6] border-[#1473e6] text-white'
                        : 'bg-[#292929] border-[#1a1a1a]'
                    }`}
                  >
                    {b.lbl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left / Right / First-Line Indents & Space Before / After */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1 border-t border-[#222222]">
            <NumericScrubInput
              label="Left Indent:"
              value={currentStyle.indentLeft}
              unit="pt"
              min={0}
              max={500}
              width={48}
              onChange={(v) => updateTextStyle({ indentLeft: v }, 'Left Indent')}
            />
            <NumericScrubInput
              label="Right Indent:"
              value={currentStyle.indentRight}
              unit="pt"
              min={0}
              max={500}
              width={48}
              onChange={(v) => updateTextStyle({ indentRight: v }, 'Right Indent')}
            />
            <NumericScrubInput
              label="First Line:"
              value={currentStyle.indentFirstLine}
              unit="pt"
              min={-200}
              max={500}
              width={48}
              onChange={(v) => updateTextStyle({ indentFirstLine: v }, 'First Line Indent')}
            />
            <NumericScrubInput
              label="Space Before:"
              value={currentStyle.spaceBefore}
              unit="pt"
              min={0}
              max={300}
              width={48}
              onChange={(v) => updateTextStyle({ spaceBefore: v }, 'Space Before')}
            />
            <NumericScrubInput
              label="Space After:"
              value={currentStyle.spaceAfter}
              unit="pt"
              min={0}
              max={300}
              width={48}
              onChange={(v) => updateTextStyle({ spaceAfter: v }, 'Space After')}
            />
            <label className="flex items-center gap-1.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={currentStyle.hyphenation}
                onChange={(e) => updateTextStyle({ hyphenation: e.target.checked }, 'Hyphenation')}
              />
              <span>Hyphenate</span>
            </label>
          </div>

          {/* Link / Thread Text Frames */}
          <div className="pt-1.5 border-t border-[#222222] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#b0b0b0] flex items-center gap-1">
                <Link2 size={11} />
                <span>Thread / Link Text Frame:</span>
              </span>
              <select
                value={currentStyle.threadedNextNodeId || ''}
                onChange={(e) =>
                  updateTextStyle(
                    {
                      threadedNextNodeId: e.target.value || undefined,
                    },
                    'Thread Text Frame'
                  )
                }
                className="ai-select text-[10px] w-36"
              >
                <option value="">[Not Threaded]</option>
                {otherTextNodes.map((tn) => (
                  <option key={tn.id} value={tn.id}>
                    {tn.name || tn.id}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" disabled={currentStyle.typeMode !== 'area'} checked={!!currentStyle.wrapInFrame} onChange={e => updateTextStyle({ wrapInFrame: e.target.checked }, 'Wrap Text in Frame')} />
              <span>Wrap Text in Frame</span>
            </label>
            {/* Text Wrap Toggle + Offset */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!currentStyle.textWrap}
                  onChange={(e) => updateTextStyle({ textWrap: e.target.checked }, 'Toggle Text Wrap')}
                />
                <span>Text Wrap Around Object</span>
              </label>
              <NumericScrubInput
                label="Offset:"
                value={currentStyle.textWrapOffset ?? 6}
                unit="pt"
                min={0}
                max={200}
                width={44}
                compact
                disabled={!currentStyle.textWrap}
                onChange={(off) => updateTextStyle({ textWrapOffset: off }, 'Text Wrap Offset')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: OPENTYPE PANEL (Alt+Shift+Ctrl+T)
          ==================================================================== */}
      {activeTab === 'opentype' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { key: 'ligatures' as const, code: 'fi', label: 'Standard Ligatures' },
              { key: 'contextualAlternates' as const, code: 'clig', label: 'Contextual Alternates' },
              { key: 'discretionaryLigatures' as const, code: 'st', label: 'Discretionary Ligatures' },
              { key: 'swash' as const, code: 'S~', label: 'Swash' },
              { key: 'fractions' as const, code: '½', label: 'Fractions' },
              { key: 'ordinals' as const, code: '1ª', label: 'Ordinals' },
            ].map((feat) => {
              const active = otFeatures[feat.key];
              return (
                <button
                  key={feat.key}
                  onClick={() =>
                    setOtFeatures((prev) => ({ ...prev, [feat.key]: !prev[feat.key] }))
                  }
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-left ${
                    active
                      ? 'bg-[#384656] border-[#1473e6] text-white'
                      : 'bg-[#292929] border-[#1a1a1a] text-[#b0b0b0]'
                  }`}
                >
                  <span className="px-1 py-0.5 rounded bg-[#1e1e1e] font-serif font-bold text-[10px] text-[#ff9a00]">
                    {feat.code}
                  </span>
                  <span className="text-[10px] truncate">{feat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]">
            <span className="text-[10px] text-[#b0b0b0]">Stylistic Sets:</span>
            <select
              value={otFeatures.stylisticSet}
              onChange={(e) =>
                setOtFeatures((prev) => ({ ...prev, stylisticSet: e.target.value }))
              }
              className="ai-select text-[10px]"
            >
              <option value="none">Default (None)</option>
              <option value="ss01">Stylistic Set 01 (ss01)</option>
              <option value="ss02">Stylistic Set 02 (ss02)</option>
              <option value="ss03">Stylistic Set 03 (ss03)</option>
              <option value="ss04">Stylistic Set 04 (ss04)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default TypographyPanel;
