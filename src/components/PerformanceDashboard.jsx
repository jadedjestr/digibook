import React, { useState, useEffect } from 'react';
import { BarChart3, Zap, Cpu, Clock, Eye, EyeOff } from 'lucide-react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

/**
 * Performance Dashboard Component
 * Displays real-time performance metrics and monitoring data
 * Only visible in development mode
 */
const PerformanceDashboard = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);

  const { getPerformanceData, trackMemoryUsage } = usePerformanceMonitor('PerformanceDashboard');

  // Update performance data periodically
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setPerformanceData(getPerformanceData());
      trackMemoryUsage();
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, getPerformanceData, trackMemoryUsage]);

  // Get memory usage
  useEffect(() => {
    if (!isVisible) return;

    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = performance.memory;
        setMemoryUsage({
          used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
          limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
        });
      }
    };

    updateMemoryUsage();
    const interval = setInterval(updateMemoryUsage, 2000);
    return () => clearInterval(interval);
  }, [isVisible]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
        title="Toggle Performance Dashboard"
      >
        {isVisible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>

      {/* Dashboard Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-h-96 overflow-y-auto glass-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 size={20} />
              Performance Dashboard
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-white/70 hover:text-white"
            >
              ×
            </button>
          </div>

          {/* Render Performance */}
          {performanceData && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-1">
                <Clock size={14} />
                Render Performance
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/5 p-2 rounded">
                  <div className="text-white/60">Renders</div>
                  <div className="text-white font-mono">{performanceData.renderCount}</div>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <div className="text-white/60">Avg Time</div>
                  <div className="text-white font-mono">{performanceData.averageRenderTime?.toFixed(2)}ms</div>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <div className="text-white/60">Max Time</div>
                  <div className="text-white font-mono">{performanceData.maxRenderTime?.toFixed(2)}ms</div>
                </div>
                <div className="bg-white/5 p-2 rounded">
                  <div className="text-white/60">Last Render</div>
                  <div className="text-white font-mono">{performanceData.lastRenderTime?.toFixed(2)}ms</div>
                </div>
              </div>
            </div>
          )}

          {/* Memory Usage */}
          {memoryUsage && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-1">
                <Cpu size={14} />
                Memory Usage
              </h4>
              <div className="space-y-2">
                <div className="bg-white/5 p-2 rounded">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Used</span>
                    <span className="text-white font-mono">{memoryUsage.used} MB</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(parseFloat(memoryUsage.used) / parseFloat(memoryUsage.limit)) * 100}%`
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded">
                    <div className="text-white/60">Total</div>
                    <div className="text-white font-mono">{memoryUsage.total} MB</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded">
                    <div className="text-white/60">Limit</div>
                    <div className="text-white font-mono">{memoryUsage.limit} MB</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tips */}
          <div className="text-xs text-white/60">
            <div className="flex items-center gap-1 mb-1">
              <Zap size={12} />
              Performance Tips
            </div>
            <ul className="space-y-1 text-white/50">
              <li>• Keep render times under 16ms for 60fps</li>
              <li>• Monitor memory usage for leaks</li>
              <li>• Use virtual scrolling for large lists</li>
              <li>• Memoize expensive calculations</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceDashboard;
