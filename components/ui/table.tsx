import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Wide tables scroll inside their own container rather than the page body. */
export function TableScroller({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[42rem] border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-surface-muted px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-body-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-4 py-3 align-top", className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-body-muted">
        {children}
      </td>
    </tr>
  );
}
