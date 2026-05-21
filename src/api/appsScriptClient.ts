import type {
  CreditSalesEntry,
  DailyReportSubmission,
  DailySalesEntry,
  DailyStockEntry,
  DailySummaryEntry,
  Employee,
  OpeningStockEntry,
  Product,
  UserSession
} from "../types";
import { getLocalDateInputValue } from "../utils/date";

interface ApiResponse {
  success: boolean;
  error?: string;
  user?: UserSession;
  products?: Product[];
  employees?: Employee[];
  openingStock?: OpeningStockEntry[];
  summaries?: DailySummaryEntry[];
  sales?: DailySalesEntry[];
  stocks?: DailyStockEntry[];
  creditSales?: CreditSalesEntry[];
  reports?: DailySummaryEntry[];
  stats?: unknown;
  recentSummaries?: DailySummaryEntry[];
  reportId?: string;
  totalSales?: number;
  cashSales?: number;
  creditSalesAmount?: number;
  mismatchCount?: number;
  employeeId?: string;
  productId?: string;
}

const STORAGE_KEYS = {
  employees: "db_employees",
  products: "db_products",
  openingStock: "db_opening_stock",
  dailySales: "db_daily_sales",
  dailyStock: "db_daily_stock",
  dailySummary: "db_daily_summary",
  creditSales: "db_credit_sales",
  logs: "db_logs"
};

const getApiUrl = (): string => {
  const url = import.meta.env.VITE_APPS_SCRIPT_URL || "";
  return url.trim();
};

export const isMockMode = (): boolean => {
  const url = getApiUrl();
  return !url || url.includes("YOUR_DEPLOYED_ID_HERE");
};

function parseStored<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initMockDb() {
  if (!localStorage.getItem(STORAGE_KEYS.employees)) {
    setStored<Employee>(STORAGE_KEYS.employees, [
      { EmployeeID: "EMP001", Name: "Admin User", Phone: "+1234567890", PIN: "1234", Role: "Admin", Status: "Active", CreatedAt: new Date().toISOString() },
      { EmployeeID: "EMP002", Name: "Sales Employee", Phone: "+1234567891", PIN: "5678", Role: "Employee", Status: "Active", CreatedAt: new Date().toISOString() }
    ]);
  }

  if (!localStorage.getItem(STORAGE_KEYS.products)) {
    setStored<Product>(STORAGE_KEYS.products, [
      { ProductID: "PROD001", ProductName: "Apple", Category: "Fruit", UOM: "KG", DefaultRate: 150, Active: "Yes" },
      { ProductID: "PROD002", ProductName: "Banana", Category: "Fruit", UOM: "Dozen", DefaultRate: 60, Active: "Yes" },
      { ProductID: "PROD003", ProductName: "Milk", Category: "Dairy", UOM: "Litre", DefaultRate: 50, Active: "Yes" },
      { ProductID: "PROD004", ProductName: "Bread", Category: "Bakery", UOM: "Packet", DefaultRate: 40, Active: "Yes" },
      { ProductID: "PROD005", ProductName: "Eggs", Category: "Bakery", UOM: "Box", DefaultRate: 120, Active: "Yes" },
      { ProductID: "PROD006", ProductName: "Rice", Category: "Grocery", UOM: "KG", DefaultRate: 80, Active: "Yes" }
    ]);
  }

  if (!localStorage.getItem(STORAGE_KEYS.openingStock)) {
    setStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, [
      { ProductID: "PROD001", ProductName: "Apple", CurrentOpeningStock: 100, LastUpdatedDate: new Date().toISOString() },
      { ProductID: "PROD002", ProductName: "Banana", CurrentOpeningStock: 100, LastUpdatedDate: new Date().toISOString() },
      { ProductID: "PROD003", ProductName: "Milk", CurrentOpeningStock: 150, LastUpdatedDate: new Date().toISOString() },
      { ProductID: "PROD004", ProductName: "Bread", CurrentOpeningStock: 75, LastUpdatedDate: new Date().toISOString() },
      { ProductID: "PROD005", ProductName: "Eggs", CurrentOpeningStock: 50, LastUpdatedDate: new Date().toISOString() },
      { ProductID: "PROD006", ProductName: "Rice", CurrentOpeningStock: 200, LastUpdatedDate: new Date().toISOString() }
    ]);
  }

  if (!localStorage.getItem(STORAGE_KEYS.dailySales)) setStored<DailySalesEntry>(STORAGE_KEYS.dailySales, []);
  if (!localStorage.getItem(STORAGE_KEYS.dailyStock)) setStored<DailyStockEntry>(STORAGE_KEYS.dailyStock, []);
  if (!localStorage.getItem(STORAGE_KEYS.dailySummary)) setStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []);
  if (!localStorage.getItem(STORAGE_KEYS.creditSales)) setStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, []);
  if (!localStorage.getItem(STORAGE_KEYS.logs)) setStored<Record<string, string>>(STORAGE_KEYS.logs, []);
}

