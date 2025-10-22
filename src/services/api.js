import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minute timeout for long-running CLIP processing
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timeout - processing took too long'))
    }
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || error.response.data?.message || 'Server error'
      return Promise.reject(new Error(message))
    } else if (error.request) {
      // Request made but no response received
      return Promise.reject(new Error('Network error - please check your connection'))
    } else {
      // Something else happened
      return Promise.reject(new Error(error.message || 'An unexpected error occurred'))
    }
  }
)

export const apiService = {
  /**
   * Fetch images from brand APIs
   */
  async fetchImages(brands) {
    try {
      const brandsParam = Array.isArray(brands) ? brands.join(',') : brands
      const response = await api.get('/images', {
        params: { brands: brandsParam }
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to fetch images:', error)
      throw error
    }
  },

  /**
   * Process images using CLIP embeddings
   */
  async processImages(images, options = {}) {
    try {
      const { onProgress, similarityThreshold = 0.88 } = options
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new Error('Images array is required')
      }

      // Simulate progress updates for demo purposes
      // In a real implementation, you might use Server-Sent Events or WebSockets
      if (onProgress) {
        // Simulate fetching stage
        onProgress({
          stage: 'embeddings',
          completed: 0,
          total: images.length,
          batchProgress: 'Initializing CLIP processing...'
        })
        
        // Simulate embedding generation progress
        const progressSteps = 5
        for (let i = 1; i <= progressSteps; i++) {
          await new Promise(resolve => setTimeout(resolve, 200))
          onProgress({
            stage: 'embeddings',
            completed: Math.floor((images.length * i) / progressSteps),
            total: images.length,
            batchProgress: `Processing batch ${i}/${progressSteps}...`
          })
        }
        
        // Simulate similarity computation
        onProgress({
          stage: 'similarity',
          completed: images.length,
          total: images.length,
          batchProgress: 'Computing similarity matrix...',
          comparisons: Math.pow(images.length, 2)
        })
        
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Simulate clustering
        onProgress({
          stage: 'clustering',
          completed: images.length,
          total: images.length,
          batchProgress: 'Clustering similar images...'
        })
        
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const response = await api.post('/process', {
        images,
        similarityThreshold,
        local_clip_url: 'http://localhost:8000'
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to process images:', error)
      
      // Handle specific error cases
      if (error.message?.includes('timeout')) {
        throw new Error('Processing timeout - the dataset might be too large. Try processing fewer brands.')
      }
      
      if (error.message?.includes('API key')) {
        throw new Error('OpenAI API key not configured. Please check server configuration.')
      }
      
      throw error
    }
  },

  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      const response = await api.get('/health')
      return response.data
    } catch (error) {
      console.error('API connection test failed:', error)
      throw error
    }
  }
}

export default apiService