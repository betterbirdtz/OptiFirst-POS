import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, FileSpreadsheet, RefreshCw, ShoppingBag } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import DateRangeFilter from "../../components/common/DateRangeFilter";
import type { DailySalesEntry, Shop, User, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getDateRangeLabel, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename, getSalesTotals } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const DailySales: React.FC = () => {
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [sales, setSales] = useState<DailySalesEntry[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);
  const filteredSales = employeeId ? sales.filter((s) => s.EmployeeID === employeeId) : sales;
  const totals = useMemo(() => getSalesTotals(filteredSales), [filteredSales]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopsResponse, salesResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getDailySalesReport({ shopId: shopId || undefined, startDate, endDate })
      ]);
      if (shopsResponse.success && shopsResponse.shops) setShops(shopsResponse.shops);
      if (salesResponse.success && salesResponse.sales) setSales(salesResponse.sales);
      else setError(salesResponse.error || "Failed to load sales report.");
      // Load employees
      const empRes = await appsScriptClient.getEmployees();
      if (empRes.success && empRes.employees) setEmployees(empRes.employees);
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading sales report.");
    } finally {
      setLoading(false);
    }
  }, [endDate, shopId, startDate]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleExcelExport = () => {
    exportToExcel(
      sales,
      {
        Date: "Date",
        ShopName: "Shop",
        EmployeeName: "Employee",
        ProductName: "Description/Product",
        UOM: "UOM",
        Quantity: "Quantity",
        Rate: "Rate",
        SaleType: "Sale Type",
        CashSales: "Cash Sales",
        CreditSales: "Credit Sales",
        EFDNumber: "EFD Number",
        CustomerName: "Customer Name",
        TotalAmount: "Total Amount"
      },
      buildReportFilename("Daily_Sales", startDate, endDate),
      "DailySales"
    );
  };

  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Daily Sales Report",
      startDate,
      endDate,
      shopName: selectedShop?.ShopName,
      inchargeName: selectedShop?.InchargeName,
      generatedBy: user?.name,
      filename: buildReportFilename("Daily_Sales_Report", startDate, endDate),
      headers: ["Date", "Shop", "Product", "UOM", "Qty", "Rate", "Cash", "Credit", "EFD", "Customer", "Total"],
      rows: sales.map((sale) => [
        formatDateForDisplay(sale.Date),
        sale.ShopName,
        sale.ProductName,
        sale.UOM,
        sale.Quantity,
        formatCurrency(sale.Rate),
        formatCurrency(sale.CashSales),
        formatCurrency(sale.CreditSales),
        sale.EFDNumber || "-",
        sale.CustomerName || "-",
        formatCurrency(sale.TotalAmount)
      ]),
      totals: {
        cashSales: totals.cash,
        creditSales: totals.credit,
        totalAmount: totals.total
      }
    });
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <ReportHeader
        title="Daily Sales Report"
        icon={<ShoppingBag className="h-6 w-6 text-primary" />}
        onRefresh={loadSales}
        loading={loading}
        onExcel={handleExcelExport}
        onPdf={handlePdfExport}
        disabled={sales.length === 0}
      />

      <Filters shops={shops} shopId={shopId} setShopId={setShopId} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} employees={employees} employeeId={employeeId} setEmployeeId={setEmployeeId} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-black uppercase text-primary">OPTIFIRST TZ LIMITED</p>
        <h2 className="mt-1 text-lg font-black">Daily Sales Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">{selectedShop?.ShopName || "All Shops"} · {getDateRangeLabel(startDate, endDate)}</p>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading sales report...</div>
      ) : sales.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No sales entries found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          <DayGroupedSales sales={filteredSales} />

          <div className="grid gap-3 sm:grid-cols-4">
            <TotalBox label="Total Quantity" value={String(totals.quantity)} />
            <TotalBox label="Cash Sales" value={formatCurrency(totals.cash)} />
            <TotalBox label="Credit Sales" value={formatCurrency(totals.credit)} />
            <TotalBox label="Total Amount" value={formatCurrency(totals.total)} strong />
          </div>
        </div>
      )}
    </div>
  );
};

interface HeaderProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onExcel: () => void;
  onPdf: () => void;
}

