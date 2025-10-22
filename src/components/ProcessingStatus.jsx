import React from 'react'

const ProcessingStatus = ({ progress, isLoading }) => {
  const { completed = 0, total = 0, batchProgress = '', stage = 'Processing' } = progress

  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0
  
  const stages = [
    { name: 'Fetching Images', icon: '📥', completed: progress.stage === 'fetching' || progress.stage === 'completed' },
    { name: 'Generating Embeddings', icon: '🧠', completed: progress.stage === 'embeddings' || progress.stage === 'completed' },
    { name: 'Computing Similarities', icon: '🔄', completed: progress.stage === 'similarity' || progress.stage === 'completed' },
    { name: 'Clustering Results', icon: '📊', completed: progress.stage === 'clustering' || progress.stage === 'completed' }
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {isLoading ? 'Processing Images...' : 'Processing Complete'}
        </h3>
        {isLoading && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="loading-spinner"></div>
            <span>{stage}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress: {completed} / {total} images</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {batchProgress && (
            <p className="text-xs text-gray-500 mt-1">Batch: {batchProgress}</p>
          )}
        </div>
      )}

      {/* Processing Stages */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Processing Pipeline</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((stageItem, index) => (
            <div
              key={index}
              className={`
                flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200
                ${stageItem.completed 
                  ? 'bg-green-50 border-green-200' 
                  : isLoading && progress.stage === stageItem.name.toLowerCase().replace(/\s+/g, '')
                    ? 'bg-blue-50 border-blue-200 animate-pulse'
                    : 'bg-gray-50 border-gray-200'
                }
              `}
            >
              <div className="text-lg">{stageItem.icon}</div>
              <div>
                <p className={`text-sm font-medium ${
                  stageItem.completed ? 'text-green-700' : 'text-gray-600'
                }`}>
                  {stageItem.name}
                </p>
                <div className="flex items-center mt-1">
                  {stageItem.completed ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isLoading && progress.stage === stageItem.name.toLowerCase().replace(/\s+/g, '') ? (
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <div className="w-4 h-4 border border-gray-300 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm Info - Only show when processing is complete */}
      {!isLoading && progress.stage === 'completed' && (
        <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <div>
              <h4 className="font-semibold text-purple-900">CLIP Semantic Analysis</h4>
              <p className="text-sm text-purple-700">
                Using advanced AI to understand image content and detect visual similarities beyond pixel-level comparison.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Stats */}
      {progress.stats && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{progress.stats.totalImages || total}</div>
            <div className="text-xs text-gray-600">Total Images</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{progress.stats.embeddings || completed}</div>
            <div className="text-xs text-gray-600">Embeddings</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{progress.stats.comparisons || 'N/A'}</div>
            <div className="text-xs text-gray-600">Comparisons</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{progress.stats.clusters || 'N/A'}</div>
            <div className="text-xs text-gray-600">Clusters</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessingStatus