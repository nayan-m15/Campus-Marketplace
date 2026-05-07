// Modern Filter Toolbar Component
// Provides date range, facility, and user role filters

import React, { useState } from 'react';
import { format, subDays, subMonths } from 'date-fns';

export default function FilterToolbar({
  onFilterChange,
  availableFacilities = [],
  loading = false,
}) {
  const [dateRange, setDateRange] = useState('30days'); // '7days', '30days', '90days', 'custom'
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedFacility, setSelectedFacility] = useState('');
  const [userRole, setUserRole] = useState('all');

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    const now = new Date();
    let startDate, endDate;

    switch (range) {
      case '7days':
        startDate = subDays(now, 7);
        endDate = now;
        break;
      case '30days':
        startDate = subDays(now, 30);
        endDate = now;
        break;
      case '90days':
        startDate = subDays(now, 90);
        endDate = now;
        break;
      case '6months':
        startDate = subMonths(now, 6);
        endDate = now;
        break;
      case '1year':
        startDate = subMonths(now, 12);
        endDate = now;
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = subDays(now, 30);
        endDate = now;
    }

    onFilterChange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      facilityId: selectedFacility || null,
      userRole,
    });
  };

  const handleCustomDateChange = (field, value) => {
    if (field === 'start') {
      setCustomStartDate(value);
    } else {
      setCustomEndDate(value);
    }

    if (dateRange === 'custom') {
      onFilterChange({
        startDate: field === 'start' ? value : customStartDate,
        endDate: field === 'end' ? value : customEndDate,
        facilityId: selectedFacility || null,
        userRole,
      });
    }
  };

  const handleFacilityChange = (e) => {
    const value = e.target.value;
    setSelectedFacility(value);
    onFilterChange({
      startDate: dateRange === 'custom' ? customStartDate : format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: dateRange === 'custom' ? customEndDate : format(new Date(), 'yyyy-MM-dd'),
      facilityId: value || null,
      userRole,
    });
  };

  const handleUserRoleChange = (e) => {
    const value = e.target.value;
    setUserRole(value);
    onFilterChange({
      startDate: dateRange === 'custom' ? customStartDate : format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: dateRange === 'custom' ? customEndDate : format(new Date(), 'yyyy-MM-dd'),
      facilityId: selectedFacility || null,
      userRole: value,
    });
  };

  const handleReset = () => {
    setDateRange('30days');
    setSelectedFacility('');
    setUserRole('all');
    setCustomStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setCustomEndDate(format(new Date(), 'yyyy-MM-dd'));
    onFilterChange({
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      facilityId: null,
      userRole: 'all',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Selector */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
            <option value="6months">Last 6 months</option>
            <option value="1year">Last 1 year</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Custom Date Inputs */}
        {dateRange === 'custom' && (
          <>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </>
        )}

        {/* Facility Filter */}
        {availableFacilities.length > 0 && (
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">Facility</label>
            <select
              value={selectedFacility}
              onChange={handleFacilityChange}
              disabled={loading}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">All Facilities</option>
              {availableFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Role Filter */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">User Role</label>
          <select
            value={userRole}
            onChange={handleUserRoleChange}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          >
            <option value="all">All Users</option>
            <option value="buyers">Buyers Only</option>
            <option value="sellers">Sellers Only</option>
            <option value="verified">Verified Users</option>
          </select>
        </div>

        {/* Reset Button */}
        <div className="flex flex-col justify-end ml-auto">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
