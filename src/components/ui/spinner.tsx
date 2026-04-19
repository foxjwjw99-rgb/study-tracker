"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const spinnerVariants = cva("inline-flex animate-spin text-muted-foreground", {
  variants: {
    size: {
      sm:      "[&_svg]:size-3",
      default: "[&_svg]:size-4",
      lg:      "[&_svg]:size-5",
    },
  },
  defaultVariants: { size: "default" },
})

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof spinnerVariants>) {
  return (
    <span
      data-slot="spinner"
      aria-label="載入中"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <Loader2 />
    </span>
  )
}

export { Spinner, spinnerVariants }
