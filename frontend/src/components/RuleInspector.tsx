import { useState, useEffect, type FC, type ChangeEvent, type KeyboardEvent } from 'react';
import type { RuleInspectorProps, RuleDataType, RuleAnchor } from '../types';
import { DATA_TYPE_OPTIONS, RULE_NAME_MAX_LENGTH, RULE_NAME_MIN_TRIMMED_LENGTH } from '../constants/rules';
import { ANCHOR_OPTIONS } from '../constants/anchor';
import { formatHexAddress, getRuleColor, getRuleValueForPayload } from '../utils/hex';
import { getPayloadByteLength } from '../utils/rules';
import { resolveRuleStart, computeEndOffsetForRange, convertAnchorOffset } from '../utils/anchor';
import { cn } from '../utils/cn';

const INCLUSIVE_RANGE_ADJUSTMENT = 1;
const ENTER_KEY = 'Enter';

export const RuleInspector: FC<RuleInspectorProps> = ({
  rule, payloadHex, selectedRange, onUpdate, onResize, onClose, onDelete, onDuplicate,
}) => {
  const theme = getRuleColor(rule.colorIndex);
  const [editName, setEditName] = useState<string>(rule.name);

  useEffect(() => { setEditName(rule.name); }, [rule.id, rule.name]);

  const totalBytes = getPayloadByteLength(payloadHex);
  const effective = resolveRuleStart(rule, totalBytes);
  const valuePreview = getRuleValueForPayload(payloadHex, rule);

  const selectedLength = selectedRange
    ? selectedRange.end - selectedRange.start + INCLUSIVE_RANGE_ADJUSTMENT
    : 0;

  const isSameRange =
    selectedRange !== null &&
    (rule.anchor === "start"
      ? selectedRange.start === rule.offset && selectedLength === rule.length
      : computeEndOffsetForRange(selectedRange.start, selectedLength, totalBytes) === rule.offset &&
        selectedLength === rule.length);

  const canSwitchAnchor = effective !== null;

  const handleAnchorChange = (newAnchor: RuleAnchor): void => {
    if (newAnchor === rule.anchor) return;
    const conv = convertAnchorOffset(rule.offset, rule.anchor, newAnchor, rule.length, totalBytes);
    if (conv === null) return;
    onUpdate({ anchor: newAnchor, offset: conv });
  };

  const commitName = (): void => {
    const trimmed = editName.trim();
    if (trimmed.length < RULE_NAME_MIN_TRIMMED_LENGTH || trimmed === rule.name) {
      setEditName(rule.name);
      return;
    }
    onUpdate({ name: trimmed });
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === ENTER_KEY) (e.target as HTMLInputElement).blur();
  };

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onUpdate({ data_type: e.target.value as RuleDataType });
  };

  const resizePreview = selectedRange
    ? rule.anchor === "start"
      ? `${formatHexAddress(selectedRange.start)} +${selectedLength}`
      : `end-${formatHexAddress(computeEndOffsetForRange(selectedRange.start, selectedLength, totalBytes))} +${selectedLength}`
    : '';

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', theme.dotBackground)} />
        <span className="font-mono text-[11px] text-slate-400">
          {rule.anchor === "start" ? formatHexAddress(rule.offset) : `end-${formatHexAddress(rule.offset)}`} +{rule.length}
        </span>
        <button type="button" onClick={onClose} title="Закрыть" className="ml-auto text-slate-500 hover:text-white text-xs cursor-pointer">✕</button>
      </div>

      <div className="flex rounded-md overflow-hidden border border-slate-700">
        {ANCHOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleAnchorChange(opt.value)}
            disabled={!canSwitchAnchor}
            title={canSwitchAnchor ? opt.hint : 'Не помещается в текущий пакет'}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium',
              rule.anchor === opt.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white',
              !canSwitchAnchor && 'opacity-40 cursor-not-allowed'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="font-mono text-[11px] text-slate-500">
        {effective !== null ? `Эффективно: ${formatHexAddress(effective)} в текущем (${totalBytes} б)` : `Не помещается в текущий (${totalBytes} б)`}
      </div>

      <input
        value={editName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
        onBlur={commitName}
        onKeyDown={handleNameKeyDown}
        maxLength={RULE_NAME_MAX_LENGTH}
        className="w-full px-2.5 py-1.5 text-sm rounded-md bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-blue-500"
      />

      <select
        value={rule.data_type}
        onChange={handleTypeChange}
        className="w-full px-2.5 py-1.5 text-sm rounded-md bg-slate-800 border border-slate-700 text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
      >
        {DATA_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
        ))}
      </select>

      <div className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5">
        <div className="text-[11px] text-slate-500">Значение в текущем пакете:</div>
        <div className="font-mono text-sm text-slate-100 break-all">{valuePreview}</div>
      </div>

      {selectedRange && !isSameRange && (
        <button
          type="button"
          onClick={() => onResize(selectedRange)}
          className="w-full py-1.5 rounded-md text-xs font-medium bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
        >
          ⇄ Применить выделение {resizePreview} к правилу
        </button>
      )}

      <button
        type="button" onClick={onDuplicate} title="Создать копию с тем же offset/length"
        className="w-full py-1.5 rounded-md text-xs text-slate-200 border border-slate-700 hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer"
      >
        📋 Дублировать правило
      </button>

      <button
        type="button" onClick={onDelete}
        className="w-full py-1.5 rounded-md text-xs text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 cursor-pointer"
      >
        Удалить правило
      </button>
    </div>
  );
};