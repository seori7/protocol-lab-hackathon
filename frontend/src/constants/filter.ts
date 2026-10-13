import type { PacketFilterState, FilterDirection } from '../types';

export const DEFAULT_PACKET_FILTER: PacketFilterState = {
  direction: 'all',
  minLength: null,
  maxLength: null,
  hexQuery: '',
  onlyAnomalies: false,
  onlyBookmarked: false,
};

export const FILTER_DIRECTION_OPTIONS: Array<{ value: FilterDirection; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'client_to_server', label: 'C → S' },
  { value: 'server_to_client', label: 'S → C' },
];

export const FILTER_HEX_MAX_LENGTH = 128;
export const FILTER_HEX_SPACES_PATTERN = /\s+/g;
export const FILTER_HEX_VALID_PATTERN = /^[0-9A-F]*$/;

export const FILTER_LENGTH_INPUT_RADIX = 10;
export const FILTER_MIN_LENGTH_LIMIT = 0;
export const FILTER_MAX_LENGTH_LIMIT = 10000000;

export const ANOMALY_MIN_PACKETS_FOR_SINGLETON = 4;
export const ANOMALY_MIN_PACKETS_FOR_PERCENT = 10;
export const ANOMALY_RARE_PERCENT_THRESHOLD = 10;
export const ANOMALY_PERCENT_MULTIPLIER = 100;

export const PACKET_NAV_PREV_KEY = 'ArrowUp';
export const PACKET_NAV_NEXT_KEY = 'ArrowDown';
export const PACKET_NAV_IGNORE_TAGS: readonly string[] = ['INPUT', 'SELECT', 'TEXTAREA'];