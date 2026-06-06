/**
 * OptiFirst TZ / Better Bird POS Reporting API
 * Google Sheets database + Google Apps Script Web App backend.
 */

const SHEETS = {
  Users: {
    name: "Users",
    headers: ["UserID", "Name", "Phone", "PIN", "Role", "ShopID", "Status", "CreatedAt"]
  },
  Shops: {
    name: "Shops",
    headers: ["ShopID", "ShopName", "Location", "InchargeName", "InchargeContact", "Status", "CreatedAt"]
  },
  Products: {
    name: "Products",
    headers: ["ProductID", "ProductName", "Category", "UOM", "DefaultRate", "Active", "CreatedAt"]
  },
  OpeningStock: {
    name: "OpeningStock",
    headers: ["ShopID", "ProductID", "OpeningStock", "UpdatedAt"]
  },
  DailyReports: {
    name: "DailyReports",
    headers: ["ReportID", "ShopID", "ShopName", "Date", "EmployeeID", "EmployeeName", "SalesSubmitted", "StockSubmitted", "Status", "SubmittedAt", "ApprovedBy", "ApprovedAt"]
  },
  DailySalesEntries: {
    name: "DailySalesEntries",
    headers: ["EntryID", "ReportID", "ShopID", "ShopName", "Date", "EmployeeID", "ProductID", "ProductName", "UOM", "Quantity", "Rate", "SaleType", "CashSales", "CreditSales", "EFDNumber", "CustomerName", "TotalAmount", "CreatedAt"]
  },
  DailyStockEntries: {
    name: "DailyStockEntries",
    headers: ["EntryID", "ReportID", "ShopID", "ShopName", "Date", "EmployeeID", "ProductID", "ProductName", "Category", "UOM", "MTNNo", "OpeningStock", "Receipt", "Sales", "ExpectedClosing", "ActualClosing", "Mismatch", "CreatedAt"]
  },
  Collections: {
    name: "Collections",
    headers: ["CollectionID", "ReportID", "ShopID", "ShopName", "Date", "Month", "Day", "EmployeeID", "EmployeeName", "CashSales", "CreditSales", "TotalSales", "DepositCash", "DepositLIPA", "ExpectedCollection", "ActualCollection", "Variance", "DepositInBank", "BankDepositDifference", "DateOfDeposit", "EFDZReport", "SalesVsEFD", "Name", "Signature", "Remarks", "Status", "AdminNote", "SubmittedAt", "UpdatedAt", "ApprovedBy", "ApprovedAt"]
  },
  LiveWeight: {
    name: "LiveWeight",
    headers: ["LiveWeightID", "ShopID", "Date", "Crates", "TotalBirds", "NetLiveWeightKG", "AvgLiveWeightKG", "DOA", "InjuredBirds", "Shortage", "NetAcceptedBirds", "CreatedAt"]
  },
  Logs: {
    name: "Logs",
    headers: ["LogID", "UserID", "Action", "Details", "CreatedAt"]
  },
  MTN: {
    name: "MTN",
    headers: ["MTNID", "MTNNo", "MTNDate", "From", "ToShopID", "ToShopName", "EmployeeID", "EmployeeName", "ProductName", "QtyAsPerMTN", "QtyReceived", "Variance", "Status", "Complaint", "CreatedAt", "ProductID"]
  },
  ShopPrices: {
    name: "ShopPrices",
    headers: ["ShopID", "ProductID", "Rate", "UpdatedAt"]
  }
};

const READ_ACTIONS = [
  "login",
  "getShops",
  "getProducts",
  "getUsers",
  "getEmployees",
  "getOpeningStock",
  "getTodayOpeningStock",
  "getTodayReport",
  "getMyReports",
  "getEmployeeReports",
  "getDashboard",
  "getAdminDashboard",
  "getReportsByDate",
  "getDailySalesReport",
  "getDailyStockReport",
  "getTodayCollection",
  "getCollections",
  "getMonthlyCollectionReport",
  "getStockMismatchReport",
  "getCreditSalesReport",
  "getLiveWeight",
  "getMTNsForShop",
  "getShopPrices",
  "getInitialData"
];

function setupSheets() {
  ensureConfiguredSheets();
  seedShops();
  seedUsers();
  seedProducts();
  invalidateCachedSheets();
  logAction("SYSTEM", "SETUP", "Database initialized with normalized tabs.");
  return "Setup completed. Tabs, headers, shops, users, and products are ready.";
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  if (action === "setup") {
    try {
      return jsonResponse({ success: true, message: setupSheets() });
    } catch (err) {
      return jsonResponse({ success: false, error: String(err) });
    }
  }
  return jsonResponse({ success: true, message: "OptiFirst POS API is running." });
}

function keepWarm() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
}

function doPost(e) {
  let request;
  let action;
  let data;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "No JSON post data found." });
    }

    request = JSON.parse(e.postData.contents);
    action = request.action;
    data = request.data || {};
  } catch (err) {
    return jsonResponse({ success: false, error: "Invalid request: " + err });
  }

  if (READ_ACTIONS.indexOf(action) >= 0) {
    try {
      return jsonResponse(processAction(action, data));
    } catch (err) {
      return jsonResponse({ success: false, error: String(err) });
    }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return jsonResponse({ success: false, error: "Server busy. Try again in a moment." });
  }

  try {
    return jsonResponse(processAction(action, data));
  } catch (err) {
    logAction("SYSTEM", "ERROR", String(err));
    return jsonResponse({ success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function processAction(action, data) {
  switch (action) {
    case "setupSheets":
      return { success: true, message: setupSheets() };
    case "login":
      return handleLogin(data);
    case "getShops":
      return { success: true, shops: getObjectsCached(SHEETS.Shops.name, 300) };
    case "createShop":
      return handleCreateShop(data);
    case "updateShop":
      return handleUpdateShop(data);
    case "getUsers":
    case "getEmployees":
      return handleGetUsers();
    case "createUser":
    case "createEmployee":
      return handleCreateUser(data);
    case "updateUser":
    case "updateEmployee":
      return handleUpdateUser(data);
    case "getProducts":
      return { success: true, products: getObjectsCached(SHEETS.Products.name, 300) };
    case "getShopPrices":
      return handleGetShopPrices(data);
    case "saveShopPrices":
      return handleSaveShopPrices(data);
    case "createProduct":
      return handleCreateProduct(data);
    case "updateProduct":
      return handleUpdateProduct(data);
    case "getTodayReport":
      return handleGetTodayReport(data);
    case "getOpeningStock":
    case "getTodayOpeningStock":
      return handleGetOpeningStock(data);
    case "getInitialData":
      return handleGetInitialData(data);
    case "submitDailySales":
      return handleSubmitReport(data, "sales");
    case "submitDailyStock":
      return handleSubmitReport(data, "stock");
    case "submitFullDailyReport":
    case "submitDailyReport":
      return handleSubmitReport(data, "full");
    case "getMyReports":
    case "getEmployeeReports":
      return handleGetMyReports(data);
    case "getDashboard":
    case "getAdminDashboard":
      return handleGetDashboard(data);
    case "getReportsByDate":
      return Object.assign({ success: true }, getReportBundle(data));
    case "getDailySalesReport":
      return handleGetDailySalesReport(data);
    case "getDailyStockReport":
      return handleGetDailyStockReport(data);
    case "getTodayCollection":
      return handleGetTodayCollection(data);
    case "submitDailyCollection":
      return handleSubmitDailyCollection(data);
    case "getCollections":
      return handleGetCollections(data);
    case "getMonthlyCollectionReport":
      return handleGetMonthlyCollectionReport(data);
    case "updateCollectionByAdmin":
      return handleUpdateCollectionByAdmin(data);
    case "updateCollectionDeposit":
      return handleUpdateCollectionByAdmin(data);
    case "approveCollection":
      return handleUpdateCollectionStatus(data, "Approved");
    case "rejectCollection":
      return handleUpdateCollectionStatus(data, "Rejected");
    case "reopenCollection":
      return handleUpdateCollectionStatus(data, "Reopened");
    case "approveReport":
      return handleUpdateReportStatus(data.reportId, "Approved", data.adminId || data.userId || "");
    case "rejectReport":
      return handleUpdateReportStatus(data.reportId, "Rejected", data.adminId || data.userId || "");
    case "reopenReport":
      return handleUpdateReportStatus(data.reportId, "Reopened", data.adminId || data.userId || "");
    case "getStockMismatchReport":
      return handleGetStockMismatchReport(data);
    case "getCreditSalesReport":
      return handleGetCreditSalesReport(data);
    case "getLiveWeight":
      return { success: true, liveWeight: getObjects(SHEETS.LiveWeight.name) };
    case "submitLiveWeight":
      return handleSubmitLiveWeight(data);
    case "submitMTN":
      return handleSubmitMTN(data);
    case "getMTNsForShop":
      return handleGetMTNsForShop(data);
    case "updateOpeningStock":
      return handleUpdateOpeningStock(data);
    default:
      return { success: false, error: "Unknown API action: " + action };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  sheet.setFrozenRows(1);
}

function seedShops() {
  // No seeding - using real data from sheet
}

function seedUsers() {
  // No seeding - using real data from sheet
}

function seedProducts() {
  // No seeding - using real data from sheet
}

function ensureConfiguredSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    const config = SHEETS[key];
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) sheet = ss.insertSheet(config.name);
    _sheetCache[config.name] = sheet;
    ensureHeaders(sheet, config.headers);
  });
}

