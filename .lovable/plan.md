

## Add Customer Logo (Azentio) to Page Headers

### What This Does

Adds the Azentio logo as a "customer logo" in the top-left area of every page header, so during demos the customer sees their branding alongside the Qota product branding.

### Where It Appears

- **Desktop**: In the top header bar (left side), next to the mobile hamburger area -- showing "Powered by Qota | [Customer Logo]" or simply the customer logo with a subtle label like "Demo for"
- **Mobile**: Same header bar, visible after the hamburger menu button
- **Auth page**: Below the Qota logo, showing the customer logo

### Implementation

#### 1. Rename the old AzentioLogo component to a CustomerLogo component

Update `src/components/AzentioLogo.tsx` to become a generic `CustomerLogo` component that imports the existing `azentio-logo.png`. This keeps the asset as-is and just gives the component a demo-friendly name.

- Rename component to `CustomerLogo`
- Update props interface to `CustomerLogoProps`
- Alt text: "Customer Logo"

#### 2. Add customer logo to the AppLayout header (`src/components/layout/AppLayout.tsx`)

- Import `CustomerLogo`
- In the header's left section (where the hamburger menu is on mobile), add the customer logo with a small "Demo for" label
- Layout: `[Hamburger (mobile only)] [Demo for: [Azentio Logo]]`
- The logo will be small (h-6) to fit the header bar height

#### 3. Add customer logo to the Auth page (`src/pages/Auth.tsx`)

- Import `CustomerLogo`
- Add it below the Qota logo with a subtle "Prepared for" label
- This gives the demo a professional, customer-specific landing page feel

### Technical Details

**File 1: `src/components/AzentioLogo.tsx`** (rename internals)
- Component: `AzentioLogo` becomes `CustomerLogo`
- Interface: `AzentioLogoProps` becomes `CustomerLogoProps`
- Keeps importing `azentio-logo.png` (the actual Azentio logo asset)

**File 2: `src/components/layout/AppLayout.tsx`**
- Import `CustomerLogo` from `@/components/AzentioLogo`
- Add to header left section: a flex row with "Demo for" text label and the customer logo (size "sm")
- Styled with muted text color for the label, logo displayed at h-5/h-6

**File 3: `src/pages/Auth.tsx`**
- Import `CustomerLogo`
- Add below the Qota logo section: a separator line, then "Prepared for" label with the Azentio logo

### What Does NOT Change
- The Qota sidebar logo stays as-is
- Navigation, permissions, and functionality are untouched
- The `qota-logo.png` asset and `QotaLogo` component are unchanged
- No database changes needed

