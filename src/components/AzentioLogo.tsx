import azentioLogo from "@/assets/azentio-logo.png";

interface CustomerLogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export function CustomerLogo({ 
  variant = "dark", 
  size = "md" 
}: CustomerLogoProps) {
  const sizes = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  const filterClass = variant === "light" ? "brightness-0 invert" : "";

  return (
    <img 
      src={azentioLogo} 
      alt="Customer Logo" 
      className={`${sizes[size]} w-auto ${filterClass}`}
    />
  );
}