var _sheetCache = {};

function getSheetConfig(sheetName) {
  const keys = Object.keys(SHEETS);
  for (let i = 0; i < keys.length; i++) {
    const config = SHEETS[keys[i]];
    if (config.name === sheetName) return config;
  }
  return null;
}

function getSheet(sheetName) {
  if (!_sheetCache[sheetName]) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Missing sheet: " + sheetName + ". Run setupSheets() first.");
    }
    _sheetCache[sheetName] = sheet;
  }
  return _sheetCache[sheetName];
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach(function (header, index) {
      obj[header] = values[i][index];
    });
    rows.push(obj);
  }
  return rows;
}

function getObjectsCached(sheetName, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const key = "sheet_" + sheetName;
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // Fall through and refresh malformed cache values.
    }
  }

  const data = getObjects(sheetName);
  try {
    cache.put(key, JSON.stringify(data), ttlSeconds || 300);
  } catch (err) {
    // CacheService values are capped at 100KB. Large sheets still work uncached.
  }
  return data;
}

function invalidateCache(sheetName) {
  CacheService.getScriptCache().remove("sheet_" + sheetName);
}

function isCachedSheet(sheetName) {
  return sheetName === SHEETS.Shops.name || sheetName === SHEETS.Products.name || sheetName === SHEETS.Users.name;
}

function invalidateCacheIfNeeded(sheetName) {
  if (isCachedSheet(sheetName)) invalidateCache(sheetName);
}

function invalidateCachedSheets() {
  invalidateCache(SHEETS.Shops.name);
  invalidateCache(SHEETS.Products.name);
  invalidateCache(SHEETS.Users.name);
}

function appendRows(sheetName, rows) {
  if (!rows.length) return;
  const sheet = getSheet(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  invalidateCacheIfNeeded(sheetName);
}

function appendObject(sheetName, obj) {
  const headers = getHeaders(sheetName);
  appendRows(sheetName, [headers.map(function (header) { return obj[header] === undefined ? "" : obj[header]; })]);
}

function updateObjectById(sheetName, idColumn, idValue, patch) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf(idColumn);
  if (idIndex === -1) return false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(idValue)) {
      headers.forEach(function (header, index) {
        if (patch[header] !== undefined) {
          sheet.getRange(i + 1, index + 1).setValue(patch[header]);
        }
      });
      invalidateCacheIfNeeded(sheetName);
      return true;
    }
  }
  return false;
}

function deleteRowsWhere(sheetName, predicate) {
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() <= 1) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  let changed = false;
  for (let i = values.length - 1; i >= 1; i--) {
    const obj = {};
    headers.forEach(function (header, index) { obj[header] = values[i][index]; });
    if (predicate(obj)) {
      sheet.deleteRow(i + 1);
      changed = true;
    }
  }
  if (changed) invalidateCacheIfNeeded(sheetName);
}

function getSalesQuantityByProduct(shopId, date) {
  const quantities = {};
  getObjects(SHEETS.DailySalesEntries.name)
    .filter(function (row) { return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === normalizeDate(date); })
    .forEach(function (row) {
      const productId = String(row.ProductID);
      quantities[productId] = (quantities[productId] || 0) + toNumber(row.Quantity);
    });
  return quantities;
}

function recalculateExistingStockSales(reportId, shopId, date) {
  const quantities = getSalesQuantityByProduct(shopId, date);
  const sheet = getSheet(SHEETS.DailyStockEntries.name);
  if (sheet.getLastRow() <= 1) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const reportIdx = headers.indexOf("ReportID");
  const productIdx = headers.indexOf("ProductID");
  const openingIdx = headers.indexOf("OpeningStock");
  const receiptIdx = headers.indexOf("Receipt");
  const actualIdx = headers.indexOf("ActualClosing");
  const salesIdx = headers.indexOf("Sales");
  const expectedIdx = headers.indexOf("ExpectedClosing");
  const mismatchIdx = headers.indexOf("Mismatch");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][reportIdx]) !== String(reportId)) continue;
    const productId = String(values[i][productIdx]);
    const sales = quantities[productId] || 0;
    const expected = roundNumber(toNumber(values[i][openingIdx]) + toNumber(values[i][receiptIdx]) - sales);
    const mismatch = roundNumber(toNumber(values[i][actualIdx]) - expected);
    sheet.getRange(i + 1, salesIdx + 1).setValue(sales);
    sheet.getRange(i + 1, expectedIdx + 1).setValue(expected);
    sheet.getRange(i + 1, mismatchIdx + 1).setValue(mismatch);
  }
}

function findShop(shopId) {
  return getObjectsCached(SHEETS.Shops.name, 300).find(function (shop) { return String(shop.ShopID) === String(shopId); });
}

function findUser(userId) {
  return getObjectsCached(SHEETS.Users.name, 300).find(function (user) { return String(user.UserID) === String(userId); });
}

function nowIso() {
  return Utilities.formatDate(new Date(), "Africa/Dar_es_Salaam", "yyyy-MM-dd'T'HH:mm:ss");
}

function makeId(prefix) {
  return prefix + new Date().getTime() + Math.floor(Math.random() * 1000);
}

function normalizeDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Africa/Dar_es_Salaam", "yyyy-MM-dd");
  }
  return String(value).split("T")[0];
}

function toNumber(value) {
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : 0;
}

function roundNumber(value) {
  return Number(toNumber(value).toFixed(2));
}

function dayName(dateStr) {
  const date = new Date(normalizeDate(dateStr) + "T12:00:00");
  return Utilities.formatDate(date, "Africa/Dar_es_Salaam", "EEEE");
}

