import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAIEmbeddings, computeSimilarityMatrix, clusterSimilarImages } from '../lib/clipProcessor.js';
import { processFallback } from '../lib/fallbackProcessor.js';

// Helper: Generate embeddings using Hugging Face Inference API (CLIP-style models)
// Requires HUGGINGFACE_API_KEY in environment. This is a simple implementation
// that POSTs image URLs to the HF feature-extraction pipeline. For production
// consider batching, retries, rate-limit handling and using binary uploads for
// better performance.
async function generateHFEmbeddings(images, model = 'openai/clip-vit-base-patch32') {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) throw new Error('Hugging Face API key not configured');

  const embeddings = [];

  // Send requests sequentially to avoid aggressive rate limits — you may
  // parallelize with a limited concurrency (eg. p-limit) if you need speed.
  for (const img of images) {
    try {
      const resp = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: img.url || img })
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HF inference error: ${resp.status} ${resp.statusText} - ${text}`);
      }

      const data = await resp.json();

      // HF returns nested arrays for feature-extraction; try to normalize
      // to a simple 1D embedding vector per image.
      const vector = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
      embeddings.push(vector);

    } catch (err) {
      // Surface which image failed for debugging
      throw new Error(`Failed to generate HF embedding for ${img.url || img}: ${err.message}`);
    }
  }

  return embeddings;
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images, similarityThreshold = 0.88 } = req.body;

  // Write a diagnostic snapshot of the incoming request to disk to help
  // debug shape issues seen in processors.
  try {
    const fs = await import('fs');
    const logDir = 'logs';
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const snapshot = {
      time: new Date().toISOString(),
      keys: Object.keys(req.body || {}),
      imagesType: Array.isArray(images) ? 'array' : typeof images,
      imagesLength: Array.isArray(images) ? images.length : null,
      sample0: Array.isArray(images) && images[0] ? (typeof images[0] === 'string' ? images[0] : (images[0].url || images[0].id || null)) : null
    };
    fs.appendFileSync(`${logDir}/request-snap.log`, JSON.stringify(snapshot) + '\n');
  } catch (e) {
    console.warn('Failed to write request snapshot:', e.message);
  }

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Images array required' });
  }

  // If Gemini (Google) key is not configured, we may attempt Hugging Face
  // embeddings as a cloud alternative. We no longer force an immediate
  // dHash fallback here so that a configured `LOCAL_CLIP_URL` can be used
  // as the preferred embedding backend.
  let useHF = false
  if (!process.env.GOOGLE_API_KEY && process.env.HUGGINGFACE_API_KEY) {
    console.log('Google API key not configured, attempting Hugging Face embeddings')
    useHF = true
  }

  try {
    console.log(`Processing ${images.length} images with Gemini AI embeddings`);
    const startTime = Date.now();
    const performanceMetrics = {
      startTime,
      embeddingTime: 0,
      similarityTime: 0,
      clusteringTime: 0,
      totalTime: 0
    };

    // Allow a per-request override for the local CLIP URL so we can test
    // the local service without restarting the Node process with env vars.
    const requestLocalUrl = req.body?.local_clip_url || req.body?.localClipUrl;
    console.log('Request body keys:', Object.keys(req.body || {}));

      // Step 1: Generate AI embeddings
      let embeddings
      let algorithmUsed = 'unknown'
    // Embedding selection order:
    // 1. LOCAL_CLIP_URL (local FastAPI service)
    // 2. Gemini Vision (Google) if available
    // 3. Hugging Face Inference API (if HUGGINGFACE_API_KEY set)
    // 4. dHash fallback handled elsewhere
    const effectiveLocalUrl = requestLocalUrl || process.env.LOCAL_CLIP_URL
    if (effectiveLocalUrl) {
      console.log('Generating embeddings via local CLIP service at', effectiveLocalUrl)
      // Preflight: call the local /embeddings endpoint directly to capture
      // the exact returned JSON shape for debugging.
      try {
        const preUrl = `${effectiveLocalUrl.replace(/\/$/, '')}/embeddings`;
        const preResp = await fetch(preUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: images.map(i => i.url || i) }) });
        const preText = await preResp.text();
        try { const fs = await import('fs'); if (!fs.existsSync('logs')) fs.mkdirSync('logs'); fs.appendFileSync('logs/local-preflight.log', new Date().toISOString() + ` - ${preUrl} -> ${preResp.status}\n` + preText.slice(0,2000) + '\n----\n'); } catch(e){}
      } catch (pfErr) {
        try { const fs = await import('fs'); if (!fs.existsSync('logs')) fs.mkdirSync('logs'); fs.appendFileSync('logs/local-preflight.log', new Date().toISOString() + ' - preflight error: ' + pfErr.message + '\n'); } catch(e){}
      }

      try {
        embeddings = await generateLocalEmbeddings(images, effectiveLocalUrl)
        algorithmUsed = 'Local-CLIP'
      } catch (localErr) {
        console.error('Local CLIP embedding call failed:', localErr);
        // persist diagnostic
        try {
          const fs = await import('fs');
          const logDir = 'logs';
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
          fs.appendFileSync(`${logDir}/local-err.log`, new Date().toISOString() + ' - ' + (localErr.message || String(localErr)) + '\n');
        } catch (fsErr) {
          console.warn('Failed to write local error log:', fsErr.message);
        }
        throw localErr;
      }
    } else if (process.env.GOOGLE_API_KEY) {
      console.log('Generating embeddings via Gemini Vision...')
      embeddings = await generateAIEmbeddings(images, geminiModel, (progress) => {
        console.log(`Embedding progress: ${progress.completed}/${progress.total}`)
      })
      algorithmUsed = 'Gemini-Vision'
    } else if (process.env.HUGGINGFACE_API_KEY) {
      console.log('Generating embeddings via Hugging Face...')
      embeddings = await generateHFEmbeddings(images)
      algorithmUsed = 'HuggingFace'
    } else {
      // Shouldn't reach here because earlier code falls back to dHash, but guard anyway
      throw new Error('No embedding backend available')
    }

    performanceMetrics.embeddingTime = Date.now() - startTime;
    console.log(`Generated ${embeddings.length} embeddings in ${performanceMetrics.embeddingTime}ms`);
    // Debug: log a small sample of the embedding shape
    try {
      const sample0 = embeddings[0];
      console.log('Embedding sample 0:', sample0 && (Array.isArray(sample0.embedding) ? `array(${sample0.embedding.length})` : typeof sample0.embedding));
    } catch (dbgErr) {
      console.warn('Failed to inspect embedding sample:', dbgErr.message);
    }

    // Step 2: Compute similarity matrix
    const similarityStart = Date.now();
    let similarityMatrix
    try {
        similarityMatrix = computeSimilarityMatrix(embeddings);
    } catch (simErr) {
        // Persist a diagnostic dump to disk for easier debugging from PowerShell
        try {
          const fs = await import('fs');
          const dump = {
            time: new Date().toISOString(),
            error: simErr.message,
            embeddingsPreview: Array.isArray(embeddings) ? (embeddings[0] ? (Array.isArray(embeddings[0].embedding) ? embeddings[0].embedding.slice(0,20) : embeddings[0].embedding) : null) : null
          };
          const logDir = 'logs';
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
          fs.appendFileSync(`${logDir}/process-debug.log`, JSON.stringify(dump) + '\n');
        } catch (fsErr) {
          console.warn('Failed to write diagnostic log:', fsErr.message);
        }
      console.error('Failed computing similarity matrix:', simErr);
      // Return diagnostic information to help debug malformed embeddings
      return res.status(500).json({
        error: 'Similarity computation failed',
        message: simErr.message,
        embeddingsDebug: {
          count: Array.isArray(embeddings) ? embeddings.length : 0,
          sample0: embeddings && embeddings[0] ? (Array.isArray(embeddings[0].embedding) ? embeddings[0].embedding.slice(0, 10) : embeddings[0].embedding) : null
        }
      });
    }
    performanceMetrics.similarityTime = Date.now() - similarityStart;
    console.log(`Computed similarity matrix: ${similarityMatrix.length}x${similarityMatrix[0].length} in ${performanceMetrics.similarityTime}ms`);

    // Step 3: Cluster similar images
    const clusteringStart = Date.now();
    const clusters = clusterSimilarImages(images, similarityMatrix, similarityThreshold);
    performanceMetrics.clusteringTime = Date.now() - clusteringStart;
    
    // Filter out single-image clusters (not duplicates)
    const duplicateClusters = clusters.filter(cluster => cluster.images.length > 1);

    performanceMetrics.totalTime = Date.now() - startTime;
    
    const response = {
      success: true,
      processingTime: performanceMetrics.totalTime,
      totalImages: images.length,
      duplicateClusters: duplicateClusters.length,
      totalDuplicateImages: duplicateClusters.reduce((sum, cluster) => sum + cluster.images.length, 0),
      similarityThreshold,
  algorithm: algorithmUsed,
      performance: {
        embeddingTime: performanceMetrics.embeddingTime,
        similarityTime: performanceMetrics.similarityTime,
        clusteringTime: performanceMetrics.clusteringTime,
        totalTime: performanceMetrics.totalTime,
        imagesPerSecond: (images.length / (performanceMetrics.totalTime / 1000)).toFixed(2)
      },
      results: {
        clusters: duplicateClusters.map((cluster, index) => ({
          id: index,
          size: cluster.images.length,
          avgSimilarity: cluster.avgSimilarity,
          images: cluster.images.map(img => ({
            id: img.id,
            brand: img.brand,
            url: img.url,
            similarity: img.similarity || null
          }))
        })),
        stats: {
          totalClusters: duplicateClusters.length,
          largestCluster: Math.max(...duplicateClusters.map(c => c.images.length), 0),
          avgClusterSize: duplicateClusters.length > 0 
            ? (duplicateClusters.reduce((sum, c) => sum + c.images.length, 0) / duplicateClusters.length).toFixed(2)
            : 0
        }
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Gemini processing error:', error);
    
    // Try fallback processing when Gemini fails
    console.log('Attempting fallback processing with dHash...');
    try {
      const fallbackResult = await processFallback(images, similarityThreshold);
      // Add a flag to indicate fallback was used
      fallbackResult.usedFallback = true;
      fallbackResult.fallbackReason = error.message;
      
      return res.status(200).json(fallbackResult);
      
    } catch (fallbackError) {
      console.error('Fallback processing also failed:', fallbackError);
      
      // Both methods failed - return appropriate error
      if (error.message?.includes('timeout')) {
        return res.status(408).json({
          success: false,
          error: 'Processing timeout - dataset too large for current configuration',
          suggestion: 'Try processing fewer brands or smaller image sets'
        });
      }
      
      if (error.message?.includes('API')) {
        return res.status(502).json({
          success: false,
          error: 'Gemini API error and fallback processing failed',
          details: `Gemini: ${error.message}, Fallback: ${fallbackError.message}`,
          suggestion: 'Check API key, network connection, and try again'
        });
      }

      res.status(500).json({
        success: false,
        error: 'All image processing methods failed',
        details: `Gemini: ${error.message}, Fallback: ${fallbackError.message}`,
        suggestion: 'Check server logs and contact support if issue persists'
      });
    }
  }
}

// Helper: call a local CLIP embedding service (FastAPI) if available
async function generateLocalEmbeddings(images, localUrl = process.env.LOCAL_CLIP_URL) {
  if (!localUrl) throw new Error('LOCAL_CLIP_URL not configured')

  const payload = { images: images.map(i => i.url || i) }
  const url = `${localUrl.replace(/\/$/, '')}/embeddings`
  let resp
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Long timeout will be handled on caller side
    })
  } catch (netErr) {
    // network error when calling local service
    try { const fs = await import('fs'); if (!fs.existsSync('logs')) fs.mkdirSync('logs'); fs.appendFileSync('logs/local-emb-debug.log', new Date().toISOString() + ' - network error: ' + netErr.message + '\n'); } catch(e){}
    throw netErr
  }

  // Persist response status for diagnostics
  try {
    const fs = await import('fs'); if (!fs.existsSync('logs')) fs.mkdirSync('logs'); fs.appendFileSync('logs/local-emb-debug.log', new Date().toISOString() + ` - ${url} -> ${resp.status} ${resp.statusText}\n`);
  } catch (e) {}

  if (!resp.ok) {
    const text = await resp.text()
    try { const fs = await import('fs'); fs.appendFileSync('logs/local-emb-debug.log', 'body: ' + text + '\n'); } catch(e){}
    throw new Error(`Local embedding service error: ${resp.status} ${resp.statusText} - ${text}`)
  }

  const json = await resp.json()
  try { const fs = await import('fs'); fs.appendFileSync('logs/local-emb-debug.log', 'jsonPreview: ' + JSON.stringify(Array.isArray(json.embeddings) ? json.embeddings.slice(0,3) : json).slice(0,200) + '\n'); } catch(e){}
  // The local service returns raw numeric vectors. Normalize to the
  // { embedding: [...] } shape expected by computeSimilarityMatrix
  if (!Array.isArray(json.embeddings)) {
    throw new Error('Local embedding service returned invalid payload')
  }

  return json.embeddings.map(vec => {
    // If service already returned objects with `embedding`, pass through
    if (vec && typeof vec === 'object' && Array.isArray(vec.embedding)) return vec
    return { embedding: vec }
  })
}