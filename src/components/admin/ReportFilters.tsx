import React from "react";
import { Search, User } from "lucide-react";
import type { Employee } from "../../types";
import DateRangeFilter from "../common/DateRangeFilter";

interface ReportFiltersProps {
  startDate: string;
  endDate: string;
  employeeId: string;
  employees: Employee[];
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  startDate,
  endDate,
  employeeId,
  employees,
  onStartDateChange,
  onEndDateChange,
  onEmployeeChange
}) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center space-x-1 text-xs font-bold text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>Filter Criteria</span>
      </h3>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>Employee</span>
          </label>
          <select
            value={employeeId}
            onChange={(event) => onEmployeeChange(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Employees</option>
            {employees.map((employee) => (
              <option key={employee.EmployeeID} value={employee.EmployeeID}>
                {employee.Name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
