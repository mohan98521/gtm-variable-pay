import azentioLogo from "@/assets/azentio-logo.png";

interface AzentioLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export function AzentioLogo({ 
  variant = "dark", 
  size = "md" 
}: AzentioLogoProps) {
  const sizes = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  // For light variant (sidebar), we invert the logo colors
  const filterClass = variant === "light" ? "brightness-0 invert" : "";

  return (
    <img 
      src={azentioLogo} 
      alt="Azentio" 
      className={`${sizes[size]} w-auto ${filterClass}`}
    />
  );
}
