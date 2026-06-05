import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Package, RefreshCw, Save } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { OpeningStockEntry, Shop, UserSession } from "../../types";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface StockTransferLog {
  mtnNo: string;
  mtnDate: string;
  from: string;
  toShopName: string;
  items: Array<{ productName: string; quantity: number }>;
}

export const OpeningStock: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [stockEntries, setStockEntries] = useState<OpeningStockEntry[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [stockDate, setStockDate] = useState(getLocalDateInputValue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transferLogs, setTransferLogs] = useState<StockTransferLog[]>([]);

  useEffect(() => {
    if (!user || user.role !== "Admin") { navigate("/login"); return; }
    const load = async () => {
      setLoading(true);
      try {
        await appsScriptClient.setupSheets();
        const shopRes = await appsScriptClient.getShops();
        if (shopRes.success && shopRes.shops) {
          const active = shopRes.shops.filter((s) => s.Status === "Active");
          setShops(active);
          if (active[0]) setSelectedShopId(active[0].ShopID);
        }
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  useEffect(() => {
    if (!selectedShopId) return;
    loadStock();
    loadTransferLogs();
  }, [selectedShopId, stockDate]);

  const loadStock = async () => {
    try {
      const res = await appsScriptClient.getOpeningStock(selectedShopId, stockDate);
      if (res.success && res.openingStock) {
        setStockEntries(res.openingStock);
      } else {
        setError(res.error || "Failed to load opening stock.");
      }
    } catch {
      setError("Failed to load opening stock.");
    }
  };

  const loadTransferLogs = async () => {
    try {
      const res = await appsScriptClient.getMTNsForShop(selectedShopId);
      if (!res.success || !res.mtns) {
        setTransferLogs([]);
        return;
      }
      const grouped = new Map<string, StockTransferLog>();
      res.mtns.forEach((mtn) => {
        const key = mtn.MTNNo;
        const existing = grouped.get(key) || {
          mtnNo: mtn.MTNNo,
          mtnDate: String(mtn.MTNDate).split("T")[0],
          from: mtn.From,
          toShopName: mtn.ToShopName,
          items: []
        };
        existing.items.push({ productName: mtn.ProductName, quantity: Number(mtn.QtyAsPerMTN || 0) });
        grouped.set(key, existing);
      });
      setTransferLogs(Array.from(grouped.values()).sort((a, b) => b.mtnDate.localeCompare(a.mtnDate)));
    } catch { setTransferLogs([]); }
  };

  const updateStock = (productId: string, value: number) => {
    setStockEntries((current) => current.map((entry) =>
      entry.ProductID === productId ? { ...entry, CurrentOpeningStock: value } : entry
    ));
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      for (const entry of stockEntries) {
        const response = await appsScriptClient.updateOpeningStock({
          shopId: selectedShopId,
          productId: entry.ProductID,
          openingStock: entry.CurrentOpeningStock
        });
        if (!response.success) {
          setError(response.error || `Failed to save opening stock for ${entry.ProductName}.`);
          return;
        }
      }
      const refreshed = await appsScriptClient.getOpeningStock(selectedShopId, stockDate);
      if (!refreshed.success || !refreshed.openingStock) {
        setError(refreshed.error || "Opening stock saved, but reload failed.");
        return;
      }
      setStockEntries(refreshed.openingStock);
      setSuccess("Opening stock saved to Google Sheet.");
    } catch { setError("Failed to save opening stock."); }
    finally { setSaving(false); }
  };

  const selectedShop = shops.find((s) => s.ShopID === selectedShopId);
  const groupedByCategory = stockEntries.reduce<Record<string, OpeningStockEntry[]>>((groups, entry) => {
    const cat = entry.Category || "General";
    groups[cat] = groups[cat] || [];
    groups[cat].push(entry);
    return groups;
  }, {});

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Opening Stock</h1>
          <p className="text-xs text-muted-foreground">Admin only. View and update opening stock per shop. Auto-updates when stock is transferred.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800"><CheckCircle2 className="h-5 w-5" />{success}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Shop & Date selector */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold">Select Shop</label>
              <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring">
                {shops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold">Date (adjust opening stock for any day)</label>
              <input type="date" value={stockDate} onChange={(e) => setStockDate(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          {/* Current Opening Stock */}
          {selectedShop && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-sm font-black">Current Opening Stock — {selectedShop.ShopName}</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">Date: {formatDateForDisplay(stockDate)}</p>
              </div>

              {Object.entries(groupedByCategory).map(([category, entries]) => (
                <section key={category} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border bg-secondary/50 px-4 py-3">
                    <h3 className="text-xs font-black uppercase text-muted-foreground">{category}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                        <tr>
                          <th className="p-3 font-bold">Product</th>
                          <th className="p-3 font-bold">UOM</th>
                          <th className="p-3 font-bold text-right w-36">Opening Stock</th>
                          <th className="p-3 font-bold text-right">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {entries.map((entry) => (
                          <tr key={entry.ProductID} className="hover:bg-secondary/20">
                            <td className="p-3 font-bold">{entry.ProductName}</td>
                            <td className="p-3 text-muted-foreground">{entry.UOM}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entry.CurrentOpeningStock || ""}
                                onChange={(e) => updateStock(entry.ProductID, Number(e.target.value || 0))}
                                className="w-full rounded-lg border border-primary/40 bg-background px-3 py-2.5 text-sm font-black text-right outline-none focus:ring-2 focus:ring-primary"
                                placeholder="0"
                              />
                            </td>
                            <td className="p-3 text-right text-muted-foreground text-[10px]">{entry.LastUpdatedDate ? formatDateForDisplay(entry.LastUpdatedDate) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Stock Transfer History for this shop */}
          {transferLogs.length > 0 && (
            <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-secondary/50 px-4 py-3">
                <h2 className="text-sm font-black">Stock Transfers to {selectedShop?.ShopName}</h2>
                <p className="text-[10px] text-muted-foreground">These transfers update opening stock when received by employee.</p>
              </div>
              <div className="divide-y divide-border/60">
                {transferLogs.map((log, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{log.mtnNo}</p>
                      <p className="text-xs text-muted-foreground">{formatDateForDisplay(log.mtnDate)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.from} → {log.toShopName}</p>
                    <div className="flex flex-wrap gap-2">
                      {log.items.filter((item) => item.quantity > 0).map((item, j) => (
                        <span key={j} className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-[10px] font-bold">
                          {item.productName}: {item.quantity}
                        </span>
                      ))}
                    </div>
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

export default OpeningStock;
