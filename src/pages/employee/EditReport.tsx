import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Plus, Send, Trash2 } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailySalesEntry, Product, UserSession } from "../../types";
import { calculateSalesAmount, formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface EditItem {
  productId: string;
  productName: string;
  uom: string;
  quantity: number;
  rate: number;
  saleType: "Cash" | "Credit";
  paymentMode: string;
  customerName: string;
}

export const EditReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [reportId, setReportId] = useState("");
  const [shopId, setShopId] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<EditItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    const state = location.state as { reportId?: string; shopId?: string; date?: string } | null;
    if (!state?.reportId) { navigate("/employee/my-reports"); return; }

    setReportId(state.reportId);
    setShopId(state.shopId || user.shopId || "");
    setDate(state.date || "");
    loadReportData(state.reportId, state.date || "");
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await appsScriptClient.getProducts();
      if (res.success && res.products) setProducts(res.products.filter((p) => p.Active === "Yes"));
    } catch { /* */ }
  };

  const loadReportData = async (repId: string, repDate: string) => {
    setLoading(true);
    try {
      const res = await appsScriptClient.getReportsByDate(repDate, repDate, user?.employeeId);
      if (res.success && res.sales) {
        const reportSales = res.sales.filter((s: DailySalesEntry) => s.ReportID === repId);
        setItems(reportSales.map((s) => ({
          productId: s.ProductID,
          productName: s.ProductName,
          uom: s.UOM,
          quantity: Number(s.Quantity),
          rate: Number(s.Rate),
          saleType: s.SaleType as "Cash" | "Credit",
          paymentMode: "Cash",
          customerName: s.CustomerName || ""
        })));
      }
    } catch { setError("Failed to load report data."); }
    finally { setLoading(false); }
  };

  const updateItem = (index: number, field: keyof EditItem, value: string | number) => {
    setItems((current) => current.map((item, i) => i !== index ? item : { ...item, [field]: value }));
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setItems((current) => [...current, {
      productId: p.ProductID,
      productName: p.ProductName,
      uom: p.UOM,
      quantity: 0,
      rate: p.DefaultRate,
      saleType: "Cash",
      paymentMode: "Cash",
      customerName: ""
    }]);
  };

  const changeProduct = (index: number, productId: string) => {
    const p = products.find((x) => x.ProductID === productId);
    if (!p) return;
    setItems((current) => current.map((item, i) => i !== index ? item : { ...item, productId: p.ProductID, productName: p.ProductName, uom: p.UOM, rate: p.DefaultRate }));
  };

  const totalSales = items.reduce((sum, item) => sum + calculateSalesAmount(item.quantity, item.rate), 0);

  const handleSubmit = async () => {
    if (!user || !shopId) return;
    if (items.length === 0) { setError("No items to submit."); return; }
    const missing = items.find((i) => i.saleType === "Credit" && !i.customerName.trim());
    if (missing) { setError(`Customer name required for ${missing.productName}`); return; }

    setSubmitting(true); setError("");
    try {
      const shop = (await appsScriptClient.getShops()).shops?.find((s) => s.ShopID === shopId);
      const res = await appsScriptClient.submitDailySales({
        reportId,
        shopId,
        shopName: shop?.ShopName || "",
        employeeId: user.employeeId,
        employeeName: user.name,
        date,
        salesEntries: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          uom: item.uom,
          quantity: item.quantity,
          rate: item.rate,
          saleType: item.saleType,
          paymentMode: item.saleType === "Cash" ? item.paymentMode : undefined,
          customerName: item.saleType === "Credit" ? item.customerName : undefined
        })),
        stockEntries: []
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
        <h2 className="text-2xl font-black">Report Updated</h2>
        <p className="text-sm text-muted-foreground">Your corrected report has been resubmitted.</p>
        <button onClick={() => navigate("/employee/my-reports")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Back to My Reports</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-4 pb-28 sm:max-w-2xl sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/my-reports")} className="rounded-lg border border-border p-2 text-muted-foreground active:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-lg font-black">Edit Report</h1>
          <p className="text-xs text-muted-foreground">Correct items for {formatDateForDisplay(date)}</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading your items...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No items found for this report.</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Edit quantity, rate, or type. You can also add new items or remove existing ones.</p>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-2.5 font-bold">Product</th>
                  <th className="p-2.5 font-bold w-16">Qty</th>
                  <th className="p-2.5 font-bold w-20">Rate</th>
                  <th className="p-2.5 font-bold w-20">Type</th>
                  <th className="p-2.5 font-bold w-20">Mode</th>
                  <th className="p-2.5 font-bold text-right w-24">Amount</th>
                  <th className="p-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="p-1.5"><select value={item.productId} onChange={(e) => changeProduct(i, e.target.value)} className="w-full rounded border border-input bg-background px-1.5 py-2 text-xs font-semibold outline-none">{products.map((p) => <option key={p.ProductID} value={p.ProductID}>{p.ProductName} ({p.UOM})</option>)}</select></td>
                    <td className="p-1.5"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.quantity || ""} onChange={(e) => updateItem(i, "quantity", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" placeholder="0" /></td>
                    <td className="p-1.5"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" /></td>
                    <td className="p-1.5"><select value={item.saleType} onChange={(e) => updateItem(i, "saleType", e.target.value)} className="w-full rounded border border-input bg-background px-1 py-2 text-xs font-bold outline-none"><option value="Cash">Cash</option><option value="Credit">Credit</option></select></td>
                    <td className="p-1.5">{item.saleType === "Credit" ? <input value={item.customerName} onChange={(e) => updateItem(i, "customerName", e.target.value)} className="w-full rounded border border-amber-300 bg-background px-2 py-2 text-xs outline-none" placeholder="Name" /> : <select value={item.paymentMode} onChange={(e) => updateItem(i, "paymentMode", e.target.value)} className="w-full rounded border border-input bg-background px-1 py-2 text-xs font-bold outline-none"><option value="Cash">Cash</option><option value="Mpesa">Mpesa</option><option value="Selcom">Selcom</option><option value="Bank">Bank</option></select>}</td>
                    <td className="p-2 text-right text-xs font-black">{calculateSalesAmount(item.quantity, item.rate) > 0 ? formatCurrency(calculateSalesAmount(item.quantity, item.rate)) : "-"}</td>
                    <td className="p-1.5"><button type="button" onClick={() => removeItem(i)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile compact list */}
          <div className="sm:hidden space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select value={item.productId} onChange={(e) => changeProduct(i, e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-xs font-bold outline-none">{products.map((p) => <option key={p.ProductID} value={p.ProductID}>{p.ProductName}</option>)}</select>
                  <button type="button" onClick={() => removeItem(i)} className="rounded p-2 text-muted-foreground active:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={item.quantity || ""} onChange={(e) => updateItem(i, "quantity", Number(e.target.value || 0))} className="rounded-lg border border-input bg-background px-2 py-2.5 text-sm font-black text-center outline-none" placeholder="Qty" />
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value || 0))} className="rounded-lg border border-input bg-background px-2 py-2.5 text-sm font-bold text-center outline-none" placeholder="Rate" />
                  <select value={item.saleType} onChange={(e) => updateItem(i, "saleType", e.target.value)} className="rounded-lg border border-input bg-background px-1 py-2.5 text-xs font-bold outline-none"><option value="Cash">Cash</option><option value="Credit">Credit</option></select>
                  <div className="flex items-center justify-end text-xs font-black text-primary">{calculateSalesAmount(item.quantity, item.rate) > 0 ? formatCurrency(calculateSalesAmount(item.quantity, item.rate)) : "-"}</div>
                </div>
                {item.saleType === "Credit" && <input value={item.customerName} onChange={(e) => updateItem(i, "customerName", e.target.value)} className="w-full rounded-lg border border-amber-300 bg-background px-3 py-2 text-xs font-semibold outline-none" placeholder="Customer name" />}
                {item.saleType === "Cash" && <select value={item.paymentMode} onChange={(e) => updateItem(i, "paymentMode", e.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs font-bold outline-none"><option value="Cash">Cash</option><option value="Mpesa">Mpesa</option><option value="Selcom">Selcom</option><option value="Bank">Bank</option></select>}
              </div>
            ))}
          </div>

          {/* Add Item */}
          <button type="button" onClick={addItem} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm font-bold text-muted-foreground active:bg-secondary">
            <Plus className="h-4 w-4" /> Add Another Item
          </button>

          {/* Total */}
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground">TOTAL SALES</p>
            <p className="mt-1 text-xl font-black text-primary">{formatCurrency(totalSales)}</p>
          </div>

          {/* Submit */}
          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-sm font-black text-primary-foreground disabled:opacity-50 active:scale-[0.97]">
            <Send className="h-4 w-4" /> {submitting ? "Submitting..." : "Resubmit Corrected Report"}
          </button>
        </div>
      )}
    </div>
  );
};

export default EditReport;
