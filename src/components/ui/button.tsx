import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-stone-600 dark:focus-visible:ring-stone-400",
  {
    variants: {
      variant: {
        default: "bg-stone-950 text-white shadow-sm hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-300",
        secondary: "bg-white text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800",
        outline: "bg-transparent text-stone-900 ring-1 ring-stone-400 hover:bg-stone-100 dark:text-stone-100 dark:ring-stone-600 dark:hover:bg-stone-800",
        ghost: "bg-transparent text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 px-3",
        lg: "h-12 px-5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? "span" : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
