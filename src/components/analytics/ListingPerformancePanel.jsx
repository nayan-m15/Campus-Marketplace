// Listing Performance Report Panel
// Listing performance and conversion metrics by category

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchListingPerformanceReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function ListingPerformancePanel({ filters = {} }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchListingPerformanceReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading listing performance data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const totalListings = data.reduce((acc, d) => acc + (d.total_listings || 0), 0);
    const totalSold = data.reduce((acc, d) => acc + (d.sold_listings || 0), 0);
    const avgConversion = data.length > 0 ? data.reduce((acc, d) => acc + (d.conversion_rate || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Listings: ${formatExportValue(totalListings)}`,
      `Total Sold: ${formatExportValue(totalSold)}`,
      `Avg Conversion Rate: ${formatExportValue(avgConversion, 'percentage')}`,
    ];
    exportToCSV(data, 'listing-performance.csv', summary);
  };

  const handleExportPDF = () => {
    const totalListings = data.reduce((acc, d) => acc + (d.total_listings || 0), 0);
    const totalSold = data.reduce((acc, d) => acc + (d.sold_listings || 0), 0);
    const avgConversion = data.length > 0 ? data.reduce((acc, d) => acc + (d.conversion_rate || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Listings: ${formatExportValue(totalListings)}`,
      `Total Sold: ${formatExportValue(totalSold)}`,
      `Avg Conversion Rate: ${formatExportValue(avgConversion, 'percentage')}`,
    ];
    const insights = [
      `Top performing category: ${data[0]?.category || 'N/A'}`,
      `Average time to sell: ${formatExportValue(data.reduce((acc, d) => acc + (d.avg_time_to_sell || 0), 0) / (data.length || 1), 'number', 1)} days`,
    ];
    exportToPDF(data, 'listing-performance.pdf', 'Listing Performance Report', '', summary, insights);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">{error}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  const totalListings = data.reduce((acc, d) => acc + (d.total_listings || 0), 0);
  const totalSold = data.reduce((acc, d) => acc + (d.sold_listings || 0), 0);
  const totalExpired = data.reduce((acc, d) => acc + (d.expired_listings || 0), 0);
  const avgConversion = data.length > 0 ? data.reduce((acc, d) => acc + (d.conversion_rate || 0), 0) / data.length : 0;
  const avgTimeToSell = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_time_to_sell || 0), 0) / data.length : 0;

  const kpis = [
    { title: 'Total Listings', value: totalListings, format: 'number', color: 'blue', icon: '📦' },
    { title: 'Sold Listings', value: totalSold, format: 'number', color: 'green', icon: '💰' },
    { title: 'Expired Listings', value: totalExpired, format: 'number', color: 'red', icon: '⏰' },
    { title: 'Avg Conversion Rate', value: avgConversion, format: 'percentage', color: 'purple', icon: '📈' },
    { title: 'Avg Time to Sell', value: avgTimeToSell, format: 'number', color: 'yellow', icon: '⏱️' },
  ];

  const conversionChartData = data.map(d => ({
    name: d.category,
    conversion: d.conversion_rate,
    sold: d.sold_listings,
    total: d.total_listings,
  }));

  const priceComparisonData = data.map(d => ({
    name: d.category,
    listed: d.avg_listing_price,
    sold: d.avg_sold_price,
  }));

  const columns = [
    { key: 'category', label: 'Category' },
    { key: 'total_listings', label: 'Total Listings', format: 'number' },
    { key: 'sold_listings', label: 'Sold Listings', format: 'number' },
    { key: 'unsold_listings', label: 'Unsold Listings', format: 'number' },
    { key: 'avg_listing_price', label: 'Avg Listing Price', format: 'currency' },
    { key: 'avg_sold_price', label: 'Avg Sold Price', format: 'currency' },
    { key: 'conversion_rate', label: 'Conversion Rate', format: 'percentage' },
    { key: 'avg_time_to_sell', label: 'Avg Time to Sell (Days)', format: 'number' },
    { key: 'expired_listings', label: 'Expired Listings', format: 'number' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} icon={<span className="text-2xl">{kpi.icon}</span>} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Conversion Rate by Category</h3>
          <AnalyticsChart type="bar" data={conversionChartData} bars={[{ dataKey: 'conversion', name: 'Conversion %', color: '#3B82F6' }]} nameKey="name" height={300} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Listed vs Sold Price Comparison</h3>
          <AnalyticsChart type="bar" data={priceComparisonData} bars={[{ dataKey: 'listed', name: 'Listed', color: '#3B82F6' }, { dataKey: 'sold', name: 'Sold', color: '#10B981' }]} nameKey="name" height={300} stacked />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Listing Performance Details</h3>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
              Export CSV
            </button>
            <button onClick={handleExportPDF} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Export PDF
            </button>
          </div>
        </div>
        <DataTable columns={columns} data={data} pageSize={10} />
      </div>
    </div>
  );
}
