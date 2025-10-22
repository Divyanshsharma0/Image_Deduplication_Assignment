import React, { useState } from 'react'
import BrandSelector from './components/BrandSelector'
import ProcessingStatus from './components/ProcessingStatus'
import ResultsView from './components/ResultsView'
import Header from './components/Header'
import { useImageProcessing } from './hooks/useImageProcessing'

function App() {
  const [selectedBrands, setSelectedBrands] = useState(['levis-1'])
  const { processImages, isLoading, results, error, progress } = useImageProcessing()

  const handleProcess = async () => {
    await processImages(selectedBrands)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Brand Selection */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Select Brand Datasets
            </h2>
            <BrandSelector 
              selectedBrands={selectedBrands}
              onBrandsChange={setSelectedBrands}
            />
            
            <div className="mt-6">
              <button
                onClick={handleProcess}
                disabled={isLoading || selectedBrands.length === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner mr-2"></span>
                    Processing Images...
                  </>
                ) : (
                  'Find Duplicate Images'
                )}
              </button>
            </div>
          </div>

          {/* Processing Status */}
          {(isLoading || progress.total > 0) && (
            <ProcessingStatus 
              progress={progress}
              isLoading={isLoading}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="card border-red-200 bg-red-50">
              <div className="text-red-800">
                <h3 className="font-semibold">Error Processing Images</h3>
                <p className="mt-2 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !isLoading && (
            <ResultsView results={results} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App