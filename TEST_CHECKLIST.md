# OptiFirst POS Test Checklist

Run these checks in mock mode first, then repeat after setting `VITE_APPS_SCRIPT_URL`.

## Auth And Security

- Admin login works with `+255700000000 / 1234`.
- Employee login works with `+255700000101 / 1111`.
- Employee cannot access `/admin/dashboard`; it redirects back to employee dashboard.
- Logout clears the session and returns to `/login`.

## Master Data

- Admin can create and edit a shop.
- Admin can create and edit an employee and assign a shop.
- Admin can create and edit a product.

## Employee Daily Report

- Employee selects assigned shop and date.
- Product UOM is auto-filled in sales entry.
- Quantity x rate creates the correct total amount.
- Cash sales increase cash total.
- Credit sales increase credit total.
- Credit sale without customer name is blocked.
- EFD number can be blank but is saved when entered.
- Daily stock opening comes from previous closing for same shop/product.
- Stock sales quantity is auto-filled from sales entries.
- Expected closing equals opening + receipt - sales.
- Mismatch warning appears when actual closing differs from expected.
- End-of-day closing includes stock plus collection settlement.
- Collection auto-loads cash sales, credit sales, and total sales from daily sales.
- LIPA / online amount increases actual collection.
- Variance equals cash sales - (cash collected + LIPA).
- Bank deposit difference equals cash collected - deposit in bank.
- Sales vs EFD equals total sales - EFD Z Report.
- Employee cannot submit collection without signature confirmation.
- Employee must add remarks when variance is not zero.

## Admin Reports

- Dashboard loads without infinite spinner when there is no data.
- Empty dashboard tables show empty states.
- Shop filter changes dashboard results.
- Month filter changes trend, collection, and mismatch data.
- Date filter changes today submissions.
- Pending, approved, rejected, and reopened statuses display as badges.
- Admin can approve, reject, and reopen reports.
- Daily Sales PDF export downloads.
- Daily Stock PDF export downloads.
- Monthly Collection PDF export downloads.
- Monthly Collection Excel export downloads.
- Admin Collections page filters by shop, month, date range, status, and employee search.
- Admin can view collection detail, but cannot edit employee collection values.
- Admin can add an admin note.
- Admin can approve, reject, and reopen collections.
- Dashboard shows collection warnings for variance, bank mismatch, missing EFD, and pending approvals.
- Credit Sales report shows only credit rows.
- Stock Mismatch report shows only non-zero mismatch rows.