function getEmployees() {
  return parseStored<Employee>(STORAGE_KEYS.employees, []);
}

function getProducts() {
  return parseStored<Product>(STORAGE_KEYS.products, []);
}

function validateSubmission(submission: DailyReportSubmission): string | null {
  const employees = getEmployees();
  const products = getProducts();
  const employee = employees.find((item) => item.EmployeeID === submission.employeeId);

  if (!employee || employee.Status !== "Active") return "Active employee account is required to submit a report.";
  if (employee.Role !== "Employee") return "Only employee accounts can submit daily reports.";
  if (!submission.date) return "Report date is required.";
  if (!Array.isArray(submission.stockEntries) || submission.stockEntries.length === 0) return "Stock entries are required.";

  const activeProductIds = new Set(products.filter((product) => product.Active === "Yes").map((product) => product.ProductID));

  for (const sale of submission.salesEntries || []) {
    if (!activeProductIds.has(sale.productId)) return `Inactive or unknown product in sales: ${sale.productName}`;
    if (!Number.isFinite(Number(sale.quantity)) || Number(sale.quantity) <= 0) return `Invalid quantity for ${sale.productName}.`;
    if (!Number.isFinite(Number(sale.rate)) || Number(sale.rate) < 0) return `Invalid rate for ${sale.productName}.`;
    if (sale.saleType === "Credit" && !sale.customerName?.trim()) return `Customer name is required for credit sale: ${sale.productName}.`;
  }

  for (const stock of submission.stockEntries) {
    if (!activeProductIds.has(stock.productId)) return `Inactive or unknown product in stock: ${stock.productName}`;
    if (!Number.isFinite(Number(stock.openingStock))) return `Invalid opening stock for ${stock.productName}.`;
    if (!Number.isFinite(Number(stock.receipt))) return `Invalid receipt for ${stock.productName}.`;
    if (!Number.isFinite(Number(stock.sales))) return `Invalid sales quantity for ${stock.productName}.`;
    if (stock.actualClosing === undefined || !Number.isFinite(Number(stock.actualClosing))) return `Actual closing stock is required for ${stock.productName}.`;
  }

  return null;
}

function removeRowsForReport(reportId: string) {
  setStored<DailySalesEntry>(
    STORAGE_KEYS.dailySales,
    parseStored<DailySalesEntry>(STORAGE_KEYS.dailySales, []).filter((row) => row.ReportID !== reportId)
  );
  setStored<DailyStockEntry>(
    STORAGE_KEYS.dailyStock,
    parseStored<DailyStockEntry>(STORAGE_KEYS.dailyStock, []).filter((row) => row.ReportID !== reportId)
  );
  setStored<CreditSalesEntry>(
    STORAGE_KEYS.creditSales,
    parseStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, []).filter((row) => row.ReportID !== reportId)
  );
}