const ReportHeader: React.FC<HeaderProps> = ({ title, icon, loading, disabled, onRefresh, onExcel, onPdf }) => (
  <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">{icon}{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Paper-style export matching the daily manual sales sheet.</p>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={onRefresh} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </button>
      <button type="button" onClick={onExcel} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50">
        <FileSpreadsheet className="h-4 w-4 text-green-700" />
        Excel
      </button>
      <button type="button" onClick={onPdf} disabled={disabled} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
        <FileDown className="h-4 w-4" />
        PDF
      </button>
    </div>
  </div>
);

export const Filters: React.FC<{
  shops: Shop[];
  shopId: string;
  setShopId: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  employees?: Array<{ UserID: string; Name: string }>;
  employeeId?: string;
  setEmployeeId?: (value: string) => void;
}> = ({ shops, shopId, setShopId, startDate, setStartDate, endDate, setEndDate, employees, employeeId, setEmployeeId }) => (
  <div className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-[220px_220px_1fr]">
    <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
      <option value="">All Shops</option>
      {shops.map((shop) => (
        <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>
      ))}
    </select>
    {employees && setEmployeeId && (
      <select value={employeeId || ""} onChange={(event) => setEmployeeId(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
        <option value="">All Employees</option>
        {employees.map((emp) => (
          <option key={emp.UserID} value={emp.UserID}>{emp.Name}</option>
        ))}
      </select>
    )}
    <div className={employees && setEmployeeId ? "" : "lg:col-span-2"}>
      <DateRangeFilter startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
    </div>
  </div>
);

const TotalBox: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-xs font-bold text-muted-foreground">{label}</p>
    <p className={`mt-1 text-lg ${strong ? "font-black text-primary" : "font-bold"}`}>{value}</p>
  </div>
);

interface DayGroup {
  date: string;
  shop: string;
  employee: string;
  entries: DailySalesEntry[];
  cash: number;
  credit: number;
  total: number;
  qty: number;
}

const DayGroupedSales: React.FC<{ sales: DailySalesEntry[] }> = ({ sales }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups: DayGroup[] = useMemo(() => {
    const map = new Map<string, DayGroup>();
    sales.forEach((s) => {
      const key = `${String(s.Date).split("T")[0]}_${s.ShopName}_${s.EmployeeName || s.EmployeeID}`;
      if (!map.has(key)) {
        map.set(key, { date: String(s.Date), shop: s.ShopName, employee: s.EmployeeName || s.EmployeeID, entries: [], cash: 0, credit: 0, total: 0, qty: 0 });
      }
      const g = map.get(key)!;
      g.entries.push(s);
      g.cash += Number(s.CashSales || 0);
      g.credit += Number(s.CreditSales || 0);
      g.total += Number(s.TotalAmount || 0);
      g.qty += Number(s.Quantity || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const key = `${g.date}_${g.shop}_${g.employee}`;
        const isOpen = expanded.has(key);
        return (
          <div key={key} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button type="button" onClick={() => toggle(key)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black">{formatDateForDisplay(g.date)}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-bold text-muted-foreground">{g.shop}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-muted-foreground">{g.employee}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{g.entries.length} items · {g.qty} qty</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div><p className="text-[10px] text-muted-foreground">Cash</p><p className="text-xs font-bold text-green-700">{formatCurrency(g.cash)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Credit</p><p className="text-xs font-bold text-amber-700">{formatCurrency(g.credit)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm font-black text-primary">{formatCurrency(g.total)}</p></div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground">
                    <tr>
                      <th className="p-2.5 pl-12">Product</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5 text-right">Cash</th>
                      <th className="p-2.5 text-right">Credit</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {g.entries.map((s) => (
                      <tr key={s.EntryID} className="hover:bg-secondary/20">
                        <td className="p-2.5 pl-12 font-bold">{s.ProductName}</td>
                        <td className="p-2.5 text-right">{s.Quantity} {s.UOM}</td>
                        <td className="p-2.5 text-right">{formatCurrency(s.Rate)}</td>
                        <td className={`p-2.5 font-bold ${s.SaleType === "Cash" ? "text-green-700" : "text-amber-700"}`}>{s.SaleType}</td>
                        <td className="p-2.5 text-muted-foreground">{s.CustomerName || "-"}</td>
                        <td className="p-2.5 text-right">{formatCurrency(s.CashSales)}</td>
                        <td className="p-2.5 text-right">{formatCurrency(s.CreditSales)}</td>
                        <td className="p-2.5 text-right font-black">{formatCurrency(s.TotalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DailySales;
