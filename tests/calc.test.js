import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyPayment, balanceAfter, tieredTax, reet, waCapGainsTax, stockSaleTax, homeSaleTax,
  newHomeCosts, priceForBudget, fundingPlan, fundingMixes, affordability, saleTiming,
  compareDelays, runwayIfUnsold, keepVsSell, rentalYear, STRATEGIES, computeAll,
} from '../js/calc.js';
import { defaultInputs, toModel, sanitizeInputs } from '../js/inputs.js';

const near = (actual, expected, tol = 0.01, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);

const base = () => toModel(defaultInputs());

test('monthly payment matches standard amortization', () => {
  near(monthlyPayment(300_000, 0.06, 360), 1798.65, 0.01);
  near(monthlyPayment(1_040_000, 0.0625, 360), 6403.46, 0.01);
  near(monthlyPayment(120_000, 0, 120), 1000, 1e-9);
  assert.equal(monthlyPayment(0, 0.05, 360), 0);
});

test('balance after payments', () => {
  near(balanceAfter(300_000, 0.06, 360, 0), 300_000, 1e-6);
  near(balanceAfter(300_000, 0.06, 360, 360), 0, 1e-6);
  // After 1 payment: 300000 + 1500 interest - 1798.65
  near(balanceAfter(300_000, 0.06, 360, 1), 299_701.35, 0.01);
  // Matches iterating month by month
  let bal = 300_000;
  const pmt = monthlyPayment(300_000, 0.06, 360);
  for (let i = 0; i < 60; i++) bal -= pmt - bal * 0.005;
  near(balanceAfter(300_000, 0.06, 360, 60), bal, 0.01);
});

test('tiered tax', () => {
  const tiers = [{ upTo: 100, rate: 0.1 }, { upTo: Infinity, rate: 0.2 }];
  near(tieredTax(50, tiers), 5, 1e-9);
  near(tieredTax(150, tiers), 20, 1e-9);
});

test('Washington + Seattle excise tax on a $1M sale', () => {
  const m = base();
  // 525,000 * 1.1% + 475,000 * 1.28% + 1,000,000 * 0.5%
  near(reet(m, 1_000_000), 5775 + 6080 + 5000, 0.01);
  near(reet(m, 400_000), 4400 + 2000, 0.01);
});

test('Washington capital gains tax', () => {
  assert.equal(waCapGainsTax(200_000, 278_000), 0);
  near(waCapGainsTax(378_000, 278_000), 7000, 1e-6);
  // 9.9% on the part of taxable gains above $1M
  near(waCapGainsTax(1_278_000 + 100_000, 278_000), 1_100_000 * 0.07 + 100_000 * 0.029, 1e-6);
});

test('stock sale tax uses proportional gain', () => {
  const m = { ...base(), fedLTCG: 0.15, niit: 0, otherGains: 0, waCgDeduction: 278_000 };
  const t = stockSaleTax(m, 100_000, 200_000, 120_000);
  near(t.gain, 40_000, 1e-6);
  near(t.federal, 6_000, 1e-6);
  assert.equal(t.wa, 0);
  // Loss positions owe nothing
  assert.equal(stockSaleTax(m, 50_000, 100_000, 150_000).total, 0);
  // Other gains already use up the WA deduction
  const t2 = stockSaleTax({ ...m, otherGains: 300_000 }, 100_000, 200_000, 120_000);
  near(t2.wa, 40_000 * 0.07, 1e-6);
});

test('home sale exclusion, window, and depreciation recapture', () => {
  const m = { ...base(), yearsLived: 3, exclusionCap: 500_000, fedLTCG: 0.15, niit: 0, recapRate: 0.25, marginal: 0.24 };
  const inWindow = homeSaleTax(m, { price: 1_400_000, costs: 100_000, adjustedBasis: 700_000, accumDep: 40_000, monthsSinceMoveOut: 36 });
  near(inWindow.gain, 600_000, 1e-6);
  near(inWindow.recapture, 40_000, 1e-6);
  near(inWindow.excluded, 500_000, 1e-6);
  near(inWindow.tax, 40_000 * 0.24 + 60_000 * 0.15, 1e-6); // recapture capped at bracket
  const outside = homeSaleTax(m, { price: 1_400_000, costs: 100_000, adjustedBasis: 700_000, accumDep: 40_000, monthsSinceMoveOut: 48 });
  assert.equal(outside.eligible, false);
  near(outside.tax, 40_000 * 0.24 + 560_000 * 0.15, 1e-6);
  const lived1 = homeSaleTax({ ...m, yearsLived: 1 }, { price: 1_000_000, costs: 0, adjustedBasis: 900_000, monthsSinceMoveOut: 0 });
  assert.equal(lived1.eligible, false);
  const loss = homeSaleTax(m, { price: 800_000, costs: 60_000, adjustedBasis: 900_000 });
  assert.equal(loss.tax, 0);
});

test('new home costs and PMI', () => {
  const m = base();
  const c = newHomeCosts(m, 1_000_000);
  near(c.down, 200_000, 1e-6);
  assert.equal(c.pmi, 0);
  const low = newHomeCosts({ ...m, downPct: 0.1, pmiRate: 0.006 }, 1_000_000);
  near(low.pmi, 900_000 * 0.006 / 12, 1e-6);
});