function inDateRange(rowDate, startDate, endDate) {
  const date = normalizeDate(rowDate);
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function reportTotals(reportId) {
  const sales = getObjects(SHEETS.DailySalesEntries.name).filter(function (row) { return String(row.ReportID) === String(reportId); });
  const stocks = getObjects(SHEETS.DailyStockEntries.name).filter(function (row) { return String(row.ReportID) === String(reportId); });
  return {
    CashSales: sales.reduce(function (sum, row) { return sum + toNumber(row.CashSales); }, 0),
    CreditSales: sales.reduce(function (sum, row) { return sum + toNumber(row.CreditSales); }, 0),
    TotalSales: sales.reduce(function (sum, row) { return sum + toNumber(row.TotalAmount); }, 0),
    StockMismatch: stocks.filter(function (row) { return toNumber(row.Mismatch) !== 0; }).length
  };
}

function emptyReportTotals() {
  return {
    CashSales: 0,
    CreditSales: 0,
    TotalSales: 0,
    StockMismatch: 0
  };
}

function buildReportTotalsById(salesRows, stockRows) {
  const totals = {};
  salesRows.forEach(function (row) {
    const reportId = String(row.ReportID);
    if (!totals[reportId]) totals[reportId] = emptyReportTotals();
    totals[reportId].CashSales += toNumber(row.CashSales);
    totals[reportId].CreditSales += toNumber(row.CreditSales);
    totals[reportId].TotalSales += toNumber(row.TotalAmount);
  });
  stockRows.forEach(function (row) {
    const reportId = String(row.ReportID);
    if (!totals[reportId]) totals[reportId] = emptyReportTotals();
    if (toNumber(row.Mismatch) !== 0) totals[reportId].StockMismatch++;
  });
  return totals;
}

function reportTotalsFromMap(reportId, totalsById) {
  const totals = totalsById[String(reportId)];
  return totals ? totals : emptyReportTotals();
}

function enrichReport(report) {
  const totals = reportTotals(report.ReportID);
  return Object.assign({}, report, totals);
}

function getEmployeeName(userId) {
  const user = findUser(userId);
  return user ? user.Name : "";
}

function addEmployeeName(row) {
  const copy = Object.assign({}, row);
  copy.EmployeeName = copy.EmployeeName || getEmployeeName(copy.EmployeeID);
  return copy;
}

function logAction(userId, action, details) {
  try {
    appendObject(SHEETS.Logs.name, {
      LogID: makeId("LOG"),
      UserID: userId,
      Action: action,
      Details: details,
      CreatedAt: nowIso()
    });
  } catch (err) {
    Logger.log("Log failed: " + err);
  }
}

function handleLogin(data) {
  const phone = String(data.phone || "").trim();
  const pin = String(data.pin || "").trim();
  const users = getObjectsCached(SHEETS.Users.name, 300);
  const shops = getObjectsCached(SHEETS.Shops.name, 300);
  const user = users.find(function (row) {
    return String(row.Phone).trim() === phone && String(row.PIN).trim() === pin;
  });
  if (!user) return { success: false, error: "Invalid phone or PIN." };
  if (user.Status !== "Active") return { success: false, error: "Account inactive." };
  const shop = shops.find(function (row) { return String(row.ShopID) === String(user.ShopID); });
  return {
    success: true,
    user: {
      userId: user.UserID,
      employeeId: user.UserID,
      name: user.Name,
      phone: user.Phone,
      role: user.Role,
      shopId: user.ShopID || "",
      shopName: shop ? shop.ShopName : "",
      status: user.Status,
      allowMultiShop: user.Role === "Admin"
    }
  };
}

function handleGetUsers() {
  const shops = getObjectsCached(SHEETS.Shops.name, 300);
  const users = getObjectsCached(SHEETS.Users.name, 300).map(function (user) {
    const shop = shops.find(function (row) { return String(row.ShopID) === String(user.ShopID); });
    const copy = Object.assign({}, user, { EmployeeID: user.UserID, ShopName: shop ? shop.ShopName : "" });
    delete copy.PIN;
    return copy;
  });
  return { success: true, users: users, employees: users };
}

function handleCreateShop(data) {
  const shopName = String(data.shopName || "").trim();
  if (!shopName) return { success: false, error: "Shop name is required." };
  const shops = getObjectsCached(SHEETS.Shops.name, 300);
  if (shops.some(function (shop) { return String(shop.ShopName).toLowerCase() === shopName.toLowerCase(); })) {
    return { success: false, error: "Shop already exists." };
  }
  const shopId = makeId("SHOP");
  appendObject(SHEETS.Shops.name, {
    ShopID: shopId,
    ShopName: shopName,
    Location: data.location || "",
    InchargeName: data.inchargeName || "",
    InchargeContact: data.inchargeContact || "",
    Status: data.status === "Inactive" ? "Inactive" : "Active",
    CreatedAt: nowIso()
  });
  return { success: true, shopId: shopId };
}

function handleUpdateShop(data) {
  const ok = updateObjectById(SHEETS.Shops.name, "ShopID", data.shopId || data.ShopID, {
    ShopName: data.shopName,
    Location: data.location,
    InchargeName: data.inchargeName,
    InchargeContact: data.inchargeContact,
    Status: data.status
  });
  return ok ? { success: true } : { success: false, error: "Shop not found." };
}

function handleCreateUser(data) {
  const phone = String(data.phone || "").trim();
  if (!phone) return { success: false, error: "Phone is required." };
  const users = getObjectsCached(SHEETS.Users.name, 300);
  if (users.some(function (user) { return String(user.Phone).trim() === phone; })) {
    return { success: false, error: "Phone number already exists." };
  }
  const userId = makeId("USR");
  appendObject(SHEETS.Users.name, {
    UserID: userId,
    Name: data.name || "",
    Phone: phone,
    PIN: data.pin || "",
    Role: data.role === "Admin" ? "Admin" : "Employee",
    ShopID: data.shopId || data.ShopID || "",
    Status: data.status === "Inactive" ? "Inactive" : "Active",
    CreatedAt: nowIso()
  });
  return { success: true, userId: userId, employeeId: userId };
}

function handleUpdateUser(data) {
  const ok = updateObjectById(SHEETS.Users.name, "UserID", data.userId || data.employeeId || data.UserID, {
    Name: data.name,
    Phone: data.phone,
    PIN: data.pin,
    Role: data.role,
    ShopID: data.shopId,
    Status: data.status
  });
  return ok ? { success: true } : { success: false, error: "User not found." };
}

function handleCreateProduct(data) {
  const productId = makeId("PROD");
  appendObject(SHEETS.Products.name, {
    ProductID: productId,
    ProductName: data.productName || "",
    Category: data.category || "Chicken",
    UOM: data.uom || "",
    DefaultRate: toNumber(data.defaultRate),
    Active: data.active === "No" ? "No" : "Yes",
    CreatedAt: nowIso()
  });
  return { success: true, productId: productId };
}

function handleUpdateProduct(data) {
  const ok = updateObjectById(SHEETS.Products.name, "ProductID", data.productId || data.ProductID, {
    ProductName: data.productName,
    Category: data.category,
    UOM: data.uom,
    DefaultRate: data.defaultRate === undefined ? undefined : toNumber(data.defaultRate),
    Active: data.active
  });
  return ok ? { success: true } : { success: false, error: "Product not found." };
}

function handleGetShopPrices(data) {
  var shopId = String(data.shopId || "");
  var prices = getObjects(SHEETS.ShopPrices.name);
  if (shopId) prices = prices.filter(function(row) { return String(row.ShopID) === shopId; });
  return { success: true, prices: prices };
}

function handleSaveShopPrices(data) {
  var shopId = String(data.shopId || "");
  if (!shopId) return { success: false, error: "Shop is required." };
  deleteRowsWhere(SHEETS.ShopPrices.name, function(row) { return String(row.ShopID) === shopId; });
  var rows = (data.prices || []).map(function(p) {
    return [shopId, p.productId || p.ProductID || "", toNumber(p.rate === undefined ? p.Rate : p.rate), nowIso()];
  }).filter(function(row) { return row[1]; });
  if (rows.length > 0) appendRows(SHEETS.ShopPrices.name, rows);
  return { success: true };
}

function validateSubmission(data, requireSales, requireStock) {
  if (!data) return "Report payload is required.";
  if (!data.shopId) return "Shop is required.";
  if (!data.employeeId) return "Employee is required.";
  if (!data.date) return "Date is required.";

  const user = findUser(data.employeeId);
  if (!user || user.Status !== "Active") return "Active employee account is required.";
  if (user.Role !== "Employee") return "Only employees can submit daily reports.";
  if (user.ShopID && String(user.ShopID) !== String(data.shopId)) return "Employee can submit only for their assigned shop.";

  const shop = findShop(data.shopId);
  if (!shop || shop.Status !== "Active") return "Active shop is required.";

  const sales = Array.isArray(data.salesEntries) ? data.salesEntries : [];
  const stocks = Array.isArray(data.stockEntries) ? data.stockEntries : [];
  if (requireSales && sales.length === 0) return "At least one sales row is required.";
  if (requireStock && stocks.length === 0) return "Stock rows are required.";

  const activeProducts = {};
  getObjectsCached(SHEETS.Products.name, 300).forEach(function (product) {
    if (product.Active === "Yes") activeProducts[String(product.ProductID)] = true;
  });

  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];
    if (!activeProducts[String(sale.productId)]) return "Unknown or inactive sales product: " + sale.productName;
    if (toNumber(sale.quantity) <= 0) return "Invalid quantity for " + sale.productName;
    if (toNumber(sale.rate) < 0) return "Invalid rate for " + sale.productName;
    if (sale.saleType === "Credit" && !String(sale.customerName || "").trim()) {
      return "Customer name is required for credit sale: " + sale.productName;
    }
  }

  for (let j = 0; j < stocks.length; j++) {
    const stock = stocks[j];
    if (!activeProducts[String(stock.productId)]) return "Unknown or inactive stock product: " + stock.productName;
    if (!isFinite(Number(stock.openingStock))) return "Invalid opening stock for " + stock.productName;
    if (!isFinite(Number(stock.receipt))) return "Invalid receipt for " + stock.productName;
    if (!isFinite(Number(stock.sales))) return "Invalid sales quantity for " + stock.productName;
    if (stock.actualClosing === undefined || stock.actualClosing === null || stock.actualClosing === "" || !isFinite(Number(stock.actualClosing))) {
      return "Actual closing stock is required for " + stock.productName;
    }
  }
  return null;
}

