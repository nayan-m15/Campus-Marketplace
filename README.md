# Campus Marketplace

[![codecov](https://codecov.io/gh/nayan-m15/Campus-Marketplace/graph/badge.svg)](https://codecov.io/gh/nayan-m15/Campus-Marketplace)

Campus Marketplace is a React + Vite web app for buying, selling, and coordinating second-hand items within a campus community. It combines a student-facing marketplace with role-based admin and trade-facility dashboards backed by Supabase.

## Overview

The app is designed around a few core flows:

- Students can browse listings, search and filter items, save favourites, message sellers, and manage their own listings.
- New users complete a profile setup flow before using the marketplace.
- Staff users can manage trade-facility drop-offs, collections, and transaction progress.
- Admin users can configure facility hours, capacity, and marketplace reports.

## Features

- Email/password and Google sign-in with Supabase Auth
- Profile setup and public profile views
- Browse, search, filter, and sort marketplace listings
- Listing creation with category, condition, price, and images
- Listing details modal with direct seller messaging
- Real-time unread message badge support
- Wishlist support for saved items
- `Your Listings` and account settings pages
- Staff dashboard for drop-off and collection workflow management
- Admin dashboard for facility configuration and report generation
- Mock listing fallback when Supabase listing fetches fail

## Tech Stack

- React 19
- Vite 8
- Supabase
- Vitest + Testing Library
- ESLint
- jsPDF + `jspdf-autotable` for report exports

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project with the required tables, auth providers, and RPC functions

### Installation

```bash
npm install
```

### Environment Variables

Create a local env file such as `.env.local` and add:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_URL=https://your-deployed-app.example.com
VITE_BASE_PATH=/
```

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in [`src/supabaseClient.js`](/C:/Users/hpars/OneDrive/Documents/GitHub/Campus-Marketplace/src/supabaseClient.js). `VITE_APP_URL` is used for auth redirects, and `VITE_BASE_PATH` lets you override the GitHub Pages base path when deploying elsewhere.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:run
npm run test:coverage
```

## Running the App

Start the development server:

```bash
npm run dev
```

Then open the local URL shown by Vite, usually `http://localhost:5173`.

## Supabase Notes

Based on the codebase, the app expects Supabase resources for at least:

- `profiles`
- `listings`
- `messages`
- `facilities`
- `facility_hours`

The admin reporting flow also calls RPC functions, including:

- `get_listings_overview`
- `get_category_report`
- `get_trend_report`
- `get_condition_report`
- `get_top_sellers`
- `get_price_distribution`

If these tables or functions are missing, parts of the app will not work.

## Project Structure

```text
src/
  components/     UI screens and feature components
  context/        auth and wishlist state
  data/           listing fetching and normalisation
  styles/         component and page styling
  assets/         local images and icons
  App.jsx         main app flow and page switching
  main.jsx        app entry point
  supabaseClient.js
```

## Testing

Run the test suite with:

```bash
npm run test:run
```

The project is configured with Vitest and Testing Library.

Generate a local coverage report with:

```bash
npm run test:coverage
```

This writes coverage artifacts to `coverage/`, including `coverage/lcov.info` for Codecov uploads.

## Codecov Integration

This repository is configured to upload coverage from `.github/workflows/test.yml` using `codecov/codecov-action@v5` with GitHub OIDC authentication.

To finish connecting the GitHub repository:

1. Open Codecov and add the GitHub repository `nayan-m15/Campus-Marketplace`.
2. Push the workflow changes so GitHub Actions can generate `coverage/lcov.info` and upload it.

The README badge uses the repository-level Codecov badge URL, so it does not depend on a hardcoded branch name like `main`.

If your Codecov account or repository settings require a token instead of OIDC, add a GitHub Actions secret named `CODECOV_TOKEN` and switch the workflow back to token-based authentication.

## Current Implementation Notes

- Navigation is handled inside the React app state rather than a routing library.
- Role-based views are chosen from the signed-in user's `profiles.role` value.
- Listings exclude sold items in the main marketplace view.
- If listing fetches fail, the app falls back to a small mock dataset for resilience during development.

## Future Improvements

- Add proper client-side routing
- Add schema/setup documentation for Supabase
- Add image upload/storage documentation
- Expand automated test coverage across auth, messaging, and dashboards
- Add deployment instructions

## License

No license file is currently included in this repository.
