# Local CLIP Embedding Service

This directory contains a small FastAPI service that uses the `transformers` library
and `openai/clip-vit-base-patch32` to generate normalized CLIP image embeddings.

Requirements
- Python 3.9+
- PyTorch (CPU or GPU) — see https://pytorch.org for installation instructions

Quick start (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Install torch; choose CPU or GPU wheel as appropriate. Example (CPU):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Run the service
uvicorn hf_embedding_service:app --host 0.0.0.0 --port 8000 --reload
```

API
- POST /embeddings
  - Body: { "images": ["https://.../img1.jpg", "https://.../img2.jpg"] }
  - Response: { "embeddings": [[...], [...]] }

Notes
- The service downloads images concurrently, runs batched inference, and returns
  normalized embeddings suitable for cosine similarity.
- Tune `BATCH_SIZE` and `CONCURRENCY` in `hf_embedding_service.py` depending on
  your hardware (GPU vs CPU) and network conditions.
