import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
import { useExchangeRates, useInsertExchangeRates } from "@/hooks/useExchangeRates";
import { toast } from "@/hooks/use-toast";

interface ExchangeRatesTabProps {
  selectedMonth: string;
}

const DEFAULT_CURRENCIES = [
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
];

export function ExchangeRatesTab({ selectedMonth }: ExchangeRatesTabProps) {
  const { data: rates, isLoading } = useExchangeRates(selectedMonth);
  const insertMutation = useInsertExchangeRates();

  // Initialize rates from DB or defaults
  const [localRates, setLocalRates] = useState<Record<string, string>>({});

  // Merge DB rates with defaults
  const ratesMap = new Map(rates?.map((r) => [r.currency_code, r.rate_to_usd]) || []);

  const handleRateChange = (currency: string, value: string) => {
    setLocalRates((prev) => ({ ...prev, [currency]: value }));
  };

  const getRateValue = (currency: string): string => {
    if (localRates[currency] !== undefined) {
      return localRates[currency];
    }
    const dbRate = ratesMap.get(currency);
    return dbRate !== undefined ? dbRate.toString() : "";
  };

  const handleSave = async () => {
    const ratesToSave = DEFAULT_CURRENCIES.map((curr) => ({
      currency_code: curr.code,
      rate_to_usd: parseFloat(getRateValue(curr.code)) || 0,
      month_year: selectedMonth,
    })).filter((r) => r.rate_to_usd > 0);

    if (ratesToSave.length === 0) {
      toast({
        title: "No rates to save",
        description: "Please enter at least one exchange rate",
        variant: "destructive",
      });
      return;
    }

    await insertMutation.mutateAsync(ratesToSave);
    setLocalRates({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Exchange Rates</h3>
          <p className="text-sm text-muted-foreground">
            Currency conversion rates to USD for {selectedMonth}
          </p>
        </div>
        <Button onClick={handleSave} disabled={insertMutation.isPending}>
          <Save className="h-4 w-4 mr-1.5" />
          {insertMutation.isPending ? "Saving..." : "Save Rates"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DEFAULT_CURRENCIES.map((curr) => (
                <div
                  key={curr.code}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted font-semibold text-sm">
                    {curr.code}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{curr.name}</p>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Rate to USD"
                      value={getRateValue(curr.code)}
                      onChange={(e) => handleRateChange(curr.code, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Enter the conversion rate from each currency to 1 USD. 
              For example, if 1 USD = 83 INR, enter 0.012 (1/83) for INR.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
