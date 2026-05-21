import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CircleDollarSign, Calendar, User, FileSpreadsheet, FileDown, RefreshCw, Search } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { CreditSalesEntry, Employee, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import { formatDateForDisplay, getLocalDateInputValue } from "../../utils/date";
import { exportToExcel } from "../../utils/exportExcel";
import { exportPaperReportToPdf } from "../../utils/exportPdf";
import { buildReportFilename } from "../../utils/reportTransforms";
import { getSessionUser } from "../../utils/session";

export const CreditSales: React.FC = () => {
  const navigate = useNavigate();

  // Filters
  const [startDate, setStartDate] = useState(getLocalDateInputValue());
  const [endDate, setEndDate] = useState(getLocalDateInputValue());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  // Data
  const [credits, setCredits] = useState<CreditSalesEntry[]>([]);
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

  // Load credit logs
  const loadCreditLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getReportsByDate(
        startDate || undefined,
        endDate || undefined,
        selectedEmployeeId || undefined
      );

      if (response.success && response.creditSales) {
        setCredits(response.creditSales);
      } else {
        setError("Failed to load credit sales ledger.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading credit ledger.");
    } finally {
      setLoading(false);
    }
  }, [endDate, selectedEmployeeId, startDate]);

  useEffect(() => {
    if (user && user.role === "Admin") {
      loadCreditLogs();
    }
  }, [user, loadCreditLogs]);

  // Filter credit entries locally by status if needed
  const filteredCredits = credits.filter(c => {
    if (statusFilter && c.Status !== statusFilter) return false;
    return true;
  });

  // Excel Export
  const handleExcelExport = () => {
    const headersMap = {
      ReportID: "Report ID",
      Date: "Date",
      EmployeeName: "Employee",
      CustomerName: "Customer Name",
      ProductName: "Product",
      Amount: "Amount (INR)",
      EFDNumber: "EFD Number",
      Status: "Status"
    };

    exportToExcel(filteredCredits, headersMap, `CreditSales_Report_${startDate}_to_${endDate}`, "CreditSales");
  };

  // PDF Export
  const handlePdfExport = () => {
    exportPaperReportToPdf({
      title: "Credit Sales Ledger",
      startDate,
      endDate,
      employeeName: employees.find((employee) => employee.EmployeeID === selectedEmployeeId)?.Name,
      filename: buildReportFilename("Credit_Sales_Ledger", startDate, endDate),
      headers: ["Date", "Employee", "Customer", "Product", "EFD Number", "Status", "Amount"],
      rows: filteredCredits.map((credit) => [
        formatDateForDisplay(credit.Date),
        credit.EmployeeName,
        credit.CustomerName,
        credit.ProductName,
        credit.EFDNumber || "-",
        credit.Status,
        formatCurrency(credit.Amount)
      ]),
      totals: {
        creditTotal: totalCreditAmount
      }
    });
  };

  const totalCreditAmount = filteredCredits.reduce((sum, c) => sum + c.Amount, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <span>Credit Sales Ledger</span>
          </h1>
          <p className="text-xs text-muted-foreground">Monitor customer credit balances and check invoice approval status.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadCreditLogs}
            disabled={loading}
            className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={handleExcelExport}
            disabled={filteredCredits.length === 0}
            className="flex items-center space-x-1 py-1.5 px-3 border border-border rounded-xl text-xs font-semibold hover:bg-secondary text-muted-foreground disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePdfExport}
            disabled={filteredCredits.length === 0}
            className="flex items-center space-x-1 py-1.5 px-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center space-x-1">
          <Search className="h-3.5 w-3.5" />
          <span>Filter Criteria</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-input rounded-xl bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Reopened">Reopened</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Credit list table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
        </div>
      ) : filteredCredits.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <CircleDollarSign className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="font-medium text-sm">No credit sales logged matching filters.</p>
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
                    <th className="p-4 font-semibold">Customer Name</th>
                    <th className="p-4 font-semibold">Product Name</th>
                    <th className="p-4 font-semibold">EFD Number</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Credit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCredits.map((credit, idx) => (
                    <tr key={idx} className="group hover:bg-secondary/40">
                      <td className="p-4 font-bold">{formatDateForDisplay(credit.Date)}</td>
                      <td className="p-4 font-semibold">{credit.EmployeeName}</td>
                      <td className="p-4 font-bold text-foreground">{credit.CustomerName}</td>
                      <td className="p-4">{credit.ProductName}</td>
                      <td className="p-4 text-muted-foreground font-mono">{credit.EFDNumber || "-"}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          credit.Status === "Approved" ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400" :
                          credit.Status === "Rejected" ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400" :
                          credit.Status === "Reopened" ? "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400" :
                          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                        }`}>
                          {credit.Status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-amber-600">{formatCurrency(credit.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sum Summary Card */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between text-xs font-semibold text-amber-800 dark:text-amber-400">
            <span>Outstanding Credit Rows: <strong>{filteredCredits.length}</strong></span>
            <span>Total Credit Balance: <strong className="text-sm font-extrabold">{formatCurrency(totalCreditAmount)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};
export default CreditSales;
