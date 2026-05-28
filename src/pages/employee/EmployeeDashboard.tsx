import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, FileText, ClipboardList, AlertTriangle, ArrowRight, LogOut, WalletCards, Boxes, Pencil } from "lucide-react";
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
  const [todayReport, setTodayReport] = useState<DailySummaryEntry | null>(null);
  const [todayMtnCount, setTodayMtnCount] = useState(0);
  const [user] = useState<UserSession | null>(() => getSessionUser());

  useEffect(() => {
    if (!user) { navigate("/login"); return; }

    const fetchData = async () => {
      try {
        const response = await appsScriptClient.getEmployeeReports(user.employeeId);
        if (response.success && response.reports) {
          const sorted = response.reports.sort((a: DailySummaryEntry, b: DailySummaryEntry) => new Date(b.SubmittedAt).getTime() - new Date(a.SubmittedAt).getTime());
          setReports(sorted.slice(0, 5));
          const today = getLocalDateInputValue();
          const todayRep = sorted.find((r) => r.Date === today || r.Date.startsWith(today));
          if (todayRep) setTodayReport(todayRep);
        }
        if (user.shopId) {
          const collRes = await appsScriptClient.getTodayCollection({ shopId: user.shopId, date: getLocalDateInputValue() });
          if (collRes.success && collRes.collection) setTodayCollection(collRes.collection);
          const mtnRes = await appsScriptClient.getMTNsForShop(user.shopId);
          if (mtnRes.success && mtnRes.mtns) {
            const pendingMtnNos = new Set(
              mtnRes.mtns
                .filter((mtn) => String(mtn.Status || "Sent").toLowerCase() !== "received")
                .map((mtn) => mtn.MTNNo)
            );
            setTodayMtnCount(pendingMtnNos.size);
          }
        }
      } catch { /* */ }
      finally { setLoading(false); }
    };
    fetchData();

    try { const d = localStorage.getItem("draft_sales"); if (d) { const p = JSON.parse(d); if (p.employeeId === user.employeeId) setSalesDraftDate(p.date); } } catch { localStorage.removeItem("draft_sales"); }
    try { const d = localStorage.getItem("draft_closing"); if (d) { const p = JSON.parse(d); if (p.employeeId === user.employeeId) setClosingDraftDate(p.date); } } catch { localStorage.removeItem("draft_closing"); }
  }, [user, navigate]);

  const statusColor = (s: string) => {
    if (s === "Approved") return "bg-green-100 text-green-800 border-green-200";
    if (s === "Rejected") return "bg-red-100 text-red-800 border-red-200";
    if (s === "Reopened") return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-28">
      {/* Header - compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black">Hi, {user?.name?.split(" ")[0]}!</h1>
          <p className="text-xs text-muted-foreground">{user?.shopName || "OptiFirst POS"}</p>
        </div>
        <button type="button" onClick={() => { localStorage.removeItem("session_user"); navigate("/login", { replace: true }); }} className="rounded-lg border border-border p-2.5 text-muted-foreground hover:bg-secondary active:bg-secondary/80">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Draft alerts - compact */}
      {salesDraftDate && (
        <Link to="/employee/daily-sales" className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 active:bg-orange-100">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-800">Sales draft ({salesDraftDate})</p>
          </div>
          <ArrowRight className="h-4 w-4 text-orange-600" />
        </Link>
      )}
      {closingDraftDate && (
        <Link to="/employee/closing" className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 active:bg-orange-100">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-orange-800">Closing draft ({closingDraftDate})</p>
          </div>
          <ArrowRight className="h-4 w-4 text-orange-600" />
        </Link>
      )}

      {/* Quick Actions - 2x2 grid, large touch targets */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard to="/employee/daily-sales" icon={<PlusCircle className="h-8 w-8" />} label="Daily Sales" sub="Add sales" />
        <ActionCard to="/employee/closing" icon={<Boxes className="h-8 w-8" />} label="Stock Closing" sub="End of day" />
        <ActionCard to="/employee/collection" icon={<WalletCards className="h-8 w-8" />} label="Collection" sub="Deposits & bank" />
        <ActionCard to="/employee/mtn" icon={<ClipboardList className="h-8 w-8" />} label="MTN Receipt" sub="Stock from HO" />
      </div>

      {/* Today's Status - compact cards */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Today's Status</p>
        <div className="grid grid-cols-2 gap-2">
          <StatusItem label="Sales" value={todayReport ? formatCurrency(todayReport.TotalSales) : "-"} done={!!todayReport} editTo="/employee/daily-sales" />
          <StatusItem label="Stock" value={todayReport?.StockSubmitted === "Yes" ? `${todayReport.StockMismatch} mismatch` : "-"} done={todayReport?.StockSubmitted === "Yes"} editTo="/employee/closing" />
          <StatusItem label="Collection" value={todayCollection && todayCollection.Status !== "Draft" ? formatCurrency(todayCollection.Variance) : "-"} done={todayCollection?.Status === "Submitted" || todayCollection?.Status === "Approved"} editTo="/employee/collection" danger={todayCollection ? todayCollection.Variance !== 0 : false} />
          <StatusItem label="MTN" value={todayMtnCount > 0 ? `${todayMtnCount} pending` : "-"} done={todayMtnCount > 0} editTo="/employee/mtn" />
        </div>
      </div>

      {/* Quick links */}
      <Link to="/employee/my-reports" className="flex items-center justify-between rounded-xl border border-border bg-card p-4 active:bg-secondary">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg"><ClipboardList className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-bold">My Reports & Data</h3>
            <p className="text-xs text-muted-foreground">View all submissions, details & download Excel</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Recent - compact list */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Recent</p>
          <Link to="/employee/my-reports" className="text-[10px] font-bold text-primary">View All</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-4"><div className="h-5 w-5 border-2 border-t-transparent border-primary rounded-full animate-spin"></div></div>
        ) : reports.length === 0 ? (
          <div className="py-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No reports yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {reports.map((r) => (
              <Link key={r.ReportID} to="/employee/my-reports" className="flex items-center justify-between rounded-lg bg-secondary/30 p-2.5 active:bg-secondary">
                <div>
                  <p className="text-xs font-bold">{formatDateForDisplay(r.Date)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(r.TotalSales)} · {r.StockMismatch} mismatch</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusColor(r.Status)}`}>{r.Status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ActionCard: React.FC<{ to: string; icon: React.ReactNode; label: string; sub: string }> = ({ to, icon, label, sub }) => (
  <Link to={to} className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm active:bg-secondary active:scale-[0.97] transition-transform min-h-[140px]">
    <div className="p-4 bg-primary/10 text-primary rounded-2xl">{icon}</div>
    <div className="text-center">
      <p className="text-base font-black">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  </Link>
);

const StatusItem: React.FC<{ label: string; value: string; done?: boolean; editTo: string; danger?: boolean }> = ({ label, value, done, editTo, danger }) => (
  <div className="rounded-lg border border-border bg-secondary/20 p-2.5 flex items-center justify-between gap-1">
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className={`text-xs font-black truncate ${danger ? "text-red-700" : done ? "text-green-700" : "text-muted-foreground"}`}>{value}</p>
    </div>
    {done && (
      <Link to={editTo} className="rounded p-1.5 bg-primary/10 text-primary active:bg-primary/20 flex-shrink-0">
        <Pencil className="h-3 w-3" />
      </Link>
    )}
  </div>
);

export default EmployeeDashboard;
