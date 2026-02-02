-- Add collection_month column to track when collection was made for payroll processing
ALTER TABLE deal_collections 
ADD COLUMN collection_month date;

-- Create an index for efficient filtering by collection_month
CREATE INDEX idx_deal_collections_collection_month ON deal_collections(collection_month);

-- Create a trigger function to auto-set collection_month when is_collected changes to true
CREATE OR REPLACE FUNCTION public.set_collection_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- If is_collected changed from false to true, set collection_month
  IF NEW.is_collected = true AND (OLD.is_collected = false OR OLD.is_collected IS NULL) THEN
    -- Use collection_date if provided, otherwise use current date
    NEW.collection_month := date_trunc('month', COALESCE(NEW.collection_date::date, CURRENT_DATE))::date;
  END IF;
  
  -- If is_collected changed from true to false, clear collection_month
  IF NEW.is_collected = false AND OLD.is_collected = true THEN
    NEW.collection_month := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER set_collection_month_trigger
BEFORE UPDATE ON deal_collections
FOR EACH ROW
EXECUTE FUNCTION set_collection_month();