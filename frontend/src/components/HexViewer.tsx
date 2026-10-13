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
import { ChevronUpIcon, ChevronDownIcon, XIcon, HelpIcon, AlertIcon } from './icons';

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
const INPUT_TAG_NAME = 'INPUT';

const BYTE_CELL_BASE = 'inline-flex items-center justify-center w-8 h-[28px] rounded-[6px] text-[14px] font-medium cursor-crosshair transition-all duration-150 select-none active:scale-95';
const BYTE_CELL_SELECTED = 'bg-[#ececee] text-[#131316] font-semibold shadow-[0_2px_14px_rgba(255,255,255,0.14)]';
const BYTE_CELL_IDLE = 'text-[#c9ccd1] hover:bg-[#26282e] hover:text-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]';
const ASCII_CELL_BASE = 'inline-flex items-center justify-center w-[16px] h-[28px] text-[14px] rounded-[4px] cursor-crosshair transition-all duration-150 select-none';
const ASCII_CELL_SELECTED = 'bg-[#ececee] text-[#131316] font-semibold';
const ASCII_CELL_IDLE = 'text-zinc-500 hover:bg-[#26282e] hover:text-white';
const HOVERED_RULE_RING = 'ring-1 ring-white/40';
const SELECTED_RULE_RING = 'ring-1 ring-white/70';
const SEARCH_HIT_RING = 'ring-1 ring-[#c9b98a]/60';
const ACTIVE_SEARCH_CLASSES = 'bg-[#e9dfc3] text-[#1a1a1a] font-semibold';

