import type { SessionEntropy, EntropyChangepoint } from '../types';
import {
  CHANGEPOINT_WINDOW, CHANGEPOINT_THRESHOLD,
  CHANGEPOINT_MIN_DISTANCE, CHANGEPOINT_MAX_MARKERS,
} from '../constants/anchor';

export function detectChangepoints(entropy: SessionEntropy): EntropyChangepoint[] {
  const n = entropy.columns.length;
  const window = CHANGEPOINT_WINDOW;
  if (n < window * 2 + 1) return [];

  const values: number[] = entropy.columns.map((c) => c.entropy);
  const candidates: EntropyChangepoint[] = [];

  for (let i = window; i <= n - window; i++) {
    let leftSum = 0;
    let rightSum = 0;
    for (let k = 0; k < window; k++) {
      leftSum += values[i - window + k] as number;
      rightSum += values[i + k] as number;
    }
    const leftAvg = leftSum / window;
    const rightAvg = rightSum / window;
    const strength = Math.abs(rightAvg - leftAvg);
    if (strength >= CHANGEPOINT_THRESHOLD) {
      candidates.push({ offset: i, strength, leftAvg, rightAvg });
    }
  }

  candidates.sort((a, b) => b.strength - a.strength);
  const picked: EntropyChangepoint[] = [];
  for (const c of candidates) {
    let tooClose = false;
    for (const p of picked) {
      if (Math.abs(c.offset - p.offset) < CHANGEPOINT_MIN_DISTANCE) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      picked.push(c);
      if (picked.length >= CHANGEPOINT_MAX_MARKERS) break;
    }
  }
  picked.sort((a, b) => a.offset - b.offset);
  return picked;
}