# AI CFO Platform

Financial Intelligence for Indian Startups and SMEs.

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
- PostgreSQL 14+

### Local Development

1. Clone the repository
```bash
git clone <repo-url>
cd aicfo
```

2. Install dependencies
```bash
npm run install:all
```

3. Set up environment variables
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

4. Run migrations
```bash
npm run migrate
```

5. Seed demo data (optional)
```bash
npm run seed
```

6. Start development servers
```bash
npm run dev
```

Backend will run on http://localhost:5000
Frontend will run on http://localhost:5173

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
