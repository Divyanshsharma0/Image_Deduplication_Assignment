import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import imagesHandler from './api/images.js'
import processHandler from './api/process.js'
import healthHandler from './api/health.js'

const app = express()
app.use(cors())
app.use(bodyParser.json({ limit: '10mb' }))

// Simple request logging
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
	next()
})

// Remove any overly restrictive Content-Security-Policy header that might be
// injected by proxies or tools, to avoid blocking local DevTools requests.
app.use((req, res, next) => {
  try { res.removeHeader && res.removeHeader('Content-Security-Policy') } catch (e) {}
  next()
})

// Mount handlers
app.get('/api/images', (req, res) => imagesHandler(req, res))
app.post('/api/process', (req, res) => processHandler(req, res))
app.get('/api/health', (req, res) => healthHandler(req, res))

// Simple root endpoint so visiting the API port in a browser returns useful info
app.get('/', (req, res) => {
	res.status(200).json({ success: true, message: 'Dev API server', endpoints: ['/api/health', '/api/images', '/api/process'] })
})

// Some tools (Chrome DevTools) attempt to fetch a well-known JSON when
// debugging. Return a 200 with empty JSON to avoid console CSP/connect errors.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
	res.status(200).json({})
})

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => console.log(`Dev API server listening on http://localhost:${PORT}`))

// Increase server timeout to allow long-running image processing (10 minutes)
server.timeout = 10 * 60 * 1000 // 10 minutes in ms
