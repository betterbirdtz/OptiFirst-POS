export type UserRole = "Admin" | "Employee";
export type UserStatus = "Active" | "Inactive";

export interface UserSession {
  employeeId: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}

export interface Employee {
  EmployeeID: string;
  Name: string;
  Phone: string;
  PIN?: string;
  Role: UserRole;
  Status: UserStatus;
  CreatedAt: string;
}

export interface Product {
  ProductID: string;
  ProductName: string;
  Category: string;
  UOM: string;
  DefaultRate: number;
  Active: "Yes" | "No";
}

export interface DailySalesEntry {
  ReportID: string;
  Date: string;
  EmployeeID: string;
  EmployeeName: string;
  ProductID: string;
  ProductName: string;
  UOM: string;
  Quantity: number;
  Rate: number;
  SaleType: "Cash" | "Credit";
  CashSales: number;
  CreditSales: number;
  EFDNumber?: string;
  CustomerName?: string;
  TotalAmount: number;
  CreatedAt: string;
}

export interface DailyStockEntry {
  ReportID: string;
  Date: string;
  EmployeeID: string;
  EmployeeName: string;
  ProductID: string;
  ProductName: string;
  Category: string;
  UOM: string;
  OpeningStock: number;
  Receipt: number;
  Sales: number;
  ExpectedClosing: number;
  ActualClosing: number;
  Mismatch: number;
  CreatedAt: string;
}

export interface DailySummaryEntry {
  ReportID: string;
  Date: string;
  EmployeeID: string;
  EmployeeName: string;
  TotalSales: number;
  CashSales: number;
  CreditSales: number;
  TotalStockSales: number;
  StockMismatch: number;
  Status: "Pending Approval" | "Approved" | "Rejected" | "Reopened";
  SubmittedAt: string;
}

export interface CreditSalesEntry {
  ReportID: string;
  Date: string;
  EmployeeID: string;
  EmployeeName: string;
  CustomerName: string;
  ProductName: string;
  Amount: number;
  EFDNumber?: string;
  Status: "Pending Approval" | "Approved" | "Rejected" | "Reopened";
  CreatedAt: string;
}

export interface OpeningStockEntry {
  ProductID: string;
  ProductName: string;
  CurrentOpeningStock: number;
  LastUpdatedDate: string;
}

export interface LogEntry {
  LogID: string;
  UserID: string;
  Action: string;
  Details: string;
  CreatedAt: string;
}

// Submission Payload
export interface SalesSubmissionItem {
  productId: string;
  productName: string;
  uom: string;
  quantity: number;
  rate: number;
  saleType: "Cash" | "Credit";
  customerName?: string;
  efdNumber?: string;
}

export interface StockSubmissionItem {
  productId: string;
  productName: string;
  category: string;
  uom: string;
  openingStock: number;
  receipt: number;
  sales: number; // typically auto-calculated from sales quantities
  actualClosing?: number;
}

export interface DailyReportSubmission {
  reportId?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  salesEntries: SalesSubmissionItem[];
  stockEntries: StockSubmissionItem[];
}

export interface DashboardStats {
  todayTotalSales: number;
  todayCashSales: number;
  todayCreditSales: number;
  submittedReportsCount: number;
  stockMismatchCount: number;
  topSellingProduct: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

export interface ReportBundle {
  summaries: DailySummaryEntry[];
  sales: DailySalesEntry[];
  stocks: DailyStockEntry[];
  creditSales: CreditSalesEntry[];
}

export interface EmployeeSummaryRow {
  EmployeeID: string;
  EmployeeName: string;
  Reports: number;
  TotalSales: number;
  CashSales: number;
  CreditSales: number;
  StockMismatch: number;
}
