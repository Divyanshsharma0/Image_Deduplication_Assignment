import { useState, useCallback } from 'react'
import { apiService } from '../services/api'

export const useImageProcessing = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    stage: '',
    batchProgress: '',
    stats: null
  })

  const processImages = useCallback(async (selectedBrands) => {
    if (!selectedBrands || selectedBrands.length === 0) {
      setError('Please select at least one brand to process')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults(null)
    setProgress({
      completed: 0,
      total: 0,
      stage: 'fetching',
      batchProgress: '',
      stats: null
    })

    try {
      // Step 1: Fetch images from brand APIs
      console.log('Fetching images for brands:', selectedBrands)
      setProgress(prev => ({
        ...prev,
        stage: 'fetching',
        batchProgress: 'Connecting to brand APIs...'
      }))

      const imagesResponse = await apiService.fetchImages(selectedBrands)
      
      if (!imagesResponse.success) {
        throw new Error(imagesResponse.error || 'Failed to fetch images')
      }

      console.log(`Fetched ${imagesResponse.totalImages} images`)
      
      setProgress(prev => ({
        ...prev,
        total: imagesResponse.totalImages,
        stage: 'embeddings',
        batchProgress: `Found ${imagesResponse.totalImages} images`,
        stats: {
          totalImages: imagesResponse.totalImages,
          embeddings: 0,
          comparisons: 0,
          clusters: 0
        }
      }))

      // Step 2: Process images with CLIP
      console.log('Processing images with CLIP embeddings')
      
      const processResponse = await apiService.processImages(imagesResponse.images, {
        onProgress: (progressData) => {
          setProgress(prev => ({
            ...prev,
            completed: progressData.completed || prev.completed,
            batchProgress: progressData.batchProgress || prev.batchProgress,
            stage: progressData.stage || prev.stage,
            stats: {
              ...prev.stats,
              embeddings: progressData.completed || prev.completed,
              comparisons: progressData.comparisons || prev.stats?.comparisons || 0,
              clusters: progressData.clusters || prev.stats?.clusters || 0
            }
          }))
        }
      })

      if (!processResponse.success) {
        throw new Error(processResponse.error || 'Failed to process images')
      }

      console.log('Processing completed:', processResponse)

      // Final progress update
      setProgress(prev => ({
        ...prev,
        stage: 'completed',
        completed: imagesResponse.totalImages,
        batchProgress: 'Processing complete',
        stats: {
          totalImages: imagesResponse.totalImages,
          embeddings: imagesResponse.totalImages,
          comparisons: Math.pow(imagesResponse.totalImages, 2),
          clusters: processResponse.duplicateClusters
        }
      }))

      setResults(processResponse)
      
    } catch (err) {
      console.error('Processing error:', err)
      setError(err.message || 'An unexpected error occurred')
      
      // Reset progress on error
      setProgress({
        completed: 0,
        total: 0,
        stage: 'error',
        batchProgress: '',
        stats: null
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults(null)
    setError(null)
    setProgress({
      completed: 0,
      total: 0,
      stage: '',
      batchProgress: '',
      stats: null
    })
  }, [])

  const resetProgress = useCallback(() => {
    setProgress({
      completed: 0,
      total: 0,
      stage: '',
      batchProgress: '',
      stats: null
    })
  }, [])

  return {
    processImages,
    clearResults,
    resetProgress,
    isLoading,
    results,
    error,
    progress
  }
}