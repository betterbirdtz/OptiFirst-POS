import { z } from "zod";
import type { SalesSubmissionItem, StockSubmissionItem } from "../types";
import { calculateActualCollection, calculateCollectionVariance, calculateExpectedClosing, calculateMismatch, toNumber } from "./calculations";

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

export const collectionSettlementSchema = z.object({
  cashSales: z.coerce.number().min(0),
  depositCash: z.coerce.number().min(0, "Cash collected cannot be negative."),
  depositLIPA: z.coerce.number().min(0, "LIPA/online payment cannot be negative."),
  depositInBank: z.coerce.number().min(0, "Deposit in bank cannot be negative."),
  dateOfDeposit: z.string().optional(),
  efdZReport: z.coerce.number().min(0, "EFD Z Report cannot be negative.").optional(),
  signatureConfirmed: z.boolean(),
  remarks: z.string().optional()
}).superRefine((value, ctx) => {
  const actualCollection = calculateActualCollection(value.depositCash, value.depositLIPA);
  const variance = calculateCollectionVariance(value.cashSales, value.depositCash, value.depositLIPA);

  if (value.depositInBank > 0 && !value.dateOfDeposit) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfDeposit"],
      message: "Date of deposit is required when deposit in bank is entered."
    });
  }

  if (!value.signatureConfirmed) {
    ctx.addIssue({
      code: "custom",
      path: ["signatureConfirmed"],
      message: "Signature confirmation is required before submitting collection."
    });
  }

  if (variance !== 0 && !value.remarks?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["remarks"],
      message: "Remarks are required when collection variance is not zero."
    });
  }

  if (actualCollection < 0 || !Number.isFinite(actualCollection)) {
    ctx.addIssue({
      code: "custom",
      path: ["depositCash"],
      message: "Actual collection is invalid."
    });
  }
});

export function validateCollectionSettlement(input: {
  cashSales: number;
  depositCash: number;
  depositLIPA: number;
  depositInBank: number;
  dateOfDeposit?: string;
  efdZReport?: number;
  signatureConfirmed: boolean;
  remarks?: string;
}): string | null {
  const result = collectionSettlementSchema.safeParse({
    ...input,
    cashSales: toNumber(input.cashSales),
    depositCash: toNumber(input.depositCash),
    depositLIPA: toNumber(input.depositLIPA),
    depositInBank: toNumber(input.depositInBank),
    efdZReport: input.efdZReport === undefined ? undefined : toNumber(input.efdZReport)
  });

  if (result.success) return null;
  return result.error.issues[0]?.message || "Collection settlement is invalid.";
}
