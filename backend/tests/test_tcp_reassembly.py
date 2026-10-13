import unittest

from services.tcp_reassembly import (
    ReassemblyLimitError,
    reassemble_direction,
)


def segment(seq: int, frame: int, payload: bytes) -> dict:
    """Один наблюдавшийся TCP payload для теста."""
    return {
        "seq": seq,
        "frame_number": frame,
        "payload_hex": payload.hex(),
    }


class ReassembleDirectionTests(unittest.TestCase):
    def test_reorders_by_sequence_not_capture_time(self):
        result = reassemble_direction(
            [
                segment(103, 1, b"DEF"),
                segment(100, 2, b"ABC"),
            ]
        )

        self.assertEqual(result["sequence_base"], 100)
        self.assertEqual(
            [(part["payload_hex"], part["frame_number"])
             for part in result["parts"]],
            [("414243", 2), ("444546", 1)],
        )
        self.assertEqual(result["known_bytes"], 6)

    def test_identical_retransmission_does_not_duplicate_bytes(self):
        result = reassemble_direction(
            [
                segment(100, 1, b"ABC"),
                segment(100, 2, b"ABC"),
            ]
        )

        self.assertEqual(result["span_bytes"], 3)
        self.assertEqual(result["known_bytes"], 3)
        self.assertEqual(len(result["parts"]), 1)
        self.assertEqual(result["parts"][0]["frame_number"], 1)
        self.assertEqual(result["conflicts"], [])

    def test_partial_overlap_keeps_first_value(self):
        result = reassemble_direction(
            [
                segment(100, 1, b"ABCD"),
                segment(102, 2, b"CDEF"),
            ]
        )

        self.assertEqual(
            [part["payload_hex"] for part in result["parts"]],
            ["41424344", "4546"],
        )
        self.assertEqual(result["conflicts"], [])
        self.assertEqual(result["span_bytes"], 6)

    def test_gap_is_not_replaced_with_zeroes(self):
        result = reassemble_direction(
            [
                segment(100, 1, b"AB"),
                segment(105, 2, b"F"),
            ]
        )

        self.assertEqual(
            [part["kind"] for part in result["parts"]],
            ["data", "gap", "data"],
        )
        self.assertEqual(result["parts"][1]["length"], 3)
        self.assertEqual(result["known_bytes"], 3)

    def test_conflicting_overlap_keeps_both_sources_in_diagnostics(self):
        result = reassemble_direction(
            [
                segment(100, 1, b"ABC"),
                segment(101, 2, b"X"),
            ]
        )

        self.assertEqual(result["parts"][0]["payload_hex"], "414243")
        self.assertEqual(
            result["conflicts"],
            [
                {
                    "offset": 1,
                    "first_frame_number": 1,
                    "other_frame_number": 2,
                    "first_byte": ord("B"),
                    "other_byte": ord("X"),
                }
            ],
        )

    def test_large_range_fails_instead_of_truncating(self):
        with self.assertRaises(ReassemblyLimitError):
            reassemble_direction(
                [
                    segment(100, 1, b"A"),
                    segment(200, 2, b"B"),
                ],
                max_span_bytes=50,
            )


if __name__ == "__main__":
    unittest.main()