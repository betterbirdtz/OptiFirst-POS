import type {
  CollectionEntry,
  CollectionSubmission,
  CreditSalesEntry,
  DailyReport,
  DailyReportSubmission,
  DailySalesEntry,
  DailyStockEntry,
  DashboardData,
  OpeningStockEntry,
  Product,
  ReportStatus,
  Shop,
  StockSubmissionItem,
  User,
  UserSession,
  LiveWeightEntry
} from "../types";
import {
  calculateActualCollection,
  calculateBankDepositDifference,
  calculateCollectionVariance,
  calculateExpectedClosing,
  calculateMismatch,
  calculateSalesAmount,
  calculateSalesVsEfd,
  toNumber
} from "../utils/calculations";
import { getDayName, getLocalDateInputValue, getMonthInputValue, normalizeSheetDate } from "../utils/date";

export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  user?: UserSession;
  shops?: Shop[];
  users?: User[];
  employees?: User[];
  products?: Product[];
  report?: DailyReport;
  reports?: DailyReport[];
  summaries?: DailyReport[];
  sales?: DailySalesEntry[];
  stocks?: DailyStockEntry[];
  collections?: CollectionEntry[];
  collection?: CollectionEntry;
  creditSales?: CreditSalesEntry[];
  openingStock?: OpeningStockEntry[];
  dashboard?: DashboardData;
  stats?: DashboardData["stats"];
  recentSummaries?: DailyReport[];
  reportId?: string;
  totalSales?: number;
  cashSales?: number;
  creditSalesAmount?: number;
  mismatchCount?: number;
  shopId?: string;
  userId?: string;
  employeeId?: string;
  productId?: string;
  liveWeight?: unknown[];
  mtns?: MTNRow[];
  prices?: ShopPriceRow[];
}

type ApiData = Record<string, unknown>;
type ShopPriceRow = { ShopID: string; ProductID: string; Rate: number; UpdatedAt?: string };
type OpeningStockOverrideRow = { ShopID: string; ProductID: string; OpeningStock: number; UpdatedAt?: string };
type MTNRow = {
  MTNID: string;
  MTNNo: string;
  MTNDate: string;
  From: string;
  ToShopID: string;
  ToShopName: string;
  EmployeeID: string;
  EmployeeName: string;
  ProductName: string;
  QtyAsPerMTN: number;
  QtyReceived: number;
  Variance: number;
  Status: string;
  Complaint: string;
  CreatedAt: string;
};

const MOCK_SCHEMA_VERSION = "2026-05-v2-shops-mtn-pricing";

const STORAGE_KEYS = {
  version: "opti_schema_version",
  shops: "opti_shops",
  users: "opti_users",
  products: "opti_products",
  reports: "opti_daily_reports",
  sales: "opti_daily_sales_entries",
  stocks: "opti_daily_stock_entries",
  collections: "opti_collections",
  liveWeight: "opti_live_weight",
  logs: "opti_logs",
  mtn: "mock_mtn_rows",
  shopPrices: "mock_shop_prices",
  openingStock: "mock_opening_stock"
};

const legacyKeys = [
  "db_employees",
  "db_products",
  "db_opening_stock",
  "db_daily_sales",
  "db_daily_stock",
  "db_daily_summary",
  "db_credit_sales",
  "db_logs"
];

const getApiUrl = (): string => {
  const url = import.meta.env.VITE_APPS_SCRIPT_URL || "";
  return url.trim();
};

export const isMockMode = (): boolean => {
  const url = getApiUrl();
  return !url || url.includes("YOUR_DEPLOYED_ID_HERE");
};

const mockDb: Record<string, unknown[]> = {};
let mockDbVersion = "";

function cloneRows<T>(rows: T[]): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[];
}

function hasStored(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(mockDb, key);
}

function parseStored<T>(key: string, fallback: T[] = []): T[] {
  const rows = mockDb[key] as T[] | undefined;
  return rows ? cloneRows(rows) : fallback;
}

function setStored<T>(key: string, value: T[]) {
  mockDb[key] = cloneRows(value);
}

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resetMockDbIfNeeded() {
  if (mockDbVersion === MOCK_SCHEMA_VERSION) return;

  Object.values(STORAGE_KEYS).forEach((key) => {
    delete mockDb[key];
  });
  legacyKeys.forEach((key) => {
    delete mockDb[key];
  });
  mockDbVersion = MOCK_SCHEMA_VERSION;
}

function seedMockDb() {
  resetMockDbIfNeeded();
  const createdAt = nowIso();

  if (!hasStored(STORAGE_KEYS.shops)) {
    setStored<Shop>(STORAGE_KEYS.shops, [
      {
        ShopID: "SHOP001",
        ShopName: "Kisutu",
        Location: "Kisutu",
        InchargeName: "Kisutu Incharge",
        InchargeContact: "+255700000001",
        Status: "Active",
        CreatedAt: createdAt
      },
      {
        ShopID: "SHOP002",
        ShopName: "Kigamboni",
        Location: "Kigamboni",
        InchargeName: "Kigamboni Incharge",
        InchargeContact: "+255700000002",
        Status: "Active",
        CreatedAt: createdAt
      },
      {
        ShopID: "SHOP003",
        ShopName: "Utumbo",
        Location: "Utumbo",
        InchargeName: "Utumbo Incharge",
        InchargeContact: "+255700000003",
        Status: "Active",
        CreatedAt: createdAt
      }
    ]);
  }

  if (!hasStored(STORAGE_KEYS.users)) {
    setStored<User>(STORAGE_KEYS.users, [
      {
        UserID: "USR001",
        EmployeeID: "USR001",
        Name: "Admin User",
        Phone: "+255700000000",
        PIN: "1234",
        Role: "Admin",
        ShopID: "",
        Status: "Active",
        CreatedAt: createdAt
      },
      {
        UserID: "USR002",
        EmployeeID: "USR002",
        Name: "Kisutu Employee",
        Phone: "+255700000101",
        PIN: "1111",
        Role: "Employee",
        ShopID: "SHOP001",
        Status: "Active",
        CreatedAt: createdAt
      },
      {
        UserID: "USR003",
        EmployeeID: "USR003",
        Name: "Kigamboni Employee",
        Phone: "+255700000102",
        PIN: "2222",
        Role: "Employee",
        ShopID: "SHOP002",
        Status: "Active",
        CreatedAt: createdAt
      },
      {
        UserID: "USR004",
        EmployeeID: "USR004",
        Name: "Utumbo Employee",
        Phone: "+255700000103",
        PIN: "3333",
        Role: "Employee",
        ShopID: "SHOP003",
        Status: "Active",
        CreatedAt: createdAt
      }
    ]);
  }

  if (!hasStored(STORAGE_KEYS.products)) {
    setStored<Product>(STORAGE_KEYS.products, [
      { ProductID: "PROD001", ProductName: "Live Chicken", Category: "Chicken", UOM: "KG", DefaultRate: 7500, Active: "Yes", CreatedAt: createdAt },
      { ProductID: "PROD002", ProductName: "Dressed Chicken", Category: "Chicken", UOM: "KG", DefaultRate: 9500, Active: "Yes", CreatedAt: createdAt },
      { ProductID: "PROD003", ProductName: "Broiler Chicken", Category: "Chicken", UOM: "Bird", DefaultRate: 11000, Active: "Yes", CreatedAt: createdAt },
      { ProductID: "PROD004", ProductName: "Chicken Parts", Category: "Chicken", UOM: "KG", DefaultRate: 8500, Active: "Yes", CreatedAt: createdAt },
      { ProductID: "PROD005", ProductName: "Egg Tray", Category: "Eggs", UOM: "Tray", DefaultRate: 9000, Active: "Yes", CreatedAt: createdAt },
      { ProductID: "PROD006", ProductName: "Loose Eggs", Category: "Eggs", UOM: "Piece", DefaultRate: 350, Active: "Yes", CreatedAt: createdAt }
    ]);
  }

  if (!hasStored(STORAGE_KEYS.reports)) setStored<DailyReport>(STORAGE_KEYS.reports, []);
  if (!hasStored(STORAGE_KEYS.sales)) setStored<DailySalesEntry>(STORAGE_KEYS.sales, []);
  if (!hasStored(STORAGE_KEYS.stocks)) setStored<DailyStockEntry>(STORAGE_KEYS.stocks, []);
  if (!hasStored(STORAGE_KEYS.collections)) setStored<CollectionEntry>(STORAGE_KEYS.collections, []);
  if (!hasStored(STORAGE_KEYS.liveWeight)) setStored<unknown>(STORAGE_KEYS.liveWeight, []);
  if (!hasStored(STORAGE_KEYS.logs)) setStored<unknown>(STORAGE_KEYS.logs, []);
  if (!hasStored(STORAGE_KEYS.mtn)) setStored<MTNRow>(STORAGE_KEYS.mtn, []);
  if (!hasStored(STORAGE_KEYS.shopPrices)) setStored<ShopPriceRow>(STORAGE_KEYS.shopPrices, []);
  if (!hasStored(STORAGE_KEYS.openingStock)) setStored<OpeningStockOverrideRow>(STORAGE_KEYS.openingStock, []);

  if (getReports().length === 0 && getSales().length === 0 && getCollections().length === 0) {
    seedSampleCollections(createdAt);
  }
}

