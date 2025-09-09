import { useEffect, useRef, useCallback } from 'react';

import { logger } from '../utils/logger';

/**
 * Custom hook for monitoring component performance
 * Tracks render times, memory usage, and provides performance insights
 */
export const usePerformanceMonitor = (componentName, options = {}) => {
  const {
    trackRenders = true,
    trackMemory = false,
    logThreshold = 16, // Log if render takes more than 16ms (60fps threshold)
    enableProfiling = process.env.NODE_ENV === 'development',
  } = options;

  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const performanceDataRef = useRef({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
  });

  // Track render start
  const startRender = useCallback(() => {
    if (enableProfiling) {
      startTimeRef.current = performance.now();
    }
  }, [enableProfiling]);

  // Track render end
  const endRender = useCallback(() => {
    if (!enableProfiling) return;

    const renderTime = performance.now() - startTimeRef.current;
    renderCountRef.current += 1;
    lastRenderTimeRef.current = renderTime;

    // Update performance data
    const data = performanceDataRef.current;
    data.renderCount += 1;
    data.totalRenderTime += renderTime;
    data.averageRenderTime = data.totalRenderTime / data.renderCount;
    data.maxRenderTime = Math.max(data.maxRenderTime, renderTime);
    data.minRenderTime = Math.min(data.minRenderTime, renderTime);

    // Log slow renders
    if (renderTime > logThreshold) {
      logger.warn(
        `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
      );
    }

    // Log performance summary every 100 renders
    if (data.renderCount % 100 === 0) {
      logger.info(`${componentName} Performance Summary:`, {
        renderCount: data.renderCount,
        averageRenderTime: data.averageRenderTime.toFixed(2),
        maxRenderTime: data.maxRenderTime.toFixed(2),
        minRenderTime: data.minRenderTime.toFixed(2),
      });
    }
  }, [componentName, logThreshold, enableProfiling]);

  // Track memory usage
  const trackMemoryUsage = useCallback(() => {
    if (!trackMemory || !enableProfiling) return;

    if ('memory' in performance) {
      const memory = performance.memory;
      logger.debug(`${componentName} Memory Usage:`, {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      });
    }
  }, [componentName, trackMemory, enableProfiling]);

  // Get current performance data
  const getPerformanceData = useCallback(() => {
    return {
      ...performanceDataRef.current,
      lastRenderTime: lastRenderTimeRef.current,
    };
  }, []);

  // Reset performance data
  const resetPerformanceData = useCallback(() => {
    performanceDataRef.current = {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
    };
    renderCountRef.current = 0;
    lastRenderTimeRef.current = 0;
  }, []);

  // Track renders automatically
  useEffect(() => {
    if (trackRenders) {
      startRender();
      return () => endRender();
    }
  }, [trackRenders, startRender, endRender]);

  // Track memory usage periodically
  useEffect(() => {
    if (trackMemory) {
      const interval = setInterval(trackMemoryUsage, 5000); // Every 5 seconds
      return () => clearInterval(interval);
    }
  }, [trackMemory, trackMemoryUsage]);

  return {
    startRender,
    endRender,
    getPerformanceData,
    resetPerformanceData,
    trackMemoryUsage,
  };
};

/**
 * Hook for measuring function execution time
 */
export const usePerformanceTimer = () => {
  const startTime = useRef(0);

  const start = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const end = useCallback(functionName => {
    const duration = performance.now() - startTime.current;
    logger.debug(`${functionName} execution time: ${duration.toFixed(2)}ms`);
    return duration;
  }, []);

  return { start, end };
};

/**
 * Hook for measuring async function execution time
 */
export const useAsyncPerformanceTimer = () => {
  const startTime = useRef(0);

  const start = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const end = useCallback(async (asyncFunction, functionName) => {
    const result = await asyncFunction();
    const duration = performance.now() - startTime.current;
    logger.debug(`${functionName} execution time: ${duration.toFixed(2)}ms`);
    return { result, duration };
  }, []);

  return { start, end };
};
