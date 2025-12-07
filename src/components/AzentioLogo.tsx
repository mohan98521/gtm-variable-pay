interface AzentioLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function AzentioLogo({ 
  variant = "dark", 
  size = "md", 
  showText = true 
}: AzentioLogoProps) {
  const sizes = {
    sm: { text: "text-xl", icon: "h-5 w-5" },
    md: { text: "text-2xl", icon: "h-7 w-7" },
    lg: { text: "text-4xl", icon: "h-10 w-10" },
  };

  const textColor = variant === "light" ? "text-white" : "text-primary";
  const accentColor = "hsl(166 76% 47%)";

  return (
    <div className="flex items-center gap-1">
      {showText && (
        <span className={`${sizes[size].text} font-bold ${textColor} tracking-tight`}>
          azentio
        </span>
      )}
      <svg 
        viewBox="0 0 32 32" 
        className={sizes[size].icon}
        fill="none"
      >
        {/* Left curve */}
        <path 
          d="M16 4C10 4 7 10 7 16C7 22 10 28 16 32" 
          stroke={accentColor} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
        {/* Right curve */}
        <path 
          d="M16 4C22 4 25 10 25 16" 
          stroke={accentColor} 
          strokeWidth="4" 
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
