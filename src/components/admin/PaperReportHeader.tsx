import React from "react";

interface PaperReportHeaderProps {
  title: string;
  dateLabel: string;
  employeeName?: string;
}

export const PaperReportHeader: React.FC<PaperReportHeaderProps> = ({
  title,
  dateLabel,
  employeeName
}) => {
  return (
    <div className="border border-border rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">OptiFirst POS</p>
          <h2 className="mt-1 text-lg font-black text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Paper-style report preview for printing and export.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:text-right">
          <div>
            <p className="font-semibold text-muted-foreground">Date</p>
            <p className="font-bold text-foreground">{dateLabel}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground">Employee</p>
            <p className="font-bold text-foreground">{employeeName || "All Employees"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperReportHeader;