function seedSampleCollections(createdAt: string) {
  const today = getLocalDateInputValue();
  const shops = getShops();
  const users = getUsers().filter((user) => user.Role === "Employee");
  const sampleDates = [today, today, today, `${today.slice(0, 8)}15`, `${today.slice(0, 8)}12`];
  const samples = [
    { shopId: "SHOP001", employeeId: "USR002", date: sampleDates[0], cash: 180000, credit: 25000, depositCash: 180000, lipa: 0, bank: 180000, efd: 205000, status: "Approved" as const, remarks: "" },
    { shopId: "SHOP002", employeeId: "USR003", date: sampleDates[1], cash: 140000, credit: 0, depositCash: 90000, lipa: 50000, bank: 90000, efd: 140000, status: "Submitted" as const, remarks: "LIPA received at closing." },
    { shopId: "SHOP003", employeeId: "USR004", date: sampleDates[2], cash: 125000, credit: 15000, depositCash: 118000, lipa: 0, bank: 118000, efd: 140000, status: "Submitted" as const, remarks: "Cash shortage under review." },
    { shopId: "SHOP001", employeeId: "USR002", date: sampleDates[3], cash: 90000, credit: 10000, depositCash: 90000, lipa: 0, bank: 90000, efd: 95000, status: "Submitted" as const, remarks: "EFD Z report differs from sales." },
    { shopId: "SHOP002", employeeId: "USR003", date: sampleDates[4], cash: 110000, credit: 0, depositCash: 110000, lipa: 0, bank: 100000, efd: 110000, status: "Submitted" as const, remarks: "Bank deposit short by 10,000." }
  ];

  const reports: DailyReport[] = [];
  const sales: DailySalesEntry[] = [];
  const collections: CollectionEntry[] = [];

  samples.forEach((sample, index) => {
    const shop = shops.find((item) => item.ShopID === sample.shopId);
    const user = users.find((item) => item.UserID === sample.employeeId);
    if (!shop || !user) return;
    const reportId = `REP-SAMPLE-${index + 1}`;
    const cashSaleId = `SAL-SAMPLE-CASH-${index + 1}`;
    const creditSaleId = `SAL-SAMPLE-CREDIT-${index + 1}`;
    reports.push({
      ReportID: reportId,
      ShopID: shop.ShopID,
      ShopName: shop.ShopName,
      Date: sample.date,
      EmployeeID: user.UserID,
      EmployeeName: user.Name,
      SalesSubmitted: "Yes",
      StockSubmitted: "Yes",
      Status: "Submitted",
      SubmittedAt: createdAt,
      ApprovedBy: "",
      ApprovedAt: "",
      TotalSales: sample.cash + sample.credit,
      CashSales: sample.cash,
      CreditSales: sample.credit,
      StockMismatch: index === 2 ? 1 : 0
    });
    sales.push({
      EntryID: cashSaleId,
      ReportID: reportId,
      ShopID: shop.ShopID,
      ShopName: shop.ShopName,
      Date: sample.date,
      EmployeeID: user.UserID,
      EmployeeName: user.Name,
      ProductID: "PROD001",
      ProductName: "Live Chicken",
      UOM: "KG",
      Quantity: 24,
      Rate: sample.cash / 24,
      SaleType: "Cash",
      CashSales: sample.cash,
      CreditSales: 0,
      EFDNumber: "",
      CustomerName: "",
      TotalAmount: sample.cash,
      CreatedAt: createdAt
    });
    if (sample.credit > 0) {
      sales.push({
        EntryID: creditSaleId,
        ReportID: reportId,
        ShopID: shop.ShopID,
        ShopName: shop.ShopName,
        Date: sample.date,
        EmployeeID: user.UserID,
        EmployeeName: user.Name,
        ProductID: "PROD002",
        ProductName: "Dressed Chicken",
        UOM: "KG",
        Quantity: 5,
        Rate: sample.credit / 5,
        SaleType: "Credit",
        CashSales: 0,
        CreditSales: sample.credit,
        EFDNumber: "",
        CustomerName: "Credit Customer",
        TotalAmount: sample.credit,
        CreatedAt: createdAt
      });
    }

    const actual = calculateActualCollection(sample.depositCash, sample.lipa);
    collections.push({
      CollectionID: `COL-SAMPLE-${index + 1}`,
      ReportID: reportId,
      ShopID: shop.ShopID,
      ShopName: shop.ShopName,
      Date: sample.date,
      Month: sample.date.slice(0, 7),
      Day: getDayName(sample.date),
      EmployeeID: user.UserID,
      EmployeeName: user.Name,
      CashSales: sample.cash,
      CreditSales: sample.credit,
      TotalSales: sample.cash + sample.credit,
      DepositCash: sample.depositCash,
      DepositLIPA: sample.lipa,
      ExpectedCollection: sample.cash,
      ActualCollection: actual,
      Variance: calculateCollectionVariance(sample.cash, sample.depositCash, sample.lipa),
      DepositInBank: sample.bank,
      BankDepositDifference: calculateBankDepositDifference(sample.depositCash, sample.bank),
      DateOfDeposit: sample.date,
      EFDZReport: sample.efd,
      SalesVsEFD: calculateSalesVsEfd(sample.cash + sample.credit, sample.efd),
      Name: user.Name,
      Signature: "Confirmed",
      Remarks: sample.remarks,
      Status: sample.status,
      AdminNote: "",
      SubmittedAt: createdAt,
      UpdatedAt: createdAt,
      ApprovedBy: sample.status === "Approved" ? "USR001" : "",
      ApprovedAt: sample.status === "Approved" ? createdAt : ""
    });
  });

  setStored<DailyReport>(STORAGE_KEYS.reports, reports);
  setStored<DailySalesEntry>(STORAGE_KEYS.sales, sales);
  setStored<CollectionEntry>(STORAGE_KEYS.collections, collections);
}

function getShops(): Shop[] {
  return parseStored<Shop>(STORAGE_KEYS.shops, []);
}

function getUsers(): User[] {
  const shops = getShops();
  return parseStored<User>(STORAGE_KEYS.users, []).map((user) => {
    const shop = shops.find((item) => item.ShopID === user.ShopID);
    return {
      ...user,
      EmployeeID: user.EmployeeID || user.UserID,
      ShopName: shop?.ShopName || ""
    };
  });
}

function getProducts(): Product[] {
  return parseStored<Product>(STORAGE_KEYS.products, []);
}

function getReports(): DailyReport[] {
  return parseStored<DailyReport>(STORAGE_KEYS.reports, []);
}

function getSales(): DailySalesEntry[] {
  return parseStored<DailySalesEntry>(STORAGE_KEYS.sales, []);
}

function getStocks(): DailyStockEntry[] {
  return parseStored<DailyStockEntry>(STORAGE_KEYS.stocks, []);
}

function getCollections(): CollectionEntry[] {
  return parseStored<CollectionEntry>(STORAGE_KEYS.collections, []);
}

function withoutPin(user: User): User {
  const safe = { ...user, EmployeeID: user.EmployeeID || user.UserID };
  delete safe.PIN;
  return safe;
}

function toSession(user: User): UserSession {
  const shop = getShops().find((item) => item.ShopID === user.ShopID);
  return {
    userId: user.UserID,
    employeeId: user.UserID,
    name: user.Name,
    phone: user.Phone,
    role: user.Role,
    shopId: user.ShopID || "",
    shopName: shop?.ShopName || "",
    status: user.Status,
    allowMultiShop: user.Role === "Admin"
  };
}

