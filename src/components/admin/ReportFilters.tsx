import React from "react";
import { Calendar, Search, User } from "lucide-react";
import type { Employee } from "../../types";

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Start Date</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring sm:py-2 sm:text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>End Date</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring sm:py-2 sm:text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span>Employee</span>
          </label>
          <select
            value={employeeId}
            onChange={(event) => onEmployeeChange(event.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring sm:py-2 sm:text-xs"
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
