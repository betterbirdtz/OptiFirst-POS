/**
 * Daily Sales and Daily Stock Reporting Backend
 * Google Apps Script Web App API
 * Master Sheet Schema: Employees, Products, DailySales, DailyStock, DailySummary, CreditSales, OpeningStock, Logs
 */

// Sheets configuration and column mappings
const SHEETS = {
  Employees: {
    name: "Employees",
    headers: ["EmployeeID", "Name", "Phone", "PIN", "Role", "Status", "CreatedAt"]
  },
  Products: {
    name: "Products",
    headers: ["ProductID", "ProductName", "Category", "UOM", "DefaultRate", "Active"]
  },
  DailySales: {
    name: "DailySales",
    headers: ["ReportID", "Date", "EmployeeID", "EmployeeName", "ProductID", "ProductName", "UOM", "Quantity", "Rate", "SaleType", "CashSales", "CreditSales", "EFDNumber", "CustomerName", "TotalAmount", "CreatedAt"]
  },
  DailyStock: {
    name: "DailyStock",
    headers: ["ReportID", "Date", "EmployeeID", "EmployeeName", "ProductID", "ProductName", "Category", "UOM", "OpeningStock", "Receipt", "Sales", "ExpectedClosing", "ActualClosing", "Mismatch", "CreatedAt"]
  },
  DailySummary: {
    name: "DailySummary",
    headers: ["ReportID", "Date", "EmployeeID", "EmployeeName", "TotalSales", "CashSales", "CreditSales", "TotalStockSales", "StockMismatch", "Status", "SubmittedAt"]
  },
  CreditSales: {
    name: "CreditSales",
    headers: ["ReportID", "Date", "EmployeeID", "EmployeeName", "CustomerName", "ProductName", "Amount", "EFDNumber", "Status", "CreatedAt"]
  },
  OpeningStock: {
    name: "OpeningStock",
    headers: ["ProductID", "ProductName", "CurrentOpeningStock", "LastUpdatedDate"]
  },
  Logs: {
    name: "Logs",
    headers: ["LogID", "UserID", "Action", "Details", "CreatedAt"]
  }
};

/**
 * Automatically creates all required tabs and adds headers.
 * Adds sample products, sample admin, and sample employee.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Create Sheets and Headers
  for (let key in SHEETS) {
    let sheetConfig = SHEETS[key];
    let sheet = ss.getSheetByName(sheetConfig.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetConfig.name);
    }
    // Set headers if sheet is empty or check headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheetConfig.headers);
      sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    }
  }
  
  // 2. Add Sample Employees if empty
  const empSheet = ss.getSheetByName(SHEETS.Employees.name);
  if (empSheet.getLastRow() <= 1) {
    const sampleEmployees = [
      ["EMP001", "Admin User", "+1234567890", "1234", "Admin", "Active", new Date().toISOString()],
      ["EMP002", "Sales Employee", "+1234567891", "5678", "Employee", "Active", new Date().toISOString()]
    ];
    sampleEmployees.forEach(row => empSheet.appendRow(row));
  }
  
  // 3. Add Sample Products if empty
  const prodSheet = ss.getSheetByName(SHEETS.Products.name);
  if (prodSheet.getLastRow() <= 1) {
    const sampleProducts = [
      ["PROD001", "Apple", "Fruit", "KG", 150, "Yes"],
      ["PROD002", "Banana", "Fruit", "Dozen", 60, "Yes"],
      ["PROD003", "Milk", "Dairy", "Litre", 50, "Yes"],
      ["PROD004", "Bread", "Bakery", "Packet", 40, "Yes"],
      ["PROD005", "Eggs", "Bakery", "Box", 120, "Yes"],
      ["PROD006", "Rice", "Grocery", "KG", 80, "Yes"]
    ];
    sampleProducts.forEach(row => prodSheet.appendRow(row));
  }

  // 4. Populate OpeningStock if empty
  const stockSheet = ss.getSheetByName(SHEETS.OpeningStock.name);
  if (stockSheet.getLastRow() <= 1) {
    const defaultStocks = [
      ["PROD001", "Apple", 100, new Date().toISOString()],
      ["PROD002", "Banana", 100, new Date().toISOString()],
      ["PROD003", "Milk", 150, new Date().toISOString()],
      ["PROD004", "Bread", 75, new Date().toISOString()],
      ["PROD005", "Eggs", 50, new Date().toISOString()],
      ["PROD006", "Rice", 200, new Date().toISOString()]
    ];
    defaultStocks.forEach(row => stockSheet.appendRow(row));
  }
  
  logAction("SYSTEM", "SETUP", "Database initialized and seeded successfully");
  return "Setup completed successfully!";
}

/**
 * Handle API actions using JSON payload
 */