function submitMockDailyReport(submission: DailyReportSubmission): ApiResponse {
  const validationError = validateSubmission(submission);
  if (validationError) return { success: false, error: validationError };

  const summaries = parseStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []);
  const correctionIndex = submission.reportId
    ? summaries.findIndex((summary) => summary.ReportID === submission.reportId)
    : -1;

  if (submission.reportId) {
    if (correctionIndex === -1) return { success: false, error: "Reopened report was not found." };
    if (summaries[correctionIndex].Status !== "Reopened") return { success: false, error: "Only reopened reports can be corrected." };
    removeRowsForReport(submission.reportId);
  }

  const reportId = submission.reportId || `REP${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const dateStr = submission.date || getLocalDateInputValue();
  const salesRows = parseStored<DailySalesEntry>(STORAGE_KEYS.dailySales, []);
  const stockRows = parseStored<DailyStockEntry>(STORAGE_KEYS.dailyStock, []);
  const creditRows = parseStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, []);
  const openingRows = parseStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, []);

  let totalSales = 0;
  let cashSales = 0;
  let creditSales = 0;
  let mismatchCount = 0;
  const createdAt = new Date().toISOString();

  submission.salesEntries.forEach((sale) => {
    const totalAmount = Number(sale.quantity) * Number(sale.rate);
    const cashAmount = sale.saleType === "Cash" ? totalAmount : 0;
    const creditAmount = sale.saleType === "Credit" ? totalAmount : 0;
    totalSales += totalAmount;
    cashSales += cashAmount;
    creditSales += creditAmount;

    salesRows.push({
      ReportID: reportId,
      Date: dateStr,
      EmployeeID: submission.employeeId,
      EmployeeName: submission.employeeName,
      ProductID: sale.productId,
      ProductName: sale.productName,
      UOM: sale.uom,
      Quantity: Number(sale.quantity),
      Rate: Number(sale.rate),
      SaleType: sale.saleType,
      CashSales: cashAmount,
      CreditSales: creditAmount,
      EFDNumber: sale.efdNumber || "",
      CustomerName: sale.customerName || "",
      TotalAmount: totalAmount,
      CreatedAt: createdAt
    });

    if (sale.saleType === "Credit") {
      creditRows.push({
        ReportID: reportId,
        Date: dateStr,
        EmployeeID: submission.employeeId,
        EmployeeName: submission.employeeName,
        CustomerName: sale.customerName || "",
        ProductName: sale.productName,
        Amount: totalAmount,
        EFDNumber: sale.efdNumber || "",
        Status: "Pending Approval",
        CreatedAt: createdAt
      });
    }
  });

  submission.stockEntries.forEach((stock) => {
    const opening = Number(stock.openingStock);
    const receipt = Number(stock.receipt || 0);
    const sales = Number(stock.sales || 0);
    const expected = opening + receipt - sales;
    const actual = Number(stock.actualClosing);
    const mismatch = actual - expected;
    if (mismatch !== 0) mismatchCount += 1;

    stockRows.push({
      ReportID: reportId,
      Date: dateStr,
      EmployeeID: submission.employeeId,
      EmployeeName: submission.employeeName,
      ProductID: stock.productId,
      ProductName: stock.productName,
      Category: stock.category,
      UOM: stock.uom,
      OpeningStock: opening,
      Receipt: receipt,
      Sales: sales,
      ExpectedClosing: expected,
      ActualClosing: actual,
      Mismatch: mismatch,
      CreatedAt: createdAt
    });

    const openingIndex = openingRows.findIndex((row) => row.ProductID === stock.productId);
    if (openingIndex >= 0) {
      openingRows[openingIndex] = {
        ...openingRows[openingIndex],
        ProductName: stock.productName,
        CurrentOpeningStock: actual,
        LastUpdatedDate: createdAt
      };
    }
  });

  const summary: DailySummaryEntry = {
    ReportID: reportId,
    Date: dateStr,
    EmployeeID: submission.employeeId,
    EmployeeName: submission.employeeName,
    TotalSales: totalSales,
    CashSales: cashSales,
    CreditSales: creditSales,
    TotalStockSales: totalSales,
    StockMismatch: mismatchCount,
    Status: "Pending Approval",
    SubmittedAt: createdAt
  };

  if (correctionIndex >= 0) {
    summaries[correctionIndex] = summary;
  } else {
    summaries.push(summary);
  }

  setStored<DailySalesEntry>(STORAGE_KEYS.dailySales, salesRows);
  setStored<DailyStockEntry>(STORAGE_KEYS.dailyStock, stockRows);
  setStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, creditRows);
  setStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, openingRows);
  setStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, summaries);

  return { success: true, reportId, totalSales, cashSales, creditSalesAmount: creditSales, mismatchCount };
}

function filterByDateAndEmployee<T extends { Date: string; EmployeeID: string }>(
  rows: T[],
  startDate?: string,
  endDate?: string,
  employeeId?: string
): T[] {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  return rows.filter((row) => {
    const rowDate = new Date(`${String(row.Date).split("T")[0]}T12:00:00`);
    if (start && rowDate < start) return false;
    if (end && rowDate > end) return false;
    if (employeeId && row.EmployeeID !== employeeId) return false;
    return true;
  });
}

async function callMockApi(action: string, data: Record<string, unknown>): Promise<ApiResponse> {
  initMockDb();
  await new Promise((resolve) => window.setTimeout(resolve, 250));

  switch (action) {
    case "login": {
      const phone = String(data.phone || "").trim();
      const pin = String(data.pin || "").trim();
      const employee = getEmployees().find((item) => item.Phone.trim() === phone && String(item.PIN || "").trim() === pin);
      if (!employee) return { success: false, error: "Invalid Phone or PIN" };
      if (employee.Status !== "Active") return { success: false, error: "Account inactive." };
      return {
        success: true,
        user: {
          employeeId: employee.EmployeeID,
          name: employee.Name,
          phone: employee.Phone,
          role: employee.Role,
          status: employee.Status
        }
      };
    }

    case "getProducts":
      return { success: true, products: getProducts() };

    case "getEmployees":
      return {
        success: true,
        employees: getEmployees().map((employee) => {
          const safeEmployee = { ...employee };
          delete safeEmployee.PIN;
          return safeEmployee;
        })
      };

    case "createEmployee": {
      const employees = getEmployees();
      const phone = String(data.phone || "").trim();
      if (employees.some((employee) => employee.Phone === phone)) return { success: false, error: "Phone number already exists" };
      const employeeId = `EMP${employees.length + 101}`;
      employees.push({
        EmployeeID: employeeId,
        Name: String(data.name || "").trim(),
        Phone: phone,
        PIN: String(data.pin || "").trim(),
        Role: data.role === "Admin" ? "Admin" : "Employee",
        Status: data.status === "Inactive" ? "Inactive" : "Active",
        CreatedAt: new Date().toISOString()
      });
      setStored<Employee>(STORAGE_KEYS.employees, employees);
      return { success: true, employeeId };
    }

    case "updateEmployee": {
      const employees = getEmployees();
      const employeeId = String(data.employeeId || "");
      const index = employees.findIndex((employee) => employee.EmployeeID === employeeId);
      if (index === -1) return { success: false, error: "Employee not found" };
      employees[index] = {
        ...employees[index],
        Name: data.name ? String(data.name).trim() : employees[index].Name,
        Phone: data.phone ? String(data.phone).trim() : employees[index].Phone,
        PIN: data.pin ? String(data.pin).trim() : employees[index].PIN,
        Role: data.role === "Admin" || data.role === "Employee" ? data.role : employees[index].Role,
        Status: data.status === "Active" || data.status === "Inactive" ? data.status : employees[index].Status
      };
      setStored<Employee>(STORAGE_KEYS.employees, employees);
      return { success: true };
    }

    case "createProduct": {
      const products = getProducts();
      const productId = `PROD${products.length + 101}`;
      const productName = String(data.productName || "").trim();
      products.push({
        ProductID: productId,
        ProductName: productName,
        Category: String(data.category || "General").trim(),
        UOM: String(data.uom || "").trim(),
        DefaultRate: Number(data.defaultRate || 0),
        Active: data.active === "No" ? "No" : "Yes"
      });
      setStored<Product>(STORAGE_KEYS.products, products);
      const openingRows = parseStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, []);
      openingRows.push({ ProductID: productId, ProductName: productName, CurrentOpeningStock: 0, LastUpdatedDate: new Date().toISOString() });
      setStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, openingRows);
      return { success: true, productId };
    }

    case "updateProduct": {
      const products = getProducts();
      const productId = String(data.productId || "");
      const index = products.findIndex((product) => product.ProductID === productId);
      if (index === -1) return { success: false, error: "Product not found" };
      products[index] = {
        ...products[index],
        ProductName: data.productName ? String(data.productName).trim() : products[index].ProductName,
        Category: data.category ? String(data.category).trim() : products[index].Category,
        UOM: data.uom ? String(data.uom).trim() : products[index].UOM,
        DefaultRate: data.defaultRate !== undefined ? Number(data.defaultRate) : products[index].DefaultRate,
        Active: data.active === "Yes" || data.active === "No" ? data.active : products[index].Active
      };
      setStored<Product>(STORAGE_KEYS.products, products);
      return { success: true };
    }

    case "getTodayOpeningStock":
      return { success: true, openingStock: parseStored<OpeningStockEntry>(STORAGE_KEYS.openingStock, []) };

    case "submitDailyReport":
      return submitMockDailyReport(data as unknown as DailyReportSubmission);

    case "getAdminDashboard": {
      const targetDate = String(data.date || getLocalDateInputValue());
      const summaries = filterByDateAndEmployee(parseStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []), targetDate, targetDate);
      const sales = filterByDateAndEmployee(parseStored<DailySalesEntry>(STORAGE_KEYS.dailySales, []), targetDate, targetDate);
      const totalSales = summaries.reduce((sum, item) => sum + Number(item.TotalSales || 0), 0);
      const cashSales = summaries.reduce((sum, item) => sum + Number(item.CashSales || 0), 0);
      const creditSales = summaries.reduce((sum, item) => sum + Number(item.CreditSales || 0), 0);
      const mismatchCount = summaries.reduce((sum, item) => sum + Number(item.StockMismatch || 0), 0);
      const productQuantities = new Map<string, number>();
      sales.forEach((sale) => productQuantities.set(sale.ProductName, (productQuantities.get(sale.ProductName) || 0) + Number(sale.Quantity || 0)));
      const topProduct = Array.from(productQuantities.entries()).sort((a, b) => b[1] - a[1])[0];

      return {
        success: true,
        stats: {
          todayTotalSales: totalSales,
          todayCashSales: cashSales,
          todayCreditSales: creditSales,
          submittedReportsCount: summaries.length,
          stockMismatchCount: mismatchCount,
          topSellingProduct: topProduct ? `${topProduct[0]} (${topProduct[1]})` : "N/A"
        },
        recentSummaries: summaries
      };
    }

    case "getReportsByDate": {
      const startDate = data.startDate ? String(data.startDate) : undefined;
      const endDate = data.endDate ? String(data.endDate) : undefined;
      const employeeId = data.employeeId ? String(data.employeeId) : undefined;
      return {
        success: true,
        summaries: filterByDateAndEmployee(parseStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []), startDate, endDate, employeeId),
        sales: filterByDateAndEmployee(parseStored<DailySalesEntry>(STORAGE_KEYS.dailySales, []), startDate, endDate, employeeId),
        stocks: filterByDateAndEmployee(parseStored<DailyStockEntry>(STORAGE_KEYS.dailyStock, []), startDate, endDate, employeeId),
        creditSales: filterByDateAndEmployee(parseStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, []), startDate, endDate, employeeId)
      };
    }

    case "getEmployeeReports": {
      const employeeId = String(data.employeeId || "");
      return {
        success: true,
        reports: parseStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []).filter((summary) => summary.EmployeeID === employeeId)
      };
    }

    case "approveReport":
    case "rejectReport":
    case "reopenReport": {
      const reportId = String(data.reportId || "");
      const status: DailySummaryEntry["Status"] =
        action === "approveReport" ? "Approved" : action === "rejectReport" ? "Rejected" : "Reopened";
      const summaries = parseStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, []);
      const index = summaries.findIndex((summary) => summary.ReportID === reportId);
      if (index === -1) return { success: false, error: "Report summary not found" };
      summaries[index] = { ...summaries[index], Status: status };
      setStored<DailySummaryEntry>(STORAGE_KEYS.dailySummary, summaries);
      const credits = parseStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, []).map((credit) =>
        credit.ReportID === reportId ? { ...credit, Status: status } : credit
      );
      setStored<CreditSalesEntry>(STORAGE_KEYS.creditSales, credits);
      return { success: true };
    }

    default:
      return { success: false, error: "Action not supported in Mock API" };
  }
}

async function callApi(action: string, data: Record<string, unknown> = {}): Promise<ApiResponse> {
  const url = getApiUrl();

  if (isMockMode()) {
    return callMockApi(action, data);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ action, data })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP status ${response.status}`);
    }

    return (await response.json()) as ApiResponse;
  } catch (error) {
    console.error(`[API Client] Error on action ${action}, falling back to Mock API:`, error);
    return callMockApi(action, data);
  }
}

