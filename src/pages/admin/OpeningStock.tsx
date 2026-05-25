import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Package, RefreshCw, Save } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { OpeningStockEntry, Product, Shop, UserSession } from "../../types";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

export const OpeningStock: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockEntries, setStockEntries] = useState<OpeningStockEntry[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user || user.role !== "Admin") { navigate("/login"); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [shopRes, prodRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopRes.success && shopRes.shops) {
          const active = shopRes.shops.filter((s) => s.Status === "Active");
          setShops(active);
          if (active[0]) setSelectedShopId(active[0].ShopID);
        }
        if (prodRes.success && prodRes.products) setProducts(prodRes.products.filter((p) => p.Active === "Yes"));
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  useEffect(() => {
    if (!selectedShopId) return;
    const loadStock = async () => {
      try {
        const res = await appsScriptClient.getOpeningStock(selectedShopId, getLocalDateInputValue());
        if (res.success && res.openingStock) setStockEntries(res.openingStock);
      } catch { /* */ }
    };
    loadStock();
  }, [selectedShopId]);

  const updateStock = (productId: string, value: number) => {
    setStockEntries((current) => current.map((entry) =>
      entry.ProductID === productId ? { ...entry, CurrentOpeningStock: value } : entry
    ));
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      // Save each stock entry via API (mock will update localStorage)
      for (const entry of stockEntries) {
        await appsScriptClient.updateOpeningStock({
          shopId: selectedShopId,
          productId: entry.ProductID,
          openingStock: entry.CurrentOpeningStock
        });
      }
      setSuccess("Opening stock saved successfully.");
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
          <p className="text-xs text-muted-foreground">Admin only. Set or edit opening stock for each shop.</p>
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
          {/* Shop selector */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-bold">Select Shop</label>
            <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring">
              {shops.map((s) => <option key={s.ShopID} value={s.ShopID}>{s.ShopName}</option>)}
            </select>
          </div>

          {/* Stock table */}
          {selectedShop && (
            <div className="space-y-4">
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
                            <td className="p-3 text-right text-muted-foreground text-[10px]">{entry.LastUpdatedDate ? new Date(entry.LastUpdatedDate).toLocaleDateString() : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OpeningStock;
