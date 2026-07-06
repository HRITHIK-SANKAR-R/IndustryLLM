"""
OMNI-GRAPH Python Worker
------------------------
Local document pre-processing microservice. The Go router hands it raw upload
bytes; it returns semantic text chunks (PyMuPDF) and a compressed base64 image
(Pillow) sized to fit the NVIDIA NIM payload limits.

Run:  uvicorn main:app --host 127.0.0.1 --port 8000
"""

import base64
import io
from typing import List

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse

# Optional heavy deps — import lazily so /health works even if a wheel is missing.
try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover
    fitz = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

app = FastAPI(title="OMNI-GRAPH Worker", version="1.0.0")

MAX_CHUNK_CHARS = 4000  # keep chunks under Groq TPM pressure
OVERLAP_CHARS = 400     # sliding-window overlap to avoid splitting rules
MAX_IMAGE_DIM = 2048    # NVIDIA NIM payload guard
JPEG_QUALITY = 85


@app.get("/health")
def health():
    return {
        "status": "ok",
        "pymupdf": fitz is not None,
        "pillow": Image is not None,
    }


def extract_text(pdf_bytes: bytes) -> tuple[str, int]:
    """Return (full_text, page_count) from a PDF."""
    if fitz is None or not pdf_bytes:
        return "", 0
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = [page.get_text("text") for page in doc]
    page_count = doc.page_count
    doc.close()
    return "\n".join(pages), page_count


def chunk_text(text: str) -> List[str]:
    """Sliding-window semantic chunking on paragraph boundaries."""
    if not text.strip():
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks: List[str] = []
    buf = ""
    for para in paragraphs:
        if len(buf) + len(para) + 2 <= MAX_CHUNK_CHARS:
            buf = f"{buf}\n\n{para}" if buf else para
        else:
            if buf:
                chunks.append(buf)
            # carry overlap into the next chunk for context continuity
            tail = buf[-OVERLAP_CHARS:] if buf else ""
            buf = f"{tail}\n\n{para}" if tail else para
    if buf:
        chunks.append(buf)
    return chunks


def compress_image(img_bytes: bytes) -> tuple[str, int, int]:
    """Downscale + JPEG-compress the schematic.

    Returns (base64 without data URI prefix, width, height) of the compressed
    image — the exact pixel space the vision model sees, so the router can
    denormalize relative bounding boxes.
    """
    if Image is None or not img_bytes:
        return "", 0, 0
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY)
    return base64.b64encode(out.getvalue()).decode("ascii"), img.width, img.height


@app.post("/parse")
async def parse(
    manual: UploadFile = File(default=None),
    schematic: UploadFile = File(default=None),
):
    pdf_bytes = await manual.read() if manual is not None else b""
    img_bytes = await schematic.read() if schematic is not None else b""
    img_name = schematic.filename if schematic is not None else ""

    text, page_count = extract_text(pdf_bytes)
    chunks = chunk_text(text)
    image_b64, image_width, image_height = compress_image(img_bytes)

    return JSONResponse(
        {
            "chunks": chunks,
            "image_b64": image_b64,
            "image_name": img_name,
            "image_width": image_width,
            "image_height": image_height,
            "page_count": page_count,
        }
    )
