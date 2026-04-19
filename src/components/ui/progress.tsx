"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressTrackVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-muted",
  {
    variants: {
      size: {
        sm:      "h-1",
        default: "h-2",
        lg:      "h-3",
      },
    },
    defaultVariants: { size: "default" },
  }
)

function Progress({
  className,
  size,
  value,
  ...props
}: ProgressPrimitive.Root.Props & VariantProps<typeof progressTrackVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className={progressTrackVariants({ size })}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full rounded-full bg-primary transition-all duration-normal"
          style={{ width: `${value ?? 0}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
