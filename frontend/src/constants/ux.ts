import type { ShortcutEntry } from '../types';

export const GROUP_DELIMITERS: readonly string[] = [':', '/'];
export const GROUP_UNGROUPED_LABEL = 'Без группы';

export const SESSION_STATS_MAX_SAMPLE = 100;

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: 'ЛКМ + drag', action: 'Выделить диапазон', context: 'Hex' },
  { keys: '← → ↑ ↓', action: 'Двигать курсор', context: 'Hex' },
  { keys: 'Shift + стрелки', action: 'Расширить выделение', context: 'Hex' },
  { keys: 'Home / End', action: 'Начало / конец строки', context: 'Hex' },
  { keys: 'Ctrl + A', action: 'Выделить весь пакет', context: 'Hex' },
  { keys: 'Ctrl + C', action: 'Копировать HEX выделения', context: 'Hex' },
  { keys: 'Esc', action: 'Сбросить выделение', context: 'Hex' },
  { keys: 'Enter в поиске', action: 'Следующее совпадение', context: 'Hex' },
  { keys: 'Alt + ↑ / ↓', action: 'Prev / Next пакет', context: 'Список' },
  { keys: 'Клик по строке', action: 'Открыть пакет', context: 'Список' },
  { keys: 'Клик по правилу', action: 'Открыть инспектор', context: 'Правила' },
  { keys: 'Hover по правилу', action: 'Подсветить байты', context: 'Правила' },
  { keys: 'Клик по карте', action: 'Выделить сегмент / гэп', context: 'Карта' },
  { keys: 'Клик по маркеру ◇', action: 'Выделить границу', context: 'Карта' },
];