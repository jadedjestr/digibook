import PropTypes from 'prop-types';
import { useState, useEffect, useMemo } from 'react';

import { formatCurrency } from '../utils/accountUtils';

import PrivacyWrapper from './PrivacyWrapper';

const DonutChart = ({
  data,
  totalAmount,
  onSegmentClick,
  size = 200,
  showTotalUnderLegend = false,
  hideTable = false,
}) => {
  const [animatedSegments, setAnimatedSegments] = useState({});

  const radius = size * 0.4;
  const centerX = size / 2;
  const centerY = size / 2;
  const strokeWidth = size * 0.1;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative percentages for positioning segments - memoized to prevent recalculation
  const segments = useMemo(() => {
    let cumulativeLength = 0;
    return data.map(category => {
      const segmentLength =
        Math.round((category.percentage / 100) * circumference * 100) / 100;
      const startPercentage = (cumulativeLength / circumference) * 100;

      // Calculate offset: negative value moves the dash pattern counter-clockwise
      // Each segment should start where the previous one ended
      // First segment starts at 0, subsequent segments are offset by cumulative length before them
      const offset = Math.round(-cumulativeLength * 100) / 100;

      cumulativeLength += segmentLength;
      const endPercentage = (cumulativeLength / circumference) * 100;

      return {
        ...category,
        segmentLength: Math.round(segmentLength * 100) / 100,
        offset: Math.round(offset * 100) / 100,
        startPercentage,
        endPercentage,
      };
    });
  }, [data, circumference]);

  // Animate segments on mount - use segments directly since it's memoized
  useEffect(() => {
    // Only animate if we have segments
    if (segments.length === 0) return;

    const animationDelays = {};
    segments.forEach((segment, index) => {
      animationDelays[segment.name] = index * 50;
    });

    const timers = Object.entries(animationDelays).map(([name, delay]) =>
      setTimeout(() => {
        setAnimatedSegments(prev => ({ ...prev, [name]: true }));
      }, delay),
    );

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [segments]); // segments is memoized, only changes when data/circumference change

  const handleSegmentClick = categoryName => {
    onSegmentClick?.(categoryName);
  };

  const handleKeyDown = (e, categoryName) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSegmentClick(categoryName);
    }
  };

  const chartContent = (
    <div className='flex justify-center items-center w-full'>
      <div className='relative' style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className='w-full h-full'
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill='none'
            stroke='rgba(255, 255, 255, 0.1)'
            strokeWidth={strokeWidth}
          />

          {/* Category segments */}
          {segments.map((segment, _index) => {
            const _isAnimated = animatedSegments[segment.name];

            return (
              <circle
                key={segment.name}
                cx={centerX}
                cy={centerY}
                r={radius}
                fill='none'
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeLinecap='round'
                strokeDasharray={`${Math.round(segment.segmentLength * 100) / 100} ${Math.round((circumference - segment.segmentLength) * 100) / 100}`}
                strokeDashoffset={Math.round(segment.offset * 100) / 100}
                className='cursor-pointer transition-all duration-300 hover:opacity-80'
                style={{
                  opacity: 1, // Always visible - animation removed to ensure segments render
                  transition: 'stroke-width 0.2s ease',
                }}
                onClick={() => handleSegmentClick(segment.name)}
                onKeyDown={e => handleKeyDown(e, segment.name)}
                onMouseEnter={e => {
                  e.currentTarget.style.strokeWidth = strokeWidth * 1.2;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.strokeWidth = strokeWidth;
                }}
                role='button'
                tabIndex={0}
                aria-label={`${segment.name}: ${formatCurrency(segment.amount)} (${segment.percentage.toFixed(1)}% of total). Click to view details.`}
              />
            );
          })}
        </svg>

        {/* Center text - div is outside SVG so no rotation needed */}
        <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
          <div className='text-sm text-white/60 mb-1'>Total Budgeted</div>
          <PrivacyWrapper>
            <div className='text-2xl font-bold text-white'>
              {formatCurrency(totalAmount)}
            </div>
          </PrivacyWrapper>
        </div>
      </div>
    </div>
  );

  if (hideTable) return chartContent;

  return (
    <div className='flex flex-col lg:flex-row gap-6 w-full'>
      {/* Legend - Left side (40% on desktop, full width on mobile) */}
      <div className='w-full lg:w-[40%] flex flex-col'>
        <div className='glass-scroll-container max-h-[400px]'>
          <table className='glass-table w-full'>
            <thead>
              <tr>
                <th className='w-8' />
                <th className='text-left'>Category</th>
                <th className='text-right w-20'>%</th>
                <th className='text-right'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {segments.map(segment => (
                <tr
                  key={segment.name}
                  className='cursor-pointer hover:bg-white/10 transition-colors'
                  onClick={() => handleSegmentClick(segment.name)}
                  onKeyDown={e => handleKeyDown(e, segment.name)}
                  role='button'
                  tabIndex={0}
                  aria-label={`${segment.name}: ${formatCurrency(segment.amount)} (${segment.percentage.toFixed(1)}% of total). Click to view details.`}
                >
                  <td className='py-1.5'>
                    <div
                      className='w-3 h-3 rounded-full mx-auto'
                      style={{ backgroundColor: segment.color }}
                      aria-hidden='true'
                    />
                  </td>
                  <td className='py-1.5'>
                    <span className='text-sm text-white/90'>
                      {segment.name}
                    </span>
                  </td>
                  <td className='py-1.5 text-right'>
                    <span className='text-xs text-white/50'>
                      {segment.percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className='py-1.5 text-right'>
                    <span className='text-sm text-white/70 font-medium'>
                      {formatCurrency(segment.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total Budgeted - Underneath legend (only if showTotalUnderLegend is true) */}
        {showTotalUnderLegend && (
          <div className='mt-3 pt-3 border-t border-white/10'>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-white/70'>Total Budgeted</span>
              <PrivacyWrapper>
                <span className='text-lg font-bold text-white'>
                  {formatCurrency(totalAmount)}
                </span>
              </PrivacyWrapper>
            </div>
          </div>
        )}
      </div>

      {/* Chart - Right side (60% on desktop, full width on mobile) */}
      {chartContent}
    </div>
  );
};

DonutChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      amount: PropTypes.number,
      percentage: PropTypes.number,
      color: PropTypes.string,
    }),
  ).isRequired,
  totalAmount: PropTypes.number.isRequired,
  onSegmentClick: PropTypes.func,
  size: PropTypes.number,
  showTotalUnderLegend: PropTypes.bool,
  hideTable: PropTypes.bool,
};

export default DonutChart;
