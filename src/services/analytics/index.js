// Analytics Service Layer
// Centralized service for all report data fetching and processing

import { supabase } from '../supabaseClient';

/**
 * Analytics Service
 * Provides methods to fetch report data with caching, filtering, and optimization
 */
export const analyticsService = {
  // Cache for storing report data
  cache: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  },

  /**
   * Set data in cache
   */
  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  },

  /**
   * Clear cache for a specific key or all cache
   */
  clearCache(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  },

  /**
   * Build cache key from parameters
   */
  buildCacheKey(reportType, params) {
    return `${reportType}:${JSON.stringify(params)}`;
  },

  /**
   * Execute query with caching
   */
  async fetchWithCache(reportType, queryFn, params = {}) {
    const cacheKey = this.buildCacheKey(reportType, params);
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      return cached;
    }

    const data = await queryFn(params);
    this.setCache(cacheKey, data);
    return data;
  },

  /**
   * Apply date range filter to query
   */
  applyDateRange(query, dateField, startDate, endDate) {
    if (startDate) {
      query = query.gte(dateField, startDate);
    }
    if (endDate) {
      query = query.lte(dateField, endDate);
    }
    return query;
  },

  /**
   * Apply facility filter to query
   */
  applyFacilityFilter(query, facilityId) {
    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }
    return query;
  },

  /**
   * Apply pagination to query
   */
  applyPagination(query, page = 1, pageSize = 50) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return query.range(from, to);
  },

  /**
   * Format currency for South Africa
   */
  formatCurrency(value) {
    if (value === null || value === undefined) return 'R 0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(value);
  },

  /**
   * Format percentage
   */
  formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined) return '0%';
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Format number with commas
   */
  formatNumber(value) {
    if (value === null || value === undefined) return '0';
    return new Intl.NumberFormat('en-ZA').format(value);
  },
};

export default analyticsService;
