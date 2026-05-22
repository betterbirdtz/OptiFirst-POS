import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Landmark,
  ReceiptText,
  Save,
  Send,
  ShoppingBag,
  WalletCards
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import ConfirmSubmitModal from "../../components/employee/ConfirmSubmitModal";
import ReviewWarnings from "../../components/employee/ReviewWarnings";
import StepProgress from "../../components/employee/StepProgress";
import type { Product, SalesSubmissionItem, Shop, StockSubmissionItem, UserSession } from "../../types";
import {
  calculateActualCollection,
  calculateBankDepositDifference,
  calculateCollectionVariance,
  calculateExpectedClosing,
  calculateMismatch,
  calculateSalesAmount,
  calculateSalesVsEfd,
  formatCurrency
} from "../../utils/calculations";
import { getDayName, getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";
import { getDailyReportWarnings, hasBlockingReportErrors, validateCollectionSettlement } from "../../utils/validation";

interface CollectionFormState {
  depositCash: number;
  depositLIPA: number;
  depositInBank: number;
  dateOfDeposit: string;
  efdZReport: number;
  name: string;
  signatureConfirmed: boolean;
  remarks: string;
  status?: string;
}

export const EodClosing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(getLocalDateInputValue());
  const [shopId, setShopId] = useState("");
  const [reportId, setReportId] = useState<string | undefined>();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [salesEntries, setSalesEntries] = useState<SalesSubmissionItem[]>([]);
  const [stockEntries, setStockEntries] = useState<StockSubmissionItem[]>([]);
  const [collection, setCollection] = useState<CollectionFormState>({
    depositCash: 0,
    depositLIPA: 0,
    depositInBank: 0,
    dateOfDeposit: "",
    efdZReport: 0,
    name: user?.name || "",
    signatureConfirmed: false,
    remarks: ""
  });

  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const activeSteps = ["Shop & Date", "Daily Stock", "Collection", "Review & Submit"];

  const selectedShop = shops.find((shop) => shop.ShopID === shopId);
  const activeShops = shops.filter((shop) => shop.Status === "Active");
  const allowedShops = user?.shopId ? activeShops.filter((shop) => shop.ShopID === user.shopId) : activeShops;

  const totalCashSales = useMemo(
    () => salesEntries.filter((sale) => sale.saleType === "Cash").reduce((sum, sale) => sum + calculateSalesAmount(sale.quantity, sale.rate), 0),
    [salesEntries]
  );
  const totalCreditSales = useMemo(
    () => salesEntries.filter((sale) => sale.saleType === "Credit").reduce((sum, sale) => sum + calculateSalesAmount(sale.quantity, sale.rate), 0),
    [salesEntries]
  );
  const totalSales = totalCashSales + totalCreditSales;
  const stockWarnings = useMemo(() => getDailyReportWarnings([], stockEntries), [stockEntries]);
  
  const actualCollection = calculateActualCollection(collection.depositCash, collection.depositLIPA);
  const collectionVariance = calculateCollectionVariance(totalCashSales, collection.depositCash, collection.depositLIPA);
  const bankDepositDifference = calculateBankDepositDifference(collection.depositCash, collection.depositInBank);
  const salesVsEfd = calculateSalesVsEfd(totalSales, collection.efdZReport);

  const collectionWarnings = useMemo(() => {
    const next: string[] = [];
    if (collectionVariance !== 0) next.push(`Collection variance is ${formatCurrency(collectionVariance)}.`);
    if (bankDepositDifference !== 0) next.push(`Bank deposit difference is ${formatCurrency(bankDepositDifference)}.`);
    if (!collection.efdZReport) next.push("EFD Z Report is missing.");
    else if (salesVsEfd !== 0) next.push(`Sales vs EFD difference is ${formatCurrency(salesVsEfd)}.`);
    if (collection.depositInBank > 0 && !collection.dateOfDeposit) next.push("Date of deposit is required.");
    if (!collection.signatureConfirmed) next.push("Signature confirmation is required.");
    if (collectionVariance !== 0 && !collection.remarks.trim()) next.push("Remarks are required for collection variance.");
    return next;
  }, [bankDepositDifference, collection.dateOfDeposit, collection.depositInBank, collection.efdZReport, collection.remarks, collection.signatureConfirmed, collectionVariance, salesVsEfd]);

  const warnings = useMemo(() => [...stockWarnings, ...collectionWarnings], [stockWarnings, collectionWarnings]);

  // Load shops and products
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee") { navigate("/admin/dashboard"); return; }

    const loadBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const [shopResponse, productResponse] = await Promise.all([appsScriptClient.getShops(), appsScriptClient.getProducts()]);
        if (shopResponse.success && shopResponse.shops) {
          const loadedShops = shopResponse.shops;
          setShops(loadedShops);
          setShopId(user.shopId || loadedShops.find((shop) => shop.Status === "Active")?.ShopID || "");
        } else {
          setError(shopResponse.error || "Failed to load shops.");
        }

        if (productResponse.success && productResponse.products) {
          const activeProducts = productResponse.products.filter((product) => product.Active === "Yes");
          setProducts(activeProducts);
        } else {
          setError(productResponse.error || "Failed to load products.");
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load setup data.");
      } finally {
        setLoading(false);
      }
    };

    loadBaseData();
  }, [navigate, user]);

  // Load drafts/resubmit state
  useEffect(() => {
    const state = location.state as {
      resubmitReport?: {
        reportId?: string;
        shopId?: string;
        date?: string;
        salesEntries?: SalesSubmissionItem[];
        stockEntries?: StockSubmissionItem[];
      };
    } | null;

    if (state?.resubmitReport) {
      setReportId(state.resubmitReport.reportId);
      setShopId(state.resubmitReport.shopId || user?.shopId || "");
      setDate(state.resubmitReport.date || getLocalDateInputValue());
      setSalesEntries(state.resubmitReport.salesEntries || []);
      setStockEntries(state.resubmitReport.stockEntries || []);
      if (state.resubmitReport.stockEntries?.length) {
        setStep(2);
      }
      return;
    }

    try {
      const draft = localStorage.getItem("draft_closing");
      if (!draft) return;
      const parsed = JSON.parse(draft);
      if (parsed.employeeId === user?.employeeId) {
        if (parsed.shopId) setShopId(parsed.shopId);
        if (parsed.date) setDate(parsed.date);
        if (parsed.salesEntries) setSalesEntries(parsed.salesEntries);
        if (parsed.stockEntries) setStockEntries(parsed.stockEntries);
        if (parsed.collection) setCollection(parsed.collection);
        if (parsed.stockEntries?.length) {
          setStep(2);
        }
      }
    } catch {
      localStorage.removeItem("draft_closing");
    }
  }, [location.state, user]);

  const loadClosingData = async () => {
    if (!selectedShop || !user) return;
    setPreparing(true);
    setError("");
    try {
      const [reportResponse, salesResponse, stockResponse, openingResponse, collectionResponse] = await Promise.all([
        appsScriptClient.getTodayReport(user.employeeId, selectedShop.ShopID, date),
        appsScriptClient.getDailySalesReport({ shopId: selectedShop.ShopID, startDate: date, endDate: date }),
        appsScriptClient.getDailyStockReport({ shopId: selectedShop.ShopID, startDate: date, endDate: date }),
        appsScriptClient.getOpeningStock(selectedShop.ShopID, date, user.employeeId),
        appsScriptClient.getTodayCollection({ shopId: selectedShop.ShopID, date, reportId: undefined })
      ]);

      const report = reportResponse.report;
      if (report?.ReportID) setReportId(report.ReportID);

      const savedSales = salesResponse.sales || [];
      const mappedSales = savedSales.map((sale: any) => ({
        productId: sale.ProductID,
        productName: sale.ProductName,
        uom: sale.UOM,
        quantity: Number(sale.Quantity),
        rate: Number(sale.Rate),
        saleType: sale.SaleType,
        customerName: sale.CustomerName || undefined,
        efdNumber: sale.EFDNumber || undefined
      }));
      setSalesEntries(mappedSales);

      const openings = openingResponse.openingStock || [];

      const salesQuantityByProduct = new Map<string, number>();
      savedSales.forEach((sale: any) => {
        salesQuantityByProduct.set(sale.ProductID, (salesQuantityByProduct.get(sale.ProductID) || 0) + Number(sale.Quantity || 0));
      });

      const existingStocks = stockResponse.stocks || [];
      setStockEntries(products.map((product) => {
        const existing = existingStocks.find((stock: any) => stock.ProductID === product.ProductID);
        const opening = Number(openings.find((stock: any) => stock.ProductID === product.ProductID)?.CurrentOpeningStock || existing?.OpeningStock || 0);
        return {
          productId: product.ProductID,
          productName: product.ProductName,
          category: product.Category,
          uom: product.UOM,
          mtnNo: existing?.MTNNo || "",
          openingStock: opening,
          receipt: Number(existing?.Receipt || 0),
          sales: salesQuantityByProduct.get(product.ProductID) || 0,
          actualClosing: existing ? Number(existing.ActualClosing) : undefined
        };
      }));

      const coll = collectionResponse.collection;
      setCollection({
        depositCash: coll ? Number(coll.DepositCash || 0) : 0,
        depositLIPA: coll ? Number(coll.DepositLIPA || 0) : 0,
        depositInBank: coll ? Number(coll.DepositInBank || 0) : 0,
        dateOfDeposit: coll?.DateOfDeposit || "",
        efdZReport: coll ? Number(coll.EFDZReport || 0) : 0,
        name: coll?.Name || user?.name || "",
        signatureConfirmed: coll?.Signature === "Confirmed",
        remarks: coll?.Remarks || "",
        status: coll?.Status
      });

      setStep(2);
    } catch (err) {
      console.error(err);
      setError("Failed to load closing data. Please check connection.");
    } finally {
      setPreparing(false);
    }
  };

  const updateStockEntry = (productId: string, field: "receipt" | "actualClosing" | "mtnNo", value: number | string | undefined) => {
    setStockEntries((current) => current.map((stock) => (stock.productId === productId ? { ...stock, [field]: value } : stock)));
  };

  const handleSaveDraft = () => {
    if (!user) return;
    localStorage.setItem(
      "draft_closing",
      JSON.stringify({
        employeeId: user.employeeId,
        shopId,
        date,
        salesEntries,
        stockEntries,
        collection
      })
    );
    window.alert("Draft saved.");
  };

  const submitClosing = async () => {
    if (!user || !selectedShop) return;
    const blockingError = hasBlockingReportErrors([], stockEntries);
    if (blockingError) {
      setConfirmOpen(false);
      setError(blockingError);
      setStep(2);
      return;
    }
    const collectionError = validateCollectionSettlement({
      cashSales: totalCashSales,
      depositCash: collection.depositCash,
      depositLIPA: collection.depositLIPA,
      depositInBank: collection.depositInBank,
      dateOfDeposit: collection.dateOfDeposit,
      efdZReport: collection.efdZReport,
      signatureConfirmed: collection.signatureConfirmed,
      remarks: collection.remarks
    });
    if (collectionError) {
      setConfirmOpen(false);
      setError(collectionError);
      setStep(3);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const stockResponse = await appsScriptClient.submitDailyStock({
        reportId,
        shopId: selectedShop.ShopID,
        shopName: selectedShop.ShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        date,
        salesEntries: [],
        stockEntries
      });
      if (!stockResponse.success) {
        setError(stockResponse.error || "Stock submission failed.");
        setConfirmOpen(false);
        return;
      }

      const collectionResponse = await appsScriptClient.submitDailyCollection({
        reportId: stockResponse.reportId || reportId,
        shopId: selectedShop.ShopID,
        shopName: selectedShop.ShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        date,
        depositCash: collection.depositCash,
        depositLIPA: collection.depositLIPA,
        depositInBank: collection.depositInBank,
        dateOfDeposit: collection.dateOfDeposit,
        efdZReport: collection.efdZReport,
        name: collection.name || user.name,
        signature: collection.signatureConfirmed ? "Confirmed" : "",
        remarks: collection.remarks
      });

      if (collectionResponse.success) {
        localStorage.removeItem("draft_closing");
        setReportId(stockResponse.reportId);
        setConfirmOpen(false);
        setSuccess(true);
      } else {
        setError(collectionResponse.error || "Collection submission failed.");
        setConfirmOpen(false);
      }
    } catch (err) {
      console.error(err);
      handleSaveDraft();
      setError("Network error. Draft saved.");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const groupedStock = stockEntries.reduce<Record<string, StockSubmissionItem[]>>((groups, stock) => {
    const category = stock.category || "General";
    groups[category] = groups[category] || [];
    groups[category].push(stock);
    return groups;
  }, {});

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-16 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black">End-of-Day Closing Submitted</h2>
          <p className="mt-2 text-sm text-muted-foreground">Stock closing and collection settlement are saved for admin verification.</p>
        </div>
        <button onClick={() => navigate("/employee/dashboard")} className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/employee/dashboard")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label="Back to dashboard">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-black">End-of-Day Closing</h1>
          <p className="text-xs text-muted-foreground">Stock closing and collection settlement closing.</p>
        </div>
      </div>

      <StepProgress steps={activeSteps} currentStep={step} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">Loading shops and products...</div>
      ) : (
        <>
          {step === 1 && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" />
                <h2 className="text-lg font-black">Shop and Date</h2>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">Shop</label>
                <select
                  value={shopId}
                  disabled={Boolean(user?.shopId)}
                  onChange={(event) => setShopId(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
                >
                  {allowedShops.map((shop) => (
                    <option key={shop.ShopID} value={shop.ShopID}>{shop.ShopName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={date}
                    max={getLocalDateInputValue()}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              {selectedShop && (
                <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
                  <p className="font-bold">{selectedShop.InchargeName || "No incharge set"}</p>
                  <p className="text-muted-foreground">{selectedShop.InchargeContact || "No contact set"}</p>
                </div>
              )}
              <button
                type="button"
                onClick={loadClosingData}
                disabled={!shopId || !date || preparing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
              >
                <Boxes className="h-4 w-4" />
                {preparing ? "Loading Data..." : "Continue to Closing"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Boxes className="h-5 w-5" />
                  <h2 className="text-lg font-black">End-of-Day Stock</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sales quantities are loaded automatically from submitted daily sales. Enter receipt and actual closing only.
                </p>
              </div>
              <Totals cash={totalCashSales} credit={totalCreditSales} total={totalSales} />
              {Object.entries(groupedStock).map(([category, rows]) => (
                <div key={category} className="space-y-3">
                  <h3 className="px-1 text-xs font-black uppercase text-muted-foreground">{category}</h3>
                  {rows.map((stock) => {
                    const expected = calculateExpectedClosing(stock.openingStock, stock.receipt, stock.sales);
                    const mismatch = stock.actualClosing === undefined ? undefined : calculateMismatch(stock.actualClosing, expected);
                    return (
                      <div key={stock.productId} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black">{stock.productName}</h4>
                            <p className="text-xs text-muted-foreground">{stock.uom}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${mismatch === undefined ? "bg-secondary text-muted-foreground" : mismatch === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {mismatch === undefined ? "Pending" : mismatch === 0 ? "Matched" : `Mismatch ${mismatch > 0 ? "+" : ""}${mismatch}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/45 p-3 text-center text-xs">
                          <MiniStat label="Opening" value={stock.openingStock} />
                          <MiniStat label="Sales" value={stock.sales} />
                          <MiniStat label="Expected" value={expected} />
                        </div>
                        <TextField label="MTN No" value={stock.mtnNo || ""} onChange={(value) => updateStockEntry(stock.productId, "mtnNo", value)} placeholder="Optional" />
                        <div className="grid grid-cols-2 gap-3">
                          <NumberInput label="Receipt" value={stock.receipt} onChange={(value) => updateStockEntry(stock.productId, "receipt", value)} />
                          <NumberInput label="Actual Closing *" value={stock.actualClosing} onChange={(value) => updateStockEntry(stock.productId, "actualClosing", value)} required />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <StepActions onBack={() => setStep(1)} onSave={handleSaveDraft} nextLabel="Collection" onNext={() => setStep(3)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-black">
                      <WalletCards className="h-5 w-5 text-primary" />
                      End-of-Day Collection
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{selectedShop?.ShopName} - {date}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${!(collectionVariance !== 0 || bankDepositDifference !== 0 || salesVsEfd !== 0) && collection.efdZReport > 0 && collection.signatureConfirmed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {!(collectionVariance !== 0 || bankDepositDifference !== 0 || salesVsEfd !== 0) && collection.efdZReport > 0 && collection.signatureConfirmed ? "Matched" : "Needs Check"}
                  </span>
                </div>
              </div>

              <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Auto Sales Summary
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <MiniPanel label="Cash Sales" value={formatCurrency(totalCashSales)} />
                  <MiniPanel label="Credit Sales" value={formatCurrency(totalCreditSales)} />
                  <MiniPanel label="Total Sales" value={formatCurrency(totalSales)} strong />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <Banknote className="h-4 w-4 text-primary" />
                  Employee Collection Entry
                </h3>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/50 text-muted-foreground">
                      <tr>
                        <th className="p-2 font-bold">Sl.No</th>
                        <th className="p-2 font-bold">Date</th>
                        <th className="p-2 font-bold">Day</th>
                        <th className="p-2 font-bold text-right">Cash Sales (A)</th>
                        <th className="p-2 font-bold text-right">Credit Sales (B)</th>
                        <th className="p-2 font-bold text-right">Total C=(A+B)</th>
                        <th className="p-2 font-bold text-right">Deposit - Cash</th>
                        <th className="p-2 font-bold text-right">Deposit - LIPA</th>
                        <th className="p-2 font-bold text-right">Variance</th>
                        <th className="p-2 font-bold text-right">Deposit in Bank</th>
                        <th className="p-2 font-bold">Date of Deposit</th>
                        <th className="p-2 font-bold text-right">EFD Z Report</th>
                        <th className="p-2 font-bold text-right">Sales vs EFD</th>
                        <th className="p-2 font-bold">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="p-2 font-bold">1</td>
                        <td className="p-2 font-semibold">{date}</td>
                        <td className="p-2 font-semibold">{getDayName(date)}</td>
                        <td className="p-2 text-right font-bold text-green-700">{formatCurrency(totalCashSales)}</td>
                        <td className="p-2 text-right font-bold text-amber-700">{formatCurrency(totalCreditSales)}</td>
                        <td className="p-2 text-right font-black">{formatCurrency(totalSales)}</td>
                        <td className="p-2 text-right font-bold">{formatCurrency(collection.depositCash)}</td>
                        <td className="p-2 text-right font-bold">{formatCurrency(collection.depositLIPA)}</td>
                        <td className={`p-2 text-right font-black ${collectionVariance !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(collectionVariance)}</td>
                        <td className="p-2 text-right font-bold">{formatCurrency(collection.depositInBank)}</td>
                        <td className="p-2 font-semibold">{collection.dateOfDeposit || "-"}</td>
                        <td className="p-2 text-right font-bold">{formatCurrency(collection.efdZReport)}</td>
                        <td className={`p-2 text-right font-black ${salesVsEfd !== 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(salesVsEfd)}</td>
                        <td className="p-2 font-semibold">{collection.name || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <CollectionMoneyField label="Cash Sale Deposits - Cash" value={collection.depositCash} onChange={(value) => setCollection(c => ({ ...c, depositCash: value }))} icon={<Banknote className="h-4 w-4" />} />
                  <CollectionMoneyField label="Cash Sale Deposits - LIPA" value={collection.depositLIPA} onChange={(value) => setCollection(c => ({ ...c, depositLIPA: value }))} icon={<CreditCard className="h-4 w-4" />} />
                  <CollectionMoneyField label="Deposit in Bank" value={collection.depositInBank} onChange={(value) => setCollection(c => ({ ...c, depositInBank: value }))} icon={<Landmark className="h-4 w-4" />} />
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">Date of Deposit</label>
                    <input
                      type="date"
                      value={collection.dateOfDeposit}
                      onChange={(event) => setCollection(c => ({ ...c, dateOfDeposit: event.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <CollectionMoneyField label="EFD Z Report" value={collection.efdZReport} onChange={(value) => setCollection(c => ({ ...c, efdZReport: value }))} icon={<ReceiptText className="h-4 w-4" />} />
                  <TextField label="Name" value={collection.name} onChange={(value) => setCollection(c => ({ ...c, name: value }))} placeholder="Employee name" />
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Verification
                </h3>
                {!(collectionVariance !== 0 || bankDepositDifference !== 0 || salesVsEfd !== 0) && collection.efdZReport > 0 && collection.signatureConfirmed ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">Collection, bank deposit, and EFD values match.</div>
                ) : (
                  <div className="space-y-2">
                    {collectionVariance !== 0 && <WarningCard text={`Variance: ${formatCurrency(collectionVariance)}. Actual collection must match cash sales unless explained.`} />}
                    {bankDepositDifference !== 0 && <WarningCard text={`Bank Deposit Difference: ${formatCurrency(bankDepositDifference)}. Cash deposit and bank deposit do not match.`} />}
                    {salesVsEfd !== 0 && <WarningCard text={`Sales vs EFD: ${formatCurrency(salesVsEfd)}. Total sales and EFD Z Report do not match.`} />}
                    {collectionWarnings.filter((warning) => !warning.startsWith("Collection variance") && !warning.startsWith("Bank deposit") && !warning.startsWith("Sales vs EFD")).map((warning) => (
                      <div key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{warning}</div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <MiniPanel label="Expected Collection" value={formatCurrency(totalCashSales)} />
                  <MiniPanel label="Actual Collection" value={formatCurrency(actualCollection)} />
                  <MiniPanel label="Variance" value={formatCurrency(collectionVariance)} danger={collectionVariance !== 0} />
                  <MiniPanel label="Bank Diff" value={formatCurrency(bankDepositDifference)} danger={bankDepositDifference !== 0} />
                  <MiniPanel label="Sales vs EFD" value={formatCurrency(salesVsEfd)} danger={salesVsEfd !== 0} />
                  <MiniPanel label="Status" value={!(collectionVariance !== 0 || bankDepositDifference !== 0 || salesVsEfd !== 0) && collection.efdZReport > 0 && collection.signatureConfirmed ? "Matched" : "Check"} danger={collectionVariance !== 0 || bankDepositDifference !== 0 || salesVsEfd !== 0} />
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={collection.signatureConfirmed}
                    onChange={(event) => setCollection(c => ({ ...c, signatureConfirmed: event.target.checked }))}
                    className="mt-1 h-4 w-4"
                  />
                  <span>I confirm today's collection details are correct</span>
                </label>
                <div>
                  <label className="mb-1.5 block text-sm font-bold">Remarks {collectionVariance !== 0 ? "*" : ""}</label>
                  <textarea
                    value={collection.remarks}
                    onChange={(event) => setCollection(c => ({ ...c, remarks: event.target.value }))}
                    placeholder={collectionVariance !== 0 ? "Explain the variance before submitting" : "Optional"}
                    className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
              </section>
              <StepActions onBack={() => setStep(2)} onSave={handleSaveDraft} nextLabel="Review & Submit" onNext={() => setStep(4)} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                <h2 className="text-lg font-black">Review & Submit Closing</h2>
                <ReviewWarnings warnings={warnings} />
                <div className="grid grid-cols-3 gap-2">
                  <MiniPanel label="Sales Items" value={salesEntries.length} />
                  <MiniPanel label="Stock Lines" value={stockEntries.length} />
                  <MiniPanel label="Warnings" value={warnings.length} danger={warnings.length > 0} />
                </div>
                <Totals cash={totalCashSales} credit={totalCreditSales} total={totalSales} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <MiniPanel label="Actual Collection" value={formatCurrency(actualCollection)} />
                  <MiniPanel label="Variance" value={formatCurrency(collectionVariance)} danger={collectionVariance !== 0} />
                  <MiniPanel label="Sales vs EFD" value={formatCurrency(salesVsEfd)} danger={salesVsEfd !== 0} />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Send className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Submit End-of-Day Closing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stock closing and collection settlement will be saved for admin verification.
                  </p>
                </div>
                <button type="button" onClick={() => setConfirmOpen(true)} className="w-full rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground">
                  Open Final Confirmation
                </button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)} className="w-full rounded-lg border border-border px-4 py-3 text-sm font-bold hover:bg-secondary">
                  Back to Collection
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmSubmitModal
        isOpen={confirmOpen}
        loading={submitting}
        totalSales={totalSales}
        warningsCount={warnings.length}
        description="This will save end-of-day stock closing and collection settlement for admin verification."
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitClosing}
      />
    </div>
  );
};

const CollectionMoneyField: React.FC<{ label: string; value: number; icon: React.ReactNode; onChange: (value: number) => void }> = ({ label, value, icon, onChange }) => (
  <div>
    <label className="mb-1.5 block text-sm font-bold">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-3.5 text-muted-foreground">{icon}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value || ""}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="w-full rounded-lg border border-input bg-background py-3 pl-10 pr-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  </div>
);

const WarningCard: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{text}</div>
);

const NumberInput: React.FC<{ label: string; value: number | undefined; required?: boolean; onChange: (value: number | undefined) => void }> = ({ label, value, required, onChange }) => (
  <div>
    <label className={`mb-1 block text-xs font-bold ${required ? "text-primary" : "text-muted-foreground"}`}>{label}</label>
    <input type="number" min="0" step="0.01" inputMode="decimal" value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ring" />
  </div>
);

const TextField: React.FC<{ label: string; value: string; placeholder?: string; onChange: (value: string) => void }> = ({ label, value, placeholder, onChange }) => (
  <div>
    <label className="mb-1.5 block text-sm font-bold">{label}</label>
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-ring sm:text-sm" />
  </div>
);

const Totals: React.FC<{ cash: number; credit: number; total: number }> = ({ cash, credit, total }) => (
  <div className="sticky top-16 z-20 grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
    <MiniPanel label="Cash Sales" value={formatCurrency(cash)} />
    <MiniPanel label="Credit Sales" value={formatCurrency(credit)} />
    <MiniPanel label="Total Sales" value={formatCurrency(total)} strong />
  </div>
);

const MiniPanel: React.FC<{ label: string; value: string | number; strong?: boolean; danger?: boolean }> = ({ label, value, strong, danger }) => (
  <div className="rounded-lg border border-border bg-card p-3 text-center">
    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    <p className={`mt-1 text-sm font-black ${danger ? "text-amber-700" : strong ? "text-primary" : ""}`}>{value}</p>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>
    <p className="font-bold text-muted-foreground">{label}</p>
    <p className="mt-1 font-black">{value}</p>
  </div>
);

const StepActions: React.FC<{ nextLabel: string; onBack: () => void; onSave: () => void; onNext: () => void }> = ({ nextLabel, onBack, onSave, onNext }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none w-full">
    <button type="button" onClick={onBack} className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:flex-none">
      Back
    </button>
    <button type="button" onClick={onSave} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:flex-none">
      <Save className="h-4 w-4" />
      Draft
    </button>
    <button type="button" onClick={onNext} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:flex-none">
      {nextLabel}
      <ArrowRight className="h-4 w-4" />
    </button>
  </div>
);

export default EodClosing;
