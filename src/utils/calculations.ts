export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundAmount(value: number): number {
  return Number(toNumber(value).toFixed(2));
}

export function calculateSalesAmount(quantity: number, rate: number): number {
  return roundAmount(toNumber(quantity) * toNumber(rate));
}

export function calculateExpectedClosing(opening: number, receipt: number, sales: number): number {
  return roundAmount(toNumber(opening) + toNumber(receipt) - toNumber(sales));
}

export function calculateMismatch(actual: number, expected: number): number {
  return roundAmount(toNumber(actual) - toNumber(expected));
}

export function calculateVariance(totalSales: number, depositCash: number, depositLipa: number): number {
  return roundAmount(toNumber(totalSales) - toNumber(depositCash) - toNumber(depositLipa));
}

export function calculateActualCollection(depositCash: number, depositLipa: number): number {
  return roundAmount(toNumber(depositCash) + toNumber(depositLipa));
}

export function calculateCollectionVariance(cashSales: number, depositCash: number, depositLipa: number): number {
  return roundAmount(toNumber(cashSales) - calculateActualCollection(depositCash, depositLipa));
}

export function calculateBankDepositDifference(depositCash: number, depositInBank: number): number {
  return roundAmount(toNumber(depositCash) - toNumber(depositInBank));
}

export function calculateSalesVsEfd(totalSales: number, efdZReport: number): number {
  return roundAmount(toNumber(totalSales) - toNumber(efdZReport));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0
  }).format(toNumber(amount));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    maximumFractionDigits: 2
  }).format(toNumber(value));
}
