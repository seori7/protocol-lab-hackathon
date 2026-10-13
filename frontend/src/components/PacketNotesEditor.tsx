import type { FC, ChangeEvent } from 'react';
import type { PacketNotesEditorProps } from '../types';
import { NOTE_MAX_LENGTH, NOTE_PLACEHOLDER } from '../constants/meta';
export const PacketNotesEditor: FC<PacketNotesEditorProps> = ({ packetId, note, onChange, onClear }) => {
if (packetId === null) return <div className="shrink-0 border-t border-white/[0.07] bg-[#15161a] px-3 py-2.5 font-sans"><div className="text-[11px] text-zinc-600">Выберите пакет чтобы добавить заметку</div></div>;
return (
<div className="shrink-0 border-t border-white/[0.07] bg-[#15161a] px-3 py-2.5 font-sans">
<div className="flex items-center justify-between mb-1.5">
<div className="text-[11px] font-medium text-zinc-400">Заметка <span className="font-mono text-zinc-500">#{packetId}</span></div>
<div className="flex items-center gap-2"><span className="text-[10px] font-mono text-zinc-600">{note.length}/{NOTE_MAX_LENGTH}</span>
{note.length > 0 && <button type="button" onClick={() => onClear(packetId)} className="btn-ghost !h-6 !text-[11px]">Очистить</button>}</div>
</div>
<textarea value={note} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(packetId, e.target.value.slice(0, NOTE_MAX_LENGTH))}
placeholder={NOTE_PLACEHOLDER} maxLength={NOTE_MAX_LENGTH} rows={2}
className="field !h-auto min-h-[54px] !text-[12px] !leading-relaxed resize-none" />
</div>
);
};