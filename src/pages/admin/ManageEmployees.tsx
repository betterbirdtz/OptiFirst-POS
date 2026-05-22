import React, { useEffect, useMemo, useState } from "react";
import { Edit, Plus, RefreshCw, Smartphone, Users } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import Modal from "../../components/common/Modal";
import type { Shop, User } from "../../types";

const blankForm = {
  name: "",
  phone: "",
  pin: "",
  role: "Employee",
  shopId: "",
  status: "Active"
};

export const ManageEmployees: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(blankForm);

  const activeShops = useMemo(() => shops.filter((shop) => shop.Status === "Active"), [shops]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [userResponse, shopResponse] = await Promise.all([appsScriptClient.getUsers(), appsScriptClient.getShops()]);
      if (userResponse.success && userResponse.users) setUsers(userResponse.users);
      if (shopResponse.success && shopResponse.shops) setShops(shopResponse.shops);
      if (!userResponse.success) setError(userResponse.error || "Failed to load users.");
    } catch (loadError) {
      console.error(loadError);
      setError("Network error loading employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm, shopId: activeShops[0]?.ShopID || "" });
    setOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.Name,
      phone: user.Phone,
      pin: "",
      role: user.Role,
      shopId: user.ShopID || "",
      status: user.Status
    });
    setOpen(true);
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = editing
        ? await appsScriptClient.updateUser({
            userId: editing.UserID,
            name: form.name,
            phone: form.phone,
            pin: form.pin || undefined,
            role: form.role,
            shopId: form.role === "Admin" ? "" : form.shopId,
            status: form.status
          })
        : await appsScriptClient.createUser({
            name: form.name,
            phone: form.phone,
            pin: form.pin,
            role: form.role,
            shopId: form.role === "Admin" ? "" : form.shopId,
            status: form.status
          });
      if (response.success) {
        setOpen(false);
        await loadData();
      } else {
        setError(response.error || "Employee save failed.");
      }
    } catch (saveError) {
      console.error(saveError);
      setError("Network error saving employee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            Employees
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create logins and assign each employee to a shop.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadData} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">Loading employees...</div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No users found.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Shop</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((user) => (
                  <tr key={user.UserID} className="hover:bg-secondary/30">
                    <td className="p-3">
                      <p className="font-black">{user.Name}</p>
                      <p className="text-xs text-muted-foreground">{user.UserID}</p>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        {user.Phone}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">{user.Role}</td>
                    <td className="p-3">{user.ShopName || (user.Role === "Admin" ? "All Shops" : "-")}</td>
                    <td className="p-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${user.Status === "Active" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {user.Status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => openEdit(user)} className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label={`Edit ${user.Name}`}>
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? "Edit Employee" : "Add Employee"}>
        <form onSubmit={saveUser} className="space-y-4">
          <Field label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
          <Field label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} required />
          <Field
            label={editing ? "New PIN (optional)" : "PIN"}
            value={form.pin}
            onChange={(value) => setForm((current) => ({ ...current, pin: value }))}
            required={!editing}
            type="password"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Role</label>
              <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Shop</label>
              <select
                value={form.shopId}
                disabled={form.role === "Admin"}
                onChange={(event) => setForm((current) => ({ ...current, shopId: event.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                <option value="">No shop</option>
                {activeShops.map((shop) => (
                  <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Status</label>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
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

const Field: React.FC<{ label: string; value: string; type?: string; required?: boolean; onChange: (value: string) => void }> = ({ label, value, type = "text", required, onChange }) => (
  <div>
    <label className="mb-1 block text-xs font-bold text-muted-foreground">{label}</label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
    />
  </div>
);

export default ManageEmployees;
