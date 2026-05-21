/**
 * Daily Sales and Stock System Calculation Utilities
 */

/**
 * Calculates total sales amount: Quantity * Rate
 */
export function calculateSalesAmount(quantity: number, rate: number): number {
  if (isNaN(quantity) || isNaN(rate)) return 0;
  return Number((quantity * rate).toFixed(2));
}

/**
 * Calculates Expected Closing Stock: OpeningStock + Receipt - Sales
 */
export function calculateExpectedClosing(opening: number, receipt: number, sales: number): number {
  const o = isNaN(opening) ? 0 : Number(opening);
  const r = isNaN(receipt) ? 0 : Number(receipt);
  const s = isNaN(sales) ? 0 : Number(sales);
  return Number((o + r - s).toFixed(2));
}

/**
 * Calculates Stock Mismatch: ActualClosing - ExpectedClosing
 * Note: If mismatch is 0, everything is aligned.
 * Positive = surplus stock, Negative = deficit (mismatch)
 */
export function calculateMismatch(actual: number, expected: number): number {
  const a = isNaN(actual) ? 0 : Number(actual);
  const e = isNaN(expected) ? 0 : Number(expected);
  return Number((a - e).toFixed(2));
}

/**
 * Formats a number as INR currency.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}
