import { useMemo, type FC, type ChangeEvent } from 'react';
import type { PacketFilterBarProps, FilterDirection } from '../types';
import { FILTER_DIRECTION_OPTIONS, FILTER_HEX_MAX_LENGTH } from '../constants/filter';
import { normalizeHexQuery, isHexQueryValid, parseLengthInput, isPacketFilterDefault } from '../utils/packetFilter';
import { StarIcon, AlertIcon, ChevronUpIcon, ChevronDownIcon, XIcon } from './icons';
import { cn } from '../utils/cn';

export const PacketFilterBar: FC<PacketFilterBarProps> = ({
  filter, totalCount, filteredCount, anomalyCount, bookmarkCount,
  selectedRuleName, canUseAnomalyFilter,
  currentIndex, selectedPacketId,
  onFilterChange, onReset, onPrevPacket, onNextPacket,
}) => {
  const nHex = useMemo(() => normalizeHexQuery(filter.hexQuery), [filter.hexQuery]);
  const validHex = useMemo(() => isHexQueryValid(nHex), [nHex]);
  const hexErr = filter.hexQuery.trim().length > 0 && !validHex;
  const isDef = isPacketFilterDefault(filter);
  const hidden = selectedPacketId !== null && currentIndex === -1 && filteredCount > 0;
  const canPrev = filteredCount > 0 && (currentIndex === -1 || currentIndex > 0);
  const canNext = filteredCount > 0 && (currentIndex === -1 || currentIndex < filteredCount - 1);

  return (
    <div className="shrink-0 border-b border-white/[0.07] bg-[#15161a] px-3 py-2.5 space-y-2 font-sans">
      <div className="flex items-center gap-1.5">
        <select
          value={filter.direction}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onFilterChange({ direction: e.target.value as FilterDirection })}
          title="Направление"
          className="field w-auto shrink-0 text-[12px] cursor-pointer"
        >
          {FILTER_DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          value={filter.hexQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ hexQuery: e.target.value })}
          placeholder="HEX: 01 FF"
          maxLength={FILTER_HEX_MAX_LENGTH}
          title={hexErr ? 'Только 0-9 A-F' : 'Подстрока HEX'}
          className={cn('field font-mono text-[12px] flex-1 min-w-0', hexErr && 'border-red-400/50 text-red-200')}
        />
        <button type="button" onClick={onReset} disabled={isDef} title="Сбросить" className="btn-secondary h-8 w-8 p-0 px-0 disabled:opacity-40 shrink-0">
          <XIcon size={13} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={filter.minLength ?? ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ minLength: parseLengthInput(e.target.value) })}
          placeholder="min" inputMode="numeric"
          className="field w-16 font-mono text-[12px]"
        />
        <span className="text-zinc-600 text-[12px]">–</span>
        <input
          value={filter.maxLength ?? ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ maxLength: parseLengthInput(e.target.value) })}
          placeholder="max" inputMode="numeric"
          className="field w-16 font-mono text-[12px]"
        />
        <label
          title={canUseAnomalyFilter ? `Аномалии "${selectedRuleName ?? ''}"` : 'Выберите правило'}
          className={cn('flex items-center gap-1.5 ml-auto text-[11px] select-none', canUseAnomalyFilter ? 'text-zinc-300 cursor-pointer' : 'text-zinc-600')}
        >
          <input
            type="checkbox" checked={filter.onlyAnomalies}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ onlyAnomalies: e.target.checked })}
            disabled={!canUseAnomalyFilter}
            className="accent-[#e8eaf0] w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="inline-flex items-center gap-1"><AlertIcon size={12} />{anomalyCount}</span>
        </label>
        <label title="Только закладки" className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox" checked={filter.onlyBookmarked}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange({ onlyBookmarked: e.target.checked })}
            className="accent-[#e8eaf0] w-3.5 h-3.5 cursor-pointer"
          />
          <span className="inline-flex items-center gap-1"><StarIcon size={12} filled={filter.onlyBookmarked} />{bookmarkCount}</span>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono text-zinc-500">
          {filteredCount}/{totalCount}
          {hidden && <span className="ml-2 text-amber-200/90">#{selectedPacketId} скрыт</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onPrevPacket} disabled={!canPrev} title="Назад (Alt+Вверх)" className="btn-secondary h-7 w-7 p-0 px-0 disabled:opacity-40">
            <ChevronUpIcon size={13} />
          </button>
          <span className="text-[11px] font-mono text-zinc-500 min-w-[42px] text-center">
            {currentIndex >= 0 ? currentIndex + 1 : 0}/{filteredCount}
          </span>
          <button type="button" onClick={onNextPacket} disabled={!canNext} title="Вперед (Alt+Вниз)" className="btn-secondary h-7 w-7 p-0 px-0 disabled:opacity-40">
            <ChevronDownIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};