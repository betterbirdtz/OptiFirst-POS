import React from "react";
import { CalendarDays } from "lucide-react";
import { getLocalDateInputValue, getMonthDateRange } from "../../utils/date";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  compact?: boolean;
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDateInputValue(date);
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  compact = false
}) => {
  const setRange = (start: string, end: string) => {
    onStartDateChange(start);
    onEndDateChange(end);
  };

  const today = getLocalDateInputValue();
  const yesterday = shiftDate(-1);
  const currentMonth = getMonthDateRange(today.slice(0, 7));
  const last7Start = shiftDate(-6);

  const presets = [
    { label: "Today", start: today, end: today },
    { label: "Yesterday", start: yesterday, end: yesterday },
    { label: "Last 7 days", start: last7Start, end: today },
    { label: "This month", start: currentMonth.startDate, end: currentMonth.endDate }
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = startDate === preset.start && endDate === preset.end;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setRange(preset.start, preset.end)}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        <label className="space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            From
          </span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="space-y-1">
          <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            To
          </span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
    </div>
  );
};

export default DateRangeFilter;
