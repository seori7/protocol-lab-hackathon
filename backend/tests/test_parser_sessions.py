import tempfile
import unittest
from pathlib import Path

from scapy.layers.inet import IP, TCP
from scapy.packet import Raw
from scapy.utils import wrpcap

from services.parser import PcapParser


SOURCE_IP = "192.0.2.10"
DESTINATION_IP = "192.0.2.20"
SOURCE_PORT = 45000
DESTINATION_PORT = 9000


def make_packet(
    *,
    flags: str,
    seq: int,
    payload: bytes = b"",
):
    """Собирает один тестовый TCP-кадр без обращения к сети."""
    packet = (
        IP(src=SOURCE_IP, dst=DESTINATION_IP)
        / TCP(
            sport=SOURCE_PORT,
            dport=DESTINATION_PORT,
            flags=flags,
            seq=seq,
        )
    )
    if payload:
        packet = packet / Raw(load=payload)
    return packet


class PcapSessionTests(unittest.TestCase):
    def test_same_endpoints_with_new_syn_are_separate_sessions(self):
        frames = [
            make_packet(flags="S", seq=100),
            make_packet(flags="PA", seq=101, payload=b"FIRST"),
            make_packet(flags="FA", seq=106),
            make_packet(flags="S", seq=500),
            make_packet(flags="PA", seq=501, payload=b"SECOND"),
        ]

        with tempfile.TemporaryDirectory() as directory:
            filepath = Path(directory) / "reused-endpoints.pcap"
            wrpcap(str(filepath), frames)

            sessions = PcapParser.extract_tcp_sessions(str(filepath))

        self.assertEqual(list(sessions), ["tcp-1", "tcp-2"])
        self.assertEqual(
            [packet["payload_hex"] for packet in sessions["tcp-1"]["packets"]],
            [b"FIRST".hex()],
        )
        self.assertEqual(
            [packet["payload_hex"] for packet in sessions["tcp-2"]["packets"]],
            [b"SECOND".hex()],
        )
        self.assertEqual(sessions["tcp-1"]["packets"][0]["id"], 2)
        self.assertEqual(sessions["tcp-2"]["packets"][0]["id"], 5)

    def test_missing_handshake_does_not_establish_roles(self):
        frames = [
            make_packet(flags="PA", seq=900, payload=b"DATA"),
        ]

        with tempfile.TemporaryDirectory() as directory:
            filepath = Path(directory) / "midstream.pcap"
            wrpcap(str(filepath), frames)

            sessions = PcapParser.extract_tcp_sessions(str(filepath))

        self.assertEqual(sessions["tcp-1"]["role_status"], "unknown")
        self.assertIsNotNone(sessions["tcp-1"]["warning"])


if __name__ == "__main__":
    unittest.main()