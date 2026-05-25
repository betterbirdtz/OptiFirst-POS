import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Plus, Send, Trash2 } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Product, Shop, UserSession } from "../../types";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface VoucherItem {
  itemName: string;
  location: string;
  quantity: number;
  rate: number;
  amount: number;
}

export const MaterialTransferNote: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mtnNo, setMtnNo] = useState("");
  const [mtnDate, setMtnDate] = useState(getLocalDateInputValue());
  const [sourceLocation, setSourceLocation] = useState("Cold Room");
  const [destinationShopId, setDestinationShopId] = useState("");
  const [narration, setNarration] = useState("");

  const [sourceItems, setSourceItems] = useState<VoucherItem[]>([
    { itemName: "", location: "", quantity: 0, rate: 0, amount: 0 }
  ]);
  const [destItems, setDestItems] = useState<VoucherItem[]>([
    { itemName: "", location: "", quantity: 0, rate: 0, amount: 0 }
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [complaintNote, setComplaintNote] = useState("");
  const [myMtns, setMyMtns] = useState<Array<{ id: string; mtnNo: string; mtnDate: string; from: string; to: string; items: VoucherItem[]; complaintNote: string; submittedAt: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeShops = shops.filter((s) => s.Status === "Active");
  const allowedShops = user?.shopId ? activeShops.filter((s) => s.ShopID === user.shopId) : activeShops;
  const selectedShop = shops.find((s) => s.ShopID === destinationShopId);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [shopRes, prodRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopRes.success && shopRes.shops) {
          setShops(shopRes.shops);
          setDestinationShopId(user.shopId || shopRes.shops.find((s) => s.Status === "Active")?.ShopID || "");
        }
        if (prodRes.success && prodRes.products) {
          const active = prodRes.products.filter((p) => p.Active === "Yes");
          setProducts(active);
          setSourceItems(active.map((p) => ({ itemName: p.ProductName, location: "Cold Room", quantity: 0, rate: p.DefaultRate, amount: 0 })));
          setDestItems(active.map((p) => ({ itemName: p.ProductName, location: "", quantity: 0, rate: p.DefaultRate, amount: 0 })));
        }
        // Load saved MTNs
        loadMyMtns();
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  // Update destination location when shop changes
  useEffect(() => {
    if (selectedShop) {
      setDestItems((current) => current.map((item) => ({ ...item, location: selectedShop.ShopName })));
    }
  }, [selectedShop]);

  // Calculate mismatches between source and destination
  const mismatchItems = destItems
    .filter((dest) => dest.itemName && dest.quantity > 0)
    .map((dest) => {
      const source = sourceItems.find((s) => s.itemName === dest.itemName);
      const sent = source?.quantity || 0;
      const received = dest.quantity;
      return { itemName: dest.itemName, sent, received, diff: received - sent };
    })
    .filter((m) => m.diff !== 0 && m.sent > 0);

  const updateItem = (section: "source" | "dest", index: number, field: keyof VoucherItem, value: string | number) => {
    const setter = section === "source" ? setSourceItems : setDestItems;
    setter((current) => current.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "rate") {
        updated.amount = Number(updated.quantity) * Number(updated.rate);
      }
      return updated;
    }));
  };

  const addRow = (section: "dest") => {
    const newItem: VoucherItem = { itemName: "", location: selectedShop?.ShopName || "", quantity: 0, rate: 0, amount: 0 };
    setDestItems((c) => [...c, newItem]);
  };

  const removeRow = (section: "dest", index: number) => {
    setDestItems((current) => current.filter((_, i) => i !== index));
  };

  const loadMyMtns = () => {
    try {
      const raw = localStorage.getItem("opti_mtns");
      if (raw) {
        const all = JSON.parse(raw) as typeof myMtns;
        setMyMtns(all.filter((m) => m.items && (!user || true)));
      }
    } catch { /* ignore */ }
  };

  const saveMtnLocally = (mtn: typeof myMtns[0]) => {
    const raw = localStorage.getItem("opti_mtns");
    const all = raw ? JSON.parse(raw) as typeof myMtns : [];
    const existingIdx = all.findIndex((m) => m.id === mtn.id);
    if (existingIdx >= 0) all[existingIdx] = mtn;
    else all.push(mtn);
    localStorage.setItem("opti_mtns", JSON.stringify(all));
    setMyMtns(all);
  };

  const canEdit = (mtn: typeof myMtns[0]) => {
    return mtn.mtnDate === getLocalDateInputValue();
  };

  const startEdit = (mtn: typeof myMtns[0]) => {
    setEditingId(mtn.id);
    setMtnNo(mtn.mtnNo);
    setMtnDate(mtn.mtnDate);
    setSourceLocation(mtn.from);
    setComplaintNote(mtn.complaintNote || "");
    setDestItems(mtn.items);
  };

  const submitMTN = async () => {
    if (!user || !selectedShop) return;
    if (!mtnNo.trim()) { setError("MTN No. is required."); return; }
    if (!mtnDate) { setError("Date is required."); return; }

    const filledSource = sourceItems.filter((item) => item.itemName && item.quantity > 0);
    const filledDest = destItems.filter((item) => item.itemName && item.quantity > 0);
    if (filledSource.length === 0 && filledDest.length === 0) { setError("Enter at least one item."); return; }
    if (mismatchItems.length > 0 && !complaintNote.trim()) { setError("Complaint/reason is required when there is a stock shortage."); return; }

    setSubmitting(true); setError("");
    try {
      const res = await appsScriptClient.submitMTN({
        mtnNo: mtnNo.trim(),
        mtnDate,
        from: sourceLocation,
        to: selectedShop.ShopName,
        shopId: selectedShop.ShopID,
        shopName: selectedShop.ShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        items: filledDest.map((item) => ({
          productId: products.find((p) => p.ProductName === item.itemName)?.ProductID || "",
          productName: item.itemName,
          category: products.find((p) => p.ProductName === item.itemName)?.Category || "",
          uom: products.find((p) => p.ProductName === item.itemName)?.UOM || "",
          qtyAsPerMTN: sourceItems.find((s) => s.itemName === item.itemName)?.quantity || 0,
          qtyReceived: item.quantity,
          variance: item.quantity - (sourceItems.find((s) => s.itemName === item.itemName)?.quantity || 0)
        }))
      });
      if (res.success) {
        const savedMtn = {
          id: editingId || res.reportId || `MTN-${Date.now()}`,
          mtnNo: mtnNo.trim(),
          mtnDate,
          from: sourceLocation,
          to: selectedShop.ShopName,
          items: filledDest.map((item) => ({ ...item })),
          complaintNote,
          submittedAt: new Date().toISOString()
        };
        saveMtnLocally(savedMtn);
        setEditingId(null);
        setSuccess(true);
      }
      else { setError(res.error || "Submission failed."); }
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-sm space-y-6 px-4 py-16 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-10 w-10" /></div>
        <h2 className="text-2xl font-black">Voucher Submitted</h2>
        <p className="text-sm text-muted-foreground">Internal Stock Movement Voucher recorded.</p>
        <button onClick={() => navigate("/employee/dashboard")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-4xl sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">Internal Stock Movement Voucher</h1>
          <p className="text-xs text-muted-foreground">OPTIFIRST TZ LIMITED</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span>{error}</span></div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-5">
          {/* Voucher Header */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">No.</label>
                <input value={mtnNo} onChange={(e) => setMtnNo(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Opti/MTN/00207" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Dated</label>
                <input type="date" value={mtnDate} max={getLocalDateInputValue()} onChange={(e) => setMtnDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Source Location</label>
                <input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" placeholder="Cold Room" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Destination (Shop)</label>
                <select value={destinationShopId} disabled={Boolean(user?.shopId)} onChange={(e) => setDestinationShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring disabled:opacity-70">
                  {allowedShops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Source (Consumption) - Read Only (Admin enters this) */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-sm font-black">Source (Consumption)</h2>
              <p className="text-[10px] text-muted-foreground">Entered by Admin / Head Office. Read-only for employees.</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 font-bold">Item Name</th>
                    <th className="p-2 font-bold">Location / Batch/Lot</th>
                    <th className="p-2 font-bold text-right w-20">Quantity</th>
                    <th className="p-2 font-bold text-right w-20">Rate</th>
                    <th className="p-2 font-bold text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sourceItems.map((item, i) => (
                    <tr key={i} className="bg-secondary/20">
                      <td className="p-2 font-semibold">{item.itemName || "-"}</td>
                      <td className="p-2 text-muted-foreground">{item.location || "-"}</td>
                      <td className="p-2 text-right font-bold">{item.quantity || "-"}</td>
                      <td className="p-2 text-right font-bold">{item.rate || "-"}</td>
                      <td className="p-2 text-right font-black">{item.amount > 0 ? item.amount.toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                  {sourceItems.filter((item) => item.quantity > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">No source items entered by admin yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Destination (Production) - Employee fills received qty */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-black">Destination (Production)</h2>
                <p className="text-[10px] text-muted-foreground">Enter quantity actually received at shop.</p>
              </div>
              <button type="button" onClick={() => addRow("dest")} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold active:bg-secondary"><Plus className="h-3 w-3" />Row</button>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {destItems.map((item, i) => (
                <div key={i} className="rounded-xl border border-border bg-secondary/10 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <select value={item.itemName} onChange={(e) => updateItem("dest", i, "itemName", e.target.value)} className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Select Product</option>
                      {products.map((p) => <option key={p.ProductID} value={p.ProductName}>{p.ProductName}</option>)}
                    </select>
                    <button type="button" onClick={() => removeRow("dest", i)} className="rounded-lg p-2.5 text-muted-foreground active:bg-destructive/10 active:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-muted-foreground">QTY</label>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={item.quantity || ""} onChange={(e) => updateItem("dest", i, "quantity", Number(e.target.value || 0))} className="w-full rounded-lg border border-primary/40 bg-background px-3 py-3 text-base font-black text-center outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-muted-foreground">RATE</label>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={item.rate || ""} onChange={(e) => updateItem("dest", i, "rate", Number(e.target.value || 0))} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold text-center outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-muted-foreground">AMOUNT</label>
                      <div className="flex items-center justify-center rounded-lg border border-border bg-secondary/30 px-3 py-3 text-base font-black text-primary">
                        {item.amount > 0 ? item.amount.toLocaleString() : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 font-bold">Item Name</th>
                    <th className="p-2 font-bold">Location</th>
                    <th className="p-2 font-bold text-right w-20">Quantity</th>
                    <th className="p-2 font-bold text-right w-20">Rate</th>
                    <th className="p-2 font-bold text-right w-24">Amount</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {destItems.map((item, i) => (
                    <tr key={i}>
                      <td className="p-1.5">
                        <select value={item.itemName} onChange={(e) => updateItem("dest", i, "itemName", e.target.value)} className="w-full rounded border border-input bg-background px-1.5 py-2 text-xs font-semibold outline-none">
                          <option value="">Select</option>
                          {products.map((p) => <option key={p.ProductID} value={p.ProductName}>{p.ProductName}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input value={item.location} onChange={(e) => updateItem("dest", i, "location", e.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-semibold outline-none" placeholder={selectedShop?.ShopName || "Shop"} />
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" step="0.01" inputMode="decimal" value={item.quantity || ""} onChange={(e) => updateItem("dest", i, "quantity", Number(e.target.value || 0))} className="w-full rounded border border-primary/40 bg-background px-2 py-2 text-xs font-black text-right outline-none" placeholder="0" />
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" step="0.01" inputMode="decimal" value={item.rate || ""} onChange={(e) => updateItem("dest", i, "rate", Number(e.target.value || 0))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none" placeholder="0" />
                      </td>
                      <td className="p-2 text-right text-xs font-black">{item.amount > 0 ? item.amount.toLocaleString() : "-"}</td>
                      <td className="p-1"><button type="button" onClick={() => removeRow("dest", i)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Variance / Mismatch Section */}
          {mismatchItems.length > 0 && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-black text-red-800">⚠ Stock Mismatch ({mismatchItems.length} items)</h2>
              <div className="overflow-x-auto rounded-lg border border-red-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-100 text-red-800">
                    <tr>
                      <th className="p-2 font-bold">Item</th>
                      <th className="p-2 font-bold text-right">Sent (Source)</th>
                      <th className="p-2 font-bold text-right">Received</th>
                      <th className="p-2 font-bold text-right">Shortage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-200 bg-white">
                    {mismatchItems.map((m, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{m.itemName}</td>
                        <td className="p-2 text-right font-bold">{m.sent}</td>
                        <td className="p-2 text-right font-bold">{m.received}</td>
                        <td className={`p-2 text-right font-black ${m.diff < 0 ? "text-red-700" : "text-green-700"}`}>{m.diff > 0 ? "+" : ""}{m.diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-red-800">Complaint / Reason for Shortage *</label>
                <textarea
                  value={complaintNote}
                  onChange={(e) => setComplaintNote(e.target.value)}
                  placeholder="Describe the shortage issue. E.g. Less stock received from Cold Room, items damaged in transit, etc."
                  className="min-h-24 w-full rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </section>
          )}

          {/* Narration */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">Narration</label>
            <textarea value={narration} onChange={(e) => setNarration(e.target.value)} placeholder={`${selectedShop?.ShopName || "Shop"} stock ${mtnDate}`} className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring" />
          </section>


          {/* My Submitted MTNs */}
          {myMtns.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-black">My Submitted Vouchers</h2>
              <div className="space-y-2">
                {myMtns.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((mtn) => (
                  <div key={mtn.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                    <div>
                      <p className="text-sm font-bold">{mtn.mtnNo}</p>
                      <p className="text-xs text-muted-foreground">{mtn.mtnDate} · {mtn.from} → {mtn.to} · {mtn.items.filter((item) => item.quantity > 0).length} items</p>
                      {mtn.complaintNote && <p className="mt-1 text-xs text-red-700 font-semibold">⚠ {mtn.complaintNote.slice(0, 60)}{mtn.complaintNote.length > 60 ? "..." : ""}</p>}
                    </div>
                    {canEdit(mtn) ? (
                      <button type="button" onClick={() => startEdit(mtn)} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20">
                        Edit
                      </button>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate("/employee/dashboard")} className="flex-1 rounded-lg border border-border py-3 text-sm font-bold hover:bg-secondary">Cancel</button>
            <button type="button" onClick={submitMTN} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />{submitting ? "Submitting..." : "Submit Voucher"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialTransferNote;