function doPost(e) {
  // Handle CORS preflight
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  let lock = LockService.getScriptLock();
  try {
    // Acquire lock for up to 30 seconds to prevent write conflicts
    lock.waitLock(30000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "No post data found" });
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const data = requestData.data || {};
    
    let result;
    
    switch (action) {
      case "login":
        result = handleLogin(data.phone, data.pin);
        break;
      case "getProducts":
        result = handleGetProducts();
        break;
      case "getEmployees":
        result = handleGetEmployees();
        break;
      case "createEmployee":
        result = handleCreateEmployee(data);
        break;
      case "updateEmployee":
        result = handleUpdateEmployee(data);
        break;
      case "createProduct":
        result = handleCreateProduct(data);
        break;
      case "updateProduct":
        result = handleUpdateProduct(data);
        break;
      case "getTodayOpeningStock":
        result = handleGetTodayOpeningStock();
        break;
      case "submitDailyReport":
        result = handleSubmitDailyReport(data);
        break;
      case "getAdminDashboard":
        result = handleGetAdminDashboard(data.date);
        break;
      case "getReportsByDate":
        result = handleGetReportsByDate(data.startDate, data.endDate, data.employeeId);
        break;
      case "getEmployeeReports":
        result = handleGetEmployeeReports(data.employeeId);
        break;
      case "approveReport":
        result = handleUpdateReportStatus(data.reportId, "Approved", data.adminId);
        break;
      case "rejectReport":
        result = handleUpdateReportStatus(data.reportId, "Rejected", data.adminId);
        break;
      case "reopenReport":
        result = handleUpdateReportStatus(data.reportId, "Reopened", data.adminId);
        break;
      default:
        result = { success: false, error: "Unknown API action: " + action };
    }
    
    return jsonResponse(result);
    
  } catch (err) {
    logAction("SYSTEM", "ERROR", err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Enable standard GET calls for setup & verification if requested
function doGet(e) {
  const action = e.parameter.action;
  if (action === "setup") {
    try {
      const msg = setupSheets();
      return jsonResponse({ success: true, message: msg });
    } catch(err) {
      return jsonResponse({ success: false, error: err.toString() });
    }
  }
  return jsonResponse({ success: true, message: "Apps Script API is running. Send POST requests to communicate." });
}

/**
 * Return JSON Response with CORS headers
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper to turn a sheet's rows into objects
 */
function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const range = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  const values = range.getValues();
  const headers = values[0];
  const objects = [];
  
  for (let r = 1; r < values.length; r++) {
    let obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
    }
    objects.push(obj);
  }
  return objects;
}

/**
 * Helper to write a log entry
 */
function logAction(userId, action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.Logs.name);
    if (!sheet) return;
    
    const logId = "LOG" + new Date().getTime() + Math.floor(Math.random() * 1000);
    sheet.appendRow([
      logId,
      userId,
      action,
      details,
      new Date().toISOString()
    ]);
  } catch (e) {
    Logger.log("Failed to log action: " + e.toString());
  }
}

function findRowByColumnValue(sheetName, columnName, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return -1;

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const columnIndex = headers.indexOf(columnName);
  if (columnIndex === -1) return -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][columnIndex]) === String(value)) {
      return i + 1;
    }
  }

  return -1;
}

function deleteRowsByReportId(sheetName, reportId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const reportIdColumn = headers.indexOf("ReportID") + 1;
  if (reportIdColumn <= 0) return;

  for (let row = sheet.getLastRow(); row >= 2; row--) {
    if (String(sheet.getRange(row, reportIdColumn).getValue()) === String(reportId)) {
      sheet.deleteRow(row);
    }
  }
}

