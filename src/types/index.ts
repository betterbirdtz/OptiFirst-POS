export type UserRole = "Admin" | "Employee";
export type UserStatus = "Active" | "Inactive";
export type SaleType = "Cash" | "Credit";
export type YesNo = "Yes" | "No";
export type ReportStatus = "Draft" | "Submitted" | "Pending Approval" | "Approved" | "Rejected" | "Reopened";
export type CollectionStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Reopened";

export interface UserSession {
  userId: string;
  employeeId: string;
  name: string;
  phone: string;
  role: UserRole;
  shopId?: string;
  shopName?: string;
  status: UserStatus;
  allowMultiShop?: boolean;
}

export interface Shop {
  ShopID: string;
  ShopName: string;
  Location: string;
  InchargeName: string;
  InchargeContact: string;
  Status: UserStatus;
  CreatedAt: string;
}

export interface User {
  UserID: string;
  Name: string;
  Phone: string;
  PIN?: string;
  Role: UserRole;
  ShopID: string;
  ShopName?: string;
  Status: UserStatus;
  CreatedAt: string;
  EmployeeID?: string;
}

export type Employee = User;

export interface Product {
  ProductID: string;
  ProductName: string;
  Category: string;
  UOM: string;
  DefaultRate: number;
  Active: YesNo;
  CreatedAt?: string;
}

export interface DailyReport {
  ReportID: string;
  ShopID: string;
  ShopName: string;
  Date: string;
  EmployeeID: string;
  EmployeeName: string;
  SalesSubmitted: YesNo;
  StockSubmitted: YesNo;
  Status: ReportStatus;
  SubmittedAt: string;
  ApprovedBy: string;
  ApprovedAt: string;
  TotalSales: number;
  CashSales: number;
  CreditSales: number;
  StockMismatch: number;
}

export type DailySummaryEntry = DailyReport;

export interface DailySalesEntry {
  EntryID: string;
  ReportID: string;
  ShopID: string;
  ShopName: string;
  Date: string;
  EmployeeID: string;
  EmployeeName?: string;
  ProductID: string;
  ProductName: string;
  UOM: string;
  Quantity: number;
  Rate: number;
  SaleType: SaleType;
  CashSales: number;
  CreditSales: number;
  EFDNumber: string;
  CustomerName: string;
  TotalAmount: number;
  CreatedAt: string;
}

export interface DailyStockEntry {
  EntryID: string;
  ReportID: string;
  ShopID: string;
  ShopName: string;
  Date: string;
  EmployeeID: string;
  EmployeeName?: string;
  ProductID: string;
  ProductName: string;
  Category: string;
  UOM: string;
  MTNNo: string;
  OpeningStock: number;
  Receipt: number;
  Sales: number;
  ExpectedClosing: number;
  ActualClosing: number;
  Mismatch: number;
  CreatedAt: string;
}

export interface CollectionEntry {
  CollectionID: string;
  ReportID: string;
  ShopID: string;
  ShopName: string;
  Date: string;
  Month: string;
  Day: string;
  EmployeeID: string;
  EmployeeName: string;
  CashSales: number;
  CreditSales: number;
  TotalSales: number;
  DepositCash: number;
  DepositLIPA: number;
  ExpectedCollection: number;
  ActualCollection: number;
  Variance: number;
  DepositInBank: number;
  BankDepositDifference: number;
  DateOfDeposit: string;
  EFDZReport: number;
  SalesVsEFD: number;
  Name: string;
  Signature: string;
  Remarks: string;
  Status: CollectionStatus;
  AdminNote: string;
  SubmittedAt: string;
  UpdatedAt: string;
  ApprovedBy: string;
  ApprovedAt: string;
}

export interface LiveWeightEntry {
  LiveWeightID: string;
  ShopID: string;
  ShopName?: string;
  Date: string;
  Crates: number;
  TotalBirds: number;
  NetLiveWeightKG: number;
  AvgLiveWeightKG: number;
  DOA: number;
  InjuredBirds: number;
  Shortage: number;
  NetAcceptedBirds: number;
  CreatedAt: string;
}

export interface CreditSalesEntry {
  EntryID: string;
  ReportID: string;
  ShopID: string;
  ShopName: string;
  Date: string;
  EmployeeID: string;
  EmployeeName?: string;
  CustomerName: string;
  ProductName: string;
  Amount: number;
  EFDNumber: string;
  Status: ReportStatus;
  CreatedAt: string;
}

export interface OpeningStockEntry {
  ShopID: string;
  ShopName: string;
  ProductID: string;
  ProductName: string;
  Category: string;
  UOM: string;
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

export interface SalesSubmissionItem {
  productId: string;
  productName: string;
  uom: string;
  quantity: number;
  rate: number;
  saleType: SaleType;
  customerName?: string;
  efdNumber?: string;
}

export interface StockSubmissionItem {
  productId: string;
  productName: string;
  category: string;
  uom: string;
  mtnNo?: string;
  openingStock: number;
  receipt: number;
  sales: number;
  actualClosing?: number;
}

export interface DailyReportSubmission {
  reportId?: string;
  shopId: string;
  shopName: string;
  employeeId: string;
  employeeName: string;
  date: string;
  salesEntries: SalesSubmissionItem[];
  stockEntries: StockSubmissionItem[];
}

export interface CollectionSubmission {
  reportId?: string;
  shopId: string;
  shopName: string;
  employeeId: string;
  employeeName: string;
  date: string;
  depositCash: number;
  depositLIPA: number;
  depositInBank: number;
  dateOfDeposit?: string;
  efdZReport?: number;
  name: string;
  signature: string;
  remarks?: string;
}

export interface DashboardStats {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  depositCash: number;
  depositLIPA: number;
  variance: number;
  efdDifference: number;
  bankDepositDifference: number;
  todayCashSales: number;
  todayLIPA: number;
  todayBankDeposit: number;
  todayVariance: number;
  pendingCollectionApprovals: number;
  collectionsWithVariance: number;
  collectionsMissingEFD: number;
  bankDepositMismatches: number;
  stockMismatch: number;
  reportsSubmitted: number;
  pendingApprovals: number;
}

export interface DashboardTodaySubmission {
  ReportID: string;
  Shop: string;
  Employee: string;
  SalesTotal: number;
  StockStatus: string;
  CollectionStatus: string;
  ApprovalStatus: ReportStatus;
}

export interface ChartPoint {
  name: string;
  value: number;
  cash?: number;
  credit?: number;
  total?: number;
  mismatch?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  cashCreditSplit: ChartPoint[];
  dailySalesTrend: ChartPoint[];
  shopSalesComparison: ChartPoint[];
  topSellingProducts: ChartPoint[];
  mismatchByProduct: ChartPoint[];
  todaySubmissions: DashboardTodaySubmission[];
  collectionSummary: CollectionEntry[];
  stockMismatchRows: DailyStockEntry[];
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  month?: string;
  shopId?: string;
  employeeId?: string;
}

export interface ReportBundle {
  summaries: DailySummaryEntry[];
  sales: DailySalesEntry[];
  stocks: DailyStockEntry[];
  creditSales: CreditSalesEntry[];
  collections?: CollectionEntry[];
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
