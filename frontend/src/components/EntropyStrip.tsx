import { useMemo, type FC } from 'react';
import type { EntropyStripProps } from '../types';
import { MAX_ENTROPY_COLUMNS } from '../constants/project';
import { CHANGEPOINT_SELECT_RADIUS } from '../constants/anchor';
import { getEntropyHeatColor, getAverageEntropy, countConstantColumns } from '../utils/entropy';
import { detectChangepoints } from '../utils/changepoint';
import { formatHexAddress } from '../utils/hex';
const P = 100; const DIG = 2;
interface B { start: number; end: number; avg: number; maxD: number; minS: number; }
export const EntropyStrip: FC<EntropyStripProps> = ({ entropy, selectionRange, onSelectRange }) => {
const buckets: B[] = useMemo(() => { const c = entropy.columns; if (!c.length) return [];
if (c.length <= MAX_ENTROPY_COLUMNS) return c.map((x) => ({ start: x.offset, end: x.offset, avg: x.entropy, maxD: x.distinctCount, minS: x.sampleCount }));
const sz = Math.ceil(c.length / MAX_ENTROPY_COLUMNS); const r: B[] = [];
for (let i = 0; i < c.length; i += sz) { const sl = c.slice(i, i + sz); let s = 0, md = 0, ms = Number.MAX_SAFE_INTEGER;
for (const x of sl) { s += x.entropy; if (x.distinctCount > md) md = x.distinctCount; if (x.sampleCount < ms) ms = x.sampleCount; }
r.push({ start: sl[0]!.offset, end: sl[sl.length - 1]!.offset, avg: s / sl.length, maxD: md, minS: ms }); } return r; }, [entropy]);
const cps = useMemo(() => detectChangepoints(entropy), [entropy]);
const avg = useMemo(() => getAverageEntropy(entropy), [entropy]);
const cc = useMemo(() => countConstantColumns(entropy), [entropy]);
const t = entropy.maxLength;
if (!t || !buckets.length) return <div className="text-[11px] text-zinc-600 font-sans">Нет данных для энтропии</div>;
const left = selectionRange ? (selectionRange.start / t) * P : 0;
const w = selectionRange ? ((selectionRange.end - selectionRange.start + 1) / t) * P : 0;
return (
<div className="font-sans">
<div className="flex items-center justify-between mb-1.5">
<div className="text-[11px] text-zinc-500">Энтропия <span className="font-mono text-zinc-300">avg {avg.toFixed(DIG)}</span> <span className="text-zinc-600">·</span> <span className="font-mono">const {cc}/{t}</span>
{cps.length > 0 && <><span className="text-zinc-600"> · </span><span className="font-mono text-zinc-300">{cps.length} границ</span></>}</div>
<div className="flex items-center gap-2 text-[10px] text-zinc-600">
<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'rgba(113,113,122,0.9)' }} />const</span>
<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'rgba(253,224,71,0.7)' }} />mid</span>
<span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'rgba(248,113,113,0.8)' }} />high</span>
</div>
</div>
<div className="relative h-3 rounded overflow-visible bg-[#1e2025] border border-white/[0.07] flex">
{buckets.map((b) => { const wd = ((b.end - b.start + 1) / t) * P; const sgl = b.start === b.end;
const title = sgl ? `${formatHexAddress(b.start)} · H=${b.avg.toFixed(DIG)}` : `${formatHexAddress(b.start)}–${formatHexAddress(b.end)} · H~${b.avg.toFixed(DIG)}`;
return <div key={`${b.start}-${b.end}`} role="button" tabIndex={0} title={title} onClick={() => onSelectRange({ start: b.start, end: b.end })} onKeyDown={(e) => { if (e.key === 'Enter') onSelectRange({ start: b.start, end: b.end }); }}
style={{ width: `${wd}%`, backgroundColor: getEntropyHeatColor(b.avg) }} className="h-full min-w-[2px] cursor-pointer border-r border-black/40 hover:brightness-125 transition-all" />; })}
{selectionRange && <div className="absolute top-0 bottom-0 bg-white/15 border-x border-white/50 pointer-events-none" style={{ left: `${left}%`, width: `${w}%` }} />}
{cps.map((c) => <button key={`cp-${c.offset}`} type="button" title={`${formatHexAddress(c.offset)} · H ${c.leftAvg.toFixed(2)}→${c.rightAvg.toFixed(2)}`}
onClick={(e) => { e.stopPropagation(); onSelectRange({ start: Math.max(0, c.offset - CHANGEPOINT_SELECT_RADIUS), end: Math.min(t - 1, c.offset + CHANGEPOINT_SELECT_RADIUS - 1) }); }}
style={{ left: `${(c.offset / t) * P}%` }} className="absolute -top-[3px] -bottom-[3px] w-[2px] -ml-[1px] bg-white/90 hover:bg-white hover:w-[3px] cursor-pointer z-10 rounded transition-all" />)}
</div>
</div>
);
};