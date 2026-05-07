// Facility Usage Report Panel
// Facility utilization and operational metrics

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchFacilityUsageReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function FacilityUsagePanel({ filters = {} }) {
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
      const result = await fetchFacilityUsageReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading facility usage data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const totalTransactions = data.reduce((acc, d) => acc + (d.transactions_handled || 0), 0);
    const totalDropoffs = data.reduce((acc, d) => acc + (d.dropoff_count || 0), 0);
    const totalCollections = data.reduce((acc, d) => acc + (d.collection_count || 0), 0);
    
    const summary = [
      `Total Transactions: ${formatExportValue(totalTransactions)}`,
      `Total Dropoffs: ${formatExportValue(totalDropoffs)}`,
      `Total Collections: ${formatExportValue(totalCollections)}`,
    ];
    exportToCSV(data, 'facility-usage.csv', summary);
  };

  const handleExportPDF = () => {
    const totalTransactions = data.reduce((acc, d) => acc + (d.transactions_handled || 0), 0);
    const avgHoldTime = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_hold_hours || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Transactions: ${formatExportValue(totalTransactions)}`,
      `Avg Hold Time: ${formatExportValue(avgHoldTime, 'number', 1)} hours`,
    ];
    const insights = [
      `Most used facility: ${data[0]?.facility_name || 'N/A'}`,
      `Average utilization: ${formatExportValue(data.reduce((acc, d) => acc + (d.utilization_rate || 0), 0) / (data.length || 1), 'percentage')}`,
    ];
    exportToPDF(data, 'facility-usage.pdf', 'Facility Usage Report', '', summary, insights);
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

  const totalTransactions = data.reduce((acc, d) => acc + (d.transactions_handled || 0), 0);
  const totalDropoffs = data.reduce((acc, d) => acc + (d.dropoff_count || 0), 0);
  const totalCollections = data.reduce((acc, d) => acc + (d.collection_count || 0), 0);
  const avgHoldTime = data.length > 0 ? data.reduce((acc, d) => acc + (d.avg_hold_hours || 0), 0) / data.length : 0;
  const avgUtilization = data.length > 0 ? data.reduce((acc, d) => acc + (d.utilization_rate || 0), 0) / data.length : 0;

  const kpis = [
    { title: 'Total Transactions', value: totalTransactions, format: 'number', color: 'blue', icon: '📊' },
    { title: 'Total Dropoffs', value: totalDropoffs, format: 'number', color: 'green', icon: '📥' },
    { title: 'Total Collections', value: totalCollections, format: 'number', color: 'purple', icon: '📤' },
    { title: 'Avg Hold Time', value: avgHoldTime, format: 'number', color: 'yellow', icon: '⏱️' },
    { title: 'Avg Utilization', value: avgUtilization, format: 'percentage', color: 'blue', icon: '📈' },
  ];

  const facilityUsageData = data.map(d => ({
    name: d.facility_name,
    transactions: d.transactions_handled,
    dropoffs: d.dropoff_count,
    collections: d.collection_count,
  }));

  const utilizationData = data.map(d => ({
    name: d.facility_name,
    utilization: d.utilization_rate,
  }));

  const columns = [
    { key: 'facility_name', label: 'Facility Name' },
    { key: 'location', label: 'Location' },
    { key: 'transactions_handled', label: 'Transactions Handled', format: 'number' },
    { key: 'dropoff_count', label: 'Dropoff Count', format: 'number' },
    { key: 'collection_count', label: 'Collection Count', format: 'number' },
    { key: 'avg_hold_hours', label: 'Avg Hold (Hours)', format: 'number' },
    { key: 'peak_dropoff_hour', label: 'Peak Dropoff Hour', format: 'number' },
    { key: 'peak_collection_hour', label: 'Peak Collection Hour', format: 'number' },
    { key: 'utilization_rate', label: 'Utilization Rate', format: 'percentage' },
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Facility Usage Comparison</h3>
          <AnalyticsChart type="bar" data={facilityUsageData} bars={[{ dataKey: 'transactions', name: 'Transactions', color: '#3B82F6' }]} nameKey="name" height={300} horizontal />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Facility Utilization Rate</h3>
          <AnalyticsChart type="bar" data={utilizationData} bars={[{ dataKey: 'utilization', name: 'Utilization %', color: '#10B981' }]} nameKey="name" height={300} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Facility Usage Details</h3>
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
