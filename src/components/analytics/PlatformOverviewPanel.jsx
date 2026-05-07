// Platform Overview Dashboard Panel
// High-level marketplace health metrics with KPIs and charts

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchPlatformOverview, fetchListingPerformanceReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function PlatformOverviewPanel({ filters = {} }) {
  const [data, setData] = useState(null);
  const [listingData, setListingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, listingPerf] = await Promise.all([
        fetchPlatformOverview(filters),
        fetchListingPerformanceReport(filters),
      ]);
      setData(overview);
      setListingData(listingPerf);
    } catch (err) {
      console.error('Error loading platform overview:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const summary = [
      `Total Users: ${formatExportValue(data?.total_users)}`,
      `Active Users: ${formatExportValue(data?.active_users)}`,
      `Total Listings: ${formatExportValue(data?.total_listings)}`,
      `Sold Listings: ${formatExportValue(data?.sold_listings)}`,
      `Total Transaction Value: ${formatExportValue(data?.total_transaction_value, 'currency')}`,
      `Completion Rate: ${formatExportValue(data?.transaction_completion_rate, 'percentage')}`,
      `Avg Platform Rating: ${formatExportValue(data?.avg_platform_rating, 'number', 1)}`,
    ];
    exportToCSV(listingData, 'platform-overview.csv', summary);
  };

  const handleExportPDF = () => {
    const summary = [
      `Total Users: ${formatExportValue(data?.total_users)}`,
      `Active Users: ${formatExportValue(data?.active_users)}`,
      `Total Listings: ${formatExportValue(data?.total_listings)}`,
      `Sold Listings: ${formatExportValue(data?.sold_listings)}`,
      `Total Transaction Value: ${formatExportValue(data?.total_transaction_value, 'currency')}`,
      `Completion Rate: ${formatExportValue(data?.transaction_completion_rate, 'percentage')}`,
    ];
    const insights = [
      `Platform has ${formatExportValue(data?.total_listings)} total listings`,
      `Transaction completion rate is ${formatExportValue(data?.transaction_completion_rate, 'percentage')}`,
      `Average platform rating is ${formatExportValue(data?.avg_platform_rating, 'number', 1)} out of 5`,
    ];
    exportToPDF(listingData, 'platform-overview.pdf', 'Platform Overview', '', summary, insights);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const categoryChartData = (data?.category_breakdown || []).map((item) => ({
    name: item.category,
    value: item.count,
  }));

  const listingColumns = [
    { key: 'category', label: 'Category' },
    { key: 'total_listings', label: 'Total Listings', format: 'number' },
    { key: 'sold_listings', label: 'Sold Listings', format: 'number' },
    { key: 'unsold_listings', label: 'Unsold Listings', format: 'number' },
    { key: 'avg_listing_price', label: 'Avg Listing Price', format: 'currency' },
    { key: 'avg_sold_price', label: 'Avg Sold Price', format: 'currency' },
    { key: 'conversion_rate', label: 'Conversion Rate', format: 'percentage' },
    { key: 'avg_time_to_sell', label: 'Avg Time to Sell (Days)', format: 'number' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Users"
          value={data?.total_users}
          format="number"
          color="blue"
          icon={<span className="text-2xl">👥</span>}
        />
        <KPICard
          title="Active Users"
          value={data?.active_users}
          format="number"
          color="green"
          icon={<span className="text-2xl">✓</span>}
        />
        <KPICard
          title="Total Listings"
          value={data?.total_listings}
          format="number"
          color="purple"
          icon={<span className="text-2xl">📦</span>}
        />
        <KPICard
          title="Active Listings"
          value={data?.active_listings}
          format="number"
          color="yellow"
          icon={<span className="text-2xl">🏷️</span>}
        />
        <KPICard
          title="Sold Listings"
          value={data?.sold_listings}
          format="number"
          color="green"
          icon={<span className="text-2xl">💰</span>}
        />
        <KPICard
          title="Total Transaction Value"
          value={data?.total_transaction_value}
          format="currency"
          color="blue"
          icon={<span className="text-2xl">💵</span>}
        />
        <KPICard
          title="Completion Rate"
          value={data?.transaction_completion_rate}
          format="percentage"
          color="green"
          icon={<span className="text-2xl">✅</span>}
        />
        <KPICard
          title="Avg Platform Rating"
          value={data?.avg_platform_rating}
          format="number"
          color="yellow"
          icon={<span className="text-2xl">⭐</span>}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Category Distribution</h3>
          <AnalyticsChart
            type="pie"
            data={categoryChartData}
            dataKey="value"
            nameKey="name"
            height={300}
          />
        </div>

        {/* Listing Performance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Listing Performance by Category</h3>
          <AnalyticsChart
            type="bar"
            data={listingData}
            bars={[
              { dataKey: 'total_listings', name: 'Total', color: '#3B82F6' },
              { dataKey: 'sold_listings', name: 'Sold', color: '#10B981' },
            ]}
            nameKey="category"
            height={300}
            horizontal
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Listing Performance Details</h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Export PDF
            </button>
          </div>
        </div>
        <DataTable
          columns={listingColumns}
          data={listingData}
          pageSize={10}
        />
      </div>
    </div>
  );
}
