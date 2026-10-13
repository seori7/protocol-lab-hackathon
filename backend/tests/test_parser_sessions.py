import tempfile
import unittest
from pathlib import Path

from scapy.layers.inet import IP, TCP
from scapy.layers.l2 import Ether
from scapy.packet import Raw
from scapy.utils import wrpcap

from services.parser import PcapParser


CLIENT_IP = "192.0.2.10"
SERVER_IP = "192.0.2.20"
CLIENT_PORT = 45000
SERVER_PORT = 9000


def make_frame(flags: str, seq: int, payload: bytes = b""):
    """Создаёт тестовый Ethernet/IP/TCP-кадр без реальной сети."""
    frame = (
        Ether()
        / IP(src=CLIENT_IP, dst=SERVER_IP)
        / TCP(
            sport=CLIENT_PORT,
            dport=SERVER_PORT,
            flags=flags,
            seq=seq,
        )
    )
    return frame / Raw(load=payload) if payload else frame


def parse_frames(frames):
    """Записывает тестовые кадры во временный PCAP и читает их парсером."""
    with tempfile.TemporaryDirectory() as directory:
        filepath = Path(directory) / "sessions.pcap"
        wrpcap(str(filepath), frames)
        return PcapParser.extract_tcp_sessions(str(filepath))


class PcapParserSessionTests(unittest.TestCase):
    def test_new_syn_separates_connections_with_same_endpoints(self):
        sessions = parse_frames(
            [
                make_frame("S", 100),
                make_frame("PA", 101, b"FIRST"),
                make_frame("FA", 106),
                make_frame("S", 500),
                make_frame("PA", 501, b"SECOND"),
            ]
        )

        self.assertEqual(list(sessions), ["tcp-1", "tcp-2"])
        self.assertEqual(
            sessions["tcp-1"]["packets"][0]["payload_hex"],
            b"FIRST".hex().upper(),
        )
        self.assertEqual(
            sessions["tcp-2"]["packets"][0]["payload_hex"],
            b"SECOND".hex().upper(),
        )
        self.assertEqual(sessions["tcp-1"]["packets"][0]["frame_number"], 2)
        self.assertEqual(sessions["tcp-2"]["packets"][0]["frame_number"], 5)

    def test_repeated_initial_syn_does_not_create_another_session(self):
        sessions = parse_frames(
            [
                make_frame("S", 100),
                make_frame("S", 100),
                make_frame("PA", 101, b"DATA"),
            ]
        )

        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions["tcp-1"]["role_status"], "syn_observed")
        self.assertEqual(len(sessions["tcp-1"]["packets"]), 1)

    def test_missing_initial_syn_marks_roles_as_unknown(self):
        sessions = parse_frames(
            [make_frame("PA", 900, b"MIDSTREAM")]
        )

        self.assertEqual(sessions["tcp-1"]["role_status"], "unknown")
        self.assertIsNotNone(sessions["tcp-1"]["warning"])


if __name__ == "__main__":
    unittest.main()