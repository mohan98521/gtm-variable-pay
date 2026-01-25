import { createContext, useContext, useState, ReactNode, useMemo } from "react";

interface FiscalYearContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  yearOptions: number[];
  getMonthsForYear: (year: number) => { value: string; label: string }[];
  isMonthInFiscalYear: (monthYear: string) => boolean;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

const currentYear = new Date().getFullYear();

// Generate year options: past 2 years to next 5 years
const generateYearOptions = (): number[] => {
  const years: number[] = [];
  for (let y = currentYear - 2; y <= currentYear + 5; y++) {
    years.push(y);
  }
  return years;
};

// Generate months for a specific fiscal year (Jan - Dec)
const generateMonthsForYear = (year: number): { value: string; label: string }[] => {
  const months = [];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  for (let m = 0; m < 12; m++) {
    const monthNum = (m + 1).toString().padStart(2, "0");
    months.push({
      value: `${year}-${monthNum}-01`,
      label: `${monthNames[m]} ${year}`,
    });
  }
  
  return months;
};

interface FiscalYearProviderProps {
  children: ReactNode;
}

export function FiscalYearProvider({ children }: FiscalYearProviderProps) {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const yearOptions = useMemo(() => generateYearOptions(), []);
  
  const getMonthsForYear = useMemo(() => {
    return (year: number) => generateMonthsForYear(year);
  }, []);
  
  const isMonthInFiscalYear = useMemo(() => {
    return (monthYear: string) => {
      const year = parseInt(monthYear.substring(0, 4), 10);
      return year === selectedYear;
    };
  }, [selectedYear]);
  
  const value = useMemo(
    () => ({
      selectedYear,
      setSelectedYear,
      yearOptions,
      getMonthsForYear,
      isMonthInFiscalYear,
    }),
    [selectedYear, yearOptions, getMonthsForYear, isMonthInFiscalYear]
  );
  
  return (
    <FiscalYearContext.Provider value={value}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  const context = useContext(FiscalYearContext);
  if (context === undefined) {
    throw new Error("useFiscalYear must be used within a FiscalYearProvider");
  }
  return context;
}
