import React from "react";
import type { EmployeeSummaryRow } from "../../types";
import { formatCurrency } from "../../utils/calculations";

interface EmployeeSummaryProps {
  rows: EmployeeSummaryRow[];
}

export const EmployeeSummary: React.FC<EmployeeSummaryProps> = ({ rows }) => {
  if (rows.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-bold">Employee-wise Summary</h3>
        <p className="text-xs text-muted-foreground">Totals from the currently filtered reports.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/35 text-muted-foreground">
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 font-semibold text-right">Reports</th>
              <th className="p-3 font-semibold text-right">Cash Sales</th>
              <th className="p-3 font-semibold text-right">Credit Sales</th>
              <th className="p-3 font-semibold text-right">Total Sales</th>
              <th className="p-3 font-semibold text-right">Mismatches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.EmployeeID} className="hover:bg-secondary/35">
                <td className="p-3 font-bold">{row.EmployeeName}</td>
                <td className="p-3 text-right">{row.Reports}</td>
                <td className="p-3 text-right">{formatCurrency(row.CashSales)}</td>
                <td className="p-3 text-right">{formatCurrency(row.CreditSales)}</td>
                <td className="p-3 text-right font-extrabold text-primary">{formatCurrency(row.TotalSales)}</td>
                <td className="p-3 text-right font-bold">{row.StockMismatch}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeSummary;
