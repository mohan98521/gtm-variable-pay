import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CalendarDays, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerLogo } from "@/components/AzentioLogo";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { selectedYear, setSelectedYear, yearOptions } = useFiscalYear();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      {!isMobile && <AppSidebar />}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Global Header */}
        <header className="flex items-center justify-between gap-3 px-4 lg:px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                  <AppSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
              </Sheet>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Demo for</span>
              <CustomerLogo size="sm" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Fiscal Year:</span>
            </div>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
            >
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    FY {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
