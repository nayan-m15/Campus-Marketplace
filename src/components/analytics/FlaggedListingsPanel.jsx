// Flagged/Problematic Listings Report Panel
// Flagged listings and risk analysis for fraud detection

import React, { useState, useEffect } from 'react';
import KPICard from './KPICard';
import AnalyticsChart from './AnalyticsChart';
import DataTable from './DataTable';
import { fetchFlaggedListingsReport } from '../../services/analytics/reports';
import { exportToCSV, exportToPDF, formatExportValue } from '../../utils/exportUtils';

export default function FlaggedListingsPanel({ filters = {} }) {
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
      const result = await fetchFlaggedListingsReport(filters);
      setData(result);
    } catch (err) {
      console.error('Error loading flagged listings data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const highRiskCount = data.filter(d => d.risk_score >= 70).length;
    const mediumRiskCount = data.filter(d => d.risk_score >= 40 && d.risk_score < 70).length;
    const lowRiskCount = data.filter(d => d.risk_score < 40).length;
    
    const summary = [
      `Total Flagged Listings: ${data.length}`,
      `High Risk (70+): ${highRiskCount}`,
      `Medium Risk (40-69): ${mediumRiskCount}`,
      `Low Risk (<40): ${lowRiskCount}`,
    ];
    exportToCSV(data, 'flagged-listings.csv', summary);
  };

  const handleExportPDF = () => {
    const highRiskCount = data.filter(d => d.risk_score >= 70).length;
    const mediumRiskCount = data.filter(d => d.risk_score >= 40 && d.risk_score < 70).length;
    const lowRiskCount = data.filter(d => d.risk_score < 40).length;
    const avgRiskScore = data.length > 0 ? data.reduce((acc, d) => acc + (d.risk_score || 0), 0) / data.length : 0;
    
    const summary = [
      `Total Flagged Listings: ${data.length}`,
      `High Risk (70+): ${highRiskCount}`,
      `Medium Risk (40-69): ${mediumRiskCount}`,
      `Low Risk (<40): ${lowRiskCount}`,
      `Avg Risk Score: ${formatExportValue(avgRiskScore, 'number', 1)}`,
    ];
    const insights = [
      `${highRiskCount} listings require immediate attention`,
      `Total reports: ${data.reduce((acc, d) => acc + (d.report_count || 0), 0)}`,
      `Listings with suspicious pricing: ${data.filter(d => d.suspicious_pricing).length}`,
    ];
    exportToPDF(data, 'flagged-listings.pdf', 'Flagged Listings Report', '', summary, insights);
  };

  const getRiskLevel = (score) => {
    if (score >= 70) return { label: 'High', color: 'red' };
    if (score >= 40) return { label: 'Medium', color: 'yellow' };
    return { label: 'Low', color: 'green' };
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

  const highRiskCount = data.filter(d => d.risk_score >= 70).length;
  const mediumRiskCount = data.filter(d => d.risk_score >= 40 && d.risk_score < 70).length;
  const lowRiskCount = data.filter(d => d.risk_score < 40).length;
  const avgRiskScore = data.length > 0 ? data.reduce((acc, d) => acc + (d.risk_score || 0), 0) / data.length : 0;
  const totalReports = data.reduce((acc, d) => acc + (d.report_count || 0), 0);
  const suspiciousPricingCount = data.filter(d => d.suspicious_pricing).length;

  const kpis = [
    { title: 'Total Flagged', value: data.length, format: 'number', color: 'red', icon: '⚠️' },
    { title: 'High Risk', value: highRiskCount, format: 'number', color: 'red', icon: '🔴' },
    { title: 'Medium Risk', value: mediumRiskCount, format: 'number', color: 'yellow', icon: '🟡' },
    { title: 'Low Risk', value: lowRiskCount, format: 'number', color: 'green', icon: '🟢' },
    { title: 'Avg Risk Score', value: avgRiskScore, format: 'number', color: 'purple', icon: '📊' },
    { title: 'Total Reports', value: totalReports, format: 'number', color: 'blue', icon: '📝' },
    { title: 'Suspicious Pricing', value: suspiciousPricingCount, format: 'number', color: 'orange', icon: '💰' },
  ];

  const riskDistribution = [
    { name: 'High Risk (70+)', value: highRiskCount, color: '#EF4444' },
    { name: 'Medium Risk (40-69)', value: mediumRiskCount, color: '#F59E0B' },
    { name: 'Low Risk (<40)', value: lowRiskCount, color: '#10B981' },
  ];

  const riskScoreData = data.slice(0, 20).map(d => ({
    name: d.title.substring(0, 20) + (d.title.length > 20 ? '...' : ''),
    score: d.risk_score,
  }));

  const columns = [
    { 
      key: 'title', 
      label: 'Title',
      render: (val, row) => (
        <div>
          <div className="font-medium">{val}</div>
          <div className="text-xs text-gray-500">ID: {row.listing_id}</div>
        </div>
      )
    },
    { key: 'seller_name', label: 'Seller' },
    { 
      key: 'risk_score', 
      label: 'Risk Score',
      render: (val) => {
        const level = getRiskLevel(val);
        return (
          <div className="flex items-center gap-2">
            <span className={`font-medium ${
              level.color === 'red' ? 'text-red-600' : 
              level.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {val.toFixed(0)}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              level.color === 'red' ? 'bg-red-100 text-red-700' : 
              level.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            }`}>
              {level.label}
            </span>
          </div>
        );
      }
    },
    { key: 'flag_reason', label: 'Flag Reason' },
    { key: 'status', label: 'Status' },
    { key: 'low_rating_count', label: 'Low Ratings', format: 'number' },
    { key: 'report_count', label: 'Reports', format: 'number' },
    { 
      key: 'suspicious_pricing', 
      label: 'Suspicious Pricing',
      render: (val) => (val ? 'Yes' : 'No')
    },
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Risk Level Distribution</h3>
          <AnalyticsChart type="pie" data={riskDistribution} dataKey="value" nameKey="name" height={300} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 20 Risk Scores</h3>
          <AnalyticsChart type="bar" data={riskScoreData} bars={[{ dataKey: 'score', name: 'Risk Score', color: '#EF4444' }]} nameKey="name" height={300} horizontal />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Flagged Listings Details</h3>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
              Export CSV
            </button>
            <button onClick={handleExportPDF} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Export PDF
            </button>
          </div>
        </div>
        <DataTable columns={columns} data={data} pageSize={20} />
      </div>
    </div>
  );
}
