import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "border-transparent bg-slate-50 text-slate-900 hover:bg-slate-50/80",
  secondary: "border-transparent bg-slate-800 text-slate-50 hover:bg-slate-800/80",
  destructive: "border-transparent bg-red-900 text-slate-50 shadow hover:bg-red-900/80",
  success: "border-transparent bg-emerald-900 text-emerald-50 hover:bg-emerald-900/80",
  outline: "text-slate-50",
};

function Badge({ className, variant = "default", ...props }) {
  const variantClass = badgeVariants[variant] || badgeVariants.default;
  
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
        variantClass,
        className
      )}
      {...props}
    />
  );
}

export { Badge };