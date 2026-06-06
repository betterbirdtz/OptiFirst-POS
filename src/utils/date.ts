const TZ = "Africa/Dar_es_Salaam";

export function getLocalDateInputValue(date?: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(date || new Date());
}

export function normalizeSheetDate(value: string | Date | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return getLocalDateInputValue(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T18:30:00(?:\.000)?Z$/.test(text)) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(text));
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return getLocalDateInputValue(parsed);
  return text.split("T")[0];
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
  if (typeof value === "string") {
    const localIso = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
    if (localIso && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
      return `${formatDateForDisplay(localIso[1])}, ${localIso[2]}:${localIso[3]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
      const sheetWallTime = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(value)).replace(" ", "T");
      return formatDateTimeForDisplay(sheetWallTime);
    }
  }
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
  if (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return getLocalDateInputValue().slice(0, 7);
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
  const now = new Date();
  return now.toLocaleString("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(" ", "T");
}
