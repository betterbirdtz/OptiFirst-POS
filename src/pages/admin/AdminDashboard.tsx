import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Check,
  CreditCard,
  FileCheck,
  RefreshCw,
  ShoppingBag,
  Wallet,
  X
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DashboardData, ReportStatus, Shop, UserSession } from "../../types";
import { formatCurrency, formatNumber } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue, getMonthInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

const emptyDashboard: DashboardData = {
  stats: {
    totalSales: 0,
    cashSales: 0,
    creditSales: 0,
    depositCash: 0,
    depositLIPA: 0,
    variance: 0,
    efdDifference: 0,
    bankDepositDifference: 0,
    todayCashSales: 0,
    todayLIPA: 0,
    todayBankDeposit: 0,
    todayVariance: 0,
    pendingCollectionApprovals: 0,
    collectionsWithVariance: 0,
    collectionsMissingEFD: 0,
    bankDepositMismatches: 0,
    stockMismatch: 0,
    reportsSubmitted: 0,
    pendingApprovals: 0
  },
  cashCreditSplit: [],
  dailySalesTrend: [],
  shopSalesComparison: [],
  topSellingProducts: [],
  mismatchByProduct: [],
  todaySubmissions: [],
  collectionSummary: [],
  stockMismatchRows: []
};

