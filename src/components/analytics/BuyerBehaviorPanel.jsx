// Buyer Behavior Report Panel
// Buyer behavior and retention metrics

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchBuyerBehaviorReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function BuyerBehaviorPanel({ filters = {} }) {
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
      const result = await fetchBuyerBehaviorReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading buyer behavior data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const totalPurchases = data.reduce((acc, d) => acc + (d.total_purchases || 0), 0);
    const totalSpent = data.reduce((acc, d) => acc + (d.total_spent || 0), 0);
    const repeatPurchases = data.reduce((acc, d) => acc + (d.repeat_purchases || 0), 0);
    const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_buyer_rating || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Buyers: ${data.length}`,
      `Total Purchases: ${formatExportValue(totalPurchases)}`,
      `Total Spent: ${formatExportValue(totalSpent, 'currency')}`,
      `Repeat Purchases: ${formatExportValue(repeatPurchases)}`,
      `Avg Rating: ${formatExportValue(avgRating, 'number', 1)}`,
    ];
    exportToCSV(data, 'buyer-behavior.csv', summary);
  };

  const handleExportPDF = () => {
    const totalPurchases = data.reduce((acc, d) => acc + (d.total_purchases || 0), 0);
    const totalSpent = data.reduce((acc, d) => acc + (d.total_spent || 0), 0);
    const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_buyer_rating || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Buyers: ${data.length}`,
      `Total Purchases: ${formatExportValue(totalPurchases)}`,
      `Total Spent: ${formatExportValue(totalSpent, 'currency')}`,
      `Avg Rating: ${formatExportValue(avgRating, 'number', 1)}`,
    ];
    const insights = [
      `Top buyer: ${data[0]?.buyer_name || 'N/A'}`,
      `Average order value: ${formatExportValue(data.reduce((acc, d) => acc + (d.avg_order_value || 0), 0) / (data.length || 1), 'currency')}`,
      `Completion rate: ${formatExportValue(data.reduce((acc, d) => acc + (d.completion_rate || 0), 0) / (data.length || 1), 'percentage')}`,
    ];
    exportToPDF(data, 'buyer-behavior.pdf', 'Buyer Behavior Report', '', summary, insights);
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

  const totalPurchases = data.reduce((acc, d) => acc + (d.total_purchases || 0), 0);
  const totalSpent = data.reduce((acc, d) => acc + (d.total_spent || 0), 0);
  const repeatPurchases = data.reduce((acc, d) => acc + (d.repeat_purchases || 0), 0);
  const avgRating = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_buyer_rating || 0), 0) / data.length : 0;
  const avgOrderValue = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_order_value || 0), 0) / data.length : 0;
  const avgCompletionRate = data.length > 0 ? data.reduce((acc, d) => acc + (d.completion_rate || 0), 0) / data.length : 0;

  const kpis = [
    { title: 'Total Buyers', value: data.length, format: 'number', color: 'blue', icon: '👥' },
    { title: 'Total Purchases', value: totalPurchases, format: 'number', color: 'purple', icon: '🛒' },
    { title: 'Total Spent', value: totalSpent, format: 'currency', color: 'green', icon: '💵' },
    { title: 'Repeat Purchases', value: repeatPurchases, format: 'number', color: 'yellow', icon: '🔄' },
    { title: 'Avg Rating', value: avgRating, format: 'number', color: 'blue', icon: '⭐' },
    { title: 'Avg Order Value', value: avgOrderValue, format: 'currency', color: 'purple', icon: '💰' },
    { title: 'Completion Rate', value: avgCompletionRate, format: 'percentage', color: 'green', icon: '✅' },
  ];

  const topBuyersData = data.slice(0, 10).map(d => ({
    name: d.buyer_name,
    purchases: d.total_purchases,
    spent: d.total_spent,
  }));

  const categoryAffinityData = data.reduce((acc, d) => {
    const category = d.favorite_category || 'Other';
    if (!acc[category]) acc[category] = 0;
    acc[category] += d.total_purchases;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryAffinityData).map(([name, value]) => ({ name, value }));

  const columns = [
    { key: 'buyer_name', label: 'Buyer Name' },
    { key: 'total_purchases', label: 'Total Purchases', format: 'number' },
    { key: 'repeat_purchases', label: 'Repeat Purchases', format: 'number' },
    { key: 'total_spent', label: 'Total Spent', format: 'currency' },
    { key: 'avg_order_value', label: 'Avg Order Value', format: 'currency' },
    { key: 'completion_rate', label: 'Completion Rate', format: 'percentage' },
    { key: 'avg_buyer_rating', label: 'Avg Rating', format: 'number' },
    { key: 'favorite_category', label: 'Favorite Category' },
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Buyers by Spending</h3>
          <AnalyticsChart type="bar" data={topBuyersData} bars={[{ dataKey: 'spent', name: 'Spent', color: '#10B981' }]} nameKey="name" height={300} horizontal />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Category Affinity</h3>
          <AnalyticsChart type="pie" data={categoryChartData} dataKey="value" nameKey="name" height={300} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Buyer Behavior Details</h3>
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
