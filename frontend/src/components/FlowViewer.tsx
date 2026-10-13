import { useState, useEffect, useMemo, type FC } from 'react';
import type { FlowViewerProps } from '../types';
import { FLOW_INITIAL_PACKETS, FLOW_PACKETS_STEP, FLOW_HEX_PREVIEW_CHARS, FLOW_TIMESTAMP_FRACTION_DIGITS, FLOW_DELTA_MS_MULTIPLIER, FLOW_DELTA_FRACTION_DIGITS } from '../constants/flow';
import { getPayloadByteLength } from '../utils/rules';
import { cn } from '../utils/cn';
const DOM = 'flow-pkt-'; const AR_R = '──────▶'; const AR_L = '◀──────';
export const FlowViewer: FC<FlowViewerProps> = ({ packets, selectedPacketId, onSelectPacket }) => {
const [vis, setVis] = useState(FLOW_INITIAL_PACKETS);
const show = useMemo(() => packets.slice(0, vis), [packets, vis]); const hid = packets.length - show.length;
const cnt = useMemo(() => { let c = 0, s = 0; for (const p of packets) p.direction === 'client_to_server' ? c++ : s++; return { c, s }; }, [packets]);
useEffect(() => { if (selectedPacketId !== null) document.getElementById(`${DOM}${selectedPacketId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selectedPacketId]);
if (!packets.length) return <div className="flex items-center justify-center h-full text-zinc-500 text-[13px] font-sans">Нет пакетов для диаграммы</div>;
return (
<div className="flex flex-col h-full min-h-0 bg-[#0e0f11] font-sans">
<div className="px-4 py-3 border-b border-white/[0.07] bg-[#15161a] shrink-0">
<div className="text-[13px] font-semibold text-zinc-100">Диаграмма обмена <span className="text-[12px] font-mono font-normal text-zinc-500">{packets.length} pkts</span></div>
<div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono"><span className="text-zinc-600">CLIENT</span>
<span className="text-emerald-200/70">──▶ {cnt.c}</span><span className="text-zinc-400">{cnt.s} ◀──</span><span className="text-zinc-600">SERVER</span></div>
</div>
<div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
{show.map((p, i) => { const sel = p.id === selectedPacketId; const cli = p.direction === 'client_to_server';
const len = getPayloadByteLength(p.payload_hex); const prev = i > 0 ? packets[i - 1] : null;
const delta = prev ? `+${((p.timestamp - prev.timestamp) * FLOW_DELTA_MS_MULTIPLIER).toFixed(FLOW_DELTA_FRACTION_DIGITS)}ms` : '—';
const raw = p.payload_hex.slice(0, FLOW_HEX_PREVIEW_CHARS).toUpperCase();
const pv = p.payload_hex.length > FLOW_HEX_PREVIEW_CHARS ? `${raw}...` : raw;
return (
<button key={p.id} id={`${DOM}${p.id}`} type="button" title={`#${p.id} · ${p.timestamp.toFixed(FLOW_TIMESTAMP_FRACTION_DIGITS)}`} onClick={() => onSelectPacket(p)}
className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left cursor-pointer transition-all',
sel ? 'border-white/25 bg-white/[0.06]' : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]')}>
<span className="font-mono text-[12px] text-zinc-300 w-9 shrink-0">#{p.id}</span>
<span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0', cli ? 'bg-emerald-400/[0.08] text-emerald-200/90 border-emerald-400/20' : 'bg-white/[0.05] text-zinc-300 border-white/10')}>{cli ? 'C→S' : 'S→C'}</span>
<span className={cn('flex-1 text-center text-[12px] tracking-tighter select-none', cli ? 'text-emerald-400/50' : 'text-zinc-600')}>{cli ? AR_R : AR_L}</span>
<span className="font-mono text-[11px] text-zinc-500 w-14 text-right shrink-0">{len} B</span>
<span className="font-mono text-[11px] text-zinc-600 w-16 text-right shrink-0">{delta}</span>
<span className="font-mono text-[11px] text-zinc-400 truncate max-w-[140px] shrink-0">{pv}</span>
</button>); })}
{hid > 0 && <button type="button" onClick={() => setVis((p) => p + FLOW_PACKETS_STEP)} className="btn-ghost w-full justify-center">Показать ещё {Math.min(FLOW_PACKETS_STEP, hid)} из {hid}</button>}
</div>
</div>
);
};