function isDateInRange(value: string, startDate?: string, endDate?: string): boolean {
  const date = normalizeSheetDate(value);
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function isMonth(value: string, month?: string): boolean {
  return !month || normalizeSheetDate(value).startsWith(month);
}

function filterShop<T extends { ShopID: string }>(rows: T[], shopId?: string): T[] {
  return shopId ? rows.filter((row) => row.ShopID === shopId) : rows;
}

function reportTotals(reportId: string) {
  const reportSales = getSales().filter((sale) => sale.ReportID === reportId);
  const reportStocks = getStocks().filter((stock) => stock.ReportID === reportId);
  return {
    CashSales: reportSales.reduce((sum, sale) => sum + toNumber(sale.CashSales), 0),
    CreditSales: reportSales.reduce((sum, sale) => sum + toNumber(sale.CreditSales), 0),
    TotalSales: reportSales.reduce((sum, sale) => sum + toNumber(sale.TotalAmount), 0),
    StockMismatch: reportStocks.filter((stock) => toNumber(stock.Mismatch) !== 0).length
  };
}

function enrichReport(report: DailyReport): DailyReport {
  return { ...report, ...reportTotals(report.ReportID) };
}

function getEmployeeName(userId: string): string {
  return getUsers().find((user) => user.UserID === userId)?.Name || "";
}

function withEmployeeName<T extends { EmployeeID: string; EmployeeName?: string }>(row: T): T & { EmployeeName: string } {
  return { ...row, EmployeeName: row.EmployeeName || getEmployeeName(row.EmployeeID) };
}

function removeRowsForReport(reportId: string, mode: "sales" | "stock" | "full") {
  if (mode !== "stock") {
    setStored<DailySalesEntry>(STORAGE_KEYS.sales, getSales().filter((row) => row.ReportID !== reportId));
  }
  if (mode !== "sales") {
    setStored<DailyStockEntry>(STORAGE_KEYS.stocks, getStocks().filter((row) => row.ReportID !== reportId));
  }
}

function getSalesQuantityByProduct(shopId: string, date: string): Map<string, number> {
  const quantities = new Map<string, number>();
  getSales()
    .filter((sale) => sale.ShopID === shopId && normalizeSheetDate(sale.Date) === normalizeSheetDate(date))
    .forEach((sale) => {
      quantities.set(sale.ProductID, (quantities.get(sale.ProductID) || 0) + toNumber(sale.Quantity));
    });
  return quantities;
}

function recalculateExistingStockSales(reportId: string, shopId: string, date: string) {
  const quantities = getSalesQuantityByProduct(shopId, date);
  const stockRows = getStocks().map((stock) => {
    if (stock.ReportID !== reportId) return stock;
    const sales = quantities.get(stock.ProductID) || 0;
    const expected = calculateExpectedClosing(stock.OpeningStock, stock.Receipt, sales);
    return {
      ...stock,
      Sales: sales,
      ExpectedClosing: expected,
      Mismatch: calculateMismatch(stock.ActualClosing, expected)
    };
  });
  setStored<DailyStockEntry>(STORAGE_KEYS.stocks, stockRows);
}

function validateSubmission(submission: DailyReportSubmission, requireSales: boolean, requireStock: boolean): string | null {
  const user = getUsers().find((item) => item.UserID === submission.employeeId);
  const shop = getShops().find((item) => item.ShopID === submission.shopId);
  const products = getProducts();

  if (!user || user.Status !== "Active") return "Active employee account is required.";
  if (user.Role !== "Employee") return "Only employees can submit daily reports.";
  if (!shop || shop.Status !== "Active") return "An active shop is required.";
  if (user.ShopID && user.ShopID !== submission.shopId) return "Employee can submit only for their assigned shop.";
  if (!submission.date) return "Report date is required.";
  if (requireSales && (!submission.salesEntries || submission.salesEntries.length === 0)) return "At least one sales item is required.";
  if (requireStock && (!submission.stockEntries || submission.stockEntries.length === 0)) return "Stock entries are required.";

  const activeProducts = new Set(products.filter((product) => product.Active === "Yes").map((product) => product.ProductID));
  for (const sale of submission.salesEntries || []) {
    if (!activeProducts.has(sale.productId)) return `Inactive or unknown product in sales: ${sale.productName}`;
    if (toNumber(sale.quantity) <= 0) return `Invalid quantity for ${sale.productName}.`;
    if (toNumber(sale.rate) < 0) return `Invalid rate for ${sale.productName}.`;
    if (sale.saleType === "Credit" && !sale.customerName?.trim()) return `Customer name is required for credit sale: ${sale.productName}.`;
  }

  for (const stock of submission.stockEntries || []) {
    if (!activeProducts.has(stock.productId)) return `Inactive or unknown product in stock: ${stock.productName}`;
    if (!Number.isFinite(Number(stock.openingStock))) return `Invalid opening stock for ${stock.productName}.`;
    if (!Number.isFinite(Number(stock.receipt))) return `Invalid receipt for ${stock.productName}.`;
    if (!Number.isFinite(Number(stock.sales))) return `Invalid sales quantity for ${stock.productName}.`;
    if (stock.actualClosing === undefined || !Number.isFinite(Number(stock.actualClosing))) return `Actual closing stock is required for ${stock.productName}.`;
  }

  return null;
}

function buildBaseCollection(shopId: string, date: string, reportId?: string, employeeId?: string, employeeName?: string): CollectionEntry {
  const collections = getCollections();
  const shop = getShops().find((item) => item.ShopID === shopId);
  const reportDate = normalizeSheetDate(date);
  const report = reportId
    ? getReports().find((row) => row.ReportID === reportId)
    : getReports().find((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === reportDate);
  const month = reportDate.slice(0, 7);
  const sales = getSales().filter((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === reportDate);
  const cashSales = sales.reduce((sum, row) => sum + toNumber(row.CashSales), 0);
  const creditSales = sales.reduce((sum, row) => sum + toNumber(row.CreditSales), 0);
  const totalSales = cashSales + creditSales;
  const existingIndex = collections.findIndex((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === reportDate);
  const existing = existingIndex >= 0 ? collections[existingIndex] : undefined;
  const depositCash = toNumber(existing?.DepositCash);
  const depositLIPA = toNumber(existing?.DepositLIPA);
  const depositInBank = toNumber(existing?.DepositInBank);
  const efdZReport = toNumber(existing?.EFDZReport);
  const actualCollection = calculateActualCollection(depositCash, depositLIPA);
  const variance = calculateCollectionVariance(cashSales, depositCash, depositLIPA);
  const bankDepositDifference = calculateBankDepositDifference(depositCash, depositInBank);
  const salesVsEFD = calculateSalesVsEfd(totalSales, efdZReport);

  return {
    CollectionID: existing?.CollectionID || generateId("COL"),
    ReportID: existing?.ReportID || report?.ReportID || reportId || "",
    ShopID: shopId,
    ShopName: shop?.ShopName || existing?.ShopName || "",
    Date: reportDate,
    Month: month,
    Day: getDayName(date),
    EmployeeID: existing?.EmployeeID || employeeId || report?.EmployeeID || "",
    EmployeeName: existing?.EmployeeName || employeeName || report?.EmployeeName || "",
    CashSales: cashSales,
    CreditSales: creditSales,
    TotalSales: totalSales,
    DepositCash: depositCash,
    DepositLIPA: depositLIPA,
    ExpectedCollection: cashSales,
    ActualCollection: actualCollection,
    Variance: variance,
    DepositInBank: depositInBank,
    BankDepositDifference: bankDepositDifference,
    DateOfDeposit: existing?.DateOfDeposit || "",
    EFDZReport: efdZReport,
    SalesVsEFD: salesVsEFD,
    Name: existing?.Name || "",
    Signature: existing?.Signature || "",
    Remarks: existing?.Remarks || "",
    Status: existing?.Status || "Draft",
    AdminNote: existing?.AdminNote || "",
    SubmittedAt: existing?.SubmittedAt || "",
    UpdatedAt: existing?.UpdatedAt || nowIso(),
    ApprovedBy: existing?.ApprovedBy || "",
    ApprovedAt: existing?.ApprovedAt || ""
  };
}

function upsertCollectionForShopDate(shopId: string, date: string, reportId?: string, employeeId?: string, employeeName?: string): CollectionEntry {
  const collections = getCollections();
  const reportDate = normalizeSheetDate(date);
  const existingIndex = collections.findIndex((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === reportDate);
  const next = {
    ...buildBaseCollection(shopId, reportDate, reportId, employeeId, employeeName),
    UpdatedAt: nowIso()
  };

  if (existingIndex >= 0) collections[existingIndex] = next;
  else collections.push(next);
  setStored<CollectionEntry>(STORAGE_KEYS.collections, collections);
  return next;
}

function filterCollections(data: ApiData): CollectionEntry[] {
  const month = data.month ? String(data.month) : "";
  const startDate = data.startDate ? String(data.startDate) : "";
  const endDate = data.endDate ? String(data.endDate) : "";
  const status = data.status ? String(data.status) : "";
  const search = data.search ? String(data.search).toLowerCase() : "";
  return getCollections()
    .filter((row) => !month || row.Month === month)
    .filter((row) => isDateInRange(row.Date, startDate || undefined, endDate || undefined))
    .filter((row) => !data.shopId || row.ShopID === String(data.shopId))
    .filter((row) => !status || row.Status === status)
    .filter((row) => !search || row.EmployeeName.toLowerCase().includes(search) || row.Name.toLowerCase().includes(search))
    .sort((a, b) => a.Date.localeCompare(b.Date) || a.ShopName.localeCompare(b.ShopName));
}

function submitMockCollection(submission: CollectionSubmission): ApiResponse {
  const user = getUsers().find((item) => item.UserID === submission.employeeId);
  const shop = getShops().find((item) => item.ShopID === submission.shopId);
  if (!user || user.Role !== "Employee" || user.Status !== "Active") return { success: false, error: "Active employee account is required." };
  if (!shop || shop.Status !== "Active") return { success: false, error: "Active shop is required." };
  if (user.ShopID && user.ShopID !== submission.shopId) return { success: false, error: "Employee can submit collection only for their assigned shop." };
  if (!submission.signature?.trim()) return { success: false, error: "Signature confirmation is required before submitting collection." };

  const reportDate = normalizeSheetDate(submission.date);
  let base = upsertCollectionForShopDate(submission.shopId, reportDate, submission.reportId, submission.employeeId, submission.employeeName);
  if (!base.ReportID) {
    const existingReport = getReports().find((row) => row.ShopID === submission.shopId && normalizeSheetDate(row.Date) === reportDate);
    if (existingReport) base = { ...base, ReportID: existingReport.ReportID };
  }

  const depositCash = toNumber(submission.depositCash);
  const depositLIPA = toNumber(submission.depositLIPA);
  const depositInBank = toNumber(submission.depositInBank);
  const efdZReport = toNumber(submission.efdZReport);
  const collections = getCollections();
  const index = collections.findIndex((row) => row.CollectionID === base.CollectionID);
  const next: CollectionEntry = {
    ...base,
    EmployeeID: submission.employeeId,
    EmployeeName: submission.employeeName,
    DepositCash: depositCash,
    DepositLIPA: depositLIPA,
    ExpectedCollection: base.CashSales,
    ActualCollection: calculateActualCollection(depositCash, depositLIPA),
    Variance: calculateCollectionVariance(base.CashSales, depositCash, depositLIPA),
    DepositInBank: depositInBank,
    BankDepositDifference: calculateBankDepositDifference(depositCash, depositInBank),
    DateOfDeposit: submission.dateOfDeposit || "",
    EFDZReport: efdZReport,
    SalesVsEFD: calculateSalesVsEfd(base.TotalSales, efdZReport),
    Name: submission.name || submission.employeeName,
    Signature: submission.signature,
    Remarks: submission.remarks || "",
    Status: "Submitted",
    SubmittedAt: nowIso(),
    UpdatedAt: nowIso(),
    ApprovedBy: "",
    ApprovedAt: ""
  };

  if (index >= 0) collections[index] = next;
  else collections.push(next);
  setStored<CollectionEntry>(STORAGE_KEYS.collections, collections);
  return { success: true, collection: next };
}

function updateMockCollectionByAdmin(data: ApiData, status?: CollectionEntry["Status"]): ApiResponse {
  const collections = getCollections();
  const index = collections.findIndex((row) =>
    data.collectionId
      ? row.CollectionID === String(data.collectionId)
      : row.ShopID === String(data.shopId) && normalizeSheetDate(row.Date) === normalizeSheetDate(String(data.date || ""))
  );
  if (index === -1) return { success: false, error: "Collection row not found." };
  const row = collections[index];
  const next: CollectionEntry = {
    ...row,
    AdminNote: data.adminNote !== undefined ? String(data.adminNote) : row.AdminNote,
    Status: status || row.Status,
    ApprovedBy: status === "Approved" ? String(data.adminId || data.userId || "") : status === "Rejected" || status === "Reopened" ? "" : row.ApprovedBy,
    ApprovedAt: status === "Approved" ? nowIso() : status === "Rejected" || status === "Reopened" ? "" : row.ApprovedAt,
    UpdatedAt: nowIso()
  };
  collections[index] = next;
  setStored<CollectionEntry>(STORAGE_KEYS.collections, collections);
  return { success: true, collection: next };
}

function getOpeningStock(shopId: string, date: string): OpeningStockEntry[] {
  const shop = getShops().find((item) => item.ShopID === shopId);
  const overrides = parseStored<OpeningStockOverrideRow>(STORAGE_KEYS.openingStock, []).filter((row) => row.ShopID === shopId);
  const stocks = getStocks()
    .filter((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) < normalizeSheetDate(date))
    .sort((a, b) => `${normalizeSheetDate(b.Date)}${b.CreatedAt}`.localeCompare(`${normalizeSheetDate(a.Date)}${a.CreatedAt}`));

  return getProducts()
    .filter((product) => product.Active === "Yes")
    .map((product) => {
      const lastStock = stocks.find((stock) => stock.ProductID === product.ProductID);
      const override = overrides.find((row) => row.ProductID === product.ProductID);
      return {
        ShopID: shopId,
        ShopName: shop?.ShopName || "",
        ProductID: product.ProductID,
        ProductName: product.ProductName,
        Category: product.Category,
        UOM: product.UOM,
        CurrentOpeningStock: override ? toNumber(override.OpeningStock) : toNumber(lastStock?.ActualClosing),
        LastUpdatedDate: override?.UpdatedAt || lastStock?.Date || ""
      };
    });
}

function submitMockReport(submission: DailyReportSubmission, mode: "sales" | "stock" | "full"): ApiResponse {
  const validationError = validateSubmission(submission, mode !== "stock", mode !== "sales");
  if (validationError) return { success: false, error: validationError };

  const reports = getReports();
  const reportDate = normalizeSheetDate(submission.date);
  const existingIndex = submission.reportId
    ? reports.findIndex((report) => report.ReportID === submission.reportId)
    : reports.findIndex((report) => report.ShopID === submission.shopId && normalizeSheetDate(report.Date) === reportDate);

  const existingReport = existingIndex >= 0 ? reports[existingIndex] : undefined;
  if (existingReport?.Status === "Approved") {
    return { success: false, error: "Approved reports cannot be changed. Ask admin to reopen it first." };
  }
  if (submission.reportId && existingReport && existingReport.Status !== "Reopened" && mode === "full") {
    return { success: false, error: "Only reopened reports can be corrected." };
  }

  const reportId = existingIndex >= 0 ? reports[existingIndex].ReportID : generateId("REP");
  removeRowsForReport(reportId, mode);

  const createdAt = nowIso();
  const salesRows = getSales();
  const stockRows = getStocks();

  if (mode !== "stock") {
    submission.salesEntries.forEach((sale) => {
      const totalAmount = calculateSalesAmount(sale.quantity, sale.rate);
      salesRows.push({
        EntryID: generateId("SAL"),
        ReportID: reportId,
        ShopID: submission.shopId,
        ShopName: submission.shopName,
        Date: reportDate,
        EmployeeID: submission.employeeId,
        EmployeeName: submission.employeeName,
        ProductID: sale.productId,
        ProductName: sale.productName,
        UOM: sale.uom,
        Quantity: toNumber(sale.quantity),
        Rate: toNumber(sale.rate),
        SaleType: sale.saleType,
        CashSales: sale.saleType === "Cash" ? totalAmount : 0,
        CreditSales: sale.saleType === "Credit" ? totalAmount : 0,
        EFDNumber: sale.efdNumber || "",
        CustomerName: sale.saleType === "Credit" ? sale.customerName || "" : "",
        TotalAmount: totalAmount,
        CreatedAt: createdAt
      });
    });
  }

  if (mode !== "sales") {
    const salesQuantityByProduct = getSalesQuantityByProduct(submission.shopId, reportDate);
    submission.stockEntries.forEach((stock: StockSubmissionItem) => {
      const opening = toNumber(stock.openingStock);
      const receipt = toNumber(stock.receipt);
      const sales = salesQuantityByProduct.get(stock.productId) ?? toNumber(stock.sales);
      const expected = calculateExpectedClosing(opening, receipt, sales);
      const actual = toNumber(stock.actualClosing);
      stockRows.push({
        EntryID: generateId("STK"),
        ReportID: reportId,
        ShopID: submission.shopId,
        ShopName: submission.shopName,
        Date: reportDate,
        EmployeeID: submission.employeeId,
        EmployeeName: submission.employeeName,
        ProductID: stock.productId,
        ProductName: stock.productName,
        Category: stock.category,
        UOM: stock.uom,
        MTNNo: stock.mtnNo || "",
        OpeningStock: opening,
        Receipt: receipt,
        Sales: sales,
        ExpectedClosing: expected,
        ActualClosing: actual,
        Mismatch: calculateMismatch(actual, expected),
        CreatedAt: createdAt
      });
    });
  }

  setStored<DailySalesEntry>(STORAGE_KEYS.sales, salesRows);
  setStored<DailyStockEntry>(STORAGE_KEYS.stocks, stockRows);

  if (mode === "sales") {
    recalculateExistingStockSales(reportId, submission.shopId, reportDate);
  }

  const report: DailyReport = {
    ReportID: reportId,
    ShopID: submission.shopId,
    ShopName: submission.shopName,
    Date: reportDate,
    EmployeeID: submission.employeeId,
    EmployeeName: submission.employeeName,
    SalesSubmitted: mode === "stock" ? existingReport?.SalesSubmitted || "No" : "Yes",
    StockSubmitted: mode === "sales" ? existingReport?.StockSubmitted || "No" : "Yes",
    Status: "Submitted",
    SubmittedAt: createdAt,
    ApprovedBy: "",
    ApprovedAt: "",
    TotalSales: 0,
    CashSales: 0,
    CreditSales: 0,
    StockMismatch: 0
  };

  if (existingIndex >= 0) reports[existingIndex] = report;
  else reports.push(report);
  setStored<DailyReport>(STORAGE_KEYS.reports, reports);

  upsertCollectionForShopDate(submission.shopId, reportDate, reportId, submission.employeeId, submission.employeeName);
  const totals = reportTotals(reportId);
  return {
    success: true,
    reportId,
    totalSales: totals.TotalSales,
    cashSales: totals.CashSales,
    creditSalesAmount: totals.CreditSales,
    mismatchCount: totals.StockMismatch
  };
}

function getReportRows(startDate?: string, endDate?: string, shopId?: string, employeeId?: string) {
  const summaries = getReports()
    .filter((report) => isDateInRange(report.Date, startDate, endDate))
    .filter((report) => !shopId || report.ShopID === shopId)
    .filter((report) => !employeeId || report.EmployeeID === employeeId)
    .map(enrichReport);
  const reportIds = new Set(summaries.map((report) => report.ReportID));

  return {
    summaries,
    sales: getSales().filter((row) => reportIds.has(row.ReportID)).map(withEmployeeName),
    stocks: getStocks().filter((row) => reportIds.has(row.ReportID)).map(withEmployeeName),
    creditSales: getCreditSalesRows().filter((row) => reportIds.has(row.ReportID))
  };
}

function getCreditSalesRows(): CreditSalesEntry[] {
  const statusByReport = new Map(getReports().map((report) => [report.ReportID, report.Status]));
  return getSales()
    .filter((sale) => sale.SaleType === "Credit")
    .map((sale) => ({
      EntryID: sale.EntryID,
      ReportID: sale.ReportID,
      ShopID: sale.ShopID,
      ShopName: sale.ShopName,
      Date: sale.Date,
      EmployeeID: sale.EmployeeID,
      EmployeeName: sale.EmployeeName || getEmployeeName(sale.EmployeeID),
      CustomerName: sale.CustomerName,
      ProductName: sale.ProductName,
      Amount: sale.CreditSales,
      EFDNumber: sale.EFDNumber,
      Status: statusByReport.get(sale.ReportID) || "Submitted",
      CreatedAt: sale.CreatedAt
    }));
}

function getDashboard(data: ApiData): DashboardData {
  const date = normalizeSheetDate(String(data.date || getLocalDateInputValue()));
  const month = String(data.month || date.slice(0, 7) || getMonthInputValue());
  const shopId = String(data.shopId || "");

  const monthSales = filterShop(getSales(), shopId).filter((row) => isMonth(row.Date, month));
  const monthStocks = filterShop(getStocks(), shopId).filter((row) => isMonth(row.Date, month));
  const monthReports = filterShop(getReports(), shopId).filter((row) => isMonth(row.Date, month)).map(enrichReport);
  const dateReports = monthReports.filter((row) => normalizeSheetDate(row.Date) === date);
  const monthCollections = filterShop(getCollections(), shopId)
    .filter((row) => row.Month === month)
    .sort((a, b) => a.Date.localeCompare(b.Date));
  const dateCollections = monthCollections.filter((row) => normalizeSheetDate(row.Date) === date);

  const cashSales = monthSales.reduce((sum, row) => sum + toNumber(row.CashSales), 0);
  const creditSales = monthSales.reduce((sum, row) => sum + toNumber(row.CreditSales), 0);
  const totalSales = cashSales + creditSales;
  const depositCash = monthCollections.reduce((sum, row) => sum + toNumber(row.DepositCash), 0);
  const depositLIPA = monthCollections.reduce((sum, row) => sum + toNumber(row.DepositLIPA), 0);
  const variance = monthCollections.reduce((sum, row) => sum + toNumber(row.Variance), 0);
  const efdDifference = monthCollections.reduce((sum, row) => sum + toNumber(row.SalesVsEFD), 0);
  const bankDepositDifference = monthCollections.reduce((sum, row) => sum + toNumber(row.BankDepositDifference), 0);
  const mismatchRows = monthStocks.filter((row) => toNumber(row.Mismatch) !== 0);

  const salesByDate = new Map<string, { cash: number; credit: number; total: number }>();
  monthSales.forEach((sale) => {
    const key = normalizeSheetDate(sale.Date);
    const existing = salesByDate.get(key) || { cash: 0, credit: 0, total: 0 };
    existing.cash += toNumber(sale.CashSales);
    existing.credit += toNumber(sale.CreditSales);
    existing.total += toNumber(sale.TotalAmount);
    salesByDate.set(key, existing);
  });

  const salesByShop = new Map<string, number>();
  monthSales.forEach((sale) => salesByShop.set(sale.ShopName, (salesByShop.get(sale.ShopName) || 0) + toNumber(sale.TotalAmount)));

  const salesByProduct = new Map<string, number>();
  monthSales.forEach((sale) => salesByProduct.set(sale.ProductName, (salesByProduct.get(sale.ProductName) || 0) + toNumber(sale.TotalAmount)));

  const mismatchByProduct = new Map<string, number>();
  mismatchRows.forEach((stock) => mismatchByProduct.set(stock.ProductName, (mismatchByProduct.get(stock.ProductName) || 0) + Math.abs(toNumber(stock.Mismatch))));

  return {
    stats: {
      totalSales,
      cashSales,
      creditSales,
      depositCash,
      depositLIPA,
      variance,
      efdDifference,
      bankDepositDifference,
      todayCashSales: dateCollections.reduce((sum, row) => sum + toNumber(row.CashSales), 0),
      todayLIPA: dateCollections.reduce((sum, row) => sum + toNumber(row.DepositLIPA), 0),
      todayBankDeposit: dateCollections.reduce((sum, row) => sum + toNumber(row.DepositInBank), 0),
      todayVariance: dateCollections.reduce((sum, row) => sum + toNumber(row.Variance), 0),
      pendingCollectionApprovals: monthCollections.filter((row) => row.Status === "Submitted" || row.Status === "Reopened").length,
      collectionsWithVariance: monthCollections.filter((row) => toNumber(row.Variance) !== 0).length,
      collectionsMissingEFD: monthCollections.filter((row) => toNumber(row.EFDZReport) === 0).length,
      bankDepositMismatches: monthCollections.filter((row) => toNumber(row.BankDepositDifference) !== 0).length,
      stockMismatch: mismatchRows.length,
      reportsSubmitted: dateReports.length,
      pendingApprovals: monthReports.filter((report) => report.Status === "Submitted" || report.Status === "Pending Approval").length
    },
    cashCreditSplit: [
      { name: "Cash Sales", value: cashSales },
      { name: "Credit Sales", value: creditSales }
    ].filter((point) => point.value > 0),
    dailySalesTrend: Array.from(salesByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name: name.slice(5), ...value, value: value.total })),
    shopSalesComparison: Array.from(salesByShop.entries()).map(([name, value]) => ({ name, value })),
    topSellingProducts: Array.from(salesByProduct.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value })),
    mismatchByProduct: Array.from(mismatchByProduct.entries()).map(([name, value]) => ({ name, value, mismatch: value })),
    todaySubmissions: dateReports.map((report) => {
      const totals = reportTotals(report.ReportID);
      const collection = getCollections().find((row) => row.ShopID === report.ShopID && normalizeSheetDate(row.Date) === normalizeSheetDate(report.Date));
      return {
        ReportID: report.ReportID,
        Shop: report.ShopName,
        Employee: report.EmployeeName,
        SalesTotal: totals.TotalSales,
        StockStatus: totals.StockMismatch > 0 ? `Mismatch ${totals.StockMismatch}` : report.StockSubmitted === "Yes" ? "Matched" : "Not submitted",
        CollectionStatus: collection?.Status || "Draft",
        ApprovalStatus: report.Status
      };
    }),
    collectionSummary: monthCollections,
    stockMismatchRows: mismatchRows,
    allSales: monthSales
  } as DashboardData & { allSales: typeof monthSales };
}

function updateReportStatus(reportId: string, status: ReportStatus, adminId: string): ApiResponse {
  const reports = getReports();
  const index = reports.findIndex((report) => report.ReportID === reportId);
  if (index === -1) return { success: false, error: "Report not found." };
  reports[index] = {
    ...reports[index],
    Status: status,
    ApprovedBy: status === "Approved" ? adminId : reports[index].ApprovedBy,
    ApprovedAt: status === "Approved" ? nowIso() : reports[index].ApprovedAt
  };
  setStored<DailyReport>(STORAGE_KEYS.reports, reports);
  return { success: true };
}

function getShopPrices(shopId?: string): ShopPriceRow[] {
  return parseStored<ShopPriceRow>(STORAGE_KEYS.shopPrices, []).filter((row) => !shopId || row.ShopID === shopId);
}

function saveShopPrices(shopId: string, prices: Array<{ productId?: string; ProductID?: string; rate?: number; Rate?: number }>): ApiResponse {
  if (!shopId) return { success: false, error: "Shop is required." };
  const existing = parseStored<ShopPriceRow>(STORAGE_KEYS.shopPrices, []).filter((row) => row.ShopID !== shopId);
  const rows = prices.map((price) => ({
    ShopID: shopId,
    ProductID: String(price.productId || price.ProductID || ""),
    Rate: toNumber(price.rate ?? price.Rate),
    UpdatedAt: nowIso()
  })).filter((price) => price.ProductID);
  setStored<ShopPriceRow>(STORAGE_KEYS.shopPrices, [...existing, ...rows]);
  return { success: true };
}

function submitMockMTN(data: ApiData): ApiResponse {
  const shopId = String(data.shopId || "");
  const mtnNo = String(data.mtnNo || "").trim();
  if (!shopId || !mtnNo) return { success: false, error: "MTN No and Shop are required." };

  const now = nowIso();
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const mtns = parseStored<MTNRow>(STORAGE_KEYS.mtn, []);
  const receiptMode = items.some((item) => toNumber(item.qtyReceived) > 0);

  if (receiptMode) {
    items.forEach((item) => {
      const productName = String(item.productName || "");
      const index = mtns.findIndex((row) => row.MTNNo === mtnNo && row.ToShopID === shopId && row.ProductName === productName);
      const qtyReceived = toNumber(item.qtyReceived);
      const variance = toNumber(item.variance);
      if (index >= 0) {
        mtns[index] = {
          ...mtns[index],
          EmployeeID: String(data.employeeId || ""),
          EmployeeName: String(data.employeeName || ""),
          QtyReceived: qtyReceived,
          Variance: variance,
          Status: "Received",
          Complaint: String(data.complaint || mtns[index].Complaint || "")
        };
      } else {
        mtns.push({
          MTNID: generateId("MTN"),
          MTNNo: mtnNo,
          MTNDate: String(data.mtnDate || getLocalDateInputValue()),
          From: String(data.from || "HO"),
          ToShopID: shopId,
          ToShopName: String(data.shopName || data.to || ""),
          EmployeeID: String(data.employeeId || ""),
          EmployeeName: String(data.employeeName || ""),
          ProductName: productName,
          QtyAsPerMTN: toNumber(item.qtyAsPerMTN),
          QtyReceived: qtyReceived,
          Variance: variance,
          Status: "Received",
          Complaint: String(data.complaint || ""),
          CreatedAt: now
        });
      }
    });
    setStored<MTNRow>(STORAGE_KEYS.mtn, mtns);
    return { success: true, reportId: mtns.find((row) => row.MTNNo === mtnNo)?.MTNID || generateId("MTN") };
  }

  const rows: MTNRow[] = items.map((item) => ({
    MTNID: generateId("MTN"),
    MTNNo: mtnNo,
    MTNDate: String(data.mtnDate || getLocalDateInputValue()),
    From: String(data.from || "HO"),
    ToShopID: shopId,
    ToShopName: String(data.shopName || data.to || ""),
    EmployeeID: String(data.employeeId || ""),
    EmployeeName: String(data.employeeName || ""),
    ProductName: String(item.productName || ""),
    QtyAsPerMTN: toNumber(item.qtyAsPerMTN),
    QtyReceived: 0,
    Variance: 0,
    Status: "Sent",
    Complaint: String(data.complaint || ""),
    CreatedAt: now
  }));
  setStored<MTNRow>(STORAGE_KEYS.mtn, [...mtns, ...rows]);
  return { success: true, reportId: rows[0]?.MTNID || generateId("MTN") };
}

async function callMockApi(action: string, data: ApiData = {}): Promise<ApiResponse> {
  seedMockDb();
  await new Promise((resolve) => window.setTimeout(resolve, 50));

  switch (action) {
    case "login": {
      const phone = String(data.phone || "").trim();
      const pin = String(data.pin || "").trim();
      const user = getUsers().find((item) => item.Phone.trim() === phone && String(item.PIN || "").trim() === pin);
      if (!user) return { success: false, error: "Invalid phone or PIN." };
      if (user.Status !== "Active") return { success: false, error: "Account inactive." };
      return { success: true, user: toSession(user) };
    }

    case "getShops":
      return { success: true, shops: getShops() };

    case "createShop": {
      const shops = getShops();
      const shopName = String(data.shopName || "").trim();
      if (!shopName) return { success: false, error: "Shop name is required." };
      if (shops.some((shop) => shop.ShopName.toLowerCase() === shopName.toLowerCase())) return { success: false, error: "Shop already exists." };
      const shop: Shop = {
        ShopID: generateId("SHOP"),
        ShopName: shopName,
        Location: String(data.location || "").trim(),
        InchargeName: String(data.inchargeName || "").trim(),
        InchargeContact: String(data.inchargeContact || "").trim(),
        Status: data.status === "Inactive" ? "Inactive" : "Active",
        CreatedAt: nowIso()
      };
      shops.push(shop);
      setStored<Shop>(STORAGE_KEYS.shops, shops);
      return { success: true, shopId: shop.ShopID };
    }

    case "updateShop": {
      const shops = getShops();
      const index = shops.findIndex((shop) => shop.ShopID === String(data.shopId || data.ShopID || ""));
      if (index === -1) return { success: false, error: "Shop not found." };
      shops[index] = {
        ...shops[index],
        ShopName: data.shopName ? String(data.shopName).trim() : shops[index].ShopName,
        Location: data.location !== undefined ? String(data.location).trim() : shops[index].Location,
        InchargeName: data.inchargeName !== undefined ? String(data.inchargeName).trim() : shops[index].InchargeName,
        InchargeContact: data.inchargeContact !== undefined ? String(data.inchargeContact).trim() : shops[index].InchargeContact,
        Status: data.status === "Inactive" ? "Inactive" : "Active"
      };
      setStored<Shop>(STORAGE_KEYS.shops, shops);
      return { success: true };
    }

    case "getUsers":
    case "getEmployees":
      return { success: true, users: getUsers().map(withoutPin), employees: getUsers().map(withoutPin) };

    case "createUser":
    case "createEmployee": {
      const users = getUsers();
      const phone = String(data.phone || "").trim();
      if (!phone) return { success: false, error: "Phone is required." };
      if (users.some((user) => user.Phone === phone)) return { success: false, error: "Phone number already exists." };
      const userId = generateId("USR");
      users.push({
        UserID: userId,
        EmployeeID: userId,
        Name: String(data.name || "").trim(),
        Phone: phone,
        PIN: String(data.pin || "").trim(),
        Role: data.role === "Admin" ? "Admin" : "Employee",
        ShopID: String(data.shopId || data.ShopID || ""),
        Status: data.status === "Inactive" ? "Inactive" : "Active",
        CreatedAt: nowIso()
      });
      setStored<User>(STORAGE_KEYS.users, users);
      return { success: true, userId, employeeId: userId };
    }

    case "updateUser":
    case "updateEmployee": {
      const users = getUsers();
      const userId = String(data.userId || data.employeeId || data.UserID || "");
      const index = users.findIndex((user) => user.UserID === userId);
      if (index === -1) return { success: false, error: "User not found." };
      users[index] = {
        ...users[index],
        Name: data.name ? String(data.name).trim() : users[index].Name,
        Phone: data.phone ? String(data.phone).trim() : users[index].Phone,
        PIN: data.pin ? String(data.pin).trim() : users[index].PIN,
        Role: data.role === "Admin" || data.role === "Employee" ? data.role : users[index].Role,
        ShopID: data.shopId !== undefined ? String(data.shopId) : users[index].ShopID,
        Status: data.status === "Inactive" ? "Inactive" : "Active"
      };
      setStored<User>(STORAGE_KEYS.users, users);
      return { success: true };
    }

    case "getProducts":
      return { success: true, products: getProducts() };

    case "createProduct": {
      const products = getProducts();
      const productId = generateId("PROD");
      products.push({
        ProductID: productId,
        ProductName: String(data.productName || "").trim(),
        Category: String(data.category || "Chicken").trim(),
        UOM: String(data.uom || "").trim(),
        DefaultRate: toNumber(data.defaultRate),
        Active: data.active === "No" ? "No" : "Yes",
        CreatedAt: nowIso()
      });
      setStored<Product>(STORAGE_KEYS.products, products);
      return { success: true, productId };
    }

    case "updateProduct": {
      const products = getProducts();
      const productId = String(data.productId || data.ProductID || "");
      const index = products.findIndex((product) => product.ProductID === productId);
      if (index === -1) return { success: false, error: "Product not found." };
      products[index] = {
        ...products[index],
        ProductName: data.productName ? String(data.productName).trim() : products[index].ProductName,
        Category: data.category ? String(data.category).trim() : products[index].Category,
        UOM: data.uom ? String(data.uom).trim() : products[index].UOM,
        DefaultRate: data.defaultRate !== undefined ? toNumber(data.defaultRate) : products[index].DefaultRate,
        Active: data.active === "No" ? "No" : "Yes"
      };
      setStored<Product>(STORAGE_KEYS.products, products);
      return { success: true };
    }

    case "getOpeningStock":
    case "getTodayOpeningStock": {
      const shopId = String(data.shopId || getUsers().find((user) => user.UserID === String(data.employeeId || ""))?.ShopID || getShops()[0]?.ShopID || "");
      const date = String(data.date || getLocalDateInputValue());
      return { success: true, openingStock: getOpeningStock(shopId, date) };
    }

    case "getTodayReport": {
      const shopId = String(data.shopId || "");
      const date = normalizeSheetDate(String(data.date || getLocalDateInputValue()));
      const report = getReports().find((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === date);
      return { success: true, report: report ? enrichReport(report) : undefined };
    }

    case "submitDailySales":
      return submitMockReport(data as unknown as DailyReportSubmission, "sales");

    case "submitDailyStock":
      return submitMockReport(data as unknown as DailyReportSubmission, "stock");

    case "submitFullDailyReport":
    case "submitDailyReport":
      return submitMockReport(data as unknown as DailyReportSubmission, "full");

    case "getMyReports":
    case "getEmployeeReports": {
      const employeeId = String(data.employeeId || "");
      const reports = getReports()
        .filter((report) => report.EmployeeID === employeeId)
        .map(enrichReport)
        .sort((a, b) => b.SubmittedAt.localeCompare(a.SubmittedAt));
      return { success: true, reports };
    }

    case "getDashboard":
    case "getAdminDashboard": {
      const dashboard = getDashboard(data);
      return { success: true, dashboard, stats: dashboard.stats, recentSummaries: getReports().map(enrichReport) };
    }

    case "getReportsByDate": {
      const bundle = getReportRows(
        data.startDate ? String(data.startDate) : undefined,
        data.endDate ? String(data.endDate) : undefined,
        data.shopId ? String(data.shopId) : undefined,
        data.employeeId ? String(data.employeeId) : undefined
      );
      return { success: true, ...bundle };
    }

    case "getDailySalesReport": {
      const rows = getSales()
        .filter((row) => isDateInRange(row.Date, data.startDate ? String(data.startDate) : undefined, data.endDate ? String(data.endDate) : undefined))
        .filter((row) => !data.shopId || row.ShopID === String(data.shopId))
        .map(withEmployeeName);
      return { success: true, sales: rows };
    }

    case "getDailyStockReport": {
      const rows = getStocks()
        .filter((row) => isDateInRange(row.Date, data.startDate ? String(data.startDate) : undefined, data.endDate ? String(data.endDate) : undefined))
        .filter((row) => !data.shopId || row.ShopID === String(data.shopId))
        .map(withEmployeeName);
      return { success: true, stocks: rows };
    }

    case "getTodayCollection": {
      const shopId = String(data.shopId || "");
      const date = normalizeSheetDate(String(data.date || getLocalDateInputValue()));
      const existing = getCollections().find((row) => row.ShopID === shopId && normalizeSheetDate(row.Date) === date);
      return { success: true, collection: existing || buildBaseCollection(shopId, date, data.reportId ? String(data.reportId) : undefined) };
    }

    case "submitDailyCollection":
      return submitMockCollection(data as unknown as CollectionSubmission);

    case "getCollections":
      return { success: true, collections: filterCollections(data) };

    case "getMonthlyCollectionReport":
      return { success: true, collections: filterCollections({ ...data, month: String(data.month || getMonthInputValue()) }) };

    case "updateCollectionByAdmin":
    case "updateCollectionDeposit":
      return updateMockCollectionByAdmin(data);

    case "approveCollection":
      return updateMockCollectionByAdmin(data, "Approved");

    case "rejectCollection":
      return updateMockCollectionByAdmin({ ...data, adminNote: String(data.reason || data.adminNote || "") }, "Rejected");

    case "reopenCollection":
      return updateMockCollectionByAdmin(data, "Reopened");

    case "approveReport":
      return updateReportStatus(String(data.reportId || ""), "Approved", String(data.adminId || data.userId || ""));

    case "rejectReport":
      return updateReportStatus(String(data.reportId || ""), "Rejected", String(data.adminId || data.userId || ""));

    case "reopenReport":
      return updateReportStatus(String(data.reportId || ""), "Reopened", String(data.adminId || data.userId || ""));

    case "getStockMismatchReport": {
      const rows = getStocks()
        .filter((row) => toNumber(row.Mismatch) !== 0)
        .filter((row) => isDateInRange(row.Date, data.startDate ? String(data.startDate) : undefined, data.endDate ? String(data.endDate) : undefined))
        .filter((row) => !data.shopId || row.ShopID === String(data.shopId))
        .map(withEmployeeName);
      return { success: true, stocks: rows };
    }

    case "getCreditSalesReport": {
      const rows = getCreditSalesRows()
        .filter((row) => isDateInRange(row.Date, data.startDate ? String(data.startDate) : undefined, data.endDate ? String(data.endDate) : undefined))
        .filter((row) => !data.shopId || row.ShopID === String(data.shopId));
      return { success: true, creditSales: rows };
    }

    case "getLiveWeight":
      return { success: true, liveWeight: parseStored<unknown>(STORAGE_KEYS.liveWeight, []) };

    case "submitLiveWeight": {
      const liveWeightList = parseStored<LiveWeightEntry>(STORAGE_KEYS.liveWeight, []);
      const shop = getShops().find((s) => s.ShopID === String(data.shopId));
      const entry: LiveWeightEntry = {
        LiveWeightID: generateId("LW"),
        ShopID: String(data.shopId),
        ShopName: shop?.ShopName || "",
        Date: String(data.date),
        Crates: toNumber(data.crates),
        TotalBirds: toNumber(data.totalBirds),
        NetLiveWeightKG: toNumber(data.netLiveWeightKG),
        AvgLiveWeightKG: toNumber(data.avgLiveWeightKG),
        DOA: toNumber(data.doa),
        InjuredBirds: toNumber(data.injuredBirds),
        Shortage: toNumber(data.shortage),
        NetAcceptedBirds: toNumber(data.netAcceptedBirds),
        CreatedAt: nowIso()
      };
      liveWeightList.push(entry);
      setStored<LiveWeightEntry>(STORAGE_KEYS.liveWeight, liveWeightList);
      return { success: true, reportId: entry.LiveWeightID };
    }

    case "submitMTN":
      return submitMockMTN(data);

    case "getMTNsForShop": {
      const shopId = String(data.shopId || "");
      const mtns = parseStored<MTNRow>(STORAGE_KEYS.mtn, []).filter((row) => !shopId || row.ToShopID === shopId);
      return { success: true, mtns };
    }

    case "getShopPrices": {
      const shopId = data.shopId ? String(data.shopId) : "";
      return { success: true, prices: getShopPrices(shopId) };
    }

    case "saveShopPrices":
      return saveShopPrices(String(data.shopId || ""), Array.isArray(data.prices) ? data.prices as Array<{ productId?: string; ProductID?: string; rate?: number; Rate?: number }> : []);

    case "updateOpeningStock": {
      const shopId = String(data.shopId || "");
      const productId = String(data.productId || "");
      if (!shopId || !productId) return { success: false, error: "Shop and Product are required." };
      const openingStock = toNumber(data.openingStock);
      const rows = parseStored<OpeningStockOverrideRow>(STORAGE_KEYS.openingStock, []).filter((row) => !(row.ShopID === shopId && row.ProductID === productId));
      rows.push({ ShopID: shopId, ProductID: productId, OpeningStock: openingStock, UpdatedAt: nowIso() });
      setStored<OpeningStockOverrideRow>(STORAGE_KEYS.openingStock, rows);
      return { success: true };
    }

    default:
      return { success: false, error: `Action not supported in Mock API: ${action}` };
  }
}

const CACHE_TTL = 5 * 60 * 1000; // 5 min for static data
const SHORT_CACHE_TTL = 60 * 1000; // 1 min for dynamic data
const cache = new Map<string, { data: ApiResponse; timestamp: number; ttl: number }>();

function getCached(key: string): ApiResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: ApiResponse, ttl?: number) {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttl || CACHE_TTL });
}

