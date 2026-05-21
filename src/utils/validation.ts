import type { SalesSubmissionItem, StockSubmissionItem } from "../types";
import { calculateExpectedClosing, calculateMismatch } from "./calculations";

export function getDailyReportWarnings(
  salesEntries: SalesSubmissionItem[],
  stockEntries: StockSubmissionItem[]
): string[] {
  const warnings: string[] = [];

  salesEntries.forEach((sale) => {
    if (sale.saleType === "Credit" && !sale.customerName?.trim()) {
      warnings.push(`Credit sale for ${sale.productName} is missing customer name.`);
    }
  });

  stockEntries.forEach((stock) => {
    if (stock.actualClosing === undefined) {
      warnings.push(`Closing stock is missing for ${stock.productName}.`);
      return;
    }

    const expected = calculateExpectedClosing(stock.openingStock, stock.receipt, stock.sales);
    const mismatch = calculateMismatch(stock.actualClosing, expected);
    if (mismatch !== 0) {
      warnings.push(`Stock mismatch for ${stock.productName}: ${mismatch > 0 ? "+" : ""}${mismatch} ${stock.uom}.`);
    }
  });

  return warnings;
}

export function hasBlockingReportErrors(
  salesEntries: SalesSubmissionItem[],
  stockEntries: StockSubmissionItem[]
): string | null {
  const creditWithoutCustomer = salesEntries.find((sale) => sale.saleType === "Credit" && !sale.customerName?.trim());
  if (creditWithoutCustomer) return `Customer name is required for ${creditWithoutCustomer.productName}.`;

  const missingClosing = stockEntries.find((stock) => stock.actualClosing === undefined);
  if (missingClosing) return `Actual closing stock is required for ${missingClosing.productName}.`;

  return null;
}
