# AI Image Deduplication (CLIP)

A simple project that detects duplicate or near-duplicate images using semantic embeddings (CLIP) with a dHash fallback for robustness.

## Introduction
This repo provides a web UI + API to:
- fetch brand images,
- generate semantic embeddings,
- compute pairwise similarity,
- cluster duplicates and present results.


## Frontend
Built with Vite + React:
- Main app: [src/main.jsx](src/main.jsx) → [src/App.jsx](src/App.jsx).
- Components: [`BrandSelector`](src/components/BrandSelector.jsx), [`ProcessingStatus`](src/components/ProcessingStatus.jsx), [`ResultsView`](src/components/ResultsView.jsx).
- Service wrapper: [`apiService`](src/services/api.js) handles requests to `/api` endpoints.
- Hooks: [`useImageProcessing`](src/hooks/useImageProcessing.js) orchestrates fetch → process → progress updates.


## Backend
Node/Express API (server.mjs) exposing:
- GET /api/images → [api/images.js](api/images.js)
- POST /api/process → [api/process.js](api/process.js)
- GET /api/health → [api/health.js](api/health.js)

Embedding options implemented in [api/process.js](api/process.js):
- Local CLIP FastAPI service: [hf_service/hf_embedding_service.py](hf_service/hf_embedding_service.py) (preferred for on-prem / dev).
- Gemini Vision (Google) via [`generateAIEmbeddings`](lib/clipProcessor.js).
- Hugging Face feature-extraction as alternative (when configured).
- dHash fallback: [`processFallback`](lib/fallbackProcessor.js) when ML backends are unavailable.

## Approach & Algorithms

1. Semantic embeddings (primary)
   - Use CLIP / Gemini Vision to produce image embeddings.
   - Compute cosine similarity via [`computeSimilarityMatrix`](lib/clipProcessor.js).
   - Cluster similar images using [`clusterSimilarImages`](lib/clipProcessor.js).

   Why:
   - Captures semantic similarity beyond pixel differences (robust to cropping, color shifts, small edits).
   - Good balance of precision and recall for duplicate detection.

2. dHash fallback (perceptual hashing)
   - Implemented in [`lib/fallbackProcessor.js`](lib/fallbackProcessor.js).
   - Fast and lightweight; useful when external APIs or GPU are not available.

   Why:
   - Works offline, deterministic, cheap CPU cost.
   - Lower semantic accuracy vs embeddings but much less resource-hungry.

## Tradeoffs
- Embeddings (CLIP)
  - Pros: high semantic accuracy, robust to visual edits.
  - Cons: needs model/API access, higher cost (API / GPU), longer runtime.
- Local CLIP service
  - Pros: cost control, low-latency for local infra.
  - Cons: requires GPU or CPU resources and model download.
- dHash fallback
  - Pros: simple, deterministic, cheap.
  - Cons: fails on semantic duplicates (different crops/styles), less precise.

Design trade decisions:
- Progressive fallback chain in [api/process.js](api/process.js) (local → Gemini → HF → dHash) to maximize correctness while remaining resilient.
- Batch processing (see `BATCH_SIZE` in [lib/clipProcessor.js](lib/clipProcessor.js) and [hf_service/hf_embedding_service.py](hf_service/hf_embedding_service.py)) to avoid OOMs and respect API limits.
- Logging snapshots and local debug logs in [api/process.js](api/process.js) to speed debugging for malformed inputs.

## Scalability
Designed to scale horizontally and vertically:
- Horizontal: make the processing stateless and run multiple API instances behind a load balancer; cache results (e.g., Redis) to avoid reprocessing same images.
- Vertical: tune `BATCH_SIZE` and `CONCURRENCY` in [hf_service/hf_embedding_service.py](hf_service/hf_embedding_service.py) or reduce batch size in [lib/clipProcessor.js](lib/clipProcessor.js) for memory-limited workers.
- Use async batching and limited concurrency for image downloads (see FastAPI service).
- Offload heavy embedding work to specialized workers or cloud-managed ML endpoints (HF).
- Cache embeddings keyed by image URL or content hash to reduce repeated work.
- For very large datasets: shard images and run distributed clustering (map-reduce style), then merge clusters.

## Getting started (local dev)
- Install deps: see [package.json](package.json).
- Start local CLIP (optional) and Node API:
  - Run local service helper: [scripts/run_local.ps1](scripts/run_local.ps1)
  - Or start node API: npm run dev:server (see [package.json](package.json) scripts)
- Frontend: npm run dev (Vite)

## Useful files & symbols
- App entry: [src/App.jsx](src/App.jsx)
- Frontend service: [`apiService`](src/services/api.js)
- Hook: [`useImageProcessing`](src/hooks/useImageProcessing.js)
- API: [api/process.js](api/process.js) (main processing flow)
- Embedding & clustering: [`generateAIEmbeddings`](lib/clipProcessor.js), [`computeSimilarityMatrix`](lib/clipProcessor.js), [`clusterSimilarImages`](lib/clipProcessor.js)
- Fallback: [`processFallback`](lib/fallbackProcessor.js)
- Local embedding service: [hf_service/hf_embedding_service.py](hf_service/hf_embedding_service.py)
- Run helper: [scripts/run_local.ps1](scripts/run_local.ps1)
- Server: [server.mjs](server.mjs)

## Contributing / Notes
- Tune `similarityThreshold` in [config/settings.json](config/settings.json) to adjust precision/recall.
- Check logs/ diagnostics in `logs/` for processing snapshots.
- Add caching and rate-limit handling for production embedding providers.

<!-- EOF -->
