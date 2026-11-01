// Every input in the tool: label, plain-English help, unit, slider range and default.
// Defaults are illustrative Seattle-area placeholders. Replace them with your own numbers.
// unit: 'money' | 'pct' | 'years' | 'months' | 'num' | 'hours'
// 'verify: true' marks values (tax rules, local rates) worth double-checking for your situation.

export const GROUPS = [
  {
    id: 'household',
    title: 'Income & spending',
    fields: [
      { id: 'income', label: 'Gross household income (yearly)', unit: 'money', min: 0, max: 1_000_000, step: 1000, def: 250_000, help: 'Before taxes, both of you combined. Lenders use this number.' },
      { id: 'debts', label: 'Monthly debt payments', unit: 'money', min: 0, max: 10_000, step: 25, def: 800, help: 'Car loans, student loans, minimum credit card payments. Not your mortgage.' },
      { id: 'takeHome', label: 'Monthly take-home pay', unit: 'money', min: 0, max: 60_000, step: 100, def: 14_500, help: 'What actually lands in your bank account each month after taxes and retirement contributions.' },
      { id: 'spending', label: 'Monthly spending (not housing)', unit: 'money', min: 0, max: 40_000, step: 100, def: 6_000, help: 'Groceries, childcare, cars, utilities, fun, everything except mortgage, property tax, home insurance and HOA.' },
      { id: 'savingsGoal', label: 'Monthly savings you want to keep', unit: 'money', min: 0, max: 20_000, step: 100, def: 1_500, help: 'Used only for the "comfortable" price: how much you still want to save each month after housing.' },
    ],
  },
  {
    id: 'assets',
    title: 'Savings & down payment sources',
    fields: [
      { id: 'cashSavings', label: 'Cash savings', unit: 'money', min: 0, max: 2_000_000, step: 1000, def: 180_000, help: 'Checking, savings, money market. Not retirement accounts.' },
      { id: 'emergencyTarget', label: 'Emergency fund to always keep', unit: 'money', min: 0, max: 500_000, step: 1000, def: 40_000, help: 'The cash floor you never want to drop below. The tool warns you when a plan dips under it.' },
      { id: 'stockValue', label: 'Taxable stock / brokerage value', unit: 'money', min: 0, max: 5_000_000, step: 1000, def: 200_000, help: 'Investments you could sell for the down payment (not 401k/IRA).' },
      { id: 'stockBasis', label: 'What you paid for that stock (cost basis)', unit: 'money', min: 0, max: 5_000_000, step: 1000, def: 120_000, help: 'Your brokerage shows this as "cost basis". The difference from the value is your gain, which is taxed when you sell.' },
      { id: 'gift', label: 'Family gift', unit: 'money', min: 0, max: 1_000_000, step: 1000, def: 50_000, help: 'Money given, not loaned. Lenders will want a signed gift letter and a paper trail of the transfer.' },
    ],
  },
  {
    id: 'taxes',
    title: 'Tax rates',
    fields: [
      { id: 'marginal', label: 'Federal income tax bracket', unit: 'pct', min: 0, max: 37, step: 1, def: 24, help: 'Your top federal bracket. Used for taxes on rental profit. (Washington has no state income tax.)' },
      { id: 'fedLTCG', label: 'Federal long-term capital gains rate', unit: 'pct', min: 0, max: 20, step: 1, def: 15, help: 'Usually 15% for married couples with taxable income between about $96k and $600k; 20% above that.', verify: true },
      { id: 'niit', label: 'Net investment income tax', unit: 'pct', min: 0, max: 3.8, step: 0.1, def: 0, help: 'An extra 3.8% on investment gains when joint income is above $250k. Set to 3.8 if that applies to you.', verify: true },
      { id: 'waCgDeduction', label: 'Washington capital gains deduction', unit: 'money', min: 0, max: 500_000, step: 1000, def: 278_000, help: 'Washington taxes stock gains above this yearly amount at 7% (9.9% on the part over $1M). Real estate is exempt. The amount is adjusted every year.', verify: true },
      { id: 'otherGains', label: 'Other stock gains you expect this year', unit: 'money', min: 0, max: 2_000_000, step: 1000, def: 0, help: 'The Washington deduction is shared across all your stock gains in the year.' },
      { id: 'exclusionCap', label: 'Home-sale tax exclusion (married)', unit: 'money', min: 0, max: 500_000, step: 10_000, def: 500_000, help: 'Up to $500k of profit on selling your home is tax-free for a married couple, if you lived there 2 of the last 5 years.', verify: true },
      { id: 'recapRate', label: 'Depreciation recapture rate', unit: 'pct', min: 0, max: 25, step: 1, def: 25, help: 'When you sell a former rental, the depreciation you deducted is taxed at up to 25%, even inside the exclusion window.' },
    ],
  },
  {
    id: 'current',
    title: 'Current house',
    fields: [
      { id: 'curValue', label: 'What it would sell for today', unit: 'money', min: 0, max: 5_000_000, step: 5000, def: 900_000, help: 'A realistic sale price. Ask your agent for a comparative market analysis.' },
      { id: 'curBalance', label: 'Mortgage balance', unit: 'money', min: 0, max: 3_000_000, step: 1000, def: 450_000, help: 'From your latest mortgage statement.' },
      { id: 'curRate', label: 'Mortgage interest rate', unit: 'pct', min: 0, max: 10, step: 0.125, def: 3.0, help: 'Your current rate.' },
      { id: 'curYearsLeft', label: 'Years left on the mortgage', unit: 'years', min: 1, max: 30, step: 1, def: 26, help: 'Used with the balance and rate to work out your monthly principal + interest.' },
      { id: 'curTax', label: 'Property tax (yearly)', unit: 'money', min: 0, max: 50_000, step: 100, def: 7_500, help: 'From your King County tax statement.' },
      { id: 'curIns', label: 'Homeowners insurance (yearly)', unit: 'money', min: 0, max: 20_000, step: 50, def: 1_800, help: 'Your current policy premium.' },
      { id: 'curHOA', label: 'HOA dues (monthly)', unit: 'money', min: 0, max: 2_000, step: 10, def: 0, help: 'Leave at 0 if none.' },
      { id: 'curPurchase', label: 'What you paid for it', unit: 'money', min: 0, max: 5_000_000, step: 5000, def: 750_000, help: 'Your purchase price. Used for capital gains.' },
      { id: 'curImprovements', label: 'Improvements since buying', unit: 'money', min: 0, max: 1_000_000, step: 1000, def: 20_000, help: 'Remodels, new roof, additions. Not repairs. These reduce your taxable gain.' },
      { id: 'yearsLived', label: 'Years you will have lived there at move-out', unit: 'years', min: 0, max: 30, step: 0.5, def: 3, help: 'At 2+ years, you can rent it out for up to 3 years after moving out and still sell with the tax exclusion.' },
    ],
  },
  {
    id: 'new',
    title: 'New house',
    fields: [
      { id: 'newPrice', label: 'Purchase price', unit: 'money', min: 100_000, max: 5_000_000, step: 5000, def: 1_100_000, help: 'The house you are considering. Try a few prices.' },
      { id: 'downPct', label: 'Down payment', unit: 'pct', min: 3, max: 100, step: 1, def: 20, help: '20% or more avoids mortgage insurance (PMI) on a conventional loan.' },
      { id: 'newRate', label: 'Mortgage interest rate', unit: 'pct', min: 0, max: 12, step: 0.125, def: 6.25, help: 'Get a current quote from a lender. Rates change daily.', verify: true },
      { id: 'newTerm', label: 'Loan length', unit: 'years', min: 10, max: 30, step: 5, def: 30, help: 'Most people choose 30 years; 15 years has a higher payment but much less interest.' },
      { id: 'newTaxRate', label: 'Property tax rate', unit: 'pct', min: 0, max: 3, step: 0.01, def: 0.95, help: 'Yearly tax as a % of price. Seattle is roughly 0.9–1.0%; check the county assessor for the specific property.', verify: true },
      { id: 'newIns', label: 'Homeowners insurance (yearly)', unit: 'money', min: 0, max: 20_000, step: 50, def: 2_400, help: 'Get a quote; older homes and earthquake coverage cost more.' },
      { id: 'newHOA', label: 'HOA dues (monthly)', unit: 'money', min: 0, max: 2_000, step: 10, def: 0, help: 'Leave at 0 if none.' },
      { id: 'closingPct', label: 'Buyer closing costs', unit: 'pct', min: 0, max: 5, step: 0.1, def: 1.5, help: 'Lender fees, title, escrow, prepaid taxes/insurance. Your lender’s Loan Estimate has the real number.' },
      { id: 'pmiRate', label: 'PMI rate (only under 20% down)', unit: 'pct', min: 0, max: 2, step: 0.05, def: 0.5, help: 'Yearly mortgage insurance as a % of the loan. Ignored at 20% or more down.' },
    ],
  },
  {
    id: 'selling',
    title: 'Selling costs',
    fields: [
      { id: 'commission', label: 'Agent commissions (total)', unit: 'pct', min: 0, max: 8, step: 0.25, def: 5, help: 'Listing agent plus any buyer-agent compensation you agree to pay. Negotiable.' },
      { id: 'otherSellPct', label: 'Other seller closing costs', unit: 'pct', min: 0, max: 3, step: 0.1, def: 1, help: 'Title insurance, escrow, small repairs from inspection.' },
      { id: 'prepCost', label: 'Prep, repairs & staging', unit: 'money', min: 0, max: 100_000, step: 500, def: 15_000, help: 'Paint, cleaning, staging, pre-listing repairs. Paid up front, before the sale.' },
    ],
  },
  {
    id: 'reet',
    title: 'Washington excise tax on selling (advanced)',
    fields: [
      { id: 'reetT1', label: 'Tier 1 up to', unit: 'money', min: 0, max: 2_000_000, step: 1000, def: 525_000, help: 'The seller pays a graduated state excise tax on the sale price. Thresholds are adjusted every few years.', verify: true },
      { id: 'reetR1', label: 'Tier 1 rate', unit: 'pct', min: 0, max: 5, step: 0.01, def: 1.1, help: '', verify: true },
      { id: 'reetT2', label: 'Tier 2 up to', unit: 'money', min: 0, max: 5_000_000, step: 1000, def: 1_525_000, help: '', verify: true },
      { id: 'reetR2', label: 'Tier 2 rate', unit: 'pct', min: 0, max: 5, step: 0.01, def: 1.28, help: '', verify: true },
      { id: 'reetT3', label: 'Tier 3 up to', unit: 'money', min: 0, max: 10_000_000, step: 1000, def: 3_025_000, help: '', verify: true },
      { id: 'reetR3', label: 'Tier 3 rate', unit: 'pct', min: 0, max: 5, step: 0.01, def: 2.75, help: '', verify: true },
      { id: 'reetR4', label: 'Above tier 3 rate', unit: 'pct', min: 0, max: 5, step: 0.01, def: 3.0, help: '', verify: true },
      { id: 'reetLocal', label: 'Seattle local excise tax', unit: 'pct', min: 0, max: 1, step: 0.01, def: 0.5, help: 'Added on top of the state tax, on the full price.', verify: true },
    ],
  },
  {
    id: 'growth',
    title: 'Growth assumptions',
    fields: [
      { id: 'appreciation', label: 'Home value growth (yearly)', unit: 'pct', min: -5, max: 10, step: 0.25, def: 4, help: 'Long-run Seattle appreciation has averaged a few percent a year, with big swings.' },
      { id: 'investReturn', label: 'Return on invested sale money', unit: 'pct', min: 0, max: 12, step: 0.25, def: 6, help: 'What money from selling (or rental profit) earns. Set it to your new mortgage rate to model paying down the mortgage instead.' },
      { id: 'stockReturn', label: 'Stock return (yearly)', unit: 'pct', min: 0, max: 12, step: 0.25, def: 7, help: 'Expected growth of stock you keep instead of selling.' },
      { id: 'cashYield', label: 'Cash savings interest (yearly)', unit: 'pct', min: 0, max: 6, step: 0.25, def: 3.5, help: 'High-yield savings rate, after tax.' },
      { id: 'inflation', label: 'Cost inflation (yearly)', unit: 'pct', min: 0, max: 8, step: 0.25, def: 3, help: 'How fast insurance, utilities, cleaning and other costs rise.' },
      { id: 'propTaxGrowth', label: 'Property tax growth (yearly)', unit: 'pct', min: 0, max: 8, step: 0.25, def: 3, help: 'Washington limits the base levy growth, but voter-approved levies add more.' },
    ],
  },
  {
    id: 'lender',
    title: 'Lender rules',
    fields: [
      { id: 'frontRatio', label: 'Max housing cost as % of gross income', unit: 'pct', min: 20, max: 50, step: 1, def: 33, help: 'The classic conservative guideline is 28%. Conventional lenders mostly focus on the total-debt ratio below, so 33% or more is often allowed.' },
      { id: 'backRatio', label: 'Max total debts as % of gross income', unit: 'pct', min: 30, max: 55, step: 1, def: 45, help: 'Housing + all other debt payments. 43–45% is common for conventional loans; some go to 50%.' },
    ],
  },
  {
    id: 'funding',
    title: 'Your down payment mix',
    fields: [
      { id: 'stockSold', label: 'Stock to sell for the purchase', unit: 'money', min: 0, max: 5_000_000, step: 1000, def: 100_000, help: 'The gift is used first, then this stock sale; cash covers whatever is left.' },
    ],
  },
  {
    id: 'timing',
    title: 'Sale timing',
    fields: [
      { id: 'delay', label: 'Months after buying until the current house sells', unit: 'months', min: 0, max: 24, step: 1, def: 3, help: '0 means it sells the same month you close on the new house.' },
      { id: 'priceChange', label: 'Market change while you wait (yearly)', unit: 'pct', min: -15, max: 15, step: 0.5, def: 0, help: 'Negative if prices soften or you have to cut the price to sell.' },
      { id: 'vacantCost', label: 'Extra monthly cost of an empty house', unit: 'money', min: 0, max: 3_000, step: 25, def: 400, help: 'Utilities, yard care, cleaning, vacant-home insurance surcharge while it sits on the market.' },
      { id: 'recastPct', label: 'Share of sale money used to recast', unit: 'pct', min: 0, max: 100, step: 5, def: 50, help: 'A recast: pay a lump sum on the new mortgage and the lender lowers your monthly payment (same rate, same end date). 0 = no recast.' },
      { id: 'recastFee', label: 'Recast fee', unit: 'money', min: 0, max: 1_000, step: 25, def: 300, help: 'Most lenders charge $150–$500. Ask whether your loan allows recasting.' },
    ],
  },
  {
    id: 'ltr',
    title: 'Long-term rental',
    fields: [
      { id: 'rent', label: 'Monthly rent', unit: 'money', min: 0, max: 20_000, step: 50, def: 4_200, help: 'Check comparable rentals in your neighborhood.' },
      { id: 'vacancy', label: 'Vacancy', unit: 'pct', min: 0, max: 25, step: 1, def: 5, help: 'Share of the year with no tenant (about 2–3 weeks a year at 5%).' },
      { id: 'rentGrowth', label: 'Rent growth (yearly)', unit: 'pct', min: 0, max: 10, step: 0.25, def: 3.5, help: 'Washington’s 2025 rent law caps yearly increases for many rentals; check whether yours is exempt.', verify: true },
      { id: 'ltrMgmt', label: 'Property manager fee', unit: 'pct', min: 0, max: 15, step: 0.5, def: 9, help: 'Seattle managers typically charge 8–10% of collected rent. Only applies to the "property manager" option.' },
      { id: 'leasingFee', label: 'Leasing fee per new tenant', unit: 'pct', min: 0, max: 100, step: 5, def: 75, help: 'As a % of one month’s rent, charged each time the manager places a tenant.' },
      { id: 'tenantYears', label: 'Average tenant stay', unit: 'years', min: 0.5, max: 10, step: 0.5, def: 2, help: 'How often you’d pay the leasing fee.' },
      { id: 'ltrIns', label: 'Landlord insurance (yearly)', unit: 'money', min: 0, max: 15_000, step: 50, def: 2_000, help: 'A landlord (DP-3) policy replaces your homeowners policy. Placeholder: get a quote.', verify: true },
      { id: 'ltrUtilities', label: 'Utilities you pay (monthly)', unit: 'money', min: 0, max: 1_000, step: 10, def: 100, help: 'Often water/sewer/garbage if not passed to the tenant.' },
      { id: 'ltrMaint', label: 'Maintenance & repairs (yearly, % of value)', unit: 'pct', min: 0, max: 4, step: 0.1, def: 1, help: '1% of the home’s value per year is a common rule of thumb.' },
      { id: 'ltrFees', label: 'Rental registration & misc fees (yearly)', unit: 'money', min: 0, max: 2_000, step: 10, def: 150, help: 'Seattle requires rental registration (RRIO) and periodic inspections.', verify: true },
      { id: 'ltrHours', label: 'Your time if self-managing (hours/month)', unit: 'hours', min: 0, max: 40, step: 1, def: 4, help: 'Repairs, tenant calls, showings, paperwork.' },
    ],
  },
  {
    id: 'str',
    title: 'Airbnb / short-term rental',
    fields: [
      { id: 'nightly', label: 'Average nightly rate', unit: 'money', min: 0, max: 2_000, step: 5, def: 275, help: 'Look at similar listings nearby. Average across seasons; summer is much higher than winter.' },
      { id: 'occupancy', label: 'Occupancy', unit: 'pct', min: 0, max: 100, step: 1, def: 65, help: 'Share of nights booked across the year.' },
      { id: 'avgStay', label: 'Average stay', unit: 'num', min: 1, max: 30, step: 0.5, def: 3.5, help: 'Nights per booking. Shorter stays mean more cleanings.' },
      { id: 'cleanFee', label: 'Cleaning fee charged to guests', unit: 'money', min: 0, max: 500, step: 5, def: 150, help: 'Per booking.' },
      { id: 'cleanCost', label: 'What you pay the cleaner', unit: 'money', min: 0, max: 500, step: 5, def: 130, help: 'Per turnover, including laundry.' },
      { id: 'platformFee', label: 'Airbnb host fee', unit: 'pct', min: 0, max: 20, step: 0.5, def: 3, help: 'About 3% under the split-fee model; about 15% if you choose host-only fees.', verify: true },
      { id: 'strMgmt', label: 'Co-host / manager fee', unit: 'pct', min: 0, max: 40, step: 1, def: 25, help: 'Full-service managers usually take 20–30% of booking revenue. Only applies to the "co-host/manager" option.' },
      { id: 'strUtilities', label: 'Utilities, internet, streaming (monthly)', unit: 'money', min: 0, max: 2_000, step: 10, def: 450, help: 'You pay all utilities with a short-term rental.' },
      { id: 'supplies', label: 'Supplies & restocking (monthly)', unit: 'money', min: 0, max: 1_000, step: 10, def: 150, help: 'Toiletries, coffee, linens replacement.' },
      { id: 'furnish', label: 'Furnishing & setup (one time)', unit: 'money', min: 0, max: 150_000, step: 1000, def: 35_000, help: 'Your house is unfurnished: furniture, beds, linens, kitchen, smart lock, photos.' },
      { id: 'furnishReplace', label: 'Wear & replacement (yearly, % of furnishing)', unit: 'pct', min: 0, max: 30, step: 1, def: 10, help: 'Guests wear things out faster than you would.' },
      { id: 'strIns', label: 'Short-term rental insurance (yearly)', unit: 'money', min: 0, max: 20_000, step: 50, def: 3_500, help: 'A short-term rental policy or endorsement. Normal homeowners and landlord policies usually exclude it. Placeholder: get a quote.', verify: true },
      { id: 'cityNightTax', label: 'Seattle per-night short-term rental tax', unit: 'money', min: 0, max: 50, step: 1, def: 8, help: 'Seattle charges a per-night tax for whole-unit rentals. Set to 0 if the platform collects it from guests for you.', verify: true },
      { id: 'strLicense', label: 'Business & short-term rental licenses (yearly)', unit: 'money', min: 0, max: 2_000, step: 5, def: 150, help: 'Seattle short-term rental operator license plus city business license.', verify: true },
      { id: 'strMaint', label: 'Maintenance & repairs (yearly, % of value)', unit: 'pct', min: 0, max: 5, step: 0.1, def: 1.5, help: 'Higher than a long-term rental because of guest turnover.' },
      { id: 'strHours', label: 'Your time if self-managing (hours/month)', unit: 'hours', min: 0, max: 100, step: 1, def: 25, help: 'Messaging guests, coordinating cleaners, restocking, fixing things between stays.' },
      { id: 'strGrowth', label: 'Revenue growth (yearly)', unit: 'pct', min: -5, max: 10, step: 0.25, def: 3, help: 'How nightly rates change over time.' },
    ],
  },
  {
    id: 'rentalShared',
    title: 'Applies to both rental types',
    fields: [
      { id: 'makeReady', label: 'Make-ready cost before renting (one time)', unit: 'money', min: 0, max: 50_000, step: 500, def: 5_000, help: 'Paint, repairs, safety items (smoke/CO detectors), photos.' },
      { id: 'umbrella', label: 'Umbrella liability policy (yearly)', unit: 'money', min: 0, max: 5_000, step: 25, def: 450, help: 'A $1–2M umbrella on top of the property policy. Confirm it covers rentals (many exclude short-term rentals).', verify: true },
      { id: 'buildingShare', label: 'Building share of value', unit: 'pct', min: 10, max: 90, step: 1, def: 35, help: 'Only the building (not land) can be depreciated. Seattle land is expensive, so this is often 25–45%. Your tax assessment shows the split.' },
      { id: 'timeValue', label: 'Value of your time ($/hour)', unit: 'money', min: 0, max: 200, step: 5, def: 0, help: 'Leave at 0 to ignore. Set it to see self-managing with your time counted as a cost.' },
      { id: 'horizon', label: 'Years to compare', unit: 'years', min: 1, max: 20, step: 1, def: 10, help: 'The comparison looks this far ahead.' },
    ],
  },
];

export const FIELDS = Object.fromEntries(GROUPS.flatMap((g) => g.fields.map((f) => [f.id, f])));

export function defaultInputs() {
  return Object.fromEntries(Object.values(FIELDS).map((f) => [f.id, f.def]));
}

/** Convert display values (percent as 6.5) into the model the calculator expects (0.065). */
export function toModel(inputs) {
  const m = {};
  for (const f of Object.values(FIELDS)) {
    const v = Number(inputs[f.id]);
    const n = Number.isFinite(v) ? v : f.def;
    m[f.id] = f.unit === 'pct' ? n / 100 : n;
  }
  return m;
}

/** Keep only known inputs with numeric values; fill gaps with defaults. */
export function sanitizeInputs(raw) {
  const out = defaultInputs();
  if (raw && typeof raw === 'object') {
    for (const id of Object.keys(out)) {
      const v = Number(raw[id]);
      if (raw[id] !== undefined && raw[id] !== '' && Number.isFinite(v)) out[id] = v;
    }
  }
  return out;
}