function handleGetOpeningStock(data) {
  const shopId = data.shopId || "";
  const date = normalizeDate(data.date || new Date());
  const shop = findShop(shopId) || {};
  const products = getObjectsCached(SHEETS.Products.name, 300).filter(function (product) { return product.Active === "Yes"; });
  const overrides = getObjects(SHEETS.OpeningStock.name).filter(function(row) {
    return String(row.ShopID) === String(shopId);
  });
  const stockRows = getObjects(SHEETS.DailyStockEntries.name)
    .filter(function (row) { return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) < date; })
    .sort(function (a, b) { return String(normalizeDate(b.Date) + b.CreatedAt).localeCompare(String(normalizeDate(a.Date) + a.CreatedAt)); });

  const openingStock = products.map(function (product) {
    const last = stockRows.find(function (row) { return String(row.ProductID) === String(product.ProductID); });
    const override = overrides.find(function(row) { return String(row.ProductID) === String(product.ProductID); });
    return {
      ShopID: shopId,
      ShopName: shop.ShopName || "",
      ProductID: product.ProductID,
      ProductName: product.ProductName,
      Category: product.Category,
      UOM: product.UOM,
      CurrentOpeningStock: override ? toNumber(override.OpeningStock) : last ? toNumber(last.ActualClosing) : 0,
      LastUpdatedDate: override ? override.UpdatedAt : last ? normalizeDate(last.Date) : ""
    };
  });
  return { success: true, openingStock: openingStock };
}

function handleGetInitialData(data) {
  const shopId = String(data.shopId || "");
  const employeeId = String(data.employeeId || "");
  const date = normalizeDate(data.date || new Date());
  const openingStock = handleGetOpeningStock({ shopId: shopId, employeeId: employeeId, date: date }).openingStock;

  return {
    success: true,
    shops: getObjectsCached(SHEETS.Shops.name, 300),
    products: getObjectsCached(SHEETS.Products.name, 300),
    openingStock: openingStock
  };
}

function resolveProductId(productId, productName) {
  if (productId) return String(productId);
  const product = getObjectsCached(SHEETS.Products.name, 300).find(function(row) {
    return String(row.ProductName) === String(productName || "");
  });
  return product ? String(product.ProductID) : "";
}

function getCurrentOpeningStockValue(shopId, productId) {
  const today = normalizeDate(new Date());
  const override = getObjects(SHEETS.OpeningStock.name).find(function(row) {
    return String(row.ShopID) === String(shopId) && String(row.ProductID) === String(productId);
  });
  if (override) return toNumber(override.OpeningStock);

  const last = getObjects(SHEETS.DailyStockEntries.name)
    .filter(function(row) {
      return String(row.ShopID) === String(shopId) && String(row.ProductID) === String(productId) && normalizeDate(row.Date) < today;
    })
    .sort(function(a, b) {
      return String(normalizeDate(b.Date) + b.CreatedAt).localeCompare(String(normalizeDate(a.Date) + a.CreatedAt));
    })[0];
  return last ? toNumber(last.ActualClosing) : 0;
}

function setOpeningStockValue(shopId, productId, openingStock) {
  deleteRowsWhere(SHEETS.OpeningStock.name, function(row) {
    return String(row.ShopID) === String(shopId) && String(row.ProductID) === String(productId);
  });
  appendRows(SHEETS.OpeningStock.name, [[shopId, productId, toNumber(openingStock), nowIso()]]);
}

function adjustOpeningStockForTransfer(shopId, productId, productName, deltaQty) {
  const resolvedProductId = resolveProductId(productId, productName);
  const delta = toNumber(deltaQty);
  if (!shopId || !resolvedProductId || delta === 0) return;
  const current = getCurrentOpeningStockValue(shopId, resolvedProductId);
  setOpeningStockValue(shopId, resolvedProductId, current + delta);
}

function handleGetTodayReport(data) {
  const date = normalizeDate(data.date || new Date());
  const report = getObjects(SHEETS.DailyReports.name).find(function (row) {
    return String(row.ShopID) === String(data.shopId) && normalizeDate(row.Date) === date;
  });
  return { success: true, report: report ? enrichReport(report) : null };
}

