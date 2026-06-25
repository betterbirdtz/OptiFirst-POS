import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Save,
  Send
} from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import ConfirmSubmitModal from "../../components/employee/ConfirmSubmitModal";
import ReviewWarnings from "../../components/employee/ReviewWarnings";
import StepProgress from "../../components/employee/StepProgress";
import type { Product, SalesSubmissionItem, Shop, StockSubmissionItem, UserSession } from "../../types";
import {
  calculateExpectedClosing,
  calculateMismatch,
  calculateSalesAmount,
  formatCurrency
} from "../../utils/calculations";
import { getLocalDateInputValue } from "../../utils/date";
import { getSessionUser } from "../../utils/session";
import { getDailyReportWarnings, hasBlockingReportErrors } from "../../utils/validation";


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

  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dateManuallySelected, setDateManuallySelected] = useState(false);
  const [isReportEdit, setIsReportEdit] = useState(false);

  const activeSteps = ["Shop & Date", "Daily Stock", "Review & Submit"];

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
  const warnings = stockWarnings;

  // Load shops and products
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "Employee" && user.role !== "Admin") { navigate("/admin/dashboard"); return; }

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
      setIsReportEdit(true);
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
        setDate(getLocalDateInputValue());
        setDateManuallySelected(false);
        if (parsed.salesEntries) setSalesEntries(parsed.salesEntries);
        if (parsed.stockEntries) setStockEntries(parsed.stockEntries);
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
    const loadDate = getSubmitDate();
    setDate(loadDate);
    setPreparing(true);
    setError("");
    try {
      const [reportResponse, salesResponse, stockResponse, openingResponse] = await Promise.all([
        appsScriptClient.getTodayReport(user.employeeId, selectedShop.ShopID, loadDate),
        appsScriptClient.getDailySalesReport({ shopId: selectedShop.ShopID, startDate: loadDate, endDate: loadDate }),
        appsScriptClient.getDailyStockReport({ shopId: selectedShop.ShopID, startDate: loadDate, endDate: loadDate }),
        appsScriptClient.getOpeningStock(selectedShop.ShopID, loadDate, user.employeeId)
      ]);

      const report = reportResponse.report;
      if (report?.ReportID) setReportId(report.ReportID);
      if (!isReportEdit && report?.StockSubmitted === "Yes" && isLockedStatus(report.Status)) {
        setError("Stock closing already submitted for this date. Ask admin to reopen if correction needed.");
        return;
      }

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
        stockEntries
      })
    );
    window.alert("Draft saved.");
  };

  const getSubmitDate = () => {
    const today = getLocalDateInputValue();
    return (isReportEdit || dateManuallySelected) && date < today ? date : today;
  };

  const isLockedStatus = (status?: string) => status === "Submitted" || status === "Approved";

  const submitClosing = async () => {
    if (!user || !selectedShop) return;
    const blockingError = hasBlockingReportErrors([], stockEntries);
    if (blockingError) {
      setConfirmOpen(false);
      setError(blockingError);
      setStep(2);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const today = getLocalDateInputValue();
      const submitDate = getSubmitDate();
      if (!isReportEdit) {
        const existing = await appsScriptClient.getTodayReport(user.employeeId, selectedShop.ShopID, submitDate);
        if (existing.report?.StockSubmitted === "Yes" && isLockedStatus(existing.report.Status)) {
          setError("Stock closing already submitted for this date. Ask admin to reopen if correction needed.");
          setConfirmOpen(false);
          return;
        }
      }
      const dateIntent = submitDate < today ? "manual-backdate" : "today";
      const stockResponse = await appsScriptClient.submitDailyStock({
        reportId,
        shopId: selectedShop.ShopID,
        shopName: selectedShop.ShopName,
        employeeId: user.employeeId,
        employeeName: user.name,
        date: submitDate,
        dateIntent,
        salesEntries: [],
        stockEntries
      });
      if (stockResponse.success) {
        localStorage.removeItem("draft_closing");
        setReportId(stockResponse.reportId);
        setConfirmOpen(false);
        setSuccess(true);
      } else {
        setError(stockResponse.error || "Stock submission failed.");
        setConfirmOpen(false);
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Check connection and try again.");
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
      <div className="mx-auto max-w-sm space-y-6 px-4 py-16 text-center">
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
    <div className="mx-auto max-w-lg space-y-5 px-3 py-4 pb-28 sm:max-w-2xl sm:px-6 sm:py-6">
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
                  <input type="date" value={date} max={getLocalDateInputValue()} onChange={(event) => { setDate(event.target.value); setDateManuallySelected(true); }} className="w-full rounded-lg border border-input bg-background py-3 px-3 text-base font-bold outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">You can select a past date if you missed submitting.</p>
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
                  Sales quantities are loaded from daily sales. Fill Receipt and Actual Closing columns.
                </p>
              </div>
              <Totals cash={totalCashSales} credit={totalCreditSales} total={totalSales} />

              {Object.entries(groupedStock).map(([category, rows]) => (
                <div key={category} className="space-y-2">
                  <h3 className="px-1 text-xs font-black uppercase text-muted-foreground">{category}</h3>

                  {/* Mobile card view */}
                  <div className="sm:hidden space-y-3">
                    {rows.map((stock) => {
                      const expected = calculateExpectedClosing(stock.openingStock, stock.receipt, stock.sales);
                      const mismatch = stock.actualClosing === undefined ? undefined : calculateMismatch(stock.actualClosing, expected);
                      return (
                        <div key={stock.productId} className="rounded-xl border border-border bg-card p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-black">{stock.productName}</p>
                              <p className="text-[10px] text-muted-foreground">{stock.uom}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${mismatch === undefined ? "bg-secondary text-muted-foreground" : mismatch === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {mismatch === undefined ? "Pending" : mismatch === 0 ? "✓ Match" : `${mismatch > 0 ? "+" : ""}${mismatch}`}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/30 p-2 text-center text-[10px]">
                            <div><p className="font-bold text-muted-foreground">Opening</p><p className="font-black">{stock.openingStock}</p></div>
                            <div><p className="font-bold text-muted-foreground">Sales</p><p className="font-black text-primary">{stock.sales}</p></div>
                            <div><p className="font-bold text-muted-foreground">Expected</p><p className="font-black">{expected}</p></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-muted-foreground">RECEIPT</label>
                              <input
                                type="number" min="0" step="0.01" inputMode="decimal"
                                value={stock.receipt || ""}
                                onChange={(e) => updateStockEntry(stock.productId, "receipt", e.target.value === "" ? 0 : Number(e.target.value))}
                                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base font-bold text-center outline-none focus:ring-2 focus:ring-ring"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-primary">ACTUAL CLOSING</label>
                              <input
                                type="number" min="0" step="0.01" inputMode="decimal"
                                value={stock.actualClosing ?? ""}
                                onChange={(e) => updateStockEntry(stock.productId, "actualClosing", e.target.value === "" ? undefined : Number(e.target.value))}
                                className="w-full rounded-lg border border-primary/40 bg-background px-3 py-3 text-base font-black text-center outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Required"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/50 text-muted-foreground">
                        <tr>
                          <th className="p-2 font-bold">Product</th>
                          <th className="p-2 font-bold text-right">Opening</th>
                          <th className="p-2 font-bold text-right">Sales</th>
                          <th className="p-2 font-bold text-right w-20">Receipt</th>
                          <th className="p-2 font-bold text-right">Expected</th>
                          <th className="p-2 font-bold text-right w-24">Actual Closing</th>
                          <th className="p-2 font-bold text-right">Mismatch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {rows.map((stock) => {
                          const expected = calculateExpectedClosing(stock.openingStock, stock.receipt, stock.sales);
                          const mismatch = stock.actualClosing === undefined ? undefined : calculateMismatch(stock.actualClosing, expected);
                          return (
                            <tr key={stock.productId}>
                              <td className="p-2">
                                <p className="font-bold">{stock.productName}</p>
                                <p className="text-[10px] text-muted-foreground">{stock.uom}</p>
                              </td>
                              <td className="p-2 text-right font-semibold">{stock.openingStock}</td>
                              <td className="p-2 text-right font-semibold text-primary">{stock.sales}</td>
                              <td className="p-1.5">
                                <input type="number" min="0" step="0.01" inputMode="decimal" value={stock.receipt || ""} onChange={(e) => updateStockEntry(stock.productId, "receipt", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full rounded border border-input bg-background px-2 py-2 text-xs font-bold text-right outline-none focus:ring-1 focus:ring-ring" placeholder="0" />
                              </td>
                              <td className="p-2 text-right font-semibold">{expected}</td>
                              <td className="p-1.5">
                                <input type="number" min="0" step="0.01" inputMode="decimal" value={stock.actualClosing ?? ""} onChange={(e) => updateStockEntry(stock.productId, "actualClosing", e.target.value === "" ? undefined : Number(e.target.value))} className="w-full rounded border border-primary/40 bg-background px-2 py-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-ring" placeholder="Required" />
                              </td>
                              <td className={`p-2 text-right font-black ${mismatch === undefined ? "text-muted-foreground" : mismatch === 0 ? "text-green-700" : "text-red-700"}`}>
                                {mismatch === undefined ? "-" : mismatch === 0 ? "✓" : `${mismatch > 0 ? "+" : ""}${mismatch}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <StepActions onBack={() => setStep(1)} onSave={handleSaveDraft} nextLabel="Review & Submit" onNext={() => setStep(3)} />
            </div>
          )}

          {step === 3 && (
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
              </div>

              <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Send className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-lg font-black">Submit End-of-Day Closing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stock closing will be saved for admin verification.
                  </p>
                </div>
                <button type="button" onClick={() => setConfirmOpen(true)} className="w-full rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground">
                  Open Final Confirmation
                </button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="w-full rounded-lg border border-border px-4 py-3 text-sm font-bold hover:bg-secondary">
                  Back to Stock
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
        description="This will save end-of-day stock closing for admin verification."
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitClosing}
      />
    </div>
  );
};


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


const StepActions: React.FC<{ nextLabel: string; onBack: () => void; onSave: () => void; onNext: () => void }> = ({ nextLabel, onBack, onSave, onNext }) => (
  <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card p-3 flex gap-2 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:rounded-xl">
    <button type="button" onClick={onBack} className="flex-1 rounded-lg border border-border py-4 text-sm font-bold active:bg-secondary">
      Back
    </button>
    <button type="button" onClick={onSave} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-4 text-sm font-bold active:bg-secondary">
      <Save className="h-4 w-4" /> Save
    </button>
    <button type="button" onClick={onNext} className="flex flex-[1.5] items-center justify-center gap-2 rounded-lg bg-primary py-4 text-sm font-black text-primary-foreground active:bg-primary/90">
      {nextLabel} <ArrowRight className="h-4 w-4" />
    </button>
  </div>
);

export default EodClosing;
