// Modern KPI Card Component
// Displays key performance metrics with trend indicators

import React from 'react';

export default function KPICard({
  title,
  value,
  format = 'number',
  trend = null,
  trendDirection = null,
  icon = null,
  loading = false,
  size = 'medium', // 'small', 'medium', 'large'
  color = 'blue',
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
      default:
        return new Intl.NumberFormat('en-ZA').format(val);
    }
  };

  const getColorClasses = () => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-600',
        icon: 'text-blue-500',
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-600',
        icon: 'text-green-500',
      },
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-600',
        icon: 'text-red-500',
      },
      yellow: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-600',
        icon: 'text-yellow-500',
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-600',
        icon: 'text-purple-500',
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-600',
        icon: 'text-orange-500',
      },
    };
    return colors[color] || colors.blue;
  };

  const sizeClasses = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8',
  };

  const valueSizeClasses = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-3xl',
  };

  const colorClasses = getColorClasses();
  const sizeClass = sizeClasses[size];
  const valueSizeClass = valueSizeClasses[size];

  if (loading) {
    return (
      <div className={`${sizeClass} rounded-lg border ${colorClasses.border} bg-white animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-lg border ${colorClasses.border} bg-white shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={`${valueSizeClass} font-bold ${colorClasses.text}`}>
            {formatValue(value)}
          </p>
          {trend !== null && (
            <div className="mt-2 flex items-center">
              <span
                className={`text-xs font-medium ${
                  trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {trendDirection === 'up' && '↑ '}
                {trendDirection === 'down' && '↓ '}
                {trend}
              </span>
              <span className="text-xs text-gray-400 ml-1">vs previous period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`${colorClasses.bg} ${colorClasses.icon} p-3 rounded-lg`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
