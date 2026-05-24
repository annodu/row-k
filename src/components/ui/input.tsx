import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-none border border-stone-300 bg-stone-50 px-4 py-3 text-sm transition-colors outline-none placeholder:text-stone-400 hover:border-stone-400 focus-visible:border-stone-950",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
