/**
 * Channel Promotions Simulator
 * Step 1: Promotion optimization using SKU x channel season data.
 */

import {
  getWeeklyData,
  loadElasticityParams,
  loadSkuWeeklyData,
  loadExternalFactors,
  loadSocialSignals,
  loadPromoMetadata
} from './data-loader.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

let channelPromoRevenueChart = null;
let channelPromoProfitChart = null;
let channelPromoInventoryChart = null;
let channelPromoSkuResponseChart = null;

let baseline = null;
let skuWeeklyData = [];
let externalFactors = [];
let socialSignals = [];
let promoMetadata = {};
let currentSeasonWeek = 7;
let latestPromoSnapshot = null;
const SEASON_WEEKS = 17;

const OBJECTIVE_CONFIG = {
  balance: {
    demandMultiplier: 1.0,
    marginAdjustment: 0.0,
    cannibalizationMultiplier: 1.0,
    label: 'Balanced across volume and margin'
  },
  sales: {
    demandMultiplier: 1.1,
    marginAdjustment: -0.015,
    cannibalizationMultiplier: 1.08,
    label: 'Aggressive sell-through focus'
  },
  profit: {
    demandMultiplier: 0.96,
    marginAdjustment: 0.018,
    cannibalizationMultiplier: 0.86,
    label: 'Margin-protected selective promotions'
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSocialScore(rawScore) {
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  if (score <= 1.5 && score >= -1.5) {
    // Backward compatibility for datasets where sentiment is stored as 0-1.
    return score * 100;
  }
  return score;
}

function getSelectedFilters() {
  const group = document.getElementById('channel-promo-product-group')?.value || 'all';
  const sku = document.getElementById('channel-promo-sku')?.value || 'all';
  return { group, sku };
}

function getCurrentWeekRows() {
  const { group, sku } = getSelectedFilters();
  return skuWeeklyData.filter(row => {
    if (Number(row.week_of_season) !== currentSeasonWeek) return false;
    if (group !== 'all' && row.product_group !== group) return false;
    if (sku !== 'all' && row.sku_id !== sku) return false;
    return true;
  });
}

function getSocialSummary() {
  if (!socialSignals.length) {
    return { score: null, trendDelta: null };
  }
  const latest = socialSignals[socialSignals.length - 1];
  const prev = socialSignals[socialSignals.length - 2] || latest;
  const score = normalizeSocialScore(latest.brand_social_index ?? latest.social_sentiment ?? 0);
  const prevScore = normalizeSocialScore(prev.brand_social_index ?? prev.social_sentiment ?? 0);
  if (!Number.isFinite(score) || !Number.isFinite(prevScore)) {
    return { score: null, trendDelta: null };
  }
  return { score, trendDelta: score - prevScore };
}

function getSocialElasticityModifier(score) {
  if (!Number.isFinite(score)) return 1.0;
  const clipped = clamp(score, 35, 95);
  // Continuous response so +/-5 shock always creates a visible change.
  return clamp(1.18 - ((clipped - 35) * 0.0075), 0.72, 1.26);
}

function getSocialDemandMultiplier(score) {
  if (!Number.isFinite(score)) return 1.0;
  const clipped = clamp(score, 35, 95);
  // Captures baseline demand lift/drop from social momentum even without price moves.
  return clamp(0.8 + ((clipped - 35) * 0.0067), 0.75, 1.22);
}

function computeScenarioForRow(row, promoDepthPct, objectiveKey, socialScore, competitorShockPct = 0) {
  const objective = OBJECTIVE_CONFIG[objectiveKey] || OBJECTIVE_CONFIG.balance;
  const promoFrac = promoDepthPct / 100;
  const newPrice = row.list_price * (1 - promoFrac);
  const baselinePrice = row.effective_price || row.list_price;
  const priceRatio = baselinePrice > 0 ? newPrice / baselinePrice : 1;

  const baseElasticity = Number(row.base_elasticity) || -1.8;
  const socialElasticityModifier = getSocialElasticityModifier(socialScore);
  const effectiveElasticity = baseElasticity * socialElasticityModifier;
  const baselineSocialScore = normalizeSocialScore(row.social_engagement_score);
  const baselineSocialDemand = getSocialDemandMultiplier(baselineSocialScore);
  const scenarioSocialDemand = getSocialDemandMultiplier(socialScore);
  const socialDemandMultiplier = baselineSocialDemand > 0
    ? (scenarioSocialDemand / baselineSocialDemand)
    : 1;

  const rawCompetitorPrice = Number(row.competitor_price) || newPrice;
  const competitorPrice = rawCompetitorPrice * (1 + competitorShockPct / 100);
  const gapVsCompetitor = competitorPrice > 0 ? (newPrice - competitorPrice) / competitorPrice : 0;
  const channelGapSensitivity = row.channel_group === 'mass' ? 0.72 : 0.46;
  const competitorMultiplier = clamp(1 - gapVsCompetitor * channelGapSensitivity, 0.55, 1.38);

  const baselineUnits = Number(row.net_units_sold) || 0;
  const ownMultiplier = Math.pow(priceRatio || 1, effectiveElasticity) * objective.demandMultiplier;
  const unitsAfterOwnEffect = baselineUnits * ownMultiplier;
  const unitsAfterCompetitive = unitsAfterOwnEffect * competitorMultiplier;
  let unitsScenario = unitsAfterCompetitive * socialDemandMultiplier;

  const cannibalizationPenalty =
    (Number(row.cannibalized_out_units) || 0) * objective.cannibalizationMultiplier;
  unitsScenario = Math.max(0, unitsScenario - cannibalizationPenalty);

  const unitsWithoutSocial = unitsAfterCompetitive;
  const socialContributionPct = unitsWithoutSocial > 0
    ? (unitsScenario / unitsWithoutSocial) - 1
    : 0;

  const marginPctBase = Number(row.gross_margin_pct) || 0.4;
  const marginPctScenario = clamp(
    marginPctBase + objective.marginAdjustment - promoDepthPct * 0.0014,
    0.2,
    0.75
  );

  const revenueScenario = unitsScenario * newPrice;
  const profitScenario = revenueScenario * marginPctScenario;
  const baselineRevenue = Number(row.revenue) || 0;
  const baselineProfit = baselineRevenue * marginPctBase;

  return {
    sku_id: row.sku_id,
    sku_name: row.sku_name,
    product_group: row.product_group,
    channel: row.sales_channel,
    group: row.channel_group,
    promoDepthPct,
    scenarioPrice: newPrice,
    scenarioMarginPct: marginPctScenario,
    competitorGapPct: gapVsCompetitor,
    ownMultiplier,
    competitorMultiplier,
    socialDemandMultiplier,
    socialContributionPct,
    baselineRevenue,
    baselineProfit,
    scenarioRevenue: revenueScenario,
    scenarioProfit: profitScenario,
    baselineUnits,
    scenarioUnits: unitsScenario
  };
}

function populateSkuSelector() {
  const skuSelect = document.getElementById('channel-promo-sku');
  const groupSelect = document.getElementById('channel-promo-product-group');
  if (!skuSelect || !groupSelect) return;

  const selectedGroup = groupSelect.value || 'all';
  const skus = [...new Set(
    skuWeeklyData
      .filter(row => Number(row.week_of_season) === currentSeasonWeek)
      .filter(row => selectedGroup === 'all' || row.product_group === selectedGroup)
      .map(row => `${row.sku_id}::${row.sku_name}`)
  )].sort();

  const previousValue = skuSelect.value || 'all';
  skuSelect.innerHTML = '<option value="all" selected>All SKUs in Selection</option>';
  skus.forEach(item => {
    const [skuId, skuName] = item.split('::');
    const option = document.createElement('option');
    option.value = skuId;
    option.textContent = `${skuId} - ${skuName}`;
    skuSelect.appendChild(option);
  });

  if ([...skuSelect.options].some(opt => opt.value === previousValue)) {
    skuSelect.value = previousValue;
  }
}

function updateSignalCards(socialShockPts = 0) {
  const massCompEl = document.getElementById('channel-promo-comp-mass');
  const prestigeCompEl = document.getElementById('channel-promo-comp-prestige');
  const socialScoreEl = document.getElementById('channel-promo-social-score');
  const socialTrendEl = document.getElementById('channel-promo-social-trend');
  if (!massCompEl || !prestigeCompEl || !socialScoreEl || !socialTrendEl) return;

  const marketRow = externalFactors[externalFactors.length - 1];
  const { score, trendDelta } = getSocialSummary();

  massCompEl.textContent = marketRow?.competitor_mass_price
    ? formatCurrency(marketRow.competitor_mass_price)
    : '--';
  prestigeCompEl.textContent = marketRow?.competitor_prestige_price
    ? formatCurrency(marketRow.competitor_prestige_price)
    : '--';

  if (Number.isFinite(score)) {
    const effectiveScore = score + Number(socialShockPts || 0);
    socialScoreEl.textContent = effectiveScore.toFixed(1);
    const dir = trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat';
    socialTrendEl.textContent =
      `Trend ${dir} (${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)} vs prior week, shock ${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts)`;
  } else {
    socialScoreEl.textContent = '--';
    socialTrendEl.textContent = '--';
  }
}

function getSeasonRows({ group, sku, applyMass, applyPrestige }) {
  return skuWeeklyData.filter(row => {
    if (group !== 'all' && row.product_group !== group) return false;
    if (sku !== 'all' && row.sku_id !== sku) return false;
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });
}

function applyCannibalizationTransfers(scenarios, objectiveKey, selectedSku, skuBoostPct) {
  if (!selectedSku || selectedSku === 'all' || skuBoostPct <= 0) {
    return [];
  }
  const objective = OBJECTIVE_CONFIG[objectiveKey] || OBJECTIVE_CONFIG.balance;
  const transferRows = [];

  const buckets = new Map();
  scenarios.forEach(s => {
    const key = `${s.product_group}|${s.group}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  });

  buckets.forEach(entries => {
    const winner = entries.find(e => e.sku_id === selectedSku);
    if (!winner) return;

    entries
      .filter(e => e.sku_id !== selectedSku)
      .forEach(loser => {
        const depthDiff = Math.max(0, winner.promoDepthPct - loser.promoDepthPct);
        if (depthDiff <= 0) return;

        const migratedUnits =
          loser.scenarioUnits * (depthDiff / 100) * 0.35 * objective.cannibalizationMultiplier;
        const bounded = clamp(migratedUnits, 0, loser.scenarioUnits);
        if (bounded <= 0) return;

        loser.scenarioUnits -= bounded;
        winner.scenarioUnits += bounded;

        transferRows.push({
          from_sku: loser.sku_id,
          from_sku_name: loser.sku_name,
          to_sku: winner.sku_id,
          to_sku_name: winner.sku_name,
          product_group: winner.product_group,
          channel_group: winner.group,
          units: bounded
        });
      });
  });

  scenarios.forEach(row => {
    row.scenarioRevenue = row.scenarioUnits * row.scenarioPrice;
    row.scenarioProfit = row.scenarioRevenue * row.scenarioMarginPct;
  });

  return transferRows;
}

function renderCannibalizationTable(transfers) {
  const tbody = document.getElementById('channel-promo-cannibalization-body');
  if (!tbody) return;

  if (!transfers.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">
          No internal SKU migration yet. Select one SKU and apply extra SKU promo to view cannibalization.
        </td>
      </tr>
    `;
    return;
  }

  const sorted = [...transfers].sort((a, b) => b.units - a.units).slice(0, 8);
  tbody.innerHTML = sorted.map(row => `
    <tr>
      <td>${row.from_sku_name || row.from_sku}</td>
      <td>${row.to_sku_name || row.to_sku}</td>
      <td>${row.product_group || '-'}, ${row.channel_group === 'mass' ? 'Mass' : 'Prestige'}</td>
      <td class="text-end">${formatNumber(row.units, 1)}</td>
    </tr>
  `).join('');
}

function renderSkuResponseView(scenarios, noActionScenarios, transfers, competitorShockPct, socialShockPts) {
  const tbody = document.getElementById('channel-promo-sku-response-body');
  const noteEl = document.getElementById('channel-promo-sku-response-note');
  const chartCanvas = document.getElementById('channel-promo-sku-response-chart');
  if (!tbody || !noteEl || !chartCanvas) return;

  const map = new Map();
  const ensureEntry = (row) => {
    if (!map.has(row.sku_id)) {
      map.set(row.sku_id, {
        sku_id: row.sku_id,
        sku_name: row.sku_name || row.sku_id,
        product_group: row.product_group || '-',
        baselineUnits: 0,
        shockOnlyUnits: 0,
        scenarioUnits: 0,
        transferIn: 0,
        transferOut: 0
      });
    }
    return map.get(row.sku_id);
  };

  scenarios.forEach(row => {
    const entry = ensureEntry(row);
    entry.baselineUnits += Number(row.baselineUnits || 0);
    entry.scenarioUnits += Number(row.scenarioUnits || 0);
  });

  noActionScenarios.forEach(row => {
    const entry = ensureEntry(row);
    entry.shockOnlyUnits += Number(row.scenarioUnits || 0);
  });

  transfers.forEach(t => {
    const toEntry = map.get(t.to_sku);
    const fromEntry = map.get(t.from_sku);
    if (toEntry) toEntry.transferIn += Number(t.units || 0);
    if (fromEntry) fromEntry.transferOut += Number(t.units || 0);
  });

  const rows = [...map.values()]
    .map(entry => ({
      ...entry,
      netDelta: entry.scenarioUnits - entry.baselineUnits,
      internalMigration: entry.transferIn - entry.transferOut
    }))
    .sort((a, b) => {
      const groupCmp = String(a.product_group).localeCompare(String(b.product_group));
      if (groupCmp !== 0) return groupCmp;
      return String(a.sku_name).localeCompare(String(b.sku_name));
    });

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">No SKU rows available for current filters.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.sku_name}</td>
      <td class="text-capitalize">${row.product_group}</td>
      <td class="text-end">${formatNumber(row.baselineUnits, 1)}</td>
      <td class="text-end">${formatNumber(row.shockOnlyUnits, 1)}</td>
      <td class="text-end">${formatNumber(row.scenarioUnits, 1)}</td>
      <td class="text-end ${row.netDelta >= 0 ? 'text-success' : 'text-danger'}">${row.netDelta >= 0 ? '+' : ''}${formatNumber(row.netDelta, 1)}</td>
      <td class="text-end ${row.internalMigration >= 0 ? 'text-success' : 'text-danger'}">${row.internalMigration >= 0 ? '+' : ''}${formatNumber(row.internalMigration, 1)}</td>
    </tr>
  `).join('');

  const labels = rows.map(row => row.sku_name);
  const baselineData = rows.map(row => Number(row.baselineUnits.toFixed(2)));
  const shockData = rows.map(row => Number(row.shockOnlyUnits.toFixed(2)));
  const scenarioData = rows.map(row => Number(row.scenarioUnits.toFixed(2)));

  if (channelPromoSkuResponseChart) {
    channelPromoSkuResponseChart.data.labels = labels;
    channelPromoSkuResponseChart.data.datasets[0].data = baselineData;
    channelPromoSkuResponseChart.data.datasets[1].data = shockData;
    channelPromoSkuResponseChart.data.datasets[2].data = scenarioData;
    channelPromoSkuResponseChart.update();
  } else if (window.Chart) {
    channelPromoSkuResponseChart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Baseline units', data: baselineData, backgroundColor: 'rgba(148, 163, 184, 0.85)' },
          { label: 'Shock-only units (no own promo)', data: shockData, backgroundColor: 'rgba(245, 158, 11, 0.85)' },
          { label: 'Scenario units (with promo)', data: scenarioData, backgroundColor: 'rgba(14, 165, 233, 0.85)' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  const totalBaseline = rows.reduce((sum, row) => sum + row.baselineUnits, 0);
  const totalShockOnly = rows.reduce((sum, row) => sum + row.shockOnlyUnits, 0);
  const totalScenario = rows.reduce((sum, row) => sum + row.scenarioUnits, 0);
  const shockDeltaPct = totalBaseline > 0 ? ((totalShockOnly / totalBaseline) - 1) : 0;
  const scenarioDeltaPct = totalBaseline > 0 ? ((totalScenario / totalBaseline) - 1) : 0;

  noteEl.textContent =
    `No-own-promo shock impact: ${shockDeltaPct >= 0 ? '+' : ''}${formatPercent(shockDeltaPct)} ` +
    `(competitor ${competitorShockPct >= 0 ? '+' : ''}${competitorShockPct}%, social ${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts). ` +
    `Final scenario vs baseline: ${scenarioDeltaPct >= 0 ? '+' : ''}${formatPercent(scenarioDeltaPct)}.`;
}

function renderDriverDecomposition(scenarios, transfers) {
  const ownEl = document.getElementById('channel-promo-driver-own');
  const compEl = document.getElementById('channel-promo-driver-competitor');
  const socialEl = document.getElementById('channel-promo-driver-social');
  const cannibalEl = document.getElementById('channel-promo-driver-cannibalization');
  const noteEl = document.getElementById('channel-promo-driver-note');
  if (!ownEl || !compEl || !socialEl || !cannibalEl || !noteEl) return;

  const baselineUnits = scenarios.reduce((sum, row) => sum + row.baselineUnits, 0) || 1;
  const weightedAvg = (getter) =>
    scenarios.reduce((sum, row) => sum + getter(row) * row.baselineUnits, 0) / baselineUnits;

  const ownPct = weightedAvg(row => (row.ownMultiplier || 1) - 1);
  const compPct = weightedAvg(row => (row.competitorMultiplier || 1) - 1);
  const socialPct = weightedAvg(row => row.socialContributionPct || 0);
  const shiftedUnits = transfers.reduce((sum, row) => sum + row.units, 0);

  ownEl.textContent = `${ownPct >= 0 ? '+' : ''}${formatPercent(ownPct)}`;
  compEl.textContent = `${compPct >= 0 ? '+' : ''}${formatPercent(compPct)}`;
  socialEl.textContent = `${socialPct >= 0 ? '+' : ''}${formatPercent(socialPct)}`;
  cannibalEl.textContent = shiftedUnits > 0
    ? `${formatNumber(shiftedUnits, 1)} units shifted`
    : 'No shift';
  noteEl.textContent = 'Own promo, competitor gap, and social momentum all recalculate in real-time; social momentum now affects both elasticity and baseline demand, and cannibalization captures migration between sibling SKUs.';
}

function renderSeasonStory(seasonRows, inventoryProjection) {
  const weekLabelEl = document.getElementById('channel-promo-week-label');
  const startEl = document.getElementById('channel-promo-season-start');
  const currentEl = document.getElementById('channel-promo-season-current');
  const baseEndEl = document.getElementById('channel-promo-season-end-baseline');
  const scenarioEndEl = document.getElementById('channel-promo-season-end-scenario');
  const guidanceEl = document.getElementById('channel-promo-season-guidance');
  if (!weekLabelEl || !startEl || !currentEl || !baseEndEl || !scenarioEndEl || !guidanceEl) return;

  const week1Rows = seasonRows.filter(row => Number(row.week_of_season) === 1);
  const weekCurrentRows = seasonRows.filter(row => Number(row.week_of_season) === currentSeasonWeek);

  const seasonStartInventory = week1Rows.reduce(
    (sum, row) => sum + Number(row.start_inventory_units || 0),
    0
  );
  const currentInventory = weekCurrentRows.reduce(
    (sum, row) => sum + Number(row.end_inventory_units || 0),
    0
  );
  const baselineEnd = Number(inventoryProjection?.baselineEnd || 0);
  const scenarioEnd = Number(inventoryProjection?.scenarioEnd || 0);
  const baselineNorm100 = seasonStartInventory > 0 ? (baselineEnd / seasonStartInventory) * 100 : 0;
  const scenarioNorm100 = seasonStartInventory > 0 ? (scenarioEnd / seasonStartInventory) * 100 : 0;

  weekLabelEl.textContent = `Week ${currentSeasonWeek} of ${SEASON_WEEKS}`;
  startEl.textContent = `${formatNumber(seasonStartInventory)} units`;
  currentEl.textContent = `${formatNumber(currentInventory)} units`;
  baseEndEl.textContent = `${formatNumber(baselineEnd)} units`;
  scenarioEndEl.textContent = `${formatNumber(scenarioEnd)} units`;

  if (scenarioEnd < baselineEnd) {
    guidanceEl.innerHTML =
      `<strong>In-season pivot:</strong> current promo plan improves week-${SEASON_WEEKS} clearance by <strong>${formatNumber(baselineEnd - scenarioEnd)}</strong> units. ` +
      `If we normalize start inventory to 100 units, baseline ends at ${baselineNorm100.toFixed(1)} and scenario ends at ${scenarioNorm100.toFixed(1)} units.`;
  } else if (scenarioEnd > baselineEnd) {
    guidanceEl.innerHTML =
      `<strong>Warning:</strong> scenario leaves <strong>${formatNumber(scenarioEnd - baselineEnd)}</strong> more units than baseline by week ${SEASON_WEEKS}. ` +
      `If normalized to 100 start units, scenario ends at ${scenarioNorm100.toFixed(1)} vs ${baselineNorm100.toFixed(1)} in baseline.`;
  } else {
    guidanceEl.innerHTML =
      `<strong>Status:</strong> scenario and baseline end at a similar week-${SEASON_WEEKS} inventory position. ` +
      `Normalized to 100 start units, both paths end near ${baselineNorm100.toFixed(1)}.`;
  }
}

function updateInventoryProjectionChart(groupLift = { mass: 1, prestige: 1 }) {
  const noteEl = document.getElementById('channel-promo-inventory-note');
  const ctx = document.getElementById('channel-promo-inventory-chart');
  if (!ctx || !noteEl) return;

  const { group, sku } = getSelectedFilters();
  const applyMass = document.getElementById('channel-promo-apply-mass')?.checked ?? true;
  const applyPrestige = document.getElementById('channel-promo-apply-prestige')?.checked ?? true;

  const allRows = skuWeeklyData.filter(row => {
    if (group !== 'all' && row.product_group !== group) return false;
    if (sku !== 'all' && row.sku_id !== sku) return false;
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });

  const currentRows = allRows.filter(row => Number(row.week_of_season) === currentSeasonWeek);
  const startingInventory = currentRows.reduce(
    (sum, row) => sum + (Number(row.end_inventory_units) || 0),
    0
  );

  let baselineInv = startingInventory;
  let scenarioInv = startingInventory;
  const labels = [`W${currentSeasonWeek}`];
  const baselineSeries = [baselineInv];
  const scenarioSeries = [scenarioInv];

  for (let w = currentSeasonWeek + 1; w <= SEASON_WEEKS; w += 1) {
    const weekRows = allRows.filter(row => Number(row.week_of_season) === w);
    const baselineDemand = weekRows.reduce((sum, row) => sum + (Number(row.net_units_sold) || 0), 0);
    const scenarioDemand = weekRows.reduce((sum, row) => {
      const baseUnits = Number(row.net_units_sold) || 0;
      const multiplier = row.channel_group === 'prestige'
        ? Number(groupLift.prestige || 1)
        : Number(groupLift.mass || 1);
      return sum + (baseUnits * multiplier);
    }, 0);
    baselineInv = Math.max(0, baselineInv - baselineDemand);
    scenarioInv = Math.max(0, scenarioInv - scenarioDemand);
    labels.push(`W${w}`);
    baselineSeries.push(Math.round(baselineInv));
    scenarioSeries.push(Math.round(scenarioInv));
  }

  if (channelPromoInventoryChart) {
    channelPromoInventoryChart.data.labels = labels;
    channelPromoInventoryChart.data.datasets[0].data = baselineSeries;
    channelPromoInventoryChart.data.datasets[1].data = scenarioSeries;
    channelPromoInventoryChart.update();
  } else if (window.Chart) {
    channelPromoInventoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Baseline inventory',
            data: baselineSeries,
            borderColor: 'rgba(99, 102, 241, 0.9)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            fill: false,
            tension: 0.25
          },
          {
            label: 'Scenario inventory',
            data: scenarioSeries,
            borderColor: 'rgba(16, 185, 129, 0.95)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: false,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  const baselineEnd = baselineSeries[baselineSeries.length - 1] || 0;
  const scenarioEnd = scenarioSeries[scenarioSeries.length - 1] || 0;
  noteEl.textContent =
    `Start inventory now: ${formatNumber(startingInventory)} units. ` +
    `Projected week-${SEASON_WEEKS} left: baseline ${formatNumber(baselineEnd)}, scenario ${formatNumber(scenarioEnd)}.`;

  return {
    startingInventory,
    baselineEnd,
    scenarioEnd,
    seasonRows: allRows
  };
}

function getHistoricalUnderperformerSet() {
  const counts = {};
  Object.values(promoMetadata || {}).forEach(promo => {
    (promo.sku_results || []).forEach(row => {
      const skuId = row.sku_id;
      const uplift = Number(row.sales_uplift_pct || 0);
      if (row.outcome === 'down' || uplift < 0) {
        counts[skuId] = (counts[skuId] || 0) + 1;
      }
    });
  });
  return new Set(Object.keys(counts));
}

function updateAiRecommendation(rows, objectiveKey, socialScore, inventoryProjection) {
  const summaryEl = document.getElementById('channel-promo-ai-summary');
  const includeEl = document.getElementById('channel-promo-ai-include');
  const excludeEl = document.getElementById('channel-promo-ai-exclude');
  const riskEl = document.getElementById('channel-promo-ai-risks');
  if (!summaryEl || !includeEl || !excludeEl || !riskEl) return;

  const underperformers = getHistoricalUnderperformerSet();
  const objectiveWeights = {
    balance: { inv: 1.0, elast: 1.0, gap: 1.0 },
    sales: { inv: 1.1, elast: 1.2, gap: 1.1 },
    profit: { inv: 0.7, elast: 0.75, gap: 0.8 }
  };
  const weights = objectiveWeights[objectiveKey] || objectiveWeights.balance;

  const skuMap = new Map();
  rows.forEach(row => {
    const key = row.sku_id;
    if (!skuMap.has(key)) {
      skuMap.set(key, {
        sku_id: row.sku_id,
        sku_name: row.sku_name,
        inventory: 0,
        elasticity: 0,
        gap: 0,
        count: 0
      });
    }
    const entry = skuMap.get(key);
    entry.inventory += Number(row.end_inventory_units || 0);
    entry.elasticity += Math.abs(Number(row.base_elasticity || 0));
    entry.gap += Number(row.price_gap_vs_competitor || 0);
    entry.count += 1;
  });

  const ranked = [...skuMap.values()].map(entry => {
    const avgElasticity = entry.count ? entry.elasticity / entry.count : 0;
    const avgGap = entry.count ? entry.gap / entry.count : 0;
    let score = 0;
    const reasons = [];

    if (entry.inventory >= 180) {
      score += 2.0 * weights.inv;
      reasons.push('high inventory');
    }
    if (avgElasticity >= 1.8) {
      score += 2.0 * weights.elast;
      reasons.push('elastic response');
    } else {
      score -= 0.8 * weights.elast;
      reasons.push('less elastic');
    }
    if (avgGap > 0.02) {
      score += 1.4 * weights.gap;
      reasons.push('above competitor');
    }
    if (underperformers.has(entry.sku_id)) {
      score -= 1.8;
      reasons.push('past underperformance');
    }
    if (Number.isFinite(socialScore) && socialScore >= 75 && avgElasticity < 1.5) {
      score -= 1.2;
      reasons.push('strong social hold-price signal');
    }

    return {
      ...entry,
      avgElasticity,
      avgGap,
      score,
      reasons
    };
  }).sort((a, b) => b.score - a.score);

  const include = ranked.filter(x => x.score >= 1.5).slice(0, 3);
  const exclude = ranked.filter(x => x.score < 1.5).slice(0, 3);

  const projectedEnd = Number(inventoryProjection?.scenarioEnd || 0);
  const totalCurrentInv = ranked.reduce((s, r) => s + r.inventory, 0);
  const clearancePct = totalCurrentInv > 0
    ? ((totalCurrentInv - projectedEnd) / totalCurrentInv) * 100
    : 0;

  summaryEl.textContent = `Objective: ${OBJECTIVE_CONFIG[objectiveKey]?.label || objectiveKey}. Forecast clearance by week ${SEASON_WEEKS}: ${clearancePct.toFixed(1)}% of currently selected inventory.`;
  includeEl.textContent = include.length
    ? include.map(x => `${x.sku_name || x.sku_id} (${x.reasons[0] || 'fit'})`).join(', ')
    : 'No strong promo candidates.';
  excludeEl.textContent = exclude.length
    ? exclude.map(x => `${x.sku_name || x.sku_id} (${x.reasons[0] || 'hold'})`).join(', ')
    : 'No SKU exclusions suggested.';

  const riskBits = [];
  if (projectedEnd > 0) riskBits.push(`${formatNumber(projectedEnd)} units may remain by week ${SEASON_WEEKS}`);
  if (Number.isFinite(socialScore) && socialScore >= 75) riskBits.push('high social score favors selective discounting');
  if (ranked.some(x => x.avgGap > 0.05)) riskBits.push('some SKUs are materially above competitor pricing');
  riskEl.textContent = riskBits.length ? riskBits.join('; ') : 'No immediate risk flags.';
}

function updateChannelPromoSimulator() {
  if (!baseline || !skuWeeklyData.length) return;

  const massPromo = Number(document.getElementById('mass-promo-slider')?.value || 0);
  const prestigePromo = Number(document.getElementById('prestige-promo-slider')?.value || 0);
  const skuBoostPct = Number(document.getElementById('channel-promo-sku-boost-slider')?.value || 0);
  const competitorShockPct = Number(document.getElementById('channel-promo-comp-shock')?.value || 0);
  const socialShockPts = Number(document.getElementById('channel-promo-social-shock')?.value || 0);
  const objectiveKey = document.getElementById('channel-promo-objective')?.value || 'balance';
  const objective = OBJECTIVE_CONFIG[objectiveKey] || OBJECTIVE_CONFIG.balance;
  const applyMass = document.getElementById('channel-promo-apply-mass')?.checked ?? true;
  const applyPrestige = document.getElementById('channel-promo-apply-prestige')?.checked ?? true;
  const { group, sku } = getSelectedFilters();

  const rows = getCurrentWeekRows().filter(row => {
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });
  if (!rows.length) return;

  const { score: baseSocialScore } = getSocialSummary();
  const fallbackSocialStats = rows.reduce((acc, row) => {
    const normalized = normalizeSocialScore(row.social_engagement_score);
    if (Number.isFinite(normalized)) {
      acc.sum += normalized;
      acc.count += 1;
    }
    return acc;
  }, { sum: 0, count: 0 });
  const fallbackSocialScore = fallbackSocialStats.count > 0
    ? (fallbackSocialStats.sum / fallbackSocialStats.count)
    : null;
  const referenceSocialScore = Number.isFinite(baseSocialScore)
    ? baseSocialScore
    : (Number.isFinite(fallbackSocialScore) ? fallbackSocialScore : null);
  const socialScore = Number.isFinite(referenceSocialScore)
    ? referenceSocialScore + socialShockPts
    : null;

  const scenarios = rows.map(row => {
    const baseDepth = row.channel_group === 'mass' ? massPromo : prestigePromo;
    const depth = (sku !== 'all' && row.sku_id === sku)
      ? baseDepth + skuBoostPct
      : baseDepth;
    return computeScenarioForRow(row, depth, objectiveKey, socialScore, competitorShockPct);
  });
  const noActionScenarios = rows.map(row =>
    computeScenarioForRow(row, 0, objectiveKey, socialScore, competitorShockPct)
  );

  const cannibalizationTransfers = applyCannibalizationTransfers(scenarios, objectiveKey, sku, skuBoostPct);

  const totals = scenarios.reduce(
    (acc, row) => {
      acc.baselineRevenue += row.baselineRevenue;
      acc.baselineProfit += row.baselineProfit;
      acc.scenarioRevenue += row.scenarioRevenue;
      acc.scenarioProfit += row.scenarioProfit;
      acc.baselineUnits += row.baselineUnits;
      acc.scenarioUnits += row.scenarioUnits;
      acc[row.group].baselineRevenue += row.baselineRevenue;
      acc[row.group].baselineProfit += row.baselineProfit;
      acc[row.group].scenarioRevenue += row.scenarioRevenue;
      acc[row.group].scenarioProfit += row.scenarioProfit;
      acc[row.group].baselineUnits += row.baselineUnits;
      acc[row.group].scenarioUnits += row.scenarioUnits;
      return acc;
    },
    {
      baselineRevenue: 0,
      baselineProfit: 0,
      scenarioRevenue: 0,
      scenarioProfit: 0,
      baselineUnits: 0,
      scenarioUnits: 0,
      mass: { baselineRevenue: 0, baselineProfit: 0, scenarioRevenue: 0, scenarioProfit: 0, baselineUnits: 0, scenarioUnits: 0 },
      prestige: { baselineRevenue: 0, baselineProfit: 0, scenarioRevenue: 0, scenarioProfit: 0, baselineUnits: 0, scenarioUnits: 0 }
    }
  );

  const revenueDeltaPct = totals.baselineRevenue > 0
    ? (totals.scenarioRevenue - totals.baselineRevenue) / totals.baselineRevenue
    : 0;
  const profitDeltaPct = totals.baselineProfit > 0
    ? (totals.scenarioProfit - totals.baselineProfit) / totals.baselineProfit
    : 0;
  const liftFactor = totals.baselineUnits > 0 ? totals.scenarioUnits / totals.baselineUnits : 1;
  const groupLift = {
    mass: totals.mass.baselineUnits > 0 ? (totals.mass.scenarioUnits / totals.mass.baselineUnits) : 1,
    prestige: totals.prestige.baselineUnits > 0 ? (totals.prestige.scenarioUnits / totals.prestige.baselineUnits) : 1
  };

  const revenueDeltaEl = document.getElementById('channel-promo-revenue-delta');
  const revenueNoteEl = document.getElementById('channel-promo-revenue-note');
  const profitDeltaEl = document.getElementById('channel-promo-profit-delta');
  const profitNoteEl = document.getElementById('channel-promo-profit-note');

  if (revenueDeltaEl && revenueNoteEl) {
    revenueDeltaEl.textContent = formatPercent(revenueDeltaPct);
    revenueDeltaEl.className = `fs-4 fw-bold ${revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
    revenueNoteEl.textContent = `Baseline = ${formatCurrency(totals.baselineRevenue)}`;
  }
  if (profitDeltaEl && profitNoteEl) {
    profitDeltaEl.textContent = formatPercent(profitDeltaPct);
    profitDeltaEl.className = `fs-4 fw-bold ${profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
    profitNoteEl.textContent = `Baseline = ${formatCurrency(totals.baselineProfit)}`;
  }

  const posturePill = document.getElementById('channel-promo-posture-pill');
  const postureLine1 = document.getElementById('channel-promo-posture-line1');
  const postureLine2 = document.getElementById('channel-promo-posture-line2');
  if (posturePill && postureLine1 && postureLine2) {
    let posture = 'Balanced';
    let pillClass = 'badge rounded-pill bg-secondary-subtle text-body-secondary';
    if (revenueDeltaPct >= 0 && profitDeltaPct >= 0) {
      posture = 'Win-Win';
      pillClass = 'badge rounded-pill bg-success-subtle text-success';
    } else if (revenueDeltaPct > 0 && profitDeltaPct < 0) {
      posture = 'Volume Defense';
      pillClass = 'badge rounded-pill bg-primary-subtle text-primary';
    } else if (revenueDeltaPct <= 0 && profitDeltaPct > 0) {
      posture = 'Margin Guard';
      pillClass = 'badge rounded-pill bg-warning-subtle text-warning';
    } else {
      posture = 'Unfavorable';
      pillClass = 'badge rounded-pill bg-danger-subtle text-danger';
    }
    posturePill.className = pillClass;
    posturePill.textContent = posture;
    postureLine1.textContent = `${objective.label}.`;
    postureLine2.textContent =
      `Projected unit lift vs baseline: ${formatPercent((liftFactor - 1) || 0)}. ` +
      `Competitor shock ${competitorShockPct >= 0 ? '+' : ''}${competitorShockPct}%, social shock ${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts.`;
  }

  const labels = ['Mass Channel', 'Prestige Channel'];
  const revenueBaselineData = [totals.mass.baselineRevenue, totals.prestige.baselineRevenue];
  const revenueScenarioData = [totals.mass.scenarioRevenue, totals.prestige.scenarioRevenue];
  const profitBaselineData = [totals.mass.baselineProfit, totals.prestige.baselineProfit];
  const profitScenarioData = [totals.mass.scenarioProfit, totals.prestige.scenarioProfit];

  const revenueCtx = document.getElementById('channel-promo-revenue-chart');
  if (revenueCtx) {
    if (channelPromoRevenueChart) {
      channelPromoRevenueChart.data.datasets[0].data = revenueBaselineData;
      channelPromoRevenueChart.data.datasets[1].data = revenueScenarioData;
      channelPromoRevenueChart.update();
    } else if (window.Chart) {
      channelPromoRevenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Baseline', data: revenueBaselineData, backgroundColor: 'rgba(148, 163, 184, 0.8)' },
            { label: 'With promos', data: revenueScenarioData, backgroundColor: 'rgba(37, 99, 235, 0.9)' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  const profitCtx = document.getElementById('channel-promo-profit-chart');
  if (profitCtx) {
    if (channelPromoProfitChart) {
      channelPromoProfitChart.data.datasets[0].data = profitBaselineData;
      channelPromoProfitChart.data.datasets[1].data = profitScenarioData;
      channelPromoProfitChart.update();
    } else if (window.Chart) {
      channelPromoProfitChart = new Chart(profitCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Baseline', data: profitBaselineData, backgroundColor: 'rgba(148, 163, 184, 0.8)' },
            { label: 'With promos', data: profitScenarioData, backgroundColor: 'rgba(16, 185, 129, 0.9)' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }

  const inventoryProjection = updateInventoryProjectionChart(groupLift);
  const seasonRows = getSeasonRows({ group, sku, applyMass, applyPrestige });
  renderSeasonStory(seasonRows, inventoryProjection);
  renderDriverDecomposition(scenarios, cannibalizationTransfers);
  renderCannibalizationTable(cannibalizationTransfers);
  renderSkuResponseView(scenarios, noActionScenarios, cannibalizationTransfers, competitorShockPct, socialShockPts);
  updateSignalCards(socialShockPts);
  updateAiRecommendation(rows, objectiveKey, socialScore, inventoryProjection);

  const marketRow = externalFactors[externalFactors.length - 1] || {};
  latestPromoSnapshot = {
    weekOfSeason: currentSeasonWeek,
    objective: objectiveKey,
    selectedGroup: group,
    selectedSku: sku,
    applyMass,
    applyPrestige,
    massPromoDepthPct: massPromo,
    prestigePromoDepthPct: prestigePromo,
    baselineRevenue: totals.baselineRevenue,
    scenarioRevenue: totals.scenarioRevenue,
    baselineProfit: totals.baselineProfit,
    scenarioProfit: totals.scenarioProfit,
    revenueDeltaPct,
    profitDeltaPct,
    baselineUnits: totals.baselineUnits,
    scenarioUnits: totals.scenarioUnits,
    unitLiftPct: liftFactor - 1,
    skuBoostPct,
    competitorShockPct,
    socialShockPts,
    cannibalizationTransfers,
    avgCompetitorMassPrice: Number(marketRow.competitor_mass_price) || null,
    avgCompetitorPrestigePrice: Number(marketRow.competitor_prestige_price) || null,
    socialScore: Number(socialScore) || null,
    inventoryProjection,
    decomposition: {
      ownPromoPct: scenarios.reduce((sum, row) => sum + ((row.ownMultiplier - 1) * row.baselineUnits), 0) / (totals.baselineUnits || 1),
      competitorPct: scenarios.reduce((sum, row) => sum + ((row.competitorMultiplier - 1) * row.baselineUnits), 0) / (totals.baselineUnits || 1),
      socialPct: scenarios.reduce((sum, row) => sum + ((row.socialContributionPct || 0) * row.baselineUnits), 0) / (totals.baselineUnits || 1)
    }
  };
}

async function initializeChannelPromoSimulator() {
  const root = document.getElementById('channel-promo-simulator');
  if (!root) return;

  try {
    const [weeklyData, params, skuWeekly, external, social, promoMeta] = await Promise.all([
      getWeeklyData('all'),
      loadElasticityParams(),
      loadSkuWeeklyData(),
      loadExternalFactors(),
      loadSocialSignals(),
      loadPromoMetadata()
    ]);

    if (!weeklyData?.length || !skuWeekly?.length || !params) return;

    skuWeeklyData = skuWeekly;
    externalFactors = external || [];
    socialSignals = social || [];
    promoMetadata = promoMeta || {};

    const currentWeekRow = skuWeeklyData.find(row => row.is_current_week === true);
    if (currentWeekRow) currentSeasonWeek = Number(currentWeekRow.week_of_season);

    baseline = {
      massElasticity: params.tiers.ad_supported.base_elasticity,
      prestigeElasticity: params.tiers.ad_free.base_elasticity
    };

    populateSkuSelector();

    const massSlider = document.getElementById('mass-promo-slider');
    const prestigeSlider = document.getElementById('prestige-promo-slider');
    const objectiveSelect = document.getElementById('channel-promo-objective');
    const groupSelect = document.getElementById('channel-promo-product-group');
    const skuSelect = document.getElementById('channel-promo-sku');
    const skuBoostSlider = document.getElementById('channel-promo-sku-boost-slider');
    const compShockSlider = document.getElementById('channel-promo-comp-shock');
    const socialShockSlider = document.getElementById('channel-promo-social-shock');
    const presetBaselineBtn = document.getElementById('channel-promo-preset-baseline');
    const presetPivotBtn = document.getElementById('channel-promo-preset-pivot');
    const presetSocialBtn = document.getElementById('channel-promo-preset-social');
    const presetClearanceBtn = document.getElementById('channel-promo-preset-clearance');
    const narrativeNoteEl = document.getElementById('channel-promo-narrative-note');
    const applyMass = document.getElementById('channel-promo-apply-mass');
    const applyPrestige = document.getElementById('channel-promo-apply-prestige');
    const skuBoostValue = document.getElementById('channel-promo-sku-boost-value');
    const skuBoostHelp = document.getElementById('channel-promo-sku-boost-help');
    const compShockValue = document.getElementById('channel-promo-comp-shock-value');
    const socialShockValue = document.getElementById('channel-promo-social-shock-value');

    const updateSkuBoostState = () => {
      const selectedSku = skuSelect?.value || 'all';
      const isSpecificSku = selectedSku !== 'all';
      if (skuBoostSlider) {
        skuBoostSlider.disabled = !isSpecificSku;
        if (!isSpecificSku) skuBoostSlider.value = '0';
      }
      if (skuBoostValue) {
        const currentBoost = Number(skuBoostSlider?.value || 0);
        skuBoostValue.textContent = `${currentBoost}%`;
      }
      if (skuBoostHelp) {
        skuBoostHelp.textContent = isSpecificSku
          ? 'Extra discount on selected SKU shifts demand from sibling SKUs (cannibalization).'
          : 'Select one SKU above to model cannibalization shifts from sibling SKUs.';
      }
    };

    const updateValues = () => {
      const massVal = Number(massSlider?.value || 0);
      const prestigeVal = Number(prestigeSlider?.value || 0);
      const boostVal = Number(skuBoostSlider?.value || 0);
      const compShockVal = Number(compShockSlider?.value || 0);
      const socialShockVal = Number(socialShockSlider?.value || 0);
      document.getElementById('mass-promo-value').textContent = `${massVal}%`;
      document.getElementById('prestige-promo-value').textContent = `${prestigeVal}%`;
      if (skuBoostValue) skuBoostValue.textContent = `${boostVal}%`;
      if (compShockValue) compShockValue.textContent = `${compShockVal >= 0 ? '+' : ''}${compShockVal}%`;
      if (socialShockValue) socialShockValue.textContent = `${socialShockVal >= 0 ? '+' : ''}${socialShockVal} pts`;
      updateChannelPromoSimulator();
    };

    const setNarrative = (text) => {
      if (narrativeNoteEl) narrativeNoteEl.textContent = text;
    };

    const setControl = (el, value) => {
      if (!el) return;
      el.value = String(value);
    };

    const applyPreset = (type) => {
      if (type === 'baseline') {
        setControl(groupSelect, 'all');
        populateSkuSelector();
        setControl(skuSelect, 'all');
        setControl(massSlider, 0);
        setControl(prestigeSlider, 0);
        setControl(skuBoostSlider, 0);
        setControl(compShockSlider, 0);
        setControl(socialShockSlider, 0);
        setControl(objectiveSelect, 'balance');
        if (applyMass) applyMass.checked = true;
        if (applyPrestige) applyPrestige.checked = true;
        updateSkuBoostState();
        setNarrative('Start of Season: establish baseline inventory, channels, and elasticity response.');
      } else if (type === 'pivot') {
        setControl(groupSelect, 'sunscreen');
        populateSkuSelector();
        setControl(skuSelect, 'all');
        setControl(massSlider, 15);
        setControl(prestigeSlider, 0);
        setControl(skuBoostSlider, 0);
        setControl(compShockSlider, -15);
        setControl(socialShockSlider, 0);
        setControl(objectiveSelect, 'sales');
        if (applyMass) applyMass.checked = true;
        if (applyPrestige) applyPrestige.checked = false;
        updateSkuBoostState();
        setNarrative('In-Season Pivot: competitor drops prices in mass channels, so we run a defensive promotion.');
      } else if (type === 'social') {
        setControl(groupSelect, 'sunscreen');
        populateSkuSelector();
        setControl(skuSelect, 'SUN_S3');
        setControl(massSlider, 5);
        setControl(prestigeSlider, 0);
        setControl(skuBoostSlider, 0);
        setControl(compShockSlider, 0);
        setControl(socialShockSlider, 15);
        setControl(objectiveSelect, 'profit');
        if (applyMass) applyMass.checked = false;
        if (applyPrestige) applyPrestige.checked = true;
        updateSkuBoostState();
        setNarrative('Social Spike: momentum is strong, so hold selective SKUs and protect margin where elasticity is low.');
      } else if (type === 'clearance') {
        setControl(groupSelect, 'all');
        populateSkuSelector();
        setControl(skuSelect, 'SUN_S1');
        setControl(massSlider, 20);
        setControl(prestigeSlider, 10);
        setControl(skuBoostSlider, 8);
        setControl(compShockSlider, -5);
        setControl(socialShockSlider, -5);
        setControl(objectiveSelect, 'sales');
        if (applyMass) applyMass.checked = true;
        if (applyPrestige) applyPrestige.checked = true;
        updateSkuBoostState();
        setNarrative(`Future Vision: push a guided SKU mix to move inventory close to zero by week ${SEASON_WEEKS}.`);
      }
      updateValues();
    };

    massSlider?.addEventListener('input', updateValues);
    prestigeSlider?.addEventListener('input', updateValues);
    skuBoostSlider?.addEventListener('input', updateValues);
    compShockSlider?.addEventListener('input', updateValues);
    socialShockSlider?.addEventListener('input', updateValues);
    objectiveSelect?.addEventListener('change', updateChannelPromoSimulator);
    groupSelect?.addEventListener('change', () => {
      populateSkuSelector();
      updateSkuBoostState();
      updateChannelPromoSimulator();
    });
    skuSelect?.addEventListener('change', () => {
      updateSkuBoostState();
      updateChannelPromoSimulator();
    });
    presetBaselineBtn?.addEventListener('click', () => applyPreset('baseline'));
    presetPivotBtn?.addEventListener('click', () => applyPreset('pivot'));
    presetSocialBtn?.addEventListener('click', () => applyPreset('social'));
    presetClearanceBtn?.addEventListener('click', () => applyPreset('clearance'));
    applyMass?.addEventListener('change', updateChannelPromoSimulator);
    applyPrestige?.addEventListener('change', updateChannelPromoSimulator);

    updateSkuBoostState();
    updateValues();
  } catch (error) {
    console.error('Error initializing Channel Promotions Simulator:', error);
  }
}

window.initializeChannelPromoSimulator = initializeChannelPromoSimulator;
window.getChannelPromoSnapshot = () => latestPromoSnapshot;
