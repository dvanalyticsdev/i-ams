# i-AMS

Last updated: 2026-06-24

`i-AMS` is the current accounting and expense management application in this folder. It uses a React + Vite frontend backed by an Express API and MongoDB for expense records, categories, departments, and admin authentication.

## Current functionality
- Admin login and session validation flows
- Expense CRUD operations
- Bulk expense import workflow
- Import-batch deletion support
- Category and subcategory management
- Department management
- Default category initialization
- Balance check support service
- Dashboard views and charts built with Recharts
- Admin creation, listing, password change, and admin deletion flows

## Frontend modules
Key frontend components in `src/components/`:
- `Dashboard.jsx`
- `ExpenseTracker.jsx`
- `BalanceCheck.jsx`
- `CategoryManagement.jsx`
- `AdminManagement.jsx`
- `Login.jsx`
- `ChangePasswordModal.jsx`

Service modules in `src/services/` cover API access, auth, expenses, categories, defaults, and balance-check behavior.

## API surface in the current build
- `GET /api/health`
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:expenseId`
- `DELETE /api/expenses/:expenseId`
- `POST /api/expenses/bulk`
- `DELETE /api/expenses/import-batch/:importBatchId`
- `GET /api/categories`
- `GET /api/categories/init`
- `POST /api/categories/init`
- `POST /api/categories`
- `PUT /api/categories`
- `DELETE /api/categories/:categoryName`
- `POST /api/categories/:categoryName/subcategories`
- `DELETE /api/categories/:categoryName/subcategories/:subCategoryName`
- `GET /api/departments`
- `POST /api/departments`
- `PUT /api/departments`
- `DELETE /api/departments/:departmentName`
- `POST /api/auth/login`
- `POST /api/auth/validate`
- `POST /api/auth/change-password`
- `POST /api/auth/create-admin`
- `GET /api/auth/admins`
- `POST /api/auth/admins/delete/:adminUsername`

## Local development
Prerequisites:
- Node.js
- MongoDB connection configured in `.env`

Install dependencies:
```bash
npm install
```

Run frontend and backend together:
```bash
npm run dev:full
```

Useful alternatives:
```bash
npm run server
npm run dev
npm run build
npm run preview
```

## Project structure
- `src/` - React frontend
- `server.js` - Express API server
- `api/` - deployment-oriented server entry points
- `Master Expense Tracker.xlsx` - spreadsheet source/reference data used by the project
- `vercel.json` - deployment config

## Notes
- The previous README was still the default Vite template. This file now reflects the actual shipped app and its current modules.
