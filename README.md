# AI CFO Platform

Financial Intelligence for Indian Startups and SMEs..

## Overview

AI CFO is a read-only financial intelligence platform that monitors your accounting data and provides conservative, CFO-grade insights. It integrates with Tally, Zoho Books, and QuickBooks to give you real-time visibility into your financial health.

## Features

### Free Plan
- Manual data entry
- Basic CFO Overview dashboard
- Revenue, Expense, and Cashflow dashboards
- Up to 100 transactions

### Paid Plans
- **Starter**: Tally integration, AI insights
- **Professional**: Zoho Books, QuickBooks, full AI features
- **Enterprise**: Custom integrations, dedicated support

## Tech Stack

- **Backend**: Node.js 22, Express, PostgreSQL, Sequelize
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Authentication**: JWT with bcrypt

## Quick Start

### Prerequisites
- Node.js 22.x
- Docker & Docker Compose (for local PostgreSQL + Redis)

### Local Development

```bash
# 1. Clone & install
git clone <repo-url>
cd aicfo
npm run install:all

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set DATABASE_URL and JWT_SECRET

# 3. Start databases, run migrations, seed, and launch
npm run db:up                    # Start Postgres + Redis containers
npm run db:migrate               # Apply all database migrations
npm run db:seed                  # (Optional) Create demo user
npm run dev                      # Start backend + frontend
```

Backend runs on http://localhost:5000 — Frontend runs on http://localhost:5173

Demo credentials (after seeding): `demo@aicfo.com` / `demo123456`

> For full infrastructure docs see [docs/INFRA_SETUP.md](docs/INFRA_SETUP.md)

### Railway Deployment

1. Create a new project on Railway
2. Add a PostgreSQL database
3. Connect your GitHub repository
4. Railway will auto-detect and deploy

Required environment variables:
- `DATABASE_URL` (auto-provided by Railway PostgreSQL)
- `JWT_SECRET` (generate a secure random string)
- `NODE_ENV=production`

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Companies
- `GET /api/companies` - List user companies
- `POST /api/companies` - Create company
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

### Dashboard
- `GET /api/dashboard/overview` - CFO Overview
- `GET /api/dashboard/revenue` - Revenue dashboard
- `GET /api/dashboard/expenses` - Expense dashboard
- `GET /api/dashboard/cashflow` - Cashflow dashboard

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### AI Features (Paid)
- `GET /api/ai/insights` - Get AI insights
- `POST /api/ai/chat` - Chat with AI CFO

### Integrations (Paid)
- `GET /api/integrations` - List integrations
- `POST /api/integrations/tally` - Connect Tally
- `POST /api/integrations/:id/sync` - Sync integration

## Demo Credentials

After seeding:
- Email: `demo@aicfo.com`
- Password: `demo123456`

## License

MIT
# Test push after secret cleanup



## Windows Connector (MSI)

A production Windows connector solution is available under `connector-dotnet/`.

Build on Windows:
```powershell
cd connector-dotnet
./build.ps1 -Configuration Release
```

Copy generated MSI to backend download path:
- `backend/downloads/AICFOConnectorSetup.msi`

Backend serves this artifact from:
- `GET /download/connector`