function validateDailyReportPayload(data) {
  if (!data) return "Report payload is required";
  if (!data.employeeId) return "Employee ID is required";
  if (!data.date) return "Report date is required";

  const employees = getSheetDataAsObjects(SHEETS.Employees.name);
  const employee = employees.find(e => String(e.EmployeeID) === String(data.employeeId));
  if (!employee) return "Employee not found";
  if (employee.Status !== "Active") return "Employee account is inactive";
  if (employee.Role !== "Employee") return "Only employee accounts can submit daily reports";

  const products = getSheetDataAsObjects(SHEETS.Products.name);
  const activeProductIds = {};
  products.forEach(product => {
    if (product.Active === "Yes") activeProductIds[String(product.ProductID)] = true;
  });

  const salesEntries = Array.isArray(data.salesEntries) ? data.salesEntries : [];
  const stockEntries = Array.isArray(data.stockEntries) ? data.stockEntries : [];
  if (stockEntries.length === 0) return "Stock entries are required";

  for (let i = 0; i < salesEntries.length; i++) {
    const sale = salesEntries[i];
    if (!activeProductIds[String(sale.productId)]) return "Inactive or unknown sales product: " + sale.productName;
    if (!isFinite(Number(sale.quantity)) || Number(sale.quantity) <= 0) return "Invalid sales quantity for " + sale.productName;
    if (!isFinite(Number(sale.rate)) || Number(sale.rate) < 0) return "Invalid rate for " + sale.productName;
    if (sale.saleType !== "Cash" && sale.saleType !== "Credit") return "Invalid sale type for " + sale.productName;
    if (sale.saleType === "Credit" && !String(sale.customerName || "").trim()) {
      return "Customer name is required for credit sale: " + sale.productName;
    }
  }

  for (let j = 0; j < stockEntries.length; j++) {
    const stock = stockEntries[j];
    if (!activeProductIds[String(stock.productId)]) return "Inactive or unknown stock product: " + stock.productName;
    if (!isFinite(Number(stock.openingStock))) return "Invalid opening stock for " + stock.productName;
    if (!isFinite(Number(stock.receipt))) return "Invalid receipt for " + stock.productName;
    if (!isFinite(Number(stock.sales))) return "Invalid sales quantity for " + stock.productName;
    if (stock.actualClosing === undefined || stock.actualClosing === null || stock.actualClosing === "" || !isFinite(Number(stock.actualClosing))) {
      return "Actual closing stock is required for " + stock.productName;
    }
  }

  return null;
}

/**
 * Action Handlers
 */

function handleLogin(phone, pin) {
  if (!phone || !pin) {
    return { success: false, error: "Phone and PIN are required" };
  }
  
  const employees = getSheetDataAsObjects(SHEETS.Employees.name);
  const employee = employees.find(e => String(e.Phone).trim() === String(phone).trim() && String(e.PIN).trim() === String(pin).trim());
  
  if (!employee) {
    return { success: false, error: "Invalid Phone or PIN" };
  }
  
  if (employee.Status !== "Active") {
    return { success: false, error: "Account is inactive. Please contact your administrator." };
  }
  
  logAction(employee.EmployeeID, "LOGIN", "Successful login");
  
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

function handleGetProducts() {
  const products = getSheetDataAsObjects(SHEETS.Products.name);
  // Only active products returned for employees, admin sees all
  return { success: true, products: products };
}

function handleGetEmployees() {
  const employees = getSheetDataAsObjects(SHEETS.Employees.name);
  // Clear PINs for privacy before sending to client
  const safeEmployees = employees.map(emp => {
    let copy = {...emp};
    delete copy.PIN;
    return copy;
  });
  return { success: true, employees: safeEmployees };
}

function handleCreateEmployee(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.Employees.name);
  const employees = getSheetDataAsObjects(SHEETS.Employees.name);
  
  // Validate unique phone
  const existing = employees.find(e => String(e.Phone).trim() === String(data.phone).trim());
  if (existing) {
    return { success: false, error: "Employee with this phone number already exists" };
  }
  
  const empId = "EMP" + (employees.length + 101);
  sheet.appendRow([
    empId,
    data.name,
    data.phone,
    data.pin,
    data.role || "Employee",
    data.status || "Active",
    new Date().toISOString()
  ]);
  
  logAction("ADMIN", "CREATE_EMPLOYEE", "Created employee ID: " + empId);
  return { success: true, employeeId: empId };
}

function handleUpdateEmployee(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.Employees.name);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const empIdIdx = headers.indexOf("EmployeeID");
  let foundRow = -1;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][empIdIdx] === data.employeeId) {
      foundRow = i + 1; // 1-based index
      break;
    }
  }
  
  if (foundRow === -1) {
    return { success: false, error: "Employee not found" };
  }
  
  // Update fields
  if (data.name) sheet.getRange(foundRow, headers.indexOf("Name") + 1).setValue(data.name);
  if (data.phone) sheet.getRange(foundRow, headers.indexOf("Phone") + 1).setValue(data.phone);
  if (data.pin) sheet.getRange(foundRow, headers.indexOf("PIN") + 1).setValue(data.pin);
  if (data.role) sheet.getRange(foundRow, headers.indexOf("Role") + 1).setValue(data.role);
  if (data.status) sheet.getRange(foundRow, headers.indexOf("Status") + 1).setValue(data.status);
  
  logAction("ADMIN", "UPDATE_EMPLOYEE", "Updated employee ID: " + data.employeeId);
  return { success: true };
}

function handleCreateProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.Products.name);
  const products = getSheetDataAsObjects(SHEETS.Products.name);
  
  const prodId = "PROD" + (products.length + 101);
  sheet.appendRow([
    prodId,
    data.productName,
    data.category || "General",
    data.uom,
    Number(data.defaultRate),
    data.active || "Yes"
  ]);
  
  // Also add entry to OpeningStock
  const openSheet = ss.getSheetByName(SHEETS.OpeningStock.name);
  openSheet.appendRow([
    prodId,
    data.productName,
    0, // Initial stock 0
    new Date().toISOString()
  ]);
  
  logAction("ADMIN", "CREATE_PRODUCT", "Created product ID: " + prodId);
  return { success: true, productId: prodId };
}

function handleUpdateProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.Products.name);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const prodIdIdx = headers.indexOf("ProductID");
  let foundRow = -1;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][prodIdIdx] === data.productId) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow === -1) {
    return { success: false, error: "Product not found" };
  }
  
  if (data.productName) sheet.getRange(foundRow, headers.indexOf("ProductName") + 1).setValue(data.productName);
  if (data.category) sheet.getRange(foundRow, headers.indexOf("Category") + 1).setValue(data.category);
  if (data.uom) sheet.getRange(foundRow, headers.indexOf("UOM") + 1).setValue(data.uom);
  if (data.defaultRate !== undefined) sheet.getRange(foundRow, headers.indexOf("DefaultRate") + 1).setValue(Number(data.defaultRate));
  if (data.active) sheet.getRange(foundRow, headers.indexOf("Active") + 1).setValue(data.active);
  
  // Sync name to OpeningStock
  const openSheet = ss.getSheetByName(SHEETS.OpeningStock.name);
  const openValues = openSheet.getDataRange().getValues();
  for (let j = 1; j < openValues.length; j++) {
    if (openValues[j][0] === data.productId) {
      if (data.productName) openSheet.getRange(j + 1, 2).setValue(data.productName);
      break;
    }
  }
  
  logAction("ADMIN", "UPDATE_PRODUCT", "Updated product ID: " + data.productId);
  return { success: true };
}

function handleGetTodayOpeningStock() {
  const openingStock = getSheetDataAsObjects(SHEETS.OpeningStock.name);
  return { success: true, openingStock: openingStock };
}

/**
 * Handle report submissions:
 * Adds DailySales rows
 * Adds DailyStock rows
 * Creates a DailySummary entry
 * Records CreditSales if any
 * Updates OpeningStock with actual closing stocks
 */
