import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Plus,
  Save,
  Send,
  ShoppingBag,
  Trash2
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import ConfirmSubmitModal from "../../components/employee/ConfirmSubmitModal";
import ProductSearchSelect from "../../components/employee/ProductSearchSelect";
import ReviewWarnings from "../../components/employee/ReviewWarnings";
import StepProgress from "../../components/employee/StepProgress";
import type {
  OpeningStockEntry,
  Product,
  SalesSubmissionItem,
  StockSubmissionItem,
  UserSession
} from "../../types";
import {
  calculateExpectedClosing,
  calculateMismatch,
  calculateSalesAmount,
  formatCurrency
} from "../../utils/calculations";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";
import { getDailyReportWarnings, hasBlockingReportErrors } from "../../utils/validation";

interface ResubmitReportState {
  resubmitReport?: {
    reportId?: string;
    date?: string;
    salesEntries?: SalesSubmissionItem[];
    stockEntries?: StockSubmissionItem[];
  };
}

const steps = ["Daily Sales", "Daily Stock", "Review", "Submit"];

export const TodayReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useState<UserSession | null>(() => getSessionUser());

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(getLocalDateInputValue());
  const [reportId, setReportId] = useState<string | undefined>();
  const [products, setProducts] = useState<Product[]>([]);
  const [openingStocks, setOpeningStocks] = useState<OpeningStockEntry[]>([]);
  const [salesEntries, setSalesEntries] = useState<SalesSubmissionItem[]>([]);
  const [stockEntries, setStockEntries] = useState<StockSubmissionItem[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [saleQuantity, setSaleQuantity] = useState<number | "">("");
  const [saleRate, setSaleRate] = useState<number | "">("");
  const [saleType, setSaleType] = useState<"Cash" | "Credit">("Cash");
  const [customerName, setCustomerName] = useState("");
  const [efdNumber, setEfdNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "Employee") {
      navigate("/admin/dashboard");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [productResponse, stockResponse] = await Promise.all([
          appsScriptClient.getProducts(),
          appsScriptClient.getTodayOpeningStock()
        ]);

        if (productResponse.success && productResponse.products) {
          const activeProducts = productResponse.products.filter((product) => product.Active === "Yes");
          setProducts(activeProducts);
          if (activeProducts[0]) {
            setSelectedProductId(activeProducts[0].ProductID);
            setSaleRate(Number(activeProducts[0].DefaultRate || 0));
          }
        } else {
          setError(productResponse.error || "Failed to load product catalog.");
        }

        if (stockResponse.success && stockResponse.openingStock) {
          setOpeningStocks(stockResponse.openingStock);
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load daily report data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;

    const state = location.state as ResubmitReportState | null;
    if (state?.resubmitReport) {
      setReportId(state.resubmitReport.reportId);
      setDate(state.resubmitReport.date || getLocalDateInputValue());
      setSalesEntries(state.resubmitReport.salesEntries || []);
      setStockEntries(state.resubmitReport.stockEntries || []);
      return;
    }

    try {
      const draft = localStorage.getItem("draft_report");
      if (!draft) return;
      const parsed = JSON.parse(draft) as {
        employeeId?: string;
        reportId?: string;
        date?: string;
        salesEntries?: SalesSubmissionItem[];
        stockEntries?: StockSubmissionItem[];
      };
      if (parsed.employeeId === user.employeeId) {
        setReportId(parsed.reportId);
        setDate(parsed.date || getLocalDateInputValue());
        setSalesEntries(parsed.salesEntries || []);
        setStockEntries(parsed.stockEntries || []);
      }
    } catch {
      localStorage.removeItem("draft_report");
    }
  }, [location.state, user]);

  const selectedProduct = products.find((product) => product.ProductID === selectedProductId);

  const totalCashSales = useMemo(
    () =>
      salesEntries
        .filter((sale) => sale.saleType === "Cash")
        .reduce((sum, sale) => sum + calculateSalesAmount(sale.quantity, sale.rate), 0),
    [salesEntries]
  );

  const totalCreditSales = useMemo(
    () =>
      salesEntries
        .filter((sale) => sale.saleType === "Credit")
        .reduce((sum, sale) => sum + calculateSalesAmount(sale.quantity, sale.rate), 0),
    [salesEntries]
  );

  const totalSales = totalCashSales + totalCreditSales;
  const warnings = useMemo(() => getDailyReportWarnings(salesEntries, stockEntries), [salesEntries, stockEntries]);
  const currentLineAmount = saleQuantity && saleRate !== "" ? calculateSalesAmount(Number(saleQuantity), Number(saleRate)) : 0;

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((item) => item.ProductID === productId);
    if (product) setSaleRate(Number(product.DefaultRate || 0));
  };

  const handleAddSaleItem = () => {
    setError("");
    if (!selectedProduct) {
      setError("Select a valid product.");
      return;
    }
    if (!saleQuantity || Number(saleQuantity) <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    if (saleRate === "" || Number(saleRate) < 0) {
      setError("Enter a valid rate.");
      return;
    }
    if (saleType === "Credit" && !customerName.trim()) {
      setError("Customer name is required for Credit sales.");
      return;
    }

    setSalesEntries((current) => [
      ...current,
      {
        productId: selectedProduct.ProductID,
        productName: selectedProduct.ProductName,
        uom: selectedProduct.UOM,
        quantity: Number(saleQuantity),
        rate: Number(saleRate),
        saleType,
        customerName: saleType === "Credit" ? customerName.trim() : undefined,
        efdNumber: efdNumber.trim() || undefined
      }
    ]);

    setSaleQuantity("");
    setCustomerName("");
    setEfdNumber("");
  };

  const handleRemoveSaleItem = (index: number) => {
    setSalesEntries((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const syncStockEntries = () => {
    const nextStockEntries = products.map((product) => {
      const existing = stockEntries.find((stock) => stock.productId === product.ProductID);
      const opening = Number(openingStocks.find((stock) => stock.ProductID === product.ProductID)?.CurrentOpeningStock || 0);
      const salesQuantity = salesEntries
        .filter((sale) => sale.productId === product.ProductID)
        .reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

      return {
        productId: product.ProductID,
        productName: product.ProductName,
        category: product.Category,
        uom: product.UOM,
        openingStock: existing?.openingStock ?? opening,
        receipt: existing?.receipt ?? 0,
        sales: salesQuantity,
        actualClosing: existing?.actualClosing
      };
    });

    setStockEntries(nextStockEntries);
  };

  const goToStockStep = () => {
    syncStockEntries();
    setStep(2);
  };

  const updateStockEntry = (productId: string, field: "receipt" | "actualClosing", value: number | undefined) => {
    setStockEntries((current) =>
      current.map((stock) => (stock.productId === productId ? { ...stock, [field]: value } : stock))
    );
  };

  const handleSaveDraft = () => {
    if (!user) return;
    localStorage.setItem(
      "draft_report",
      JSON.stringify({
        employeeId: user.employeeId,
        reportId,
        date,
        salesEntries,
        stockEntries
      })
    );
    window.alert("Draft saved on this device.");
  };

  const submitReport = async () => {
    if (!user) return;
    const blockingError = hasBlockingReportErrors(salesEntries, stockEntries);
    if (blockingError) {
      setConfirmOpen(false);
      setError(blockingError);
      setStep(3);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await appsScriptClient.submitDailyReport({
        reportId,
        employeeId: user.employeeId,
        employeeName: user.name,
        date,
        salesEntries,
        stockEntries
      });

      if (response.success) {
        localStorage.removeItem("draft_report");
        setConfirmOpen(false);
        setSuccess(true);
      } else {
        setError(response.error || "Submission failed.");
        setConfirmOpen(false);
      }
    } catch (submitError) {
      console.error(submitError);
      handleSaveDraft();
      setError("Network error. Draft was saved on this device.");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Report Submitted</h2>
          <p className="text-sm text-muted-foreground">Your daily sales and stock report has been sent to admin.</p>
        </div>
        <button
          onClick={() => navigate("/employee/dashboard")}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/employee/dashboard")}
            className="rounded-xl border border-border p-3 text-muted-foreground hover:bg-secondary sm:p-2"
            aria-label="Back to employee dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black">Daily Report</h1>
            <p className="text-xs text-muted-foreground">Sales and stock in one simple flow</p>
          </div>
        </div>

        <label className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-bold shadow-sm sm:w-auto sm:py-2 sm:text-xs">
          <Calendar className="h-4 w-4 text-primary" />
          <input
            type="date"
            value={date}
            max={getLocalDateInputValue()}
            onChange={(event) => setDate(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-right focus:outline-none sm:text-left"
            aria-label="Report date"
          />
        </label>
      </div>

      <StepProgress steps={steps} currentStep={step} />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm font-semibold text-muted-foreground">
          Loading products and opening stock...
        </div>
      )}

      {!loading && step === 1 && (
        <div className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2 text-primary">
              <ShoppingBag className="h-5 w-5" />
              <h2 className="text-lg font-black">Daily Sales</h2>
            </div>

            <ProductSearchSelect
              products={products}
              selectedProductId={selectedProductId}
              searchTerm={productSearch}
              onSearchTermChange={setProductSearch}
              onProductChange={handleProductChange}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-foreground/80 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={saleQuantity}
                  onChange={(event) => setSaleQuantity(event.target.value === "" ? "" : Number(event.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground/80 mb-1.5">Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={saleRate}
                  onChange={(event) => setSaleRate(event.target.value === "" ? "" : Number(event.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-foreground/80 mb-2">Sale Type</label>
              <div className="grid grid-cols-2 rounded-2xl border border-border bg-secondary p-1">
                {(["Cash", "Credit"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSaleType(type)}
                    className={`rounded-xl py-3 text-sm font-black transition-colors ${
                      saleType === type
                        ? type === "Cash"
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {saleType === "Credit" && (
              <div>
                <label className="block text-sm font-bold text-amber-700 dark:text-amber-300 mb-1.5">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="w-full rounded-xl border border-amber-300 bg-background px-3 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-sm"
                  placeholder="Enter customer name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-foreground/80 mb-1.5">EFD Number</label>
              <input
                type="text"
                value={efdNumber}
                onChange={(event) => setEfdNumber(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                placeholder="Optional receipt number"
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/45 p-3 text-sm font-bold">
              <div className="flex justify-between">
                <span className="text-muted-foreground">This item amount</span>
                <span>{formatCurrency(currentLineAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddSaleItem}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md shadow-primary/20"
            >
              <Plus className="h-5 w-5" />
              Add Item
            </button>
          </div>

          <div className="sticky top-[73px] z-20 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-sm backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="rounded-xl border border-border bg-card p-2.5 text-center shadow-sm sm:p-3">
              <p className="text-[10px] font-bold text-muted-foreground">Cash Sales</p>
              <p className="mt-1 text-sm font-black text-green-600">{formatCurrency(totalCashSales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5 text-center shadow-sm sm:p-3">
              <p className="text-[10px] font-bold text-muted-foreground">Credit Sales</p>
              <p className="mt-1 text-sm font-black text-amber-600">{formatCurrency(totalCreditSales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2.5 text-center shadow-sm sm:p-3">
              <p className="text-[10px] font-bold text-muted-foreground">Total Sales</p>
              <p className="mt-1 text-sm font-black text-primary">{formatCurrency(totalSales)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {salesEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No sales items added yet.
              </div>
            ) : (
              salesEntries.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} {item.uom} x {formatCurrency(item.rate)}
                      </p>
                      <p className={`mt-1 text-xs font-black ${item.saleType === "Cash" ? "text-green-600" : "text-amber-600"}`}>
                        {item.saleType}{item.customerName ? ` - ${item.customerName}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black">{formatCurrency(calculateSalesAmount(item.quantity, item.rate))}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveSaleItem(index)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${item.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sticky bottom-24 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:flex-none"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={goToStockStep}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:flex-none"
            >
              Daily Stock
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Boxes className="h-5 w-5" />
              <h2 className="text-lg font-black">Daily Stock</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sales are filled from the sales step. Enter receipts and physical closing count.
            </p>
          </div>

          <div className="space-y-4">
            {stockEntries.map((stock) => {
              const expected = calculateExpectedClosing(stock.openingStock, stock.receipt, stock.sales);
              const mismatch = stock.actualClosing === undefined ? undefined : calculateMismatch(stock.actualClosing, expected);

              return (
                <div key={stock.productId} className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black">{stock.productName}</h3>
                      <p className="text-xs text-muted-foreground">{stock.category} - {stock.uom}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black ${
                        mismatch === undefined
                          ? "bg-secondary text-muted-foreground"
                          : mismatch === 0
                            ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                      }`}
                    >
                      {mismatch === undefined ? "Pending" : mismatch === 0 ? "Matched" : `Mismatch ${mismatch > 0 ? "+" : ""}${mismatch}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/40 p-3 text-center text-xs">
                    <div>
                      <p className="font-bold text-muted-foreground">Opening</p>
                      <p className="mt-1 font-black">{stock.openingStock}</p>
                    </div>
                    <div>
                      <p className="font-bold text-muted-foreground">Sales</p>
                      <p className="mt-1 font-black text-primary">{stock.sales}</p>
                    </div>
                    <div>
                      <p className="font-bold text-muted-foreground">Expected</p>
                      <p className="mt-1 font-black">{expected}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Receipt</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={stock.receipt}
                        onChange={(event) => updateStockEntry(stock.productId, "receipt", event.target.value === "" ? 0 : Number(event.target.value))}
                        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-primary mb-1">Actual Closing *</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={stock.actualClosing ?? ""}
                        onChange={(event) =>
                          updateStockEntry(
                            stock.productId,
                            "actualClosing",
                            event.target.value === "" ? undefined : Number(event.target.value)
                          )
                        }
                        className="w-full rounded-xl border border-primary/40 bg-background px-3 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Required"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-24 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:flex-none"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:flex-none"
            >
              Review
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && step === 3 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-black">Review</h2>
            <ReviewWarnings warnings={warnings} />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] font-bold text-muted-foreground">Items</p>
                <p className="mt-1 text-lg font-black">{salesEntries.length}</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] font-bold text-muted-foreground">Stock Lines</p>
                <p className="mt-1 text-lg font-black">{stockEntries.length}</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] font-bold text-muted-foreground">Warnings</p>
                <p className={`mt-1 text-lg font-black ${warnings.length ? "text-amber-600" : "text-green-600"}`}>
                  {warnings.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Sales</span>
                <span className="font-black">{formatCurrency(totalCashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Sales</span>
                <span className="font-black">{formatCurrency(totalCreditSales)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-primary">
                <span className="font-black">Total Sales</span>
                <span className="font-black">{formatCurrency(totalSales)}</span>
              </div>
            </div>
          </div>

          <div className="sticky bottom-24 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-lg sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:flex-none"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:flex-none"
            >
              Submit
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && step === 4 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-black">Submit Daily Report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Final check complete. Confirm submission to send this report to admin.
              </p>
            </div>
            <ReviewWarnings warnings={warnings} />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md shadow-primary/20"
            >
              Open Final Confirmation
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep(3)}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary sm:w-auto"
          >
            Back to Review
          </button>
        </div>
      )}

      <ConfirmSubmitModal
        isOpen={confirmOpen}
        loading={submitting}
        totalSales={totalSales}
        warningsCount={warnings.length}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitReport}
      />
    </div>
  );
};

export default TodayReport;
