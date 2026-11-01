# House Move Planner

A browser-only tool for planning a move: buy a new house, then **sell, rent, or Airbnb** the current one.
It has no server. Your numbers are saved only in your own browser and in files you export.

## What it does

| Tab | Answers |
|---|---|
| **1. Our numbers** | All shared inputs: income, savings, stock, family gift, current house, new house, selling costs, taxes, growth. |
| **2. Affordability** | Lender max price *before* the current house sells (both mortgages counted, no rental income) and *after*; a "comfortable" price from take-home pay; the cash limit; monthly cost breakdown; debt ratios; rate sensitivity. |
| **3. Down payment** | Mix of family gift, stock sale and cash. Federal + Washington capital gains tax on the stock, cash left vs. emergency fund, months you can carry both homes (short term), and tax + missed growth (long term). Compares *Your mix*, *Cash first* and *Stock first*. |
| **4. Sale timing** | Month-by-month cash while you own both homes; how 0/3/6/12-month sale delays change payments, lowest cash and total cost; sale proceeds (commission, WA + Seattle excise tax, payoff, gain exclusion); recast to lower the new payment; how long cash lasts if it never sells. |
| **5. Keep vs sell** | 10-year comparison of Sell, long-term rental (self-managed / property manager) and Airbnb (self-managed / co-host). Year-1 monthly cash flow, the 3-year tax-free sale window, depreciation recapture, furnishing costs, landlord vs. short-term-rental insurance, and Seattle rules. |
| **6. Compare** | Save named scenarios and compare them side by side. |

Every input has a slider and a box you can type into, plus a plain-English explanation.
Values marked **verify** are tax rules or local rates to confirm with your lender, CPA, agent or insurer.

## Saving and sharing

- Changes save automatically in this browser (local storage).
- **Export file** downloads a `.json` with your inputs and saved scenarios. **Import file** loads one,
  so you can pass the file to your partner's laptop.
- Exported files (`house-plan-*.json`) are git-ignored so they don't get committed to this public repo by accident.

## Publishing with GitHub Pages

1. Merge this branch into `main` (or pick this branch in step 3).
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/FinancialPlanner/`.

Free GitHub Pages hosting requires the repository to be public. That's safe here: the repo only contains code, and no one's numbers are stored in it.

## Running locally

Open `index.html` through any static server (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. Charts load Chart.js from a CDN; without internet the tables still work.

## Tests

The financial math lives in `js/calc.js` (pure functions) and is covered by `tests/calc.test.js`:

```bash
npm test
```

GitHub Actions runs the tests on every push.

## Simplifications

- Married filing jointly; the $500k home-sale exclusion applies if you lived there 2+ years, and lasts until 3 years after you move out.
- Rental losses are not credited against wages (conservative at higher incomes). Short-term rentals depreciate over 39 years, long-term over 27.5.
- Money from selling the house, and rental cash flow, is assumed to be invested at one rate. Set that rate to your mortgage rate to model paying down the mortgage instead.
- Stock taxes are set aside from cash at closing even though they're due next April.

This is a planning aid, not financial, tax or legal advice.
