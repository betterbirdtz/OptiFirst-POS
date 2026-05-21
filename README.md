# OptiFirst POS Daily Sales and Stock Reports

Mobile-first internal reporting app for replacing paper Daily Sales and Daily Stock forms. Employees submit reports from the React app, and the backend saves rows into one master Google Spreadsheet through a Google Apps Script Web App API.

## Stack

- Vite + React + TypeScript
- Tailwind CSS-style utility classes
- Google Apps Script Web App API
- Google Sheets as the database
- jsPDF PDF exports
- xlsx Excel exports
- Local mock mode when `VITE_APPS_SCRIPT_URL` is empty

## Project Structure

```text
src/
  api/appsScriptClient.ts
  components/admin/
  components/employee/
  pages/admin/
  pages/employee/
  routes/ProtectedRoute.tsx
  types/index.ts
  utils/
google-apps-script/
  Code.gs
  README_SETUP.md
public/
  manifest.webmanifest
```

## Google Sheets Setup

1. Create one Google Spreadsheet.
2. Open `Extensions > Apps Script`.
3. Paste the full contents of `google-apps-script/Code.gs`.
4. Save the Apps Script project.
5. Run `setupSheets()` once and approve permissions.
6. Confirm these tabs were created:
   `Employees`, `Products`, `DailySales`, `DailyStock`, `DailySummary`, `CreditSales`, `OpeningStock`, `Logs`.
7. Deploy as Web App:
   - Execute as: `Me`
   - Who has access: `Anyone`
8. Copy the Web App URL.

## Frontend Setup

Create `.env` in the project root:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Sample Credentials

These are created by `setupSheets()` and also work in local mock mode.

- Admin: `+1234567890` / `1234`
- Employee: `+1234567891` / `5678`

## Main Flows

- Employee logs in with phone and PIN.
- Employee completes the four-step daily report: Daily Sales, Daily Stock, Review, Submit.
- Sales totals calculate live.
- Credit sales require customer name.
- Stock expected closing and mismatch calculate live.
- Final submission sends one complete payload to Apps Script.
- Admin filters reports by date and employee.
- Admin approves, rejects, or reopens reports.
- Admin exports Daily Sales and Daily Stock as paper-style PDFs.
- Admin exports all filtered report data to Excel from the Reports page.

## Test Checklist

- Admin login works.
- Employee login works.
- Wrong PIN shows an error.
- Employee cannot access admin routes.
- Admin redirects away from employee report submission routes.
- Employee can add a sales item.
- Cash sale amount equals quantity times rate.
- Credit sale requires customer name.
- Stock expected closing equals opening plus receipt minus sales.
- Mismatch equals actual closing minus expected closing.
- Review page shows missing stock, credit customer, and mismatch warnings.
- Final confirmation modal appears before submit.
- Submission saves in mock mode or Google Sheets depending on `.env`.
- Admin dashboard updates after submission.
- Admin filters by date.
- Admin filters by employee.
- Daily Sales PDF downloads with company name, totals, and approval section.
- Daily Stock PDF downloads with company name, mismatch count, and approval section.
- Reports Excel export contains Summary, DailySales, DailyStock, CreditSales, StockMismatch, and EmployeeSummary sheets.
- Approve/reject/reopen updates report status.
- Reopened correction resubmits using the same report ID.
