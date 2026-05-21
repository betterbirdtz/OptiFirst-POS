export function getLocalDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeSheetDate(value: string | Date | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return getLocalDateInputValue(value);
  return String(value).split("T")[0];
}

export function formatDateForDisplay(value: string | Date | undefined): string {
  const normalized = normalizeSheetDate(value);
  if (!normalized) return "-";
  return new Date(`${normalized}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatDateTimeForDisplay(value: string | Date | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getDateRangeLabel(startDate?: string, endDate?: string): string {
  if (startDate && endDate && startDate !== endDate) {
    return `${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}`;
  }
  if (startDate) return formatDateForDisplay(startDate);
  if (endDate) return formatDateForDisplay(endDate);
  return "All dates";
}
