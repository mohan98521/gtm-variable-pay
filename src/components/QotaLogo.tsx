import qotaLogo from "@/assets/qota-logo.png";

interface QotaLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export function QotaLogo({ 
  variant = "dark", 
  size = "md" 
}: QotaLogoProps) {
  const sizes = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  // For light variant (sidebar), we invert the logo colors
  const filterClass = variant === "light" ? "brightness-0 invert" : "";

  return (
    <img 
      src={qotaLogo} 
      alt="Qota" 
      className={`${sizes[size]} w-auto ${filterClass}`}
    />
  );
}
