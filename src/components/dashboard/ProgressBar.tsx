import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: "default" | "accent" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  variant = "default",
  size = "md",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const variantStyles = {
    default: "bg-primary",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };

  const sizeStyles = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  // Determine variant based on percentage if not specified
  const autoVariant = percentage >= 100 ? "success" : percentage >= 85 ? "accent" : percentage >= 70 ? "warning" : "destructive";
  const activeVariant = variant === "default" ? autoVariant : variant;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full rounded-full bg-muted", sizeStyles[size])}>
        <div
          className={cn(
            "rounded-full transition-all duration-500 ease-out",
            sizeStyles[size],
            variantStyles[activeVariant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{value.toLocaleString()}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}