function handleSubmitDailyReport(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const validationError = validateDailyReportPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  let reportId = data.reportId || "";
  let correctionSummaryRow = -1;

  if (reportId) {
    correctionSummaryRow = findRowByColumnValue(SHEETS.DailySummary.name, "ReportID", reportId);
    if (correctionSummaryRow === -1) {
      return { success: false, error: "Reopened report was not found" };
    }

    const summarySheetForStatus = ss.getSheetByName(SHEETS.DailySummary.name);
    const summaryHeadersForStatus = summarySheetForStatus.getRange(1, 1, 1, summarySheetForStatus.getLastColumn()).getValues()[0];
    const statusColumn = summaryHeadersForStatus.indexOf("Status") + 1;
    const currentStatus = summarySheetForStatus.getRange(correctionSummaryRow, statusColumn).getValue();
    if (currentStatus !== "Reopened") {
      return { success: false, error: "Only reopened reports can be corrected" };
    }

    deleteRowsByReportId(SHEETS.DailySales.name, reportId);
    deleteRowsByReportId(SHEETS.DailyStock.name, reportId);
    deleteRowsByReportId(SHEETS.CreditSales.name, reportId);
  } else {
    reportId = "REP" + new Date().getTime() + Math.floor(Math.random() * 1000);
  }

  const dateStr = data.date || new Date().toISOString().split("T")[0];
  const empId = data.employeeId;
  const empName = data.employeeName;
  
  // 1. Insert Sales Entries
  const salesSheet = ss.getSheetByName(SHEETS.DailySales.name);
  let totalSales = 0;
  let cashSales = 0;
  let creditSales = 0;
  
  if (data.salesEntries && data.salesEntries.length > 0) {
    data.salesEntries.forEach(s => {
      const totalAmount = Number(s.quantity) * Number(s.rate);
      let cashAmt = 0;
      let creditAmt = 0;
      
      if (s.saleType === "Cash") {
        cashAmt = totalAmount;
        cashSales += totalAmount;
      } else {
        creditAmt = totalAmount;
        creditSales += totalAmount;
      }
      totalSales += totalAmount;
      
      salesSheet.appendRow([
        reportId,
        dateStr,
        empId,
        empName,
        s.productId,
        s.productName,
        s.uom,
        Number(s.quantity),
        Number(s.rate),
        s.saleType,
        cashAmt,
        creditAmt,
        s.efdNumber || "",
        s.customerName || "",
        totalAmount,
        new Date().toISOString()
      ]);
      
      // If Credit Sale, record in CreditSales sheet
      if (s.saleType === "Credit") {
        const creditSheet = ss.getSheetByName(SHEETS.CreditSales.name);
        creditSheet.appendRow([
          reportId,
          dateStr,
          empId,
          empName,
          s.customerName || "Unknown Customer",
          s.productName,
          totalAmount,
          s.efdNumber || "",
          "Pending Approval", // Initial status
          new Date().toISOString()
        ]);
      }
    });
  }
  
  // 2. Insert Stock Entries & Calculate expected closing / mismatches
  const stockSheet = ss.getSheetByName(SHEETS.DailyStock.name);
  let stockMismatchCount = 0;
  let totalStockSales = 0;
  
  if (data.stockEntries && data.stockEntries.length > 0) {
    data.stockEntries.forEach(st => {
      const opening = Number(st.openingStock);
      const receipt = Number(st.receipt || 0);
      const sales = Number(st.sales || 0);
      const expected = opening + receipt - sales;
      const actual = Number(st.actualClosing);
      const mismatch = actual - expected;
      
      if (mismatch !== 0) {
        stockMismatchCount++;
      }
      
      stockSheet.appendRow([
        reportId,
        dateStr,
        empId,
        empName,
        st.productId,
        st.productName,
        st.category || "",
        st.uom,
        opening,
        receipt,
        sales,
        expected,
        actual,
        mismatch,
        new Date().toISOString()
      ]);
      
      // Update the Master OpeningStock table with the new actual closing stock
      const openSheet = ss.getSheetByName(SHEETS.OpeningStock.name);
      const openValues = openSheet.getDataRange().getValues();
      for (let j = 1; j < openValues.length; j++) {
        if (openValues[j][0] === st.productId) {
          openSheet.getRange(j + 1, 3).setValue(actual); // Update current opening stock
          openSheet.getRange(j + 1, 4).setValue(new Date().toISOString()); // Update date
          break;
        }
      }
    });
  }
  
  // 3. Create DailySummary
  const summarySheet = ss.getSheetByName(SHEETS.DailySummary.name);
  const summaryRow = [
    reportId,
    dateStr,
    empId,
    empName,
    totalSales,
    cashSales,
    creditSales,
    totalSales, // Total Stock Sales aligns with Total Sales for standard billing
    stockMismatchCount,
    "Pending Approval", // Default Status
    new Date().toISOString()
  ];

  if (correctionSummaryRow > 0) {
    summarySheet.getRange(correctionSummaryRow, 1, 1, summaryRow.length).setValues([summaryRow]);
  } else {
    summarySheet.appendRow(summaryRow);
  }
  
  logAction(empId, "SUBMIT_REPORT", "Submitted report ID: " + reportId + ", Sales: INR " + totalSales + ", Stock Mismatch count: " + stockMismatchCount);
  
  return {
    success: true,
    reportId: reportId,
    totalSales: totalSales,
    cashSales: cashSales,
    creditSales: creditSales,
    mismatchCount: stockMismatchCount
  };
}

