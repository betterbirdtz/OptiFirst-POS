import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ClipboardList, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Product, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface MtnItem {
  productId: string;
  productName: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface SavedMtn {
  id: string;
  mtnNo: string;
  mtnDate: string;
  from: string;
  toShopId: string;
  toShopName: string;
  items: MtnItem[];
  narration: string;
  createdAt: string;
}

export const AdminMTN: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mtnNo, setMtnNo] = useState("");
  const [mtnDate, setMtnDate] = useState(getLocalDateInputValue());
  const [fromLocation, setFromLocation] = useState("Cold Room");
  const [toShopId, setToShopId] = useState("");
  const [narration, setNarration] = useState("");
  const [items, setItems] = useState<MtnItem[]>([]);
  const [savedMtns, setSavedMtns] = useState<SavedMtn[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user || user.role !== "Admin") { navigate("/login"); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [shopRes, prodRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopRes.success && shopRes.shops) { setShops(shopRes.shops.filter((s) => s.Status === "Active")); setToShopId(shopRes.shops[0]?.ShopID || ""); }
        if (prodRes.success && prodRes.products) {
          const active = prodRes.products.filter((p) => p.Active === "Yes");
          setProducts(active);
          setItems(active.map((p) => ({ productId: p.ProductID, productName: p.ProductName, uom: p.UOM, quantity: 0, rate: p.DefaultRate, amount: 0 })));
        }
        loadSavedMtns();
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  const loadSavedMtns = () => {
    try {
      const raw = localStorage.getItem("opti_admin_mtns");
      if (raw) setSavedMtns(JSON.parse(raw));
    } catch { /* */ }
  };

  const updateItem = (index: number, field: "quantity" | "rate", value: number) => {
    setItems((current) => current.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.amount = updated.quantity * updated.rate;
      return updated;
    }));
  };

  const addRow = () => {
    if (!products.length) return;
    setItems((c) => [...c, { productId: products[0].ProductID, productName: products[0].ProductName, uom: products[0].UOM, quantity: 0, rate: products[0].DefaultRate, amount: 0 }]);
  };

  const changeProduct = (index: number, productId: string) => {
    const p = products.find((x) => x.ProductID === productId);
    if (!p) return;
    setItems((current) => current.map((item, i) => i !== index ? item : { ...item, productId: p.ProductID, productName: p.ProductName, uom: p.UOM, rate: p.DefaultRate, amount: item.quantity * p.DefaultRate }));
  };

  const removeRow = (index: number) => setItems((c) => c.filter((_, i) => i !== index));

  const handleSubmit = () => {
    setError(""); setSuccess("");
    if (!mtnNo.trim()) { setError("MTN No. is required."); return; }
    if (!toShopId) { setError("Select destination shop."); return; }
    const filledItems = items.filter((item) => item.quantity > 0);
    if (filledItems.length === 0) { setError("Enter at least one item with quantity."); return; }

    setSubmitting(true);
    const selectedShop = shops.find((s) => s.ShopID === toShopId);
    const mtn: SavedMtn = {
      id: `AMTN-${Date.now()}`,
      mtnNo: mtnNo.trim(),
      mtnDate,
      from: fromLocation,
      toShopId,
      toShopName: selectedShop?.ShopName || "",
      items: filledItems,
      narration,
      createdAt: new Date().toISOString()
    };

    // Save locally and also update employee-visible source items
    const all = [...savedMtns, mtn];
    localStorage.setItem("opti_admin_mtns", JSON.stringify(all));
    setSavedMtns(all);

    // Also save to employee MTN source (so employee sees what admin sent)
    try {
      const empMtns = JSON.parse(localStorage.getItem("opti_mtn_source") || "[]");
      empMtns.push({ mtnNo: mtn.mtnNo, mtnDate: mtn.mtnDate, from: mtn.from, toShopId: mtn.toShopId, toShopName: mtn.toShopName, items: filledItems.map((item) => ({ itemName: item.productName, location: mtn.from, quantity: item.quantity, rate: item.rate, amount: item.amount })) });
      localStorage.setItem("opti_mtn_source", JSON.stringify(empMtns));
    } catch { /* */ }

    setSuccess(`MTN ${mtn.mtnNo} sent to ${mtn.toShopName} successfully.`);
    setMtnNo("");
    setNarration("");
    setItems(products.map((p) => ({ productId: p.ProductID, productName: p.ProductName, uom: p.UOM, quantity: 0, rate: p.DefaultRate, amount: 0 })));
    setSubmitting(false);
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Internal Stock Movement</h1>
          <p className="text-xs text-muted-foreground">Send stock from HO/Cold Room to shops. Employee will confirm receipt.</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* MTN Header */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">MTN No. *</label>
                <input value={mtnNo} onChange={(e) => setMtnNo(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Opti/MTN/00208" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Date</label>
                <input type="date" value={mtnDate} onChange={(e) => setMtnDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">From</label>
                <input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Cold Room" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">To (Shop) *</label>
                <select value={toShopId} onChange={(e) => setToShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring">
                  {shops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-sm font-black">Items to Send</h2>
              <button type="button" onClick={addRow} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"><Plus className="h-3 w-3" /> Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 font-bold">Product</th>
                    <th className="p-3 font-bold">UOM</th>
                    <th className="p-3 font-bold text-right w-24">Quantity</th>
                    <th className="p-3 font-bold text-right w-24">Rate</th>
                    <th className="p-3 font-bold text-right w-28">Amount</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2">
                        <select value={item.productId} onChange={(e) => changeProduct(i, e.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-semibold outline-none">
                          {products.map((p) => <option key={p.ProductID} value={p.ProductID}>{p.ProductName}</option>)}
                        </select>
                      </td>
                      <td className="p-3 text-xs">{item.uom}</td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.quantity || ""} onChange={(e) => updateItem(i, "quantity", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" placeholder="0" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" /></td>
                      <td className="p-3 text-right font-black text-xs">{item.amount > 0 ? formatCurrency(item.amount) : "-"}</td>
                      <td className="p-2"><button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Narration & Submit */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Narration</label>
              <textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Stock transfer note" className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" /> {submitting ? "Sending..." : "Send to Shop"}
            </button>
          </section>

          {/* Sent MTNs */}
          {savedMtns.length > 0 && (
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border p-4"><h2 className="text-sm font-black">Sent Vouchers ({savedMtns.length})</h2></div>
              <div className="divide-y divide-border/60">
                {savedMtns.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((mtn) => (
                  <div key={mtn.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{mtn.mtnNo}</p>
                      <p className="text-xs text-muted-foreground">{mtn.mtnDate}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{mtn.from} → {mtn.toShopName} · {mtn.items.length} items · {formatCurrency(mtn.items.reduce((s, i) => s + i.amount, 0))}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminMTN;
