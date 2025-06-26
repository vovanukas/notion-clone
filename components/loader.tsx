import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const loaderVariants = cva(
  "scale-wrapper",
  {
    variants: {
      size: {
        default: "[--scale:1]",
        sm: "[--scale:0.7]",
        lg: "[--scale:1.3]",
        icon: "[--scale:1.6]"
      },
      variant: {
        default: "[--loader-color:hsl(var(--primary))]",
        secondary: "[--loader-color:hsl(var(--secondary-foreground))]",
        muted: "[--loader-color:hsl(var(--muted-foreground))]",
        accent: "[--loader-color:hsl(var(--accent-foreground))]"
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default"
    }
  }
);

interface LoaderProps extends VariantProps<typeof loaderVariants> {
  className?: string;
}

export const Loader = ({
  size,
  variant,
  className
}: LoaderProps) => {
  return (
    <div className={cn("flex items-center justify-center", loaderVariants({ size, variant }), className)}>
      <div className="origin-center" style={{ transform: 'scale(var(--scale))' }}>
        <style jsx>{`
          div {
            --c: no-repeat linear-gradient(var(--loader-color) 0 0);
            background: 
              var(--c),var(--c),var(--c),
              var(--c),var(--c),var(--c),
              var(--c),var(--c),var(--c);
            background-size: 16px 16px;
            animation: 
              l32-1 1s infinite,
              l32-2 1s infinite;
          }
          @keyframes l32-1 {
            0%,100% {width:45px;height: 45px}
            35%,65% {width:65px;height: 65px}
          }
          @keyframes l32-2 {
            0%,40%  {background-position: 0 0,0 50%, 0 100%,50% 100%,100% 100%,100% 50%,100% 0,50% 0,  50% 50% }
            60%,100%{background-position: 0 50%, 0 100%,50% 100%,100% 100%,100% 50%,100% 0,50% 0,0 0,  50% 50% }
          }
        `}</style>
      </div>
    </div>
  );
}; 