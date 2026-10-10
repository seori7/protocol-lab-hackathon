import { useState, useEffect } from 'react';
import { PacketList } from './components/PacketList';
import { HexViewer } from './components/HexViewer';
import { Packet } from './types';

// Hardcoded mock data in case backend is down
const MOCK_PACKETS: Packet[] = [
  {
    id: 1,
    timestamp: 1699020000.123,
    direction: "client_to_server",
    payload_hex: "48656c6c6f000102"
  },
  {
    id: 2,
    timestamp: 1699020000.145,
    direction: "server_to_client",
    payload_hex: "576f726c64000304"
  },
  {
    id: 3,
    timestamp: 1699020000.180,
    direction: "client_to_server",
    payload_hex: "41636b6e6f776c6564676500"
  },
  {
    id: 4,
    timestamp: 1699020000.200,
    direction: "server_to_client",
    payload_hex: "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324"
  }
];

function App() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPackets = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/project/123/packets');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data: Packet[] = await response.json();
        setPackets(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching packets, falling back to mock data:', err);
        // Fallback to hardcoded mock data
        setPackets(MOCK_PACKETS);
        setError('Бэкенд недоступен. Используются тестовые данные.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackets();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 shadow-md flex justify-between items-center z-10">
        <h1 className="text-xl font-bold">Анализатор протоколов (Reverse Engineering)</h1>
        {error && (
          <span className="text-sm bg-orange-500/20 text-orange-200 px-3 py-1 rounded border border-orange-500/30">
            {error}
          </span>
        )}
      </header>

      {/* Main Content Layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel: Packet List */}
        <div className="w-1/3 min-w-[400px] h-full shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Загрузка пакетов...
            </div>
          ) : (
            <PacketList 
              packets={packets} 
              selectedPacketId={selectedPacket?.id ?? null} 
              onSelectPacket={setSelectedPacket} 
            />
          )}
        </div>

        {/* Right Panel: Hex Viewer & details */}
        <div className="flex-1 h-full flex flex-col">
          {selectedPacket ? (
            <HexViewer payloadHex={selectedPacket.payload_hex} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
              Выберите пакет из списка слева для просмотра дампа
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