export const appsScriptClient = {
  login: (phone: string, pin: string) => callApi("login", { phone, pin }),
  getProducts: () => callApi("getProducts"),
  getEmployees: () => callApi("getEmployees"),
  createEmployee: (employeeData: { name: string; phone: string; pin: string; role: string; status: string }) =>
    callApi("createEmployee", employeeData),
  updateEmployee: (employeeData: { employeeId: string; name?: string; phone?: string; pin?: string; role?: string; status?: string }) =>
    callApi("updateEmployee", employeeData),
  createProduct: (productData: { productName: string; category: string; uom: string; defaultRate: number; active: string }) =>
    callApi("createProduct", productData),
  updateProduct: (productData: { productId: string; productName?: string; category?: string; uom?: string; defaultRate?: number; active?: string }) =>
    callApi("updateProduct", productData),
  getTodayOpeningStock: () => callApi("getTodayOpeningStock"),
  submitDailyReport: (submission: DailyReportSubmission) =>
    callApi("submitDailyReport", submission as unknown as Record<string, unknown>),
  getAdminDashboard: (date?: string) => callApi("getAdminDashboard", { date }),
  getReportsByDate: (startDate?: string, endDate?: string, employeeId?: string) =>
    callApi("getReportsByDate", { startDate, endDate, employeeId }),
  getEmployeeReports: (employeeId: string) => callApi("getEmployeeReports", { employeeId }),
  approveReport: (reportId: string, adminId: string) => callApi("approveReport", { reportId, adminId }),
  rejectReport: (reportId: string, adminId: string) => callApi("rejectReport", { reportId, adminId }),
  reopenReport: (reportId: string, adminId: string) => callApi("reopenReport", { reportId, adminId })
};
