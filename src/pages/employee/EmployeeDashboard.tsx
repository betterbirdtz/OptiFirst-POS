import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, FileText, ClipboardList, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { UserSession, DailySummaryEntry } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailySummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  
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
      } catch (e) {
        console.error("Failed to load employee reports:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();

    // Check for local draft
    const draft = localStorage.getItem("draft_report");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.employeeId === user.employeeId) {
          setHasDraft(true);
          setDraftDate(parsed.date);
        }
      } catch {
        localStorage.removeItem("draft_report");
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

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-indigo-500 p-5 text-white shadow-lg sm:p-6">
        <h1 className="text-xl font-black sm:text-2xl">Hello, {user?.name}!</h1>
        <p className="text-white/80 text-sm mt-1">Submit your sales and stock audits, save drafts, and view logs.</p>
      </div>

      {/* Draft Notification Alert */}
      {hasDraft && (
        <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Unsubmitted Draft Found</p>
              <p className="text-xs text-orange-700/80 dark:text-orange-400/80">You have an offline draft saved for date: <strong>{draftDate}</strong></p>
            </div>
          </div>
          <Link
            to="/employee/today-report"
            className="flex min-h-11 items-center justify-center space-x-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-orange-600/10 transition-colors hover:bg-orange-700"
          >
            <span>Resume</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link 
          to="/employee/today-report"
          className="group relative flex min-h-36 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <PlusCircle className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1" />
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-bold">New Daily Report</h3>
            <p className="text-sm text-muted-foreground mt-1">Submit your sales figures and stock counts for today.</p>
          </div>
        </Link>

        <Link 
          to="/employee/my-reports"
          className="group relative flex min-h-36 flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <ClipboardList className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1" />
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-bold">My Submitted Reports</h3>
            <p className="text-sm text-muted-foreground mt-1">View the history and approval status of your submissions.</p>
          </div>
        </Link>
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
            <p className="text-xs mt-1">Click "New Daily Report" above to start.</p>
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
export default EmployeeDashboard;
