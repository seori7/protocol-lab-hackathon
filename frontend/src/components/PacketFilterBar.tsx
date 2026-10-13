import { useMemo, type FC, type ChangeEvent } from 'react';
import type { PacketFilterBarProps, FilterDirection } from '../types';
import { FILTER_DIRECTION_OPTIONS, FILTER_HEX_MAX_LENGTH } from '../constants/filter';
import { normalizeHexQuery, isHexQueryValid, parseLengthInput, isPacketFilterDefault } from '../utils/packetFilter';
import { cn } from '../utils/cn';

const HEX_SEARCH_PLACEHOLDER = 'HEX: 01 FF';
const MIN_LENGTH_PLACEHOLDER = 'min';
const MAX_LENGTH_PLACEHOLDER = 'max';
const FIRST_INDEX_BASE = 1;

export const PacketFilterBar: FC<PacketFilterBarProps> = ({
  filter, totalCount, filteredCount, anomalyCount, bookmarkCount,
  selectedRuleName, canUseAnomalyFilter,
  currentIndex, selectedPacketId,
  onFilterChange, onReset, onPrevPacket, onNextPacket,
}) => {
  const normalizedHex = useMemo(() => normalizeHexQuery(filter.hexQuery), [filter.hexQuery]);
  const isHexValid = useMemo(() => isHexQueryValid(normalizedHex), [normalizedHex]);
  const showHexError = filter.hexQuery.trim().length > 0 && !isHexValid;
  const isDefault = isPacketFilterDefault(filter);
  const isSelectedHidden = selectedPacketId !== null && currentIndex === -1 && filteredCount > 0;
  const canPrev = filteredCount > 0 && (currentIndex === -1 || currentIndex > 0);
  const canNext = filteredCount > 0 && (currentIndex === -1 || currentIndex < filteredCount - 1);

  const handleDirectionChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onFilterChange({ direction: e.target.value as FilterDirection });
  };
  const handleHexChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange({ hexQuery: e.target.value });
  };
  const handleMinChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange({ minLength: parseLengthInput(e.target.value) });
  };
  const handleMaxChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange({ maxLength: parseLengthInput(e.target.value) });
  };
  const handleAnomalyChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange({ onlyAnomalies: e.target.checked });
  };
  const handleBookmarkChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange({ onlyBookmarked: e.target.checked });
  };

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <select
          value={filter.direction}
          onChange={handleDirectionChange}
          title="Фильтр направления"
          className="px-2 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-200 outline-none focus:border-blue-500 cursor-pointer shrink-0"
        >
          {FILTER_DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          value={filter.hexQuery}
          onChange={handleHexChange}
          placeholder={HEX_SEARCH_PLACEHOLDER}
          maxLength={FILTER_HEX_MAX_LENGTH}
          title={showHexError ? 'Только HEX 0-9 A-F' : 'Подстрока HEX'}
          className={cn(
            'flex-1 min-w-0 px-2 py-1.5 text-xs font-mono rounded-md bg-slate-800 border outline-none placeholder:text-slate-600',
            showHexError ? 'border-rose-500 text-rose-200' : 'border-slate-700 text-slate-100 focus:border-blue-500'
          )}
        />
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          title="Сбросить фильтры"
          className={cn(
            'px-2 py-1.5 text-xs rounded-md border shrink-0',
            isDefault
              ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 cursor-pointer'
          )}
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={filter.minLength ?? ''}
          onChange={handleMinChange}
          placeholder={MIN_LENGTH_PLACEHOLDER}
          inputMode="numeric"
          title="Мин. длина"
          className="w-16 px-2 py-1.5 text-xs font-mono rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500"
        />
        <span className="text-slate-600 text-xs">–</span>
        <input
          value={filter.maxLength ?? ''}
          onChange={handleMaxChange}
          placeholder={MAX_LENGTH_PLACEHOLDER}
          inputMode="numeric"
          title="Макс. длина"
          className="w-16 px-2 py-1.5 text-xs font-mono rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500"
        />
        <label
          title={canUseAnomalyFilter ? `Аномалии "${selectedRuleName ?? ''}"` : 'Выберите правило'}
          className={cn(
            'flex items-center gap-1 text-[11px] select-none ml-auto',
            canUseAnomalyFilter ? 'text-slate-300 cursor-pointer' : 'text-slate-600 cursor-not-allowed'
          )}
        >
          <input
            type="checkbox"
            checked={filter.onlyAnomalies}
            onChange={handleAnomalyChange}
            disabled={!canUseAnomalyFilter}
            className="accent-amber-500 w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
          />
          ⚠{anomalyCount}
        </label>
        <label title="Только закладки" className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filter.onlyBookmarked}
            onChange={handleBookmarkChange}
            className="accent-yellow-400 w-3.5 h-3.5 cursor-pointer"
          />
          ★{bookmarkCount}
        </label>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono text-slate-500">
          {filteredCount}/{totalCount}
          {isSelectedHidden && <span className="ml-2 text-amber-300">#{selectedPacketId} скрыт</span>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrevPacket} disabled={!canPrev} title="Prev (Alt+↑)"
            className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-500 cursor-pointer disabled:cursor-not-allowed">↑</button>
          <span className="text-[11px] font-mono text-slate-500 min-w-[42px] text-center">
            {currentIndex >= 0 ? currentIndex + FIRST_INDEX_BASE : 0}/{filteredCount}
          </span>
          <button type="button" onClick={onNextPacket} disabled={!canNext} title="Next (Alt+↓)"
            className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:border-slate-500 cursor-pointer disabled:cursor-not-allowed">↓</button>
        </div>
      </div>
    </div>
  );
};