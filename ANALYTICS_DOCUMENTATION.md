# Modern Analytics & Reporting System

## Overview

A comprehensive, professional analytics dashboard for the CAMPUSXCHANGE marketplace platform. This system provides executive-quality insights into platform health, user behavior, transaction patterns, and operational metrics.

## Architecture

### Backend Layer

**Location:** `src/services/analytics/`

The analytics service layer provides:
- Centralized data fetching with caching
- Reusable query builders
- Efficient aggregation queries
- Server-side filtering support

**Key Files:**
- `index.js` - Core analytics service with caching
- `reports.js` - Report-specific service functions

### Database Layer

**Location:** `supabase/migrations/20260507_create_analytics_functions.sql`

Optimized SQL functions for all 8 report types:
1. `get_platform_overview` - High-level marketplace metrics
2. `get_user_engagement_report` - User trust and engagement
3. `get_listing_performance_report` - Listing conversion metrics
4. `get_transaction_completion_report` - Transaction analysis
5. `get_facility_usage_report` - Facility utilization
6. `get_seller_behavior_report` - Seller performance
7. `get_buyer_behavior_report` - Buyer behavior and retention
8. `get_flagged_listings_report` - Risk and fraud detection

**Performance Optimizations:**
- Strategic indexes on frequently queried columns
- Efficient JOIN operations
- Aggregated queries to minimize data transfer
- 5-minute client-side caching

### Frontend Layer

**Location:** `src/components/analytics/`

**Components:**
- `ModernReportsDashboard.jsx` - Main dashboard with tabbed interface
- `KPICard.jsx` - Reusable KPI metric cards
- `FilterToolbar.jsx` - Date range, facility, and user role filters
- `AnalyticsChart.jsx` - Chart wrapper using Recharts
- `DataTable.jsx` - Sortable, filterable data tables
- `PlatformOverviewPanel.jsx` - Platform overview report
- `UserEngagementPanel.jsx` - User engagement report
- `ListingPerformancePanel.jsx` - Listing performance report
- `TransactionCompletionPanel.jsx` - Transaction completion report
- `FacilityUsagePanel.jsx` - Facility usage report
- `SellerBehaviorPanel.jsx` - Seller behavior report
- `BuyerBehaviorPanel.jsx` - Buyer behavior report
- `FlaggedListingsPanel.jsx` - Flagged listings report

**Styling:** `src/styles/analytics.css`

## Reports

### 1. Platform Overview Dashboard

**Purpose:** High-level marketplace health overview

**Metrics:**
- Total users
- Active users
- Total listings
- Active listings
- Sold listings
- Total transaction value
- Transaction completion rate
- Average platform rating
- Listings created this month

**Visualizations:**
- KPI cards with trend indicators
- Category distribution pie chart
- Listing performance bar chart
- Detailed data table

### 2. User Engagement & Trust Report

**Purpose:** Measure trust and participation quality

**Metrics:**
- Average seller rating
- Average buyer rating
- Repeat buyers
- Repeat sellers
- Transactions per user
- Verified vs non-verified users
- Top-rated users

**Visualizations:**
- Rating distribution chart
- Repeat vs one-time buyer pie chart
- User engagement table

### 3. Listing Performance Report

**Purpose:** Understand how listings perform and convert

**Metrics:**
- Total listings by category
- Sold vs unsold ratio
- Average listed price
- Average sold price
- Time to sell
- Conversion rate
- Expired listings

**Visualizations:**
- Conversion rate bar chart
- Listed vs sold price comparison
- Performance details table

### 4. Transaction Completion Report

**Purpose:** Identify failed or incomplete transaction patterns

**Metrics:**
- Completed transactions
- Cancelled transactions
- Pending transactions
- Completion percentage
- Average completion time
- Failure reasons
- Dispute counts

**Visualizations:**
- Status distribution pie chart
- Cancellation reasons bar chart
- Transaction details table

