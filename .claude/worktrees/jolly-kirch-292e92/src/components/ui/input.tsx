import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm transition-[border-color,box-shadow] outline-none placeholder:text-stone-400 focus-visible:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-100",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