function handleSubmitReport(data, mode) {
  var todayTZ = normalizeDate(new Date());
  if (!data.date) data.date = todayTZ;
  if (normalizeDate(data.date) > todayTZ) data.date = todayTZ;
  const validation = validateSubmission(data, mode !== "stock", mode !== "sales");
  if (validation) return { success: false, error: validation };

  const date = normalizeDate(data.date);
  const reports = getObjects(SHEETS.DailyReports.name);
  let existing = null;
  if (data.reportId) {
    existing = reports.find(function (row) { return String(row.ReportID) === String(data.reportId); });
    if (!existing) return { success: false, error: "Reopened report not found." };
    if (existing.Status !== "Reopened" && mode === "full") return { success: false, error: "Only reopened reports can be corrected." };
  } else {
    existing = reports.find(function (row) { return String(row.ShopID) === String(data.shopId) && normalizeDate(row.Date) === date; });
  }

  if (existing && existing.Status === "Approved") {
    return { success: false, error: "Approved reports cannot be changed. Ask admin to reopen it first." };
  }

  const reportId = existing ? existing.ReportID : makeId("REP");
  const now = nowIso();
  const shop = findShop(data.shopId) || {};
  if (mode !== "stock") {
    deleteRowsWhere(SHEETS.DailySalesEntries.name, function (row) { return String(row.ReportID) === String(reportId); });
  }
  if (mode !== "sales") {
    deleteRowsWhere(SHEETS.DailyStockEntries.name, function (row) { return String(row.ReportID) === String(reportId); });
  }

  const salesRows = [];
  if (mode !== "stock") {
    (data.salesEntries || []).forEach(function (sale) {
      const total = roundNumber(toNumber(sale.quantity) * toNumber(sale.rate));
      salesRows.push([
        makeId("SAL"),
        reportId,
        data.shopId,
        data.shopName || shop.ShopName || "",
        date,
        data.employeeId,
        sale.productId,
        sale.productName,
        sale.uom,
        toNumber(sale.quantity),
        toNumber(sale.rate),
        sale.saleType,
        sale.saleType === "Cash" ? total : 0,
        sale.saleType === "Credit" ? total : 0,
        sale.efdNumber || "",
        sale.saleType === "Credit" ? sale.customerName || "" : "",
        total,
        now
      ]);
    });
  }
  appendRows(SHEETS.DailySalesEntries.name, salesRows);

  const stockRows = [];
  if (mode !== "sales") {
    const salesQuantityByProduct = getSalesQuantityByProduct(data.shopId, date);
    (data.stockEntries || []).forEach(function (stock) {
      const opening = toNumber(stock.openingStock);
      const receipt = toNumber(stock.receipt);
      const sales = salesQuantityByProduct[String(stock.productId)] === undefined ? toNumber(stock.sales) : salesQuantityByProduct[String(stock.productId)];
      const expected = roundNumber(opening + receipt - sales);
      const actual = toNumber(stock.actualClosing);
      stockRows.push([
        makeId("STK"),
        reportId,
        data.shopId,
        data.shopName || shop.ShopName || "",
        date,
        data.employeeId,
        stock.productId,
        stock.productName,
        stock.category || "",
        stock.uom,
        stock.mtnNo || "",
        opening,
        receipt,
        sales,
        expected,
        actual,
        roundNumber(actual - expected),
        now
      ]);
    });
  }
  appendRows(SHEETS.DailyStockEntries.name, stockRows);

  if (mode === "sales") {
    recalculateExistingStockSales(reportId, data.shopId, date);
  }

  const reportPatch = {
    ReportID: reportId,
    ShopID: data.shopId,
    ShopName: data.shopName || shop.ShopName || "",
    Date: date,
    EmployeeID: data.employeeId,
    EmployeeName: data.employeeName || getEmployeeName(data.employeeId),
    SalesSubmitted: mode === "stock" ? existing && existing.SalesSubmitted ? existing.SalesSubmitted : "No" : "Yes",
    StockSubmitted: mode === "sales" ? existing && existing.StockSubmitted ? existing.StockSubmitted : "No" : "Yes",
    Status: "Submitted",
    SubmittedAt: now,
    ApprovedBy: "",
    ApprovedAt: ""
  };

  if (existing) updateObjectById(SHEETS.DailyReports.name, "ReportID", reportId, reportPatch);
  else appendObject(SHEETS.DailyReports.name, reportPatch);

  upsertCollection(data.shopId, date, reportId, data.employeeId, data.employeeName || getEmployeeName(data.employeeId));
  const totals = reportTotals(reportId);
  logAction(data.employeeId, "SUBMIT_REPORT", "Report " + reportId + " submitted for " + reportPatch.ShopName + " on " + date);
  return {
    success: true,
    reportId: reportId,
    totalSales: totals.TotalSales,
    cashSales: totals.CashSales,
    creditSalesAmount: totals.CreditSales,
    mismatchCount: totals.StockMismatch
  };
}

function buildCollectionBase(shopId, date, reportId, employeeId, employeeName) {
  const shop = findShop(shopId) || {};
  const normalizedDate = normalizeDate(date);
  const reports = getObjects(SHEETS.DailyReports.name);
  const report = reportId
    ? reports.find(function (row) { return String(row.ReportID) === String(reportId); })
    : reports.find(function (row) { return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === normalizedDate; });
  const sales = getObjects(SHEETS.DailySalesEntries.name).filter(function (row) {
    return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === normalizedDate;
  });
  const cashSales = sales.reduce(function (sum, row) { return sum + toNumber(row.CashSales); }, 0);
  const creditSales = sales.reduce(function (sum, row) { return sum + toNumber(row.CreditSales); }, 0);
  const totalSales = cashSales + creditSales;
  const month = normalizedDate.slice(0, 7);
  const collections = getObjects(SHEETS.Collections.name);
  const existing = collections.find(function (row) {
    return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === normalizedDate;
  });
  const depositCash = existing ? toNumber(existing.DepositCash) : 0;
  const depositLIPA = existing ? toNumber(existing.DepositLIPA) : 0;
  const depositInBank = existing ? toNumber(existing.DepositInBank) : 0;
  const efdZ = existing ? toNumber(existing.EFDZReport) : 0;
  const actualCollection = roundNumber(depositCash + depositLIPA);
  const variance = roundNumber(cashSales - actualCollection);
  const bankDepositDifference = roundNumber(depositCash - depositInBank);
  const salesVsEFD = roundNumber(totalSales - efdZ);
  return {
    CollectionID: existing ? existing.CollectionID : makeId("COL"),
    ReportID: existing && existing.ReportID ? existing.ReportID : report ? report.ReportID : reportId || "",
    ShopID: shopId,
    ShopName: shop.ShopName || (existing ? existing.ShopName : ""),
    Date: normalizedDate,
    Month: month,
    Day: dayName(date),
    EmployeeID: existing && existing.EmployeeID ? existing.EmployeeID : employeeId || (report ? report.EmployeeID : ""),
    EmployeeName: existing && existing.EmployeeName ? existing.EmployeeName : employeeName || (report ? report.EmployeeName : ""),
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
    DateOfDeposit: existing ? existing.DateOfDeposit : "",
    EFDZReport: efdZ,
    SalesVsEFD: salesVsEFD,
    Name: existing ? existing.Name : "",
    Signature: existing ? existing.Signature : "",
    Remarks: existing ? existing.Remarks : "",
    Status: existing && existing.Status ? existing.Status : "Draft",
    AdminNote: existing ? existing.AdminNote : "",
    SubmittedAt: existing ? existing.SubmittedAt : "",
    UpdatedAt: existing ? existing.UpdatedAt : nowIso(),
    ApprovedBy: existing ? existing.ApprovedBy : "",
    ApprovedAt: existing ? existing.ApprovedAt : ""
  };
}

function upsertCollection(shopId, date, reportId, employeeId, employeeName) {
  const collections = getObjects(SHEETS.Collections.name);
  const normalizedDate = normalizeDate(date);
  const existing = collections.find(function (row) {
    return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === normalizedDate;
  });
  const row = buildCollectionBase(shopId, normalizedDate, reportId, employeeId, employeeName);
  row.UpdatedAt = nowIso();
  if (existing) updateObjectById(SHEETS.Collections.name, "CollectionID", existing.CollectionID, row);
  else appendObject(SHEETS.Collections.name, row);
  return row;
}