function statusClass(status: ReportStatus | string) {
  if (status === "Approved") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "Reopened") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [date, setDate] = useState(getLocalDateInputValue());
  const [month, setMonth] = useState(getMonthInputValue());
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedShop = useMemo(() => shops.find((shop) => shop.ShopID === shopId), [shopId, shops]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopResponse, dashboardResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getDashboard({ shopId: shopId || undefined, date, month })
      ]);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (dashboardResponse.success && dashboardResponse.dashboard) {
        setDashboard(dashboardResponse.dashboard);
      } else {
        setDashboard(emptyDashboard);
        setError(dashboardResponse.error || "Dashboard data could not be loaded.");
      }
    } catch (loadError) {
      console.error(loadError);
      setDashboard(emptyDashboard);
      setError("Dashboard request failed. Check the Apps Script deployment and retry.");
    } finally {
      setLoading(false);
    }
  }, [date, month, shopId]);

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadDashboard();
  }, [loadDashboard, navigate, user]);

  const updateStatus = async (reportId: string, action: "approve" | "reject") => {
    if (!user) return;
    const response = action === "approve"
      ? await appsScriptClient.approveReport(reportId, user.userId)
      : await appsScriptClient.rejectReport(reportId, user.userId);
    if (response.success) loadDashboard();
    else setError(response.error || "Report status update failed.");
  };

  const cards = [
    { label: "Total Sales", value: formatCurrency(dashboard.stats.totalSales), icon: ShoppingBag, tone: "text-slate-900" },
    { label: "Cash Sales", value: formatCurrency(dashboard.stats.cashSales), icon: Banknote, tone: "text-green-700" },
    { label: "Credit Sales", value: formatCurrency(dashboard.stats.creditSales), icon: CreditCard, tone: "text-amber-700" },
    { label: "Today Cash Sales", value: formatCurrency(dashboard.stats.todayCashSales), icon: Wallet, tone: "text-green-700" },
    { label: "Today LIPA / Online", value: formatCurrency(dashboard.stats.todayLIPA), icon: Wallet, tone: "text-cyan-700" },
    { label: "Today Bank Deposit", value: formatCurrency(dashboard.stats.todayBankDeposit), icon: FileCheck, tone: "text-slate-900" },
    { label: "Today Variance", value: formatCurrency(dashboard.stats.todayVariance), icon: AlertTriangle, tone: dashboard.stats.todayVariance === 0 ? "text-green-700" : "text-red-700" },
    { label: "Pending Collections", value: formatNumber(dashboard.stats.pendingCollectionApprovals), icon: AlertTriangle, tone: dashboard.stats.pendingCollectionApprovals === 0 ? "text-green-700" : "text-amber-700" },
    { label: "EFD Difference", value: formatCurrency(dashboard.stats.efdDifference), icon: FileCheck, tone: dashboard.stats.efdDifference === 0 ? "text-green-700" : "text-red-700" },
    { label: "Stock Mismatch", value: formatNumber(dashboard.stats.stockMismatch), icon: AlertCircle, tone: dashboard.stats.stockMismatch === 0 ? "text-green-700" : "text-red-700" },
    { label: "Reports Submitted", value: formatNumber(dashboard.stats.reportsSubmitted), icon: FileCheck, tone: "text-slate-900" },
    { label: "Pending Approvals", value: formatNumber(dashboard.stats.pendingApprovals), icon: AlertTriangle, tone: dashboard.stats.pendingApprovals === 0 ? "text-green-700" : "text-amber-700" }
  ];

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedShop ? selectedShop.ShopName : "All shops"} · {month} · {formatDateForDisplay(date)}
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border border-border bg-card p-2 shadow-sm sm:grid-cols-[220px_160px_160px_auto]">
          <select
            value={shopId}
            onChange={(event) => setShopId(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            aria-label="Shop filter"
          >
            <option value="">All Shops</option>
            {shops.map((shop) => (
              <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            aria-label="Dashboard date"
          />
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            aria-label="Dashboard month"
          />
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={loadDashboard} className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-bold">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`mt-3 min-h-7 truncate text-xl font-black ${card.tone}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <WarningTile label="Collections with variance" value={dashboard.stats.collectionsWithVariance} />
        <WarningTile label="Cash vs bank mismatch" value={dashboard.stats.bankDepositMismatches} />
        <WarningTile label="Missing EFD Z Report" value={dashboard.stats.collectionsMissingEFD} />
        <WarningTile label="Pending approval" value={dashboard.stats.pendingCollectionApprovals} />
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm font-semibold text-muted-foreground">
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <ChartPanel title="Cash vs Credit" empty={dashboard.cashCreditSplit.length === 0} className="xl:col-span-1">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dashboard.cashCreditSplit} dataKey="value" innerRadius={48} outerRadius={74} paddingAngle={2}>
                    {dashboard.cashCreditSplit.map((_, index) => (
                      <Cell key={index} fill={index === 0 ? "#16a34a" : "#f59e0b"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Daily Sales Trend" empty={dashboard.dailySalesTrend.length === 0} className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dashboard.dailySalesTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Shop-wise Sales" empty={dashboard.shopSalesComparison.length === 0} className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.shopSalesComparison}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#0891b2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Top Selling Products" empty={dashboard.topSellingProducts.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.topSellingProducts} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="Stock Mismatch By Product" empty={dashboard.mismatchByProduct.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.mismatchByProduct} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          <section className="rounded-lg border border-border bg-card shadow-sm">
            <TableHeader title="Today Submissions" />
            {dashboard.todaySubmissions.length === 0 ? (
              <EmptyState text="No daily reports have been submitted for the selected date." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-3">Shop</th>
                      <th className="p-3">Employee</th>
                      <th className="p-3 text-right">Sales Total</th>
                      <th className="p-3">Stock Status</th>
                      <th className="p-3">Collection Status</th>
                      <th className="p-3">Approval Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dashboard.todaySubmissions.map((row) => (
                      <tr key={row.ReportID} className="hover:bg-secondary/30">
                        <td className="p-3 font-bold">{row.Shop}</td>
                        <td className="p-3">{row.Employee}</td>
                        <td className="p-3 text-right font-black">{formatCurrency(row.SalesTotal)}</td>
                        <td className="p-3">{row.StockStatus}</td>
                        <td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.CollectionStatus)}`}>{row.CollectionStatus}</span></td>
                        <td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.ApprovalStatus)}`}>{row.ApprovalStatus}</span></td>
                        <td className="p-3 text-right">
                          {row.ApprovalStatus === "Submitted" || row.ApprovalStatus === "Pending Approval" ? (
                            <div className="inline-flex gap-1">
                              <button type="button" onClick={() => updateStatus(row.ReportID, "approve")} className="rounded-md bg-green-600 p-1.5 text-white" aria-label="Approve report">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => updateStatus(row.ReportID, "reject")} className="rounded-md bg-red-600 p-1.5 text-white" aria-label="Reject report">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => navigate("/admin/reports")} className="rounded-md border border-border px-2 py-1 font-bold">
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card shadow-sm">
            <TableHeader title="Collection Summary" />
            {dashboard.collectionSummary.length === 0 ? (
              <EmptyState text="No collection rows exist for the selected month yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Day</th>
                      <th className="p-3 text-right">Cash Sales</th>
                      <th className="p-3 text-right">Credit Sales</th>
                      <th className="p-3 text-right">Total Sales</th>
                      <th className="p-3 text-right">Deposit Cash</th>
                      <th className="p-3 text-right">Deposit LIPA</th>
                      <th className="p-3 text-right">Variance</th>
                      <th className="p-3 text-right">EFD Z Report</th>
                      <th className="p-3 text-right">Sales vs EFD</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dashboard.collectionSummary.map((row) => (
                      <tr key={row.CollectionID} className="hover:bg-secondary/30">
                        <td className="p-3 font-bold">{formatDateForDisplay(row.Date)}</td>
                        <td className="p-3">{row.Day}</td>
                        <td className="p-3 text-right">{formatCurrency(row.CashSales)}</td>
                        <td className="p-3 text-right">{formatCurrency(row.CreditSales)}</td>
                        <td className="p-3 text-right font-black">{formatCurrency(row.TotalSales)}</td>
                        <td className="p-3 text-right">{formatCurrency(row.DepositCash)}</td>
                        <td className="p-3 text-right">{formatCurrency(row.DepositLIPA)}</td>
                        <td className={`p-3 text-right font-black ${row.Variance === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(row.Variance)}</td>
                        <td className="p-3 text-right">{formatCurrency(row.EFDZReport)}</td>
                        <td className={`p-3 text-right font-black ${row.SalesVsEFD === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(row.SalesVsEFD)}</td>
                        <td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.Status)}`}>{row.Status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card shadow-sm">
            <TableHeader title="Stock Mismatch Table" />
            {dashboard.stockMismatchRows.length === 0 ? (
              <EmptyState text="No stock mismatches found for the selected month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Shop</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Opening</th>
                      <th className="p-3 text-right">Receipt</th>
                      <th className="p-3 text-right">Sales</th>
                      <th className="p-3 text-right">Expected Closing</th>
                      <th className="p-3 text-right">Actual Closing</th>
                      <th className="p-3 text-right">Mismatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dashboard.stockMismatchRows.map((row) => (
                      <tr key={row.EntryID} className="hover:bg-secondary/30">
                        <td className="p-3 font-bold">{formatDateForDisplay(row.Date)}</td>
                        <td className="p-3">{row.ShopName}</td>
                        <td className="p-3 font-bold">{row.ProductName}</td>
                        <td className="p-3 text-right">{row.OpeningStock}</td>
                        <td className="p-3 text-right">{row.Receipt}</td>
                        <td className="p-3 text-right">{row.Sales}</td>
                        <td className="p-3 text-right">{row.ExpectedClosing}</td>
                        <td className="p-3 text-right">{row.ActualClosing}</td>
                        <td className="p-3 text-right font-black text-red-700">{row.Mismatch > 0 ? "+" : ""}{row.Mismatch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const ChartPanel: React.FC<{ title: string; empty: boolean; className?: string; children: React.ReactNode }> = ({ title, empty, className = "", children }) => (
  <section className={`rounded-lg border border-border bg-card p-4 shadow-sm ${className}`}>
    <h2 className="text-sm font-black">{title}</h2>
    <div className="mt-3">
      {empty ? <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">No data for this filter.</div> : children}
    </div>
  </section>
);

const TableHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-b border-border p-4">
    <h2 className="text-sm font-black">{title}</h2>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>
);

const WarningTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className={`rounded-lg border p-3 ${value > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800"}`}>
    <p className="text-[11px] font-bold uppercase">{label}</p>
    <p className="mt-1 text-xl font-black">{formatNumber(value)}</p>
  </div>
);

export default AdminDashboard;
