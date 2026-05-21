# Google Sheets & Apps Script Setup Guide

Follow these steps to set up your Google Sheets database and host the Apps Script backend for the Daily Sales and Stock Reporting system.

## Step 1: Create a Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. Name the sheet (e.g., `Daily Sales & Stock Report Database`).
3. You do not need to manually create any tabs; the setup script will do this automatically.

## Step 2: Open Google Apps Script Editor
1. In the Google Spreadsheet menu bar, click on **Extensions** -> **Apps Script**.
2. This opens the Google Apps Script project editor page.
3. Delete any default code in the editor (which usually has an empty `myFunction`).

## Step 3: Paste the Code
1. Copy all contents from [Code.gs](file:///c:/Users/varun/Downloads/Opti first Pos Software/google-apps-script/Code.gs).
2. Paste it into the editor's main file (rename the file to `Code.gs` if it is named something else).
3. Save the project (click the disk icon or press `Ctrl + S`).

## Step 4: Run Initial Sheet Setup
1. In the toolbar at the top of the editor, select `setupSheets` from the function dropdown menu.
2. Click the **Run** button (play icon).
3. An **Authorization Required** dialog will appear. Click **Review Permissions**.
4. Choose your Google account.
5. You will see an "Unverified App" warning. Click **Advanced** and then click **Go to Untitled project (unsafe)**.
6. Grant permissions to view and manage your spreadsheets and run scripts.
7. The execution log will show "Setup completed successfully!".
8. Go back to your Google Sheet to verify that the tabs (`Employees`, `Products`, `DailySales`, `DailyStock`, `DailySummary`, `CreditSales`, `OpeningStock`, `Logs`) have been created with correct headers and seeded sample data.

## Step 5: Deploy as Web App
1. At the top-right of the Apps Script page, click the **Deploy** button and select **New deployment**.
2. Click the gear icon (Select type) and choose **Web app**.
3. Fill out the configuration:
   - **Description**: `Daily Sales and Stock Report API v1`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` (This is critical to allow the frontend to access the API without Google login screens).
4. Click **Deploy**.
5. Copy the **Web App URL** provided (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).
6. Save this URL for the frontend `.env` configuration file.

## Step 6: Update Environment Variable
Create a `.env` file in the root of your React frontend project and paste the URL:
```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbYOUR_DEPLOYED_ID_HERE/exec
```

---

## Default Sample Credentials (Created in setupSheets)

Once the setup is done, you can use these accounts to log in on the mobile/desktop app:

### Admin Credentials
- **Phone Number**: `+1234567890`
- **PIN**: `1234`
- **Role**: Admin

### Employee Credentials
- **Phone Number**: `+1234567891`
- **PIN**: `5678`
- **Role**: Employee

## Notes

- Employees never edit the Google Sheet directly. They submit through the frontend, which calls the Apps Script Web App.
- `submitDailyReport` accepts the complete daily sales and stock payload in one request.
- Reopened reports are corrected by sending the original `reportId`; the script replaces old detail rows and resets the summary status to `Pending Approval`.
- The script validates active employee, active products, numeric quantities, required closing stock, and customer name for credit sales before writing rows.
