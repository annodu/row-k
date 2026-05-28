import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-950",
        secondary: "border-transparent bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
        outline: "border-stone-200 text-stone-700 dark:border-stone-700 dark:text-stone-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