function invalidateCache() {
  cache.clear();
}

async function runSetup(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "setupSheets", data: {} })
    });
    if (!response.ok) return false;
    const result = (await response.json()) as ApiResponse;
    return result.success;
  } catch {
    return false;
  }
}

function isMissingSheetError(result: ApiResponse): boolean {
  return !result.success && typeof result.error === "string" && result.error.includes("Missing sheet:");
}

async function callApi(action: string, data: ApiData = {}): Promise<ApiResponse> {
  const url = getApiUrl();

  if (isMockMode()) {
    return callMockApi(action, data);
  }

  // Cacheable reads - static data (5 min cache)
  const staticReads = ["getShops", "getProducts", "getUsers", "getEmployees"];
  // Cacheable reads - dynamic data (1 min cache)
  const dynamicReads = ["getOpeningStock", "getTodayOpeningStock", "getMyReports", "getEmployeeReports", "getDailySalesReport", "getDailyStockReport", "getTodayReport", "getTodayCollection", "getCollections", "getDashboard", "getAdminDashboard", "getReportsByDate", "getMTNsForShop", "getShopPrices"];
  const cacheKey = `${action}_${JSON.stringify(data)}`;

  if (staticReads.includes(action)) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  if (dynamicReads.includes(action)) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const writeActions = ["createShop", "updateShop", "createUser", "updateUser", "createEmployee", "updateEmployee", "createProduct", "updateProduct", "submitDailySales", "submitDailyStock", "submitFullDailyReport", "submitDailyReport", "submitDailyCollection", "approveReport", "rejectReport", "reopenReport", "approveCollection", "rejectCollection", "reopenCollection", "updateOpeningStock", "updateCollectionByAdmin", "updateCollectionDeposit", "submitMTN", "submitLiveWeight", "saveShopPrices"];
  if (writeActions.includes(action)) {
    invalidateCache();
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);

  try {
    const requestBody = JSON.stringify({ action, data });
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: requestBody,
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.json()) as ApiResponse;

    if (isMissingSheetError(result) && action !== "setupSheets" && await runSetup(url)) {
      const retryResponse = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: requestBody
      });
      if (!retryResponse.ok) throw new Error(`HTTP ${retryResponse.status}`);
      return (await retryResponse.json()) as ApiResponse;
    }

    if (result.success) {
      if (staticReads.includes(action)) setCache(cacheKey, result, CACHE_TTL);
      else if (dynamicReads.includes(action)) setCache(cacheKey, result, SHORT_CACHE_TTL);
    }

    return result;
  } catch (error) {
    console.error(`[API] ${action} failed:`, error);
    return { success: false, error: "Network error. Check connection and try again." };
  } finally {
    window.clearTimeout(timeout);
  }
}

