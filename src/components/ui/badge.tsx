import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase",
  {
    variants: {
      tone: {
        mute: "bg-surface-2 text-muted",
        ok: "bg-ok text-white",
        warn: "bg-warn text-white",
        danger: "bg-danger text-white",
        accent: "bg-accent text-accent-fg",
      },
    },
    defaultVariants: { tone: "mute" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
