import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { CreditSalesEntry, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";
import { Filters } from "./DailySales";

export const CreditSales: React.FC = () => {
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [status, setStatus] = useState("");
  const [credits, setCredits] = useState<CreditSalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);
  const filteredCredits = useMemo(() => credits.filter((row) => !status || row.Status === status), [credits, status]);
  const totalCredit = filteredCredits.reduce((sum, row) => sum + Number(row.Amount || 0), 0);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopResponse, creditResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getCreditSalesReport({ shopId: shopId || undefined, startDate, endDate })
      ]);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (creditResponse.success && creditResponse.creditSales) setCredits(creditResponse.creditSales);
      else setError(creditResponse.error || "Failed to load credit sales.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading credit sales.");
    } finally {
      setLoading(false);
    }
  }, [endDate, shopId, startDate]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const handleExcelExport = () => {
    exportToExcel(
      filteredCredits,
      {
        Date: "Date",
        ShopName: "Shop",
        EmployeeName: "Employee",
        CustomerName: "Customer Name",
        ProductName: "Product",
        Amount: "Credit Amount",
        EFDNumber: "EFD Number",
        Status: "Status"
      },
      buildReportFilename("Credit_Sales", startDate, endDate),
      "CreditSales"
    );
  };

  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Credit Sales Report",
      startDate,
      endDate,
      shopName: selectedShop?.ShopName,
      inchargeName: selectedShop?.InchargeName,
      generatedBy: user?.name,
      filename: buildReportFilename("Credit_Sales_Report", startDate, endDate),
      headers: ["Date", "Shop", "Employee", "Customer", "Product", "EFD", "Status", "Amount"],
      rows: filteredCredits.map((row) => [
        formatDateForDisplay(row.Date),
        row.ShopName,
        row.EmployeeName || row.EmployeeID,
        row.CustomerName,
        row.ProductName,
        row.EFDNumber || "-",
        row.Status,
        formatCurrency(row.Amount)
      ]),
      totals: { creditTotal: totalCredit }
    });
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <CircleDollarSign className="h-6 w-6 text-primary" />
            Credit Sales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">All customer credit lines with report approval status.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadCredits} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={handleExcelExport} disabled={filteredCredits.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50">
            <FileSpreadsheet className="h-4 w-4 text-green-700" />
            Excel
          </button>
          <button type="button" onClick={handlePdfExport} disabled={filteredCredits.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <Filters shops={shops} shopId={shopId} setShopId={setShopId} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
        <option value="">All Statuses</option>
        <option value="Submitted">Submitted</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
        <option value="Reopened">Reopened</option>
      </select>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading credit sales...</div>
      ) : filteredCredits.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No credit sales found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            Credit rows: {filteredCredits.length} · Total credit: {formatCurrency(totalCredit)}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">EFD</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCredits.map((row) => (
                    <tr key={row.EntryID} className="hover:bg-secondary/30">
                      <td className="p-3 font-bold">{formatDateForDisplay(row.Date)}</td>
                      <td className="p-3">{row.ShopName}</td>
                      <td className="p-3">{row.EmployeeName || row.EmployeeID}</td>
                      <td className="p-3 font-bold">{row.CustomerName}</td>
                      <td className="p-3">{row.ProductName}</td>
                      <td className="p-3 font-mono text-muted-foreground">{row.EFDNumber || "-"}</td>
                      <td className="p-3">{row.Status}</td>
                      <td className="p-3 text-right font-black text-amber-700">{formatCurrency(row.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditSales;