export const appsScriptClient = {
  login: (phone: string, pin: string) => callApi("login", { phone, pin }),
  setupSheets: () => callApi("setupSheets"),
  // Warm frequently used reads after login.
  syncAfterLogin: async (userId: string, shopId: string): Promise<void> => {
    const url = (import.meta.env.VITE_APPS_SCRIPT_URL || "").trim();
    if (!url) return;
    try {
      await Promise.all([
        callApi("getShops"),
        callApi("getProducts"),
        callApi("getMyReports", { employeeId: userId }),
        callApi("getOpeningStock", { shopId, employeeId: userId })
      ]);
      const today = getLocalDateInputValue();
      await Promise.all([
        callApi("getDailySalesReport", { shopId, startDate: today, endDate: today }),
        callApi("getDailyStockReport", { shopId, startDate: today, endDate: today }),
        callApi("getTodayCollection", { shopId, date: today })
      ]);
    } catch { /* silent */ }
  },
  getShops: () => callApi("getShops"),
  createShop: (shopData: { shopName: string; location: string; inchargeName: string; inchargeContact: string; status: string }) =>
    callApi("createShop", shopData),
  updateShop: (shopData: { shopId: string; shopName?: string; location?: string; inchargeName?: string; inchargeContact?: string; status?: string }) =>
    callApi("updateShop", shopData),
  getUsers: () => callApi("getUsers"),
  createUser: (userData: { name: string; phone: string; pin: string; role: string; shopId: string; status: string }) =>
    callApi("createUser", userData),
  updateUser: (userData: { userId: string; name?: string; phone?: string; pin?: string; role?: string; shopId?: string; status?: string }) =>
    callApi("updateUser", userData),
  getEmployees: () => callApi("getUsers"),
  createEmployee: (userData: { name: string; phone: string; pin: string; role: string; shopId?: string; status: string }) =>
    callApi("createUser", { ...userData, shopId: userData.shopId || "" }),
  updateEmployee: (userData: { employeeId: string; name?: string; phone?: string; pin?: string; role?: string; shopId?: string; status?: string }) =>
    callApi("updateUser", { ...userData, userId: userData.employeeId }),
  getProducts: () => callApi("getProducts"),
  createProduct: (productData: { productName: string; category: string; uom: string; defaultRate: number; active: string }) =>
    callApi("createProduct", productData),
  updateProduct: (productData: { productId: string; productName?: string; category?: string; uom?: string; defaultRate?: number; active?: string }) =>
    callApi("updateProduct", productData),
  getTodayReport: (employeeId: string, shopId: string, date: string) => callApi("getTodayReport", { employeeId, shopId, date }),
  getOpeningStock: (shopId: string, date: string, employeeId?: string) => callApi("getOpeningStock", { shopId, date, employeeId }),
  getTodayOpeningStock: (shopId?: string, date?: string) => callApi("getOpeningStock", { shopId, date }),
  submitDailySales: (submission: DailyReportSubmission) => callApi("submitDailySales", submission as unknown as ApiData),
  submitDailyStock: (submission: DailyReportSubmission) => callApi("submitDailyStock", submission as unknown as ApiData),
  submitFullDailyReport: (submission: DailyReportSubmission) => callApi("submitFullDailyReport", submission as unknown as ApiData),
  submitDailyReport: (submission: DailyReportSubmission) => callApi("submitFullDailyReport", submission as unknown as ApiData),
  getMyReports: (employeeId: string) => callApi("getMyReports", { employeeId }),
  getEmployeeReports: (employeeId: string) => callApi("getMyReports", { employeeId }),
  getDashboard: (filters: { shopId?: string; date?: string; month?: string }) => callApi("getDashboard", filters),
  getAdminDashboard: (date?: string, shopId?: string, month?: string) => callApi("getDashboard", { date, shopId, month }),
  getDailySalesReport: (filters: { shopId?: string; startDate?: string; endDate?: string }) => callApi("getDailySalesReport", filters),
  getDailyStockReport: (filters: { shopId?: string; startDate?: string; endDate?: string }) => callApi("getDailyStockReport", filters),
  getReportsByDate: (startDate?: string, endDate?: string, employeeId?: string, shopId?: string) =>
    callApi("getReportsByDate", { startDate, endDate, employeeId, shopId }),
  getTodayCollection: (filters: { shopId: string; date: string; reportId?: string }) => callApi("getTodayCollection", filters),
  submitDailyCollection: (submission: CollectionSubmission) => callApi("submitDailyCollection", submission as unknown as ApiData),
  getCollections: (filters: { shopId?: string; startDate?: string; endDate?: string; month?: string; status?: string; search?: string }) =>
    callApi("getCollections", filters),
  getMonthlyCollectionReport: (filters: { shopId?: string; month: string }) => callApi("getMonthlyCollectionReport", filters),
  updateCollectionByAdmin: (payload: {
    collectionId: string;
    depositCash?: number;
    depositLIPA?: number;
    depositInBank?: number;
    dateOfDeposit?: string;
    efdZReport?: number;
    name?: string;
    signature?: string;
    remarks?: string;
    adminNote?: string;
  }) => callApi("updateCollectionByAdmin", payload),
  updateCollectionDeposit: (payload: {
    collectionId: string;
    depositCash?: number;
    depositLIPA?: number;
    depositInBank?: number;
    dateOfDeposit?: string;
    efdZReport?: number;
    name?: string;
    signature?: string;
  }) => callApi("updateCollectionDeposit", payload),
  approveCollection: (collectionId: string, adminId: string, adminNote?: string) => callApi("approveCollection", { collectionId, adminId, adminNote }),
  rejectCollection: (collectionId: string, adminId: string, reason: string) => callApi("rejectCollection", { collectionId, adminId, reason }),
  reopenCollection: (collectionId: string, adminId: string, adminNote?: string) => callApi("reopenCollection", { collectionId, adminId, adminNote }),
  approveReport: (reportId: string, adminId: string) => callApi("approveReport", { reportId, adminId }),
  rejectReport: (reportId: string, adminId: string) => callApi("rejectReport", { reportId, adminId }),
  reopenReport: (reportId: string, adminId: string) => callApi("reopenReport", { reportId, adminId }),
  getStockMismatchReport: (filters: { shopId?: string; startDate?: string; endDate?: string }) => callApi("getStockMismatchReport", filters),
  getCreditSalesReport: (filters: { shopId?: string; startDate?: string; endDate?: string }) => callApi("getCreditSalesReport", filters),
  getLiveWeight: () => callApi("getLiveWeight"),
  submitLiveWeight: (payload: {
    shopId: string;
    date: string;
    employeeId: string;
    crates: number;
    totalBirds: number;
    netLiveWeightKG: number;
    avgLiveWeightKG: number;
    doa: number;
    injuredBirds: number;
    shortage: number;
    netAcceptedBirds: number;
  }) => callApi("submitLiveWeight", payload),
  submitMTN: (payload: {
    mtnNo: string;
    mtnDate: string;
    from: string;
    to: string;
    shopId: string;
    shopName: string;
    employeeId: string;
    employeeName: string;
    items: Array<{ productId: string; productName: string; category: string; uom: string; qtyAsPerMTN: number; qtyReceived: number; variance: number }>;
    complaint?: string;
  }) => callApi("submitMTN", payload),
  getMTNsForShop: (shopId: string) => callApi("getMTNsForShop", { shopId }),
  getShopPrices: (shopId?: string) => callApi("getShopPrices", { shopId }),
  saveShopPrices: (shopId: string, prices: Array<{ productId: string; rate: number }>) => callApi("saveShopPrices", { shopId, prices }),
  updateOpeningStock: (payload: { shopId: string; productId: string; openingStock: number }) => callApi("updateOpeningStock", payload)
};
