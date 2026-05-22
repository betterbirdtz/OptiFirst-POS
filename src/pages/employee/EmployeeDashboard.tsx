import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, FileText, Clock, AlertTriangle, ArrowRight, LogOut, WalletCards, Boxes } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { UserSession, DailySummaryEntry, CollectionEntry } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesDraftDate, setSalesDraftDate] = useState("");
  const [closingDraftDate, setClosingDraftDate] = useState("");
  const [todayCollection, setTodayCollection] = useState<CollectionEntry | null>(null);
  
  const [user] = useState<UserSession | null>(() => getSessionUser());

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchReports = async () => {
      try {
        const response = await appsScriptClient.getEmployeeReports(user.employeeId);
        if (response.success && response.reports) {
          // Sort reports by date descending
          const sorted = response.reports.sort((a: DailySummaryEntry, b: DailySummaryEntry) => {
            return new Date(b.SubmittedAt).getTime() - new Date(a.SubmittedAt).getTime();
          });
          setReports(sorted.slice(0, 5)); // show top 5
        }
        if (user.shopId) {
          const collectionResponse = await appsScriptClient.getTodayCollection({ shopId: user.shopId, date: getLocalDateInputValue() });
          if (collectionResponse.success && collectionResponse.collection) setTodayCollection(collectionResponse.collection);
        }
      } catch (e) {
        console.error("Failed to load employee reports:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();

    // Check for local drafts
    const salesDraft = localStorage.getItem("draft_sales");
    if (salesDraft) {
      try {
        const parsed = JSON.parse(salesDraft);
        if (parsed.employeeId === user.employeeId) {
          setSalesDraftDate(parsed.date);
        }
      } catch {
        localStorage.removeItem("draft_sales");
      }
    }

    const closingDraft = localStorage.getItem("draft_closing");
    if (closingDraft) {
      try {
        const parsed = JSON.parse(closingDraft);
        if (parsed.employeeId === user.employeeId) {
          setClosingDraftDate(parsed.date);
        }
      } catch {
        localStorage.removeItem("draft_closing");
      }
    }
  }, [user, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/40";
      case "Rejected":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/40";
      case "Reopened":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/40 animate-pulse";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/40";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("session_user");
    localStorage.removeItem("draft_sales");
    localStorage.removeItem("draft_closing");
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-indigo-500 p-5 text-white shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black sm:text-2xl">Hello, {user?.name}!</h1>
            <p className="text-white/80 text-sm mt-1">Enter sales during the day, then close stock and collection after business closes.</p>
          </div>
          <button type="button" onClick={handleLogout} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white/15 px-3 text-sm font-bold text-white hover:bg-white/25" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Draft Notification Alerts */}
      {salesDraftDate && (
        <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Unsubmitted Sales Draft Found</p>
              <p className="text-xs text-orange-700/80 dark:text-orange-400/80">You have an offline sales draft saved for date: <strong>{salesDraftDate}</strong></p>
            </div>
          </div>
          <Link
            to="/employee/daily-sales"
            className="flex min-h-11 items-center justify-center space-x-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-orange-600/10 transition-colors hover:bg-orange-700"
          >
            <span>Resume Sales</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {closingDraftDate && (
        <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Unsubmitted Closing Draft Found</p>
              <p className="text-xs text-orange-700/80 dark:text-orange-400/80">You have an offline closing draft saved for date: <strong>{closingDraftDate}</strong></p>
            </div>
          </div>
          <Link
            to="/employee/closing"
            className="flex min-h-11 items-center justify-center space-x-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-orange-600/10 transition-colors hover:bg-orange-700"
          >
            <span>Resume Closing</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link 
          to="/employee/daily-sales"
          className="group relative flex min-h-36 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <PlusCircle className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1" />
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-bold">Daily Sales Entry</h3>
            <p className="text-sm text-muted-foreground mt-1">Record and submit your customer transactions during the day.</p>
          </div>
        </Link>

        <Link 
          to="/employee/closing"
          className="group relative flex min-h-36 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <Boxes className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1" />
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-bold">End-of-Day Closing</h3>
            <p className="text-sm text-muted-foreground mt-1">Complete daily stock count and collection settlement after closing.</p>
          </div>
        </Link>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-black">
            <WalletCards className="h-5 w-5 text-primary" />
            Today Collection Status
          </h2>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${getStatusColor(todayCollection?.Status || "Draft")}`}>
            {todayCollection?.Status || "Draft"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <MiniStatus label="Cash Sales" value={formatCurrency(todayCollection?.CashSales || 0)} />
          <MiniStatus label="LIPA" value={formatCurrency(todayCollection?.DepositLIPA || 0)} />
          <MiniStatus label="Variance" value={formatCurrency(todayCollection?.Variance || 0)} danger={Number(todayCollection?.Variance || 0) !== 0} />
          <MiniStatus label="Bank Deposit" value={Number(todayCollection?.BankDepositDifference || 0) === 0 ? "Matched" : "Mismatch"} danger={Number(todayCollection?.BankDepositDifference || 0) !== 0} />
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <h2 className="text-lg font-bold flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary" />
            <span>Recent Submissions</span>
          </h2>
          <Link to="/employee/my-reports" className="text-xs font-semibold text-primary hover:underline">
            View All
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 border-2 border-t-transparent border-primary rounded-full animate-spin"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm">You haven't submitted any reports yet.</p>
            <p className="text-xs mt-1">Click "Daily Sales Entry" or "End-of-Day Closing" above to start.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <div key={report.ReportID} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{formatDateForDisplay(report.Date)}</p>
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    <span>Sales: <strong>{formatCurrency(report.TotalSales)}</strong></span>
                    <span>-</span>
                    <span>Mismatches: <strong className={report.StockMismatch > 0 ? "text-destructive" : ""}>{report.StockMismatch}</strong></span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.Status)}`}>
                  {report.Status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStatus: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => (
  <div className="rounded-lg border border-border bg-secondary/35 p-3">
    <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
    <p className={`mt-1 text-sm font-black ${danger ? "text-red-700" : "text-primary"}`}>{value}</p>
  </div>
);

export default EmployeeDashboard;