function getReportBundle(data) {
  const startDate = data.startDate || "";
  const endDate = data.endDate || "";
  const shopId = data.shopId || "";
  const employeeId = data.employeeId || "";
  const reports = getObjects(SHEETS.DailyReports.name)
    .filter(function (report) { return inDateRange(report.Date, startDate, endDate); })
    .filter(function (report) { return !shopId || String(report.ShopID) === String(shopId); })
    .filter(function (report) { return !employeeId || String(report.EmployeeID) === String(employeeId); })
    .map(enrichReport);
  const reportIds = {};
  reports.forEach(function (report) { reportIds[String(report.ReportID)] = true; });
  return {
    summaries: reports,
    sales: getObjects(SHEETS.DailySalesEntries.name).filter(function (row) { return reportIds[String(row.ReportID)]; }).map(addEmployeeName),
    stocks: getObjects(SHEETS.DailyStockEntries.name).filter(function (row) { return reportIds[String(row.ReportID)]; }).map(addEmployeeName),
    creditSales: buildCreditSalesRows().filter(function (row) { return reportIds[String(row.ReportID)]; })
  };
}

function handleGetMyReports(data) {
  const reports = getObjects(SHEETS.DailyReports.name)
    .filter(function (report) { return String(report.EmployeeID) === String(data.employeeId); })
    .map(enrichReport)
    .sort(function (a, b) { return String(b.SubmittedAt).localeCompare(String(a.SubmittedAt)); });
  return { success: true, reports: reports };
}

function handleGetDashboard(data) {
  const date = normalizeDate(data.date || new Date());
  const month = data.month || date.slice(0, 7);
  const shopId = data.shopId || "";
  const allSales = getObjects(SHEETS.DailySalesEntries.name);
  const allStocks = getObjects(SHEETS.DailyStockEntries.name);
  const allReports = getObjects(SHEETS.DailyReports.name);
  const allCollections = getObjects(SHEETS.Collections.name);

  const sales = allSales
    .filter(function (row) { return normalizeDate(row.Date).slice(0, 7) === month; })
    .filter(function (row) { return !shopId || String(row.ShopID) === String(shopId); });
  const stocks = allStocks
    .filter(function (row) { return normalizeDate(row.Date).slice(0, 7) === month; })
    .filter(function (row) { return !shopId || String(row.ShopID) === String(shopId); });
  const totalsByReport = buildReportTotalsById(sales, stocks);
  const reports = allReports
    .filter(function (row) { return normalizeDate(row.Date).slice(0, 7) === month; })
    .filter(function (row) { return !shopId || String(row.ShopID) === String(shopId); })
    .map(function (report) { return Object.assign({}, report, reportTotalsFromMap(report.ReportID, totalsByReport)); });
  const collections = allCollections
    .filter(function (row) { return String(row.Month) === String(month); })
    .filter(function (row) { return !shopId || String(row.ShopID) === String(shopId); })
    .sort(function (a, b) { return String(a.Date).localeCompare(String(b.Date)); });
  const dateCollections = collections.filter(function (row) { return normalizeDate(row.Date) === date; });

  const cashSales = sales.reduce(function (sum, row) { return sum + toNumber(row.CashSales); }, 0);
  const creditSales = sales.reduce(function (sum, row) { return sum + toNumber(row.CreditSales); }, 0);
  const depositCash = collections.reduce(function (sum, row) { return sum + toNumber(row.DepositCash); }, 0);
  const depositLIPA = collections.reduce(function (sum, row) { return sum + toNumber(row.DepositLIPA); }, 0);
  const mismatchRows = stocks.filter(function (row) { return toNumber(row.Mismatch) !== 0; });

  const byDate = {};
  sales.forEach(function (row) {
    const key = normalizeDate(row.Date).slice(5);
    if (!byDate[key]) byDate[key] = { name: key, cash: 0, credit: 0, total: 0, value: 0 };
    byDate[key].cash += toNumber(row.CashSales);
    byDate[key].credit += toNumber(row.CreditSales);
    byDate[key].total += toNumber(row.TotalAmount);
    byDate[key].value += toNumber(row.TotalAmount);
  });

  const byShop = {};
  const byProduct = {};
  const mismatchByProduct = {};
  sales.forEach(function (row) {
    byShop[row.ShopName] = (byShop[row.ShopName] || 0) + toNumber(row.TotalAmount);
    byProduct[row.ProductName] = (byProduct[row.ProductName] || 0) + toNumber(row.TotalAmount);
  });
  mismatchRows.forEach(function (row) {
    mismatchByProduct[row.ProductName] = (mismatchByProduct[row.ProductName] || 0) + Math.abs(toNumber(row.Mismatch));
  });

  const dateReports = reports.filter(function (row) { return normalizeDate(row.Date) === date; });
  const dashboard = {
    stats: {
      totalSales: cashSales + creditSales,
      cashSales: cashSales,
      creditSales: creditSales,
      depositCash: depositCash,
      depositLIPA: depositLIPA,
      variance: collections.reduce(function (sum, row) { return sum + toNumber(row.Variance); }, 0),
      efdDifference: collections.reduce(function (sum, row) { return sum + toNumber(row.SalesVsEFD); }, 0),
      bankDepositDifference: collections.reduce(function (sum, row) { return sum + toNumber(row.BankDepositDifference); }, 0),
      todayCashSales: dateCollections.reduce(function (sum, row) { return sum + toNumber(row.CashSales); }, 0),
      todayLIPA: dateCollections.reduce(function (sum, row) { return sum + toNumber(row.DepositLIPA); }, 0),
      todayBankDeposit: dateCollections.reduce(function (sum, row) { return sum + toNumber(row.DepositInBank); }, 0),
      todayVariance: dateCollections.reduce(function (sum, row) { return sum + toNumber(row.Variance); }, 0),
      pendingCollectionApprovals: collections.filter(function (row) { return row.Status === "Submitted" || row.Status === "Reopened"; }).length,
      collectionsWithVariance: collections.filter(function (row) { return toNumber(row.Variance) !== 0; }).length,
      collectionsMissingEFD: collections.filter(function (row) { return toNumber(row.EFDZReport) === 0; }).length,
      bankDepositMismatches: collections.filter(function (row) { return toNumber(row.BankDepositDifference) !== 0; }).length,
      stockMismatch: mismatchRows.length,
      reportsSubmitted: dateReports.length,
      pendingApprovals: reports.filter(function (row) { return row.Status === "Submitted" || row.Status === "Pending Approval"; }).length
    },
    cashCreditSplit: [{ name: "Cash Sales", value: cashSales }, { name: "Credit Sales", value: creditSales }].filter(function (row) { return row.value > 0; }),
    dailySalesTrend: Object.keys(byDate).sort().map(function (key) { return byDate[key]; }),
    shopSalesComparison: Object.keys(byShop).map(function (key) { return { name: key, value: byShop[key] }; }),
    topSellingProducts: Object.keys(byProduct).sort(function (a, b) { return byProduct[b] - byProduct[a]; }).slice(0, 6).map(function (key) { return { name: key, value: byProduct[key] }; }),
    mismatchByProduct: Object.keys(mismatchByProduct).map(function (key) { return { name: key, value: mismatchByProduct[key], mismatch: mismatchByProduct[key] }; }),
    todaySubmissions: dateReports.map(function (report) {
      const totals = reportTotalsFromMap(report.ReportID, totalsByReport);
      const collection = collections.find(function (row) { return String(row.ShopID) === String(report.ShopID) && normalizeDate(row.Date) === normalizeDate(report.Date); });
      return {
        ReportID: report.ReportID,
        Shop: report.ShopName,
        Employee: report.EmployeeName,
        SalesTotal: totals.TotalSales,
        StockStatus: totals.StockMismatch > 0 ? "Mismatch " + totals.StockMismatch : report.StockSubmitted === "Yes" ? "Matched" : "Not submitted",
        CollectionStatus: collection ? collection.Status : "Draft",
        ApprovalStatus: report.Status
      };
    }),
    collectionSummary: collections,
    stockMismatchRows: mismatchRows
  };
  return { success: true, dashboard: dashboard, stats: dashboard.stats, recentSummaries: reports };
}

