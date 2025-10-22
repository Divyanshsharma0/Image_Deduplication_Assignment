import React, { useState } from 'react'

const ResultsView = ({ results }) => {
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [imageLoadErrors, setImageLoadErrors] = useState(new Set())

  if (!results || !results.results) {
    return (
      <div className="card">
        <div className="text-center text-gray-500">
          <p>No results to display</p>
        </div>
      </div>
    )
  }

  const { clusters, stats } = results.results
  const { processingTime, algorithm, similarityThreshold } = results

  const handleImageError = (imageId) => {
    setImageLoadErrors(prev => new Set([...prev, imageId]))
  }

  const formatTime = (ms) => {
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
  }

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Deduplication Results</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Completed in {formatTime(processingTime)}</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{results.totalImages}</div>
            <div className="text-sm text-blue-700">Total Images</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-3xl font-bold text-green-600">{stats.totalClusters}</div>
            <div className="text-sm text-green-700">Duplicate Groups</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-3xl font-bold text-purple-600">{results.totalDuplicateImages}</div>
            <div className="text-sm text-purple-700">Duplicate Images</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-3xl font-bold text-orange-600">{stats.avgClusterSize}</div>
            <div className="text-sm text-orange-700">Avg Group Size</div>
          </div>
        </div>

        {/* Algorithm Info */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900">
                {algorithm === 'Local-CLIP' ? 'CLIP Semantic Analysis' : `${algorithm} Algorithm`}
              </h3>
              <p className="text-sm text-indigo-700">Similarity threshold: {(similarityThreshold * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="text-right text-sm text-indigo-600">
            <div>Semantic similarity detection</div>
            <div>Content-aware clustering</div>
          </div>
        </div>
      </div>

      {/* Results */}
      {clusters.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Duplicates Found</h3>
          <p className="text-gray-500">
            All images appear to be unique based on CLIP similarity analysis.
            Try adjusting the similarity threshold or processing more images.
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">
            Duplicate Image Groups ({clusters.length})
          </h3>
          
          <div className="space-y-6">
            {clusters.map((cluster) => (
              <div key={cluster.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
                      {cluster.id + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        Group {cluster.id + 1} - {cluster.size} images
                      </h4>
                      <p className="text-sm text-gray-600">
                        Avg similarity: {(cluster.avgSimilarity * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedCluster(selectedCluster === cluster.id ? null : cluster.id)}
                    className="btn-secondary text-sm"
                  >
                    {selectedCluster === cluster.id ? 'Collapse' : 'View Details'}
                  </button>
                </div>

                {/* Image Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {cluster.images.map((image, idx) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors">
                        {imageLoadErrors.has(image.id) ? (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={image.url}
                            alt={`${image.brand} - ${image.id}`}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(image.id)}
                            loading="lazy"
                          />
                        )}
                        
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-end">
                          <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-white text-xs">
                              <div className="font-medium">{image.brand}</div>
                              {image.similarity && image.similarity !== 1.0 && (
                                <div>{(image.similarity * 100).toFixed(1)}% similar</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Brand Badge */}
                      <div className={`
                        absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white
                        ${image.brand === 'nike' ? 'bg-orange-500' : 
                          image.brand === 'levis' ? 'bg-blue-600' : 'bg-purple-500'}
                      `}>
                        {image.brand.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detailed View */}
                {selectedCluster === cluster.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-2">Similarity Scores</h5>
                        <div className="space-y-1 text-sm">
                          {cluster.images.map((image, idx) => (
                            <div key={image.id} className="flex justify-between">
                              <span className="text-gray-600">{image.brand} - {image.id}</span>
                              <span className={`font-medium ${
                                image.similarity >= 0.95 ? 'text-green-600' :
                                image.similarity >= 0.90 ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                {image.similarity ? `${(image.similarity * 100).toFixed(1)}%` : 'Reference'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-2">Brand Distribution</h5>
                        <div className="space-y-1 text-sm">
                          {Object.entries(
                            cluster.images.reduce((acc, img) => {
                              acc[img.brand] = (acc[img.brand] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([brand, count]) => (
                            <div key={brand} className="flex justify-between">
                              <span className="text-gray-600 capitalize">{brand}</span>
                              <span className="font-medium text-gray-800">{count} images</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsView