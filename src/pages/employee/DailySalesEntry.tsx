import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Calendar, CheckCircle2, Plus, Save, Send, ShoppingBag, Trash2 } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import ConfirmSubmitModal from "../../components/employee/ConfirmSubmitModal";
import ReviewWarnings from "../../components/employee/ReviewWarnings";
import StepProgress from "../../components/employee/StepProgress";
import type { Product, SalesSubmissionItem, Shop, UserSession } from "../../types";
import { calculateSalesAmount, formatCurrency } from "../../utils/calculations";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

const steps = ["Shop & Date", "Add Sales", "Review & Submit"];

export const DailySalesEntry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(getLocalDateInputValue());
  const [shopId, setShopId] = useState("");
  const [reportId, setReportId] = useState<string | undefined>();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesEntries, setSalesEntries] = useState<SalesSubmissionItem[]>([]);

  const [bulkRows, setBulkRows] = useState<Array<{ checked: boolean; productId: string; quantity: string; rate: string; saleType: "Cash" | "Credit"; paymentMode: string; customerName: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [draftSynced, setDraftSynced] = useState(false);

  const selectedShop = shops.find((s) => s.ShopID === shopId);
  const activeShops = shops.filter((s) => s.Status === "Active");
  const allowedShops = user?.shopId ? activeShops.filter((s) => s.ShopID === user.shopId) : activeShops;

  const currentSalesEntries = useMemo(() => {
    return bulkRows
      .filter((row) => row.checked && Number(row.quantity) > 0)
      .map((row) => {
        const p = products.find((x) => x.ProductID === row.productId);
        return {
          productId: row.productId,
          productName: p?.ProductName || "Unknown Product",
          uom: p?.UOM || "",
          quantity: Number(row.quantity),
          rate: Number(row.rate) || Number(p?.DefaultRate || 0),
          saleType: row.saleType,
          paymentMode: row.saleType === "Cash" ? row.paymentMode : undefined,
          customerName: row.saleType === "Credit" ? row.customerName || undefined : undefined,
        } as SalesSubmissionItem;
      });
  }, [bulkRows, products]);

  const totalCashSales = useMemo(() => currentSalesEntries.filter((s) => s.saleType === "Cash").reduce((sum, s) => sum + calculateSalesAmount(s.quantity, s.rate), 0), [currentSalesEntries]);
  const totalCreditSales = useMemo(() => currentSalesEntries.filter((s) => s.saleType === "Credit").reduce((sum, s) => sum + calculateSalesAmount(s.quantity, s.rate), 0), [currentSalesEntries]);
  const totalSales = totalCashSales + totalCreditSales;
  const warnings = useMemo(() => currentSalesEntries.filter((s) => s.saleType === "Credit" && !s.customerName?.trim()).map((s) => `Customer name required for: ${s.productName}`), [currentSalesEntries]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [shopRes, prodRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopRes.success && shopRes.shops) {
          setShops(shopRes.shops);
          setShopId(user.shopId || shopRes.shops.find((s) => s.Status === "Active")?.ShopID || "");
        }
        if (prodRes.success && prodRes.products) {
          const active = prodRes.products.filter((p) => p.Active === "Yes");
          setProducts(active);
          if (active.length > 0) {
            setBulkRows(active.map((p) => ({ checked: false, productId: p.ProductID, quantity: "", rate: String(p.DefaultRate || ""), saleType: "Cash" as const, paymentMode: "Cash", customerName: "" })));
          }
        }
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  useEffect(() => {
    const state = location.state as {
      resubmitReport?: {
        reportId?: string;
        shopId?: string;
        date?: string;
        salesEntries?: SalesSubmissionItem[];
      };
    } | null;

    if (state?.resubmitReport) {
      setReportId(state.resubmitReport.reportId);
      setShopId(state.resubmitReport.shopId || user?.shopId || "");
      setDate(state.resubmitReport.date || getLocalDateInputValue());
      setSalesEntries(state.resubmitReport.salesEntries || []);
      return;
    }

    try {
      const draft = localStorage.getItem("draft_sales");
      if (!draft) return;
      const parsed = JSON.parse(draft);
      if (parsed.employeeId === user?.employeeId) {
        if (parsed.shopId) setShopId(parsed.shopId);
        if (parsed.date) setDate(parsed.date);
        if (parsed.salesEntries) setSalesEntries(parsed.salesEntries);
        if (parsed.mode) { /* legacy */ }
      }
    } catch {
      localStorage.removeItem("draft_sales");
    }
  }, [location.state, user]);

  useEffect(() => {
    if (products.length === 0 || salesEntries.length === 0 || draftSynced) return;
    setBulkRows((currentBulkRows) => {
      const updatedRows = [...currentBulkRows];
      salesEntries.forEach((item) => {
        const existingIdx = updatedRows.findIndex(
          (r) => r.productId === item.productId && !r.checked
        );
        if (existingIdx !== -1) {
          updatedRows[existingIdx] = {
            checked: true,
            productId: item.productId,
            quantity: String(item.quantity),
            rate: String(item.rate),
            saleType: item.saleType as "Cash" | "Credit",
            paymentMode: item.paymentMode || "Cash",
            customerName: item.customerName || "",
          };
        } else {
          updatedRows.push({
            checked: true,
            productId: item.productId,
            quantity: String(item.quantity),
            rate: String(item.rate),
            saleType: item.saleType as "Cash" | "Credit",
            paymentMode: item.paymentMode || "Cash",
            customerName: item.customerName || "",
          });
        }
      });
      return updatedRows;
    });
    setDraftSynced(true);
  }, [products, salesEntries, draftSynced]);



  const updateBulkRow = (i: number, field: string, value: any) => {
    setBulkRows((c) => c.map((row, idx) => {
      if (idx !== i) return row;
      const updated = { ...row, [field]: value } as typeof row;
      if (field === "productId") {
        const p = products.find((x) => x.ProductID === value);
        if (p) updated.rate = String(p.DefaultRate || "");
      }
      if (field === "checked") {
        if (value === true) {
          if (!updated.quantity) updated.quantity = "1";
        } else {
          updated.quantity = "";
          updated.customerName = "";
        }
      }
      if (field === "quantity" && Number(value) > 0) {
        updated.checked = true;
      }
      if (field === "saleType") {
        if (value === "Cash") { updated.customerName = ""; if (!updated.paymentMode) updated.paymentMode = "Cash"; }
        else { updated.paymentMode = ""; }
      }
      return updated;
    }));
  };

  const handleSaveDraft = () => {
    if (!user) return;
    localStorage.setItem("draft_sales", JSON.stringify({ employeeId: user.employeeId, shopId, date, salesEntries: currentSalesEntries }));
    window.alert("Draft saved.");
  };

  const submitSales = async () => {
    if (!user || !selectedShop) return;
    if (currentSalesEntries.length === 0) { setError("Add at least one item."); setConfirmOpen(false); return; }
    const missing = currentSalesEntries.find((s) => s.saleType === "Credit" && !s.customerName?.trim());
    if (missing) { setError(`Customer name required for ${missing.productName}.`); setConfirmOpen(false); return; }
    setSubmitting(true); setError("");
    try {
      const res = await appsScriptClient.submitDailySales({ reportId, shopId: selectedShop.ShopID, shopName: selectedShop.ShopName, employeeId: user.employeeId, employeeName: user.name, date, salesEntries: currentSalesEntries, stockEntries: [] });
      if (res.success) { localStorage.removeItem("draft_sales"); setReportId(res.reportId); setConfirmOpen(false); setSuccess(true); }
      else { setError(res.error || "Submission failed."); setConfirmOpen(false); }
    } catch { setError("Network error. Check connection and try again."); setConfirmOpen(false); }
    finally { setSubmitting(false); }
  };
  const isAllSelected = bulkRows.length > 0 && bulkRows.every((r) => r.checked);
  const isSomeSelected = bulkRows.length > 0 && bulkRows.some((r) => r.checked) && !isAllSelected;

  const handleSelectAllToggle = () => {
    const target = !isAllSelected;
    setBulkRows((c) =>
      c.map((row) => {
        const updated = { ...row, checked: target } as typeof row;
        if (target) {
          if (!updated.quantity) updated.quantity = "1";
        } else {
          updated.quantity = "";
          updated.customerName = "";
        }
        return updated;
      })
    );
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-16 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-10 w-10" /></div>
        <h2 className="text-2xl font-black">Daily Sales Submitted</h2>
        <p className="text-sm text-muted-foreground">Sales saved. Complete stock closing after business closes.</p>
        <button onClick={() => navigate("/employee/dashboard")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-4xl sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">Daily Sales Entry</h1>
          <p className="text-xs text-muted-foreground">Add today's sales items quickly</p>
        </div>
      </div>

      <StepProgress steps={steps} currentStep={step} />

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span>{error}</span></div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {step === 1 && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary"><Building2 className="h-5 w-5" /><h2 className="text-lg font-black">Shop & Date</h2></div>
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
              <button type="button" onClick={() => setStep(2)} disabled={!shopId || !date} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
                <ShoppingBag className="h-4 w-4" /> Continue to Sales
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary"><ShoppingBag className="h-5 w-5" /><h2 className="text-lg font-black">Add Sales</h2></div>

                {(
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Select products sold by checking them. Only checked items with quantity &gt; 0 will be added.</p>
                    
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
                      <table className="w-full text-left text-xs table-fixed">
                        <thead className="bg-secondary/60 text-muted-foreground border-b border-border">
                          <tr>
                            <th className="p-2.5 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isSomeSelected;
                                }}
                                onChange={handleSelectAllToggle}
                                className="rounded border-input text-primary focus:ring-ring focus:ring-2 h-4 w-4 cursor-pointer"
                              />
                            </th>
                            <th className="p-2.5 font-bold w-48">Product</th>
                            <th className="p-2.5 font-bold w-20">Qty</th>
                            <th className="p-2.5 font-bold w-24">Rate</th>
                            <th className="p-2.5 font-bold w-24">Type</th>
                            <th className="p-2.5 font-bold w-28">Mode / Customer</th>
                            <th className="p-2.5 font-bold text-right w-32">Amount</th>
                            <th className="p-2.5 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {bulkRows.map((row, i) => {
                            const amt = Number(row.quantity) > 0 && Number(row.rate) > 0 ? calculateSalesAmount(Number(row.quantity), Number(row.rate)) : 0;
                            return (
                              <tr
                                key={i}
                                className={`transition-colors duration-150 ${
                                  row.checked
                                    ? "bg-primary/[0.02] hover:bg-primary/[0.04]"
                                    : "opacity-60 bg-secondary/10 hover:bg-secondary/20"
                                }`}
                              >
                                <td className="p-2 text-center w-12">
                                  <input
                                    type="checkbox"
                                    checked={row.checked}
                                    onChange={(e) => updateBulkRow(i, "checked", e.target.checked)}
                                    className="rounded border-input text-primary focus:ring-ring focus:ring-2 h-4 w-4 cursor-pointer"
                                  />
                                </td>
                                <td className="p-2 w-48">
                                  <select
                                    value={row.productId}
                                    disabled={!row.checked}
                                    onChange={(e) => updateBulkRow(i, "productId", e.target.value)}
                                    className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-semibold outline-none focus:border-primary disabled:bg-secondary/50 disabled:text-muted-foreground truncate"
                                  >
                                    {products.map((p) => (
                                      <option key={p.ProductID} value={p.ProductID}>
                                        {p.ProductName} ({p.UOM})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2 w-20">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={row.quantity}
                                    disabled={!row.checked}
                                    onChange={(e) => updateBulkRow(i, "quantity", e.target.value)}
                                    className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold outline-none focus:border-primary disabled:bg-secondary/50 disabled:text-muted-foreground"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2 w-24">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={row.rate}
                                    disabled={!row.checked}
                                    onChange={(e) => updateBulkRow(i, "rate", e.target.value)}
                                    className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold outline-none focus:border-primary disabled:bg-secondary/50 disabled:text-muted-foreground"
                                  />
                                </td>
                                <td className="p-2 w-24">
                                  <select
                                    value={row.saleType}
                                    disabled={!row.checked}
                                    onChange={(e) => updateBulkRow(i, "saleType", e.target.value)}
                                    className="w-full rounded border border-input bg-background px-1.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:bg-secondary/50 disabled:text-muted-foreground"
                                  >
                                    <option value="Cash">Cash</option>
                                    <option value="Credit">Credit</option>
                                  </select>
                                </td>
                                <td className="p-2 w-28">
                                  {row.saleType === "Credit" ? (
                                    <input
                                      value={row.customerName}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "customerName", e.target.value)}
                                      className="w-full rounded border border-amber-300 bg-background px-2 py-2 text-xs font-semibold outline-none focus:border-primary disabled:border-input disabled:bg-secondary/50 disabled:text-muted-foreground"
                                      placeholder="Name"
                                    />
                                  ) : (
                                    <select
                                      value={row.paymentMode}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "paymentMode", e.target.value)}
                                      className="w-full rounded border border-input bg-background px-1.5 py-2 text-xs font-bold outline-none focus:border-primary disabled:bg-secondary/50 disabled:text-muted-foreground"
                                    >
                                      <option value="Cash">Cash</option>
                                      <option value="Mpesa">Mpesa</option>
                                      <option value="Selcom">Selcom</option>
                                      <option value="Bank">Bank</option>
                                    </select>
                                  )}
                                </td>
                                <td className="p-2 text-right font-black text-xs w-32">
                                  {amt > 0 ? formatCurrency(amt) : "-"}
                                </td>
                                <td className="p-2 text-center w-12 border-l border-transparent">
                                  <button
                                    type="button"
                                    onClick={() => setBulkRows((c) => c.filter((_, idx) => idx !== i))}
                                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    title="Delete row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-3">
                      {bulkRows.length > 0 && (
                        <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-2.5 border border-border/60 mb-1">
                          <div className="flex items-center gap-2.5">
                            <input
                              id="mobile-select-all"
                              type="checkbox"
                              checked={isAllSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = isSomeSelected;
                              }}
                              onChange={handleSelectAllToggle}
                              className="rounded border-input text-primary focus:ring-ring focus:ring-2 h-5 w-5 cursor-pointer"
                            />
                            <label htmlFor="mobile-select-all" className="text-xs font-black cursor-pointer select-none text-foreground/80">
                              Select All Products
                            </label>
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground bg-card px-2 py-0.5 rounded-full border border-border/40">
                            {bulkRows.filter((r) => r.checked).length} selected
                          </span>
                        </div>
                      )}

                      {bulkRows.map((row, i) => {
                        const amt = Number(row.quantity) > 0 && Number(row.rate) > 0 ? calculateSalesAmount(Number(row.quantity), Number(row.rate)) : 0;
                        return (
                          <div
                            key={i}
                            className={`rounded-xl border transition-all duration-200 p-4 shadow-sm ${
                              row.checked
                                ? "border-primary bg-card ring-1 ring-primary/20"
                                : "border-border/60 bg-secondary/10 opacity-65"
                            }`}
                          >
                            <div className={`flex items-center gap-3 ${row.checked ? "pb-3 border-b border-border/40" : ""}`}>
                              <input
                                type="checkbox"
                                checked={row.checked}
                                onChange={(e) => updateBulkRow(i, "checked", e.target.checked)}
                                className="rounded border-input text-primary focus:ring-ring focus:ring-2 h-5 w-5 cursor-pointer flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <select
                                  value={row.productId}
                                  disabled={!row.checked}
                                  onChange={(e) => updateBulkRow(i, "productId", e.target.value)}
                                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary disabled:bg-secondary/40 disabled:text-muted-foreground"
                                >
                                  {products.map((p) => (
                                    <option key={p.ProductID} value={p.ProductID}>
                                      {p.ProductName} ({p.UOM})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => setBulkRows((c) => c.filter((_, idx) => idx !== i))}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0"
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {row.checked && (
                              <div className="pt-3 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Qty</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={row.quantity}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "quantity", e.target.value)}
                                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-black outline-none focus:ring-1 focus:ring-primary disabled:bg-secondary/40 disabled:text-muted-foreground"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rate</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      value={row.rate}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "rate", e.target.value)}
                                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-black outline-none focus:ring-1 focus:ring-primary disabled:bg-secondary/40 disabled:text-muted-foreground"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 items-end">
                                  <div>
                                    <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</label>
                                    <select
                                      value={row.saleType}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "saleType", e.target.value)}
                                      className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary disabled:bg-secondary/40 disabled:text-muted-foreground"
                                    >
                                      <option value="Cash">Cash</option>
                                      <option value="Credit">Credit</option>
                                    </select>
                                  </div>
                                  <div className="text-right flex flex-col justify-end h-full">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Amount</span>
                                    <span className="text-xs font-black text-primary block py-1.5 pr-1">
                                      {amt > 0 ? formatCurrency(amt) : "-"}
                                    </span>
                                  </div>
                                </div>

                                {row.saleType === "Credit" && (
                                  <div className="transition-all duration-200">
                                    <label className="mb-1 block text-[10px] font-bold text-amber-600 uppercase tracking-wider">Customer Name *</label>
                                    <input
                                      value={row.customerName}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "customerName", e.target.value)}
                                      className="w-full rounded-lg border border-amber-300 bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-amber-500 disabled:border-input disabled:bg-secondary/40 disabled:text-muted-foreground"
                                      placeholder="Enter customer name"
                                    />
                                  </div>
                                )}
                                {row.saleType === "Cash" && (
                                  <div className="transition-all duration-200">
                                    <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payment Mode</label>
                                    <select
                                      value={row.paymentMode}
                                      disabled={!row.checked}
                                      onChange={(e) => updateBulkRow(i, "paymentMode", e.target.value)}
                                      className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary disabled:bg-secondary/40 disabled:text-muted-foreground"
                                    >
                                      <option value="Cash">Cash</option>
                                      <option value="Mpesa">Mpesa</option>
                                      <option value="Selcom">Selcom</option>
                                      <option value="Bank">Bank</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBulkRows((c) => [
                            ...c,
                            {
                              checked: true,
                              productId: products[0]?.ProductID || "",
                              quantity: "",
                              rate: String(products[0]?.DefaultRate || ""),
                              saleType: "Cash",
                              paymentMode: "Cash",
                              customerName: "",
                            },
                          ])
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm font-bold hover:bg-secondary hover:border-primary/50 transition-colors text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-4 w-4" /> Add Extra Product Row
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Cash Sales</p><p className="mt-1 text-sm font-black text-green-700">{formatCurrency(totalCashSales)}</p></div>
                <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Credit Sales</p><p className="mt-1 text-sm font-black text-amber-700">{formatCurrency(totalCreditSales)}</p></div>
                <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Total</p><p className="mt-1 text-sm font-black text-primary">{formatCurrency(totalSales)}</p></div>
              </div>

              {/* Items list */}
              {/* Navigation */}
              <div className="flex gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-lg border border-border py-3 text-sm font-bold hover:bg-secondary">Back</button>
                <button type="button" onClick={handleSaveDraft} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-bold hover:bg-secondary"><Save className="h-4 w-4" />Draft</button>
                <button type="button" onClick={() => setStep(3)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Review <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-black">Review & Submit</h2>
                <ReviewWarnings warnings={warnings} />
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Items</p><p className="mt-1 text-lg font-black">{currentSalesEntries.length}</p></div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Total Sales</p><p className="mt-1 text-lg font-black text-primary">{formatCurrency(totalSales)}</p></div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">Warnings</p><p className={`mt-1 text-lg font-black ${warnings.length ? "text-amber-700" : "text-green-700"}`}>{warnings.length}</p></div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cash Sales</span><span className="font-black">{formatCurrency(totalCashSales)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Credit Sales</span><span className="font-black">{formatCurrency(totalCreditSales)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 text-primary"><span className="font-black">Total</span><span className="font-black">{formatCurrency(totalSales)}</span></div>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
                <Send className="mx-auto h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">Submit daily sales now. Stock closing can be done later.</p>
                <button type="button" onClick={() => setConfirmOpen(true)} className="w-full rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground">Submit Daily Sales</button>
              </div>

              <button type="button" onClick={() => setStep(2)} className="w-full rounded-lg border border-border py-3 text-sm font-bold hover:bg-secondary">Back to Sales</button>
            </div>
          )}
        </>
      )}

      <ConfirmSubmitModal isOpen={confirmOpen} loading={submitting} totalSales={totalSales} warningsCount={warnings.length} description="This will save daily sales. Stock closing can be completed later after business closes." onClose={() => setConfirmOpen(false)} onConfirm={submitSales} />
    </div>
  );
};

export default DailySalesEntry;
