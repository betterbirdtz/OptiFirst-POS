import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  FileText, 
  AlertTriangle, 
  Award, 
  Calendar, 
  Check, 
  X, 
  RefreshCw,
  Eye
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DashboardStats, DailySummaryEntry, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(getLocalDateInputValue());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user] = useState<UserSession | null>(() => getSessionUser());

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getAdminDashboard(date);
      if (response.success) {
        setStats(response.stats as DashboardStats);
        setReports(response.recentSummaries || []);
      } else {
        setError("Failed to load dashboard statistics.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading dashboard.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadDashboard();
  }, [user, navigate, loadDashboard]);

  const handleUpdateStatus = async (reportId: string, action: "approve" | "reject" | "reopen") => {
    if (!user) return;
    try {
      let res;
      if (action === "approve") {
        res = await appsScriptClient.approveReport(reportId, user.employeeId);
      } else if (action === "reject") {
        res = await appsScriptClient.rejectReport(reportId, user.employeeId);
      } else {
        res = await appsScriptClient.reopenReport(reportId, user.employeeId);
      }

      if (res.success) {
        // Refresh dashboard
        loadDashboard();
      } else {
        alert("Action failed: " + (res.error || "Unknown error"));
      }
    } catch {
      alert("Error updating report status");
    }
  };

  // Recharts Pie Chart Data
  const chartData = [
    { name: "Cash Sales", value: stats?.todayCashSales || 0 },
    { name: "Credit Sales", value: stats?.todayCreditSales || 0 }
  ].filter(item => item.value > 0);

  const COLORS = ["#10B981", "#F59E0B"]; // Green for Cash, Amber for Credit

  const kpis = [
    {
      label: "Total Sales",
      value: formatCurrency(stats?.todayTotalSales || 0),
      icon: TrendingUp,
      iconClassName: "text-primary",
      valueClassName: "text-foreground"
    },
    {
      label: "Cash Sales",
      value: formatCurrency(stats?.todayCashSales || 0),
      icon: DollarSign,
      iconClassName: "text-green-600",
      valueClassName: "text-green-700"
    },
    {
      label: "Credit Sales",
      value: formatCurrency(stats?.todayCreditSales || 0),
      icon: CreditCard,
      iconClassName: "text-amber-600",
      valueClassName: "text-amber-700"
    },
    {
      label: "Submitted Reports",
      value: String(stats?.submittedReportsCount || 0),
      icon: FileText,
      iconClassName: "text-blue-600",
      valueClassName: "text-foreground"
    },
    {
      label: "Stock Mismatch",
      value: `${stats?.stockMismatchCount || 0} items`,
      icon: AlertTriangle,
      iconClassName: (stats?.stockMismatchCount || 0) > 0 ? "text-destructive" : "text-green-600",
      valueClassName: (stats?.stockMismatchCount || 0) > 0 ? "text-destructive" : "text-foreground"
    },
    {
      label: "Top Selling Product",
      value: stats?.topSellingProduct || "N/A",
      icon: Award,
      iconClassName: "text-yellow-600",
      valueClassName: "text-foreground"
    }
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      {/* Welcome & Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor daily sales, submissions, and stock exceptions.</p>
        </div>

        <div className="flex w-full items-center space-x-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:w-auto sm:p-2.5">
          <Calendar className="h-4 w-4 text-primary" />
          <input 
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 cursor-pointer border-none bg-transparent text-sm font-bold text-foreground focus:outline-none"
            aria-label="Dashboard date"
          />
          <button 
            onClick={loadDashboard}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary sm:p-1"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${item.label === "Top Selling Product" ? "col-span-2 xl:col-span-1" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">{item.label}</span>
                <Icon className={`h-4 w-4 ${item.iconClassName}`} />
              </div>
              <p className={`mt-4 truncate text-xl font-black tracking-tight sm:mt-5 sm:text-2xl ${item.valueClassName}`}>{item.value}</p>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex min-h-[300px] flex-col justify-between">
          <h3 className="text-base font-black text-foreground mb-4">Payment Split</h3>
          
          {chartData.length === 0 ? (
            <div className="flex flex-grow items-center justify-center rounded-xl border border-dashed border-border bg-secondary/35 text-muted-foreground text-sm">
              No sales logged on this date
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => formatCurrency(Number(value || 0))} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Action summaries list */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 min-h-[300px]">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-base font-black text-foreground">Submissions Summary ({reports.length})</h3>
            <button 
              onClick={() => navigate("/admin/reports")} 
              className="text-xs text-primary font-semibold hover:underline"
            >
              Approval Queue
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12" aria-label="Loading submissions">
              <div className="h-6 w-6 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No daily reports submitted for this date.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 font-semibold">Employee</th>
                    <th className="py-2.5 font-semibold">Sales Total</th>
                    <th className="py-2.5 font-semibold">Mismatch</th>
                    <th className="py-2.5 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {reports.map((report) => (
                    <tr key={report.ReportID} className="group hover:bg-secondary/40">
                      <td className="py-3 font-semibold">{report.EmployeeName}</td>
                      <td className="py-3 font-bold">{formatCurrency(report.TotalSales)}</td>
                      <td className="py-3 font-semibold">
                        <span className={report.StockMismatch > 0 ? "text-destructive" : "text-green-600"}>
                          {report.StockMismatch} products
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          report.Status === "Approved" ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400" :
                          report.Status === "Rejected" ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400" :
                          report.Status === "Reopened" ? "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400" :
                          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                        }`}>
                          {report.Status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => navigate("/admin/reports", { state: { highlightReportId: report.ReportID } })}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {report.Status === "Pending Approval" && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(report.ReportID, "approve")}
                                className="p-1 rounded bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white transition-all"
                                title="Approve"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(report.ReportID, "reject")}
                                className="p-1 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all"
                                title="Reject"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminDashboard;