### 5. Facility Usage Report

**Purpose:** Track operational usage of dropoff and collection facilities

**Metrics:**
- Most-used facilities
- Peak dropoff times
- Peak collection times
- Transactions per facility
- Average holding duration
- Facility utilization trends

**Visualizations:**
- Facility usage comparison chart
- Utilization rate bar chart
- Facility details table

### 6. Seller Behavior Report

**Purpose:** Analyze seller quality and marketplace supply

**Metrics:**
- Top sellers
- Average listings per seller
- Seller success rate
- Average seller rating
- Total revenue
- Frequent cancellations
- Inactive sellers

**Visualizations:**
- Top sellers by revenue chart
- Seller rating distribution
- Seller behavior table

### 7. Buyer Behavior Report

**Purpose:** Understand demand-side activity and retention

**Metrics:**
- Top buyers
- Repeat purchase frequency
- Average order value
- Favorite categories
- Buyer completion rate
- Buyer rating averages

**Visualizations:**
- Top buyers by spending chart
- Category affinity pie chart
- Buyer behavior table

### 8. Flagged/Problematic Listings Report

**Purpose:** Detect fraud, abuse, spam, or problematic behavior

**Metrics:**
- Flagged listings
- Listings removed
- Users with repeated reports
- Suspicious pricing anomalies
- Frequent cancellations
- Low-rated sellers
- Disputed transactions
- Risk scores

**Visualizations:**
- Risk level distribution pie chart
- Top risk scores bar chart
- Flagged listings table with risk indicators

## Installation

### Prerequisites

The system requires the following dependencies (already added to package.json):
- `recharts@^2.12.7` - Modern charting library
- `date-fns@^3.6.0` - Date manipulation utilities

### Database Migration

Run the SQL migration to create the analytics functions:

```bash
# Apply the migration to your Supabase database
supabase migration up
```

Or manually execute the SQL in:
`supabase/migrations/20260507_create_analytics_functions.sql`

### Install Dependencies

```bash
npm install
```

## Usage

### Accessing the Dashboard

The modern analytics dashboard is integrated into the existing AdminDashboard:

1. Navigate to the Admin Portal
2. Click on "Analytics" in the sidebar navigation
3. Select from 8 different report types using the tab interface

### Filtering

Each report supports:
- **Date Range:** Presets (7 days, 30 days, 90 days, 6 months, 1 year) or custom range
- **Facility:** Filter by specific dropoff/collection facility
- **User Role:** Filter by buyers, sellers, verified users, or all users

### Export

Each report includes export functionality:
- **CSV:** Download raw data with summary
- **PDF:** Download formatted report with insights

## Performance Optimizations

### Database Level

1. **Strategic Indexes:**
   - `idx_listings_category_status` - Category and status queries
   - `idx_listings_created_at` - Time-based queries
   - `idx_transactions_status_date` - Transaction status filtering
   - `idx_transactions_facility` - Facility-based queries
   - `idx_transactions_buyer_seller` - User-based queries
   - `idx_ratings_rated_user` - Rating aggregation
   - `idx_profiles_created_at` - User signup trends
   - `idx_profiles_last_signin` - Activity tracking
   - `idx_listings_seller_id` - Seller-based queries

2. **Query Optimization:**
   - Aggregated queries at database level
   - Efficient JOIN operations
   - Minimal data transfer with targeted SELECTs
   - CTEs for complex aggregations

### Application Level

1. **Caching:**
   - 5-minute client-side cache for report data
   - Cache key based on report type and filters
   - Manual cache clear option

2. **Lazy Loading:**
   - Report panels load on-demand
   - Skeleton loading states
   - Empty state handling

3. **Pagination:**
   - Server-side pagination support
   - Configurable page sizes
   - Efficient data rendering

## API Reference

### Analytics Service

