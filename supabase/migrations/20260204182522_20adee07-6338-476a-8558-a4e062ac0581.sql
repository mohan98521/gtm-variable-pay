-- Add month lock check trigger to closing_arr_actuals
-- This reuses the existing check_month_lock() function
CREATE TRIGGER check_closing_arr_month_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.closing_arr_actuals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_month_lock();