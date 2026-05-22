import React, { useEffect, useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { LiveWeightEntry, Shop } from "../../types";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";

export const LiveWeight: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [rows, setRows] = useState<LiveWeightEntry[]>([]);
  const [shopId, setShopId] = useState("");
  const [date, setDate] = useState(getLocalDateInputValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const [shopResponse, liveResponse] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getLiveWeight()]);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (liveResponse.success) setRows((liveResponse.liveWeight || []) as LiveWeightEntry[]);
      else setError(liveResponse.error || "Failed to load live weight rows.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading live weight rows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = rows.filter((row) => {
    if (shopId && row.ShopID !== shopId) return false;
    if (date && row.Date !== date) return false;
    return true;
  });

  const shopName = (id: string) => shops.find((shop) => shop.ShopID === id)?.ShopName || id;

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <Scale className="h-6 w-6 text-primary" />
            Live Weight
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">LiveWeight tab records for crates, birds, accepted birds, DOA, injuries, and shortage.</p>
        </div>
        <button type="button" onClick={loadRows} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
        <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
          <option value="">All Shops</option>
          {shops.map((shop) => (
            <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold" />
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading live weight records...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No live weight records found for the selected filters.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Shop</th>
                  <th className="p-3 text-right">Crates</th>
                  <th className="p-3 text-right">Total Birds</th>
                  <th className="p-3 text-right">Net Live Weight KG</th>
                  <th className="p-3 text-right">Avg Live Weight KG</th>
                  <th className="p-3 text-right">DOA</th>
                  <th className="p-3 text-right">Injured</th>
                  <th className="p-3 text-right">Shortage</th>
                  <th className="p-3 text-right">Net Accepted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRows.map((row) => (
                  <tr key={row.LiveWeightID} className="hover:bg-secondary/30">
                    <td className="p-3 font-bold">{formatDateForDisplay(row.Date)}</td>
                    <td className="p-3">{row.ShopName || shopName(row.ShopID)}</td>
                    <td className="p-3 text-right">{row.Crates}</td>
                    <td className="p-3 text-right">{row.TotalBirds}</td>
                    <td className="p-3 text-right">{row.NetLiveWeightKG}</td>
                    <td className="p-3 text-right">{row.AvgLiveWeightKG}</td>
                    <td className="p-3 text-right">{row.DOA}</td>
                    <td className="p-3 text-right">{row.InjuredBirds}</td>
                    <td className="p-3 text-right">{row.Shortage}</td>
                    <td className="p-3 text-right font-black">{row.NetAcceptedBirds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveWeight;
