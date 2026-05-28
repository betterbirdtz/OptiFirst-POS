import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { UserSession } from "../../types";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";

interface AdminMtnItem {
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface AdminMtn {
  mtnNo: string;
  mtnDate: string;
  from: string;
  toShopId: string;
  toShopName: string;
  items: AdminMtnItem[];
}

interface ReceiptItem {
  itemName: string;
  sentQty: number;
  receivedQty: number;
  rate: number;
  variance: number;
}

export const MaterialTransferNote: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [pendingMtns, setPendingMtns] = useState<AdminMtn[]>([]);
  const [selectedMtn, setSelectedMtn] = useState<AdminMtn | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [complaintNote, setComplaintNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }
    loadPendingMtns();
  }, [navigate, user]);

  const loadPendingMtns = () => {
    setLoading(true);
    try {
      // Load admin-sent MTNs for this employee's shop
      const raw = localStorage.getItem("opti_mtn_source");
      if (raw) {
        const all = JSON.parse(raw) as AdminMtn[];
        const forMyShop = all.filter((m) => m.toShopId === user?.shopId);
        setPendingMtns(forMyShop);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  };

  const selectMtn = (mtn: AdminMtn) => {
    setSelectedMtn(mtn);
    setReceiptItems(mtn.items.filter((item) => item.quantity > 0).map((item) => ({
      itemName: item.itemName,
      sentQty: item.quantity,
      receivedQty: 0,
      rate: item.rate,
      variance: 0
    })));
    setComplaintNote("");
    setError("");
  };

  const updateReceived = (index: number, qty: number) => {
    setReceiptItems((current) => current.map((item, i) => {
      if (i !== index) return item;
      return { ...item, receivedQty: qty, variance: qty - item.sentQty };
    }));
  };

  const mismatchItems = receiptItems.filter((item) => item.receivedQty > 0 && item.variance !== 0);

  const submitReceipt = async () => {
    if (!user || !selectedMtn) return;
    const filled = receiptItems.filter((item) => item.receivedQty > 0);
    if (filled.length === 0) { setError("Enter received quantity for at least one item."); return; }
    if (mismatchItems.length > 0 && !complaintNote.trim()) { setError("Complaint/reason required for shortage."); return; }

    setSubmitting(true); setError("");
    try {
      const res = await appsScriptClient.submitMTN({
        mtnNo: selectedMtn.mtnNo,
        mtnDate: selectedMtn.mtnDate,
        from: selectedMtn.from,
        to: selectedMtn.toShopName,
        shopId: selectedMtn.toShopId,
        shopName: selectedMtn.toShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        items: filled.map((item) => ({
          productId: "",
          productName: item.itemName,
          category: "",
          uom: "",
          qtyAsPerMTN: item.sentQty,
          qtyReceived: item.receivedQty,
          variance: item.variance
        }))
      });
      if (res.success) {
        // Mark this MTN as received so it doesn't show again
        try {
          const raw = localStorage.getItem("opti_mtn_source");
          if (raw) {
            const all = JSON.parse(raw) as AdminMtn[];
            const updated = all.filter((m) => m.mtnNo !== selectedMtn.mtnNo);
            localStorage.setItem("opti_mtn_source", JSON.stringify(updated));
          }
        } catch { /* */ }
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
        <h2 className="text-2xl font-black">Receipt Confirmed</h2>
        <p className="text-sm text-muted-foreground">Stock receipt recorded successfully.</p>
        <button onClick={() => navigate("/employee/dashboard")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-2xl sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => selectedMtn ? setSelectedMtn(null) : navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-xl font-black">MTN Receipt</h1>
          <p className="text-xs text-muted-foreground">Confirm stock received from Head Office</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span>{error}</span></div>}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : !selectedMtn ? (
        /* List of pending MTNs from admin */
        <div className="space-y-3">
          {pendingMtns.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center space-y-2">
              <p className="text-sm font-bold text-muted-foreground">No stock transfers pending</p>
              <p className="text-xs text-muted-foreground">Admin has not sent any stock to your shop yet.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Tap a voucher to confirm received quantities.</p>
              {pendingMtns.map((mtn, i) => (
                <button key={i} type="button" onClick={() => selectMtn(mtn)} className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm active:bg-secondary space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">{mtn.mtnNo}</p>
                    <p className="text-xs text-muted-foreground">{formatDateForDisplay(mtn.mtnDate)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{mtn.from} → {mtn.toShopName} · {mtn.items.filter((item) => item.quantity > 0).length} items</p>
                </button>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Receipt confirmation form */
        <div className="space-y-5">
          {/* MTN Info (read-only) */}
          <section className="rounded-lg border border-border bg-secondary/30 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black">{selectedMtn.mtnNo}</p>
              <p className="text-xs font-bold">{formatDateForDisplay(selectedMtn.mtnDate)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{selectedMtn.from} → {selectedMtn.toShopName}</p>
          </section>

          {/* Items to confirm */}
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-black">Confirm Received Quantities</h2>
            <div className="space-y-3">
              {receiptItems.map((item, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{item.itemName}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.receivedQty === 0 ? "bg-secondary text-muted-foreground" : item.variance === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {item.receivedQty === 0 ? "Pending" : item.variance === 0 ? "✓ Match" : `${item.variance > 0 ? "+" : ""}${item.variance}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-muted-foreground">SENT (Admin)</label>
                      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 text-base font-black text-center">{item.sentQty}</div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-primary">RECEIVED (You)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.receivedQty || ""}
                        onChange={(e) => updateReceived(i, Number(e.target.value || 0))}
                        className="w-full rounded-lg border border-primary/40 bg-background px-3 py-3 text-base font-black text-center outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mismatch complaint */}
          {mismatchItems.length > 0 && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <h2 className="text-sm font-black text-red-800">⚠ Shortage Detected ({mismatchItems.length} items)</h2>
              <div className="space-y-1">
                {mismatchItems.map((m, i) => (
                  <p key={i} className="text-xs font-semibold text-red-700">{m.itemName}: sent {m.sentQty}, received {m.receivedQty} ({m.variance > 0 ? "+" : ""}{m.variance})</p>
                ))}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-red-800">Reason / Complaint *</label>
                <textarea
                  value={complaintNote}
                  onChange={(e) => setComplaintNote(e.target.value)}
                  placeholder="Describe why quantities don't match..."
                  className="min-h-20 w-full rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </section>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => setSelectedMtn(null)} className="flex-1 rounded-lg border border-border py-3 text-sm font-bold active:bg-secondary">Back</button>
            <button type="button" onClick={submitReceipt} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />{submitting ? "Submitting..." : "Confirm Receipt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialTransferNote;
