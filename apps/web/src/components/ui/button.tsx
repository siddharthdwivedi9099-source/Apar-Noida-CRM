import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background active:scale-[0.97] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 [background-image:linear-gradient(135deg,hsl(var(--primary)),rgb(var(--hero-accent-rgb)))]",
        secondary: "bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-md",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        outline: "border border-border bg-transparent hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent hover:text-accent-foreground",
        danger: "bg-rose-500 text-white shadow-sm hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/30"
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-2xl px-6",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };

