import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Landmark,
  ReceiptText,
  Send,
  ShoppingBag,
  WalletCards
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Shop, UserSession } from "../../types";
import {
  calculateActualCollection,
  calculateBankDepositDifference,
  calculateCollectionVariance,
  calculateSalesAmount,
  calculateSalesVsEfd,
  formatCurrency
} from "../../utils/calculations";
import { getDayName, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface CollectionFormState {
  depositCash: number;
  depositLIPA: number;
  depositInBank: number;
  dateOfDeposit: string;
  efdZReport: number;
  name: string;
  signatureConfirmed: boolean;
  remarks: string;
}

export const CollectionEntry: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [shopId, setShopId] = useState("");
  const [date, setDate] = useState(getLocalDateInputValue());
  const [shops, setShops] = useState<Shop[]>([]);
  const [reportId, setReportId] = useState<string | undefined>();
  const [cashSales, setCashSales] = useState(0);
  const [creditSales, setCreditSales] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [collection, setCollection] = useState<CollectionFormState>({
    depositCash: 0,
    depositLIPA: 0,
    depositInBank: 0,
    dateOfDeposit: "",
    efdZReport: 0,
    name: user?.name || "",
    signatureConfirmed: false,
    remarks: ""
  });

  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [salesLoaded, setSalesLoaded] = useState(false);

  const activeShops = shops.filter((s) => s.Status === "Active");
  const allowedShops = user?.shopId ? activeShops.filter((s) => s.ShopID === user.shopId) : activeShops;
  const selectedShop = shops.find((s) => s.ShopID === shopId);

  const actualCollection = calculateActualCollection(collection.depositCash, collection.depositLIPA);
  const variance = calculateCollectionVariance(cashSales, collection.depositCash, collection.depositLIPA);
  const bankDiff = calculateBankDepositDifference(collection.depositCash, collection.depositInBank);
  const salesVsEfd = calculateSalesVsEfd(totalSales, collection.efdZReport);
  const allMatched = variance === 0 && bankDiff === 0 && salesVsEfd === 0 && collection.efdZReport > 0 && collection.signatureConfirmed && (collection.depositInBank === 0 || Boolean(collection.dateOfDeposit));

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (variance !== 0) w.push(`Variance: ${formatCurrency(variance)}`);
    if (bankDiff !== 0) w.push(`Bank deposit difference: ${formatCurrency(bankDiff)}`);
    if (!collection.efdZReport) w.push("EFD Z Report is missing.");
    else if (salesVsEfd !== 0) w.push(`Sales vs EFD: ${formatCurrency(salesVsEfd)}`);
    if (collection.depositInBank > 0 && !collection.dateOfDeposit) w.push("Date of deposit required.");
    if (!collection.signatureConfirmed) w.push("Signature confirmation required.");
    if (variance !== 0 && !collection.remarks.trim()) w.push("Remarks required for variance.");
    return w;
  }, [bankDiff, collection.dateOfDeposit, collection.depositInBank, collection.efdZReport, collection.remarks, collection.signatureConfirmed, salesVsEfd, variance]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }
    const load = async () => {
      setLoading(true);
      try {
        const res = await appsScriptClient.getShops();
        if (res.success && res.shops) {
          setShops(res.shops);
          setShopId(user.shopId || res.shops.find((s) => s.Status === "Active")?.ShopID || "");
        }
      } catch { setError("Failed to load shops."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  const loadSalesData = async () => {
    if (!shopId || !date) return;
    setLoadingSales(true); setError(""); setSalesLoaded(false);
    try {
      const [salesRes, collRes, reportRes] = await Promise.all([
        appsScriptClient.getDailySalesReport({ shopId, startDate: date, endDate: date }),
        appsScriptClient.getTodayCollection({ shopId, date, reportId: undefined }),
        appsScriptClient.getTodayReport(user!.employeeId, shopId, date)
      ]);

      if (reportRes.report?.ReportID) setReportId(reportRes.report.ReportID);

      const sales = salesRes.sales || [];
      const cash = sales.filter((s: any) => s.SaleType === "Cash").reduce((sum: number, s: any) => sum + calculateSalesAmount(Number(s.Quantity), Number(s.Rate)), 0);
      const credit = sales.filter((s: any) => s.SaleType === "Credit").reduce((sum: number, s: any) => sum + calculateSalesAmount(Number(s.Quantity), Number(s.Rate)), 0);
      setCashSales(cash);
      setCreditSales(credit);
      setTotalSales(cash + credit);

      const coll = collRes.collection;
      if (coll) {
        setCollection({
          depositCash: Number(coll.DepositCash || 0),
          depositLIPA: Number(coll.DepositLIPA || 0),
          depositInBank: Number(coll.DepositInBank || 0),
          dateOfDeposit: coll.DateOfDeposit || "",
          efdZReport: Number(coll.EFDZReport || 0),
          name: coll.Name || user?.name || "",
          signatureConfirmed: coll.Signature === "Confirmed",
          remarks: coll.Remarks || ""
        });
      }
      setSalesLoaded(true);
    } catch { setError("Failed to load sales data."); }
    finally { setLoadingSales(false); }
  };

  const submitCollection = async () => {
    if (!user || !selectedShop) return;
    if (!collection.signatureConfirmed) { setError("Please confirm the collection details."); return; }
    if (variance !== 0 && !collection.remarks.trim()) { setError("Remarks required when there is a variance."); return; }

    setSubmitting(true); setError("");
    try {
      const res = await appsScriptClient.submitDailyCollection({
        reportId,
        shopId: selectedShop.ShopID,
        shopName: selectedShop.ShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        date,
        depositCash: collection.depositCash,
        depositLIPA: collection.depositLIPA,
        depositInBank: collection.depositInBank,
        dateOfDeposit: collection.dateOfDeposit,
        efdZReport: collection.efdZReport,
        name: collection.name || user.name,
        signature: collection.signatureConfirmed ? "Confirmed" : "",
        remarks: collection.remarks
      });
      if (res.success) { setSuccess(true); }
      else { setError(res.error || "Submission failed."); }
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-sm space-y-6 px-4 py-16 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-10 w-10" /></div>
        <h2 className="text-2xl font-black">Collection Submitted</h2>
        <p className="text-sm text-muted-foreground">Collection settlement saved for admin verification.</p>
        <button onClick={() => navigate("/employee/dashboard")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-3xl sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">Collection Entry</h1>
          <p className="text-xs text-muted-foreground">Submit deposits and bank details (can be done next day)</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span>{error}</span></div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : !salesLoaded ? (
        /* Shop & Date selection */
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary"><Building2 className="h-5 w-5" /><h2 className="text-lg font-black">Select Shop & Date</h2></div>
          <div>
            <label className="mb-1.5 block text-sm font-bold">Shop</label>
            <select value={shopId} disabled={Boolean(user?.shopId)} onChange={(e) => setShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring disabled:opacity-70">
              {allowedShops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input type="date" value={date} max={getLocalDateInputValue()} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <button type="button" onClick={loadSalesData} disabled={!shopId || !date || loadingSales} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
            <WalletCards className="h-4 w-4" />
            {loadingSales ? "Loading..." : "Load Collection"}
          </button>
        </div>
      ) : (
        /* Collection Form */
        <div className="space-y-5">
          {/* Paper-form table */}
          <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black"><ShoppingBag className="h-4 w-4 text-primary" />Collection Summary</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 font-bold">Sl.No</th>
                    <th className="p-2 font-bold">Date</th>
                    <th className="p-2 font-bold">Day</th>
                    <th className="p-2 font-bold text-right">Cash Sales (A)</th>
                    <th className="p-2 font-bold text-right">Credit Sales (B)</th>
                    <th className="p-2 font-bold text-right">Total C=(A+B)</th>
                    <th className="p-2 font-bold text-right">Deposit - Cash</th>
                    <th className="p-2 font-bold text-right">Deposit - LIPA</th>
                    <th className="p-2 font-bold text-right">Variance</th>
                    <th className="p-2 font-bold text-right">Deposit in Bank</th>
                    <th className="p-2 font-bold">Date of Deposit</th>
                    <th className="p-2 font-bold text-right">EFD Z Report</th>
                    <th className="p-2 font-bold text-right">Sales vs EFD</th>
                    <th className="p-2 font-bold">Name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="p-2 font-bold">1</td>
                    <td className="p-2 font-semibold">{date}</td>
                    <td className="p-2 font-semibold">{getDayName(date)}</td>
                    <td className="p-2 text-right font-bold text-green-700">{formatCurrency(cashSales)}</td>
                    <td className="p-2 text-right font-bold text-amber-700">{formatCurrency(creditSales)}</td>
                    <td className="p-2 text-right font-black">{formatCurrency(totalSales)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(collection.depositCash)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(collection.depositLIPA)}</td>
                    <td className={`p-2 text-right font-black ${variance !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(variance)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(collection.depositInBank)}</td>
                    <td className="p-2 font-semibold">{collection.dateOfDeposit || "-"}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(collection.efdZReport)}</td>
                    <td className={`p-2 text-right font-black ${salesVsEfd !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(salesVsEfd)}</td>
                    <td className="p-2 font-semibold">{collection.name || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Editable fields */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black"><Banknote className="h-4 w-4 text-primary" />Enter Collection Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField label="Cash Sale Deposits - Cash" value={collection.depositCash} onChange={(v) => setCollection((c) => ({ ...c, depositCash: v }))} icon={<Banknote className="h-4 w-4" />} />
              <MoneyField label="Cash Sale Deposits - LIPA" value={collection.depositLIPA} onChange={(v) => setCollection((c) => ({ ...c, depositLIPA: v }))} icon={<CreditCard className="h-4 w-4" />} />
              <MoneyField label="Deposit in Bank" value={collection.depositInBank} onChange={(v) => setCollection((c) => ({ ...c, depositInBank: v }))} icon={<Landmark className="h-4 w-4" />} />
              <div>
                <label className="mb-1.5 block text-sm font-bold">Date of Deposit</label>
                <input type="date" value={collection.dateOfDeposit} onChange={(e) => setCollection((c) => ({ ...c, dateOfDeposit: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <MoneyField label="EFD Z Report" value={collection.efdZReport} onChange={(v) => setCollection((c) => ({ ...c, efdZReport: v }))} icon={<ReceiptText className="h-4 w-4" />} />
              <div>
                <label className="mb-1.5 block text-sm font-bold">Name</label>
                <input value={collection.name} onChange={(e) => setCollection((c) => ({ ...c, name: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Employee name" />
              </div>
            </div>
          </section>

          {/* Verification */}
          <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4 text-primary" />Verification</h3>
            {allMatched ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">All values match. Ready to submit.</div>
            ) : (
              <div className="space-y-2">
                {warnings.map((w) => <div key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-slate-900">{w}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Mini label="Expected" value={formatCurrency(cashSales)} />
              <Mini label="Actual" value={formatCurrency(actualCollection)} />
              <Mini label="Variance" value={formatCurrency(variance)} danger={variance !== 0} />
              <Mini label="Bank Diff" value={formatCurrency(bankDiff)} danger={bankDiff !== 0} />
              <Mini label="Sales vs EFD" value={formatCurrency(salesVsEfd)} danger={salesVsEfd !== 0} />
              <Mini label="Status" value={allMatched ? "Matched" : "Check"} danger={!allMatched} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm font-bold">
              <input type="checkbox" checked={collection.signatureConfirmed} onChange={(e) => setCollection((c) => ({ ...c, signatureConfirmed: e.target.checked }))} className="mt-1 h-4 w-4" />
              <span>I confirm today's collection details are correct</span>
            </label>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Remarks {variance !== 0 ? "*" : ""}</label>
              <textarea value={collection.remarks} onChange={(e) => setCollection((c) => ({ ...c, remarks: e.target.value }))} placeholder={variance !== 0 ? "Explain the variance" : "Optional"} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </section>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => setSalesLoaded(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-bold hover:bg-secondary">Back</button>
            <button type="button" onClick={submitCollection} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />{submitting ? "Submitting..." : "Submit Collection"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MoneyField: React.FC<{ label: string; value: number; icon: React.ReactNode; onChange: (v: number) => void }> = ({ label, value, icon, onChange }) => (
  <div>
    <label className="mb-1.5 block text-sm font-bold">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-3.5 text-muted-foreground">{icon}</span>
      <input type="number" min="0" step="0.01" inputMode="decimal" value={value || ""} onChange={(e) => onChange(Number(e.target.value || 0))} className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" />
    </div>
  </div>
);

const Mini: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => (
  <div className="rounded-lg border border-border bg-card p-3 text-center">
    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    <p className={`mt-1 text-sm font-black ${danger ? "text-red-700" : "text-primary"}`}>{value}</p>
  </div>
);

export default CollectionEntry;
