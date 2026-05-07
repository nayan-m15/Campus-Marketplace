// Modern Analytics Chart Component
// Wrapper around Recharts with common configurations

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function AnalyticsChart({
  type = 'line', // 'line', 'bar', 'pie', 'area'
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  lines = [], // For line/area charts: [{ dataKey, name, color, strokeWidth }]
  bars = [], // For bar charts: [{ dataKey, name, color }]
  height = 300,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  stacked = false,
  horizontal = false,
  loading = false,
  emptyMessage = 'No data available',
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height }}>
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis
              dataKey={nameKey}
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('en-ZA').format(value)}
            />
            {showTooltip && <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />}
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color || COLORS[index % COLORS.length]}
                strokeWidth={line.strokeWidth || 2}
                dot={{ fill: line.color || COLORS[index % COLORS.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart
            {...commonProps}
            layout={horizontal ? 'horizontal' : 'vertical'}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis
              dataKey={horizontal ? 'value' : nameKey}
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('en-ZA').format(value)}
            />
            <YAxis
              dataKey={horizontal ? nameKey : 'value'}
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              type="category"
            />
            {showTooltip && <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />}
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {bars.map((bar, index) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={bar.color || COLORS[index % COLORS.length]}
                radius={[4, 4, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
            <XAxis
              dataKey={nameKey}
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => new Intl.NumberFormat('en-ZA').format(value)}
            />
            {showTooltip && <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />}
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            {lines.map((line, index) => (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color || COLORS[index % COLORS.length]}
                fill={line.color || COLORS[index % COLORS.length]}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={dataKey}
              nameKey={nameKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            {showTooltip && <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />}
            {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
}
