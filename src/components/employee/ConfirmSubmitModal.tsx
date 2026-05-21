import React from "react";
import { Send, X } from "lucide-react";
import Modal from "../common/Modal";
import { formatCurrency } from "../../utils/calculations";

interface ConfirmSubmitModalProps {
  isOpen: boolean;
  loading: boolean;
  totalSales: number;
  warningsCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({
  isOpen,
  loading,
  totalSales,
  warningsCount,
  onClose,
  onConfirm
}) => {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => undefined : onClose} title="Confirm Final Submission">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <p className="font-bold text-foreground">Submit this daily report to admin?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            After submission, the report will appear in the admin dashboard and update opening stock for the next day.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border p-3">
            <p className="text-muted-foreground">Total Sales</p>
            <p className="mt-1 text-base font-black text-primary">{formatCurrency(totalSales)}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-muted-foreground">Warnings</p>
            <p className={`mt-1 text-base font-black ${warningsCount > 0 ? "text-amber-600" : "text-green-600"}`}>
              {warningsCount}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/95 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit Final
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmSubmitModal;
