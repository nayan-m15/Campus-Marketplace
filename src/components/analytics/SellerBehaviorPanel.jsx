// Seller Behavior Report Panel
// Seller performance and behavior analysis

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchSellerBehaviorReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function SellerBehaviorPanel({ filters = {} }) {
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
      const result = await fetchSellerBehaviorReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading seller behavior data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const totalListings = data.reduce((acc, d) => acc + (d.total_listings || 0), 0);
    const totalSold = data.reduce((acc, d) => acc + (d.sold_listings || 0), 0);
    const totalRevenue = data.reduce((acc, d) => acc + (d.total_revenue || 0), 0);
    const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_seller_rating || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Sellers: ${data.length}`,
      `Total Listings: ${formatExportValue(totalListings)}`,
      `Total Sold: ${formatExportValue(totalSold)}`,
      `Total Revenue: ${formatExportValue(totalRevenue, 'currency')}`,
      `Avg Rating: ${formatExportValue(avgRating, 'number', 1)}`,
    ];
    exportToCSV(data, 'seller-behavior.csv', summary);
  };

  const handleExportPDF = () => {
    const totalListings = data.reduce((acc, d) => acc + (d.total_listings || 0), 0);
    const totalSold = data.reduce((acc, d) => acc + (d.sold_listings || 0), 0);
    const totalRevenue = data.reduce((acc, d) => acc + (d.total_revenue || 0), 0);
    const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_seller_rating || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Sellers: ${data.length}`,
      `Total Listings: ${formatExportValue(totalListings)}`,
      `Total Sold: ${formatExportValue(totalSold)}`,
      `Total Revenue: ${formatExportValue(totalRevenue, 'currency')}`,
      `Avg Rating: ${formatExportValue(avgRating, 'number', 1)}`,
    ];
    const insights = [
      `Top seller: ${data[0]?.seller_name || 'N/A'}`,
      `Total cancellations: ${data.reduce((acc, d) => acc + (d.cancellation_count || 0), 0)}`,
      `Average success rate: ${formatExportValue(data.reduce((acc, d) => acc + (d.success_rate || 0), 0) / (data.length || 1), 'percentage')}`,
    ];
    exportToPDF(data, 'seller-behavior.pdf', 'Seller Behavior Report', '', summary, insights);
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
  const totalRevenue = data.reduce((acc, d) => acc + (d.total_revenue || 0), 0);
  const totalCancellations = data.reduce((acc, d) => acc + (d.cancellation_count || 0), 0);
  const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_seller_rating || 0), 0) / data.length : 0;
  const avgSuccessRate = data.length > 0 ? data.reduce((acc, d) => acc + (d.success_rate || 0), 0) / data.length : 0;

  const kpis = [
    { title: 'Total Sellers', value: data.length, format: 'number', color: 'blue', icon: '👥' },
    { title: 'Total Listings', value: totalListings, format: 'number', color: 'purple', icon: '📦' },
    { title: 'Total Sold', value: totalSold, format: 'number', color: 'green', icon: '💰' },
    { title: 'Total Revenue', value: totalRevenue, format: 'currency', color: 'blue', icon: '💵' },
    { title: 'Avg Rating', value: avgRating, format: 'number', color: 'yellow', icon: '⭐' },
    { title: 'Avg Success Rate', value: avgSuccessRate, format: 'percentage', color: 'green', icon: '📈' },
    { title: 'Total Cancellations', value: totalCancellations, format: 'number', color: 'red', icon: '❌' },
  ];

  const topSellersData = data.slice(0, 10).map(d => ({
    name: d.seller_name,
    listings: d.total_listings,
    sold: d.sold_listings,
    revenue: d.total_revenue,
  }));

  const ratingDistribution = [
    { name: '5 Stars', value: data.filter(d => d.avg_seller_rating >= 4.5).length },
    { name: '4 Stars', value: data.filter(d => d.avg_seller_rating >= 3.5 && d.avg_seller_rating < 4.5).length },
    { name: '3 Stars', value: data.filter(d => d.avg_seller_rating >= 2.5 && d.avg_seller_rating < 3.5).length },
    { name: '2 Stars', value: data.filter(d => d.avg_seller_rating >= 1.5 && d.avg_seller_rating < 2.5).length },
    { name: '1 Star', value: data.filter(d => d.avg_seller_rating < 1.5).length },
  ];

  const columns = [
    { key: 'seller_name', label: 'Seller Name' },
    { key: 'total_listings', label: 'Total Listings', format: 'number' },
    { key: 'sold_listings', label: 'Sold Listings', format: 'number' },
    { key: 'success_rate', label: 'Success Rate', format: 'percentage' },
    { key: 'avg_seller_rating', label: 'Avg Rating', format: 'number' },
    { key: 'total_revenue', label: 'Total Revenue', format: 'currency' },
    { key: 'avg_order_value', label: 'Avg Order Value', format: 'currency' },
    { key: 'cancellation_count', label: 'Cancellations', format: 'number' },
    { key: 'inactive_days', label: 'Inactive Days', format: 'number' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} icon={<span className="text-2xl">{kpi.icon}</span>} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Sellers by Revenue</h3>
          <AnalyticsChart type="bar" data={topSellersData} bars={[{ dataKey: 'revenue', name: 'Revenue', color: '#10B981' }]} nameKey="name" height={300} horizontal />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Seller Rating Distribution</h3>
          <AnalyticsChart type="pie" data={ratingDistribution} dataKey="value" nameKey="name" height={300} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Seller Behavior Details</h3>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
              Export CSV
            </button>
            <button onClick={handleExportPDF} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Export PDF
            </button>
          </div>
        </div>
        <DataTable columns={columns} data={data} pageSize={15} />
      </div>
    </div>
  );
}