function handleGetAdminDashboard(dashboardDate) {
  const summaryList = getSheetDataAsObjects(SHEETS.DailySummary.name);
  const salesList = getSheetDataAsObjects(SHEETS.DailySales.name);
  const stockList = getSheetDataAsObjects(SHEETS.DailyStock.name);
  
  // Filter for today's date if specified, otherwise overall/today's UTC-adjusted local date
  const targetDate = dashboardDate || new Date().toISOString().split("T")[0];
  
  const todaySummaries = summaryList.filter(s => s.Date.split("T")[0] === targetDate);
  const todaySales = salesList.filter(s => s.Date.split("T")[0] === targetDate);
  const todayStocks = stockList.filter(s => s.Date.split("T")[0] === targetDate);
  
  let totalSales = 0;
  let cashSales = 0;
  let creditSales = 0;
  let mismatchCount = 0;
  let reportsCount = todaySummaries.length;
  
  todaySummaries.forEach(s => {
    totalSales += Number(s.TotalSales || 0);
    cashSales += Number(s.CashSales || 0);
    creditSales += Number(s.CreditSales || 0);
    mismatchCount += Number(s.StockMismatch || 0);
  });
  
  // Calculate top-selling product
  const productQuantities = {};
  todaySales.forEach(s => {
    productQuantities[s.ProductName] = (productQuantities[s.ProductName] || 0) + Number(s.Quantity || 0);
  });
  
  let topSellingProduct = "N/A";
  let maxQty = 0;
  for (let prod in productQuantities) {
    if (productQuantities[prod] > maxQty) {
      maxQty = productQuantities[prod];
      topSellingProduct = prod + " (" + maxQty + ")";
    }
  }
  
  // Return stats and logs for dashboard charts
  return {
    success: true,
    stats: {
      todayTotalSales: totalSales,
      todayCashSales: cashSales,
      todayCreditSales: creditSales,
      submittedReportsCount: reportsCount,
      stockMismatchCount: mismatchCount,
      topSellingProduct: topSellingProduct
    },
    recentSummaries: todaySummaries
  };
}

function handleGetReportsByDate(startDate, endDate, employeeId) {
  const summaries = getSheetDataAsObjects(SHEETS.DailySummary.name);
  const sales = getSheetDataAsObjects(SHEETS.DailySales.name);
  const stocks = getSheetDataAsObjects(SHEETS.DailyStock.name);
  const credits = getSheetDataAsObjects(SHEETS.CreditSales.name);
  
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  const filterFn = (item) => {
    const itemDate = new Date(item.Date.split("T")[0]);
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    if (employeeId && item.EmployeeID !== employeeId) return false;
    return true;
  };
  
  return {
    success: true,
    summaries: summaries.filter(filterFn),
    sales: sales.filter(filterFn),
    stocks: stocks.filter(filterFn),
    creditSales: credits.filter(filterFn)
  };
}

function handleGetEmployeeReports(employeeId) {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }
  const summaries = getSheetDataAsObjects(SHEETS.DailySummary.name);
  const employeeSummaries = summaries.filter(s => s.EmployeeID === employeeId);
  return { success: true, reports: employeeSummaries };
}

function handleUpdateReportStatus(reportId, status, adminId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Update DailySummary Status
  const summarySheet = ss.getSheetByName(SHEETS.DailySummary.name);
  const summaryValues = summarySheet.getDataRange().getValues();
  const summaryHeaders = summaryValues[0];
  const summaryReportIdIdx = summaryHeaders.indexOf("ReportID");
  const summaryStatusIdx = summaryHeaders.indexOf("Status");
  
  let summaryRow = -1;
  for (let i = 1; i < summaryValues.length; i++) {
    if (summaryValues[i][summaryReportIdIdx] === reportId) {
      summaryRow = i + 1;
      break;
    }
  }
  
  if (summaryRow === -1) {
    return { success: false, error: "Report summary not found" };
  }
  
  summarySheet.getRange(summaryRow, summaryStatusIdx + 1).setValue(status);
  
  // 2. Sync to CreditSales Status if there are credit entries for this report
  const creditSheet = ss.getSheetByName(SHEETS.CreditSales.name);
  if (creditSheet && creditSheet.getLastRow() > 1) {
    const creditValues = creditSheet.getDataRange().getValues();
    const creditHeaders = creditValues[0];
    const creditReportIdIdx = creditHeaders.indexOf("ReportID");
    const creditStatusIdx = creditHeaders.indexOf("Status");
    
    for (let j = 1; j < creditValues.length; j++) {
      if (creditValues[j][creditReportIdIdx] === reportId) {
        creditSheet.getRange(j + 1, creditStatusIdx + 1).setValue(status);
      }
    }
  }
  
  logAction(adminId || "ADMIN", "REPORT_STATUS_CHANGE", "Report " + reportId + " status updated to: " + status);
  return { success: true };
}