function handleGetDailySalesReport(data) {
  const rows = getObjects(SHEETS.DailySalesEntries.name)
    .filter(function (row) { return inDateRange(row.Date, data.startDate || "", data.endDate || ""); })
    .filter(function (row) { return !data.shopId || String(row.ShopID) === String(data.shopId); })
    .map(addEmployeeName);
  return { success: true, sales: rows };
}

function handleGetDailyStockReport(data) {
  const rows = getObjects(SHEETS.DailyStockEntries.name)
    .filter(function (row) { return inDateRange(row.Date, data.startDate || "", data.endDate || ""); })
    .filter(function (row) { return !data.shopId || String(row.ShopID) === String(data.shopId); })
    .map(addEmployeeName);
  return { success: true, stocks: rows };
}

function filterCollections(data) {
  const month = data.month || "";
  const startDate = data.startDate || "";
  const endDate = data.endDate || "";
  const status = data.status || "";
  const search = String(data.search || "").toLowerCase();
  return getObjects(SHEETS.Collections.name)
    .filter(function (row) { return !month || String(row.Month) === String(month); })
    .filter(function (row) { return inDateRange(row.Date, startDate, endDate); })
    .filter(function (row) { return !data.shopId || String(row.ShopID) === String(data.shopId); })
    .filter(function (row) { return !status || String(row.Status) === String(status); })
    .filter(function (row) {
      return !search || String(row.EmployeeName || "").toLowerCase().indexOf(search) >= 0 || String(row.Name || "").toLowerCase().indexOf(search) >= 0;
    })
    .sort(function (a, b) { return String(a.Date).localeCompare(String(b.Date)) || String(a.ShopName).localeCompare(String(b.ShopName)); });
}

function handleGetTodayCollection(data) {
  const shopId = data.shopId || "";
  const date = normalizeDate(data.date || new Date());
  const existing = getObjects(SHEETS.Collections.name).find(function (row) {
    return String(row.ShopID) === String(shopId) && normalizeDate(row.Date) === date;
  });
  return { success: true, collection: existing || buildCollectionBase(shopId, date, data.reportId || "", data.employeeId || "", data.employeeName || "") };
}

function handleSubmitDailyCollection(data) {
  if (!data.shopId || !data.date || !data.employeeId) return { success: false, error: "Shop, date, and employee are required." };
  if (!data.signature) return { success: false, error: "Signature confirmation is required before submitting collection." };
  const user = getObjectsCached(SHEETS.Users.name, 300).find(function (row) { return String(row.UserID) === String(data.employeeId); });
  if (!user || user.Role !== "Employee" || user.Status !== "Active") return { success: false, error: "Active employee account is required." };
  if (user.ShopID && String(user.ShopID) !== String(data.shopId)) return { success: false, error: "Employee can submit collection only for assigned shop." };

  const date = normalizeDate(data.date);
  let base = upsertCollection(data.shopId, date, data.reportId || "", data.employeeId, data.employeeName || getEmployeeName(data.employeeId));
  const depositCash = toNumber(data.depositCash);
  const depositLIPA = toNumber(data.depositLIPA);
  const depositInBank = toNumber(data.depositInBank);
  const efdZ = toNumber(data.efdZReport);
  base.EmployeeID = data.employeeId;
  base.EmployeeName = data.employeeName || getEmployeeName(data.employeeId);
  base.DepositCash = depositCash;
  base.DepositLIPA = depositLIPA;
  base.ExpectedCollection = toNumber(base.CashSales);
  base.ActualCollection = roundNumber(depositCash + depositLIPA);
  base.Variance = roundNumber(toNumber(base.CashSales) - base.ActualCollection);
  base.DepositInBank = depositInBank;
  base.BankDepositDifference = roundNumber(depositCash - depositInBank);
  base.DateOfDeposit = data.dateOfDeposit || "";
  base.EFDZReport = efdZ;
  base.SalesVsEFD = roundNumber(toNumber(base.TotalSales) - efdZ);
  base.Name = data.name || base.EmployeeName;
  base.Signature = data.signature;
  base.Remarks = data.remarks || "";
  base.Status = "Submitted";
  base.SubmittedAt = nowIso();
  base.UpdatedAt = nowIso();
  base.ApprovedBy = "";
  base.ApprovedAt = "";
  updateObjectById(SHEETS.Collections.name, "CollectionID", base.CollectionID, base);
  logAction(data.employeeId, "SUBMIT_COLLECTION", "Collection submitted for " + base.ShopName + " on " + date);
  return { success: true, collection: base };
}

function handleGetCollections(data) {
  return { success: true, collections: filterCollections(data) };
}

function handleGetMonthlyCollectionReport(data) {
  const month = data.month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  return { success: true, collections: filterCollections(Object.assign({}, data, { month: month })) };
}

function findCollection(data) {
  return getObjects(SHEETS.Collections.name).find(function (item) {
    if (data.collectionId) return String(item.CollectionID) === String(data.collectionId);
    return String(item.ShopID) === String(data.shopId) && normalizeDate(item.Date) === normalizeDate(data.date);
  });
}

function recalcCollection(row) {
  row.ExpectedCollection = toNumber(row.CashSales);
  row.ActualCollection = roundNumber(toNumber(row.DepositCash) + toNumber(row.DepositLIPA));
  row.Variance = roundNumber(toNumber(row.CashSales) - row.ActualCollection);
  row.BankDepositDifference = roundNumber(toNumber(row.DepositCash) - toNumber(row.DepositInBank));
  row.SalesVsEFD = roundNumber(toNumber(row.TotalSales) - toNumber(row.EFDZReport));
  row.UpdatedAt = nowIso();
  return row;
}

function handleUpdateCollectionByAdmin(data) {
  const row = findCollection(data);
  if (!row) return { success: false, error: "Collection row not found." };
  row.AdminNote = data.adminNote === undefined ? row.AdminNote : data.adminNote;
  row.UpdatedAt = nowIso();
  updateObjectById(SHEETS.Collections.name, "CollectionID", row.CollectionID, row);
  return { success: true, collection: row };
}

function handleUpdateCollectionStatus(data, status) {
  const row = findCollection(data);
  if (!row) return { success: false, error: "Collection row not found." };
  row.Status = status;
  row.AdminNote = data.reason || data.adminNote || row.AdminNote || "";
  row.ApprovedBy = status === "Approved" ? data.adminId || data.userId || "" : "";
  row.ApprovedAt = status === "Approved" ? nowIso() : "";
  row.UpdatedAt = nowIso();
  updateObjectById(SHEETS.Collections.name, "CollectionID", row.CollectionID, row);
  logAction(data.adminId || data.userId || "ADMIN", "COLLECTION_STATUS", "Collection " + row.CollectionID + " changed to " + status);
  return { success: true, collection: row };
}

function handleUpdateReportStatus(reportId, status, adminId) {
  if (!reportId) return { success: false, error: "Report ID is required." };
  const patch = { Status: status };
  if (status === "Approved") {
    patch.ApprovedBy = adminId;
    patch.ApprovedAt = nowIso();
  }
  const ok = updateObjectById(SHEETS.DailyReports.name, "ReportID", reportId, patch);
  if (!ok) return { success: false, error: "Report not found." };
  logAction(adminId || "ADMIN", "REPORT_STATUS", "Report " + reportId + " changed to " + status);
  return { success: true };
}

function handleGetStockMismatchReport(data) {
  const rows = getObjects(SHEETS.DailyStockEntries.name)
    .filter(function (row) { return toNumber(row.Mismatch) !== 0; })
    .filter(function (row) { return inDateRange(row.Date, data.startDate || "", data.endDate || ""); })
    .filter(function (row) { return !data.shopId || String(row.ShopID) === String(data.shopId); })
    .map(addEmployeeName);
  return { success: true, stocks: rows };
}

