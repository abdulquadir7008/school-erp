"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center",
        className
      )}
    >
      <input
        type="checkbox"
        ref={ref}
        className="peer sr-only"
        {...props}
      />
      <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary-600 peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
    </label>
  )
);
Switch.displayName = "Switch";

export { Switch };