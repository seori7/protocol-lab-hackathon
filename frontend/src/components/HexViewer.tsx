import React from 'react';

interface HexViewerProps {
  payloadHex: string;
}

const BYTES_PER_LINE = 16;

export const HexViewer: React.FC<HexViewerProps> = ({ payloadHex }) => {
  if (!payloadHex) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Нет данных для отображения
      </div>
    );
  }

  // Разбиваем hex-строку на массив байтов (строк из 2 символов)
  const bytes: string[] = [];
  for (let i = 0; i < payloadHex.length; i += 2) {
    bytes.push(payloadHex.substring(i, i + 2));
  }

  // Формируем строки для отображения
  const lines: { offset: string; hex: string[]; ascii: string }[] = [];
  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    const chunk = bytes.slice(i, i + BYTES_PER_LINE);
    
    // Смещение в формате 0000
    const offset = i.toString(16).padStart(4, '0').toUpperCase();
    
    // ASCII представление
    const ascii = chunk.map(hexByte => {
      const code = parseInt(hexByte, 16);
      // Печатаем символ, если он в диапазоне 32-126, иначе точку
      return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.';
    }).join('');

    lines.push({ offset, hex: chunk, ascii });
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 bg-gray-100 border-b border-gray-200 font-semibold text-gray-700">
        Просмотр сырых байтов (Hex Viewer)
      </div>
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 font-mono text-sm">
        {lines.map((line, idx) => (
          <div key={idx} className="flex mb-1 hover:bg-gray-100 px-2 py-0.5 rounded">
            {/* Offset */}
            <div className="w-16 text-gray-500 select-none mr-4">
              {line.offset}
            </div>
            
            {/* Hex bytes */}
            <div className="w-96 flex gap-2 text-gray-800">
              {line.hex.map((h, i) => (
                <span key={i} className="w-5 text-center uppercase">
                  {h}
                </span>
              ))}
              {/* Заполняем пустое место, если байтов меньше BYTES_PER_LINE */}
              {Array.from({ length: BYTES_PER_LINE - line.hex.length }).map((_, i) => (
                <span key={`empty-${i}`} className="w-5"></span>
              ))}
            </div>
            
            {/* ASCII */}
            <div className="ml-4 text-gray-600 whitespace-pre">
              {line.ascii}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
