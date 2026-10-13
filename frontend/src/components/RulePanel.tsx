import {
  useState, useEffect, useMemo, useRef, useCallback,
  type FC, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  RulePanelProps, RuleDataType, RuleUpdatePatch, RuleAnchor, ByteRange, StructExportFormat,
} from '../types';
import {
  DATA_TYPE_OPTIONS, DEFAULT_RULE_DATA_TYPE,
  RULE_NAME_MAX_LENGTH, RULE_NAME_MIN_TRIMMED_LENGTH, RULE_NAME_PLACEHOLDER,
} from '../constants/rules';
import { ANCHOR_OPTIONS, DEFAULT_RULE_ANCHOR } from '../constants/anchor';
import {
  EMPTY_VALUE_PLACEHOLDER, extractHexBytesForRange,
  formatHexAddress, getRuleColor, getRuleValueForPayload, interpretHexBytes,
} from '../utils/hex';
import { parseImportedRulesJson, getPayloadByteLength } from '../utils/rules';
import {
  buildCoverageStats, generateCStruct, generatePythonParser, generateMarkdownTable,
} from '../utils/structure';
import { computeEndOffsetForRange, resolveRuleStart } from '../utils/anchor';
import { groupAndSortRules, parseRuleGroup } from '../utils/groups';
import { GROUP_UNGROUPED_LABEL } from '../constants/ux';
import { RuleInspector } from './RuleInspector';
import { RuleValidationTable } from './RuleValidationTable';
import { ValueDistribution } from './ValueDistribution';
import { GroupHeader } from './GroupHeader';
import { DataInspector } from './DataInspector';
import { cn } from '../utils/cn';

const INCLUSIVE_RANGE_ADJUSTMENT = 1;
const SELECTION_PREVIEW_MAX_BYTES = 24;
const HEX_PREVIEW_SEPARATOR = ' ';
const HEX_PREVIEW_SUFFIX = ' ...';
const IMPORT_FILE_ACCEPT = '.json';
const DISTRIBUTION_MAX_ENTRIES = 8;
const GAPS_MAX_VISIBLE = 20;
const STRUCT_COPY_FEEDBACK_TIMEOUT_MS = 2000;

interface ImportFeedback { imported: number; skipped: number; }

