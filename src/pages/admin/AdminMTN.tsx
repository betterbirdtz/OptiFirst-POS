import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ClipboardList, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Product, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface MtnItem {
  productId: string;
  productName: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
  available?: number;
}

interface SentMtnRow {
  MTNID: string;
  MTNNo: string;
  MTNDate: string;
  From: string;
  ToShopID: string;
  ToShopName: string;
  EmployeeName: string;
  ProductName: string;
  QtyAsPerMTN: number;
  QtyReceived: number;
  Variance: number;
  Status: string;
  Complaint: string;
}

export const AdminMTN: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mtnNo, setMtnNo] = useState("");
  const [mtnDate, setMtnDate] = useState(getLocalDateInputValue());
  const [fromLocation, setFromLocation] = useState("HO / Cold Room");
  const [toShopId, setToShopId] = useState("");
  const [items, setItems] = useState<MtnItem[]>([]);
  const [sentMtns, setSentMtns] = useState<SentMtnRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || user.role !== "Admin") { navigate("/login"); return; }
    const load = async () => {
      setLoading(true);
      try {
        await appsScriptClient.setupSheets();
        const [shopRes, prodRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopRes.success && shopRes.shops) {
          const active = shopRes.shops.filter((s) => s.Status === "Active");
          setShops(active);
          setToShopId(active[0]?.ShopID || "");
        }
        if (prodRes.success && prodRes.products) {
          const active = prodRes.products.filter((p) => p.Active === "Yes");
          setProducts(active);
          setItems(active.map((p) => ({ productId: p.ProductID, productName: p.ProductName, uom: p.UOM, quantity: 0, rate: p.DefaultRate, amount: 0 })));
        }
        loadSentMtns();
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  // Load stock for source shop
  useEffect(() => {
    const sourceShop = shops.find((s) => s.ShopName === fromLocation);
    if (!sourceShop) { setStockMap({}); return; }
    appsScriptClient.getOpeningStock(sourceShop.ShopID, getLocalDateInputValue()).then((res) => {
      if (res.success && res.openingStock) {
        const map: Record<string, number> = {};
        res.openingStock.forEach((s: any) => { map[s.ProductID] = s.CurrentOpeningStock || 0; });
        setStockMap(map);
      }
    }).catch(() => {});
  }, [fromLocation, shops]);

  const loadSentMtns = async () => {
    // Load all MTNs from all shops to show admin what was sent
    try {
      const res = await appsScriptClient.getMTNsForShop("");
      if (res.success && res.mtns) {
        setSentMtns(res.mtns);
      }
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

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!mtnNo.trim()) { setError("MTN No. is required."); return; }
    if (!toShopId) { setError("Select destination shop."); return; }
    const filledItems = items.filter((item) => item.quantity > 0);
    if (filledItems.length === 0) { setError("Enter at least one item with quantity."); return; }

    setSubmitting(true);
    const selectedShop = shops.find((s) => s.ShopID === toShopId);
    const toName = toShopId === "HO" ? "HO / Cold Room" : selectedShop?.ShopName || "";
    try {
      const res = await appsScriptClient.submitMTN({
        mtnNo: mtnNo.trim(),
        mtnDate,
        from: fromLocation,
        to: toName,
        shopId: toShopId === "COLD_ROOM" || toShopId === "HO" ? "" : toShopId,
        shopName: toName,
        employeeId: "",
        employeeName: "Admin",
        items: filledItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          category: "",
          uom: item.uom,
          qtyAsPerMTN: item.quantity,
          qtyReceived: 0,
          variance: 0
        }))
      });

      if (res.success) {
        setSuccess(`MTN ${mtnNo.trim()} sent: ${fromLocation} → ${toName}. Saved to Google Sheet.`);
        setMtnNo("");
        setItems(products.map((p) => ({ productId: p.ProductID, productName: p.ProductName, uom: p.UOM, quantity: 0, rate: p.DefaultRate, amount: 0 })));
        loadSentMtns();
      } else {
        setError(res.error || "Failed to save.");
      }
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  // Group sent MTNs by MTNNo for display
  const groupedSent = Array.from(new Set(sentMtns.map((m) => m.MTNNo))).map((mtnNo) => {
    const rows = sentMtns.filter((m) => m.MTNNo === mtnNo);
    const first = rows[0];
    const allReceived = rows.length > 0 && rows.every((r) => String(r.Status || "").toLowerCase() === "received");
    return { mtnNo, mtnDate: first?.MTNDate || "", from: first?.From || "", toShopName: first?.ToShopName || "", items: rows, allReceived };
  });

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />Stock Transfer (MTN)</h1>
          <p className="text-xs text-muted-foreground">Send stock to shops. All data saved to Google Sheet.</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">MTN No. *</label><input value={mtnNo} onChange={(e) => setMtnNo(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Opti/MTN/00208" /></div>
              <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">Date</label><input type="date" value={mtnDate} onChange={(e) => setMtnDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" /></div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">From *</label>
                <select value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring">
                  <option value="HO / Cold Room">HO / Cold Room</option>
                  {shops.map((s) => <option key={s.ShopID} value={s.ShopName}>{s.ShopName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">To *</label>
                <select value={toShopId} onChange={(e) => setToShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring">
                  <option value="HO">HO / Cold Room</option>
                  {shops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-sm font-black">Items to Send</h2>
              <button type="button" onClick={addRow} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"><Plus className="h-3 w-3" /> Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr><th className="p-3 font-bold">Product</th><th className="p-3 font-bold">UOM</th><th className="p-3 font-bold text-right w-20">Stock</th><th className="p-3 font-bold text-right w-24">Qty</th><th className="p-3 font-bold text-right w-24">Rate</th><th className="p-3 font-bold text-right w-28">Amount</th><th className="p-3 w-10"></th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item, i) => {
                    const avail = stockMap[item.productId];
                    return (
                    <tr key={i}>
                      <td className="p-2"><select value={item.productId} onChange={(e) => changeProduct(i, e.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-semibold outline-none">{products.map((p) => <option key={p.ProductID} value={p.ProductID}>{p.ProductName}</option>)}</select></td>
                      <td className="p-3 text-xs">{item.uom}</td>
                      <td className="p-3 text-right text-xs font-bold">{avail !== undefined ? <span className={avail > 0 ? "text-green-700" : "text-muted-foreground"}>{avail}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.quantity || ""} onChange={(e) => updateItem(i, "quantity", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" placeholder="0" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.rate || ""} onChange={(e) => updateItem(i, "rate", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" /></td>
                      <td className="p-3 text-right font-black text-xs">{item.amount > 0 ? formatCurrency(item.amount) : "-"}</td>
                      <td className="p-2"><button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
            <Send className="h-4 w-4" /> {submitting ? "Sending..." : "Send to Shop"}
          </button>

          {groupedSent.length > 0 && (
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border p-4"><h2 className="text-sm font-black">MTN History ({groupedSent.length} vouchers)</h2></div>
              <div className="divide-y divide-border/60">
                {groupedSent.sort((a, b) => b.mtnDate.localeCompare(a.mtnDate)).map((mtn) => {
                  const hasMismatch = mtn.items.some((r) => Number(r.QtyReceived) > 0 && Number(r.Variance) !== 0);
                  const complaint = mtn.items.find((r) => r.Complaint)?.Complaint || "";
                  return (
                    <div key={mtn.mtnNo} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black">{mtn.mtnNo}</p>
                          <p className="text-xs text-muted-foreground">{mtn.from} → {mtn.toShopName} · {formatDateForDisplay(mtn.mtnDate)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasMismatch && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">Mismatch</span>}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${mtn.allReceived ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{mtn.allReceived ? "Received" : "Pending"}</span>
                        </div>
                      </div>

                      {/* Items detail table */}
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-secondary/50 text-muted-foreground">
                            <tr>
                              <th className="p-2 font-bold">Product</th>
                              <th className="p-2 font-bold text-right">Sent</th>
                              <th className="p-2 font-bold text-right">Received</th>
                              <th className="p-2 font-bold text-right">Variance</th>
                              <th className="p-2 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {mtn.items.map((row, j) => (
                              <tr key={j}>
                                <td className="p-2 font-semibold">{row.ProductName}</td>
                                <td className="p-2 text-right font-bold">{Number(row.QtyAsPerMTN)}</td>
                                <td className="p-2 text-right font-bold">{Number(row.QtyReceived) || "-"}</td>
                                <td className={`p-2 text-right font-black ${Number(row.Variance) === 0 ? "text-green-700" : Number(row.Variance) < 0 ? "text-red-700" : "text-amber-700"}`}>
                                  {Number(row.QtyReceived) > 0 ? (Number(row.Variance) === 0 ? "✓" : `${Number(row.Variance) > 0 ? "+" : ""}${Number(row.Variance)}`) : "-"}
                                </td>
                                <td className="p-2">
                                  <span className={`text-[10px] font-bold ${String(row.Status).toLowerCase() === "received" ? "text-green-700" : "text-amber-700"}`}>{row.Status || "Sent"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Complaint/Reason if any */}
                      {complaint && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-bold text-red-800">⚠ Employee Note:</p>
                          <p className="text-xs text-red-700 mt-0.5">{complaint}</p>
                        </div>
                      )}

                      {/* Received by */}
                      {mtn.allReceived && mtn.items[0]?.EmployeeName && (
                        <p className="text-[10px] text-muted-foreground">Received by: {mtn.items[0].EmployeeName}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminMTN;
