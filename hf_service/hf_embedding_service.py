from fastapi import FastAPI, HTTPException
import os
from pydantic import BaseModel
from typing import List
import asyncio
import httpx
from io import BytesIO
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel

app = FastAPI(title="Local CLIP Embedding Service")

MODEL_NAME = "laion/CLIP-ViT-B-32-laion2B-s34B-b79K"

# Auto-configure batch size and concurrency based on available GPU memory.
# These are conservative heuristics to avoid OOMs while providing good throughput.
DEFAULT_BATCH_SIZE = 16
DEFAULT_CONCURRENCY = 6

device = "cuda" if torch.cuda.is_available() else "cpu"

if device == "cuda":
    try:
        props = torch.cuda.get_device_properties(0)
        total_gb = props.total_memory / (1024 ** 3)
        # Heuristic thresholds (tune as needed):
        # >= 24GB -> batch 128, >=16GB -> 64, >=8GB -> 32, >=6GB -> 16, else 8
        if total_gb >= 24:
            BATCH_SIZE = 128
        elif total_gb >= 16:
            BATCH_SIZE = 64
        elif total_gb >= 8:
            BATCH_SIZE = 32
        elif total_gb >= 6:
            BATCH_SIZE = 16
        else:
            BATCH_SIZE = 8
        # Concurrency roughly proportional to batch size but kept small to avoid too many concurrent downloads
        CONCURRENCY = min(8, max(2, (BATCH_SIZE // 8) * 2))
        print(f"GPU detected: {props.name} ({total_gb:.1f} GB) — using BATCH_SIZE={BATCH_SIZE}, CONCURRENCY={CONCURRENCY}")
    except Exception as e:
        BATCH_SIZE = DEFAULT_BATCH_SIZE
        CONCURRENCY = DEFAULT_CONCURRENCY
        print(f"GPU detected but couldn't read properties: {e}. Using defaults BATCH_SIZE={BATCH_SIZE}, CONCURRENCY={CONCURRENCY}")
else:
    BATCH_SIZE = DEFAULT_BATCH_SIZE
    CONCURRENCY = DEFAULT_CONCURRENCY
    print(f"No GPU detected — using CPU with BATCH_SIZE={BATCH_SIZE}, CONCURRENCY={CONCURRENCY}")

# Allow overriding via environment variables for quick tuning without editing code.
try:
    env_bs = os.environ.get("HF_BATCH_SIZE")
    env_conc = os.environ.get("HF_CONCURRENCY")
    if env_bs:
        BATCH_SIZE = int(env_bs)
    if env_conc:
        CONCURRENCY = int(env_conc)
    if env_bs or env_conc:
        print(f"Overrides applied from env: BATCH_SIZE={BATCH_SIZE}, CONCURRENCY={CONCURRENCY}")
except Exception as e:
    print(f"Invalid HF_BATCH_SIZE/HF_CONCURRENCY values: {e} - using computed defaults")

model = CLIPModel.from_pretrained(MODEL_NAME).to(device)
processor = CLIPProcessor.from_pretrained(MODEL_NAME)


@app.get("/health")
async def health():
    """Simple health endpoint to verify model and runtime parameters."""
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": device,
        "batch_size": BATCH_SIZE,
        "concurrency": CONCURRENCY
    }

class EmbeddingRequest(BaseModel):
    images: List[str]

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]

async def download_image(client: httpx.AsyncClient, url: str):
    try:
        r = await client.get(url, timeout=30.0)
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")
    except Exception as e:
        raise RuntimeError(f"Failed to fetch {url}: {str(e)}")

@app.post("/embeddings", response_model=EmbeddingResponse)
async def embeddings(req: EmbeddingRequest):
    urls = req.images
    if not urls:
        raise HTTPException(status_code=400, detail="images list required")

    images = []
    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(CONCURRENCY)
        async def fetch(u):
            async with sem:
                return await download_image(client, u)
        tasks = [fetch(u) for u in urls]
        # Gather results (will raise if any fail)
        images = await asyncio.gather(*tasks)

    # Now do batched inference (synchronous torch) to utilize GPU/CPU efficiently
    all_embeddings = []
    for i in range(0, len(images), BATCH_SIZE):
        batch_imgs = images[i:i+BATCH_SIZE]
        inputs = processor(images=batch_imgs, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            feats = model.get_image_features(**inputs)  # (batch, dim)
            feats = torch.nn.functional.normalize(feats, p=2, dim=1)
            all_embeddings.extend(feats.cpu().numpy().tolist())

    return EmbeddingResponse(embeddings=all_embeddings)
