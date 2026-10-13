import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from scapy.layers.inet import IP, TCP
from scapy.layers.l2 import Ether
from scapy.packet import Raw
from scapy.utils import wrpcap

from api.streams import build_streams_response, find_capture_file


CLIENT_IP = "192.0.2.10"
SERVER_IP = "192.0.2.20"
CLIENT_PORT = 45000
SERVER_PORT = 9000


def make_frame(seq: int, payload: bytes):
    """Создаёт исходный кадр, который можно записать в тестовый PCAP."""
    return (
        Ether()
        / IP(src=CLIENT_IP, dst=SERVER_IP)
        / TCP(
            sport=CLIENT_PORT,
            dport=SERVER_PORT,
            flags="PA",
            seq=seq,
        )
        / Raw(load=payload)
    )


class StreamsApiTests(unittest.TestCase):
    def test_response_restores_sequence_order_and_retains_sources(self):
        frames = [
            make_frame(103, b"DEF"),
            make_frame(100, b"ABC"),
        ]

        with tempfile.TemporaryDirectory() as directory:
            capture_path = Path(directory) / "sample.pcap"
            wrpcap(str(capture_path), frames)

            result = build_streams_response(capture_path, "tcp-1")

        direction = result["streams"]["client_to_server"]
        self.assertEqual(direction["sequence_base"], 100)
        self.assertEqual(direction["span_bytes"], 6)
        self.assertEqual(
            [
                (part["payload_hex"], part["frame_number"])
                for part in direction["parts"]
            ],
            [("414243", 2), ("444546", 1)],
        )
        self.assertEqual(
            result["streams"]["server_to_client"]["parts"],
            [],
        )
        self.assertEqual(result["role_status"], "unknown")

    def test_missing_session_is_404(self):
        with tempfile.TemporaryDirectory() as directory:
            capture_path = Path(directory) / "sample.pcap"
            wrpcap(str(capture_path), [make_frame(100, b"ABC")])

            with self.assertRaises(HTTPException) as context:
                build_streams_response(capture_path, "tcp-999")

        self.assertEqual(context.exception.status_code, 404)

    def test_project_id_is_looked_up_in_upload_directory(self):
        project_id = uuid4()

        with tempfile.TemporaryDirectory() as directory:
            upload_directory = Path(directory)
            capture_path = upload_directory / f"{project_id}.pcapng"
            capture_path.write_bytes(b"test")

            with patch(
                "api.streams.UPLOAD_DIRECTORY",
                upload_directory,
            ):
                self.assertEqual(
                    find_capture_file(project_id),
                    capture_path,
                )


if __name__ == "__main__":
    unittest.main()