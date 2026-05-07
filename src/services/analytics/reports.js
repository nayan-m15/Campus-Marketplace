// Report-specific service functions
// Each function calls the corresponding Supabase RPC function

import { supabase } from '../supabaseClient';
import analyticsService from './index';

/**
 * Platform Overview Dashboard
 * High-level marketplace health metrics
 */
export async function fetchPlatformOverview(params = {}) {
  const { startDate, endDate, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_platform_overview', {
      start_date: startDate || null,
      end_date: endDate || null,
    });
    
    if (error) throw error;
    return data?.[0] || {};
  };

  if (useCache) {
    return analyticsService.fetchWithCache('platform_overview', fetchFn, params);
  }
  return fetchFn();
}

/**
 * User Engagement & Trust Report
 * User trust and engagement metrics
 */
export async function fetchUserEngagementReport(params = {}) {
  const { startDate, endDate, limit = 50, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_user_engagement_report', {
      start_date: startDate || null,
      end_date: endDate || null,
      limit_count: limit,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('user_engagement', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Listing Performance Report
 * Listing performance and conversion metrics
 */
export async function fetchListingPerformanceReport(params = {}) {
  const { startDate, endDate, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_listing_performance_report', {
      start_date: startDate || null,
      end_date: endDate || null,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('listing_performance', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Transaction Completion Report
 * Transaction completion and failure analysis
 */
export async function fetchTransactionCompletionReport(params = {}) {
  const { startDate, endDate, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_transaction_completion_report', {
      start_date: startDate || null,
      end_date: endDate || null,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('transaction_completion', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Facility Usage Report
 * Facility utilization and operational metrics
 */
export async function fetchFacilityUsageReport(params = {}) {
  const { startDate, endDate, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_facility_usage_report', {
      start_date: startDate || null,
      end_date: endDate || null,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('facility_usage', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Seller Behavior Report
 * Seller performance and behavior analysis
 */
export async function fetchSellerBehaviorReport(params = {}) {
  const { startDate, endDate, limit = 50, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_seller_behavior_report', {
      start_date: startDate || null,
      end_date: endDate || null,
      limit_count: limit,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('seller_behavior', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Buyer Behavior Report
 * Buyer behavior and retention metrics
 */
export async function fetchBuyerBehaviorReport(params = {}) {
  const { startDate, endDate, limit = 50, useCache = true } = params;
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_buyer_behavior_report', {
      start_date: startDate || null,
      end_date: endDate || null,
      limit_count: limit,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('buyer_behavior', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Flagged Listings Report
 * Flagged listings and risk analysis
 */
export async function fetchFlaggedListingsReport(params = {}) {
  const { startDate, endDate, limit = 100, useCache = false } = params; // Don't cache by default for security
  
  const fetchFn = async () => {
    const { data, error } = await supabase.rpc('get_flagged_listings_report', {
      start_date: startDate || null,
      end_date: endDate || null,
      limit_count: limit,
    });
    
    if (error) throw error;
    return data || [];
  };

  if (useCache) {
    return analyticsService.fetchWithCache('flagged_listings', fetchFn, params);
  }
  return fetchFn();
}

/**
 * Fetch all reports data in parallel
 */
export async function fetchAllReports(params = {}) {
  const { startDate, endDate } = params;
  
  const [
    platformOverview,
    userEngagement,
    listingPerformance,
    transactionCompletion,
    facilityUsage,
    sellerBehavior,
    buyerBehavior,
    flaggedListings,
  ] = await Promise.all([
    fetchPlatformOverview({ startDate, endDate }),
    fetchUserEngagementReport({ startDate, endDate }),
    fetchListingPerformanceReport({ startDate, endDate }),
    fetchTransactionCompletionReport({ startDate, endDate }),
    fetchFacilityUsageReport({ startDate, endDate }),
    fetchSellerBehaviorReport({ startDate, endDate }),
    fetchBuyerBehaviorReport({ startDate, endDate }),
    fetchFlaggedListingsReport({ startDate, endDate }),
  ]);
  
  return {
    platformOverview,
    userEngagement,
    listingPerformance,
    transactionCompletion,
    facilityUsage,
    sellerBehavior,
    buyerBehavior,
    flaggedListings,
  };
}

/**
 * Clear analytics cache
 */
export function clearAnalyticsCache(reportType = null) {
  analyticsService.clearCache(reportType);
}
