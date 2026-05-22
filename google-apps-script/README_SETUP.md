# Google Sheets + Apps Script Setup

This project uses one Google Spreadsheet as the temporary database and one Apps Script Web App as the API. Do not create one file per employee and do not create monthly tabs manually.

## 1. Create The Spreadsheet

1. Create a blank Google Spreadsheet.
2. Name it `OptiFirst POS Database` or similar.
3. Open `Extensions` -> `Apps Script`.
4. Replace the default script with `google-apps-script/Code.gs` from this repo.
5. Save the Apps Script project.

## 2. Run `setupSheets()`

In Apps Script, select `setupSheets` and click Run. Approve the requested permissions.

`setupSheets()` creates these tabs with normalized headers:

- `Users`
- `Shops`
- `Products`
- `DailyReports`
- `DailySalesEntries`
- `DailyStockEntries`
- `Collections`
- `LiveWeight`
- `Logs`

It also seeds:

- Shops: `Kisutu`, `Kigamboni`, `Utumbo`
- Admin user
- One employee per sample shop
- Chicken and egg products

## 3. Deploy The API

1. Click `Deploy` -> `New deployment`.
2. Select type: `Web app`.
3. Set `Execute as` to `Me`.
4. Set `Who has access` to `Anyone`.
5. Deploy and copy the Web App URL.

## 4. Configure The Frontend

Create `.env` in the project root:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Then run:

```bash
npm install
npm run dev
```

## Sample Logins

Admin:

- Phone: `+255700000000`
- PIN: `1234`

Employees:

- Kisutu: `+255700000101` / `1111`
- Kigamboni: `+255700000102` / `2222`
- Utumbo: `+255700000103` / `3333`

## API Notes

- `submitDailySales` writes all sales rows in one request.
- `submitDailyStock` writes all stock rows in one request during end-of-day closing.
- `submitDailyCollection` writes the employee settlement for the same shop/date and updates the existing collection row.
- Credit sales require `CustomerName`.
- Stock mismatch is calculated as `ActualClosing - (OpeningStock + Receipt - Sales)`.
- Collections are generated automatically from daily sales by shop and date.
- Collection variance is calculated as `CashSales - (DepositCash + DepositLIPA)`.
- Bank deposit difference is calculated as `DepositCash - DepositInBank`.
- Sales vs EFD is calculated as `TotalSales - EFDZReport`.
- Admin can approve, reject, reopen, and add notes to collection rows.
- Employees correct collection values from the End-of-Day Closing screen after admin reopens a settlement.
- Employees can submit only for their assigned shop.
