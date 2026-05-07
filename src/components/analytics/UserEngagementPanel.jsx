// User Engagement & Trust Report Panel
// User trust and engagement metrics with ratings and activity analysis

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchUserEngagementReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function UserEngagementPanel({ filters = {} }) {
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
      const result = await fetchUserEngagementReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading user engagement data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const summary = [
      `Total Users Analyzed: ${data.length}`,
      `Verified Users: ${data.filter(u => u.verified).length}`,
      `Repeat Buyers: ${data.filter(u => u.repeat_buyer).length}`,
      `Repeat Sellers: ${data.filter(u => u.repeat_seller).length}`,
    ];
    exportToCSV(data, 'user-engagement.csv', summary);
  };

  const handleExportPDF = () => {
    const summary = [
      `Total Users Analyzed: ${data.length}`,
      `Verified Users: ${data.filter(u => u.verified).length}`,
      `Repeat Buyers: ${data.filter(u => u.repeat_buyer).length}`,
      `Repeat Sellers: ${data.filter(u => u.repeat_seller).length}`,
    ];
    const insights = [
      `${data.filter(u => u.verified).length} users are verified`,
      `${data.filter(u => u.repeat_buyer).length} users are repeat buyers`,
      `${data.filter(u => u.repeat_seller).length} users are repeat sellers`,
    ];
    exportToPDF(data, 'user-engagement.pdf', 'User Engagement & Trust Report', '', summary, insights);
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

  const ratingDistribution = [
    { name: '5 Stars', value: data.filter(u => u.avg_seller_rating >= 4.5).length },
    { name: '4 Stars', value: data.filter(u => u.avg_seller_rating >= 3.5 && u.avg_seller_rating < 4.5).length },
    { name: '3 Stars', value: data.filter(u => u.avg_seller_rating >= 2.5 && u.avg_seller_rating < 3.5).length },
    { name: '2 Stars', value: data.filter(u => u.avg_seller_rating >= 1.5 && u.avg_seller_rating < 2.5).length },
    { name: '1 Star', value: data.filter(u => u.avg_seller_rating < 1.5).length },
  ];

  const repeatUserData = [
    { name: 'Repeat Buyers', value: data.filter(u => u.repeat_buyer).length },
    { name: 'One-time Buyers', value: data.filter(u => !u.repeat_buyer).length },
  ];

  const columns = [
    { key: 'user_name', label: 'User Name' },
    { key: 'total_transactions', label: 'Total Transactions', format: 'number' },
    { key: 'avg_seller_rating', label: 'Avg Seller Rating', format: 'number' },
    { key: 'avg_buyer_rating', label: 'Avg Buyer Rating', format: 'number' },
    { key: 'repeat_buyer', label: 'Repeat Buyer', render: (val) => (val ? 'Yes' : 'No') },
    { key: 'repeat_seller', label: 'Repeat Seller', render: (val) => (val ? 'Yes' : 'No') },
    { key: 'verified', label: 'Verified', render: (val) => (val ? 'Yes' : 'No') },
    { key: 'last_active', label: 'Last Active', format: 'datetime' },
  ];

  const kpis = [
    { title: 'Total Users', value: data.length, format: 'number', color: 'blue', icon: '👥' },
    { title: 'Verified Users', value: data.filter(u => u.verified).length, format: 'number', color: 'green', icon: '✓' },
    { title: 'Repeat Buyers', value: data.filter(u => u.repeat_buyer).length, format: 'number', color: 'purple', icon: '🔄' },
    { title: 'Repeat Sellers', value: data.filter(u => u.repeat_seller).length, format: 'number', color: 'yellow', icon: '🔄' },
    { title: 'Avg Seller Rating', value: data.reduce((acc, u) => acc + (u.avg_seller_rating || 0), 0) / (data.length || 1), format: 'number', color: 'blue', icon: '⭐' },
    { title: 'Avg Buyer Rating', value: data.reduce((acc, u) => acc + (u.avg_buyer_rating || 0), 0) / (data.length || 1), format: 'number', color: 'green', icon: '⭐' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} icon={<span className="text-2xl">{kpi.icon}</span>} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Rating Distribution</h3>
          <AnalyticsChart type="bar" data={ratingDistribution} bars={[{ dataKey: 'value', name: 'Users', color: '#3B82F6' }]} nameKey="name" height={300} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Repeat vs One-time Buyers</h3>
          <AnalyticsChart type="pie" data={repeatUserData} dataKey="value" nameKey="name" height={300} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">User Engagement Details</h3>
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
