import React from 'react';
import { Packet } from '../types';

interface PacketListProps {
  packets: Packet[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: Packet) => void;
}

export const PacketList: React.FC<PacketListProps> = ({ packets, selectedPacketId, onSelectPacket }) => {
  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      <div className="p-4 bg-gray-100 border-b border-gray-200 font-semibold text-gray-700">
        Список пакетов
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">ID</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Время</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Направление</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Длина</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 cursor-pointer">
            {packets.map((packet) => {
              const isSelected = packet.id === selectedPacketId;
              const isClient = packet.direction === "client_to_server";
              
              return (
                <tr 
                  key={packet.id}
                  onClick={() => onSelectPacket(packet)}
                  className={`hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100' : ''}`}
                >
                  <td className="px-4 py-2 text-gray-900">{packet.id}</td>
                  <td className="px-4 py-2 text-gray-500">{packet.timestamp.toFixed(3)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${isClient ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                      {isClient ? 'C -> S' : 'S -> C'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{packet.payload_hex.length / 2} байт</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
