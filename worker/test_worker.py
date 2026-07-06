"""Unit tests for the OMNI-GRAPH Python worker."""

import io

import fitz
from PIL import Image

from main import chunk_text, compress_image, extract_text, MAX_CHUNK_CHARS


def test_chunk_text_empty():
    assert chunk_text("") == []
    assert chunk_text("   \n  ") == []


def test_chunk_text_single():
    chunks = chunk_text("Short paragraph about valve V-104.")
    assert len(chunks) == 1
    assert "V-104" in chunks[0]


def test_chunk_text_respects_max():
    # build text well over one chunk
    para = ("word " * 200).strip()
    text = "\n\n".join([para] * 20)
    chunks = chunk_text(text)
    assert len(chunks) > 1
    for c in chunks:
        # overlap can push slightly past, but never wildly over
        assert len(c) <= MAX_CHUNK_CHARS + 500


def test_extract_text_roundtrip():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Pump P-201A lubricate every 400 hours.")
    buf = doc.tobytes()
    doc.close()
    text, pages = extract_text(buf)
    assert pages == 1
    assert "P-201A" in text


def test_extract_text_empty_bytes():
    text, pages = extract_text(b"")
    assert text == ""
    assert pages == 0


def test_compress_image_downscales_and_encodes():
    big = Image.new("RGB", (4000, 3000), (10, 20, 30))
    buf = io.BytesIO()
    big.save(buf, format="PNG")
    b64 = compress_image(buf.getvalue())
    assert isinstance(b64, str)
    assert len(b64) > 0
    # decode back and confirm it fits the max dimension
    import base64

    decoded = Image.open(io.BytesIO(base64.b64decode(b64)))
    assert max(decoded.size) <= 2048


def test_compress_image_empty():
    assert compress_image(b"") == ""
