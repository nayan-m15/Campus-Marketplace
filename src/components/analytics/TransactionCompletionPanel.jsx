// Transaction Completion Report Panel
// Transaction completion and failure analysis

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchTransactionCompletionReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function TransactionCompletionPanel({ filters = {} }) {
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
      const result = await fetchTransactionCompletionReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading transaction completion data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const totalTransactions = data.reduce((acc, d) => acc + (d.transaction_count || 0), 0);
    const totalValue = data.reduce((acc, d) => acc + (d.total_value || 0), 0);
    const completedCount = data.find(d => d.status === 'completed')?.transaction_count || 0;
    const completionRate = totalTransactions > 0 ? (completedCount / totalTransactions) * 100 : 0;
    
    const summary = [
      `Total Transactions: ${formatExportValue(totalTransactions)}`,
      `Total Value: ${formatExportValue(totalValue, 'currency')}`,
      `Completion Rate: ${formatExportValue(completionRate, 'percentage')}`,
    ];
    exportToCSV(data, 'transaction-completion.csv', summary);
  };

  const handleExportPDF = () => {
    const totalTransactions = data.reduce((acc, d) => acc + (d.transaction_count || 0), 0);
    const totalValue = data.reduce((acc, d) => acc + (d.total_value || 0), 0);
    const completedCount = data.find(d => d.status === 'completed')?.transaction_count || 0;
    const completionRate = totalTransactions > 0 ? (completedCount / totalTransactions) * 100 : 0;
    
    const summary = [
      `Total Transactions: ${formatExportValue(totalTransactions)}`,
      `Total Value: ${formatExportValue(totalValue, 'currency')}`,
      `Completion Rate: ${formatExportValue(completionRate, 'percentage')}`,
    ];
    const insights = [
      `Most common status: ${data[0]?.status || 'N/A'}`,
      `Total disputes: ${data.reduce((acc, d) => acc + (d.dispute_count || 0), 0)}`,
    ];
    exportToPDF(data, 'transaction-completion.pdf', 'Transaction Completion Report', '', summary, insights);
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

  const totalTransactions = data.reduce((acc, d) => acc + (d.transaction_count || 0), 0);
  const totalValue = data.reduce((acc, d) => acc + (d.total_value || 0), 0);
  const completedCount = data.find(d => d.status === 'completed')?.transaction_count || 0;
  const cancelledCount = data.find(d => d.status === 'cancelled')?.transaction_count || 0;
  const disputedCount = data.reduce((acc, d) => acc + (d.dispute_count || 0), 0);
  const completionRate = totalTransactions > 0 ? (completedCount / totalTransactions) * 100 : 0;

  const kpis = [
    { title: 'Total Transactions', value: totalTransactions, format: 'number', color: 'blue', icon: '📊' },
    { title: 'Total Value', value: totalValue, format: 'currency', color: 'green', icon: '💵' },
    { title: 'Completed', value: completedCount, format: 'number', color: 'green', icon: '✅' },
    { title: 'Cancelled', value: cancelledCount, format: 'number', color: 'red', icon: '❌' },
    { title: 'Disputed', value: disputedCount, format: 'number', color: 'yellow', icon: '⚠️' },
    { title: 'Completion Rate', value: completionRate, format: 'percentage', color: 'purple', icon: '📈' },
  ];

  const statusDistribution = data.map(d => ({
    name: d.status,
    value: d.transaction_count,
  }));

  const failureReasons = data.find(d => d.status === 'cancelled')?.failure_reasons || {};
  const failureReasonData = Object.entries(failureReasons).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
  })).filter(d => d.value > 0);

  const columns = [
    { key: 'status', label: 'Status' },
    { key: 'transaction_count', label: 'Transaction Count', format: 'number' },
    { key: 'total_value', label: 'Total Value', format: 'currency' },
    { key: 'avg_completion_hours', label: 'Avg Completion (Hours)', format: 'number' },
    { key: 'dispute_count', label: 'Dispute Count', format: 'number' },
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Transaction Status Distribution</h3>
          <AnalyticsChart type="pie" data={statusDistribution} dataKey="value" nameKey="name" height={300} />
        </div>
        {failureReasonData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cancellation Reasons</h3>
            <AnalyticsChart type="bar" data={failureReasonData} bars={[{ dataKey: 'value', name: 'Count', color: '#EF4444' }]} nameKey="name" height={300} horizontal />
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Transaction Completion Details</h3>
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
