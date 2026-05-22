import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ReviewWarningsProps {
  warnings: string[];
}

export const ReviewWarnings: React.FC<ReviewWarningsProps> = ({ warnings }) => {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <span>No warnings found. The report is ready for final confirmation.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-amber-600">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <span>Review warnings</span>
      </div>
      <ul className="space-y-1 text-xs font-semibold text-slate-900">
        {warnings.map((warning) => (
          <li key={warning}>- {warning}</li>
        ))}
      </ul>
    </div>
  );
};

export default ReviewWarnings;
