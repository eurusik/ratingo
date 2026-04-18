import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/utils/index"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        count:
          "border-transparent bg-cinema-elevated/60 text-cinema-text-muted font-medium tabular-nums px-1.5 py-0 rounded text-[11px] leading-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Element to render. Use `"span"` when nesting inside interactive content
   * (e.g. `<button>`, Radix `TabsTrigger`) to keep the DOM HTML5-valid.
   */
  as?: "div" | "span"
}

function Badge({ className, variant, as: Comp = "div", ...props }: BadgeProps) {
  return (
    <Comp className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
