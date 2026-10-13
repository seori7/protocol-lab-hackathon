import { useState, useEffect, useMemo, useRef, useCallback, type FC, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { RulePanelProps, RuleDataType, RuleUpdatePatch, RuleAnchor, ByteRange, StructExportFormat } from '../types';
import { DATA_TYPE_OPTIONS, DEFAULT_RULE_DATA_TYPE, RULE_NAME_MAX_LENGTH, RULE_NAME_MIN_TRIMMED_LENGTH, RULE_NAME_PLACEHOLDER } from '../constants/rules';
import { ANCHOR_OPTIONS, DEFAULT_RULE_ANCHOR } from '../constants/anchor';
import { EMPTY_VALUE_PLACEHOLDER, extractHexBytesForRange, formatHexAddress, getRuleColor, getRuleValueForPayload, interpretHexBytes } from '../utils/hex';
import { parseImportedRulesJson, getPayloadByteLength } from '../utils/rules';
import { buildCoverageStats, generateCStruct, generatePythonParser, generateMarkdownTable } from '../utils/structure';
import { computeEndOffsetForRange, resolveRuleStart } from '../utils/anchor';
import { groupAndSortRules, parseRuleGroup } from '../utils/groups';
import { GROUP_UNGROUPED_LABEL } from '../constants/ux';
import { RuleInspector } from './RuleInspector';
import { RuleValidationTable } from './RuleValidationTable';
import { ValueDistribution } from './ValueDistribution';
import { GroupHeader } from './GroupHeader';
import { DataInspector } from './DataInspector';
import { XIcon, ChevronLeftIcon, AlertIcon, CheckIcon, CopyIcon, DownloadIcon, UploadIcon, PlayIcon, ArrowRightIcon } from './icons';
import { cn } from '../utils/cn';
const ADJ = 1; const PREV_MAX = 24; const IMP_ACCEPT = '.json'; const DIST_MAX = 8; const GAPS_MAX = 20; const STRUCT_T = 2000;
interface ImpFb { imported: number; skipped: number; }
export const RulePanel: FC<RulePanelProps> = ({ selectedRange, payloadHex, rules, hoveredRuleId, selectedRuleId, packets, selectedPacketId, onCreateRule, onDeleteRule, onDuplicateRule, onDeleteGroup, onHoverRule, onSelectRule, onUpdateRule, onResizeRule, onClearSelection, onSelectPacket, onRequestSelectRange, applyState, isBackendLive, onApplyRules, onExportRules, onImportRules }) => {
const [dName, setDName] = useState(''); const [dType, setDType] = useState<RuleDataType>(DEFAULT_RULE_DATA_TYPE);
const [dAnchor, setDAnchor] = useState<RuleAnchor>(DEFAULT_RULE_ANCHOR);
const [impFb, setImpFb] = useState<ImpFb | null>(null); const [impErr, setImpErr] = useState<string | null>(null);
const [stFb, setStFb] = useState<string | null>(null); const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
const impRef = useRef<HTMLInputElement>(null); const stRef = useRef<number | null>(null);
useEffect(() => { setDName(''); }, [selectedRange]);
useEffect(() => { setImpFb(null); setImpErr(null); }, [rules.length]);
useEffect(() => () => { if (stRef.current !== null) window.clearTimeout(stRef.current); }, []);
const selRule = useMemo(() => rules.find((r) => r.id === selectedRuleId) ?? null, [rules, selectedRuleId]);
const cov = useMemo(() => buildCoverageStats(payloadHex, rules), [payloadHex, rules]);
const visGaps = useMemo(() => cov.gaps.slice(0, GAPS_MAX), [cov]); const hidGaps = cov.gaps.length - visGaps.length;
const selLen = useMemo(() => !selectedRange ? 0 : selectedRange.end - selectedRange.start + ADJ, [selectedRange]);
const total = useMemo(() => getPayloadByteLength(payloadHex), [payloadHex]);
const dOff: number = useMemo(() => { if (!selectedRange) return 0; return dAnchor === 'start' ? selectedRange.start : computeEndOffsetForRange(selectedRange.start, selLen, total); }, [selectedRange, dAnchor, selLen, total]);
const selHex = useMemo(() => !selectedRange ? [] : extractHexBytesForRange(payloadHex, selectedRange), [payloadHex, selectedRange]);
const selPrev = useMemo(() => { const h = selHex.slice(0, PREV_MAX).join(' '); return selHex.length > PREV_MAX ? `${h} ...` : h; }, [selHex]);
const decoded = useMemo(() => !selectedRange ? EMPTY_VALUE_PLACEHOLDER : interpretHexBytes(selHex, dType), [selHex, dType, selectedRange]);
const actOpt = useMemo(() => DATA_TYPE_OPTIONS.find((o) => o.value === dType) ?? DATA_TYPE_OPTIONS[0]!, [dType]);
const mismatch = useMemo(() => actOpt.expectedLength !== null && selLen !== actOpt.expectedLength, [actOpt, selLen]);
const sorted = useMemo(() => [...rules].sort((a, b) => a.offset - b.offset), [rules]);
const grouped = useMemo(() => groupAndSortRules(rules), [rules]);
const toggle = useCallback((g: string): void => { setCollapsed((p) => { const n = new Set(p); if (n.has(g)) n.delete(g); else n.add(g); return n; }); }, []);
const trim = dName.trim(); const canSubmit = selectedRange !== null && trim.length >= RULE_NAME_MIN_TRIMMED_LENGTH;
const hasPayload = payloadHex !== ''; const canApply = isBackendLive && rules.length > 0 && applyState.status !== 'loading';
const submit = (e: FormEvent<HTMLFormElement>): void => { e.preventDefault(); if (!canSubmit || !selectedRange) return;
onCreateRule({ name: trim, data_type: dType, offset: dOff, length: selLen, anchor: dAnchor }); setDName(''); };
const copyStruct = useCallback((f: StructExportFormat): void => { if (!rules.length) return;
const t = f === 'c' ? generateCStruct(rules) : f === 'python' ? generatePythonParser(rules) : generateMarkdownTable(rules);
void (async () => { try { await navigator.clipboard.writeText(t); setStFb(`Скопировано: ${f.toUpperCase()}`); } catch { setStFb('Не удалось'); }
if (stRef.current !== null) window.clearTimeout(stRef.current); stRef.current = window.setTimeout(() => setStFb(null), STRUCT_T); })(); }, [rules]);
const onImpFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
setImpErr(null); setImpFb(null); try { const p = parseImportedRulesJson(JSON.parse(await f.text()) as unknown);
if (!p.drafts.length) { setImpErr(`Валидных нет, пропущено: ${p.skipped}`); return; } onImportRules(p.drafts); setImpFb({ imported: p.drafts.length, skipped: p.skipped }); }
catch { setImpErr('Не удалось прочитать файл.'); } };
return (
<div className="flex flex-col h-full min-h-0 bg-[#15161a] font-sans">
<div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
<div className="text-[13px] font-semibold tracking-wide text-zinc-100">{selRule ? 'Инспектор правила' : 'Конструктор правил'}</div>
<div className="text-[12px] font-mono text-zinc-500">{rules.length} шт.</div>
</div>
<div className="p-4 border-b border-white/[0.07] shrink-0 max-h-[52%] overflow-y-auto">
{selRule ? (
<div className="space-y-3">
<button type="button" onClick={() => onSelectRule(null)} className="btn-ghost !text-[11px]"><ChevronLeftIcon size={12} />К созданию правила</button>
<RuleInspector rule={selRule} payloadHex={payloadHex} selectedRange={selectedRange}
onUpdate={(p: RuleUpdatePatch) => onUpdateRule(selRule.id, p)} onResize={(rg: ByteRange) => onResizeRule(selRule.id, rg)}
onClose={() => onSelectRule(null)} onDelete={() => onDeleteRule(selRule.id)} onDuplicate={() => onDuplicateRule(selRule.id)} />
<RuleValidationTable rule={selRule} packets={packets} selectedPacketId={selectedPacketId} onSelectPacket={onSelectPacket} />
<ValueDistribution rule={selRule} packets={packets} selectedPacketId={selectedPacketId} maxEntries={DIST_MAX} onSelectPacket={onSelectPacket} />
</div>
) : !hasPayload ? (
<div className="rounded-lg border border-dashed border-white/10 p-4 text-center"><div className="text-zinc-400 text-[13px] mb-1">Пакет не выбран</div><div className="text-zinc-600 text-[12px]">Кликните пакет слева, затем выделите байты</div></div>
) : selectedRange ? (
<div className="space-y-3">
<form onSubmit={submit} className="space-y-3">
<div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
<div className="flex items-center justify-between mb-1.5"><div className="ui-label">Выделение</div>
<button type="button" onClick={onClearSelection} className="btn-ghost !h-6 !text-[11px]"><XIcon size={11} />Сбросить</button></div>
<div className="font-mono text-[12px] text-zinc-100">{formatHexAddress(selectedRange.start)} – {formatHexAddress(selectedRange.end)} <span className="text-zinc-600">·</span> <span className="font-semibold">{selLen} bytes</span></div>
<div className="font-mono text-[11px] text-zinc-500 truncate mt-1">{selPrev}</div>
</div>
<div><label htmlFor="rule-name" className="ui-label block mb-1.5">Название поля</label>
<input id="rule-name" type="text" value={dName} onChange={(e: ChangeEvent<HTMLInputElement>) => setDName(e.target.value)} placeholder={RULE_NAME_PLACEHOLDER} maxLength={RULE_NAME_MAX_LENGTH} autoComplete="off" className="field" /></div>
<div><label htmlFor="rule-type" className="ui-label block mb-1.5">Тип данных</label>
<select id="rule-type" value={dType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setDType(e.target.value as RuleDataType)} className="field cursor-pointer">
{DATA_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
</select></div>
<div><div className="ui-label block mb-1.5">Привязка</div>
<div className="flex rounded-md overflow-hidden border border-white/[0.08]">
{ANCHOR_OPTIONS.map((o) => <button key={o.value} type="button" onClick={() => setDAnchor(o.value)} title={o.hint}
className={cn('flex-1 h-8 text-[12px] font-medium transition-all cursor-pointer', dAnchor === o.value ? 'bg-[#f4f4f5] text-[#18181b] font-semibold' : 'bg-[#1a1c20] text-zinc-400 hover:text-white')}>{o.label}</button>)}
</div>
<div className="mt-1 font-mono text-[11px] text-zinc-500">{dAnchor === 'start' ? `offset ${formatHexAddress(dOff)}` : `end-${formatHexAddress(dOff)} (eff ${formatHexAddress(selectedRange.start)})`}</div>
</div>
<div className="rounded-md bg-[#0e0f11] border border-white/[0.07] px-3 py-2">
<div className="text-[11px] text-zinc-500 mb-0.5">Значение в текущем пакете</div>
<div className="font-mono text-[13px] text-zinc-100 break-all">{decoded}</div>
</div>
{mismatch && <div className="text-[11px] text-amber-200/90 bg-amber-200/[0.07] border border-amber-200/20 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5"><AlertIcon size={12} />{actOpt.label} ожидает {actOpt.expectedLength}, выбрано {selLen}.</div>}
<button type="submit" disabled={!canSubmit} className={canSubmit ? 'btn-primary w-full' : 'btn-secondary w-full opacity-40 pointer-events-none'}>Создать правило</button>
</form>
<DataInspector selectedRange={selectedRange} payloadHex={payloadHex} rules={rules} draftName={trim} draftAnchor={dAnchor} draftOffset={dOff} selectedLength={selLen} activeType={dType} onPickType={setDType} onCreateRule={onCreateRule} />
</div>
) : (
<div className="rounded-lg border border-dashed border-white/10 p-4 text-center"><div className="text-zinc-400 text-[13px] mb-1">Нет выделения</div><div className="text-zinc-600 text-[12px]">Выделите байты в Hex Viewer или кликните гэп ниже</div></div>
)}
</div>
<div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
<div className="flex items-center justify-between mb-1.5"><div className="ui-label">Покрытие</div>
<div className="text-[11px] font-mono text-zinc-500"><span className="text-zinc-100 font-medium">{cov.coveragePercent}%</span> · {cov.coveredBytes}/{cov.totalBytes}</div></div>
<div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-[#c9ccd1] rounded-full transition-all duration-300" style={{ width: `${cov.coveragePercent}%` }} /></div>
{cov.gaps.length === 0 ? <div className="mt-1.5 text-[11px] text-emerald-200/90 inline-flex items-center gap-1.5"><CheckIcon size={12} />Полное покрытие</div>
: <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
{visGaps.map((g) => <button key={`${g.start}-${g.end}`} type="button" onClick={() => onRequestSelectRange({ start: g.start, end: g.end })}
className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-mono bg-[#1a1c20] border border-white/[0.07] text-zinc-400 hover:text-white hover:border-white/20 hover:-translate-y-px transition-all cursor-pointer">
<span>{formatHexAddress(g.start)} +{g.length}</span><span className="inline-flex items-center gap-1">Выделить<ArrowRightIcon size={11} /></span></button>)}
{hidGaps > 0 && <div className="text-[11px] text-zinc-600">… ещё {hidGaps}</div>}
</div>}
</div>
<div className="px-4 py-3 border-b border-white/[0.07] shrink-0">
<div className="ui-label mb-2">Проверка</div>
<button type="button" onClick={onApplyRules} disabled={!canApply} className={cn('w-full', canApply ? 'btn-secondary' : 'btn-secondary opacity-40 pointer-events-none')}>
{applyState.status === 'loading' ? 'Проверка…' : <><PlayIcon size={13} />Проверить {rules.length} правил</>}</button>
{applyState.status === 'success' && <div className="mt-2 text-[12px] text-zinc-200 bg-white/[0.05] border border-white/10 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5"><CheckIcon size={13} />Совпало: <span className="font-mono font-semibold">{applyState.matchedPackets ?? 0}/{applyState.totalChecked ?? 0}</span></div>}
{applyState.status === 'error' && <div className="mt-2 text-[12px] text-red-200/90 bg-red-400/[0.07] border border-red-400/20 rounded-md px-2.5 py-1.5">{applyState.message ?? 'Ошибка'}</div>}
{applyState.skippedEndRules > 0 && <div className="mt-1.5 text-[11px] text-zinc-500">Пропущено end-правил: {applyState.skippedEndRules}</div>}
</div>
<div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
<div className="ui-label">Правила ({sorted.length})</div>
{!grouped.length ? <div className="text-[12px] text-zinc-600">Правил пока нет. Имя вида «Header: Magic» создаст группу.</div>
: grouped.map((sec) => { const un = sec.groupName === null; const key = sec.groupName ?? '__ungrouped__'; const col = !un && collapsed.has(sec.groupName as string); return (
<div key={key} className="space-y-2">
{un ? <div className="text-[12px] text-zinc-500">{GROUP_UNGROUPED_LABEL} ({sec.rules.length})</div>
: <GroupHeader groupName={sec.groupName as string} count={sec.rules.length} isCollapsed={col} groupRules={sec.rules} onToggle={() => toggle(sec.groupName as string)} onDeleteGroup={onDeleteGroup} />}
{!col && sec.rules.map((r) => { const th = getRuleColor(r.colorIndex); const hov = r.id === hoveredRuleId; const sl = r.id === selectedRuleId;
const v = getRuleValueForPayload(payloadHex, r); const ef = resolveRuleStart(r, total); const { shortName } = parseRuleGroup(r.name);
return (
<div key={r.id} onMouseEnter={() => onHoverRule(r.id)} onMouseLeave={() => onHoverRule(null)} onClick={() => onSelectRule(sl ? null : r.id)} title={r.name}
className={cn('group rounded-lg border p-2.5 transition-all duration-150 cursor-pointer hover:-translate-y-px',
sl ? 'border-white/25 bg-white/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.4)]' : hov ? 'border-white/[0.14] bg-[#202228]' : 'border-white/[0.07] bg-[#1a1c20] hover:border-white/[0.14]')}>
<div className="flex items-center gap-2">
<span className={cn('w-2 h-2 rounded-full shrink-0', th.dotBackground)} />
<span className="text-[13px] text-zinc-100 font-medium truncate flex-1">{un ? r.name : shortName}</span>
<button type="button" onClick={(e: ReactMouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onDuplicateRule(r.id); }} title="Дублировать" className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-all cursor-pointer"><CopyIcon size={13} /></button>
<button type="button" onClick={(e: ReactMouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onDeleteRule(r.id); }} title="Удалить" className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-300 transition-all cursor-pointer"><XIcon size={13} /></button>
</div>
<div className="flex items-center gap-1.5 mt-1.5">
<span className="chip !text-[11px] text-zinc-300 bg-[#0e0f11] border-white/[0.07]">{r.anchor === 'start' ? formatHexAddress(r.offset) : `end-${formatHexAddress(r.offset)}`} +{r.length}</span>
<span className={cn('chip !text-[11px]', th.chipBackground, th.chipBorder, 'text-zinc-200')}>{r.data_type}</span>
</div>
<div className="mt-1.5 font-mono text-[12px] text-zinc-500 truncate">val: <span className="text-zinc-200">{v}</span>
{r.anchor === 'end' && <span className="text-zinc-600"> · eff {ef !== null ? formatHexAddress(ef) : '—'}</span>}</div>
</div>
); })}
</div>
); })}
</div>
<div className="p-3 border-t border-white/[0.07] shrink-0 space-y-2 bg-[#15161a]">
<div className="flex gap-2">
<button type="button" onClick={onExportRules} disabled={!rules.length} className="btn-secondary flex-1 disabled:opacity-40"><DownloadIcon size={13} />JSON</button>
<button type="button" onClick={() => impRef.current?.click()} className="btn-secondary flex-1"><UploadIcon size={13} />Импорт</button>
<input ref={impRef} type="file" accept={IMP_ACCEPT} onChange={onImpFile} className="hidden" />
</div>
<div><div className="text-[10px] text-zinc-600 mb-1">Экспорт структуры</div>
<div className="flex gap-2">
<button type="button" onClick={() => copyStruct('c')} disabled={!rules.length} className="btn-secondary flex-1 !font-mono disabled:opacity-40">C</button>
<button type="button" onClick={() => copyStruct('python')} disabled={!rules.length} className="btn-secondary flex-1 !font-mono disabled:opacity-40">PY</button>
<button type="button" onClick={() => copyStruct('markdown')} disabled={!rules.length} className="btn-secondary flex-1 !font-mono disabled:opacity-40">MD</button>
</div>
{stFb && <div className="mt-1 text-[11px] text-zinc-300">{stFb}</div>}</div>
{impFb && <div className="text-[11px] text-zinc-300">Импортировано: {impFb.imported}, пропущено: {impFb.skipped}</div>}
{impErr && <div className="text-[11px] text-red-300">{impErr}</div>}
</div>
</div>
);
};