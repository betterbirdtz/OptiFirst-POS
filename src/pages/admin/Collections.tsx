import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, FileDown, FileSpreadsheet, RefreshCw, RotateCcw, Search, Trash2, WalletCards, X } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { CollectionEntry, CollectionStatus, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getMonthInputValue } from "../../utils/date";
import { exportCollectionsToExcel } from "../../utils/exportExcel";
import { generateMonthlyCollectionPdf } from "../../utils/exportPdf";
import { getSessionUser } from "../../utils/session";

const statusOptions: Array<"" | CollectionStatus> = ["", "Draft", "Submitted", "Approved", "Rejected", "Reopened"];

export const Collections: React.FC = () => {
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [month, setMonth] = useState(getMonthInputValue());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [collections, setCollections] = useState<CollectionEntry[]>([]);
  const [selected, setSelected] = useState<CollectionEntry | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);

  const totals = useMemo(
    () => collections.reduce(
      (sum, row) => ({
        cash: sum.cash + Number(row.CashSales || 0),
        credit: sum.credit + Number(row.CreditSales || 0),
        total: sum.total + Number(row.TotalSales || 0),
        depositCash: sum.depositCash + Number(row.DepositCash || 0),
        depositLIPA: sum.depositLIPA + Number(row.DepositLIPA || 0),
        variance: sum.variance + Number(row.Variance || 0),
        bankDiff: sum.bankDiff + Number(row.BankDepositDifference || 0),
        salesVsEfd: sum.salesVsEfd + Number(row.SalesVsEFD || 0)
      }),
      { cash: 0, credit: 0, total: 0, depositCash: 0, depositLIPA: 0, variance: 0, bankDiff: 0, salesVsEfd: 0 }
    ),
    [collections]
  );

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shopResponse, collectionResponse] = await Promise.all([
        appsScriptClient.getShops(),
        appsScriptClient.getCollections({
          shopId: shopId || undefined,
          month: month || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: status || undefined,
          search: search || undefined
        })
      ]);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (collectionResponse.success && collectionResponse.collections) setCollections(collectionResponse.collections);
      else setError(collectionResponse.error || "Failed to load collections.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading collections.");
    } finally {
      setLoading(false);
    }
  }, [endDate, month, search, shopId, startDate, status]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const saveSelected = async (nextStatus?: "Approved" | "Rejected" | "Reopened") => {
    if (!selected || !user) return;
    setSaving(true);
    setError("");
    try {
      let response;
      if (nextStatus === "Approved") {
        response = await appsScriptClient.approveCollection(selected.CollectionID, user.userId, adminNote);
      } else if (nextStatus === "Rejected") {
        response = await appsScriptClient.rejectCollection(selected.CollectionID, user.userId, adminNote || "Rejected by admin.");
      } else if (nextStatus === "Reopened") {
        response = await appsScriptClient.reopenCollection(selected.CollectionID, user.userId, adminNote);
      } else {
        response = await appsScriptClient.updateCollectionByAdmin({
          collectionId: selected.CollectionID,
          adminNote
        });
      }
      if (!response.success) setError(response.error || "Collection update failed.");
      else {
        setSelected(null);
        setAdminNote("");
        await loadCollections();
      }
    } catch (saveError) {
      console.error(saveError);
      setError("Network error saving collection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!window.confirm("Are you sure you want to delete this collection entry? This action cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      const response = await appsScriptClient.deleteCollection(collectionId);
      if (!response.success) setError(response.error || "Collection delete failed.");
      else {
        setSelected(null);
        await loadCollections();
      }
    } catch (saveError) {
      console.error(saveError);
      setError("Network error deleting collection.");
    } finally {
      setSaving(false);
    }
  };

  const handleExcelExport = () => {
    exportCollectionsToExcel(collections, `Collections_${shopId || "All_Shops"}_${month || "Filtered"}`);
  };

  const handlePdfExport = () => {
    generateMonthlyCollectionPdf(collections, selectedShop?.ShopName || "All Shops", month, {
      inchargeName: selectedShop?.InchargeName,
      generatedBy: user?.name
    });
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <WalletCards className="h-6 w-6 text-primary" />
            End-of-Day Collections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify employee-submitted settlements. Employees update collection details from End-of-Day Closing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadCollections} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={handleExcelExport} disabled={collections.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50">
            <FileSpreadsheet className="h-4 w-4 text-green-700" />
            Excel
          </button>
          <button type="button" onClick={handlePdfExport} disabled={collections.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-6">
        <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
          <option value="">All Shops</option>
          {shops.map((shop) => <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>)}
        </select>
        <input type="month" value={month} onChange={(event) => {
          const val = event.target.value;
          setMonth(val);
          if (val) {
            setStartDate("");
            setEndDate("");
          }
        }} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold" />
        <input type="date" value={startDate} onChange={(event) => {
          const val = event.target.value;
          setStartDate(val);
          if (val) {
            setMonth("");
          }
        }} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold" />
        <input type="date" value={endDate} onChange={(event) => {
          const val = event.target.value;
          setEndDate(val);
          if (val) {
            setMonth("");
          }
        }} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
          {statusOptions.map((item) => <option key={item || "All"} value={item}>{item || "All Statuses"}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Employee" className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm font-semibold" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Total Sales" value={formatCurrency(totals.total)} />
        <Summary label="Collection" value={formatCurrency(totals.depositCash + totals.depositLIPA)} />
        <Summary label="Variance" value={formatCurrency(totals.variance)} danger={totals.variance !== 0} />
        <Summary label="Bank Diff" value={formatCurrency(totals.bankDiff)} danger={totals.bankDiff !== 0} />
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading collections...</div>
      ) : collections.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No collections for this filter. Daily sales create draft rows automatically.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                <tr>
                  {["Date", "Day", "Shop", "Employee", "Cash Sales", "Credit Sales", "Total Sales", "Deposit Cash", "Deposit LIPA", "Variance", "Deposit in Bank", "Bank Diff", "EFD Z Report", "Sales vs EFD", "Status", "Actions"].map((header) => (
                    <th key={header} className={`p-3 ${header.includes("Sales") || header.includes("Deposit") || header.includes("Variance") || header.includes("Diff") || header.includes("EFD") ? "text-right" : ""}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {collections.map((row) => (
                  <tr key={row.CollectionID} className="hover:bg-secondary/30">
                    <td className="p-3 font-bold">{formatDateForDisplay(row.Date)}</td>
                    <td className="p-3">{row.Day}</td>
                    <td className="p-3 font-bold">{row.ShopName}</td>
                    <td className="p-3">{row.EmployeeName || row.Name}</td>
                    <td className="p-3 text-right">{formatCurrency(row.CashSales)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.CreditSales)}</td>
                    <td className="p-3 text-right font-black">{formatCurrency(row.TotalSales)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.DepositCash)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.DepositLIPA)}</td>
                    <td className={`p-3 text-right font-black ${row.Variance === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(row.Variance)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.DepositInBank)}</td>
                    <td className={`p-3 text-right font-black ${row.BankDepositDifference === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(row.BankDepositDifference)}</td>
                    <td className="p-3 text-right">{formatCurrency(row.EFDZReport)}</td>
                    <td className={`p-3 text-right font-black ${row.SalesVsEFD === 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(row.SalesVsEFD)}</td>
                    <td className="p-3"><StatusBadge status={row.Status} /></td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => { setSelected(row); setAdminNote(row.AdminNote || ""); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-bold hover:bg-secondary">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-black">{selected.ShopName} - {formatDateForDisplay(selected.Date)}</h2>
                <p className="text-sm text-muted-foreground">{selected.EmployeeName || selected.Name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-border p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DetailPanel title="Sales Summary">
                <ReadOnlyLine label="Cash Sales" value={formatCurrency(selected.CashSales)} />
                <ReadOnlyLine label="Credit Sales" value={formatCurrency(selected.CreditSales)} />
                <ReadOnlyLine label="Total Sales" value={formatCurrency(selected.TotalSales)} strong />
              </DetailPanel>

              <DetailPanel title="Collection Entered by Employee">
                <ReadOnlyLine label="Deposit Cash" value={formatCurrency(selected.DepositCash)} />
                <ReadOnlyLine label="Deposit LIPA" value={formatCurrency(selected.DepositLIPA)} />
                <ReadOnlyLine label="Deposit in Bank" value={formatCurrency(selected.DepositInBank)} />
                <ReadOnlyLine label="Date of Deposit" value={selected.DateOfDeposit ? formatDateForDisplay(selected.DateOfDeposit) : "-"} />
                <ReadOnlyLine label="EFD Z Report" value={formatCurrency(selected.EFDZReport)} />
              </DetailPanel>

              <DetailPanel title="Verification">
                <ReadOnlyLine label="Expected Collection" value={formatCurrency(selected.ExpectedCollection)} />
                <ReadOnlyLine label="Actual Collection" value={formatCurrency(selected.ActualCollection)} />
                <ReadOnlyLine label="Variance" value={formatCurrency(selected.Variance)} danger={selected.Variance !== 0} />
                <ReadOnlyLine label="Bank Deposit Difference" value={formatCurrency(selected.BankDepositDifference)} danger={selected.BankDepositDifference !== 0} />
                <ReadOnlyLine label="Sales vs EFD" value={formatCurrency(selected.SalesVsEFD)} danger={selected.SalesVsEFD !== 0} />
              </DetailPanel>

              <DetailPanel title="Approval">
                <ReadOnlyLine label="Name" value={selected.Name || "-"} />
                <ReadOnlyLine label="Signature" value={selected.Signature || "-"} />
                <ReadOnlyLine label="Remarks" value={selected.Remarks || "-"} />
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  To correct collection values, reopen this settlement. The employee must update it from End-of-Day Closing.
                </div>
                <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Admin note" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold" />
              </DetailPanel>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => handleDeleteCollection(selected.CollectionID)} disabled={saving} className="mr-auto inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button type="button" onClick={() => saveSelected()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50">
                Save Admin Note
              </button>
              <button type="button" onClick={() => saveSelected("Reopened")} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">
                <RotateCcw className="h-4 w-4" />
                Reopen
              </button>
              <button type="button" onClick={() => saveSelected("Rejected")} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                <X className="h-4 w-4" />
                Reject
              </button>
              <button type="button" onClick={() => saveSelected("Approved")} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Check className="h-4 w-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: CollectionStatus }> = ({ status }) => {
  const tone = status === "Approved"
    ? "border-green-200 bg-green-50 text-green-700"
    : status === "Rejected"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "Reopened"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "Submitted"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${tone}`}>{status}</span>;
};

const Summary: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="text-xs font-bold text-muted-foreground">{label}</p>
    <p className={`mt-1 text-lg font-black ${danger ? "text-red-700" : "text-primary"}`}>{value}</p>
  </div>
);

const DetailPanel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3 rounded-lg border border-border bg-card p-4">
    <h3 className="text-sm font-black">{title}</h3>
    {children}
  </section>
);

const ReadOnlyLine: React.FC<{ label: string; value: string; strong?: boolean; danger?: boolean }> = ({ label, value, strong, danger }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={`text-right font-black ${danger ? "text-red-700" : strong ? "text-primary" : ""}`}>{value}</span>
  </div>
);

export default Collections;
