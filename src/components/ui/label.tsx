import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<"label"> & { htmlFor: string }) {
  return (
    // The required htmlFor prop is supplied through props.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      data-slot="label"
      className={cn("text-sm font-medium text-slate-800", className)}
      {...props}
    />
  );
}

export { Label };