```javascript
import { fetchPlatformOverview } from './services/analytics/reports';

// Fetch platform overview with filters
const data = await fetchPlatformOverview({
  startDate: '2026-01-01',
  endDate: '2026-07-31',
  useCache: true
});
```

### Report Functions

All report functions follow the same pattern:

```javascript
import {
  fetchPlatformOverview,
  fetchUserEngagementReport,
  fetchListingPerformanceReport,
  fetchTransactionCompletionReport,
  fetchFacilityUsageReport,
  fetchSellerBehaviorReport,
  fetchBuyerBehaviorReport,
  fetchFlaggedListingsReport,
} from './services/analytics/reports';

// Parameters:
// - startDate: ISO date string (optional)
// - endDate: ISO date string (optional)
// - limit: Number of records (optional, default varies)
// - useCache: Boolean (optional, default true)
```

### Export Utilities

```javascript
import { exportToCSV, exportToPDF } from './utils/exportUtils';

// Export to CSV
exportToCSV(data, 'filename.csv', summaryLines);

// Export to PDF
exportToPDF(
  data,
  'filename.pdf',
  title,
  subtitle,
  summaryLines,
  insightLines
);
```

## Component API

### KPICard

```jsx
<KPICard
  title="Total Users"
  value={1234}
  format="number" // 'number' | 'currency' | 'percentage'
  trend="+5.2%"
  trendDirection="up" // 'up' | 'down' | null
  icon={<span>👥</span>}
  color="blue" // 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
  size="medium" // 'small' | 'medium' | 'large'
/>
```

### AnalyticsChart

```jsx
<AnalyticsChart
  type="line" // 'line' | 'bar' | 'pie' | 'area'
  data={chartData}
  dataKey="value"
  nameKey="name"
  lines={[{ dataKey: 'value', name: 'Label', color: '#3B82F6' }]}
  height={300}
  showLegend={true}
  showGrid={true}
/>
```

### DataTable

```jsx
<DataTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Value', format: 'number' },
  ]}
  data={tableData}
  pageSize={10}
  sortable={true}
  pagination={true}
  onRowClick={(row) => console.log(row)}
/>
```

## Styling

The analytics system uses modern, professional styling with:

- Clean spacing and soft shadows
- Consistent color hierarchy
- Professional typography
- Responsive design
- Dark/light mode ready (CSS variables)
- Smooth transitions and animations

### CSS Classes

Key classes for customization:
- `.kpi-card` - KPI card styling
- `.filter-toolbar` - Filter toolbar
- `.data-table` - Data table
- `.chart-container` - Chart containers
- `.tab-navigation` - Tab navigation
- `.status-badge-*` - Status badges

## Security Considerations

1. **Row Level Security:** All SQL functions respect Supabase RLS policies
2. **Input Validation:** All filter inputs are validated
3. **SQL Injection Prevention:** Parameterized queries throughout
4. **Rate Limiting:** Consider implementing rate limiting for report endpoints
5. **Sensitive Data:** No sensitive user data exposed in reports

## Future Enhancements

Potential improvements:
- Real-time data streaming
- Advanced drill-down capabilities
- Custom report builder
- Scheduled report generation
- Email alerting for anomalies
- Machine learning for fraud detection
- Mobile app version
- Advanced visualizations (heatmaps, funnel charts)

## Troubleshooting

### Reports Not Loading

1. Check database migration was applied
2. Verify Supabase connection
3. Check browser console for errors
4. Ensure user has proper permissions

### Slow Performance

1. Check database indexes are created
2. Review query execution plans
3. Consider reducing date range
4. Clear cache and retry

### Export Issues

1. Verify jsPDF and jspdf-autotable are installed
2. Check browser supports PDF generation
3. Ensure data is not empty before export

## Support

For issues or questions:
1. Check this documentation
2. Review the component source code
3. Check Supabase logs
4. Review browser console errors

## Credits

Built with:
- React 19
- Supabase
- Recharts
- date-fns
- jsPDF