test('priceForBudget inverts newHomeCosts', () => {
  const m = base();
  const p = priceForBudget(m, 8_000);
  near(newHomeCosts(m, p).total, 8_000, 0.01);
  assert.equal(priceForBudget(m, 0), 0);
});

test('funding plan: gift first, stock, then cash; tax set aside', () => {
  const m = base();
  const f = fundingPlan(m, 100_000);
  const need = m.newPrice * 0.2 + m.newPrice * 0.015;
  near(f.need, need, 1e-6);
  near(f.cashUsed, need - 50_000 - 100_000, 1e-6);
  near(f.cashAfter, m.cashSavings - f.cashUsed - f.stockTax.total, 1e-6);
  // Selling more stock than needed leaves the extra as cash
  const rich = { ...m, stockValue: 500_000, stockBasis: 300_000 };
  const big = fundingPlan(rich, need + 10_000);
  assert.equal(big.cashUsed, 0);
  near(big.cashAfter, rich.cashSavings + 50_000 + 10_000 - big.stockTax.total, 1e-6);
  // Can't sell more stock than you own
  assert.equal(fundingPlan(m, 10_000_000).stockSold, m.stockValue);
});

test('cash-first mix lands on the emergency fund when stock can cover it', () => {
  const m = base();
  const mixes = fundingMixes(m);
  const cash = mixes.find((x) => x.key === 'cash').plan;
  assert.ok(cash.cashAfter >= m.emergencyTarget && cash.cashAfter < m.emergencyTarget + 100);
  const stock = mixes.find((x) => x.key === 'stock').plan;
  assert.ok(stock.stockTax.total >= cash.stockTax.total);
  // More stock sold = more tax and missed growth over the long term, but a bigger cash cushion now
  assert.ok(stock.longTermCost > cash.longTermCost);
  assert.ok(stock.monthsCovered > cash.monthsCovered);
});

test('affordability: owning both homes lowers what a lender allows', () => {
  const a = affordability(base());
  assert.ok(a.lenderBeforePrice < a.lenderAfterPrice);
  near(a.lenderAfterBudget, Math.min(250_000 / 12 * 0.33, 250_000 / 12 * 0.45 - 800), 1e-6);
});

test('sale timing: waiting costs carrying payments, recast lowers payment', () => {
  const m = base();
  const now = saleTiming(m, 0, 24);
  const later = saleTiming(m, 6, 24);
  assert.ok(later.endCash < now.endCash);
  assert.ok(now.paymentAfterRecast < now.paymentNewOnly);
  const noRecast = saleTiming({ ...m, recastPct: 0 }, 0, 24);
  near(noRecast.paymentAfterRecast, noRecast.paymentNewOnly, 1e-6);
  // The month the house sells, cash jumps by roughly the net proceeds
  const s = saleTiming({ ...m, recastPct: 0 }, 3, 24);
  assert.equal(s.sale.month, 3);
  assert.ok(s.rows[3].cash - s.rows[2].cash > 300_000);
  // Before the sale, each month includes the old house's carrying costs
  assert.ok(s.rows[1].oldHousing > 0);
  assert.equal(s.rows[4].oldHousing, 0);
});

test('compare delays and runway', () => {
  const m = base();
  const c = compareDelays(m, [0, 3, 6, 12]);
  assert.equal(c[0].costVsNow, 0);
  assert.ok(c[3].costVsNow > c[1].costVsNow);
  const r = runwayIfUnsold(m);
  assert.ok(r === null || r > 0);
});

test('rental year cash flows are internally consistent', () => {
  const m = base();
  for (const s of STRATEGIES.filter((x) => x.kind !== 'sell')) {
    const y = rentalYear(m, s, 1);
    near(y.cashFlow, y.revenue - y.opex - y.mortgagePI - y.incomeTax - y.timeCost, 1e-6);
    assert.ok(y.interest > 0 && y.interest < y.mortgagePI);
  }
  const self = rentalYear(m, STRATEGIES[3], 1);
  const pro = rentalYear(m, STRATEGIES[4], 1);
  assert.equal(self.lines.management, 0);
  assert.ok(pro.lines.management > 0);
});

test('keep vs sell returns every strategy over the horizon', () => {
  const k = keepVsSell(base());
  assert.equal(k.length, 5);
  for (const s of k) {
    assert.equal(s.byYear.length, 10);
    assert.ok(Number.isFinite(s.atHorizon.value));
    near(s.byYear[9], s.atHorizon.value, 1e-6, s.key);
  }
  // Selling a rental inside the 3-year window can't owe more sale tax than selling it in year 10
  const ltr = k.find((s) => s.key === 'ltrSelf');
  assert.ok(ltr.inWindow.saleTax <= ltr.atHorizon.saleTax);
});

test('computeAll and input sanitizing', () => {
  const all = computeAll(base());
  assert.ok(all.best && all.best.key);
  const s = sanitizeInputs({ income: '300000', bogus: 5, rent: 'abc' });
  assert.equal(s.income, 300000);
  assert.equal(s.rent, defaultInputs().rent);
  assert.equal(s.bogus, undefined);
});