function hexToAsciiChar(hexByte: string): string {
  const code = parseInt(hexByte, HEX_RADIX);
  const ok = code >= ASCII_PRINTABLE_MIN && code <= ASCII_PRINTABLE_MAX;
  return ok ? String.fromCharCode(code) : PLACEHOLDER_ASCII_CHAR;
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
    <div className="flex items-center px-2 py-[2px] rounded-md hover:bg-white/[0.03] transition-colors">
      <div className="w-14 shrink-0 text-zinc-600 font-mono text-[12px] select-none mr-4">{line.offsetLabel}</div>
      <div className="flex gap-[3px] shrink-0">
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
          } else if (isHit) stateClass = cn(BYTE_CELL_IDLE, SEARCH_HIT_RING, 'text-[#e9dfc3]');
          else stateClass = BYTE_CELL_IDLE;
          const title = rule
            ? `${formatHexAddress(byte.offset)} (${byte.offset}) | ${rule.name} [${rule.data_type}]`
            : `${formatHexAddress(byte.offset)} (${byte.offset})`;
          return (
            <span
              key={byte.offset}
              id={`${HEX_BYTE_DOM_ID_PREFIX}${byte.offset}`}
              onMouseDown={(e) => onByteMouseDown(byte.offset, e)}
              onMouseEnter={() => onByteMouseEnter(byte.offset)}
              title={title}
              className={cn(BYTE_CELL_BASE, stateClass, needsGap && 'ml-4')}
            >
              {byte.hex}
            </span>
          );
        })}
        {Array.from({ length: BYTES_PER_LINE - line.bytes.length }).map((_, i) => (
          <span key={`empty-${i}`} className="inline-block w-8 h-[28px]" />
        ))}
      </div>
      <div className="ml-4 pl-4 border-l border-white/[0.07] flex shrink-0">
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
              title={rule ? `${rule.name} [${rule.data_type}]` : formatHexAddress(byte.offset)}
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
        showCopyFeedback('Скопировано HEX');
      } catch {
        showCopyFeedback('Не удалось');
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
        showCopyFeedback('Скопировано ASCII');
      } catch {
        showCopyFeedback('Не удалось');
      }
    })();
  }, [bytes, selectionRange, showCopyFeedback]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.tagName === INPUT_TAG_NAME) return;
    if (bytes.length === 0) return;
    const isCtrl = event.ctrlKey || event.metaKey;
    const lowerKey = event.key.toLowerCase();
    if (isCtrl && lowerKey === 'a') {
      event.preventDefault();
      setSelectionStart(FIRST_BYTE_OFFSET);
      setSelectionEnd(bytes.length - CURSOR_MOVE_STEP);
      return;
    }
    if (isCtrl && lowerKey === 'c' && selectionRange) {
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
      <div className="flex items-center justify-center h-full text-zinc-500 bg-[#0e0f11] text-[13px] font-sans">
        Нет данных для отображения
      </div>
    );
  }

  const selectionLength = selectionRange
    ? selectionRange.end - selectionRange.start + INCLUSIVE_RANGE_ADJUSTMENT
    : 0;
  const isSearchValid = searchBytes !== null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0e0f11] text-zinc-200 font-sans">
      <div className="px-4 py-2.5 bg-[#15161a] border-b border-white/[0.07] flex items-center gap-3 shrink-0 flex-wrap">
        <div className="text-[13px] font-semibold tracking-wide text-zinc-100 whitespace-nowrap">Hex Viewer</div>
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => { if (e.key === KEY_ENTER) handleSearchNext(); }}
            placeholder="Поиск HEX: 01 02 FF"
            maxLength={SEARCH_INPUT_MAX_LENGTH}
            className="field w-48 font-mono text-[12px]"
          />
          {normalizedSearch.length > 0 && (
            <span className={cn('text-[11px] font-mono', isSearchValid ? 'text-zinc-300' : 'text-red-300')}>
              {isSearchValid
                ? searchOffsets.length > 0
                  ? `${(activeSearchIndex % searchOffsets.length) + 1}/${searchOffsets.length}`
                  : '0 совп.'
                : 'HEX?'}
            </span>
          )}
          <button type="button" onClick={handleSearchPrev} disabled={searchOffsets.length === 0} title="Предыдущее"
            className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"><ChevronUpIcon size={14} /></button>
          <button type="button" onClick={handleSearchNext} disabled={searchOffsets.length === 0} title="Следующее"
            className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"><ChevronDownIcon size={14} /></button>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} title="Очистить"
              className="btn-ghost"><XIcon size={13} /></button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[12px] text-zinc-500 font-mono whitespace-nowrap">
            {bytes.length} bytes · {rules.length} rules
          </div>
          <button type="button" onClick={() => setIsShortcutsOpen(true)} title="Горячие клавиши" className="btn-secondary h-7 w-7 p-0"><HelpIcon size={14} /></button>
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

      <div className="flex flex-1 min-h-0 mt-2">
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 p-4 overflow-y-auto font-mono select-none outline-none focus:ring-1 focus:ring-inset focus:ring-white/10"
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
            <div className="flex items-center gap-2 mt-3 px-2 font-sans">
              <button type="button" onClick={handleShowMore} className="btn-secondary">
                Показать ещё {Math.min(LINES_LOAD_MORE_STEP, hiddenLinesCount)} из {hiddenLinesCount}
              </button>
              <button type="button" onClick={handleShowAll} className="btn-ghost">
                Показать все ({lines.length})
              </button>
            </div>
          )}
        </div>
        <div className="w-14 shrink-0 border-l border-white/[0.07] bg-[#121316] p-2 flex flex-col min-h-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center mb-1.5 shrink-0">Карта</div>
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

      <div className="px-4 py-2.5 bg-[#15161a] border-t border-white/[0.07] font-mono text-[12px] shrink-0">
        {selectionRange ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-zinc-300 font-medium">
              {formatHexAddress(selectionRange.start)} – {formatHexAddress(selectionRange.end)}
              <span className="text-zinc-600"> · </span>
              <span className="text-zinc-100 font-semibold">{selectionLength} bytes</span>
            </span>
            {overlappingRules.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-200/90">
                <AlertIcon size={12} />{overlappingRules.map((r) => r.name).join(', ')}
              </span>
            )}
            <span className="text-zinc-600 truncate hidden lg:inline max-w-[300px]">{selectionPreview}</span>
            <span className="ml-auto flex items-center gap-1.5 font-sans">
              <button type="button" onClick={handleCopyHex} title="Копировать HEX" className="btn-secondary h-7 text-[12px]">HEX</button>
              <button type="button" onClick={handleCopyAscii} title="Копировать ASCII" className="btn-secondary h-7 text-[12px]">ASCII</button>
              {copyFeedback && <span className="text-emerald-200/90 text-[12px] font-mono">{copyFeedback}</span>}
            </span>
          </div>
        ) : (
          <div className="text-zinc-600 font-sans text-[12px]">
            Карта и энтропия сверху — клик выделяет · Стрелки — курсор · Ctrl+A — всё
          </div>
        )}
      </div>

      <ShortcutsModal open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
};