import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calendar, User, FileSpreadsheet, FileDown, RefreshCw, Search } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { DailyStockEntry, Employee, UserSession } from "../../types";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const StockMismatch: React.FC = () => {
  const navigate = useNavigate();

  // Filters
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Data
  const [mismatches, setMismatches] = useState<DailyStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user] = useState<UserSession | null>(() => getSessionUser());

  // Load employee choices for dropdown
  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    const loadFilters = async () => {
      try {
        const empRes = await appsScriptClient.getEmployees();
        if (empRes.success && empRes.employees) {
          setEmployees(empRes.employees);
        }
      } catch (e) {
        console.error("Failed to load employees for filter:", e);
      }
    };
    loadFilters();
  }, [user, navigate]);

  // Load mismatch data
  const loadMismatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getReportsByDate(
        startDate || undefined,
        endDate || undefined,
        selectedEmployeeId || undefined
      );

      if (response.success && response.stocks) {
        // Filter: Only keep rows where Mismatch is NOT 0
        const filtered = response.stocks.filter((st: DailyStockEntry) => st.Mismatch !== 0);
        setMismatches(filtered);
      } else {
        setError("Failed to load stock audits.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading stock log.");
    } finally {
      setLoading(false);
    }
  }, [endDate, selectedEmployeeId, startDate]);

  useEffect(() => {
    if (user && user.role === "Admin") {
      loadMismatches();
    }
  }, [user, loadMismatches]);

  // Excel Export
  const handleExcelExport = () => {
    const headersMap = {
      ReportID: "Report ID",
      Date: "Date",
      EmployeeName: "Employee",
      ProductName: "Product",
      OpeningStock: "Opening Stock",
      Receipt: "Receipt",
      Sales: "Sales",
      ExpectedClosing: "Expected Closing",
      ActualClosing: "Actual Closing",
      Mismatch: "Mismatch"
    };

    exportToExcel(mismatches, headersMap, `StockMismatches_Report_${startDate}_to_${endDate}`, "StockMismatches");
  };

  // PDF Export
  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Stock Mismatch Report",
      startDate,
      endDate,
      employeeName: employees.find((employee) => employee.EmployeeID === selectedEmployeeId)?.Name,
      filename: buildReportFilename("Stock_Mismatch_Report", startDate, endDate),
      headers: ["Date", "Employee", "Product", "Opening", "Receipt", "Sales", "Expected", "Actual", "Mismatch"],
      rows: mismatches.map((stock) => [
        formatDateForDisplay(stock.Date),
        stock.EmployeeName,
        stock.ProductName,
        stock.OpeningStock,
        stock.Receipt,
        stock.Sales,
        stock.ExpectedClosing,
        stock.ActualClosing,
        `${stock.Mismatch > 0 ? "+" : ""}${stock.Mismatch} ${stock.UOM}`
      ]),
      totals: {
        mismatchCount: mismatches.length
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            <span>Stock Discrepancy Audits</span>
          </h1>
          <p className="text-xs text-muted-foreground">Isolate and review non-zero physical inventory mismatches.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadMismatches}
            disabled={loading}
            className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={handleExcelExport}
            disabled={mismatches.length === 0}
            className="flex items-center space-x-1 py-1.5 px-3 border border-border rounded-xl text-xs font-semibold hover:bg-secondary text-muted-foreground disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePdfExport}
            disabled={mismatches.length === 0}
            className="flex items-center space-x-1 py-1.5 px-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center space-x-1">
          <Search className="h-3.5 w-3.5" />
          <span>Filter Criteria</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>End Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span>Employee</span>
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.EmployeeID} value={emp.EmployeeID}>{emp.Name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Mismatches logs list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
        </div>
      ) : mismatches.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto opacity-20 mb-3 text-green-500" />
          <p className="font-medium text-sm">No stock mismatches found! All actual closing counts match expectations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/35 text-muted-foreground">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Employee</th>
                    <th className="p-4 font-semibold">Product Name</th>
                    <th className="p-4 font-semibold">Opening</th>
                    <th className="p-4 font-semibold">Receipt</th>
                    <th className="p-4 font-semibold">Sales</th>
                    <th className="p-4 font-semibold">Expected Closing</th>
                    <th className="p-4 font-semibold">Actual Closing</th>
                    <th className="p-4 font-semibold text-right text-destructive">Discrepancy (Mismatch)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {mismatches.map((st, idx) => {
                    const expected = st.OpeningStock + st.Receipt - st.Sales;
                    const mismatch = st.ActualClosing - expected;
                    return (
                      <tr key={idx} className="group hover:bg-secondary/40">
                        <td className="p-4 font-bold">{formatDateForDisplay(st.Date)}</td>
                        <td className="p-4 font-semibold">{st.EmployeeName}</td>
                        <td className="p-4 font-bold">{st.ProductName}</td>
                        <td className="p-4">{st.OpeningStock} {st.UOM}</td>
                        <td className="p-4">{st.Receipt} {st.UOM}</td>
                        <td className="p-4 text-primary">{st.Sales} {st.UOM}</td>
                        <td className="p-4">{expected} {st.UOM}</td>
                        <td className="p-4 font-bold text-foreground">{st.ActualClosing} {st.UOM}</td>
                        <td className="p-4 text-right font-extrabold text-destructive">
                          {mismatch > 0 ? "+" : ""}{mismatch} {st.UOM}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-xs font-semibold text-destructive">
            <span>Outstanding Discrepancies: <strong>{mismatches.length}</strong> product lines.</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default StockMismatch;
