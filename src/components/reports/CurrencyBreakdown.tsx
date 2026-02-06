/**
 * Currency/Country Breakdown Report
 * 
 * Groups payouts by local currency with exchange rate display.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { exportToXLSX } from "@/lib/xlsxExport";
import { format } from "date-fns";
import { useCurrencies } from "@/hooks/useCurrencies";

interface CurrencyData {
  currency: string;
  employeeCount: number;
  avgCompRate: number;
  avgMarketRate: number;
  vpLocal: number;
  vpUsd: number;
  commLocal: number;
  commUsd: number;
  totalLocal: number;
  totalUsd: number;
}

export function CurrencyBreakdown() {
  const { selectedYear } = useFiscalYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(`${selectedYear}-01`);
  const { getCurrencySymbol } = useCurrencies();

  const { data, isLoading } = useQuery({
    queryKey: ["currency_breakdown", selectedMonth],
    queryFn: async (): Promise<CurrencyData[]> => {
      // Fetch payouts for the selected month
      const { data: payouts, error: payoutsError } = await supabase
        .from("monthly_payouts")
        .select("employee_id, payout_type, calculated_amount_usd, calculated_amount_local, local_currency, exchange_rate_used")
        .eq("month_year", `${selectedMonth}-01`);
      
      if (payoutsError) throw payoutsError;

      // Get employees for compensation rates
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("employee_id, local_currency, compensation_exchange_rate");
      
      if (empError) throw empError;

      // Get market rates
      const { data: marketRates, error: ratesError } = await supabase
        .from("exchange_rates")
        .select("currency_code, rate_to_usd")
        .eq("month_year", `${selectedMonth}-01`);
      
      if (ratesError) throw ratesError;

      const empCurrencyMap = new Map<string, { currency: string; compRate: number }>();
      employees?.forEach(e => {
        empCurrencyMap.set(e.employee_id, {
          currency: e.local_currency,
          compRate: e.compensation_exchange_rate || 1,
        });
      });

      const marketRateMap = new Map<string, number>();
      marketRates?.forEach(r => {
        marketRateMap.set(r.currency_code, r.rate_to_usd);
      });

      // Aggregate by currency
      const currencyAgg = new Map<string, {
        employees: Set<string>;
        compRates: number[];
        vpLocal: number;
        vpUsd: number;
        commLocal: number;
        commUsd: number;
      }>();

      payouts?.forEach(payout => {
        const emp = empCurrencyMap.get(payout.employee_id);
        const currency = payout.local_currency || emp?.currency || 'USD';
        
        if (!currencyAgg.has(currency)) {
          currencyAgg.set(currency, {
            employees: new Set(),
            compRates: [],
            vpLocal: 0,
            vpUsd: 0,
            commLocal: 0,
            commUsd: 0,
          });
        }
        
        const data = currencyAgg.get(currency)!;
        data.employees.add(payout.employee_id);
        if (emp?.compRate) data.compRates.push(emp.compRate);
        
        const isVp = payout.payout_type?.toLowerCase().includes('variable');
        if (isVp) {
          data.vpLocal += payout.calculated_amount_local || 0;
          data.vpUsd += payout.calculated_amount_usd || 0;
        } else {
          data.commLocal += payout.calculated_amount_local || 0;
          data.commUsd += payout.calculated_amount_usd || 0;
        }
      });

      return Array.from(currencyAgg.entries()).map(([currency, data]) => ({
        currency,
        employeeCount: data.employees.size,
        avgCompRate: data.compRates.length > 0 
          ? data.compRates.reduce((a, b) => a + b, 0) / data.compRates.length 
          : 1,
        avgMarketRate: marketRateMap.get(currency) || 1,
        vpLocal: data.vpLocal,
        vpUsd: data.vpUsd,
        commLocal: data.commLocal,
        commUsd: data.commUsd,
        totalLocal: data.vpLocal + data.commLocal,
        totalUsd: data.vpUsd + data.commUsd,
      })).sort((a, b) => b.totalUsd - a.totalUsd);
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return `${selectedYear}-${m.toString().padStart(2, '0')}`;
  });

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'USD', // Always format as number, prefix with symbol
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace('$', currency === 'USD' ? '$' : '');
  };

  // getCurrencySymbol is now provided by useCurrencies hook

  const handleExport = () => {
    if (!data) return;
    exportToXLSX(
      data.map(d => ({
        currency: d.currency,
        employees: d.employeeCount,
        comp_rate: d.avgCompRate.toFixed(2),
        market_rate: d.avgMarketRate.toFixed(2),
        vp_local: d.vpLocal,
        vp_usd: d.vpUsd,
        comm_local: d.commLocal,
        comm_usd: d.commUsd,
        total_local: d.totalLocal,
        total_usd: d.totalUsd,
      })),
      `currency_breakdown_${selectedMonth}`
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Country/Currency Breakdown
          </h2>
          <p className="text-muted-foreground">Local currency grouped analysis</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m}>
                  {format(new Date(`${m}-01`), 'MMMM yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} className="bg-[hsl(var(--azentio-teal))] hover:bg-[hsl(var(--azentio-teal))]/90">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Currency Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data?.map(curr => (
          <Card key={curr.currency}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{curr.currency}</CardTitle>
                  <CardDescription>{curr.employeeCount} employee{curr.employeeCount !== 1 ? 's' : ''}</CardDescription>
                </div>
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">Comp Rate: <span className="font-medium text-foreground">{curr.avgCompRate.toFixed(2)}</span></div>
                  <div className="text-muted-foreground">Market Rate: <span className="font-medium text-foreground">{curr.avgMarketRate.toFixed(2)}</span></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variable Pay</span>
                <div className="text-right">
                  <div className="font-medium">{getCurrencySymbol(curr.currency)}{curr.vpLocal.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">(${curr.vpUsd.toLocaleString()} USD)</div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commissions</span>
                <div className="text-right">
                  <div className="font-medium">{getCurrencySymbol(curr.currency)}{curr.commLocal.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">(${curr.commUsd.toLocaleString()} USD)</div>
                </div>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Total</span>
                <div className="text-right">
                  <div className="font-bold text-[hsl(var(--azentio-teal))]">
                    {getCurrencySymbol(curr.currency)}{curr.totalLocal.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">(${curr.totalUsd.toLocaleString()} USD)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!data || data.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No payout data for {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
