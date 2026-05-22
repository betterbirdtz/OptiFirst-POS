import React, { useEffect, useState } from "react";
import { Building2, Edit, Plus, RefreshCw } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import Modal from "../../components/common/Modal";
import type { Shop } from "../../types";

const blankForm = {
  shopName: "",
  location: "",
  inchargeName: "",
  inchargeContact: "",
  status: "Active"
};

export const Shops: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [form, setForm] = useState(blankForm);

  const loadShops = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getShops();
      if (response.success && response.shops) setShops(response.shops);
      else setError(response.error || "Failed to load shops.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading shops.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setOpen(true);
  };

  const openEdit = (shop: Shop) => {
    setEditing(shop);
    setForm({
      shopName: shop.ShopName,
      location: shop.Location,
      inchargeName: shop.InchargeName,
      inchargeContact: shop.InchargeContact,
      status: shop.Status
    });
    setOpen(true);
  };

  const saveShop = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = editing
        ? await appsScriptClient.updateShop({ shopId: editing.ShopID, ...form })
        : await appsScriptClient.createShop(form);
      if (response.success) {
        setOpen(false);
        await loadShops();
      } else {
        setError(response.error || "Shop save failed.");
      }
    } catch (saveError) {
      console.error(saveError);
      setError("Network error saving shop.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <Building2 className="h-6 w-6 text-primary" />
            Shops
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Simple branch setup for Kisutu, Kigamboni, Utumbo, and future shops.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadShops} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
            <Plus className="h-4 w-4" />
            Add Shop
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading shops...</div>
      ) : shops.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No shops have been created yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => (
            <div key={shop.ShopID} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground">{shop.ShopID}</p>
                  <h2 className="mt-1 text-lg font-black">{shop.ShopName}</h2>
                  <p className="text-sm text-muted-foreground">{shop.Location || "No location set"}</p>
                </div>
                <button type="button" onClick={() => openEdit(shop)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label={`Edit ${shop.ShopName}`}>
                  <Edit className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 border-t border-border pt-3 text-sm">
                <p><span className="font-semibold text-muted-foreground">Incharge:</span> {shop.InchargeName || "-"}</p>
                <p><span className="font-semibold text-muted-foreground">Contact:</span> {shop.InchargeContact || "-"}</p>
                <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${shop.Status === "Active" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  {shop.Status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? "Edit Shop" : "Add Shop"}>
        <form onSubmit={saveShop} className="space-y-4">
          <Field label="Shop Name" value={form.shopName} onChange={(value) => setForm((current) => ({ ...current, shopName: value }))} required />
          <Field label="Location" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
          <Field label="Incharge Name" value={form.inchargeName} onChange={(value) => setForm((current) => ({ ...current, inchargeName: value }))} />
          <Field label="Incharge Contact" value={form.inchargeContact} onChange={(value) => setForm((current) => ({ ...current, inchargeContact: value }))} />
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">Status</label>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; required?: boolean; onChange: (value: string) => void }> = ({ label, value, required, onChange }) => (
  <div>
    <label className="mb-1 block text-xs font-bold text-muted-foreground">{label}</label>
    <input
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
    />
  </div>
);

export default Shops;
