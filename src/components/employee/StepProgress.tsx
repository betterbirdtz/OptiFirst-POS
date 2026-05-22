import React from "react";
import { Check } from "lucide-react";

interface StepProgressProps {
  steps: string[];
  currentStep: number;
}

export const StepProgress: React.FC<StepProgressProps> = ({ steps, currentStep }) => {
  const activeLabel = steps[currentStep - 1] || steps[0];
  const progress = Math.max(0, Math.min(100, (currentStep / steps.length) * 100));

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Step {currentStep} of {steps.length}
            </p>
            <p className="mt-0.5 text-sm font-black text-foreground">{activeLabel}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
            {currentStep}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="hidden gap-2 sm:grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isComplete = currentStep > stepNumber;

          return (
            <div key={label} className="flex flex-col items-center gap-1 text-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition-colors ${
                  isComplete
                    ? "border-green-600 bg-green-600 text-white"
                    : isActive
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <span className={`text-[10px] font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepProgress;
