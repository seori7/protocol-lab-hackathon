import {
  useState, useMemo, useCallback, useEffect, useRef, memo,
  type FC, type MouseEvent as ReactMouseEvent,
  type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { HexViewerProps, HexByte, HexLine, ByteRange, Rule } from '../types';
import { cn } from '../utils/cn';
import { formatHexAddress, getRuleColor } from '../utils/hex';
import { resolveRuleStart } from '../utils/anchor';
import { buildCoverageStats } from '../utils/structure';
import { CoverageBar } from './CoverageBar';
import { EntropyStrip } from './EntropyStrip';
import { HexMinimap } from './HexMinimap';
import { ShortcutsModal } from './ShortcutsModal';

const BYTES_PER_LINE = 16;
const BYTES_PER_HALF_LINE = 8;
const HEX_CHARS_PER_BYTE = 2;
const HEX_RADIX = 16;
const OFFSET_HEX_LENGTH = 4;
const OFFSET_PAD_CHAR = '0';
const ASCII_PRINTABLE_MIN = 32;
const ASCII_PRINTABLE_MAX = 126;
const PLACEHOLDER_ASCII_CHAR = '.';

const PRIMARY_MOUSE_BUTTON = 0;
const INCLUSIVE_RANGE_ADJUSTMENT = 1;
const SELECTION_PREVIEW_MAX_BYTES = 32;
const ESCAPE_KEY = 'Escape';
const FIRST_BYTE_OFFSET = 0;
const CURSOR_MOVE_STEP = 1;
const LINES_COUNT_BASE = 1;

const INITIAL_VISIBLE_LINES = 128;
const LINES_LOAD_MORE_STEP = 128;

const SEARCH_MIN_HEX_CHARS = 2;
const SEARCH_INPUT_MAX_LENGTH = 64;
const MAX_SEARCH_HITS = 1000;
const SCROLL_DELAY_MS = 50;
const HEX_SEARCH_VALID_PATTERN = /^[0-9A-F]+$/;
const HEX_SEARCH_SPACES_PATTERN = /\s+/g;

const COPY_FEEDBACK_TIMEOUT_MS = 2000;
const HEX_BYTE_DOM_ID_PREFIX = 'hex-byte-';

const KEY_ARROW_LEFT = 'ArrowLeft';
const KEY_ARROW_RIGHT = 'ArrowRight';
const KEY_ARROW_UP = 'ArrowUp';
const KEY_ARROW_DOWN = 'ArrowDown';
const KEY_HOME = 'Home';
const KEY_END = 'End';
const KEY_ENTER = 'Enter';
const KEY_SELECT_ALL_LOWER = 'a';
const KEY_COPY_LOWER = 'c';
const INPUT_TAG_NAME = 'INPUT';

const BYTE_CELL_BASE = 'inline-flex items-center justify-center w-7 h-6 rounded text-[13px] cursor-crosshair transition-colors duration-75';
const BYTE_CELL_SELECTED = 'bg-blue-600 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.6)]';
const BYTE_CELL_IDLE = 'text-slate-200 hover:bg-slate-700/70 hover:text-white';
const ASCII_CELL_BASE = 'inline-flex items-center justify-center w-[14px] h-6 text-[13px] rounded-sm cursor-crosshair transition-colors duration-75';
const ASCII_CELL_SELECTED = 'bg-blue-600 text-white';
const ASCII_CELL_IDLE = 'text-slate-400 hover:bg-slate-700/70 hover:text-white';
const HOVERED_RULE_RING = 'ring-1 ring-white/50';
const SELECTED_RULE_RING = 'ring-2 ring-white/80';
const SEARCH_HIT_RING = 'ring-1 ring-yellow-400/80';
const ACTIVE_SEARCH_CLASSES = 'bg-amber-500 text-slate-950';

function hexToAsciiChar(hexByte: string): string {
  const code = parseInt(hexByte, HEX_RADIX);
  const isPrintable = code >= ASCII_PRINTABLE_MIN && code <= ASCII_PRINTABLE_MAX;
  return isPrintable ? String.fromCharCode(code) : PLACEHOLDER_ASCII_CHAR;
}

function formatLineOffset(offset: number): string {
  return offset.toString(HEX_RADIX).padStart(OFFSET_HEX_LENGTH, OFFSET_PAD_CHAR).toUpperCase();
}

interface HexLineRowProps {
  line: HexLine;
  selectionRange: ByteRange | null;
  byteToRuleMap: Map<number, Rule>;
  hoveredRuleId: string | null;
  selectedRuleId: string | null;
  searchHitSet: Set<number>;
  activeSearchStart: number | null;
  activeSearchLength: number;
  onByteMouseDown: (offset: number, event: ReactMouseEvent<HTMLSpanElement>) => void;
  onByteMouseEnter: (offset: number) => void;
}

function HexLineRowInner({
  line, selectionRange, byteToRuleMap,
  hoveredRuleId, selectedRuleId,
  searchHitSet, activeSearchStart, activeSearchLength,
  onByteMouseDown, onByteMouseEnter,
}: HexLineRowProps) {
  const isSelected = (offset: number): boolean => {
    if (!selectionRange) return false;
    return offset >= selectionRange.start && offset <= selectionRange.end;
  };
  const isActiveSearch = (offset: number): boolean => {
    if (activeSearchStart === null || activeSearchLength === 0) return false;
    return offset >= activeSearchStart && offset < activeSearchStart + activeSearchLength;
  };
  return (
    <div className="flex items-center px-2 py-[1px] rounded hover:bg-slate-800/50">
      <div className="w-14 shrink-0 text-slate-500 select-none mr-4">{line.offsetLabel}</div>
      <div className="flex gap-[2px] shrink-0">
        {line.bytes.map((byte, idxInLine) => {
          const selected = isSelected(byte.offset);
          const rule = byteToRuleMap.get(byte.offset) ?? null;
          const theme = rule ? getRuleColor(rule.colorIndex) : null;
          const isHovered = rule !== null && rule.id === hoveredRuleId;
          const isSelRule = rule !== null && rule.id === selectedRuleId;
          const isHit = searchHitSet.has(byte.offset);
          const isActive = isActiveSearch(byte.offset);
          const needsGap = idxInLine === BYTES_PER_HALF_LINE;
          let stateClass: string;
          if (selected) stateClass = BYTE_CELL_SELECTED;
          else if (isActive) stateClass = ACTIVE_SEARCH_CLASSES;
          else if (rule && theme) {
            stateClass = cn(
              isHovered || isSelRule ? theme.byteBackgroundActive : theme.byteBackground,
              theme.byteText,
              isHovered && !isSelRule && HOVERED_RULE_RING,
              isSelRule && SELECTED_RULE_RING,
              isHit && SEARCH_HIT_RING
            );
          } else if (isHit) stateClass = cn(BYTE_CELL_IDLE, SEARCH_HIT_RING, 'text-yellow-200');
          else stateClass = BYTE_CELL_IDLE;
          const title = rule
            ? `Offset ${formatHexAddress(byte.offset)} (${byte.offset}) | ${rule.name} [${rule.data_type}] [${rule.anchor}]`
            : `Offset ${formatHexAddress(byte.offset)} (${byte.offset})`;
          return (
            <span
              key={byte.offset}
              id={`${HEX_BYTE_DOM_ID_PREFIX}${byte.offset}`}
              onMouseDown={(e) => onByteMouseDown(byte.offset, e)}
              onMouseEnter={() => onByteMouseEnter(byte.offset)}
              title={title}
              className={cn(BYTE_CELL_BASE, stateClass, needsGap && 'ml-3')}
            >
              {byte.hex}
            </span>
          );
        })}
        {Array.from({ length: BYTES_PER_LINE - line.bytes.length }).map((_, i) => (
          <span key={`empty-${i}`} className="inline-block w-7 h-6" />
        ))}
      </div>
      <div className="ml-4 pl-4 border-l border-slate-800 flex shrink-0">
        {line.bytes.map((byte) => {
          const selected = isSelected(byte.offset);
          const rule = byteToRuleMap.get(byte.offset) ?? null;
          const theme = rule ? getRuleColor(rule.colorIndex) : null;
          const isHovered = rule !== null && rule.id === hoveredRuleId;
          const isSelRule = rule !== null && rule.id === selectedRuleId;
          const isActive = isActiveSearch(byte.offset);
          let stateClass: string;
          if (selected) stateClass = ASCII_CELL_SELECTED;
          else if (isActive) stateClass = ACTIVE_SEARCH_CLASSES;
          else if (rule && theme) {
            stateClass = cn(
              isHovered || isSelRule ? theme.byteBackgroundActive : theme.byteBackground,
              theme.byteText
            );
          } else stateClass = ASCII_CELL_IDLE;
          return (
            <span
              key={`ascii-${byte.offset}`}
              onMouseDown={(e) => onByteMouseDown(byte.offset, e)}
              onMouseEnter={() => onByteMouseEnter(byte.offset)}
              title={rule ? `${rule.name} [${rule.data_type}] [${rule.anchor}]` : `Offset ${formatHexAddress(byte.offset)}`}
              className={cn(ASCII_CELL_BASE, stateClass)}
            >
              {byte.ascii}
            </span>
          );
        })}
      </div>
    </div>
  );
}
const HexLineRow = memo(HexLineRowInner);

export const HexViewer: FC<HexViewerProps> = ({
  payloadHex, rules, hoveredRuleId, selectedRuleId, sessionEntropy,
  clearSelectionToken, pendingSelection, pendingSelectionToken,
  onSelectionChange, onHoverRule,
}) => {
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(0);
  const [visibleLineCount, setVisibleLineCount] = useState<number>(INITIAL_VISIBLE_LINES);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const bytes: HexByte[] = useMemo(() => {
    if (!payloadHex) return [];
    const result: HexByte[] = [];
    for (let i = 0; i < payloadHex.length; i += HEX_CHARS_PER_BYTE) {
      const hexPair = payloadHex.substring(i, i + HEX_CHARS_PER_BYTE).toUpperCase();
      const offset = result.length;
      result.push({ offset, hex: hexPair, ascii: hexToAsciiChar(hexPair) });
    }
    return result;
  }, [payloadHex]);

  const lines: HexLine[] = useMemo(() => {
    const result: HexLine[] = [];
    for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
      result.push({
        lineIndex: Math.floor(i / BYTES_PER_LINE),
        startOffset: i,
        offsetLabel: formatLineOffset(i),
        bytes: bytes.slice(i, i + BYTES_PER_LINE),
      });
    }
    return result;
  }, [bytes]);

  const selectionRange: ByteRange | null = useMemo(() => {
    if (selectionStart === null || selectionEnd === null) return null;
    return { start: Math.min(selectionStart, selectionEnd), end: Math.max(selectionStart, selectionEnd) };
  }, [selectionStart, selectionEnd]);

  const byteToRuleMap: Map<number, Rule> = useMemo(() => {
    const map = new Map<number, Rule>();
    const total = bytes.length;
    for (const rule of rules) {
      const effective = resolveRuleStart(rule, total);
      if (effective === null) continue;
      for (let i = 0; i < rule.length; i++) {
        const offset = effective + i;
        if (!map.has(offset)) map.set(offset, rule);
      }
    }
    return map;
  }, [rules, bytes.length]);

  const coverageStats = useMemo(() => buildCoverageStats(payloadHex, rules), [payloadHex, rules]);

  const normalizedSearch = useMemo(
    () => searchQuery.replace(HEX_SEARCH_SPACES_PATTERN, '').toUpperCase(),
    [searchQuery]
  );

  const searchBytes: string[] | null = useMemo(() => {
    if (normalizedSearch.length < SEARCH_MIN_HEX_CHARS) return null;
    if (normalizedSearch.length % HEX_CHARS_PER_BYTE !== 0) return null;
    if (!HEX_SEARCH_VALID_PATTERN.test(normalizedSearch)) return null;
    const arr: string[] = [];
    for (let i = 0; i < normalizedSearch.length; i += HEX_CHARS_PER_BYTE) {
      arr.push(normalizedSearch.slice(i, i + HEX_CHARS_PER_BYTE));
    }
    return arr;
  }, [normalizedSearch]);

  const searchOffsets: number[] = useMemo(() => {
    if (!searchBytes || searchBytes.length === 0) return [];
    const hits: number[] = [];
    for (let i = 0; i + searchBytes.length <= bytes.length; i++) {
      let match = true;
      for (let j = 0; j < searchBytes.length; j++) {
        if (bytes[i + j]?.hex !== searchBytes[j]) { match = false; break; }
      }
      if (match) {
        hits.push(i);
        if (hits.length >= MAX_SEARCH_HITS) break;
      }
    }
    return hits;
  }, [bytes, searchBytes]);

  const searchHitSet: Set<number> = useMemo(() => {
    const set = new Set<number>();
    if (!searchBytes) return set;
    for (const start of searchOffsets) {
      for (let k = 0; k < searchBytes.length; k++) set.add(start + k);
    }
    return set;
  }, [searchOffsets, searchBytes]);

  const activeSearchStart: number | null =
    searchOffsets.length > 0 ? (searchOffsets[activeSearchIndex % searchOffsets.length] ?? null) : null;
  const activeSearchLength = searchBytes?.length ?? 0;

  const visibleLines = useMemo(() => lines.slice(0, visibleLineCount), [lines, visibleLineCount]);
  const hiddenLinesCount = lines.length - visibleLines.length;

  const selectionPreview: string = useMemo(() => {
    if (!selectionRange) return '';
    const sel = bytes.slice(selectionRange.start, selectionRange.end + INCLUSIVE_RANGE_ADJUSTMENT);
    const head = sel.slice(0, SELECTION_PREVIEW_MAX_BYTES);
    const text = head.map((b) => b.hex).join(' ');
    return sel.length > SELECTION_PREVIEW_MAX_BYTES ? `${text} ...` : text;
  }, [bytes, selectionRange]);

  const overlappingRules: Rule[] = useMemo(() => {
    if (!selectionRange) return [];
    const total = bytes.length;
    return rules.filter((rule) => {
      const effective = resolveRuleStart(rule, total);
      if (effective === null) return false;
      const ruleEnd = effective + rule.length - INCLUSIVE_RANGE_ADJUSTMENT;
      return selectionRange.start <= ruleEnd && effective <= selectionRange.end;
    });
  }, [rules, selectionRange, bytes.length]);

  const scrollToOffset = useCallback((offset: number): void => {
    const neededLines = Math.floor(offset / BYTES_PER_LINE) + LINES_COUNT_BASE;
    setVisibleLineCount((prev) => Math.max(prev, neededLines));
    window.setTimeout(() => {
      document.getElementById(`${HEX_BYTE_DOM_ID_PREFIX}${offset}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, SCROLL_DELAY_MS);
  }, []);

  const handleMouseDown = useCallback((offset: number, event: ReactMouseEvent<HTMLSpanElement>) => {
    if (event.button !== PRIMARY_MOUSE_BUTTON) return;
    event.preventDefault();
    setSelectionStart(offset);
    setSelectionEnd(offset);
    setIsSelecting(true);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleMouseEnter = useCallback((offset: number) => {
    if (!isSelecting) return;
    setSelectionEnd((prev) => (prev === offset ? prev : offset));
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => setIsSelecting(false), []);

  const handleSelectRange = useCallback((range: ByteRange): void => {
    setSelectionStart(range.start);
    setSelectionEnd(range.end);
    setIsSelecting(false);
    scrollToOffset(range.start);
    containerRef.current?.focus({ preventScroll: true });
  }, [scrollToOffset]);

  const handleCoverageHover = useCallback((ruleId: string | null): void => {
    onHoverRule?.(ruleId);
  }, [onHoverRule]);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setActiveSearchIndex(0);
  }, []);

  const handleSearchNext = useCallback(() => {
    if (searchOffsets.length === 0) return;
    setActiveSearchIndex((prev) => (prev + 1) % searchOffsets.length);
  }, [searchOffsets.length]);

  const handleSearchPrev = useCallback(() => {
    if (searchOffsets.length === 0) return;
    setActiveSearchIndex((prev) => (prev - 1 + searchOffsets.length) % searchOffsets.length);
  }, [searchOffsets.length]);

  const handleShowMore = useCallback(() => {
    setVisibleLineCount((prev) => prev + LINES_LOAD_MORE_STEP);
  }, []);
  const handleShowAll = useCallback(() => setVisibleLineCount(lines.length), [lines.length]);

  const showCopyFeedback = useCallback((message: string) => {
    setCopyFeedback(message);
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_TIMEOUT_MS);
  }, []);

  const handleCopyHex = useCallback(() => {
    if (!selectionRange) return;
    const sel = bytes.slice(selectionRange.start, selectionRange.end + INCLUSIVE_RANGE_ADJUSTMENT);
    const text = sel.map((b) => b.hex).join(' ');
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback('HEX скопирован');
      } catch {
        showCopyFeedback('Не удалось скопировать');
      }
    })();
  }, [bytes, selectionRange, showCopyFeedback]);

  const handleCopyAscii = useCallback(() => {
    if (!selectionRange) return;
    const sel = bytes.slice(selectionRange.start, selectionRange.end + INCLUSIVE_RANGE_ADJUSTMENT);
    const text = sel.map((b) => b.ascii).join('');
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback('ASCII скопирован');
      } catch {
        showCopyFeedback('Не удалось скопировать');
      }
    })();
  }, [bytes, selectionRange, showCopyFeedback]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.tagName === INPUT_TAG_NAME) return;
    if (bytes.length === 0) return;
    const isCtrl = event.ctrlKey || event.metaKey;
    const lowerKey = event.key.toLowerCase();
    if (isCtrl && lowerKey === KEY_SELECT_ALL_LOWER) {
      event.preventDefault();
      setSelectionStart(FIRST_BYTE_OFFSET);
      setSelectionEnd(bytes.length - CURSOR_MOVE_STEP);
      return;
    }
    if (isCtrl && lowerKey === KEY_COPY_LOWER && selectionRange) {
      event.preventDefault();
      handleCopyHex();
      return;
    }
    const cursor = selectionEnd ?? selectionStart ?? FIRST_BYTE_OFFSET;
    const lastOffset = bytes.length - CURSOR_MOVE_STEP;
    let newCursor: number | null = null;
    if (event.key === KEY_ARROW_RIGHT) newCursor = Math.min(cursor + CURSOR_MOVE_STEP, lastOffset);
    else if (event.key === KEY_ARROW_LEFT) newCursor = Math.max(cursor - CURSOR_MOVE_STEP, FIRST_BYTE_OFFSET);
    else if (event.key === KEY_ARROW_DOWN) newCursor = Math.min(cursor + BYTES_PER_LINE, lastOffset);
    else if (event.key === KEY_ARROW_UP) newCursor = Math.max(cursor - BYTES_PER_LINE, FIRST_BYTE_OFFSET);
    else if (event.key === KEY_HOME) newCursor = Math.floor(cursor / BYTES_PER_LINE) * BYTES_PER_LINE;
    else if (event.key === KEY_END) {
      const lineStart = Math.floor(cursor / BYTES_PER_LINE) * BYTES_PER_LINE;
      newCursor = Math.min(lineStart + BYTES_PER_LINE - CURSOR_MOVE_STEP, lastOffset);
    } else return;
    event.preventDefault();
    if (event.shiftKey) {
      setSelectionStart((prev) => prev ?? cursor);
      setSelectionEnd(newCursor);
    } else {
      setSelectionStart(newCursor);
      setSelectionEnd(newCursor);
    }
    scrollToOffset(newCursor);
  }, [bytes.length, selectionEnd, selectionStart, selectionRange, handleCopyHex, scrollToOffset]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  useEffect(() => {
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    return () => {
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (clearSelectionToken === undefined) return;
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelecting(false);
  }, [clearSelectionToken]);

  useEffect(() => {
    if (pendingSelectionToken === undefined || !pendingSelection) return;
    setSelectionStart(pendingSelection.start);
    setSelectionEnd(pendingSelection.end);
    setIsSelecting(false);
    scrollToOffset(pendingSelection.start);
    containerRef.current?.focus({ preventScroll: true });
  }, [pendingSelection, pendingSelectionToken, scrollToOffset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === ESCAPE_KEY) {
        setSelectionStart(null);
        setSelectionEnd(null);
        setIsSelecting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isSelecting) onSelectionChange?.(selectionRange);
  }, [isSelecting, selectionRange, onSelectionChange]);

  useEffect(() => {
    setVisibleLineCount(INITIAL_VISIBLE_LINES);
  }, [payloadHex]);

  useEffect(() => {
    if (activeSearchStart === null) return;
    scrollToOffset(activeSearchStart);
  }, [activeSearchStart, scrollToOffset]);

  if (bytes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 bg-slate-900">
        Нет данных для отображения
      </div>
    );
  }

  const selectionLength = selectionRange
    ? selectionRange.end - selectionRange.start + INCLUSIVE_RANGE_ADJUSTMENT
    : 0;
  const isSearchValid = searchBytes !== null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="font-semibold text-slate-100 text-sm tracking-wide whitespace-nowrap">Hex Viewer</div>
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => { if (e.key === KEY_ENTER) handleSearchNext(); }}
            placeholder="Поиск HEX: 01 02 FF"
            maxLength={SEARCH_INPUT_MAX_LENGTH}
            className="w-44 px-2 py-1 text-xs font-mono rounded bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-yellow-500"
          />
          {normalizedSearch.length > 0 && (
            <span className={`text-[11px] font-mono ${isSearchValid ? 'text-yellow-300' : 'text-rose-400'}`}>
              {isSearchValid
                ? searchOffsets.length > 0
                  ? `${(activeSearchIndex % searchOffsets.length) + 1}/${searchOffsets.length}`
                  : '0 совп.'
                : 'HEX?'}
            </span>
          )}
          <button type="button" onClick={handleSearchPrev} disabled={searchOffsets.length === 0} title="Предыдущее"
            className="px-1.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-500 cursor-pointer">↑</button>
          <button type="button" onClick={handleSearchNext} disabled={searchOffsets.length === 0} title="Следующее (Enter)"
            className="px-1.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-500 cursor-pointer">↓</button>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} title="Очистить"
              className="px-1.5 py-1 text-xs rounded text-slate-500 hover:text-white cursor-pointer">✕</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
            {bytes.length} bytes • {rules.length} rules
          </div>
          <button type="button" onClick={() => setIsShortcutsOpen(true)} title="Горячие клавиши" className="w-6 h-6 text-xs rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-400 hover:text-white cursor-pointer">?</button>
        </div>
      </div>

      <div className="px-4 pt-3 shrink-0 space-y-3">
        <CoverageBar
          stats={coverageStats}
          selectionRange={selectionRange}
          hoveredRuleId={hoveredRuleId}
          selectedRuleId={selectedRuleId}
          onSelectRange={handleSelectRange}
          onHoverRule={handleCoverageHover}
        />
        {sessionEntropy && sessionEntropy.maxLength > 0 && (
          <EntropyStrip
            entropy={sessionEntropy}
            selectionRange={selectionRange}
            onSelectRange={handleSelectRange}
          />
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          title="Кликните сюда и используйте стрелки / Shift+стрелки / Ctrl+A / Ctrl+C"
          className="flex-1 min-w-0 p-4 overflow-y-auto font-mono text-sm select-none outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500/20"
        >
          {visibleLines.map((line) => (
            <HexLineRow
              key={line.lineIndex}
              line={line}
              selectionRange={selectionRange}
              byteToRuleMap={byteToRuleMap}
              hoveredRuleId={hoveredRuleId}
              selectedRuleId={selectedRuleId}
              searchHitSet={searchHitSet}
              activeSearchStart={activeSearchStart}
              activeSearchLength={activeSearchLength}
              onByteMouseDown={handleMouseDown}
              onByteMouseEnter={handleMouseEnter}
            />
          ))}
          {hiddenLinesCount > 0 && (
            <div className="flex items-center gap-2 mt-3 px-2">
              <button type="button" onClick={handleShowMore}
                className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:border-blue-500 cursor-pointer">
                Показать ещё {Math.min(LINES_LOAD_MORE_STEP, hiddenLinesCount)} из {hiddenLinesCount} строк
              </button>
              <button type="button" onClick={handleShowAll}
                className="px-3 py-1.5 text-xs rounded text-slate-500 hover:text-white cursor-pointer">
                Показать все ({lines.length})
              </button>
            </div>
          )}
        </div>
        <div className="w-14 shrink-0 border-l border-slate-800 bg-slate-950/50 p-2 flex flex-col min-h-0">
          <div className="text-[10px] text-slate-600 text-center mb-1 shrink-0">карта</div>
          <div className="flex-1 min-h-0">
            <HexMinimap
              stats={coverageStats}
              selectionRange={selectionRange}
              hoveredRuleId={hoveredRuleId}
              selectedRuleId={selectedRuleId}
              onSelectRange={handleSelectRange}
              onHoverRule={handleCoverageHover}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 font-mono text-xs shrink-0">
        {selectionRange ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400">
              <span className="text-blue-400 font-semibold">
                {formatHexAddress(selectionRange.start)} – {formatHexAddress(selectionRange.end)}
              </span>
              <span className="text-slate-600"> • </span>
              <span className="text-emerald-400 font-semibold">{selectionLength} bytes</span>
            </span>
            {overlappingRules.length > 0 && (
              <span className="text-amber-300">⚠ {overlappingRules.map((r) => r.name).join(', ')}</span>
            )}
            <span className="text-slate-600 hidden lg:inline">|</span>
            <span className="text-slate-500 truncate hidden lg:inline max-w-[300px]">{selectionPreview}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={handleCopyHex} title="Копировать HEX (Ctrl+C)"
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 cursor-pointer">HEX</button>
              <button type="button" onClick={handleCopyAscii} title="Копировать ASCII"
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 cursor-pointer">ASCII</button>
              {copyFeedback && <span className="text-emerald-300">{copyFeedback}</span>}
            </span>
          </div>
        ) : (
          <div className="text-slate-600">
            Карта + энтропия сверху — клик выделяет • Стрелки — курсор • Ctrl+A — всё
          </div>
        )}
      </div>

      <ShortcutsModal open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
};