function buildCreditSalesRows() {
  const reports = getObjects(SHEETS.DailyReports.name);
  const statusByReport = {};
  reports.forEach(function (report) { statusByReport[String(report.ReportID)] = report.Status; });
  return getObjects(SHEETS.DailySalesEntries.name)
    .filter(function (row) { return row.SaleType === "Credit"; })
    .map(function (row) {
      return {
        EntryID: row.EntryID,
        ReportID: row.ReportID,
        ShopID: row.ShopID,
        ShopName: row.ShopName,
        Date: row.Date,
        EmployeeID: row.EmployeeID,
        EmployeeName: getEmployeeName(row.EmployeeID),
        CustomerName: row.CustomerName,
        ProductName: row.ProductName,
        Amount: row.CreditSales,
        EFDNumber: row.EFDNumber,
        Status: statusByReport[String(row.ReportID)] || "Submitted",
        CreatedAt: row.CreatedAt
      };
    });
}

function handleGetCreditSalesReport(data) {
  const rows = buildCreditSalesRows()
    .filter(function (row) { return inDateRange(row.Date, data.startDate || "", data.endDate || ""); })
    .filter(function (row) { return !data.shopId || String(row.ShopID) === String(data.shopId); });
  return { success: true, creditSales: rows };
}

function handleSubmitLiveWeight(data) {
  if (!data.shopId || !data.date || !data.employeeId) return { success: false, error: "Shop, date, and employee are required." };
  const user = getObjectsCached(SHEETS.Users.name, 300).find(function (row) { return String(row.UserID) === String(data.employeeId); });
  if (!user || user.Status !== "Active") return { success: false, error: "Active employee account is required." };

  const date = normalizeDate(data.date);
  const now = nowIso();
  const shop = findShop(data.shopId) || {};
  
  const totalBirds = toNumber(data.totalBirds);
  const netWeight = toNumber(data.netLiveWeightKG);
  const avgWeight = totalBirds > 0 ? roundNumber(netWeight / totalBirds) : 0;
  
  const liveWeightId = makeId("LW");
  const obj = {
    LiveWeightID: liveWeightId,
    ShopID: data.shopId,
    ShopName: shop.ShopName || "",
    Date: date,
    Crates: toNumber(data.crates),
    TotalBirds: totalBirds,
    NetLiveWeightKG: netWeight,
    AvgLiveWeightKG: avgWeight,
    DOA: toNumber(data.doa),
    InjuredBirds: toNumber(data.injuredBirds),
    Shortage: toNumber(data.shortage),
    NetAcceptedBirds: toNumber(data.netAcceptedBirds),
    CreatedAt: now
  };
  
  appendObject(SHEETS.LiveWeight.name, obj);
  logAction(data.employeeId, "SUBMIT_LIVE_WEIGHT", "Live weight record " + liveWeightId + " submitted for " + (shop.ShopName || data.shopId) + " on " + date);
  return { success: true, liveWeight: obj };
}

function handleSubmitMTN(data) {
  if (!data.shopId || !data.mtnNo) return { success: false, error: "MTN No and Shop are required." };
  var now = nowIso();
  var items = Array.isArray(data.items) ? data.items : [];
  var isReceipt = items.some(function(item) { return toNumber(item.qtyReceived) > 0; });

  if (isReceipt) {
    var sheet = getSheet(SHEETS.MTN.name);
    if (sheet.getLastRow() <= 1) return { success: false, error: "MTN not found." };
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var mtnNoIdx = headers.indexOf("MTNNo");
    var shopIdx = headers.indexOf("ToShopID");
    var productIdx = headers.indexOf("ProductName");
    var employeeIdIdx = headers.indexOf("EmployeeID");
    var employeeNameIdx = headers.indexOf("EmployeeName");
    var qtyReceivedIdx = headers.indexOf("QtyReceived");
    var varianceIdx = headers.indexOf("Variance");
    var statusIdx = headers.indexOf("Status");
    var complaintIdx = headers.indexOf("Complaint");
    var productIdIdx = headers.indexOf("ProductID");
    var updated = 0;

    items.forEach(function(item) {
      var itemProductId = String(item.productId || "");
      var itemProductName = String(item.productName || "");
      for (var i = 1; i < values.length; i++) {
        var rowProductId = productIdIdx >= 0 ? String(values[i][productIdIdx] || "") : "";
        var productMatches = itemProductId && rowProductId
          ? rowProductId === itemProductId
          : String(values[i][productIdx]) === itemProductName;
        if (
          String(values[i][mtnNoIdx]) === String(data.mtnNo) &&
          String(values[i][shopIdx]) === String(data.shopId) &&
          productMatches
        ) {
          var previousReceived = toNumber(values[i][qtyReceivedIdx]);
          var nextReceived = toNumber(item.qtyReceived);
          sheet.getRange(i + 1, employeeIdIdx + 1).setValue(data.employeeId || "");
          sheet.getRange(i + 1, employeeNameIdx + 1).setValue(data.employeeName || "");
          sheet.getRange(i + 1, qtyReceivedIdx + 1).setValue(nextReceived);
          sheet.getRange(i + 1, varianceIdx + 1).setValue(toNumber(item.variance));
          sheet.getRange(i + 1, statusIdx + 1).setValue("Received");
          sheet.getRange(i + 1, complaintIdx + 1).setValue(data.complaint || "");
          if (productIdIdx >= 0 && itemProductId) sheet.getRange(i + 1, productIdIdx + 1).setValue(itemProductId);
          adjustOpeningStockForTransfer(data.shopId, itemProductId || rowProductId, itemProductName, nextReceived - previousReceived);
          updated++;
          break;
        }
      }
    });

    if (updated === 0) return { success: false, error: "MTN not found." };
    logAction(data.employeeId || "EMPLOYEE", "RECEIVE_MTN", "MTN " + data.mtnNo + " received by " + (data.employeeName || data.employeeId || ""));
    return { success: true, reportId: String(data.mtnNo) };
  }

  var rows = [];
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    rows.push([
      makeId("MTN"),
      data.mtnNo,
      data.mtnDate || normalizeDate(new Date()),
      data.from || "HO",
      data.shopId,
      data.shopName || data.to || "",
      data.employeeId || "",
      data.employeeName || "",
      item.productName || "",
      toNumber(item.qtyAsPerMTN),
      toNumber(item.qtyReceived),
      toNumber(item.variance),
      toNumber(item.qtyReceived) > 0 ? "Received" : "Sent",
      data.complaint || "",
      now,
      item.productId || ""
    ]);
  }

  if (rows.length > 0) {
    appendRows(SHEETS.MTN.name, rows);
  }

  logAction(data.employeeId || "ADMIN", "SUBMIT_MTN", "MTN " + data.mtnNo + " from " + (data.from || "HO") + " to " + (data.shopName || data.to) + " with " + items.length + " items");
  return { success: true, reportId: rows.length > 0 ? rows[0][0] : makeId("MTN") };
}

function handleUpdateOpeningStock(data) {
  if (!data.shopId || !data.productId) return { success: false, error: "Shop and Product are required." };
  var openingStock = toNumber(data.openingStock);

  setOpeningStockValue(data.shopId, data.productId, openingStock);

  logAction("ADMIN", "UPDATE_OPENING_STOCK", "Product " + data.productId + " at shop " + data.shopId + " set to " + openingStock);
  return { success: true };
}

function handleGetMTNsForShop(data) {
  var shopId = String(data.shopId || "");
  var mtns = getObjects(SHEETS.MTN.name);
  if (shopId) mtns = mtns.filter(function(row) { return String(row.ToShopID) === shopId; });
  return { success: true, mtns: mtns };
}
