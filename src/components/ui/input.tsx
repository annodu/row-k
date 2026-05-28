import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-none border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-950 transition-colors outline-none placeholder:text-stone-400 hover:border-stone-400 focus-visible:border-stone-950 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:hover:border-stone-500 dark:focus-visible:border-stone-100",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