export const RulePanel: FC<RulePanelProps> = ({
  selectedRange, payloadHex, rules, hoveredRuleId, selectedRuleId,
  packets, selectedPacketId,
  onCreateRule, onDeleteRule, onDuplicateRule, onDeleteGroup, onHoverRule, onSelectRule,
  onUpdateRule, onResizeRule, onClearSelection, onSelectPacket, onRequestSelectRange,
  applyState, isBackendLive, onApplyRules, onExportRules, onImportRules,
}) => {
  const [draftName, setDraftName] = useState<string>('');
  const [draftType, setDraftType] = useState<RuleDataType>(DEFAULT_RULE_DATA_TYPE);
  const [draftAnchor, setDraftAnchor] = useState<RuleAnchor>(DEFAULT_RULE_ANCHOR);
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [structFeedback, setStructFeedback] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const importInputRef = useRef<HTMLInputElement>(null);
  const structTimeoutRef = useRef<number | null>(null);

  useEffect(() => { setDraftName(''); }, [selectedRange]);
  useEffect(() => { setImportFeedback(null); setImportError(null); }, [rules.length]);
  useEffect(() => {
    return () => {
      if (structTimeoutRef.current !== null) window.clearTimeout(structTimeoutRef.current);
    };
  }, []);

  const selectedRule = useMemo(
    () => rules.find((r) => r.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );

  const coverageStats = useMemo(() => buildCoverageStats(payloadHex, rules), [payloadHex, rules]);
  const visibleGaps = useMemo(() => coverageStats.gaps.slice(0, GAPS_MAX_VISIBLE), [coverageStats]);
  const hiddenGapsCount = coverageStats.gaps.length - visibleGaps.length;
  const selectedLength = useMemo(() => {
    if (!selectedRange) return 0;
    return selectedRange.end - selectedRange.start + INCLUSIVE_RANGE_ADJUSTMENT;
  }, [selectedRange]);
  const totalBytes = useMemo(() => getPayloadByteLength(payloadHex), [payloadHex]);
  const draftOffset: number = useMemo(() => {
    if (!selectedRange) return 0;
    if (draftAnchor === 'start') return selectedRange.start;
    return computeEndOffsetForRange(selectedRange.start, selectedLength, totalBytes);
  }, [selectedRange, draftAnchor, selectedLength, totalBytes]);
  const selectedHexBytes = useMemo(() => {
    if (!selectedRange) return [];
    return extractHexBytesForRange(payloadHex, selectedRange);
  }, [payloadHex, selectedRange]);
  const selectionPreviewText = useMemo(() => {
    const head = selectedHexBytes.slice(0, SELECTION_PREVIEW_MAX_BYTES);
    const text = head.join(HEX_PREVIEW_SEPARATOR);
    return selectedHexBytes.length > SELECTION_PREVIEW_MAX_BYTES ? `${text}${HEX_PREVIEW_SUFFIX}` : text;
  }, [selectedHexBytes]);
  const decodedPreview = useMemo(() => {
    if (!selectedRange) return EMPTY_VALUE_PLACEHOLDER;
    return interpretHexBytes(selectedHexBytes, draftType);
  }, [selectedHexBytes, draftType, selectedRange]);
  const activeTypeOption = useMemo(() => {
    return DATA_TYPE_OPTIONS.find((o) => o.value === draftType) ?? DATA_TYPE_OPTIONS[0]!;
  }, [draftType]);
  const isLengthMismatch = useMemo(() => {
    if (activeTypeOption.expectedLength === null) return false;
    return selectedLength !== activeTypeOption.expectedLength;
  }, [activeTypeOption, selectedLength]);
  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.offset - b.offset), [rules]);
  const groupedSections = useMemo(() => groupAndSortRules(rules), [rules]);

  const toggleGroup = useCallback((groupName: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const trimmedName = draftName.trim();
  const canSubmit = selectedRange !== null && trimmedName.length >= RULE_NAME_MIN_TRIMMED_LENGTH;
  const hasPayload = payloadHex !== '';
  const canApply = isBackendLive && rules.length > 0 && applyState.status !== 'loading';
  const isApplying = applyState.status === 'loading';

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!canSubmit || !selectedRange) return;
    onCreateRule({ name: trimmedName, data_type: draftType, offset: draftOffset, length: selectedLength, anchor: draftAnchor });
    setDraftName('');
  };

  const handleDeleteClick = (e: ReactMouseEvent<HTMLButtonElement>, ruleId: string): void => {
    e.stopPropagation();
    onDeleteRule(ruleId);
  };

  const handleDuplicateClick = (e: ReactMouseEvent<HTMLButtonElement>, ruleId: string): void => {
    e.stopPropagation();
    onDuplicateRule(ruleId);
  };

  const showStructFeedback = useCallback((message: string): void => {
    setStructFeedback(message);
    if (structTimeoutRef.current !== null) window.clearTimeout(structTimeoutRef.current);
    structTimeoutRef.current = window.setTimeout(() => setStructFeedback(null), STRUCT_COPY_FEEDBACK_TIMEOUT_MS);
  }, []);

  const handleCopyStruct = useCallback((format: StructExportFormat): void => {
    if (rules.length === 0) return;
    let text: string;
    if (format === 'c') text = generateCStruct(rules);
    else if (format === 'python') text = generatePythonParser(rules);
    else text = generateMarkdownTable(rules);
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        showStructFeedback(`Скопировано: ${format.toUpperCase()}`);
      } catch {
        showStructFeedback('Не удалось скопировать');
      }
    })();
  }, [rules, showStructFeedback]);

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportFeedback(null);
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const parsed = parseImportedRulesJson(json);
      if (parsed.drafts.length === 0) {
        setImportError(`Валидных правил не найдено. Пропущено: ${parsed.skipped}`);
        return;
      }
      onImportRules(parsed.drafts);
      setImportFeedback({ imported: parsed.drafts.length, skipped: parsed.skipped });
    } catch {
      setImportError('Не удалось прочитать файл.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="font-semibold text-slate-100 text-sm tracking-wide">
          {selectedRule ? 'Инспектор правила' : 'Конструктор правил'}
        </div>
        <div className="text-xs font-mono text-slate-500">{rules.length} шт.</div>
      </div>

      <div className="p-4 border-b border-slate-800 shrink-0 max-h-[52%] overflow-y-auto">
        {selectedRule ? (
          <div className="space-y-3">
            <button type="button" onClick={() => onSelectRule(null)} className="text-[11px] text-slate-500 hover:text-slate-200 cursor-pointer">← К созданию правила</button>
            <RuleInspector
              rule={selectedRule}
              payloadHex={payloadHex}
              selectedRange={selectedRange}
              onUpdate={(patch: RuleUpdatePatch) => onUpdateRule(selectedRule.id, patch)}
              onResize={(range: ByteRange) => onResizeRule(selectedRule.id, range)}
              onClose={() => onSelectRule(null)}
              onDelete={() => onDeleteRule(selectedRule.id)}
              onDuplicate={() => onDuplicateRule(selectedRule.id)}
            />
            <RuleValidationTable rule={selectedRule} packets={packets} selectedPacketId={selectedPacketId} onSelectPacket={onSelectPacket} />
            <ValueDistribution rule={selectedRule} packets={packets} selectedPacketId={selectedPacketId} maxEntries={DISTRIBUTION_MAX_ENTRIES} onSelectPacket={onSelectPacket} />
          </div>
        ) : !hasPayload ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center">
            <div className="text-slate-500 text-sm mb-1">Пакет не выбран</div>
            <div className="text-slate-600 text-xs">Кликните пакет слева, затем выделите байты</div>
          </div>
        ) : selectedRange ? (
          <div className="space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs text-slate-400">Выделение</div>
                  <button type="button" onClick={onClearSelection} className="text-[11px] text-slate-500 hover:text-slate-200 cursor-pointer">✕ сбросить</button>
                </div>
                <div className="font-mono text-xs text-blue-300">
                  {formatHexAddress(selectedRange.start)} – {formatHexAddress(selectedRange.end)}
                  <span className="text-slate-500"> • </span>
                  <span className="text-emerald-300">{selectedLength} bytes</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 truncate mt-1">{selectionPreviewText}</div>
              </div>
              <div>
                <label htmlFor="rule-name" className="block text-xs font-medium text-slate-400 mb-1.5">Название поля <span className="text-rose-400">*</span></label>
                <input id="rule-name" type="text" value={draftName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftName(e.target.value)}
                  placeholder={RULE_NAME_PLACEHOLDER} maxLength={RULE_NAME_MAX_LENGTH} autoComplete="off"
                  className="w-full px-3 py-2 text-sm rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label htmlFor="rule-type" className="block text-xs font-medium text-slate-400 mb-1.5">Тип данных</label>
                <select id="rule-type" value={draftType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setDraftType(e.target.value as RuleDataType)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-blue-500 cursor-pointer">
                  {DATA_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="block text-xs font-medium text-slate-400 mb-1.5">Привязка</div>
                <div className="flex rounded-md overflow-hidden border border-slate-700">
                  {ANCHOR_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setDraftAnchor(opt.value)} title={opt.hint}
                      className={cn('flex-1 py-1.5 text-xs font-medium cursor-pointer',
                        draftAnchor === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">
                  {draftAnchor === 'start' ? `offset ${formatHexAddress(draftOffset)}` : `end-${formatHexAddress(draftOffset)} (eff ${selectedRange ? formatHexAddress(selectedRange.start) : '—'})`}
                </div>
              </div>
              <div className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2">
                <div className="text-[11px] text-slate-500 mb-0.5">Значение в текущем пакете:</div>
                <div className="font-mono text-sm text-slate-100 break-all">{decodedPreview}</div>
              </div>
              {isLengthMismatch && (
                <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5">
                  ⚠ {activeTypeOption.label} ожидает {activeTypeOption.expectedLength} байт, выбрано {selectedLength}.
                </div>
              )}
              <button type="submit" disabled={!canSubmit}
                className={cn('w-full py-2 rounded-md text-sm font-semibold transition-colors',
                  canSubmit ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' : 'bg-slate-800 text-slate-600 cursor-not-allowed')}>
                + Создать правило
              </button>
            </form>
            <DataInspector
              selectedRange={selectedRange}
              payloadHex={payloadHex}
              rules={rules}
              draftName={trimmedName}
              draftAnchor={draftAnchor}
              draftOffset={draftOffset}
              selectedLength={selectedLength}
              activeType={draftType}
              onPickType={setDraftType}
              onCreateRule={onCreateRule}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center">
            <div className="text-slate-500 text-sm mb-1">Нет выделения</div>
            <div className="text-slate-600 text-xs">Зажмите ЛКМ в HexViewer или кликните гэп ниже</div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Покрытие</div>
          <div className="text-[11px] font-mono text-slate-500">
            <span className="text-emerald-300">{coverageStats.coveragePercent}%</span> • {coverageStats.coveredBytes}/{coverageStats.totalBytes}
          </div>
        </div>
        <div className="h-2 rounded bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${coverageStats.coveragePercent}%` }} />
        </div>
        {coverageStats.gaps.length === 0 ? (
          <div className="mt-1.5 text-[11px] text-emerald-300">✓ Полное покрытие пакета</div>
        ) : (
          <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
            {visibleGaps.map((gap) => (
              <button key={`${gap.start}-${gap.end}`} type="button" title="Выделить гэп"
                onClick={() => onRequestSelectRange({ start: gap.start, end: gap.end })}
                className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-400 hover:text-amber-200 cursor-pointer">
                <span>{formatHexAddress(gap.start)} +{gap.length}</span>
                <span>выделить →</span>
              </button>
            ))}
            {hiddenGapsCount > 0 && <div className="text-[11px] text-slate-600">... ещё {hiddenGapsCount}</div>}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Проверка</div>
        <button type="button" onClick={onApplyRules} disabled={!canApply}
          className={cn('w-full py-2 rounded-md text-sm font-medium border transition-colors',
            canApply ? 'bg-emerald-600/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-600/25 cursor-pointer'
              : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed')}>
          {isApplying ? 'Проверка...' : `⚙ Проверить ${rules.length} правил на бэкенде`}
        </button>
        {applyState.status === 'success' && (
          <div className="mt-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
            ✓ Совпало пакетов: <span className="font-mono font-semibold">{applyState.matchedPackets ?? 0}</span>
          </div>
        )}
        {applyState.status === 'error' && (
          <div className="mt-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
            ✕ {applyState.message ?? 'Ошибка проверки'}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Правила ({sortedRules.length})</div>
        {groupedSections.length === 0 ? (
          <div className="text-xs text-slate-600">Правил пока нет. Имя "Header: Magic" создаст группу.</div>
        ) : groupedSections.map((section) => {
          const isUngrouped = section.groupName === null;
          const groupKey = section.groupName ?? '__ungrouped__';
          const isCollapsed = !isUngrouped && collapsedGroups.has(section.groupName as string);
          return (
            <div key={groupKey} className="space-y-2">
              {isUngrouped ? (
                <div className="text-xs text-slate-500">{GROUP_UNGROUPED_LABEL} ({section.rules.length})</div>
              ) : (
                <GroupHeader
                  groupName={section.groupName as string}
                  count={section.rules.length}
                  isCollapsed={isCollapsed}
                  groupRules={section.rules}
                  onToggle={() => toggleGroup(section.groupName as string)}
                  onDeleteGroup={onDeleteGroup}
                />
              )}
              {(!isCollapsed) && section.rules.map((rule) => {
                const theme = getRuleColor(rule.colorIndex);
                const isHovered = rule.id === hoveredRuleId;
                const isSel = rule.id === selectedRuleId;
                const value = getRuleValueForPayload(payloadHex, rule);
                const effective = resolveRuleStart(rule, totalBytes);
                const { shortName } = parseRuleGroup(rule.name);
                const displayName = isUngrouped ? rule.name : shortName;
                return (
                  <div key={rule.id}
                    onMouseEnter={() => onHoverRule(rule.id)}
                    onMouseLeave={() => onHoverRule(null)}
                    onClick={() => onSelectRule(isSel ? null : rule.id)}
                    title={rule.name}
                    className={cn('group rounded-lg border p-2.5 transition-colors cursor-pointer',
                      isSel ? 'border-blue-500/60 bg-blue-500/10'
                        : isHovered ? 'border-slate-600 bg-slate-800'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-700')}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', theme.dotBackground)} />
                      <span className="text-sm text-slate-100 font-medium truncate flex-1">{displayName}</span>
                      <button type="button" onClick={(e) => handleDuplicateClick(e, rule.id)} title="Дублировать"
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 text-xs cursor-pointer">📋</button>
                      <button type="button" onClick={(e) => handleDeleteClick(e, rule.id)} title="Удалить"
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs cursor-pointer">✕</button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-mono text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
                        {rule.anchor === 'start' ? formatHexAddress(rule.offset) : `end-${formatHexAddress(rule.offset)}`} +{rule.length}
                      </span>
                      <span className={cn('font-mono text-[11px] rounded px-1.5 py-0.5 border text-slate-300', theme.chipBackground, theme.chipBorder)}>
                        {rule.data_type}
                      </span>
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-slate-500 truncate">
                      val: <span className="text-slate-300">{value}</span>
                      {rule.anchor === 'end' && (
                        <span className="text-slate-600"> • eff {effective !== null ? formatHexAddress(effective) : '—'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={onExportRules} disabled={rules.length === 0}
            className={cn('flex-1 py-1.5 rounded-md text-xs font-medium border',
              rules.length > 0 ? 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500 cursor-pointer'
                : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed')}>⬇ JSON</button>
          <button type="button" onClick={() => importInputRef.current?.click()}
            className="flex-1 py-1.5 rounded-md text-xs font-medium border bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500 cursor-pointer">⬆ Импорт</button>
          <input ref={importInputRef} type="file" accept={IMPORT_FILE_ACCEPT} onChange={handleImportFileChange} className="hidden" />
        </div>
        <div>
          <div className="text-[10px] text-slate-600 mb-1">Экспорт структуры:</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleCopyStruct('c')} disabled={rules.length === 0} className="flex-1 py-1.5 rounded-md text-xs font-mono border bg-slate-800 text-slate-200 border-slate-700 hover:border-emerald-500 disabled:opacity-40 cursor-pointer">C</button>
            <button type="button" onClick={() => handleCopyStruct('python')} disabled={rules.length === 0} className="flex-1 py-1.5 rounded-md text-xs font-mono border bg-slate-800 text-slate-200 border-slate-700 hover:border-emerald-500 disabled:opacity-40 cursor-pointer">PY</button>
            <button type="button" onClick={() => handleCopyStruct('markdown')} disabled={rules.length === 0} className="flex-1 py-1.5 rounded-md text-xs font-mono border bg-slate-800 text-slate-200 border-slate-700 hover:border-emerald-500 disabled:opacity-40 cursor-pointer">MD</button>
          </div>
          {structFeedback && <div className="mt-1 text-[11px] text-emerald-300">{structFeedback}</div>}
        </div>
        {importFeedback && (
          <div className="text-[11px] text-emerald-300">
            Импортировано: {importFeedback.imported}, пропущено: {importFeedback.skipped}
          </div>
        )}
        {importError && <div className="text-[11px] text-rose-300">{importError}</div>}
      </div>
    </div>
  );
};