import React, { useState, useEffect } from 'react'
import { apiService } from '../services/api'

// Default brands for fallback
const defaultBrands = [
  {
    key: 'nike',
    name: 'Nike',
    description: 'Athletic wear and sportswear',
    color: 'bg-orange-500',
    estimatedImages: '180+'
  },
  {
    key: 'levis-1',
    name: "Levi's",
    description: 'Denim and casual wear',
    color: 'bg-blue-600',
    estimatedImages: '85+'
  },
  {
    key: 'gonoise',
    name: 'GoNoise',
    description: 'Audio accessories and tech',
    color: 'bg-purple-500',
    estimatedImages: '85+'
  }
]

const BrandSelector = ({ selectedBrands, onBrandsChange }) => {
  const [brands, setBrands] = useState(defaultBrands)
  const [availableBrands, setAvailableBrands] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Load available brands dynamically
  useEffect(() => {
    const loadAvailableBrands = async () => {
      setIsLoading(true)
      try {
        // Test common brand keys to see which ones are available
        const testBrands = ['nike', 'levis-1', 'gonoise', 'adidas', 'puma', 'zara', 'h&m', 'uniqlo']
        const brandPromises = testBrands.map(async (brandKey) => {
          try {
            const response = await apiService.fetchImages([brandKey])
            if (response.success && response.totalImages > 0) {
              return {
                key: brandKey,
                name: brandKey.charAt(0).toUpperCase() + brandKey.slice(1).replace('-', ' '),
                description: `${brandKey} brand images`,
                color: getRandomColor(),
                estimatedImages: `${response.totalImages}+`
              }
            }
            return null
          } catch (error) {
            return null
          }
        })
        
        const availableBrands = (await Promise.all(brandPromises)).filter(Boolean)
        setAvailableBrands(availableBrands)
        setBrands(availableBrands.length > 0 ? availableBrands : defaultBrands)
      } catch (error) {
        console.warn('Failed to load available brands, using defaults:', error)
        setBrands(defaultBrands)
      } finally {
        setIsLoading(false)
      }
    }

    loadAvailableBrands()
  }, [])

  const getRandomColor = () => {
    const colors = ['bg-orange-500', 'bg-blue-600', 'bg-purple-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const toggleBrand = (brandKey) => {
    if (selectedBrands.includes(brandKey)) {
      onBrandsChange(selectedBrands.filter(b => b !== brandKey))
    } else {
      onBrandsChange([...selectedBrands, brandKey])
    }
  }

  const selectAll = () => {
    onBrandsChange(brands.map(b => b.key))
  }

  const selectNone = () => {
    onBrandsChange([])
  }

  const totalEstimated = selectedBrands.length === 0 ? 0 : 
    selectedBrands.reduce((total, brandKey) => {
      const brand = brands.find(b => b.key === brandKey)
      return total + parseInt(brand?.estimatedImages || '0')
    }, 0)

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="loading-spinner mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Discovering available brands...</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={selectAll}
            className="btn-secondary text-xs"
            disabled={selectedBrands.length === brands.length || isLoading}
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="btn-secondary text-xs"
            disabled={selectedBrands.length === 0 || isLoading}
          >
            Clear All
          </button>
        </div>
        
        {selectedBrands.length > 0 && (
          <div className="text-sm text-gray-600">
            ~{totalEstimated} images selected
          </div>
        )}
      </div>

      {/* Brand Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {brands.map((brand) => {
          const isSelected = selectedBrands.includes(brand.key)
          
          return (
            <div
              key={brand.key}
              onClick={() => toggleBrand(brand.key)}
              className={`
                relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isSelected 
                  ? 'border-primary-500 bg-primary-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              {/* Selection Indicator */}
              <div className="absolute top-3 right-3">
                <div className={`
                  w-5 h-5 rounded-full border-2 transition-all duration-200
                  ${isSelected 
                    ? 'bg-primary-500 border-primary-500' 
                    : 'border-gray-300'
                  }
                `}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white m-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Brand Info */}
              <div className="pr-8">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`w-8 h-8 ${brand.color} rounded-lg flex items-center justify-center`}>
                    <span className="text-white font-bold text-sm">
                      {brand.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{brand.description}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Est. {brand.estimatedImages} images</span>
                  <span className={`
                    px-2 py-1 rounded-full text-xs font-medium
                    ${isSelected 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                    }
                  `}>
                    {isSelected ? 'Selected' : 'Available'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selection Summary */}
      {selectedBrands.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Processing Plan</h4>
              <p className="text-sm text-blue-700">
                Will process <strong>~{totalEstimated} images</strong> from{' '}
                <strong>{selectedBrands.length} brand{selectedBrands.length > 1 ? 's' : ''}</strong> using CLIP embeddings.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Estimated processing time: {Math.ceil(totalEstimated / 50)} - {Math.ceil(totalEstimated / 30)} seconds
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrandSelector