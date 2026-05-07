-- Migration: Create Analytics Functions for Reporting System
-- This migration creates optimized SQL functions for all 8 report types

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- REPORT 1: Platform Overview Dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_platform_overview(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_users BIGINT,
  active_users BIGINT,
  total_listings BIGINT,
  active_listings BIGINT,
  sold_listings BIGINT,
  total_transaction_value NUMERIC,
  transaction_completion_rate NUMERIC,
  avg_platform_rating NUMERIC,
  listings_this_month BIGINT,
  revenue_trend JSONB,
  category_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      COUNT(DISTINCT id) as total_users,
      COUNT(DISTINCT CASE WHEN last_sign_in_at > COALESCE($1, NOW() - INTERVAL '30 days') THEN id END) as active_users
    FROM profiles
    WHERE ($1 IS NULL OR created_at >= $1)
      AND ($2 IS NULL OR created_at <= $2)
  ),
  listing_stats AS (
    SELECT
      COUNT(DISTINCT id) as total_listings,
      COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_listings,
      COUNT(DISTINCT CASE WHEN status = 'sold' THEN id END) as sold_listings,
      COUNT(DISTINCT CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN id END) as listings_this_month,
      jsonb_agg(
        jsonb_build_object(
          'category', category,
          'count', COUNT(*)
        )
      ) as category_breakdown
    FROM listings
    WHERE ($1 IS NULL OR created_at >= $1)
      AND ($2 IS NULL OR created_at <= $2)
  ),
  transaction_stats AS (
    SELECT
      COALESCE(SUM(amount), 0) as total_transaction_value,
      COUNT(*) as total_transactions,
      COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) as completed_transactions
    FROM transactions
    WHERE ($1 IS NULL OR created_at >= $1)
      AND ($2 IS NULL OR created_at <= $2)
  ),
  rating_stats AS (
    SELECT COALESCE(AVG(rating), 0) as avg_rating
    FROM ratings
    WHERE ($1 IS NULL OR created_at >= $1)
      AND ($2 IS NULL OR created_at <= $2)
  )
  SELECT
    us.total_users,
    us.active_users,
    ls.total_listings,
    ls.active_listings,
    ls.sold_listings,
    ts.total_transaction_value,
    CASE WHEN ts.total_transactions > 0 
         THEN (ts.completed_transactions::NUMERIC / ts.total_transactions::NUMERIC) * 100 
         ELSE 0 END as transaction_completion_rate,
    rs.avg_rating,
    ls.listings_this_month,
    '[]'::jsonb as revenue_trend, -- To be populated with time-series data
    ls.category_breakdown
  FROM user_stats us, listing_stats ls, transaction_stats ts, rating_stats rs;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 2: User Engagement & Trust Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_engagement_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  avg_seller_rating NUMERIC,
  avg_buyer_rating NUMERIC,
  total_transactions BIGINT,
  repeat_buyer BOOLEAN,
  repeat_seller BOOLEAN,
  verified BOOLEAN,
  last_active TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH user_transactions AS (
    SELECT
      p.id as user_id,
      p.display_name as user_name,
      p.email_verified as verified,
      p.last_sign_in_at as last_active,
      COUNT(DISTINCT CASE WHEN t.buyer_id = p.id THEN t.id END) as buy_count,
      COUNT(DISTINCT CASE WHEN t.seller_id = p.id THEN t.id END) as sell_count,
      COALESCE(AVG(CASE WHEN r.rated_user_id = p.id AND r.rater_type = 'buyer' THEN r.rating END), 0) as avg_seller_rating,
      COALESCE(AVG(CASE WHEN r.rated_user_id = p.id AND r.rater_type = 'seller' THEN r.rating END), 0) as avg_buyer_rating
    FROM profiles p
    LEFT JOIN transactions t ON (t.buyer_id = p.id OR t.seller_id = p.id)
      AND ($1 IS NULL OR t.created_at >= $1)
      AND ($2 IS NULL OR t.created_at <= $2)
    LEFT JOIN ratings r ON r.rated_user_id = p.id
      AND ($1 IS NULL OR r.created_at >= $1)
      AND ($2 IS NULL OR r.created_at <= $2)
    WHERE ($1 IS NULL OR p.created_at >= $1)
      AND ($2 IS NULL OR p.created_at <= $2)
    GROUP BY p.id, p.display_name, p.email_verified, p.last_sign_in_at
    ORDER BY (buy_count + sell_count) DESC
    LIMIT $3
  )
  SELECT
    user_id,
    user_name,
    avg_seller_rating,
    avg_buyer_rating,
    (buy_count + sell_count) as total_transactions,
    buy_count > 1 as repeat_buyer,
    sell_count > 1 as repeat_seller,
    verified,
    last_active
  FROM user_transactions;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 3: Listing Performance Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_listing_performance_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total_listings BIGINT,
  sold_listings BIGINT,
  unsold_listings BIGINT,
  avg_listing_price NUMERIC,
  avg_sold_price NUMERIC,
  conversion_rate NUMERIC,
  avg_time_to_sell NUMERIC,
  expired_listings BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH listing_data AS (
    SELECT
      l.category,
      l.id,
      l.price,
      l.status,
      l.created_at,
      l.updated_at,
      t.final_price,
      t.created_at as sold_at
    FROM listings l
    LEFT JOIN transactions t ON t.listing_id = l.id AND t.status = 'completed'
    WHERE ($1 IS NULL OR l.created_at >= $1)
      AND ($2 IS NULL OR l.created_at <= $2)
  )
  SELECT
    category,
    COUNT(*) as total_listings,
    COUNT(DISTINCT CASE WHEN status = 'sold' THEN id END) as sold_listings,
    COUNT(DISTINCT CASE WHEN status != 'sold' THEN id END) as unsold_listings,
    AVG(price) as avg_listing_price,
    AVG(final_price) as avg_sold_price,
    CASE WHEN COUNT(*) > 0 
         THEN (COUNT(DISTINCT CASE WHEN status = 'sold' THEN id END)::NUMERIC / COUNT(*)::NUMERIC) * 100 
         ELSE 0 END as conversion_rate,
    COALESCE(AVG(EXTRACT(EPOCH FROM (sold_at - created_at))/86400), 0) as avg_time_to_sell,
    COUNT(DISTINCT CASE WHEN status = 'expired' THEN id END) as expired_listings
  FROM listing_data
  GROUP BY category
  ORDER BY total_listings DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 4: Transaction Completion Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_transaction_completion_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  transaction_count BIGINT,
  total_value NUMERIC,
  avg_completion_hours NUMERIC,
  failure_reasons JSONB,
  dispute_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.status,
    COUNT(*) as transaction_count,
    COALESCE(SUM(t.amount), 0) as total_value,
    COALESCE(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600), 0) as avg_completion_hours,
    jsonb_build_object(
      'buyer_cancelled', COUNT(*) FILTER (WHERE t.status = 'cancelled' AND t.cancelled_by = 'buyer'),
      'seller_cancelled', COUNT(*) FILTER (WHERE t.status = 'cancelled' AND t.cancelled_by = 'seller'),
      'timeout', COUNT(*) FILTER (WHERE t.status = 'cancelled' AND t.cancelled_by = 'system'),
      'dispute', COUNT(*) FILTER (WHERE t.status = 'disputed')
    ) as failure_reasons,
    COUNT(*) FILTER (WHERE t.status = 'disputed') as dispute_count
  FROM transactions t
  WHERE ($1 IS NULL OR t.created_at >= $1)
    AND ($2 IS NULL OR t.created_at <= $2)
  GROUP BY t.status
  ORDER BY transaction_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 5: Facility Usage Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_facility_usage_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  facility_id BIGINT,
  facility_name TEXT,
  location TEXT,
  transactions_handled BIGINT,
  dropoff_count BIGINT,
  collection_count BIGINT,
  avg_hold_hours NUMERIC,
  peak_dropoff_hour INTEGER,
  peak_collection_hour INTEGER,
  utilization_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH facility_stats AS (
    SELECT
      f.id as facility_id,
      f.name as facility_name,
      f.location,
      COUNT(t.id) as transactions_handled,
      COUNT(*) FILTER (WHERE t.dropped_off_at IS NOT NULL) as dropoff_count,
      COUNT(*) FILTER (WHERE t.collected_at IS NOT NULL) as collection_count,
      COALESCE(AVG(EXTRACT(EPOCH FROM (t.collected_at - t.dropped_off_at))/3600), 0) as avg_hold_hours,
      EXTRACT(HOUR FROM MAX(t.dropped_off_at)) as peak_dropoff_hour,
      EXTRACT(HOUR FROM MAX(t.collected_at)) as peak_collection_hour,
      f.capacity
    FROM facilities f
    LEFT JOIN transactions t ON t.facility_id = f.id
      AND ($1 IS NULL OR t.created_at >= $1)
      AND ($2 IS NULL OR t.created_at <= $2)
    GROUP BY f.id, f.name, f.location, f.capacity
  )
  SELECT
    facility_id,
    facility_name,
    location,
    transactions_handled,
    dropoff_count,
    collection_count,
    avg_hold_hours,
    peak_dropoff_hour::INTEGER,
    peak_collection_hour::INTEGER,
    CASE WHEN capacity > 0 
         THEN (transactions_handled::NUMERIC / (capacity * 30)::NUMERIC) * 100 
         ELSE 0 END as utilization_rate
  FROM facility_stats
  ORDER BY transactions_handled DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 6: Seller Behavior Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_seller_behavior_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  total_listings BIGINT,
  sold_listings BIGINT,
  success_rate NUMERIC,
  avg_seller_rating NUMERIC,
  total_revenue NUMERIC,
  avg_order_value NUMERIC,
  cancellation_count BIGINT,
  inactive_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH seller_data AS (
    SELECT
      p.id as seller_id,
      COALESCE(p.display_name, p.name, 'Unknown') as seller_name,
      COUNT(DISTINCT l.id) as total_listings,
      COUNT(DISTINCT CASE WHEN l.status = 'sold' THEN l.id END) as sold_listings,
      COALESCE(AVG(r.rating), 0) as avg_seller_rating,
      COALESCE(SUM(t.amount), 0) as total_revenue,
      COUNT(DISTINCT CASE WHEN t.status = 'cancelled' AND t.cancelled_by = 'seller' THEN t.id END) as cancellation_count,
      EXTRACT(DAY FROM (NOW() - MAX(l.created_at))) as inactive_days
    FROM profiles p
    LEFT JOIN listings l ON l.seller_id = p.id
      AND ($1 IS NULL OR l.created_at >= $1)
      AND ($2 IS NULL OR l.created_at <= $2)
    LEFT JOIN transactions t ON t.listing_id = l.id
      AND ($1 IS NULL OR t.created_at >= $1)
      AND ($2 IS NULL OR t.created_at <= $2)
    LEFT JOIN ratings r ON r.rated_user_id = p.id AND r.rater_type = 'buyer'
    WHERE ($1 IS NULL OR p.created_at >= $1)
      AND ($2 IS NULL OR p.created_at <= $2)
    GROUP BY p.id, p.display_name, p.name
    HAVING COUNT(DISTINCT l.id) > 0
    ORDER BY sold_listings DESC, total_revenue DESC
    LIMIT $3
  )
  SELECT
    seller_id,
    seller_name,
    total_listings,
    sold_listings,
    CASE WHEN total_listings > 0 
         THEN (sold_listings::NUMERIC / total_listings::NUMERIC) * 100 
         ELSE 0 END as success_rate,
    avg_seller_rating,
    total_revenue,
    CASE WHEN sold_listings > 0 
         THEN total_revenue / sold_listings 
         ELSE 0 END as avg_order_value,
    cancellation_count,
    inactive_days::INTEGER
  FROM seller_data;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 7: Buyer Behavior Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_buyer_behavior_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  buyer_id UUID,
  buyer_name TEXT,
  total_purchases BIGINT,
  repeat_purchases BIGINT,
  total_spent NUMERIC,
  avg_order_value NUMERIC,
  completion_rate NUMERIC,
  avg_buyer_rating NUMERIC,
  favorite_category TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH buyer_data AS (
    SELECT
      p.id as buyer_id,
      COALESCE(p.display_name, p.name, 'Unknown') as buyer_name,
      COUNT(DISTINCT t.id) as total_purchases,
      COUNT(DISTINCT t.id) - COUNT(DISTINCT t.listing_id) as repeat_purchases,
      COALESCE(SUM(t.amount), 0) as total_spent,
      COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_purchases,
      COALESCE(AVG(r.rating), 0) as avg_buyer_rating,
      MODE() WITHIN GROUP (ORDER BY l.category) as favorite_category
    FROM profiles p
    LEFT JOIN transactions t ON t.buyer_id = p.id
      AND ($1 IS NULL OR t.created_at >= $1)
      AND ($2 IS NULL OR t.created_at <= $2)
    LEFT JOIN listings l ON l.id = t.listing_id
    LEFT JOIN ratings r ON r.rated_user_id = p.id AND r.rater_type = 'seller'
    WHERE ($1 IS NULL OR p.created_at >= $1)
      AND ($2 IS NULL OR p.created_at <= $2)
    GROUP BY p.id, p.display_name, p.name
    HAVING COUNT(DISTINCT t.id) > 0
    ORDER BY total_purchases DESC, total_spent DESC
    LIMIT $3
  )
  SELECT
    buyer_id,
    buyer_name,
    total_purchases,
    CASE WHEN repeat_purchases > 0 THEN repeat_purchases ELSE 0 END as repeat_purchases,
    total_spent,
    CASE WHEN total_purchases > 0 
         THEN total_spent / total_purchases 
         ELSE 0 END as avg_order_value,
    CASE WHEN total_purchases > 0 
         THEN (completed_purchases::NUMERIC / total_purchases::NUMERIC) * 100 
         ELSE 0 END as completion_rate,
    avg_buyer_rating,
    COALESCE(favorite_category, 'Unknown') as favorite_category
  FROM buyer_data;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- REPORT 8: Flagged/Problematic Listings Report
-- ============================================================================

CREATE OR REPLACE FUNCTION get_flagged_listings_report(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  listing_id BIGINT,
  title TEXT,
  seller_id UUID,
  seller_name TEXT,
  flag_reason TEXT,
  status TEXT,
  low_rating_count BIGINT,
  report_count BIGINT,
  suspicious_pricing BOOLEAN,
  risk_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH flagged_data AS (
    SELECT
      l.id as listing_id,
      l.title,
      l.seller_id as seller_id,
      COALESCE(p.display_name, p.name, 'Unknown') as seller_name,
      l.flag_reason,
      l.status,
      COUNT(DISTINCT r.id) FILTER (WHERE r.rating <= 2) as low_rating_count,
      COUNT(DISTINCT mr.id) as report_count,
      CASE 
        WHEN l.price < (SELECT PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY price) FROM listings WHERE category = l.category) 
        THEN true 
        ELSE false 
      END as suspicious_pricing,
      -- Calculate risk score based on multiple factors
      LEAST(
        (COUNT(DISTINCT r.id) FILTER (WHERE r.rating <= 2) * 20) +
        (COUNT(DISTINCT mr.id) * 15) +
        (CASE WHEN l.flag_reason IS NOT NULL THEN 30 ELSE 0 END) +
        (CASE WHEN l.status = 'flagged' THEN 25 ELSE 0 END) +
        (CASE WHEN suspicious_pricing THEN 10 ELSE 0 END),
        100
      ) as risk_score
    FROM listings l
    LEFT JOIN profiles p ON p.id = l.seller_id
    LEFT JOIN ratings r ON r.rated_user_id = p.id
      AND ($1 IS NULL OR r.created_at >= $1)
      AND ($2 IS NULL OR r.created_at <= $2)
    LEFT JOIN moderation_reports mr ON mr.listing_id = l.id
    WHERE (l.flag_reason IS NOT NULL 
           OR l.status = 'flagged' 
           OR EXISTS (SELECT 1 FROM ratings r2 WHERE r2.rated_user_id = p.id AND r2.rating <= 2))
      AND ($1 IS NULL OR l.created_at >= $1)
      AND ($2 IS NULL OR l.created_at <= $2)
    GROUP BY l.id, l.title, l.seller_id, p.display_name, p.name, l.flag_reason, l.status, l.price, l.category
    ORDER BY risk_score DESC
    LIMIT $3
  )
  SELECT
    listing_id,
    title,
    seller_id,
    seller_name,
    flag_reason,
    status,
    low_rating_count,
    report_count,
    suspicious_pricing,
    risk_score
  FROM flagged_data;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_listings_category_status ON listings(category, status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_facility ON transactions(facility_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_seller ON transactions(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON ratings(rated_user_id, rating);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_signin ON profiles(last_sign_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_platform_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_engagement_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_listing_performance_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_completion_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_facility_usage_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_behavior_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_buyer_behavior_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_flagged_listings_report TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_platform_overview IS 'Returns high-level marketplace health metrics';
COMMENT ON FUNCTION get_user_engagement_report IS 'Returns user trust and engagement metrics';
COMMENT ON FUNCTION get_listing_performance_report IS 'Returns listing performance and conversion metrics';
COMMENT ON FUNCTION get_transaction_completion_report IS 'Returns transaction completion and failure analysis';
COMMENT ON FUNCTION get_facility_usage_report IS 'Returns facility utilization and operational metrics';
COMMENT ON FUNCTION get_seller_behavior_report IS 'Returns seller performance and behavior analysis';
COMMENT ON FUNCTION get_buyer_behavior_report IS 'Returns buyer behavior and retention metrics';
COMMENT ON FUNCTION get_flagged_listings_report IS 'Returns flagged listings and risk analysis';
