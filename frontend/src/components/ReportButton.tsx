import { useState, useRef, useEffect, type FC } from 'react';
import type { ReportButtonProps } from '../types';
import { buildHtmlReport, downloadHtmlReport, buildReportFilename } from '../utils/report';
import { FileTextIcon } from './icons';
export const ReportButton: FC<ReportButtonProps> = ({ projectFilename, sessionLabel, packets, rules, bookmarkedIds, notes }) => {
const [msg, setMsg] = useState<string | null>(null); const tRef = useRef<number | null>(null);
useEffect(() => () => { if (tRef.current !== null) window.clearTimeout(tRef.current); }, []);
const can = packets.length > 0;
const go = (): void => { if (!can) return;
downloadHtmlReport(buildHtmlReport(projectFilename, sessionLabel, packets, rules, bookmarkedIds, notes), buildReportFilename(projectFilename));
setMsg('Отчёт скачан'); if (tRef.current !== null) window.clearTimeout(tRef.current); tRef.current = window.setTimeout(() => setMsg(null), 3000); };
return (
<div className="relative font-sans">
<button type="button" onClick={go} disabled={!can} title="Скачать HTML-отчёт" className="btn-secondary !h-8 disabled:opacity-40"><FileTextIcon size={13} />Отчёт</button>
{msg && <div className="absolute top-full mt-1.5 right-0 text-[11px] text-zinc-200 bg-[#1e2025] border border-white/10 rounded-md px-2 py-1 z-20 whitespace-nowrap">{msg}</div>}
</div>
);
};