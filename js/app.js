import { GROUPS, FIELDS, defaultInputs, toModel, sanitizeInputs } from './inputs.js';
import * as C from './calc.js';

const STORE_KEY = 'house-move-planner.v1';
const TABS = ['numbers', 'afford', 'funding', 'timing', 'keep', 'compare'];
const state = { inputs: defaultInputs(), scenarios: [], tab: 'numbers' };
const charts = {};

// ---------- Formatting ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function money(v, { sign = false } = {}) {
  if (!Number.isFinite(v)) return '—';
  const s = Math.round(Math.abs(v)).toLocaleString('en-US');
  if (v <= -0.5) return `−$${s}`;
  return `${sign && v >= 0.5 ? '+' : ''}$${s}`;
}
function moneyK(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${Math.round(a)}`;
}
const pct = (f, d = 1) => `${(f * 100).toFixed(d)}%`;
const cls = (v) => (v < -0.5 ? ' class="neg"' : '');
const monthsText = (n) => (n === 1 ? '1 month' : `${n} months`);
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function fmtField(f, v) {
  if (!Number.isFinite(v)) return '';
  if (f.unit === 'money') return Math.round(v * 100) / 100 === Math.round(v) ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US');
  return String(Math.round(v * 1000) / 1000);
}
function parseNum(s) {
  const cleaned = String(s).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ---------- Storage ----------

function sanitizeScenarios(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s === 'object' && s.inputs)
    .map((s, i) => ({
      id: String(s.id ?? `s${Date.now()}${i}`),
      name: String(s.name ?? `Scenario ${i + 1}`).slice(0, 80),
      savedAt: String(s.savedAt ?? ''),
      inputs: sanitizeInputs(s.inputs),
    }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    state.inputs = sanitizeInputs(d.inputs);
    state.scenarios = sanitizeScenarios(d.scenarios);
    if (TABS.includes(d.tab)) state.tab = d.tab;
  } catch {
    /* storage unavailable or corrupt: start from defaults */
  }
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const el = document.getElementById('save-state');
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ inputs: state.inputs, scenarios: state.scenarios, tab: state.tab }));
      el.textContent = 'Saved in this browser';
    } catch {
      el.textContent = 'Browser storage unavailable: use Export to keep your numbers';
    }
  }, 250);
}

// ---------- Inputs ----------

let uid = 0;
function fieldHTML(f) {
  const id = `f-${f.id}-${++uid}`;
  const pre = f.unit === 'money' ? '$' : '';
  const suf = { pct: '%', years: 'yrs', months: 'mo', hours: 'hrs' }[f.unit] ?? '';
  return `<div class="field" data-field="${f.id}">
    <div class="field-label"><label for="${id}">${esc(f.label)}</label>${f.verify ? '<span class="verify-tag" title="Worth confirming for your situation">verify</span>' : ''}</div>
    <div class="field-row">
      <input type="range" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${esc(f.label)} (slider)">
      <div class="num">${pre ? `<span aria-hidden="true">${pre}</span>` : ''}<input id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false">${suf ? `<span aria-hidden="true">${suf}</span>` : ''}</div>
    </div>
    ${f.help ? `<p class="help">${esc(f.help)}</p>` : ''}
  </div>`;
}
function cardHTML(title, fields, collapsed) {
  const body = fields.map(fieldHTML).join('');
  return collapsed
    ? `<details class="card"><summary>${esc(title)}</summary>${body}</details>`
    : `<section class="card"><h3>${esc(title)}</h3>${body}</section>`;
}
function mountInputs() {
  document.querySelectorAll('[data-groups]').forEach((el) => {
    const collapsed = el.dataset.collapsed === 'true';
    el.innerHTML = el.dataset.groups
      .split(',')
      .map((gid) => GROUPS.find((g) => g.id === gid))
      .filter(Boolean)
      .map((g) => cardHTML(g.title, g.fields, collapsed))
      .join('');
  });
  document.querySelectorAll('[data-fields]').forEach((el) => {
    const [title, list] = el.dataset.fields.split(':');
    const fields = list.split(',').map((id) => FIELDS[id]).filter(Boolean);
    el.innerHTML = cardHTML(title, fields, false);
  });
  Object.keys(FIELDS).forEach((id) => syncField(id));
}
function syncField(id, except) {
  const f = FIELDS[id];
  const v = state.inputs[id];
  document.querySelectorAll(`.field[data-field="${id}"]`).forEach((el) => {
    const range = el.querySelector('input[type="range"]');
    const text = el.querySelector('input[type="text"]');
    if (range !== except) range.value = String(Math.min(f.max, Math.max(f.min, v)));
    if (text !== except && text !== document.activeElement) text.value = fmtField(f, v);
  });
}
function onInput(e) {
  const fieldEl = e.target.closest('.field[data-field]');
  if (!fieldEl) return;
  const id = fieldEl.dataset.field;
  const v = e.target.type === 'range' ? Number(e.target.value) : parseNum(e.target.value);
  if (v === null || !Number.isFinite(v)) return;
  state.inputs[id] = v;
  syncField(id, e.target);
  save();
  scheduleRender();
}
function onBlur(e) {
  const fieldEl = e.target.closest?.('.field[data-field]');
  if (!fieldEl || e.target.type !== 'text') return;
  const f = FIELDS[fieldEl.dataset.field];
  e.target.value = fmtField(f, state.inputs[f.id]);
}

// ---------- Tabs & render loop ----------

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs [role="tab"]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = p.id !== `tab-${tab}`));
  save();
  render();
}
let renderTimer;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 90);
}
function render() {
  const m = toModel(state.inputs);
  try {
    if (state.tab === 'afford') renderAfford(m);
    if (state.tab === 'funding') renderFunding(m);
    if (state.tab === 'timing') renderTiming(m);
    if (state.tab === 'keep') renderKeep(m);
    if (state.tab === 'compare') renderCompare();
  } catch (err) {
    console.error(err);
  }
}

// ---------- Shared UI pieces ----------

const tile = (label, value, note = '', extra = '') =>
  `<div class="tile ${extra}"><div class="t-label">${label}</div><div class="t-value">${value}</div>${note ? `<p class="t-note">${note}</p>` : ''}</div>`;
const ICONS = { good: '✓', warn: '!', bad: '✕', info: 'i' };
const LABELS = { good: 'Good:', warn: 'Heads up:', bad: 'Problem:', info: '' };
const callout = (tone, html) =>
  `<div class="callout ${tone}"><span class="icon" aria-hidden="true">${ICONS[tone]}</span><div><p>${LABELS[tone] ? `<strong class="status">${LABELS[tone]}</strong>` : ''}${html}</p></div></div>`;
const card = (title, body, extra = '') => `<section class="card ${extra}">${title ? `<h3>${title}</h3>` : ''}${body}</section>`;
const legend = (items) =>
  `<div class="legend">${items.map((i) => `<span><span class="sw ${i.kind ?? ''}" style="background:${i.color}"></span>${esc(i.label)}</span>`).join('')}</div>`;
function stackBar(parts) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  const bar = parts
    .filter((p) => p.value > 0)
    .map((p) => `<span style="width:${(p.value / total) * 100}%;background:${p.color}" title="${esc(p.label)}: ${money(p.value)}"></span>`)
    .join('');
  return `<div class="stackbar" role="img" aria-label="${esc(parts.map((p) => `${p.label} ${money(p.value)}`).join(', '))}">${bar}</div>${legend(
    parts.filter((p) => p.value > 0).map((p) => ({ label: `${p.label} ${money(p.value)}`, color: p.color })),
  )}`;
}
const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5'];

function lineChart(key, canvasId, { labels, datasets, xTitle, vline }) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!window.Chart) {
    canvas.parentElement.innerHTML = '<p class="chart-fallback">The chart library could not load (are you offline?). The table below has the same numbers.</p>';
    return;
  }
  const muted = cssVar('--muted');
  const plugins = [];
  if (vline) {
    plugins.push({
      id: 'vline',
      afterDatasetsDraw(chart) {
        const x = chart.scales.x.getPixelForValue(vline.index);
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = cssVar('--ink-2');
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(vline.label, x + 6, top + 14);
        ctx.restore();
      },
    });
  }
  charts[key] = new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 12, left: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cssVar('--surface'),
          titleColor: cssVar('--ink'),
          bodyColor: cssVar('--ink-2'),
          borderColor: cssVar('--axis'),
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: {
          title: { display: !!xTitle, text: xTitle, color: muted },
          grid: { display: false },
          ticks: { color: muted, maxRotation: 0, autoSkipPadding: 12 },
          border: { color: cssVar('--axis') },
        },
        y: {
          ticks: { color: muted, callback: (v) => moneyK(v) },
          grid: { color: cssVar('--grid') },
          border: { display: false },
        },
      },
    },
    plugins,
  });
}
const lineDataset = (label, data, colorVar, extra = {}) => ({
  label,
  data,
  borderColor: cssVar(colorVar),
  backgroundColor: cssVar(colorVar),
  borderWidth: 2,
  pointRadius: 0,
  pointHoverRadius: 5,
  pointHoverBorderWidth: 2,
  pointHoverBorderColor: cssVar('--chart-surface'),
  tension: 0,
  ...extra,
});

// ---------- Tab 2: Affordability ----------

function renderAfford(m) {
  const a = C.affordability(m);
  const sel = a.selected;
  const price = m.newPrice;
  const limits = [
    { lbl: 'Lender max while you still own your current house', v: a.lenderBeforePrice },
    { lbl: 'Lender max after your current house sells', v: a.lenderAfterPrice },
    { lbl: 'Comfortable for your monthly budget', v: a.comfortPrice },
    { lbl: 'Cash limit (down payment + closing)', v: a.cashPrice },
  ];
  const scale = Math.max(price, ...limits.map((l) => l.v)) * 1.08 || 1;
  const ladder = `<div class="ladder">${limits
    .map(
      (l) => `<div class="ladder-row"><span class="lbl">${l.lbl}</span>
      <div class="ladder-track"><div class="ladder-bar" style="width:${(l.v / scale) * 100}%"></div><div class="ladder-marker" style="left:${(price / scale) * 100}%"></div></div>
      <span class="val">${moneyK(l.v)}</span></div>`,
    )
    .join('')}</div><div class="ladder-legend"><span class="mk"></span> The house you entered: ${money(price)}</div>`;

  const msgs = [];
  if (price <= a.lenderBeforePrice) msgs.push(callout('good', `A lender should approve ${money(price)} even before your current house sells (based on income and debt ratios).`));
  else if (price <= a.lenderAfterPrice)
    msgs.push(
      callout(
        'warn',
        `${money(price)} qualifies only <em>after</em> your current house sells. Until it is sold (some lenders accept “under contract”), lenders count both mortgages. Options: buy once your sale is pending, make your offer contingent on selling, or ask your lender how they treat a pending sale.`,
      ),
    );
  else msgs.push(callout('bad', `${money(price)} is above what lenders typically allow for this income and debt, even after your current house sells. The max is about ${money(a.lenderAfterPrice)}.`));
  if (price <= a.comfortPrice)
    msgs.push(callout('good', `The monthly cost (${money(sel.total)}) fits your budget and still leaves your ${money(m.savingsGoal)}/month savings goal.`));
  else
    msgs.push(
      callout(
        'warn',
        `The monthly cost (${money(sel.total)}) is ${money(sel.total - a.comfortBudget)} over your comfortable housing budget of ${money(a.comfortBudget)}/month (take-home minus spending minus savings goal).`,
      ),
    );
  if (price > a.cashPrice)
    msgs.push(callout('bad', `You don’t have enough for ${pct(m.downPct, 0)} down + closing (${money(sel.cashNeeded)}) without dipping into your emergency fund, even after selling all your stock.`));

  const frontLimit = m.frontRatio;
  const backLimit = m.backRatio;
  const ratioRow = (name, val, limit) =>
    `<tr><td>${name}</td><td>${pct(val)}</td><td>${pct(limit, 0)}</td><td>${val <= limit ? '<span class="muted">✓ within limit</span>' : '<span class="neg">✕ over limit</span>'}</td></tr>`;
  const bindingAfter = a.gross * m.frontRatio <= a.gross * m.backRatio - m.debts ? 'the housing-cost ratio' : 'the total-debt ratio';

  document.getElementById('res-afford').innerHTML = `
    <div class="section-title"><h2>What can we afford?</h2></div>
    <p class="lead">Four different limits. The lowest one that matters to you is your real budget.</p>
    <div class="tiles">
      ${tile('Lender max, before selling', moneyK(a.lenderBeforePrice), `Housing budget ${money(a.lenderBeforeBudget)}/mo, with your current house counted`)}
      ${tile('Lender max, after selling', moneyK(a.lenderAfterPrice), `Housing budget ${money(a.lenderAfterBudget)}/mo; limited by ${bindingAfter}`)}
      ${tile('Comfortable price', moneyK(a.comfortPrice), `Housing budget ${money(a.comfortBudget)}/mo from your take-home pay`)}
      ${tile('Cash limit', moneyK(a.cashPrice), `${money(a.cashAvailable)} available for ${pct(m.downPct, 0)} down + closing`)}
    </div>
    ${card('Price limits vs. the house you entered', ladder)}
    ${msgs.join('')}
    <div class="two-col">
      ${card(
        `Monthly cost at ${money(price)}`,
        `${stackBar([
          { label: 'Principal & interest', value: sel.pi, color: cssVar('--series-1') },
          { label: 'Property tax', value: sel.tax, color: cssVar('--series-2') },
          { label: 'Insurance', value: sel.ins, color: cssVar('--series-3') },
          { label: 'HOA', value: sel.hoa, color: cssVar('--series-4') },
          { label: 'PMI', value: sel.pmi, color: cssVar('--series-5') },
        ])}
        <table class="data"><tbody>
          <tr><td>Loan amount</td><td>${money(sel.loan)}</td></tr>
          <tr><td>Down payment (${pct(m.downPct, 0)})</td><td>${money(sel.down)}</td></tr>
          <tr><td>Closing costs</td><td>${money(sel.closing)}</td></tr>
          <tr class="total"><td>Monthly housing cost</td><td>${money(sel.total)}</td></tr>
        </tbody></table>
        ${m.downPct < 0.2 ? '<p class="help">Under 20% down: PMI is included until you reach 20% equity.</p>' : ''}`,
      )}
      ${card(
        'Lender ratios at this price',
        `<table class="data"><thead><tr><th>Ratio</th><th>You</th><th>Limit</th><th></th></tr></thead><tbody>
          ${ratioRow('Housing cost ÷ gross income', a.housingRatio, frontLimit)}
          ${ratioRow('All debts ÷ gross income, before selling', a.dtiBefore, backLimit)}
          ${ratioRow('All debts ÷ gross income, after selling', a.dtiAfter, backLimit)}
        </tbody></table>
        <p class="help">Before selling, the lender adds your current house’s ${money(a.currentHousing)}/mo (mortgage, tax, insurance, HOA). As you asked, no rental income is counted.</p>
        <h4 style="margin-top:14px">If rates move</h4>
        <table class="data"><thead><tr><th>Rate</th><th>Monthly cost</th><th>Change</th></tr></thead><tbody>
          ${a.rates
            .map(
              (r) =>
                `<tr${Math.abs(r.rate - m.newRate) < 1e-9 ? ' class="selected"' : ''}><td>${pct(r.rate, 3).replace(/0+%$/, '%').replace(/\.%$/, '%')}</td><td>${money(r.total)}</td><td>${money(r.total - sel.total, { sign: true })}</td></tr>`,
            )
            .join('')}
        </tbody></table>`,
      )}
    </div>
    ${card(
      'How these limits work',
      `<ul class="notes">
        <li><strong>Lender max</strong> uses two ratios of your <em>gross</em> income: housing cost (≤ ${pct(m.frontRatio, 0)}) and all debt payments including housing (≤ ${pct(m.backRatio, 0)}). Adjust them in the panel on the left. A lender pre-approval gives the real answer.</li>
        <li><strong>Comfortable</strong> uses your <em>take-home</em> pay: ${money(m.takeHome)} − ${money(m.spending)} spending − ${money(m.savingsGoal)} savings = ${money(a.comfortBudget)} for housing.</li>
        <li><strong>Cash limit</strong> = gift + cash + all stock after taxes − emergency fund, divided by the down payment % plus closing %. The Down payment tab shows the best mix.</li>
        <li>Large loans may be “jumbo” (above the King County conforming limit), which can have different rates and reserve requirements. Ask your lender.</li>
      </ul>`,
    )}`;
}

// ---------- Tab 3: Down payment mix ----------

function renderFunding(m) {
  const mixes = C.fundingMixes(m);
  const f = mixes[0].plan;
  const H = m.horizon;
  const msgs = [];
  if (f.shortfall > 0) msgs.push(callout('bad', `You are ${money(f.shortfall)} short of the ${money(f.need)} needed at closing. Sell more stock, lower the price, or put less down.`));
  else if (f.cashAfter < m.emergencyTarget)
    msgs.push(callout('warn', `Cash after closing (${money(f.cashAfter)}, with stock taxes set aside) is below your ${money(m.emergencyTarget)} emergency fund.`));
  else msgs.push(callout('good', `After closing you keep ${money(f.cashAfter)} in cash, ${money(f.aboveEmergency)} above your emergency fund.`));
  if (m.stockSold > m.stockValue) msgs.push(callout('info', `You entered more stock than you own; the plan uses all ${money(m.stockValue)}.`));
  if (f.gift + f.stockSold > f.need) msgs.push(callout('info', `The gift and stock sale cover more than the ${money(f.need)} needed; the extra stays in cash.`));

  const covered = (p) => (p.monthsCovered === Infinity ? 'No limit' : p.monthsCovered < 1 ? 'Under 1 month' : `${p.monthsCovered.toFixed(1)} months`);
  const minCost = Math.min(...mixes.map((x) => x.plan.longTermCost));
  const maxCover = Math.max(...mixes.map((x) => x.plan.monthsCovered));
  const row = (label, fn, best) =>
    `<tr><td>${label}</td>${mixes.map((x) => `<td${best && best(x.plan) ? ' class="best"' : ''}>${fn(x.plan)}</td>`).join('')}</tr>`;

  document.getElementById('res-funding').innerHTML = `
    <div class="section-title"><h2>Paying for the down payment</h2></div>
    <p class="lead">The gift is used first, then the stock you choose to sell; cash covers the rest. Selling stock has a tax cost and gives up growth. Using cash leaves a thinner cushion while you own both houses.</p>
    <div class="tiles">
      ${tile('Needed at closing', money(f.need), `${money(f.down)} down + ${money(f.closing)} closing costs`)}
      ${tile('Tax on the stock sale', money(f.stockTax.total), `Federal ${money(f.stockTax.federal)} · Washington ${money(f.stockTax.wa)}. Due next April; set aside now.`)}
      ${tile('Cash left after closing', money(f.cashAfter), `Emergency fund target ${money(m.emergencyTarget)}`, f.cashAfter < m.emergencyTarget ? '' : 'highlight')}
      ${tile('Months you can carry both homes', covered(f), `Cash above your emergency fund ÷ ${money(Math.max(0, f.monthlyGap))}/mo shortfall`)}
    </div>
    ${card(
      'Where the money comes from',
      stackBar([
        { label: 'Family gift', value: f.gift, color: cssVar('--series-1') },
        { label: 'Stock sale', value: Math.min(f.stockSold, Math.max(0, f.need - f.gift)), color: cssVar('--series-2') },
        { label: 'Cash savings', value: Math.min(f.cashUsed, m.cashSavings), color: cssVar('--series-3') },
      ]),
    )}
    ${msgs.join('')}
    ${card(
      'Compare three mixes',
      `<div class="table-wrap"><table class="data">
        <thead><tr><th></th>${mixes.map((x) => `<th>${x.name}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('Stock sold', (p) => money(p.stockSold))}
          ${row('Cash used', (p) => money(Math.min(p.cashUsed, m.cashSavings)))}
          ${row('Gift used', (p) => money(p.gift))}
          ${row('Tax due next April', (p) => money(p.stockTax.total))}
          ${row('Cash left after closing', (p) => `<span${cls(p.cashAfter - m.emergencyTarget)}>${money(p.cashAfter)}</span>`)}
          ${row('<strong>Short term:</strong> months you can carry both homes', covered, (p) => p.monthsCovered === maxCover)}
          ${row(`<strong>Long term:</strong> cost by year ${H}`, (p) => money(p.longTermCost), (p) => p.longTermCost === minCost)}
        </tbody></table></div>
      <ul class="notes small" style="margin-top:10px">
        <li><strong>Cash first</strong> spends cash down to your emergency fund before selling stock. <strong>Stock first</strong> sells stock before touching cash.</li>
        <li><strong>Long-term cost</strong> = the tax paid now plus the growth the stock (at ${pct(m.stockReturn)}) and cash (at ${pct(m.cashYield)}) would have earned during the ${monthsText(m.delay)} until your house sells, grown to year ${H}. It assumes you rebuild your savings and investments from the sale money.</li>
        <li>The shortfall while you own both homes is your two housing costs minus (take-home − spending): ${money(f.monthlyGap)}/mo. Change the sale delay on the Sale timing tab.</li>
      </ul>`,
    )}
    <div class="two-col">
      ${card(
        'Using the family gift',
        `<ul class="notes">
          <li>Your lender will need a signed <strong>gift letter</strong> (giver, relationship, amount, “no repayment expected”) and bank records showing the money moving into your account. Ask your lender for their template before the transfer.</li>
          <li>With 20% or more down on a primary home, conventional loans generally allow the whole down payment to come from a gift.</li>
          <li>You owe no tax on a gift. Givers only file a gift tax return when they give one person more than the yearly exclusion (about $19,000 per giver per recipient <span class="verify-tag">verify</span>). Two parents giving to both of you can give about 4× that without filing, and even above it they rarely owe tax.</li>
        </ul>`,
      )}
      ${card(
        'Selling stock smartly',
        `<ul class="notes">
          <li>Sell shares held <strong>over one year</strong>; short-term gains are taxed as ordinary income.</li>
          <li>Ask your brokerage to sell <strong>specific lots with the highest cost basis</strong> to keep the taxable gain small.</li>
          <li>Washington’s 7% capital gains tax only applies to stock gains above ${money(m.waCgDeduction)} per year. Splitting large sales across December and January uses two years of that deduction and of the lower federal brackets.</li>
          <li>Taxes on the sale are due with next year’s return (or as estimated payments). This tool sets them aside from cash right away.</li>
        </ul>`,
      )}
    </div>`;
}

// ---------- Tab 4: Sale timing ----------

function renderTiming(m) {
  const sim = C.saleTiming(m);
  const delays = [...new Set([0, 3, 6, 12, Math.round(m.delay)])].sort((a, b) => a - b);
  const cmp = C.compareDelays(m, delays);
  const T = cmp[0].sim.T;
  const runway = C.runwayIfUnsold(m);
  const recasting = m.recastPct > 0 && sim.sale && sim.sale.recast > 0;
  const fixedColors = { 0: '--series-1', 3: '--series-2', 6: '--series-3', 12: '--series-4' };
  const colorFor = (d) => fixedColors[d] ?? '--series-5';

  const msgs = [];
  if (sim.runOut !== null && sim.runOut <= m.delay)
    msgs.push(callout('bad', `Your cash runs out in month ${sim.runOut}, before the house sells. You’d need a HELOC, bridge loan, more stock sales, or a faster sale.`));
  else if (sim.belowTarget !== null)
    msgs.push(callout('warn', `Your cash drops below your ${money(m.emergencyTarget)} emergency fund ${sim.belowTarget === 0 ? 'right at closing' : `in month ${sim.belowTarget}`}. The lowest point is ${money(sim.lowest.cash)} in month ${sim.lowest.month}.`));
  else msgs.push(callout('good', `Your cash stays above your emergency fund the whole time. The lowest point is ${money(sim.lowest.cash)} in month ${sim.lowest.month}.`));
  msgs.push(
    callout(
      'info',
      `Each month the house sits unsold costs about <strong>${money(sim.monthlyCarry)}</strong> (its mortgage, tax, insurance and empty-house costs). Three extra months on the market ≈ a ${money(sim.monthlyCarry * 3)} price cut, so a modest price reduction that sells it faster can be the cheaper choice.`,
    ),
  );

  const s = sim.sale;
  const saleTable = s
    ? `<table class="data"><tbody>
        <tr><td>Sale price (month ${s.month})</td><td>${money(s.price)}</td></tr>
        <tr><td>Agent commissions</td><td class="neg">−${money(s.costs.commission)}</td></tr>
        <tr><td>Washington + Seattle excise tax</td><td class="neg">−${money(s.costs.excise)}</td></tr>
        <tr><td>Other closing costs</td><td class="neg">−${money(s.costs.other)}</td></tr>
        <tr><td>Mortgage payoff</td><td class="neg">−${money(s.payoff)}</td></tr>
        <tr><td>Tax on the gain <span class="muted small">(${money(s.tax.excluded)} of ${money(Math.max(0, s.tax.gain))} profit is tax-free)</span></td><td${s.tax.tax > 0 ? ' class="neg"' : ''}>${s.tax.tax > 0 ? '−' : ''}${money(s.tax.tax)}</td></tr>
        <tr class="total"><td>Cash to you</td><td>${money(s.net)}</td></tr>
        ${recasting ? `<tr><td>Put toward the recast (${pct(m.recastPct, 0)})</td><td>${money(s.recast)}</td></tr><tr><td>New monthly housing cost</td><td>${money(sim.paymentAfterRecast)}</td></tr>` : ''}
      </tbody></table><p class="help">Prep and staging (${money(m.prepCost)}) is paid up front in month 0.</p>`
    : `<p>With these settings the house doesn’t sell within the ${T}-month window.</p>`;

  const runwayText = runway === null ? 'Lasts 10+ years' : `Month ${runway}`;
  document.getElementById('res-timing').innerHTML = `
    <div class="section-title"><h2>What if the house takes a while to sell?</h2></div>
    <p class="lead">You close on the new house in month 0 and pay for both homes until the current one sells. When it sells, the money comes in${m.recastPct > 0 ? ' and part of it recasts your new mortgage to a lower payment' : ''}.</p>
    <div class="tiles">
      ${tile('Monthly housing while you own both', money(sim.paymentBothHomes), `New ${money(sim.paymentNewOnly)} + current ${money(sim.monthlyCarry)}`)}
      ${tile('After the current house sells', money(sim.paymentNewOnly), 'New house only, before any recast')}
      ${tile('After the recast', recasting ? money(sim.paymentAfterRecast) : '—', recasting ? `Saves ${money(sim.paymentNewOnly - sim.paymentAfterRecast)}/mo` : 'No recast at these settings', recasting ? 'highlight' : '')}
      ${tile('If it never sells, cash runs out', runwayText, 'Without selling stock or borrowing more')}
    </div>
    ${msgs.join('')}
    ${card(
      'Cash in the bank, month by month',
      `${legend([
        ...delays.map((d) => ({ label: `Sells after ${monthsText(d)}${d === Math.round(m.delay) ? ' (your plan)' : ''}`, color: cssVar(colorFor(d)), kind: 'line' })),
        { label: 'Emergency fund', color: 'transparent', kind: 'dash' },
      ])}
      <div class="chart-box" style="margin-top:8px"><canvas id="chart-timing" role="img" aria-label="Cash balance by month for each sale delay"></canvas></div>`,
    )}
    ${card(
      'Comparing sale delays',
      `<div class="table-wrap"><table class="data">
        <thead><tr><th>Sells after</th><th>Paying for both homes</th><th>Lowest cash</th><th>Below emergency fund?</th><th>Cost vs. selling right away</th><th>Payment after sale${m.recastPct > 0 ? ' + recast' : ''}</th></tr></thead>
        <tbody>${cmp
          .map(
            (c) => `<tr${c.delay === Math.round(m.delay) ? ' class="selected"' : ''}>
            <td>${monthsText(c.delay)}</td>
            <td>${c.delay === 0 ? '—' : `${money(c.sim.paymentBothHomes)}/mo`}</td>
            <td${cls(c.sim.lowest.cash)}>${money(c.sim.lowest.cash)} <span class="muted small">(mo ${c.sim.lowest.month})</span></td>
            <td>${c.sim.belowTarget === null ? 'No' : `<span class="neg">Yes, month ${c.sim.belowTarget}</span>`}</td>
            <td>${c.delay === 0 ? '—' : money(c.costVsNow)}</td>
            <td>${money(c.sim.paymentAfterRecast)}</td></tr>`,
          )
          .join('')}</tbody></table></div>
        <p class="help">“Cost vs. selling right away” compares cash at month ${T}. It includes carrying costs, price changes while you wait, and a smaller or later recast.</p>`,
    )}
    <div class="two-col">
      ${card(`Your sale after ${monthsText(Math.round(m.delay))}`, saleTable)}
      ${card(
        'About recasting and bridge options',
        `<ul class="notes">
          <li><strong>Recast:</strong> after the sale you pay a lump sum on the new loan and the lender re-figures the payment over the remaining term at the same rate. Most conventional loans allow it (usually $5k–$10k minimum, small fee). FHA/VA loans don’t. Confirm with your lender <em>before</em> you choose one.</li>
          <li>Recasting lowers your payment for good, but that money is then locked in the house. Putting less toward the recast keeps more cash to rebuild your savings and investments.</li>
          <li>If the wait could be long: open a <strong>HELOC on your current house before listing it</strong> (lenders won’t open one on a listed home), or ask about a bridge loan. Both cost interest, but they can stop you from selling stock at a bad time.</li>
        </ul>`,
      )}
    </div>
    <details class="card"><summary>Month-by-month table (your plan)</summary>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Month</th><th>New house</th><th>Current house</th><th>Cash at month end</th><th></th></tr></thead>
        <tbody>${sim.rows
          .map(
            (r) => `<tr><td>${r.month}</td><td>${money(r.newHousing)}</td><td>${r.oldHousing ? money(r.oldHousing) : '—'}</td><td${cls(r.cash)}>${money(r.cash)}</td>
            <td class="small muted">${r.month === 0 ? `Close on new house${s && s.month === 0 ? '; current house sells' : ''}` : s && r.month === s.month ? `Current house sells (+${money(s.net)})` : ''}</td></tr>`,
          )
          .join('')}</tbody></table></div>
    </details>`;

  const labels = cmp[0].sim.rows.map((r) => (r.month === 0 ? 'Close' : `${r.month}`));
  const datasets = cmp.map((c) =>
    lineDataset(`Sells after ${monthsText(c.delay)}`, c.sim.rows.map((r) => r.cash), colorFor(c.delay), {
      borderWidth: c.delay === Math.round(m.delay) ? 3 : 2,
    }),
  );
  datasets.push(
    lineDataset('Emergency fund', labels.map(() => m.emergencyTarget), '--series-neutral', { borderDash: [6, 4], borderWidth: 1.5, pointHoverRadius: 0 }),
  );
  lineChart('timing', 'chart-timing', { labels, datasets, xTitle: 'Months after closing on the new house' });
}

// ---------- Tab 5: Keep vs sell ----------

function renderKeep(m) {
  const k = C.keepVsSell(m);
  const H = Math.max(1, Math.round(m.horizon));
  const best = k.reduce((a, b) => (b.atHorizon.value > a.atHorizon.value ? b : a));
  const sell = k[0];
  const deadline = C.exclusionDeadlineMonths(m);
  const windowYear = deadline === null ? null : Math.floor(deadline / 12);
  const rentals = k.filter((s) => s.kind !== 'sell');
  const colors = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5'];

  const lead =
    best.key === 'sell'
      ? `Over ${H} years, <strong>selling</strong> comes out ahead at these numbers (${moneyK(sell.atHorizon.value)}).`
      : `Over ${H} years, <strong>${best.name.toLowerCase()}</strong> comes out ahead: ${moneyK(best.atHorizon.value)}, which is ${moneyK(best.atHorizon.value - sell.atHorizon.value)} more than selling.`;

  const windowNote =
    deadline === null
      ? callout('warn', 'You’ll have lived there under 2 years, so the $500k home-sale exclusion wouldn’t apply. Profit would be taxed whenever you sell.')
      : callout(
          'info',
          `<strong>Tax-free sale window:</strong> you can rent it out and still sell with up to ${moneyK(m.exclusionCap)} of profit tax-free if you sell within <strong>3 years of moving out</strong>. After that, the whole gain is taxable. Depreciation deducted while renting is taxed either way.`,
        );

  const y1 = (s, fn) => fn(s.year1) / 12;
  const lineRow = (label, key) => {
    const vals = rentals.map((s) => s.year1.lines[key] / 12);
    if (vals.every((v) => Math.abs(v) < 0.5)) return '';
    return `<tr><td>${label}</td>${vals.map((v) => `<td>${v ? `−${money(v)}` : '—'}</td>`).join('')}</tr>`;
  };
  const breakdown = `<div class="table-wrap"><table class="data">
    <thead><tr><th>Year 1, per month</th>${rentals.map((s) => `<th>${s.name}</th>`).join('')}</tr></thead>
    <tbody>
      <tr><td>Rental income</td>${rentals.map((s) => `<td>${money(y1(s, (y) => y.revenue))}</td>`).join('')}</tr>
      ${lineRow('Property manager / co-host', 'management')}
      ${lineRow('Leasing fees', 'leasing')}
      ${lineRow('Cleaning', 'cleaning')}
      ${lineRow('Airbnb fee', 'platform')}
      ${lineRow('Utilities', 'utilities')}
      ${lineRow('Supplies & furniture wear', 'supplies')}
      ${lineRow('Insurance + umbrella', 'insurance')}
      ${lineRow('Maintenance', 'maintenance')}
      ${lineRow('Property tax', 'propertyTax')}
      ${lineRow('HOA', 'hoa')}
      ${lineRow('Licenses & registration', 'fees')}
      ${lineRow('Seattle per-night tax', 'cityTax')}
      <tr><td>Mortgage (principal + interest)</td>${rentals.map((s) => `<td>−${money(y1(s, (y) => y.mortgagePI))}</td>`).join('')}</tr>
      <tr><td>Income tax on rental profit</td>${rentals.map((s) => `<td>${s.year1.incomeTax ? `−${money(y1(s, (y) => y.incomeTax))}` : '—'}</td>`).join('')}</tr>
      ${m.timeValue > 0 ? `<tr><td>Your time (${money(m.timeValue)}/hr)</td>${rentals.map((s) => `<td>−${money(y1(s, (y) => y.timeCost))}</td>`).join('')}</tr>` : ''}
      <tr class="total"><td>Cash flow per month</td>${rentals.map((s) => `<td${cls(s.year1.cashFlow)}>${money(y1(s, (y) => y.cashFlow), { sign: true })}</td>`).join('')}</tr>
      <tr><td>Your time</td>${rentals.map((s) => `<td>${s.year1.hours} hrs/mo</td>`).join('')}</tr>
    </tbody></table></div>
    <p class="help">Principal you pay down isn’t lost: it shows up as equity when you sell. Upfront costs are not included here: make-ready ${money(m.makeReady)}, plus furnishing ${money(m.furnish)} for Airbnb.</p>`;

  const ins = `<table class="data"><thead><tr><th>Policy</th><th>Per year</th><th>Per month</th></tr></thead><tbody>
      <tr><td>Homeowners (what you pay now)</td><td>${money(m.curIns)}</td><td>${money(m.curIns / 12)}</td></tr>
      <tr><td>Landlord policy (long-term rental)</td><td>${money(m.ltrIns)}</td><td>${money(m.ltrIns / 12)}</td></tr>
      <tr><td>Short-term rental policy (Airbnb)</td><td>${money(m.strIns)}</td><td>${money(m.strIns / 12)}</td></tr>
      <tr><td>Umbrella liability (either)</td><td>${money(m.umbrella)}</td><td>${money(m.umbrella / 12)}</td></tr>
      <tr class="total"><td>Airbnb costs more by</td><td>${money(m.strIns - m.ltrIns, { sign: true })}</td><td>${money((m.strIns - m.ltrIns) / 12, { sign: true })}</td></tr>
    </tbody></table>
    <ul class="notes small" style="margin-top:10px">
      <li><strong>Long-term renters:</strong> one household that signs a lease. A landlord (DP-3) policy covers the building, lost rent after damage, and your liability. Require tenants to carry renters insurance in the lease.</li>
      <li><strong>Airbnb guests:</strong> a stream of strangers means more injury and damage risk (stairs, decks, hot tubs). Normal homeowners and landlord policies usually <em>exclude</em> short-term rentals, so you need a policy written for them.</li>
      <li>Airbnb’s AirCover includes host liability protection (up to $1M), but it has exclusions and doesn’t replace your own policy.</li>
      <li>Ask your umbrella insurer, in writing, whether it covers rentals and specifically short-term rentals. Many exclude them.</li>
      <li>Premiums here are placeholders. Get two or three quotes for each type before deciding.</li>
    </ul>`;

  document.getElementById('res-keep').innerHTML = `
    <div class="section-title"><h2>Sell, rent, or Airbnb the current house?</h2></div>
    <p class="lead">${lead}</p>
    ${windowNote}
    ${card(
      'What you’d walk away with if you sold in each year',
      `${legend(k.map((s, i) => ({ label: s.name, color: cssVar(colors[i]), kind: 'line' })))}
      <div class="chart-box" style="margin-top:8px"><canvas id="chart-keep" role="img" aria-label="Value of each option by year"></canvas></div>
      <p class="help">For each year: money you’d have if you sold then, after selling costs, mortgage payoff and taxes, plus all rental cash flow invested at ${pct(m.investReturn)}. The “Sell” line is the sale money from selling now, invested at the same rate.${m.timeValue > 0 ? ` Your time is counted at ${money(m.timeValue)}/hr.` : ' Your time is not counted (set a value in the panel to include it).'}</p>`,
    )}
    ${card(
      `Year ${H} comparison`,
      `<div class="table-wrap"><table class="data">
        <thead><tr><th>Option</th><th>Upfront cost</th><th>Year-1 cash flow</th><th>Your time</th>${windowYear && windowYear < H ? `<th>Sell in year ${windowYear}, invest the rest</th>` : ''}<th>Keep all ${H} years</th><th>Tax when sold</th></tr></thead>
        <tbody>${k
          .map(
            (s) => `<tr${s.key === best.key ? ' class="selected"' : ''}>
            <td>${s.name}</td>
            <td>${s.upfront ? money(s.upfront) : '—'}</td>
            <td>${s.year1 ? `<span${cls(s.year1.cashFlow)}>${money(s.year1.cashFlow / 12, { sign: true })}/mo</span>` : '—'}</td>
            <td>${s.year1 ? `${s.year1.hours} hrs/mo` : '—'}</td>
            ${windowYear && windowYear < H ? `<td>${s.inWindow ? money(s.inWindow.value) : '—'}</td>` : ''}
            <td${s.key === best.key ? ' class="best"' : ''}>${money(s.atHorizon.value)}</td>
            <td>${money(s.atHorizon.saleTax)}</td></tr>`,
          )
          .join('')}</tbody></table></div>
        <p class="help">All values are at year ${H}. The highlighted row is the highest. “Sell in year ${windowYear ?? 3}” means renting until the tax-free window closes, selling, and investing the money at ${pct(m.investReturn)}.</p>`,
    )}
    ${card('Monthly cash flow while renting', breakdown)}
    <div class="two-col">
      ${card('Liability & insurance: Airbnb vs. long-term tenants', ins)}
      ${card(
        'Seattle rules to know',
        `<h4>Long-term rental</h4>
        <ul class="notes small">
          <li>Register with Seattle’s Rental Registration and Inspection Ordinance (RRIO), which includes periodic inspections.</li>
          <li>Seattle has <strong>just-cause eviction</strong>: you can’t simply decline to renew. Selling later with a tenant in place requires specific notice periods, so plan your exit.</li>
          <li>Rent increases need long advance notice (180 days in Seattle), and large increases can trigger relocation assistance. Washington’s 2025 rent-increase cap may apply; check whether your house is exempt. <span class="verify-tag">verify</span></li>
        </ul>
        <h4>Airbnb / short-term rental</h4>
        <ul class="notes small">
          <li>You need a Seattle short-term rental operator license and a business license.</li>
          <li>Seattle lets an operator run at most two units, and one must be your primary residence, so your current house could be your one extra unit. <span class="verify-tag">verify</span></li>
          <li>Lodging and sales taxes are usually collected by Airbnb; Washington B&amp;O tax may still apply to you.</li>
        </ul>
        <h4>Taxes</h4>
        <ul class="notes small">
          <li>Rental profit is taxed at your federal bracket (${pct(m.marginal, 0)}). The building is depreciated over 27.5 years (39 for short stays), which lowers that tax but is taxed back when you sell.</li>
          <li>At your income, rental losses usually can’t offset your wages, so this tool doesn’t count losses as tax savings.</li>
          <li>Short-term rentals with average stays of 7 days or less follow different federal rules. Talk to a CPA before choosing.</li>
        </ul>`,
      )}
    </div>`;

  const labels = Array.from({ length: H }, (_, i) => `Year ${i + 1}`);
  const datasets = k.map((s, i) => lineDataset(s.name, s.byYear, colors[i]));
  lineChart('keep', 'chart-keep', {
    labels,
    datasets,
    vline: windowYear && windowYear <= H ? { index: windowYear - 1, label: 'Tax-free sale window ends' } : null,
  });
}

// ---------- Tab 6: Compare ----------

function scenarioMetrics(inputs) {
  const m = toModel(inputs);
  const all = C.computeAll(m);
  const wait = C.compareDelays(m, [0, Math.round(m.delay)]);
  return { m, all, waitCost: wait[1]?.costVsNow ?? 0 };
}

function renderCompare() {
  const cols = [{ id: null, name: 'Current (on screen)', inputs: state.inputs }, ...state.scenarios];
  const data = cols.map((c) => ({ ...c, ...scenarioMetrics(c.inputs) }));
  const H = Math.round(toModel(state.inputs).horizon);
  const groups = [
    [
      'New house',
      [
        ['Price', (d) => money(d.m.newPrice)],
        ['Down payment', (d) => `${pct(d.m.downPct, 0)} · ${money(d.all.afford.selected.down)}`],
        ['Interest rate', (d) => pct(d.m.newRate, 3).replace(/0+%$/, '%').replace(/\.%$/, '%')],
        ['Monthly housing cost', (d) => money(d.all.timing.paymentNewOnly)],
        ['After sale + recast', (d) => money(d.all.timing.paymentAfterRecast)],
      ],
    ],
    [
      'Affordability',
      [
        ['Lender max, before selling', (d) => moneyK(d.all.afford.lenderBeforePrice)],
        ['Lender max, after selling', (d) => moneyK(d.all.afford.lenderAfterPrice)],
        ['Comfortable price', (d) => moneyK(d.all.afford.comfortPrice)],
      ],
    ],
    [
      'Down payment',
      [
        ['Stock sold', (d) => money(d.all.funding.stockSold)],
        ['Tax on stock sale', (d) => money(d.all.funding.stockTax.total)],
        ['Cash left after closing', (d) => `<span${cls(d.all.funding.cashAfter - d.m.emergencyTarget)}>${money(d.all.funding.cashAfter)}</span>`],
        ['Long-term cost of the mix', (d) => money(d.all.funding.longTermCost)],
      ],
    ],
    [
      'Sale timing',
      [
        ['Months until it sells', (d) => String(Math.round(d.m.delay))],
        ['Monthly while owning both', (d) => money(d.all.timing.paymentBothHomes)],
        ['Lowest cash', (d) => `<span${cls(d.all.timing.lowest.cash - d.m.emergencyTarget)}>${money(d.all.timing.lowest.cash)}</span>`],
        ['Cost of waiting vs. selling right away', (d) => money(d.waitCost)],
        ['If it never sells, cash runs out', (d) => (d.all.runway === null ? '10+ years' : `Month ${d.all.runway}`)],
      ],
    ],
    [
      `Keep vs sell: value at year ${H}`,
      [
        ...C.STRATEGIES.map((s, i) => [s.name, (d) => money(d.all.keep[i].atHorizon.value), (d) => d.all.best.key === s.key]),
        ['Best option', (d) => `<strong>${d.all.best.name}</strong>`],
      ],
    ],
  ];
  const head = data
    .map(
      (d) => `<th><div class="scenario-head"><span class="name">${esc(d.name)}</span>${
        d.id
          ? `<span class="muted small">${d.savedAt ? esc(new Date(d.savedAt).toLocaleDateString()) : ''}</span><span class="btns">
              <button type="button" class="btn ghost small" data-act="load" data-id="${esc(d.id)}">Load</button>
              <button type="button" class="btn ghost small" data-act="update" data-id="${esc(d.id)}" title="Replace this scenario with the numbers on screen">Update</button>
              <button type="button" class="btn danger small" data-act="delete" data-id="${esc(d.id)}">Delete</button></span>`
          : '<span class="muted small">Unsaved edits</span>'
      }</div></th>`,
    )
    .join('');
  const body = groups
    .map(
      ([g, rows]) =>
        `<tr><td class="group-row" colspan="${data.length + 1}">${g}</td></tr>` +
        rows.map(([label, fn, best]) => `<tr><td>${label}</td>${data.map((d) => `<td${best && best(d) ? ' class="best"' : ''}>${fn(d)}</td>`).join('')}</tr>`).join(''),
    )
    .join('');

  document.getElementById('res-compare').innerHTML = `
    <div class="section-title"><h2>Compare scenarios side by side</h2></div>
    <p class="lead">Save the current numbers under a name (for example “$1.1M, sell in 3 months, recast”), change things, save again, and compare. Scenarios are saved in this browser and included in exported files.</p>
    ${card(
      '',
      `<form class="save-row" id="save-form">
        <label for="scenario-name" class="visually-hidden">Scenario name</label>
        <input type="text" id="scenario-name" maxlength="80" placeholder="Name this scenario" required>
        <button type="submit" class="btn">Save current numbers</button>
        <span class="muted small">${state.scenarios.length} saved</span>
      </form>`,
    )}
    ${state.scenarios.length === 0 ? callout('info', 'No saved scenarios yet. The table shows your current numbers; save a few versions to compare them.') : ''}
    ${card('', `<div class="table-wrap"><table class="data"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`)}`;
}

function onCompareClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const sc = state.scenarios.find((s) => s.id === btn.dataset.id);
  if (!sc) return;
  if (btn.dataset.act === 'load') {
    if (!confirm(`Load “${sc.name}”? The numbers on screen will be replaced (save them first if you want to keep them).`)) return;
    state.inputs = { ...sc.inputs };
    Object.keys(FIELDS).forEach((id) => syncField(id));
  } else if (btn.dataset.act === 'update') {
    if (!confirm(`Replace “${sc.name}” with the numbers currently on screen?`)) return;
    sc.inputs = { ...state.inputs };
    sc.savedAt = new Date().toISOString();
  } else if (btn.dataset.act === 'delete') {
    if (!confirm(`Delete “${sc.name}”?`)) return;
    state.scenarios = state.scenarios.filter((s) => s !== sc);
  }
  save();
  render();
}
function onCompareSubmit(e) {
  if (e.target.id !== 'save-form') return;
  e.preventDefault();
  const name = document.getElementById('scenario-name').value.trim();
  if (!name) return;
  state.scenarios.push({ id: `s${Date.now()}`, name, savedAt: new Date().toISOString(), inputs: { ...state.inputs } });
  save();
  render();
}

