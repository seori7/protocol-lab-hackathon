import type { FC, ChangeEvent } from 'react';
import type { PacketNotesEditorProps } from '../types';
import { NOTE_MAX_LENGTH, NOTE_PLACEHOLDER } from '../constants/meta';

export const PacketNotesEditor: FC<PacketNotesEditorProps> = ({
  packetId, note, onChange, onClear,
}) => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    if (packetId === null) return;
    onChange(packetId, e.target.value.slice(0, NOTE_MAX_LENGTH));
  };

  if (packetId === null) {
    return (
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-2.5">
        <div className="text-[11px] text-slate-600">Выберите пакет чтобы добавить заметку</div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-medium text-slate-400">
          Заметка <span className="font-mono text-slate-500">#{packetId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-600">
            {note.length}/{NOTE_MAX_LENGTH}
          </span>
          {note.length > 0 && (
            <button
              type="button"
              onClick={() => onClear(packetId)}
              title="Удалить заметку"
              className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              очистить
            </button>
          )}
        </div>
      </div>
      <textarea
        value={note}
        onChange={handleChange}
        placeholder={NOTE_PLACEHOLDER}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        className="w-full px-2.5 py-2 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500 resize-none"
      />
    </div>
  );
};