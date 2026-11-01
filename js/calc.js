// Core financial math for the House Move Planner.
// Pure functions only: no DOM access, so everything here is unit-tested in tests/.
// All rates are fractions (0.065 = 6.5%), money is in dollars, time in months unless noted.

// ---------- Mortgage basics ----------

/** Monthly principal + interest payment for a fully amortizing loan. */
export function monthlyPayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Remaining balance after `paid` monthly payments on a loan of `principal` over `months`. */
export function balanceAfter(principal, annualRate, months, paid) {
  if (principal <= 0) return 0;
  if (paid <= 0) return principal;
  if (paid >= months) return 0;
  const r = annualRate / 12;
  const pmt = monthlyPayment(principal, annualRate, months);
  if (r === 0) return Math.max(0, principal - pmt * paid);
  const f = Math.pow(1 + r, paid);
  return Math.max(0, principal * f - (pmt * (f - 1)) / r);
}

/** Apply graduated rates. tiers: [{ upTo, rate }], last tier upTo = Infinity. */
export function tieredTax(amount, tiers) {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of tiers) {
    if (amount <= lower) break;
    tax += (Math.min(amount, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
}

// ---------- Washington / Seattle taxes ----------

/** Washington real estate excise tax (state graduated + flat local), paid by the seller. */
export function reet(m, price) {
  const state = tieredTax(price, [
    { upTo: m.reetT1, rate: m.reetR1 },
    { upTo: m.reetT2, rate: m.reetR2 },
    { upTo: m.reetT3, rate: m.reetR3 },
    { upTo: Infinity, rate: m.reetR4 },
  ]);
  return state + price * m.reetLocal;
}

/** Washington capital gains tax on long-term gains from stocks (real estate is exempt). */
export function waCapGainsTax(totalGains, deduction) {
  const taxable = Math.max(0, totalGains - deduction);
  return taxable * 0.07 + Math.max(0, taxable - 1_000_000) * 0.029;
}

/** Taxes from selling `saleAmount` worth of stock from a holding with the given value/basis. */
export function stockSaleTax(m, saleAmount, stockValue = m.stockValue, stockBasis = m.stockBasis) {
  const sale = Math.max(0, Math.min(saleAmount, stockValue));
  const gainFrac = stockValue > 0 ? Math.max(0, (stockValue - stockBasis) / stockValue) : 0;
  const gain = sale * gainFrac;
  const federal = gain * (m.fedLTCG + m.niit);
  const wa = waCapGainsTax(gain + m.otherGains, m.waCgDeduction) - waCapGainsTax(m.otherGains, m.waCgDeduction);
  return { sale, gain, federal, wa, total: federal + wa };
}

/** Agent commission, other closing costs and excise tax when selling (staging/prep is separate). */
export function sellingCosts(m, price) {
  const commission = price * m.commission;
  const other = price * m.otherSellPct;
  const excise = reet(m, price);
  return { commission, other, excise, total: commission + other + excise };
}

/** Months after moving out that you can still sell with the home-sale exclusion (null if not eligible). */
export function exclusionDeadlineMonths(m) {
  // You need 2 years of living there within the 5 years before the sale.
  // If you lived there at least 2 years up to move-out, that holds until 3 years after move-out.
  return m.yearsLived >= 2 ? 36 : null;
}

/**
 * Federal tax on selling the current house.
 * accumDep: depreciation taken while it was a rental (taxed even when the exclusion applies).
 */
export function homeSaleTax(m, { price, costs, adjustedBasis, accumDep = 0, monthsSinceMoveOut = 0 }) {
  const gain = price - costs - adjustedBasis;
  const deadline = exclusionDeadlineMonths(m);
  const eligible = deadline !== null && monthsSinceMoveOut <= deadline;
  if (gain <= 0) return { gain, recapture: 0, excluded: 0, taxableGain: 0, tax: 0, eligible };
  const recapture = Math.min(gain, accumDep);
  const rest = gain - recapture;
  const excluded = eligible ? Math.min(rest, m.exclusionCap) : 0;
  const taxableGain = rest - excluded;
  const tax = recapture * Math.min(m.recapRate, m.marginal) + taxableGain * m.fedLTCG + (recapture + taxableGain) * m.niit;
  return { gain, recapture, excluded, taxableGain, tax, eligible };
}

// ---------- Homes ----------

export function currentHome(m) {
  const months = Math.round(m.curYearsLeft * 12);
  const pi = monthlyPayment(m.curBalance, m.curRate, months);
  const tax = m.curTax / 12;
  const ins = m.curIns / 12;
  const hoa = m.curHOA;
  const housing = pi + tax + ins + hoa; // what a lender counts
  return { months, pi, tax, ins, hoa, housing, carryWhileVacant: housing + m.vacantCost };
}

export function newHomeCosts(m, price, rate = m.newRate) {
  const down = price * m.downPct;
  const loan = price - down;
  const pi = monthlyPayment(loan, rate, Math.round(m.newTerm * 12));
  const tax = (price * m.newTaxRate) / 12;
  const ins = m.newIns / 12;
  const hoa = m.newHOA;
  const pmi = m.downPct < 0.2 ? (loan * m.pmiRate) / 12 : 0;
  const closing = price * m.closingPct;
  return { price, down, loan, closing, cashNeeded: down + closing, pi, tax, ins, hoa, pmi, total: pi + tax + ins + hoa + pmi };
}

/** Highest price whose full monthly housing cost fits within `monthlyBudget`. */
export function priceForBudget(m, monthlyBudget) {
  const perDollar = newHomeCosts(m, 1).total - (m.newIns / 12 + m.newHOA);
  const fixed = m.newIns / 12 + m.newHOA;
  if (perDollar <= 0) return 0;
  return Math.max(0, (monthlyBudget - fixed) / perDollar);
}

// ---------- Down payment funding ----------

/** Fund the down payment + closing with the gift, `stockSold`, and cash for the rest. */
export function fundingPlan(m, stockSold = m.stockSold) {
  const nh = newHomeCosts(m, m.newPrice);
  const need = nh.cashNeeded;
  const gift = Math.min(m.gift, need);
  const stock = Math.max(0, Math.min(stockSold, m.stockValue));
  const stockTax = stockSaleTax(m, stock);
  const cashUsed = Math.max(0, need - gift - stock);
  const extraFromStock = Math.max(0, gift + stock - need); // sold more stock than needed: stays as cash
  // Taxes on the stock sale are due later (next April) but are set aside from cash now.
  const cashAfter = m.cashSavings - cashUsed + extraFromStock - stockTax.total;

  // Long-term cost, assuming you rebuild savings/investments once the current house sells:
  // the tax paid now, plus growth the stock and cash would have earned while you wait for the sale,
  // all grown at the stock return to the end of the horizon.
  const H = m.horizon;
  const waitYears = Math.max(0, m.delay) / 12;
  const lostStockGrowth = stock * (Math.pow(1 + m.stockReturn, waitYears) - 1);
  const lostCashInterest = Math.min(cashUsed, m.cashSavings) * (Math.pow(1 + m.cashYield, waitYears) - 1);
  const longTermCost =
    stockTax.total * Math.pow(1 + m.stockReturn, H) +
    (lostStockGrowth + lostCashInterest) * Math.pow(1 + m.stockReturn, Math.max(0, H - waitYears));

  // Short-term: how many months of owning both homes the cash above the emergency fund covers.
  const cur = currentHome(m);
  const monthlyGap = cur.carryWhileVacant + nh.total - (m.takeHome - m.spending);
  const cushion = cashAfter - m.prepCost - m.emergencyTarget;
  const monthsCovered = monthlyGap <= 0 ? Infinity : Math.max(0, cushion / monthlyGap);
  return {
    need,
    down: nh.down,
    closing: nh.closing,
    gift,
    stockSold: stock,
    stockTax,
    cashUsed,
    cashAfter,
    shortfall: Math.max(0, cashUsed - m.cashSavings),
    aboveEmergency: cashAfter - m.emergencyTarget,
    stockLeft: m.stockValue - stock,
    lostStockGrowth,
    lostCashInterest,
    longTermCost,
    monthlyGap,
    cushion,
    monthsCovered,
  };
}

/** The three funding mixes compared on the Down payment tab. */
export function fundingMixes(m) {
  const nh = newHomeCosts(m, m.newPrice);
  const needAfterGift = Math.max(0, nh.cashNeeded - Math.min(m.gift, nh.cashNeeded));
  const spareCash = Math.max(0, m.cashSavings - m.emergencyTarget);
  // Cash first: spend cash down to the emergency fund, then sell stock (grossed up so the tax is covered too).
  let cashFirst = Math.max(0, needAfterGift - spareCash);
  for (let i = 0; i < 20 && cashFirst > 0; i++) {
    const p = fundingPlan(m, cashFirst);
    const gap = m.emergencyTarget - p.cashAfter;
    if (Math.abs(gap) < 1) break;
    cashFirst = Math.min(m.stockValue, Math.max(0, cashFirst + gap));
  }
  // Round the sale up to the next $100 so cash ends at or just above the emergency fund.
  cashFirst = Math.min(m.stockValue, Math.ceil(cashFirst / 100) * 100);
  const stockFirst = Math.min(m.stockValue, needAfterGift);
  return [
    { key: 'yours', name: 'Your mix', plan: fundingPlan(m, m.stockSold) },
    { key: 'cash', name: 'Cash first', plan: fundingPlan(m, cashFirst) },
    { key: 'stock', name: 'Stock first', plan: fundingPlan(m, stockFirst) },
  ];
}

// ---------- Affordability ----------

export function affordability(m) {
  const cur = currentHome(m);
  const gross = m.income / 12;
  const front = gross * m.frontRatio;
  const backAfter = gross * m.backRatio - m.debts;
  const backBefore = backAfter - cur.housing;
  const lenderBefore = Math.max(0, Math.min(front, backBefore));
  const lenderAfter = Math.max(0, Math.min(front, backAfter));
  const comfortBudget = m.takeHome - m.spending - m.savingsGoal;

  // Cash limit: everything you could bring (gift + cash + all stock after tax) minus the emergency fund.
  const allStockNet = m.stockValue - stockSaleTax(m, m.stockValue).total;
  const cashAvailable = m.gift + m.cashSavings + allStockNet - m.emergencyTarget;
  const cashPrice = Math.max(0, cashAvailable / (m.downPct + m.closingPct));

  const sel = newHomeCosts(m, m.newPrice);
  const dtiBefore = gross > 0 ? (m.debts + cur.housing + sel.total) / gross : 0;
  const dtiAfter = gross > 0 ? (m.debts + sel.total) / gross : 0;
  const housingRatio = gross > 0 ? sel.total / gross : 0;
  const rates = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => {
    const rate = Math.max(0, m.newRate + d);
    return { rate, total: newHomeCosts(m, m.newPrice, rate).total };
  });
  return {
    gross,
    lenderBeforeBudget: lenderBefore,
    lenderAfterBudget: lenderAfter,
    lenderBeforePrice: priceForBudget(m, lenderBefore),
    lenderAfterPrice: priceForBudget(m, lenderAfter),
    comfortBudget,
    comfortPrice: priceForBudget(m, comfortBudget),
    cashAvailable,
    cashPrice,
    selected: sel,
    dtiBefore,
    dtiAfter,
    housingRatio,
    rates,
    currentHousing: cur.housing,
  };
}

// ---------- Sale timing (month by month) ----------

/**
 * Simulate cash month by month while you own both homes.
 * delay: months after closing on the new house until the current house sells (Infinity = never).
 */
export function saleTiming(m, delay = m.delay, totalMonths) {
  const cur = currentHome(m);
  const nh = newHomeCosts(m, m.newPrice);
  const funding = fundingPlan(m);
  const T = totalMonths ?? Math.max(24, (Number.isFinite(delay) ? delay : 0) + 12);
  const rate = m.newRate;
  const r = rate / 12;
  const termMonths = Math.round(m.newTerm * 12);
  const otherNew = nh.tax + nh.ins + nh.hoa + nh.pmi;

  let cash = funding.cashAfter - m.prepCost;
  let newBal = nh.loan;
  let newPI = nh.pi;
  let sold = false;
  let sale = null;
  const rows = [{ month: 0, cash, newHousing: nh.total, oldHousing: 0, sold: false }];

  const sell = (month) => {
    const price = m.curValue * Math.pow(1 + m.priceChange, month / 12);
    const costs = sellingCosts(m, price);
    const payoff = balanceAfter(m.curBalance, m.curRate, cur.months, month);
    const tax = homeSaleTax(m, {
      price,
      costs: costs.total + m.prepCost,
      adjustedBasis: m.curPurchase + m.curImprovements,
      monthsSinceMoveOut: month,
    });
    const net = price - costs.total - payoff - tax.tax;
    cash += net;
    let recast = 0;
    if (m.recastPct > 0 && net > 0) {
      recast = Math.min(net * m.recastPct, Math.max(0, newBal - 1000));
      if (recast > 0) {
        newBal -= recast;
        cash -= recast + m.recastFee;
        newPI = monthlyPayment(newBal, rate, termMonths - month);
      }
    }
    sold = true;
    sale = { month, price, costs, payoff, tax, net, recast };
  };

  if (delay === 0) sell(0);
  rows[0].cash = cash;
  rows[0].sold = sold;

  let lowest = { month: 0, cash };
  let belowTarget = cash < m.emergencyTarget ? 0 : null;
  let runOut = cash < 0 ? 0 : null;
  for (let t = 1; t <= T; t++) {
    const oldHousing = sold ? 0 : cur.carryWhileVacant;
    const newHousing = newPI + otherNew;
    cash += m.takeHome - m.spending - newHousing - oldHousing;
    const interest = newBal * r;
    newBal = Math.max(0, newBal - (newPI - interest));
    if (!sold && t === delay) sell(t);
    rows.push({ month: t, cash, newHousing, oldHousing, sold });
    if (cash < lowest.cash) lowest = { month: t, cash };
    if (belowTarget === null && cash < m.emergencyTarget) belowTarget = t;
    if (runOut === null && cash < 0) runOut = t;
  }
  const paymentAfterRecast = newPI + otherNew;
  return {
    rows,
    T,
    sale,
    lowest,
    belowTarget,
    runOut,
    endCash: cash,
    paymentBothHomes: nh.total + cur.carryWhileVacant,
    paymentNewOnly: nh.total,
    paymentAfterRecast,
    monthlyCarry: cur.carryWhileVacant,
    carryTotal: cur.carryWhileVacant * (Number.isFinite(delay) ? delay : T),
  };
}

/** Compare several sale delays on a common timeline. */
export function compareDelays(m, delays) {
  const T = Math.max(24, ...delays.map((d) => d + 12));
  const base = saleTiming(m, 0, T);
  return delays.map((d) => {
    const s = saleTiming(m, d, T);
    return { delay: d, sim: s, costVsNow: base.endCash - s.endCash };
  });
}

/** Months until cash runs out if the house never sells (null = lasts the whole window). */
export function runwayIfUnsold(m, maxMonths = 120) {
  return saleTiming(m, Infinity, maxMonths).runOut;
}

// ---------- Keep vs sell (yearly, over the horizon) ----------

export const STRATEGIES = [
  { key: 'sell', name: 'Sell', kind: 'sell' },
  { key: 'ltrSelf', name: 'Rent, self-managed', kind: 'ltr', pro: false },
  { key: 'ltrPro', name: 'Rent, property manager', kind: 'ltr', pro: true },
  { key: 'strSelf', name: 'Airbnb, self-managed', kind: 'str', pro: false },
  { key: 'strPro', name: 'Airbnb, co-host/manager', kind: 'str', pro: true },
];

function depreciation(m, kind) {
  const basis = m.buildingShare * Math.min(m.curValue, m.curPurchase + m.curImprovements);
  // Long-term rentals: 27.5-year residential life. Short stays are "transient" use: 39 years.
  return basis / (kind === 'str' ? 39 : 27.5);
}

/** One year (1-based) of running the current house as a rental. */
export function rentalYear(m, strat, y) {
  const cur = currentHome(m);
  const inf = Math.pow(1 + m.inflation, y - 1);
  const valueStart = m.curValue * Math.pow(1 + m.appreciation, y - 1);
  const propTax = m.curTax * Math.pow(1 + m.propTaxGrowth, y - 1);
  const hoa = m.curHOA * 12 * inf;
  const maintRate = strat.kind === 'str' ? m.strMaint : m.ltrMaint;
  const maintenance = valueStart * maintRate;
  const lines = {};
  let revenue;
  let hours;
  if (strat.kind === 'ltr') {
    const g = Math.pow(1 + m.rentGrowth, y - 1);
    const gross = m.rent * 12 * g;
    revenue = gross * (1 - m.vacancy);
    lines.management = strat.pro ? revenue * m.ltrMgmt : 0;
    lines.leasing = strat.pro ? (m.rent * g * m.leasingFee) / Math.max(0.5, m.tenantYears) : 0;
    lines.cleaning = 0;
    lines.platform = 0;
    lines.insurance = (m.ltrIns + m.umbrella) * inf;
    lines.utilities = m.ltrUtilities * 12 * inf;
    lines.supplies = 0;
    lines.cityTax = 0;
    lines.fees = m.ltrFees * inf;
    hours = strat.pro ? 1 : m.ltrHours;
  } else {
    const g = Math.pow(1 + m.strGrowth, y - 1);
    const nights = 365 * m.occupancy;
    const stays = m.avgStay > 0 ? nights / m.avgStay : 0;
    revenue = (nights * m.nightly + stays * m.cleanFee) * g;
    lines.management = strat.pro ? revenue * m.strMgmt : 0;
    lines.leasing = 0;
    lines.cleaning = stays * m.cleanCost * inf;
    lines.platform = revenue * m.platformFee;
    lines.insurance = (m.strIns + m.umbrella) * inf;
    lines.utilities = m.strUtilities * 12 * inf;
    lines.supplies = (m.supplies * 12 + m.furnish * m.furnishReplace) * inf;
    lines.cityTax = nights * m.cityNightTax;
    lines.fees = m.strLicense * inf;
    hours = strat.pro ? 2 : m.strHours;
  }
  lines.maintenance = maintenance;
  lines.propertyTax = propTax;
  lines.hoa = hoa;
  const opex = Object.values(lines).reduce((a, b) => a + b, 0);

  const paidBefore = (y - 1) * 12;
  const balStart = balanceAfter(m.curBalance, m.curRate, cur.months, paidBefore);
  const balEnd = balanceAfter(m.curBalance, m.curRate, cur.months, paidBefore + 12);
  const monthsPaid = Math.max(0, Math.min(12, cur.months - paidBefore));
  const mortgagePI = cur.pi * monthsPaid;
  const interest = mortgagePI - (balStart - balEnd);

  const dep = depreciation(m, strat.kind);
  const furnDep = strat.kind === 'str' && y <= 5 ? m.furnish / 5 : 0;
  const taxable = revenue - opex - interest - dep - furnDep;
  // Rental losses usually can't offset wages at higher incomes, so losses are not credited (conservative).
  const incomeTax = Math.max(0, taxable) * m.marginal;
  const timeCost = hours * 12 * m.timeValue;
  const cashFlow = revenue - opex - mortgagePI - incomeTax - timeCost;
  return { year: y, revenue, lines, opex, mortgagePI, interest, depreciation: dep, taxable, incomeTax, hours, timeCost, cashFlow, balEnd };
}

/** Sell the rental at the end of year S. */
export function rentalSale(m, strat, S) {
  const cur = currentHome(m);
  const price = m.curValue * Math.pow(1 + m.appreciation, S);
  const costs = sellingCosts(m, price);
  const prep = m.prepCost * Math.pow(1 + m.inflation, S);
  const payoff = balanceAfter(m.curBalance, m.curRate, cur.months, S * 12);
  const accumDep = depreciation(m, strat.kind) * S;
  const tax = homeSaleTax(m, {
    price,
    costs: costs.total + prep,
    adjustedBasis: m.curPurchase + m.curImprovements - accumDep,
    accumDep,
    monthsSinceMoveOut: S * 12,
  });
  return { year: S, price, costs, prep, payoff, accumDep, tax, net: price - costs.total - prep - payoff - tax.tax };
}

/**
 * Value at year `atYear` of a strategy where the house is sold at year `sellYear`.
 * Yearly cash flows and sale money are invested at m.investReturn until `atYear`.
 */
export function strategyValue(m, strat, sellYear, atYear = sellYear) {
  const r = m.investReturn;
  if (strat.kind === 'sell') {
    const cur = currentHome(m);
    const d = m.delay;
    const price = m.curValue * Math.pow(1 + m.priceChange, d / 12);
    const costs = sellingCosts(m, price);
    const payoff = balanceAfter(m.curBalance, m.curRate, cur.months, d);
    const tax = homeSaleTax(m, {
      price,
      costs: costs.total + m.prepCost,
      adjustedBasis: m.curPurchase + m.curImprovements,
      monthsSinceMoveOut: d,
    });
    const carry = cur.carryWhileVacant * d;
    const net = price - costs.total - m.prepCost - payoff - tax.tax - carry;
    return { value: net * Math.pow(1 + r, Math.max(0, atYear - d / 12)), saleNet: net, saleTax: tax.tax, carry };
  }
  let account = -(m.makeReady + (strat.kind === 'str' ? m.furnish : 0));
  let year1 = null;
  for (let y = 1; y <= sellYear; y++) {
    const yr = rentalYear(m, strat, y);
    if (y === 1) year1 = yr;
    account = account * (1 + r) + yr.cashFlow;
  }
  const sale = rentalSale(m, strat, sellYear);
  account += sale.net;
  return { value: account * Math.pow(1 + r, Math.max(0, atYear - sellYear)), saleNet: sale.net, saleTax: sale.tax.tax, year1, sale };
}

export function keepVsSell(m) {
  const H = Math.max(1, Math.round(m.horizon));
  const deadline = exclusionDeadlineMonths(m);
  const windowYear = deadline === null ? null : Math.min(H, Math.floor(deadline / 12));
  return STRATEGIES.map((s) => {
    const atHorizon = strategyValue(m, s, H, H);
    const inWindow = s.kind !== 'sell' && windowYear ? strategyValue(m, s, windowYear, H) : null;
    const byYear = [];
    for (let y = 1; y <= H; y++) byYear.push(strategyValue(m, s, s.kind === 'sell' ? H : y, y).value);
    return {
      ...s,
      year1: s.kind === 'sell' ? null : rentalYear(m, s, 1),
      upfront: s.kind === 'sell' ? 0 : m.makeReady + (s.kind === 'str' ? m.furnish : 0),
      atHorizon,
      inWindow,
      byYear,
    };
  });
}

// ---------- Everything at once (used by the Compare tab) ----------

export function computeAll(m) {
  const afford = affordability(m);
  const funding = fundingPlan(m);
  const timing = saleTiming(m);
  const keep = keepVsSell(m);
  const best = keep.reduce((a, b) => (b.atHorizon.value > a.atHorizon.value ? b : a));
  return { afford, funding, timing, keep, best, runway: runwayIfUnsold(m) };
}
