import type { AnchorOption, RuleAnchor } from '../types';

export const DEFAULT_RULE_ANCHOR: RuleAnchor = "start";

export const ANCHOR_OPTIONS: AnchorOption[] = [
  { value: "start", label: "От начала", hint: "offset от 0" },
  { value: "end", label: "От конца", hint: "offset от хвоста" },
];

export const CHANGEPOINT_WINDOW = 3;
export const CHANGEPOINT_THRESHOLD = 0.4;
export const CHANGEPOINT_MIN_DISTANCE = 4;
export const CHANGEPOINT_SELECT_RADIUS = 2;
export const CHANGEPOINT_MAX_MARKERS = 100;