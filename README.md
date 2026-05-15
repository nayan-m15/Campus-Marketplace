# CampusXchange

[![codecov](https://codecov.io/gh/nayan-m15/Campus-Marketplace/graph/badge.svg)](https://codecov.io/gh/nayan-m15/Campus-Marketplace)

CampusXchange is a campus marketplace web application that helps students buy, sell, trade, and coordinate item handovers inside a university community. It combines a student-facing marketplace with messaging, booking, moderation, staff operations, and admin reporting in one platform.

Live website: https://nayan-m15.github.io/Campus-Marketplace/

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Run Locally](#run-locally)
- [Build and Deployment](#build-and-deployment)
- [Folder Structure](#folder-structure)
- [How to Use the Website](#how-to-use-the-website)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Project Overview

CampusXchange was built for campus communities that need a safer, simpler way to exchange second-hand goods and coordinate transactions. The platform is designed for:

- Students who want to browse, buy, sell, trade, save, and message
- Staff who manage facility-based handovers and booking logistics
- Admin users who moderate listings, manage operations, and review marketplace reports

The application uses Supabase for authentication, database operations, storage-related workflows, and edge functions, while the frontend is built with React and Vite.

## Features

- User authentication with Supabase Auth
- Profile setup and public profile pages
- Marketplace browsing with search, category filtering, condition filtering, and price controls
- Listing creation and management for student sellers
- Wishlist support for saved items
- Buyer-to-seller messaging
- Trade offer support and transaction coordination
- Booking flow for campus trade or handover facilities
- Rating prompts after completed transactions
- Staff dashboard for drop-off, collection, and booking management
- Admin dashboard for moderation, facilities, staff access, and reports
- Price suggestion support powered by a Supabase Edge Function
- Responsive frontend deployed to GitHub Pages
- Automated tests, linting, and coverage reporting

## Tech Stack

- React 19
- Vite 8
- JavaScript (ES modules)
- Supabase 
- Vitest
- Testing Library
- ESLint
- jsPDF and `jspdf-autotable`
- GitHub Actions
- GitHub Pages

## Screenshots


## Prerequisites

Before running the project locally, make sure you have:

- Node.js 18 or later
- npm
- A Supabase project
- Supabase tables, policies, RPC functions, and edge functions configured for this app

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/nayan-m15/Campus-Marketplace.git
   ```

2. Move into the project folder:

   ```bash
   cd Campus-Marketplace
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

## Environment Variables

Create a `.env.local` file in the project root and add the variables below:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:5173
VITE_BASE_PATH=/
VITE_DEBUG_AUTH=false
```

### Variable Notes

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase public anon key
- `VITE_SITE_URL`: Used for auth redirects
- `VITE_BASE_PATH`: Base path for deployment; use `/` locally and `/Campus-Marketplace/` for GitHub Pages
- `VITE_DEBUG_AUTH`: Optional auth debugging flag for development

Important:

- Do not commit private environment values to version control
- The code accepts `VITE_SUPABASE_KEY` as a fallback, but `VITE_SUPABASE_ANON_KEY` is the preferred variable name

## Run Locally

1. Make sure your environment variables are set
2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open the local Vite URL shown in your terminal, usually:

   ```text
   http://localhost:5173
   ```

### Other Useful Scripts

```bash
npm run lint
npm run test
npm run test:run
npm run test:coverage
npm run build
npm run preview
```

## Build and Deployment

### Production Build

To create a production build:

```bash
npm run build
```

The output is generated in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

### GitHub Pages Deployment

This project is configured for GitHub Pages through GitHub Actions.

Deployment notes:

- The Vite base path defaults to `/Campus-Marketplace/`
- The workflow builds the app on pushes to `main`
- The static site is deployed from the generated `dist/` folder

Repository secrets used by the deployment workflow:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If you deploy somewhere other than GitHub Pages, update `VITE_BASE_PATH` and `VITE_SITE_URL` accordingly.

## Folder Structure

```text
Campus-Marketplace/
|-- public/                  Static assets
|-- src/
|   |-- assets/              App images and icons
|   |-- components/          UI components and page-level features
|   |-- constants/           Shared constants
|   |-- context/             React context providers and hooks
|   |-- data/                Listing data fetching and shaping
|   |-- hooks/               Reusable custom hooks
|   |-- styles/              CSS files
|   |-- test/                Test helpers
|   |-- utils/               Business logic and utility functions
|   |-- App.jsx              Main application flow
|   |-- main.jsx             Frontend entry point
|   `-- supabaseClient.js    Supabase client setup
|-- supabase/
|   |-- functions/           Supabase Edge Functions
|   `-- migrations/          Database migration files
|-- .github/workflows/       CI and deployment workflows
|-- package.json             Scripts and dependencies
`-- vite.config.js           Vite configuration
```

## How to Use the Website

### For Students

1. Open the website
2. Sign up or log in
3. Complete your profile setup
4. Browse listings using search and filters
5. Open a listing to view details
6. Save listings to your wishlist if needed
7. Message the seller to ask questions or make arrangements
8. Create your own listing from the marketplace interface
9. Manage your active listings from `Your Listings`
10. Use the bookings flow when a facility-based handover is required

### For Staff

Staff accounts can access the trade facility dashboard to:

- View and manage booking-related workflows
- Coordinate drop-offs and collections
- Support transaction progress between users

### For Admins

Admin accounts can:

- Moderate listings
- Manage facilities and booking settings
- Manage staff access
- Generate marketplace reports and exports

## API Documentation

This project does not use a separate Express or Node.js REST API. Instead, it communicates directly with Supabase services.

### Frontend-to-Supabase Usage

The frontend interacts with:

- Supabase Auth for sign-in and session handling
- Supabase tables for application data
- Supabase RPC functions for reporting and booking workflows
- Supabase Edge Functions for advanced server-side logic

### Main Data Areas

Based on the current codebase, the app uses tables and resources such as:

- `profiles`
- `listings`
- `messages`
- `offers`
- `transactions`
- `wishlists`
- `ratings`
- `bookings`
- `facilities`
- `facility_hours`
- `price_suggestion_cache`

### RPC Functions Referenced in the Frontend

- `book_transaction_slot`
- `delete_my_account`
- `get_executive_overview`
- `get_seller_performance`
- `get_pricing_intelligence`
- `get_listing_health`
- `get_trend_report`

### Edge Functions

#### `price-suggestion`

Purpose:

- Compares a listing against shopping results to estimate a suggested price range

Used for:

- Listing price guidance
- Trade value estimation support

Expected backend secrets include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERPAPI_API_KEY`

#### `delete-account`

Purpose:

- Deletes a user's account data, related records, stored files, and auth account

Expected backend secrets include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### API Setup Note

If your Supabase schema, policies, functions, or storage buckets are incomplete, some features will not work correctly. Review the `supabase/migrations/` and `supabase/functions/` folders before deployment.

## Contributing

Contributions are welcome.

To contribute:

1. Fork the repository
2. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. Make your changes
4. Run checks before submitting:

   ```bash
   npm run lint
   npm run test:run
   ```

5. Commit your work
6. Push your branch
7. Open a pull request with a clear description of the change

Recommended contribution practices:

- Keep pull requests focused and easy to review
- Add or update tests when changing behavior
- Document any required environment or schema changes

## License

No license file is currently included in this repository.

If you want this project to be open for reuse, add a `LICENSE` file such as MIT, Apache-2.0, or GPL and update this section.

## Contact

Project maintainer: Nayan

- GitHub: https://github.com/nayan-m15
- Repository: https://github.com/nayan-m15/Campus-Marketplace
- Live site: https://nayan-m15.github.io/Campus-Marketplace/
