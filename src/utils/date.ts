const TZ = "Africa/Dar_es_Salaam";

function getNowTZ(): Date {
  // Get current time in Tanzania timezone
  const now = new Date();
  const tzString = now.toLocaleString("en-US", { timeZone: TZ });
  return new Date(tzString);
}

export function getLocalDateInputValue(date?: Date): string {
  const d = date || getNowTZ();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
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
  return new Date(`${normalized}T12:00:00`).toLocaleDateString("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ
  });
}

export function formatDateTimeForDisplay(value: string | Date | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ
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

export function getMonthInputValue(date?: Date): string {
  const d = date || getNowTZ();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getMonthDateRange(month: string): { startDate: string; endDate: string } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    startDate: getLocalDateInputValue(start),
    endDate: getLocalDateInputValue(end)
  };
}

export function getDayName(value: string): string {
  const normalized = normalizeSheetDate(value);
  if (!normalized) return "";
  return new Date(`${normalized}T12:00:00`).toLocaleDateString("en-TZ", { weekday: "long", timeZone: TZ });
}

export function getNowIsoTZ(): string {
  // Returns ISO string in Tanzania time for storing timestamps
  const now = getNowTZ();
  return now.toISOString();
}
