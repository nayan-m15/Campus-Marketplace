// Modern Reports Dashboard
// Main analytics dashboard with tabbed interface for all reports

import React, { useState } from 'react';
import FilterToolbar from './FilterToolbar';
import PlatformOverviewPanel from './PlatformOverviewPanel';
import UserEngagementPanel from './UserEngagementPanel';
import ListingPerformancePanel from './ListingPerformancePanel';
import TransactionCompletionPanel from './TransactionCompletionPanel';
import FacilityUsagePanel from './FacilityUsagePanel';
import SellerBehaviorPanel from './SellerBehaviorPanel';
import BuyerBehaviorPanel from './BuyerBehaviorPanel';
import FlaggedListingsPanel from './FlaggedListingsPanel';

const REPORT_TABS = [
  { id: 'platform', label: 'Platform Overview', icon: '📊', description: 'High-level marketplace health metrics' },
  { id: 'user-engagement', label: 'User Engagement', icon: '👥', description: 'User trust and engagement metrics' },
  { id: 'listing-performance', label: 'Listing Performance', icon: '📦', description: 'Listing performance and conversion metrics' },
  { id: 'transaction-completion', label: 'Transaction Completion', icon: '💰', description: 'Transaction completion and failure analysis' },
  { id: 'facility-usage', label: 'Facility Usage', icon: '🏛️', description: 'Facility utilization and operational metrics' },
  { id: 'seller-behavior', label: 'Seller Behavior', icon: '👤', description: 'Seller performance and behavior analysis' },
  { id: 'buyer-behavior', label: 'Buyer Behavior', icon: '🛒', description: 'Buyer behavior and retention metrics' },
  { id: 'flagged-listings', label: 'Flagged Listings', icon: '⚠️', description: 'Flagged listings and risk analysis' },
];

export default function ModernReportsDashboard({ availableFacilities = [] }) {
  const [activeTab, setActiveTab] = useState('platform');
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    facilityId: null,
    userRole: 'all',
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'platform':
        return <PlatformOverviewPanel filters={filters} />;
      case 'user-engagement':
        return <UserEngagementPanel filters={filters} />;
      case 'listing-performance':
        return <ListingPerformancePanel filters={filters} />;
      case 'transaction-completion':
        return <TransactionCompletionPanel filters={filters} />;
      case 'facility-usage':
        return <FacilityUsagePanel filters={filters} />;
      case 'seller-behavior':
        return <SellerBehaviorPanel filters={filters} />;
      case 'buyer-behavior':
        return <BuyerBehaviorPanel filters={filters} />;
      case 'flagged-listings':
        return <FlaggedListingsPanel filters={filters} />;
      default:
        return <PlatformOverviewPanel filters={filters} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Comprehensive marketplace analytics and reporting
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleString('en-ZA')}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6 shadow-sm">
          <nav className="flex flex-wrap gap-2 p-4" aria-label="Report tabs">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                title={tab.description}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Filter Toolbar */}
        <FilterToolbar
          onFilterChange={handleFilterChange}
          availableFacilities={availableFacilities}
        />

        {/* Active Report Panel */}
        <div className="mt-6">
          {renderActivePanel()}
        </div>
      </div>
    </div>
  );
}
