import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, RefreshCw, Save, Store } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Product, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { getSessionUser } from "../../utils/session";

interface ShopPrice {
  shopId: string;
  productId: string;
  rate: number;
}

export const ShopPricing: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopPrices, setShopPrices] = useState<ShopPrice[]>([]);
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
        const [shopRes, prodRes, priceRes] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts(), appsScriptClient.getShopPrices()]);
        if (shopRes.success && shopRes.shops) {
          const active = shopRes.shops.filter((s) => s.Status === "Active");
          setShops(active);
          setSelectedShopId(active[0]?.ShopID || "");
        }
        if (prodRes.success && prodRes.products) setProducts(prodRes.products.filter((p) => p.Active === "Yes"));
        if (priceRes.success && priceRes.prices) {
          setShopPrices(priceRes.prices.map((price) => ({
            shopId: price.ShopID,
            productId: price.ProductID,
            rate: Number(price.Rate || 0)
          })));
        }
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    };
    load();
  }, [navigate, user]);

  const getShopRate = (productId: string) => {
    const sp = shopPrices.find((p) => p.shopId === selectedShopId && p.productId === productId);
    return sp?.rate;
  };

  const updateRate = (productId: string, rate?: number) => {
    setShopPrices((current) => {
      const idx = current.findIndex((p) => p.shopId === selectedShopId && p.productId === productId);
      if (rate === undefined) return current.filter((p) => !(p.shopId === selectedShopId && p.productId === productId));
      if (idx >= 0) {
        const next = [...current];
        next[idx] = { ...next[idx], rate };
        return next;
      }
      return [...current, { shopId: selectedShopId, productId, rate }];
    });
  };

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const prices = shopPrices
        .filter((price) => price.shopId === selectedShopId)
        .map((price) => ({ productId: price.productId, rate: price.rate }));
      const response = await appsScriptClient.saveShopPrices(selectedShopId, prices);
      if (response.success) setSuccess("Shop prices saved to Google Sheet.");
      else setError(response.error || "Failed to save shop prices.");
    } catch { setError("Failed to save shop prices."); }
    finally { setSaving(false); }
  };

  const selectedShop = shops.find((s) => s.ShopID === selectedShopId);

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2"><Store className="h-5 w-5 text-primary" />Shop Pricing</h1>
          <p className="text-xs text-muted-foreground">Set different product rates per shop. Leave blank to use default rate.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <Save className="h-4 w-4" /> Save All
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5" />{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{success}</div>}

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

          {/* Pricing table */}
          {selectedShop && (
            <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-secondary/50 p-4">
                <h2 className="text-sm font-black">Rates for {selectedShop.ShopName}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3 font-bold">Product</th>
                      <th className="p-3 font-bold">Category</th>
                      <th className="p-3 font-bold">UOM</th>
                      <th className="p-3 font-bold text-right">Default Rate</th>
                      <th className="p-3 font-bold text-right w-36">Shop Rate</th>
                      <th className="p-3 font-bold text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {products.map((prod) => {
                      const shopRate = getShopRate(prod.ProductID);
                      const diff = shopRate !== undefined ? shopRate - prod.DefaultRate : 0;
                      return (
                        <tr key={prod.ProductID} className="hover:bg-secondary/20">
                          <td className="p-3 font-bold">{prod.ProductName}</td>
                          <td className="p-3 text-muted-foreground">{prod.Category}</td>
                          <td className="p-3">{prod.UOM}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(prod.DefaultRate)}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={shopRate ?? ""}
                              onChange={(e) => updateRate(prod.ProductID, e.target.value === "" ? undefined : Number(e.target.value))}
                              placeholder={String(prod.DefaultRate)}
                              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-ring"
                            />
                          </td>
                          <td className={`p-3 text-right font-black ${diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-green-700" : "text-red-700"}`}>
                            {shopRate === undefined ? "-" : diff === 0 ? "Same" : `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShopPricing;