// ---------- Export / import / reset ----------

function exportFile() {
  const payload = {
    app: 'house-move-planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    inputs: state.inputs,
    scenarios: state.scenarios,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `house-plan-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(String(reader.result));
      if (!d || typeof d !== 'object' || !d.inputs) throw new Error('missing inputs');
      const n = Array.isArray(d.scenarios) ? d.scenarios.length : 0;
      if (!confirm(`Import “${file.name}”? This replaces the numbers on screen and your saved scenarios with the file’s (${n} scenario${n === 1 ? '' : 's'}).`)) return;
      state.inputs = sanitizeInputs(d.inputs);
      state.scenarios = sanitizeScenarios(d.scenarios);
      Object.keys(FIELDS).forEach((id) => syncField(id));
      save();
      render();
    } catch {
      alert('That file isn’t a House Move Planner export.');
    }
  };
  reader.readAsText(file);
}
function reset() {
  if (!confirm('Reset all inputs to the example numbers? Your saved scenarios are kept.')) return;
  state.inputs = defaultInputs();
  Object.keys(FIELDS).forEach((id) => syncField(id));
  save();
  render();
}

// ---------- Boot ----------

function init() {
  load();
  mountInputs();
  document.addEventListener('input', onInput);
  document.addEventListener('focusout', onBlur);
  document.getElementById('res-compare').addEventListener('click', onCompareClick);
  document.getElementById('res-compare').addEventListener('submit', onCompareSubmit);
  document.getElementById('btn-export').addEventListener('click', exportFile);
  document.getElementById('file-import').addEventListener('change', importFile);
  document.getElementById('btn-reset').addEventListener('click', reset);
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      showTab(next.dataset.tab);
    });
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', render);
  showTab(state.tab);
}

// Chart.js loads with `defer`; module scripts also run after parsing, but wait for it to be safe.
if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
