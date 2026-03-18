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
  loadPromoMetadata,
  loadEventCalendar,
  loadCompetitorPriceFeed
} from './data-loader.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

let channelPromoRevenueChart = null;
let channelPromoProfitChart = null;
let channelPromoInventoryChart = null;
let channelPromoSkuResponseChart = null;
let channelPromoWaterfallChart = null;
let channelPromoFrontierChart = null;
let channelPromoLivePulseChart = null;

let baseline = null;
let skuWeeklyData = [];
let externalFactors = [];
let socialSignals = [];
let retailEvents = [];
let promoMetadata = {};
let currentSeasonWeek = 7;
let latestPromoSnapshot = null;
let latestRecommendation = null;
let livePlaybackTimer = null;
const DEFAULT_SEASON_WEEKS = 17;
const PLANNING_HORIZON_PRESETS = [8, 12, 17, 24];
let planningHorizonWeeks = DEFAULT_SEASON_WEEKS;
let maxObservedSeasonWeek = DEFAULT_SEASON_WEEKS;

function getSeasonWeeks() {
  return Math.max(1, Number(planningHorizonWeeks) || DEFAULT_SEASON_WEEKS);
}

function normalizePlanningHorizonWeeks(raw, maxWeek = maxObservedSeasonWeek) {
  const maxAllowed = Math.max(1, Number(maxWeek) || DEFAULT_SEASON_WEEKS);
  const allowedValues = [...PLANNING_HORIZON_PRESETS];
  const numeric = Math.round(Number(raw));
  if (!Number.isFinite(numeric)) {
    if (allowedValues.includes(DEFAULT_SEASON_WEEKS)) return DEFAULT_SEASON_WEEKS;
    if (DEFAULT_SEASON_WEEKS > maxAllowed) return allowedValues[allowedValues.length - 1];
    return allowedValues[0];
  }
  return allowedValues.reduce((closest, current) => {
    const currentDistance = Math.abs(current - numeric);
    const closestDistance = Math.abs(closest - numeric);
    return currentDistance < closestDistance ? current : closest;
  }, allowedValues[0]);
}

function applyPlanningHorizonLabels() {
  const horizon = getSeasonWeeks();
  const liveLeftLabelEl = document.getElementById('channel-promo-live-leftover-label');
  const baselineLabelEl = document.getElementById('channel-promo-season-end-baseline-label');
  const scenarioLabelEl = document.getElementById('channel-promo-season-end-scenario-label');
  const inventoryTitleEl = document.getElementById('channel-promo-inventory-chart-title');
  const frontierTitleEl = document.getElementById('channel-promo-frontier-title');
  const frontierHeaderEl = document.getElementById('channel-promo-frontier-leftover-header');
  const horizonInputEl = document.getElementById('channel-promo-horizon-input');
  const horizonHelpEl = document.getElementById('channel-promo-horizon-help');

  if (liveLeftLabelEl) liveLeftLabelEl.textContent = `Week-${horizon} Left`;
  if (baselineLabelEl) baselineLabelEl.textContent = `Week-${horizon} baseline leftover`;
  if (scenarioLabelEl) scenarioLabelEl.textContent = `Week-${horizon} scenario leftover`;
  if (inventoryTitleEl) inventoryTitleEl.textContent = `${horizon}-Week Inventory Projection (Baseline vs Scenario)`;
  if (frontierTitleEl) frontierTitleEl.textContent = `Objective Frontier (Revenue vs Profit vs Week-${horizon} Leftover)`;
  if (frontierHeaderEl) frontierHeaderEl.textContent = `Week-${horizon} Leftover`;
  if (horizonInputEl) horizonInputEl.value = String(horizon);
  if (horizonHelpEl) {
    horizonHelpEl.textContent = `Default is 17. Current horizon is ${horizon} week${horizon === 1 ? '' : 's'}.`;
  }
}

function populatePlanningHorizonOptions(maxWeek = maxObservedSeasonWeek, selectedWeek = null) {
  const horizonInputEl = document.getElementById('channel-promo-horizon-input');
  if (!horizonInputEl) return;

  const maxAllowed = Math.max(1, Number(maxWeek) || DEFAULT_SEASON_WEEKS);
  const allowedValues = [...PLANNING_HORIZON_PRESETS];
  const desiredWeek = Number.isFinite(Number(selectedWeek))
    ? Number(selectedWeek)
    : Number(horizonInputEl.value || planningHorizonWeeks || DEFAULT_SEASON_WEEKS);
  const normalizedWeek = normalizePlanningHorizonWeeks(desiredWeek, maxAllowed);

  const optionsHtml = allowedValues.map(week => {
    const suffix = week === 1 ? 'week' : 'weeks';
    return `<option value="${week}">${week} ${suffix}</option>`;
  }).join('');
  horizonInputEl.innerHTML = optionsHtml;
  horizonInputEl.value = String(normalizedWeek);
}

function setPlanningHorizonWeeks(rawWeeks, options = {}) {
  const normalized = normalizePlanningHorizonWeeks(rawWeeks, options.maxWeekObserved);
  planningHorizonWeeks = normalized;
  window.promoPlanningHorizonWeeks = normalized;
  populatePlanningHorizonOptions(options.maxWeekObserved || maxObservedSeasonWeek, normalized);
  applyPlanningHorizonLabels();
  if (options.emit !== false) {
    window.dispatchEvent(new CustomEvent('promo:horizon-change', { detail: { weeks: normalized } }));
  }
  return normalized;
}

window.getPromoPlanningHorizonWeeks = () => getSeasonWeeks();
window.setPromoPlanningHorizonWeeks = (weeks, options = {}) => setPlanningHorizonWeeks(weeks, options);

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

function quantizeToStep(value, step = 5) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || step <= 0) return 0;
  return Math.round(raw / step) * step;
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

function getSeasonDateForWeek(weekOfSeason) {
  const week = Number(weekOfSeason);
  const row = skuWeeklyData.find(r => Number(r.week_of_season) === week);
  return row?.date || null;
}

function getExternalFactorsForWeek(weekOfSeason) {
  if (!externalFactors.length) return null;
  const seasonDate = getSeasonDateForWeek(weekOfSeason);
  if (seasonDate) {
    const exact = externalFactors.find(row => row.date === seasonDate);
    if (exact) return exact;
  }
  const idx = clamp(Number(weekOfSeason) - 1, 0, externalFactors.length - 1);
  return externalFactors[idx] || externalFactors[externalFactors.length - 1];
}

function getSocialSignalForWeek(weekOfSeason) {
  if (!socialSignals.length) return null;
  const seasonDate = getSeasonDateForWeek(weekOfSeason);
  if (seasonDate) {
    const exact = socialSignals.find(row => row.date === seasonDate);
    if (exact) return exact;
  }
  const idx = clamp(Number(weekOfSeason) - 1, 0, socialSignals.length - 1);
  return socialSignals[idx] || socialSignals[socialSignals.length - 1];
}

function getEventsForWeek(weekOfSeason) {
  if (!retailEvents.length) return [];
  const seasonDate = getSeasonDateForWeek(weekOfSeason);
  if (!seasonDate) return [];
  return retailEvents.filter(event => event.date === seasonDate);
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

function getSocialSummaryForWeek(weekOfSeason) {
  if (!socialSignals.length) {
    return { score: null, trendDelta: null };
  }
  const week = Number(weekOfSeason);
  if (!Number.isFinite(week)) return getSocialSummary();

  const idx = clamp(Math.round(week) - 1, 0, socialSignals.length - 1);
  const current = socialSignals[idx];
  const prev = socialSignals[Math.max(0, idx - 1)] || current;
  const score = normalizeSocialScore(current?.brand_social_index ?? current?.social_sentiment ?? 0);
  const prevScore = normalizeSocialScore(prev?.brand_social_index ?? prev?.social_sentiment ?? 0);
  if (!Number.isFinite(score) || !Number.isFinite(prevScore)) {
    return { score: null, trendDelta: null };
  }
  return { score, trendDelta: score - prevScore };
}

function getSocialElasticityModifier(score) {
  if (!Number.isFinite(score)) return 1.0;
  const clipped = clamp(score, 35, 95);
  // Continuous response so +/-5 shock always creates a visible change.
  return clamp(1.2 - ((clipped - 35) * 0.0085), 0.7, 1.28);
}

function getSocialDemandMultiplier(score) {
  if (!Number.isFinite(score)) return 1.0;
  const clipped = clamp(score, 35, 95);
  // Captures baseline demand lift/drop from social momentum even without price moves.
  return clamp(0.78 + ((clipped - 35) * 0.008), 0.72, 1.26);
}

function computeScenarioForRow(
  row,
  promoDepthPct,
  objectiveKey,
  socialScore,
  competitorShockPct = 0,
  socialReferenceScore = null,
  compShockProductFilter = 'all'
) {
  const objective = OBJECTIVE_CONFIG[objectiveKey] || OBJECTIVE_CONFIG.balance;
  const promoFrac = promoDepthPct / 100;
  const newPrice = row.list_price * (1 - promoFrac);
  const baselinePrice = row.effective_price || row.list_price;
  const priceRatio = baselinePrice > 0 ? newPrice / baselinePrice : 1;

  const baseElasticity = Number(row.base_elasticity) || -1.8;
  const socialElasticityModifier = getSocialElasticityModifier(socialScore);
  const effectiveElasticity = baseElasticity * socialElasticityModifier;
  const baselineSocialScore = Number.isFinite(Number(socialReferenceScore))
    ? Number(socialReferenceScore)
    : normalizeSocialScore(row.social_engagement_score);
  const baselineSocialDemand = getSocialDemandMultiplier(baselineSocialScore);
  const scenarioSocialDemand = getSocialDemandMultiplier(socialScore);
  const socialDemandMultiplier = baselineSocialDemand > 0
    ? (scenarioSocialDemand / baselineSocialDemand)
    : 1;

  const rawCompetitorPrice = Number(row.competitor_price) || newPrice;
  const shockApplies = compShockProductFilter === 'all'
    || row.product_group === compShockProductFilter
    || row.sku_id === compShockProductFilter;
  const effectiveShock = shockApplies ? competitorShockPct : 0;
  const competitorPrice = rawCompetitorPrice * (1 + effectiveShock / 100);
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
  // Promo margin erosion: discount reduces margin because COGS stays fixed.
  // At baseline price P with margin M, COGS = P*(1-M).
  // At promo price P*(1-d), new margin = 1 - COGS/(P*(1-d)) = 1 - (1-M)/(1-d).
  const promoFracForMargin = promoFrac > 0 ? promoFrac : 0;
  const cogsRatio = 1 - marginPctBase;
  const marginPctScenario = promoFracForMargin > 0
    ? clamp(1 - cogsRatio / (1 - promoFracForMargin) + objective.marginAdjustment, 0.05, 0.75)
    : clamp(marginPctBase + objective.marginAdjustment, 0.05, 0.75);

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
    scenarioUnits: unitsScenario,
    rawCannibalizedOutUnits: Number(row.cannibalized_out_units) || 0
  };
}

function populateSkuSelector() {
  const skuSelect = document.getElementById('channel-promo-sku');
  const groupSelect = document.getElementById('channel-promo-product-group');
  if (!skuSelect || !groupSelect) return;

  const selectedGroup = groupSelect.value || 'all';
  const profileMap = new Map();
  skuWeeklyData
    .filter(row => Number(row.week_of_season) === currentSeasonWeek)
    .filter(row => selectedGroup === 'all' || row.product_group === selectedGroup)
    .forEach(row => {
      if (!profileMap.has(row.sku_id)) {
        profileMap.set(row.sku_id, {
          skuId: row.sku_id,
          skuName: row.sku_name || row.sku_id,
          productGroup: String(row.product_group || '')
        });
      }
    });
  const skus = [...profileMap.values()].sort((a, b) => {
    const groupCmp = a.productGroup.localeCompare(b.productGroup);
    if (groupCmp !== 0) return groupCmp;
    return a.skuName.localeCompare(b.skuName);
  });

  const previousValue = skuSelect.value || 'all';
  skuSelect.innerHTML = '<option value="all" selected>All Products in Selection</option>';
  skus.forEach(item => {
    const skuId = item.skuId;
    const skuName = item.skuName;
    const groupLabel = item.productGroup
      ? `${item.productGroup.charAt(0).toUpperCase()}${item.productGroup.slice(1)}`
      : 'Product';
    const option = document.createElement('option');
    option.value = skuId;
    option.textContent = `${skuName} (${groupLabel})`;
    skuSelect.appendChild(option);
  });

  if ([...skuSelect.options].some(opt => opt.value === previousValue)) {
    skuSelect.value = previousValue;
  }
}

function updateSignalCards(socialShockPts = 0, socialBaseScore = null, socialTrendDelta = null) {
  const skuPriceBody = document.getElementById('channel-promo-sku-price-body');
  const socialScoreEl = document.getElementById('channel-promo-social-score');
  if (!socialScoreEl) return;

  // --- Populate per-SKU competitor price table (aggregated by SKU + channel group) ---
  if (skuPriceBody) {
    const weekRows = getCurrentWeekRows();
    if (weekRows && weekRows.length > 0) {
      // Aggregate rows: average across sales channels within same SKU + channel group
      const grouped = new Map();
      weekRows.forEach(row => {
        const key = `${row.sku_id}|${row.channel_group}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            sku_name: row.sku_name,
            channel_group: row.channel_group,
            listPrices: [],
            compPrices: [],
            gaps: []
          });
        }
        const entry = grouped.get(key);
        if (Number.isFinite(Number(row.list_price))) entry.listPrices.push(Number(row.list_price));
        if (Number.isFinite(Number(row.competitor_price))) entry.compPrices.push(Number(row.competitor_price));
        if (Number.isFinite(Number(row.price_gap_vs_competitor))) entry.gaps.push(Number(row.price_gap_vs_competitor));
      });

      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      skuPriceBody.innerHTML = [...grouped.values()].map(entry => {
        const ourPrice = avg(entry.listPrices);
        const compPrice = avg(entry.compPrices);
        const gap = avg(entry.gaps);
        const gapDisplay = Number.isFinite(gap)
          ? `<span style="color:${gap >= 0 ? 'var(--bs-success)' : 'var(--bs-danger)'}">${formatPercent(gap)}</span>`
          : '--';
        const channelLabel = entry.channel_group === 'mass' ? 'Mass' : 'Prestige';
        return `<tr>
          <td>${entry.sku_name || '--'}</td>
          <td>${channelLabel}</td>
          <td class="text-end">${Number.isFinite(ourPrice) ? formatCurrency(ourPrice) : '--'}</td>
          <td class="text-end">${Number.isFinite(compPrice) ? formatCurrency(compPrice) : '--'}</td>
          <td class="text-end">${gapDisplay}</td>
        </tr>`;
      }).join('');
    } else {
      skuPriceBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">--</td></tr>';
    }
  }

  // --- Social engagement score & channel breakdown ---
  const currentWeekSocial = getSocialSignalForWeek(currentSeasonWeek);
  const { score, trendDelta } = getSocialSummary();
  const baseScore = Number.isFinite(Number(socialBaseScore))
    ? Number(socialBaseScore)
    : normalizeSocialScore(currentWeekSocial?.brand_social_index ?? currentWeekSocial?.social_sentiment ?? score);
  const baseTrendDelta = Number.isFinite(Number(socialTrendDelta))
    ? Number(socialTrendDelta)
    : trendDelta;
  const socialTrendBadge = document.getElementById('channel-promo-social-trend-badge');
  const socialShock = clamp(Number(socialShockPts) || 0, -20, 20);

  const buildScenarioSocialSnapshot = (row, shockPts, fallbackScore) => {
    if (!row) return null;

    const shock = clamp(Number(shockPts) || 0, -20, 20);
    const platformConfigs = [
      { key: 'tiktok', mentionWeight: 1.18, rateWeight: 1.15 },
      { key: 'instagram', mentionWeight: 0.96, rateWeight: 0.92 },
      { key: 'youtube', mentionWeight: 0.74, rateWeight: 0.82 },
      { key: 'twitter', mentionWeight: 0.58, rateWeight: 0.68 }
    ];

    const baseSentiment = Number(row.social_sentiment);
    const scenarioSentiment = Number.isFinite(baseSentiment)
      ? clamp(baseSentiment + shock * 0.0042, 0.2, 0.95)
      : null;
    const effectiveScore = Number.isFinite(Number(fallbackScore))
      ? clamp(Number(fallbackScore) + shock, 20, 98)
      : normalizeSocialScore(row.brand_social_index ?? row.social_sentiment ?? null);

    const platforms = platformConfigs.map(config => {
      const baseMentions = Number(row[`${config.key}_mentions`]);
      const baseRate = Number(row[`${config.key}_engagement_rate`]);
      const mentionMultiplier = clamp(
        1 + (shock / 100) * config.mentionWeight + (Number.isFinite(baseSentiment) && Number.isFinite(scenarioSentiment) ? (scenarioSentiment - baseSentiment) * 0.4 : 0),
        0.52,
        1.58
      );
      const adjustedMentions = Number.isFinite(baseMentions)
        ? Math.max(0, Math.round(baseMentions * mentionMultiplier))
        : null;
      const adjustedRate = Number.isFinite(baseRate)
        ? clamp(baseRate + shock * 0.06 * config.rateWeight, 0.2, 18)
        : null;

      return {
        key: config.key,
        mentions: adjustedMentions,
        rate: adjustedRate,
        baseMentions,
        baseRate
      };
    });

    const totalBaseMentions = platforms.reduce((sum, item) => sum + (Number.isFinite(item.baseMentions) ? item.baseMentions : 0), 0);
    const totalScenarioMentions = platforms.reduce((sum, item) => sum + (Number.isFinite(item.mentions) ? item.mentions : 0), 0);
    const baseWeightedRate = totalBaseMentions > 0
      ? platforms.reduce((sum, item) => sum + ((Number.isFinite(item.baseMentions) ? item.baseMentions : 0) * (Number.isFinite(item.baseRate) ? item.baseRate : 0)), 0) / totalBaseMentions
      : null;
    const scenarioWeightedRate = totalScenarioMentions > 0
      ? platforms.reduce((sum, item) => sum + ((Number.isFinite(item.mentions) ? item.mentions : 0) * (Number.isFinite(item.rate) ? item.rate : 0)), 0) / totalScenarioMentions
      : null;

    const mentionLift = totalBaseMentions > 0 ? totalScenarioMentions / totalBaseMentions : 1;
    const engagementLift = Number.isFinite(baseWeightedRate) && baseWeightedRate > 0 && Number.isFinite(scenarioWeightedRate)
      ? scenarioWeightedRate / baseWeightedRate
      : 1;
    const sentimentLift = Number.isFinite(baseSentiment) && baseSentiment > 0 && Number.isFinite(scenarioSentiment)
      ? scenarioSentiment / baseSentiment
      : 1;
    const baseEarned = Number(row.earned_social_value);
    const scenarioEarned = Number.isFinite(baseEarned)
      ? baseEarned * clamp(
        Math.pow(mentionLift, 0.72) * Math.pow(engagementLift, 0.85) * Math.pow(sentimentLift, 0.58),
        0.45,
        1.95
      )
      : null;

    return {
      effectiveScore,
      sentiment: scenarioSentiment,
      earned: scenarioEarned,
      platforms
    };
  };

  const scenarioSocial = buildScenarioSocialSnapshot(currentWeekSocial, socialShock, baseScore);

  if (Number.isFinite(baseScore)) {
    const effectiveScore = Number.isFinite(scenarioSocial?.effectiveScore)
      ? scenarioSocial.effectiveScore
      : clamp(baseScore + socialShock, 20, 98);
    socialScoreEl.textContent = effectiveScore.toFixed(1);
    if (socialTrendBadge) {
      const effectiveTrendDelta = (Number.isFinite(baseTrendDelta) ? baseTrendDelta : 0) + socialShock;
      const dir = effectiveTrendDelta > 0 ? 1 : effectiveTrendDelta < 0 ? -1 : 0;
      const icon = dir > 0 ? 'bi-arrow-up' : dir < 0 ? 'bi-arrow-down' : 'bi-dash';
      const color = dir > 0 ? 'text-success' : dir < 0 ? 'text-danger' : 'text-muted';
      socialTrendBadge.innerHTML = `<i class="bi ${icon} ${color}"></i> <span class="${color}">${effectiveTrendDelta >= 0 ? '+' : ''}${effectiveTrendDelta.toFixed(1)}</span>`;
    }
  } else {
    socialScoreEl.textContent = '--';
    if (socialTrendBadge) socialTrendBadge.innerHTML = '';
  }

  // Populate per-channel social metrics
  if (scenarioSocial) {
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const fmtMentions = (n) => { const v = Number(n); return Number.isFinite(v) ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : '--'; };
    const fmtRate = (r) => { const v = Number(r); return Number.isFinite(v) ? `${v.toFixed(1)}%` : '--%'; };

    const tiktok = scenarioSocial.platforms.find(item => item.key === 'tiktok');
    const instagram = scenarioSocial.platforms.find(item => item.key === 'instagram');
    const youtube = scenarioSocial.platforms.find(item => item.key === 'youtube');
    const twitter = scenarioSocial.platforms.find(item => item.key === 'twitter');

    setEl('social-tiktok-mentions', fmtMentions(tiktok?.mentions));
    setEl('social-tiktok-rate', fmtRate(tiktok?.rate));
    setEl('social-instagram-mentions', fmtMentions(instagram?.mentions));
    setEl('social-instagram-rate', fmtRate(instagram?.rate));
    setEl('social-youtube-mentions', fmtMentions(youtube?.mentions));
    setEl('social-youtube-rate', fmtRate(youtube?.rate));
    setEl('social-twitter-mentions', fmtMentions(twitter?.mentions));
    setEl('social-twitter-rate', fmtRate(twitter?.rate));

    const sentiment = Number(scenarioSocial.sentiment);
    setEl('social-sentiment-value', Number.isFinite(sentiment) ? `${(sentiment * 100).toFixed(0)}%` : '--');
    const earned = Number(scenarioSocial.earned);
    setEl('social-earned-value', Number.isFinite(earned) ? `$${(earned / 1000).toFixed(1)}k` : '--');
  }
}

function renderLivePulseChart() {
  const canvas = document.getElementById('channel-promo-live-pulse-chart');
  if (!canvas || !window.Chart) return;

  const maxWeek = clamp(Number(currentSeasonWeek) || 1, 1, getSeasonWeeks());
  const labels = [];
  const competitorSeries = [];
  const socialSeries = [];
  for (let week = 1; week <= maxWeek; week += 1) {
    labels.push(`W${week}`);
    const market = getExternalFactorsForWeek(week);
    const social = getSocialSignalForWeek(week);
    competitorSeries.push(Number(market?.competitor_avg_price || null));
    socialSeries.push(Number(normalizeSocialScore(social?.brand_social_index ?? social?.social_sentiment ?? null)));
  }

  if (channelPromoLivePulseChart) {
    channelPromoLivePulseChart.data.labels = labels;
    channelPromoLivePulseChart.data.datasets[0].data = competitorSeries;
    channelPromoLivePulseChart.data.datasets[1].data = socialSeries;
    channelPromoLivePulseChart.update();
    return;
  }

  channelPromoLivePulseChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Competitor avg price',
          data: competitorSeries,
          borderColor: 'rgba(220, 38, 38, 0.9)',
          backgroundColor: 'rgba(220, 38, 38, 0.15)',
          yAxisID: 'y',
          tension: 0.25,
          pointRadius: 1.5
        },
        {
          label: 'Social index',
          data: socialSeries,
          borderColor: 'rgba(14, 165, 233, 0.95)',
          backgroundColor: 'rgba(14, 165, 233, 0.15)',
          yAxisID: 'y1',
          tension: 0.25,
          pointRadius: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            boxWidth: 10,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              if (context.datasetIndex === 0) {
                return `Competitor average price: ${formatCurrency(value)}`;
              }
              return `Brand social index: ${Number(value).toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
        y: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 4,
            callback: (value) => formatCurrency(Number(value))
          },
          title: {
            display: true,
            text: 'Competitor Price'
          }
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { maxTicksLimit: 4 },
          title: {
            display: true,
            text: 'Social Index'
          }
        }
      }
    }
  });
}

function renderLiveFeed(weekOfSeason) {
  const weekEl = document.getElementById('channel-promo-week-value');
  const feedEl = document.getElementById('channel-promo-live-feed');
  if (!feedEl) return;

  const week = clamp(Number(weekOfSeason) || 1, 1, getSeasonWeeks());
  const seasonDate = getSeasonDateForWeek(week);
  if (weekEl) {
    const dateLabel = seasonDate
      ? new Date(seasonDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '--';
    weekEl.textContent = `W${week} (${dateLabel})`;
  }

  const market = getExternalFactorsForWeek(week);
  const marketPrev = getExternalFactorsForWeek(Math.max(1, week - 1));
  const social = getSocialSignalForWeek(week);
  const socialPrev = getSocialSignalForWeek(Math.max(1, week - 1));
  const events = getEventsForWeek(week);

  const marketNow = Number(market?.competitor_avg_price || 0);
  const marketPrevVal = Number(marketPrev?.competitor_avg_price || 0);
  const marketDeltaPct = marketPrevVal > 0 ? ((marketNow - marketPrevVal) / marketPrevVal) : 0;

  const socialNow = Number(normalizeSocialScore(social?.brand_social_index ?? social?.social_sentiment ?? null));
  const socialPrevVal = Number(normalizeSocialScore(socialPrev?.brand_social_index ?? socialPrev?.social_sentiment ?? null));
  const socialDelta = Number.isFinite(socialNow) && Number.isFinite(socialPrevVal)
    ? (socialNow - socialPrevVal)
    : null;

  const lines = [];
  if (Number.isFinite(marketNow) && marketNow > 0) {
    lines.push(`Competitor avg price ${formatCurrency(marketNow)} (${marketDeltaPct >= 0 ? '+' : ''}${formatPercent(marketDeltaPct)} vs prior week).`);
  }
  if (Number.isFinite(socialNow)) {
    lines.push(`Brand social index ${socialNow.toFixed(1)}${Number.isFinite(socialDelta) ? ` (${socialDelta >= 0 ? '+' : ''}${socialDelta.toFixed(1)} WoW)` : ''}.`);
  }
  events.slice(0, 3).forEach(evt => {
    lines.push(`${evt.event_type}: ${evt.notes || 'No notes.'}`);
  });

  if (!lines.length) {
    feedEl.innerHTML = '<li>No major events this week. Continue monitoring channel response.</li>';
    return;
  }

  feedEl.innerHTML = lines.map(line => `<li>${line}</li>`).join('');
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
  const objective = OBJECTIVE_CONFIG[objectiveKey] || OBJECTIVE_CONFIG.balance;
  const transferRows = [];

  const buckets = new Map();
  scenarios.forEach(s => {
    const key = `${s.product_group}|${s.group}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  });

  const addTransfer = (fromEntry, toEntry, units, subtractFromSource = true) => {
    const bounded = clamp(Number(units) || 0, 0, Math.max(0, fromEntry?.scenarioUnits || 0));
    if (bounded <= 0 || !toEntry || !fromEntry) return;
    if (subtractFromSource) {
      fromEntry.scenarioUnits = Math.max(0, fromEntry.scenarioUnits - bounded);
    }
    toEntry.scenarioUnits += bounded;
    transferRows.push({
      from_sku: fromEntry.sku_id,
      from_sku_name: fromEntry.sku_name,
      to_sku: toEntry.sku_id,
      to_sku_name: toEntry.sku_name,
      product_group: toEntry.product_group,
      channel_group: toEntry.group,
      units: bounded
    });
  };

  buckets.forEach(entries => {
    if (!entries || entries.length < 2) return;
    const maxDepth = Math.max(...entries.map(e => Number(e.promoDepthPct || 0)));
    const minDepth = Math.min(...entries.map(e => Number(e.promoDepthPct || 0)));
    const hasPromoPressure = maxDepth > 0 || skuBoostPct > 0;
    const avgScenarioPrice = entries.reduce((sum, e) => sum + Number(e.scenarioPrice || 0), 0) / entries.length;
    const depthSpread = Math.max(0, maxDepth - minDepth) / 100;

    // 1) Baseline migration from current-week cannibalization signal
    entries.forEach(source => {
      let basePool = Math.min(
        Math.max(0, source.rawCannibalizedOutUnits * objective.cannibalizationMultiplier),
        Math.max(0, source.scenarioUnits)
      );
      if (basePool <= 0 && hasPromoPressure) {
        const promoIntensity = Math.max(0, Number(source.promoDepthPct || 0)) / 100;
        const relativePremium = avgScenarioPrice > 0
          ? Math.max(0, (Number(source.scenarioPrice || 0) - avgScenarioPrice) / avgScenarioPrice)
          : 0;
        const syntheticRate = clamp(
          0.003 + (promoIntensity * 0.03) + (depthSpread * 0.04) + (relativePremium * 0.07),
          0,
          0.12
        );
        basePool = Math.min(
          Math.max(0, source.scenarioUnits * syntheticRate * objective.cannibalizationMultiplier),
          Math.max(0, source.scenarioUnits) * 0.18
        );
      }
      if (basePool <= 0) return;

      const candidates = entries.filter(dest => dest.sku_id !== source.sku_id);
      if (!candidates.length) return;

      const weighted = candidates.map(dest => {
        const promoEdge = Math.max(0, (dest.promoDepthPct - source.promoDepthPct) / 100);
        const priceEdge = source.scenarioPrice > 0
          ? Math.max(0, (source.scenarioPrice - dest.scenarioPrice) / source.scenarioPrice)
          : 0;
        const demandAnchor = dest.baselineUnits > 0 ? (dest.baselineUnits / 120) : 0;
        let weight = 0.22 + (promoEdge * 1.25) + (priceEdge * 0.95) + demandAnchor;
        if (selectedSku && selectedSku !== 'all' && dest.sku_id === selectedSku && skuBoostPct > 0) {
          weight *= 1.45;
        }
        return { dest, weight: Math.max(0.01, weight) };
      });

      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0) || 1;
      weighted.forEach(({ dest, weight }) => {
        const allocated = basePool * (weight / totalWeight);
        // Base pool was already reduced in row-level scenario formula; only add to destinations.
        addTransfer(source, dest, allocated, false);
      });
    });

    // 2) Incremental targeted migration when one SKU gets extra promo depth
    if (!selectedSku || selectedSku === 'all' || skuBoostPct <= 0) return;
    const winner = entries.find(e => e.sku_id === selectedSku);
    if (!winner) return;

    entries
      .filter(e => e.sku_id !== selectedSku)
      .forEach(loser => {
        const depthDiff = Math.max(0, winner.promoDepthPct - loser.promoDepthPct);
        if (depthDiff <= 0) return;
        const migratedUnits =
          loser.scenarioUnits * (depthDiff / 100) * 0.35 * objective.cannibalizationMultiplier;
        addTransfer(loser, winner, migratedUnits, true);
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
          No measurable internal migration this week. Increase targeted product promo to force stronger cannibalization shifts.
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

function renderMigrationMatrix(transfers, scenarios) {
  const table = document.getElementById('channel-promo-migration-matrix');
  const noteEl = document.getElementById('channel-promo-migration-note');
  if (!table || !noteEl) return;

  const skuMap = new Map();
  (scenarios || []).forEach(row => {
    if (!skuMap.has(row.sku_id)) {
      skuMap.set(row.sku_id, {
        sku_id: row.sku_id,
        sku_name: row.sku_name || row.sku_id,
        product_group: row.product_group || '-'
      });
    }
  });
  const skuList = [...skuMap.values()].sort((a, b) => {
    const groupCmp = String(a.product_group).localeCompare(String(b.product_group));
    if (groupCmp !== 0) return groupCmp;
    return String(a.sku_name).localeCompare(String(b.sku_name));
  });

  if (!transfers.length || skuList.length < 2) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td class="text-center text-muted">No measurable migration matrix for current week/filter. Increase targeted promo or move to a higher-pressure week.</td>
        </tr>
      </tbody>
    `;
    noteEl.textContent = 'Matrix cells show unit movement from source product (rows) to destination product (columns).';
    return;
  }

  const matrix = new Map();
  let maxValue = 0;
  transfers.forEach(row => {
    const key = `${row.from_sku}|${row.to_sku}`;
    const units = (matrix.get(key) || 0) + Number(row.units || 0);
    matrix.set(key, units);
    maxValue = Math.max(maxValue, units);
  });

  const header = `
    <thead class="table-light">
      <tr>
        <th>From \\ To</th>
        ${skuList.map(sku => `<th class="text-center">${sku.sku_name}</th>`).join('')}
      </tr>
    </thead>
  `;

  const body = skuList.map(fromSku => {
    const cells = skuList.map(toSku => {
      if (fromSku.sku_id === toSku.sku_id) {
        return '<td class="text-center text-muted">-</td>';
      }
      const value = matrix.get(`${fromSku.sku_id}|${toSku.sku_id}`) || 0;
      if (value <= 0) return '<td class="text-center text-muted">0</td>';
      const alpha = maxValue > 0 ? (0.12 + (value / maxValue) * 0.48) : 0.12;
      return `<td class="text-center fw-semibold" style="background: rgba(245, 158, 11, ${alpha.toFixed(3)});">${formatNumber(value, 1)}</td>`;
    }).join('');
    return `<tr><th class="text-nowrap">${fromSku.sku_name}</th>${cells}</tr>`;
  }).join('');

  table.innerHTML = `${header}<tbody>${body}</tbody>`;
  noteEl.textContent = 'Heat intensity reflects larger migration volume between sibling products from baseline cannibalization plus product-targeted promo changes.';
}

function findSkuIdByName(name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  const match = skuWeeklyData.find(row => String(row.sku_name || '').trim().toLowerCase() === target);
  return match?.sku_id || null;
}

function buildObjectiveSnapshot(
  rows,
  objectiveKey,
  massPromo,
  prestigePromo,
  selectedSku,
  skuBoostPct,
  socialScore,
  competitorShockPct,
  socialReferenceScore = null,
  compShockProductFilter = 'all'
) {
  const scenarios = rows.map(row => {
    const baseDepth = row.channel_group === 'mass' ? massPromo : prestigePromo;
    const depth = (selectedSku !== 'all' && row.sku_id === selectedSku)
      ? baseDepth + skuBoostPct
      : baseDepth;
    return computeScenarioForRow(
      row,
      depth,
      objectiveKey,
      socialScore,
      competitorShockPct,
      socialReferenceScore,
      compShockProductFilter
    );
  });
  const transfers = applyCannibalizationTransfers(scenarios, objectiveKey, selectedSku, skuBoostPct);

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
  const groupLift = {
    mass: totals.mass.baselineUnits > 0 ? totals.mass.scenarioUnits / totals.mass.baselineUnits : 1,
    prestige: totals.prestige.baselineUnits > 0 ? totals.prestige.scenarioUnits / totals.prestige.baselineUnits : 1
  };

  return {
    scenarios,
    transfers,
    totals,
    revenueDeltaPct,
    profitDeltaPct,
    groupLift
  };
}

function projectWeek17Inventory(group, sku, applyMass, applyPrestige, groupLift = { mass: 1, prestige: 1 }) {
  const allRows = skuWeeklyData.filter(row => {
    if (group !== 'all' && row.product_group !== group) return false;
    if (sku !== 'all' && row.sku_id !== sku) return false;
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });
  const currentRows = allRows.filter(row => Number(row.week_of_season) === currentSeasonWeek);
  const startingInventory = currentRows.reduce((sum, row) => sum + (Number(row.end_inventory_units) || 0), 0);

  let baselineInv = startingInventory;
  let scenarioInv = startingInventory;
  for (let w = currentSeasonWeek + 1; w <= getSeasonWeeks(); w += 1) {
    const weekRows = allRows.filter(row => Number(row.week_of_season) === w);
    const baselineDemand = weekRows.reduce((sum, row) => sum + (Number(row.net_units_sold) || 0), 0);
    const scenarioDemand = weekRows.reduce((sum, row) => {
      const units = Number(row.net_units_sold) || 0;
      const multiplier = row.channel_group === 'prestige'
        ? Number(groupLift.prestige || 1)
        : Number(groupLift.mass || 1);
      return sum + (units * multiplier);
    }, 0);
    baselineInv = Math.max(0, baselineInv - baselineDemand);
    scenarioInv = Math.max(0, scenarioInv - scenarioDemand);
  }

  return {
    startingInventory,
    baselineEnd: baselineInv,
    scenarioEnd: scenarioInv
  };
}

function renderObjectiveFrontier(frontierRows, currentObjective) {
  const tbody = document.getElementById('channel-promo-frontier-body');
  const noteEl = document.getElementById('channel-promo-frontier-note');
  const canvas = document.getElementById('channel-promo-frontier-chart');
  const selectedEl = document.getElementById('channel-promo-frontier-selected');
  const selectedNoteEl = document.getElementById('channel-promo-frontier-selected-note');
  const bestRevenueEl = document.getElementById('channel-promo-frontier-best-revenue');
  const bestRevenueNoteEl = document.getElementById('channel-promo-frontier-best-revenue-note');
  const bestProfitEl = document.getElementById('channel-promo-frontier-best-profit');
  const bestProfitNoteEl = document.getElementById('channel-promo-frontier-best-profit-note');
  const bestClearanceEl = document.getElementById('channel-promo-frontier-best-clearance');
  const bestClearanceNoteEl = document.getElementById('channel-promo-frontier-best-clearance-note');
  if (!tbody || !noteEl || !canvas) return;

  const objectiveMeta = {
    balance: {
      color: 'rgba(37, 99, 235, 0.9)',
      border: 'rgba(29, 78, 216, 1)'
    },
    sales: {
      color: 'rgba(245, 158, 11, 0.9)',
      border: 'rgba(217, 119, 6, 1)'
    },
    profit: {
      color: 'rgba(16, 185, 129, 0.9)',
      border: 'rgba(5, 150, 105, 1)'
    }
  };

  const buildReadout = (row) => {
    if (row.revenueDeltaPct >= 0 && row.profitDeltaPct >= 0) {
      return 'Best balanced outcome: grows sales and profit together.';
    }
    if (row.revenueDeltaPct >= 0 && row.profitDeltaPct < 0) {
      return 'Drives sell-through, but margin is being given up.';
    }
    if (row.revenueDeltaPct < 0 && row.profitDeltaPct >= 0) {
      return 'Protects margin, but weakens top-line momentum.';
    }
    return 'Weak on both top line and profit; usually avoid.';
  };

  const renderSummaryCell = (labelEl, noteElRef, row, valueText) => {
    if (labelEl) labelEl.textContent = row ? row.label : '--';
    if (noteElRef) noteElRef.textContent = row ? valueText : '--';
  };

  if (!frontierRows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">No objective frontier data available.</td>
      </tr>
    `;
    return;
  }

  const selectedRow = frontierRows.find(row => row.objectiveKey === currentObjective) || frontierRows[0];
  const bestRevenueRow = frontierRows.reduce((best, row) => row.revenueDeltaPct > best.revenueDeltaPct ? row : best, frontierRows[0]);
  const bestProfitRow = frontierRows.reduce((best, row) => row.profitDeltaPct > best.profitDeltaPct ? row : best, frontierRows[0]);
  const bestClearanceRow = frontierRows.reduce((best, row) => row.clearancePct > best.clearancePct ? row : best, frontierRows[0]);

  renderSummaryCell(
    selectedEl,
    selectedNoteEl,
    selectedRow,
    `${selectedRow.revenueDeltaPct >= 0 ? '+' : ''}${formatPercent(selectedRow.revenueDeltaPct)} revenue | ${selectedRow.profitDeltaPct >= 0 ? '+' : ''}${formatPercent(selectedRow.profitDeltaPct)} profit`
  );
  renderSummaryCell(
    bestRevenueEl,
    bestRevenueNoteEl,
    bestRevenueRow,
    `${bestRevenueRow.revenueDeltaPct >= 0 ? '+' : ''}${formatPercent(bestRevenueRow.revenueDeltaPct)} revenue uplift`
  );
  renderSummaryCell(
    bestProfitEl,
    bestProfitNoteEl,
    bestProfitRow,
    `${bestProfitRow.profitDeltaPct >= 0 ? '+' : ''}${formatPercent(bestProfitRow.profitDeltaPct)} profit uplift`
  );
  renderSummaryCell(
    bestClearanceEl,
    bestClearanceNoteEl,
    bestClearanceRow,
    `${bestClearanceRow.clearancePct >= 0 ? '+' : ''}${formatPercent(bestClearanceRow.clearancePct)} clearance`
  );

  tbody.innerHTML = frontierRows.map(row => `
    <tr class="${row.objectiveKey === currentObjective ? 'table-primary' : ''}">
      <td>${row.label}</td>
      <td class="text-end ${row.revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${row.revenueDeltaPct >= 0 ? '+' : ''}${formatPercent(row.revenueDeltaPct)}</td>
      <td class="text-end ${row.profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${row.profitDeltaPct >= 0 ? '+' : ''}${formatPercent(row.profitDeltaPct)}</td>
      <td class="text-end">${formatNumber(row.scenarioEnd, 0)}</td>
      <td class="text-end ${row.clearancePct >= 0 ? 'text-success' : 'text-danger'}">${row.clearancePct >= 0 ? '+' : ''}${formatPercent(row.clearancePct)}</td>
      <td>${buildReadout(row)}</td>
    </tr>
  `).join('');

  const datasets = frontierRows.map(row => {
    const clearanceForBubble = Math.max(0, row.clearancePct * 100);
    const radius = clamp(6 + clearanceForBubble * 0.18, 6, 22);
    const meta = objectiveMeta[row.objectiveKey] || objectiveMeta.balance;
    return {
      label: row.label,
      data: [{
        x: Number((row.revenueDeltaPct * 100).toFixed(2)),
        y: Number((row.profitDeltaPct * 100).toFixed(2)),
        r: radius,
        objective: row.objectiveKey
      }],
      backgroundColor: meta.color,
      borderColor: meta.border,
      borderWidth: row.objectiveKey === currentObjective ? 3 : 1.5,
      hoverBorderWidth: 3
    };
  });

  const valueRange = frontierRows.reduce((acc, row) => {
    acc.minX = Math.min(acc.minX, row.revenueDeltaPct * 100);
    acc.maxX = Math.max(acc.maxX, row.revenueDeltaPct * 100);
    acc.minY = Math.min(acc.minY, row.profitDeltaPct * 100);
    acc.maxY = Math.max(acc.maxY, row.profitDeltaPct * 100);
    return acc;
  }, { minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const xPadding = Math.max(2, (valueRange.maxX - valueRange.minX) * 0.25);
  const yPadding = Math.max(2, (valueRange.maxY - valueRange.minY) * 0.25);
  const xMin = Math.min(-2, valueRange.minX - xPadding);
  const xMax = Math.max(2, valueRange.maxX + xPadding);
  const yMin = Math.min(-2, valueRange.minY - yPadding);
  const yMax = Math.max(2, valueRange.maxY + yPadding);

  if (channelPromoFrontierChart) {
    channelPromoFrontierChart.data.datasets = datasets;
    channelPromoFrontierChart.options.scales.x.min = xMin;
    channelPromoFrontierChart.options.scales.x.max = xMax;
    channelPromoFrontierChart.options.scales.y.min = yMin;
    channelPromoFrontierChart.options.scales.y.max = yMax;
    channelPromoFrontierChart.update();
  } else if (window.Chart) {
    channelPromoFrontierChart = new Chart(canvas, {
      type: 'bubble',
      data: {
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const row = frontierRows.find(item => item.label === ctx.dataset.label);
                if (!row) return ctx.dataset.label;
                return `${row.label}: Revenue ${formatPercent(row.revenueDeltaPct)}, Profit ${formatPercent(row.profitDeltaPct)}, W${getSeasonWeeks()} Left ${formatNumber(row.scenarioEnd, 0)}, Clearance ${formatPercent(row.clearancePct)}`;
              }
            }
          }
        },
        scales: {
          x: {
            min: xMin,
            max: xMax,
            title: { display: true, text: 'Revenue Delta vs Baseline (%)' },
            grid: {
              color: (context) => context.tick.value === 0 ? 'rgba(15, 23, 42, 0.35)' : 'rgba(148, 163, 184, 0.18)',
              lineWidth: (context) => context.tick.value === 0 ? 1.5 : 1
            }
          },
          y: {
            min: yMin,
            max: yMax,
            title: { display: true, text: 'Profit Delta vs Baseline (%)' },
            grid: {
              color: (context) => context.tick.value === 0 ? 'rgba(15, 23, 42, 0.35)' : 'rgba(148, 163, 184, 0.18)',
              lineWidth: (context) => context.tick.value === 0 ? 1.5 : 1
            }
          }
        }
      }
    });
  }

  noteEl.textContent = `Each point is one objective mode. Right means stronger revenue, up means stronger profit, and larger bubbles mean better week-${getSeasonWeeks()} clearance with less leftover inventory. Selected objective: ${selectedRow.label}.`;
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

function renderSkuCausalWaterfall(
  scenarios,
  noSocialScenarios,
  noActionScenarios,
  transfers,
  selectedSku,
  socialShockPts = 0
) {
  const tbody = document.getElementById('channel-promo-waterfall-body');
  const noteEl = document.getElementById('channel-promo-waterfall-note');
  const chartCanvas = document.getElementById('channel-promo-waterfall-chart');
  if (!tbody || !noteEl || !chartCanvas) return;

  const noSocialBySku = new Map();
  (noSocialScenarios || []).forEach(row => {
    const key = row.sku_id;
    noSocialBySku.set(key, (noSocialBySku.get(key) || 0) + Number(row.scenarioUnits || 0));
  });

  const noActionBySku = new Map();
  (noActionScenarios || []).forEach(row => {
    const key = row.sku_id;
    noActionBySku.set(key, (noActionBySku.get(key) || 0) + Number(row.scenarioUnits || 0));
  });

  const grouped = new Map();
  scenarios.forEach(row => {
    if (!grouped.has(row.sku_id)) {
      grouped.set(row.sku_id, {
        sku_id: row.sku_id,
        sku_name: row.sku_name || row.sku_id,
        baselineUnits: 0,
        ownUnitsImpact: 0,
        competitorUnitsImpact: 0,
        socialUnitsImpact: 0,
        noSocialUnits: 0,
        shockOnlyUnits: 0,
        finalUnits: 0
      });
    }
    const entry = grouped.get(row.sku_id);
    const baseUnits = Number(row.baselineUnits || 0);
    const ownImpact = baseUnits * ((Number(row.ownMultiplier || 1)) - 1);
    const afterOwn = baseUnits + ownImpact;
    const compImpact = afterOwn * ((Number(row.competitorMultiplier || 1)) - 1);

    entry.baselineUnits += baseUnits;
    entry.ownUnitsImpact += ownImpact;
    entry.competitorUnitsImpact += compImpact;
    entry.noSocialUnits = noSocialBySku.get(row.sku_id) || 0;
    entry.shockOnlyUnits = noActionBySku.get(row.sku_id) || 0;
    entry.finalUnits += Number(row.scenarioUnits || 0);
  });

  grouped.forEach(entry => {
    entry.socialUnitsImpact = Number(entry.finalUnits || 0) - Number(entry.noSocialUnits || 0);
  });

  transfers.forEach(row => {
    if (grouped.has(row.to_sku)) {
      const entry = grouped.get(row.to_sku);
      entry.cannibalNet = (entry.cannibalNet || 0) + Number(row.units || 0);
    }
    if (grouped.has(row.from_sku)) {
      const entry = grouped.get(row.from_sku);
      entry.cannibalNet = (entry.cannibalNet || 0) - Number(row.units || 0);
    }
  });

  const pool = [...grouped.values()];
  if (!pool.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted">No SKU rows available for causal decomposition.</td>
      </tr>
    `;
    return;
  }

  const chosen = selectedSku && selectedSku !== 'all'
    ? (pool.find(x => x.sku_id === selectedSku) || pool[0])
    : pool.sort((a, b) => Math.abs((b.finalUnits - b.baselineUnits)) - Math.abs((a.finalUnits - a.baselineUnits)))[0];

  const baselineUnits = Number(chosen.baselineUnits || 0);
  const ownImpact = Number(chosen.ownUnitsImpact || 0);
  const compImpact = Number(chosen.competitorUnitsImpact || 0);
  const socialImpact = Number(chosen.socialUnitsImpact || 0);
  const cannibalImpact = Number(chosen.cannibalNet || 0);
  const finalUnits = Number(chosen.finalUnits || 0);

  const rows = [
    { label: 'Baseline', value: baselineUnits },
    { label: 'Own Promo Effect', value: ownImpact },
    { label: 'Competitor Delta Effect', value: compImpact },
    { label: 'Social Momentum Shock Effect', value: socialImpact },
    { label: 'Internal Migration', value: cannibalImpact },
    { label: 'Final Scenario', value: finalUnits }
  ];

  tbody.innerHTML = rows.map((row, index) => {
    const pct = baselineUnits > 0 ? row.value / baselineUnits : 0;
    const isDelta = index > 0 && index < rows.length - 1;
    const className = isDelta
      ? (row.value >= 0 ? 'text-success' : 'text-danger')
      : 'text-body';
    return `
      <tr>
        <td>${row.label}</td>
        <td class="text-end ${className}">${row.value >= 0 ? '+' : ''}${formatNumber(row.value, 1)}</td>
        <td class="text-end ${className}">${row.value >= 0 ? '+' : ''}${formatPercent(pct)}</td>
      </tr>
    `;
  }).join('');

  const labels = rows.map(r => r.label);
  const data = rows.map(r => Number(r.value.toFixed(2)));
  const colors = [
    'rgba(148, 163, 184, 0.9)',
    ownImpact >= 0 ? 'rgba(37, 99, 235, 0.9)' : 'rgba(220, 38, 38, 0.9)',
    compImpact >= 0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(220, 38, 38, 0.9)',
    socialImpact >= 0 ? 'rgba(14, 165, 233, 0.9)' : 'rgba(220, 38, 38, 0.9)',
    cannibalImpact >= 0 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(239, 68, 68, 0.9)',
    'rgba(99, 102, 241, 0.95)'
  ];

  if (channelPromoWaterfallChart) {
    channelPromoWaterfallChart.data.labels = labels;
    channelPromoWaterfallChart.data.datasets[0].data = data;
    channelPromoWaterfallChart.data.datasets[0].backgroundColor = colors;
    channelPromoWaterfallChart.update();
  } else if (window.Chart) {
    channelPromoWaterfallChart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Units',
            data,
            backgroundColor: colors
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  noteEl.textContent =
    `SKU focus: ${chosen.sku_name}. Social momentum contribution is measured against the same scenario with social shock set to 0 (${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts applied).`;
}

function renderDriverDecomposition(scenarios, noSocialScenarios, transfers, socialShockPts = 0) {
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
  const scenarioUnits = scenarios.reduce((sum, row) => sum + Number(row.scenarioUnits || 0), 0);
  const noSocialUnits = (noSocialScenarios || []).reduce((sum, row) => sum + Number(row.scenarioUnits || 0), 0);
  const socialPct = baselineUnits > 0 ? (scenarioUnits - noSocialUnits) / baselineUnits : 0;
  const shiftedUnits = transfers.reduce((sum, row) => sum + row.units, 0);

  ownEl.textContent = `${ownPct >= 0 ? '+' : ''}${formatPercent(ownPct)}`;
  compEl.textContent = `${compPct >= 0 ? '+' : ''}${formatPercent(compPct)}`;
  socialEl.textContent = `${socialPct >= 0 ? '+' : ''}${formatPercent(socialPct)}`;
  cannibalEl.textContent = shiftedUnits > 0
    ? `${formatNumber(shiftedUnits, 1)} units shifted`
    : 'No shift';
  noteEl.textContent =
    `Own promo, competitor gap, and social momentum all recalculate in real-time. Social effect here is isolated as scenario delta vs no-social-shock baseline (${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts).`;
}

function renderElasticityTable(rows, socialScore, socialReferenceScore) {
  const tbody = document.getElementById('channel-promo-elasticity-body');
  const noteEl = document.getElementById('channel-promo-elasticity-note');
  if (!tbody || !noteEl) return;

  const skuMap = new Map();
  (rows || []).forEach(row => {
    if (!skuMap.has(row.sku_id)) {
      skuMap.set(row.sku_id, {
        sku_id: row.sku_id,
        sku_name: row.sku_name || row.sku_id,
        product_group: row.product_group || '-',
        baseElasticity: 0,
        gap: 0,
        count: 0
      });
    }
    const entry = skuMap.get(row.sku_id);
    entry.baseElasticity += Number(row.base_elasticity || 0);
    entry.gap += Number(row.price_gap_vs_competitor || 0);
    entry.count += 1;
  });

  const effectiveModifier = getSocialElasticityModifier(socialScore);
  const baselineModifier = getSocialElasticityModifier(socialReferenceScore);
  const rowsOut = [...skuMap.values()]
    .map(entry => {
      const base = entry.count > 0 ? (entry.baseElasticity / entry.count) : 0;
      const effective = base * effectiveModifier;
      const avgGap = entry.count > 0 ? (entry.gap / entry.count) : 0;

      let guidance = 'Test light promo';
      let badgeClass = 'bg-info-subtle text-info-emphasis';
      if (Math.abs(effective) >= 1.9 && avgGap > 0.02) {
        guidance = 'Promote (elastic + above competitor)';
        badgeClass = 'bg-success-subtle text-success';
      } else if (Math.abs(effective) >= 1.7) {
        guidance = 'Selective promo';
        badgeClass = 'bg-primary-subtle text-primary';
      } else if (Number.isFinite(socialScore) && socialScore >= 75 && Math.abs(effective) < 1.4) {
        guidance = 'Hold (strong social pull)';
        badgeClass = 'bg-warning-subtle text-warning-emphasis';
      } else if (avgGap <= 0) {
        guidance = 'Hold / monitor';
        badgeClass = 'bg-secondary-subtle text-body-secondary';
      }

      return {
        ...entry,
        baseElasticityAvg: base,
        effectiveElasticity: effective,
        avgGap,
        guidance,
        badgeClass
      };
    })
    .sort((a, b) => {
      const groupCmp = String(a.product_group).localeCompare(String(b.product_group));
      if (groupCmp !== 0) return groupCmp;
      return String(a.sku_name).localeCompare(String(b.sku_name));
    });

  if (!rowsOut.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">No product-level elasticity rows for current filters.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rowsOut.map(row => `
    <tr>
      <td>${row.sku_name}</td>
      <td class="text-capitalize">${row.product_group}</td>
      <td class="text-end">${row.baseElasticityAvg.toFixed(2)}</td>
      <td class="text-end ${Math.abs(row.effectiveElasticity) >= 1.8 ? 'text-primary fw-semibold' : ''}">${row.effectiveElasticity.toFixed(2)}</td>
      <td class="text-end ${row.avgGap > 0 ? 'text-danger' : 'text-success'}">${row.avgGap >= 0 ? '+' : ''}${formatPercent(row.avgGap)}</td>
      <td><span class="badge ${row.badgeClass}">${row.guidance}</span></td>
    </tr>
  `).join('');

  const deltaModifierPct = baselineModifier > 0
    ? ((effectiveModifier / baselineModifier) - 1)
    : 0;
  noteEl.textContent =
    `Effective elasticity uses current social signal (${Number.isFinite(socialScore) ? socialScore.toFixed(1) : '--'}) and updates by ${deltaModifierPct >= 0 ? '+' : ''}${formatPercent(deltaModifierPct)} vs no-shock social baseline.`;
}

function renderSeasonStory(seasonRows, inventoryProjection) {
  const weekLabelEl = document.getElementById('channel-promo-week-label');
  const storyActEl = document.getElementById('channel-promo-story-act');
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

  weekLabelEl.textContent = `Week ${currentSeasonWeek} of ${getSeasonWeeks()}`;
  if (storyActEl) {
    if (currentSeasonWeek <= 4) {
      storyActEl.textContent = 'Start of Season';
      storyActEl.className = 'fw-semibold text-primary';
    } else if (currentSeasonWeek <= 12) {
      storyActEl.textContent = 'In-Season Pivot';
      storyActEl.className = 'fw-semibold text-warning';
    } else {
      storyActEl.textContent = 'Future Vision';
      storyActEl.className = 'fw-semibold text-success';
    }
  }
  startEl.textContent = `${formatNumber(seasonStartInventory)} units`;
  currentEl.textContent = `${formatNumber(currentInventory)} units`;
  baseEndEl.textContent = `${formatNumber(baselineEnd)} units`;
  scenarioEndEl.textContent = `${formatNumber(scenarioEnd)} units`;

  if (scenarioEnd < baselineEnd) {
    guidanceEl.innerHTML =
      `<strong>In-season pivot:</strong> current promo plan improves week-${getSeasonWeeks()} clearance by <strong>${formatNumber(baselineEnd - scenarioEnd)}</strong> units. ` +
      `If we normalize start inventory to 100 units, baseline ends at ${baselineNorm100.toFixed(1)} and scenario ends at ${scenarioNorm100.toFixed(1)} units.`;
  } else if (scenarioEnd > baselineEnd) {
    guidanceEl.innerHTML =
      `<strong>Warning:</strong> scenario leaves <strong>${formatNumber(scenarioEnd - baselineEnd)}</strong> more units than baseline by week ${getSeasonWeeks()}. ` +
      `If normalized to 100 start units, scenario ends at ${scenarioNorm100.toFixed(1)} vs ${baselineNorm100.toFixed(1)} in baseline.`;
  } else {
    guidanceEl.innerHTML =
      `<strong>Status:</strong> scenario and baseline end at a similar week-${getSeasonWeeks()} inventory position. ` +
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

  const totalWeeks = getSeasonWeeks();

  // --- Build labels for all weeks (W1 .. W<totalWeeks>) ---
  const labels = [];
  for (let w = 1; w <= totalWeeks; w++) {
    labels.push(`W${w}`);
  }

  // --- Historical actual series (Week 1 to currentSeasonWeek) ---
  const actualSeries = [];
  for (let w = 1; w <= totalWeeks; w++) {
    if (w <= currentSeasonWeek) {
      const weekRows = allRows.filter(row => Number(row.week_of_season) === w);
      const endInv = weekRows.reduce(
        (sum, row) => sum + (Number(row.end_inventory_units) || 0),
        0
      );
      actualSeries.push(Math.round(endInv));
    } else {
      actualSeries.push(null);
    }
  }

  // --- Starting inventory for projections (end inventory at currentSeasonWeek) ---
  const startingInventory = actualSeries[currentSeasonWeek - 1] || 0;

  // --- Projected series (currentSeasonWeek onwards) ---
  let baselineInv = startingInventory;
  let scenarioInv = startingInventory;
  const baselineSeries = [];
  const scenarioSeries = [];

  for (let w = 1; w <= totalWeeks; w++) {
    if (w < currentSeasonWeek) {
      baselineSeries.push(null);
      scenarioSeries.push(null);
    } else if (w === currentSeasonWeek) {
      // Transition point: matches last actual value so lines connect
      baselineSeries.push(startingInventory);
      scenarioSeries.push(startingInventory);
    } else {
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
      baselineSeries.push(Math.round(baselineInv));
      scenarioSeries.push(Math.round(scenarioInv));
    }
  }

  // --- Custom plugin: draw vertical dashed line at the current-week boundary ---
  const currentWeekLinePlugin = {
    id: 'currentWeekLine',
    afterDraw(chart) {
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;
      const index = currentSeasonWeek - 1; // 0-based index for the current week
      const x = xScale.getPixelForValue(index);
      const ctx2 = chart.ctx;
      ctx2.save();
      ctx2.beginPath();
      ctx2.setLineDash([6, 4]);
      ctx2.strokeStyle = 'rgba(107, 114, 128, 0.7)';
      ctx2.lineWidth = 1.5;
      ctx2.moveTo(x, yScale.top);
      ctx2.lineTo(x, yScale.bottom);
      ctx2.stroke();
      // Label
      ctx2.setLineDash([]);
      ctx2.fillStyle = 'rgba(107, 114, 128, 0.85)';
      ctx2.font = '11px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText('Today', x, yScale.top - 6);
      ctx2.restore();
    }
  };

  if (channelPromoInventoryChart) {
    channelPromoInventoryChart.data.labels = labels;
    channelPromoInventoryChart.data.datasets[0].data = actualSeries;
    channelPromoInventoryChart.data.datasets[1].data = baselineSeries;
    channelPromoInventoryChart.data.datasets[2].data = scenarioSeries;
    channelPromoInventoryChart.update();
  } else if (window.Chart) {
    channelPromoInventoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual inventory',
            data: actualSeries,
            borderColor: 'rgba(245, 158, 11, 1)',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            fill: false,
            tension: 0.25,
            borderWidth: 2.5,
            pointRadius: 3,
            spanGaps: false
          },
          {
            label: 'Baseline projection',
            data: baselineSeries,
            borderColor: 'rgba(99, 102, 241, 0.9)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            fill: false,
            tension: 0.25,
            borderDash: [6, 3],
            spanGaps: false
          },
          {
            label: 'Scenario projection',
            data: scenarioSeries,
            borderColor: 'rgba(16, 185, 129, 0.95)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: false,
            tension: 0.25,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: { legend: { position: 'bottom' } }
      },
      plugins: [currentWeekLinePlugin]
    });
  }

  const baselineEnd = baselineSeries[baselineSeries.length - 1] || 0;
  const scenarioEnd = scenarioSeries[scenarioSeries.length - 1] || 0;
  noteEl.textContent =
    `Start inventory now: ${formatNumber(startingInventory)} units. ` +
    `Projected week-${totalWeeks} left: baseline ${formatNumber(baselineEnd)}, scenario ${formatNumber(scenarioEnd)}.`;

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
  const briefEl = document.getElementById('channel-promo-ai-brief');
  const applyBtn = document.getElementById('channel-promo-apply-recommendation');
  if (!summaryEl) return;

  // Show loading state — LLM will populate via app.js copilot flow
  summaryEl.textContent = 'Analyzing scenario with LLM...';
  if (includeEl) includeEl.textContent = 'Waiting for LLM...';
  if (excludeEl) excludeEl.textContent = 'Waiting for LLM...';
  if (riskEl) riskEl.textContent = 'Waiting for LLM...';
  if (briefEl) briefEl.textContent = 'Waiting for LLM analysis...';
  if (applyBtn) applyBtn.disabled = true;
}

function renderWeeklyActionPlan(massPromo, prestigePromo, focusSku, groupLift, objectiveKey) {
  const planBody = document.getElementById('channel-promo-weekly-plan-body');
  const planRange = document.getElementById('channel-promo-plan-range');
  if (!planBody) return;

  const horizon = getSeasonWeeks();
  if (massPromo === 0 && prestigePromo === 0) {
    planBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Set promo sliders to generate weekly plan.</td></tr>';
    if (planRange) planRange.textContent = '--';
    return;
  }

  if (planRange) planRange.textContent = `Week ${currentSeasonWeek}–${horizon}`;

  const { group, sku } = getSelectedFilters();
  const rows = [];

  for (let w = currentSeasonWeek; w <= horizon; w++) {
    const weekRows = skuWeeklyData.filter(r => {
      if (Number(r.week_of_season) !== w) return false;
      if (group !== 'all' && r.product_group !== group) return false;
      if (sku !== 'all' && r.sku_id !== sku) return false;
      return true;
    });

    const baseUnits = weekRows.reduce((s, r) => s + (Number(r.net_units_sold) || 0), 0);
    const liftedUnits = weekRows.reduce((s, r) => {
      const mult = r.channel_group === 'prestige'
        ? Number(groupLift?.prestige || 1)
        : Number(groupLift?.mass || 1);
      return s + ((Number(r.net_units_sold) || 0) * mult);
    }, 0);
    const unitDelta = liftedUnits - baseUnits;

    // Determine phase
    const pctThrough = (w - 1) / horizon;
    let phase = 'Launch';
    if (pctThrough >= 0.75) phase = 'Clearance';
    else if (pctThrough >= 0.4) phase = 'Peak Season';
    else if (pctThrough >= 0.15) phase = 'Ramp-up';

    // Ramp promo depth: lighter early, heavier in clearance
    let massDepth = massPromo;
    let prestigeDepth = prestigePromo;
    if (phase === 'Launch') {
      massDepth = Math.round(massPromo * 0.5);
      prestigeDepth = Math.round(prestigePromo * 0.3);
    } else if (phase === 'Ramp-up') {
      massDepth = Math.round(massPromo * 0.75);
      prestigeDepth = Math.round(prestigePromo * 0.6);
    } else if (phase === 'Clearance') {
      massDepth = Math.min(40, Math.round(massPromo * 1.3));
      prestigeDepth = Math.min(30, Math.round(prestigePromo * 1.2));
    }

    // Pick focus SKU: use the recommendation if available
    let skuLabel = '--';
    if (focusSku && focusSku !== 'all') {
      const skuRow = weekRows.find(r => r.sku_id === focusSku);
      skuLabel = skuRow?.sku_name || focusSku;
    } else if (weekRows.length > 0) {
      // Pick SKU with highest inventory
      const topRow = weekRows.reduce((best, r) =>
        (Number(r.end_inventory_units) || 0) > (Number(best.end_inventory_units) || 0) ? r : best
      , weekRows[0]);
      skuLabel = topRow.sku_name || topRow.sku_id;
    }

    const isCurrentWeek = w === currentSeasonWeek;
    rows.push(`<tr class="${isCurrentWeek ? 'table-info' : ''}">
      <td><strong>W${w}</strong>${isCurrentWeek ? ' <span class="badge bg-info text-dark">Now</span>' : ''}</td>
      <td>${phase}</td>
      <td>${massDepth > 0 ? `${massDepth}% off` : 'Hold'}</td>
      <td>${prestigeDepth > 0 ? `${prestigeDepth}% off` : 'Hold'}</td>
      <td class="text-nowrap">${skuLabel}</td>
      <td>${unitDelta > 0 ? `<span class="text-success">+${Math.round(unitDelta)} units</span>` : unitDelta < 0 ? `<span class="text-danger">${Math.round(unitDelta)} units</span>` : '--'}</td>
    </tr>`);
  }

  planBody.innerHTML = rows.join('');
}

function updateChannelPromoSimulator() {
  if (!baseline || !skuWeeklyData.length) return;

  const massPromo = Number(document.getElementById('mass-promo-slider')?.value || 0);
  const prestigePromo = Number(document.getElementById('prestige-promo-slider')?.value || 0);
  const skuBoostPct = Number(document.getElementById('channel-promo-sku-boost-slider')?.value || 0);
  const competitorShockPct = Number(document.getElementById('channel-promo-comp-shock')?.value || 0);
  const compShockProduct = document.getElementById('channel-promo-comp-shock-product')?.value || 'all';
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

  const rowsForMigration = skuWeeklyData.filter(row => {
    if (Number(row.week_of_season) !== currentSeasonWeek) return false;
    if (group !== 'all' && row.product_group !== group) return false;
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });

  const currentWeekSocialSummary = getSocialSummaryForWeek(currentSeasonWeek);
  const rowSocialStats = rows.reduce((acc, row) => {
    const normalized = normalizeSocialScore(row.social_engagement_score);
    if (Number.isFinite(normalized)) {
      acc.sum += normalized;
      acc.count += 1;
    }
    return acc;
  }, { sum: 0, count: 0 });
  const rowSocialScore = rowSocialStats.count > 0
    ? (rowSocialStats.sum / rowSocialStats.count)
    : null;
  const referenceSocialScore = Number.isFinite(rowSocialScore)
    ? rowSocialScore
    : (Number.isFinite(currentWeekSocialSummary.score) ? currentWeekSocialSummary.score : null);
  const socialReferenceForModel = Number.isFinite(referenceSocialScore) ? referenceSocialScore : null;
  const socialNoShockScore = socialReferenceForModel;
  const socialScore = Number.isFinite(referenceSocialScore)
    ? referenceSocialScore + socialShockPts
    : null;

  const objectiveSnapshot = buildObjectiveSnapshot(
    rows,
    objectiveKey,
    massPromo,
    prestigePromo,
    sku,
    skuBoostPct,
    socialScore,
    competitorShockPct,
    socialReferenceForModel,
    compShockProduct
  );
  const objectiveNoSocialShockSnapshot = buildObjectiveSnapshot(
    rows,
    objectiveKey,
    massPromo,
    prestigePromo,
    sku,
    skuBoostPct,
    socialNoShockScore,
    competitorShockPct,
    socialReferenceForModel,
    compShockProduct
  );
  const {
    scenarios,
    transfers: cannibalizationTransfers,
    totals,
    revenueDeltaPct,
    profitDeltaPct,
    groupLift
  } = objectiveSnapshot;
  const noSocialScenarios = objectiveNoSocialShockSnapshot.scenarios || [];
  const noActionScenarios = rows.map(row =>
    computeScenarioForRow(
      row,
      0,
      objectiveKey,
      socialScore,
      competitorShockPct,
      socialReferenceForModel,
      compShockProduct
    )
  );
  const migrationSnapshot = (rowsForMigration.length >= 2)
    ? buildObjectiveSnapshot(
      rowsForMigration,
      objectiveKey,
      massPromo,
      prestigePromo,
      sku,
      skuBoostPct,
      socialScore,
      competitorShockPct,
      socialReferenceForModel,
      compShockProduct
    )
    : objectiveSnapshot;
  const migrationNoSocialSnapshot = (rowsForMigration.length >= 2)
    ? buildObjectiveSnapshot(
      rowsForMigration,
      objectiveKey,
      massPromo,
      prestigePromo,
      sku,
      skuBoostPct,
      socialNoShockScore,
      competitorShockPct,
      socialReferenceForModel,
      compShockProduct
    )
    : objectiveNoSocialShockSnapshot;
  const migrationTransfers = migrationSnapshot.transfers || cannibalizationTransfers;
  const migrationScenarios = migrationSnapshot.scenarios || scenarios;
  const migrationNoSocialScenarios = migrationNoSocialSnapshot.scenarios || noSocialScenarios;

  const liftFactor = totals.baselineUnits > 0 ? totals.scenarioUnits / totals.baselineUnits : 1;

  const revenueDeltaEl = document.getElementById('channel-promo-revenue-delta');
  const revenueNoteEl = document.getElementById('channel-promo-revenue-note');
  const profitDeltaEl = document.getElementById('channel-promo-profit-delta');
  const profitNoteEl = document.getElementById('channel-promo-profit-note');

  const revenueDollarDelta = totals.scenarioRevenue - totals.baselineRevenue;
  const profitDollarDelta = totals.scenarioProfit - totals.baselineProfit;

  if (revenueDeltaEl && revenueNoteEl) {
    revenueDeltaEl.textContent = `${formatPercent(revenueDeltaPct)} (${revenueDollarDelta >= 0 ? '+' : ''}${formatCurrency(revenueDollarDelta)})`;
    revenueDeltaEl.className = `fs-4 fw-bold ${revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
    revenueNoteEl.innerHTML = `<span>Baseline ${formatCurrency(totals.baselineRevenue)}</span><span>Scenario ${formatCurrency(totals.scenarioRevenue)}</span>`;
  }
  if (profitDeltaEl && profitNoteEl) {
    profitDeltaEl.textContent = `${formatPercent(profitDeltaPct)} (${profitDollarDelta >= 0 ? '+' : ''}${formatCurrency(profitDollarDelta)})`;
    profitDeltaEl.className = `fs-4 fw-bold ${profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
    profitNoteEl.innerHTML = `<span>Baseline ${formatCurrency(totals.baselineProfit)}</span><span>Scenario ${formatCurrency(totals.scenarioProfit)}</span>`;
  }

  let posture = 'Balanced';
  let pillClass = 'badge rounded-pill bg-secondary-subtle text-body-secondary';
  const posturePill = document.getElementById('channel-promo-posture-pill');
  const postureLine1 = document.getElementById('channel-promo-posture-line1');
  const postureLine2 = document.getElementById('channel-promo-posture-line2');
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
  if (posturePill && postureLine1 && postureLine2) {
    posturePill.className = pillClass;
    posturePill.textContent = posture;
    postureLine1.textContent = `${objective.label}.`;
    const liftPct = formatPercent((liftFactor - 1) || 0);
    const revSign = revenueDollarDelta >= 0 ? '+' : '';
    const profSign = profitDollarDelta >= 0 ? '+' : '';
    const compSign = competitorShockPct >= 0 ? '+' : '';
    const socSign = socialShockPts >= 0 ? '+' : '';
    postureLine2.innerHTML =
      `<span class="me-3">Units <strong>${liftPct}</strong></span>` +
      `<span class="me-3">Rev <strong>${revSign}${formatCurrency(revenueDollarDelta)}</strong></span>` +
      `<span>Profit <strong>${profSign}${formatCurrency(profitDollarDelta)}</strong></span>`;
  }

  const liveRevenueEl = document.getElementById('channel-promo-live-revenue');
  const liveProfitEl = document.getElementById('channel-promo-live-profit');
  const livePostureEl = document.getElementById('channel-promo-live-posture');
  const liveNoteEl = document.getElementById('channel-promo-live-note');
  if (liveRevenueEl) {
    liveRevenueEl.textContent = `${formatPercent(revenueDeltaPct)} (${revenueDollarDelta >= 0 ? '+' : ''}${formatCurrency(revenueDollarDelta)})`;
    liveRevenueEl.className = `fw-semibold ${revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
  }
  if (liveProfitEl) {
    liveProfitEl.textContent = `${formatPercent(profitDeltaPct)} (${profitDollarDelta >= 0 ? '+' : ''}${formatCurrency(profitDollarDelta)})`;
    liveProfitEl.className = `fw-semibold ${profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}`;
  }
  if (livePostureEl) {
    livePostureEl.className = pillClass;
    livePostureEl.textContent = posture;
  }
  if (liveNoteEl) {
    liveNoteEl.textContent =
      `${objective.label}. Shock inputs: competitor ${competitorShockPct >= 0 ? '+' : ''}${competitorShockPct}%, social ${socialShockPts >= 0 ? '+' : ''}${socialShockPts} pts.`;
  }

  const labels = ['Target & Amazon', 'Sephora & Ulta'];
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
  const totalCurrentInventory = rows.reduce((sum, row) => sum + Number(row.end_inventory_units || 0), 0);
  const scenarioEndInventory = Number(inventoryProjection?.scenarioEnd || 0);
  const clearancePct = totalCurrentInventory > 0
    ? ((totalCurrentInventory - scenarioEndInventory) / totalCurrentInventory)
    : 0;

  const liveLeftoverEl = document.getElementById('channel-promo-live-leftover');
  const liveClearanceLabelEl = document.getElementById('channel-promo-live-clearance-label');
  const liveClearanceBarEl = document.getElementById('channel-promo-live-clearance-bar');
  if (liveLeftoverEl) {
    liveLeftoverEl.textContent = formatNumber(scenarioEndInventory, 0);
  }
  if (liveClearanceLabelEl) {
    if (totalCurrentInventory > 0) {
      liveClearanceLabelEl.textContent = `${clearancePct >= 0 ? '+' : ''}${formatPercent(clearancePct)}`;
      liveClearanceLabelEl.className = clearancePct >= 0 ? 'text-success' : 'text-danger';
    } else {
      liveClearanceLabelEl.textContent = '--';
      liveClearanceLabelEl.className = 'text-muted';
    }
  }
  if (liveClearanceBarEl) {
    const widthPct = totalCurrentInventory > 0 ? clamp(clearancePct * 100, 0, 100) : 0;
    liveClearanceBarEl.style.width = `${widthPct.toFixed(0)}%`;
    liveClearanceBarEl.className = `progress-bar ${clearancePct >= 0 ? 'bg-success' : 'bg-danger'}`;
  }

  const frontierRows = ['balance', 'sales', 'profit'].map(key => {
    const snapshot = buildObjectiveSnapshot(
      rows,
      key,
      massPromo,
      prestigePromo,
      sku,
      skuBoostPct,
      socialScore,
      competitorShockPct,
      socialReferenceForModel,
      compShockProduct
    );
    const projection = projectWeek17Inventory(group, sku, applyMass, applyPrestige, snapshot.groupLift);
    const clearancePct = totalCurrentInventory > 0
      ? ((totalCurrentInventory - projection.scenarioEnd) / totalCurrentInventory)
      : 0;
    return {
      objectiveKey: key,
      label: OBJECTIVE_CONFIG[key]?.label || key,
      revenueDeltaPct: snapshot.revenueDeltaPct,
      profitDeltaPct: snapshot.profitDeltaPct,
      scenarioEnd: projection.scenarioEnd,
      clearancePct
    };
  });

  renderSeasonStory(seasonRows, inventoryProjection);
  renderDriverDecomposition(scenarios, migrationNoSocialScenarios, migrationTransfers, socialShockPts);
  renderElasticityTable(rows, socialScore, socialNoShockScore);
  renderCannibalizationTable(migrationTransfers);
  renderMigrationMatrix(migrationTransfers, migrationScenarios);
  renderObjectiveFrontier(frontierRows, objectiveKey);
  renderSkuResponseView(scenarios, noActionScenarios, migrationTransfers, competitorShockPct, socialShockPts);
  renderSkuCausalWaterfall(
    scenarios,
    migrationNoSocialScenarios,
    noActionScenarios,
    migrationTransfers,
    sku,
    socialShockPts
  );
  updateSignalCards(socialShockPts, referenceSocialScore, currentWeekSocialSummary.trendDelta);
  renderLivePulseChart();
  renderLiveFeed(currentSeasonWeek);
  updateAiRecommendation(rows, objectiveKey, socialScore, inventoryProjection);
  renderWeeklyActionPlan(massPromo, prestigePromo, sku, groupLift, objectiveKey);

  // --- ROI calculation ---
  // Promo spend = discount depth * units sold at discount (revenue given up per unit * scenario units)
  const avgBaselinePrice = totals.baselineUnits > 0
    ? totals.baselineRevenue / totals.baselineUnits
    : 0;
  const avgScenarioPrice = totals.scenarioUnits > 0
    ? totals.scenarioRevenue / totals.scenarioUnits
    : 0;
  const priceDiscount = Math.max(0, avgBaselinePrice - avgScenarioPrice);
  const promoSpend = priceDiscount * totals.scenarioUnits;
  // Incremental revenue = extra units sold * scenario price
  const incrementalUnits = Math.max(0, totals.scenarioUnits - totals.baselineUnits);
  const incrementalRevenue = incrementalUnits * avgScenarioPrice;
  const promoROI = promoSpend > 0 ? incrementalRevenue / promoSpend : 0;

  const spendEl = document.getElementById('channel-promo-spend');
  const spendNoteEl = document.getElementById('channel-promo-spend-note');
  const incrRevEl = document.getElementById('channel-promo-incremental-rev');
  const incrNoteEl = document.getElementById('channel-promo-incremental-note');
  const roiEl = document.getElementById('channel-promo-roi');
  const roiNoteEl = document.getElementById('channel-promo-roi-note');

  if (spendEl) {
    spendEl.textContent = promoSpend > 0 ? formatCurrency(promoSpend) : '$0';
    spendEl.className = `fs-5 fw-bold ${promoSpend > 0 ? 'text-danger' : 'text-muted'}`;
  }
  if (spendNoteEl) {
    spendNoteEl.textContent = promoSpend > 0
      ? `Avg discount: ${formatCurrency(priceDiscount)}/unit on ${formatNumber(totals.scenarioUnits)} units`
      : 'No promo discount applied';
  }
  if (incrRevEl) {
    incrRevEl.textContent = incrementalRevenue > 0 ? `+${formatCurrency(incrementalRevenue)}` : '$0';
    incrRevEl.className = `fs-5 fw-bold ${incrementalRevenue > 0 ? 'text-success' : 'text-muted'}`;
  }
  if (incrNoteEl) {
    incrNoteEl.textContent = incrementalUnits > 0
      ? `+${formatNumber(incrementalUnits)} extra units at ${formatCurrency(avgScenarioPrice)}/unit`
      : 'No incremental volume from promo';
  }
  if (roiEl) {
    if (promoSpend > 0 && incrementalRevenue > 0) {
      roiEl.textContent = `${promoROI.toFixed(1)}x`;
      if (promoROI >= 3) {
        roiEl.className = 'fs-4 fw-bold text-success';
      } else if (promoROI >= 1.5) {
        roiEl.className = 'fs-4 fw-bold text-primary';
      } else {
        roiEl.className = 'fs-4 fw-bold text-danger';
      }
    } else if (promoSpend === 0) {
      roiEl.textContent = '--';
      roiEl.className = 'fs-4 fw-bold text-muted';
    } else {
      roiEl.textContent = '0x';
      roiEl.className = 'fs-4 fw-bold text-danger';
    }
  }
  if (roiNoteEl) {
    if (promoSpend > 0 && promoROI > 0) {
      let roiVerdict = '';
      if (promoROI >= 3) roiVerdict = 'Strong return — approve';
      else if (promoROI >= 1.5) roiVerdict = 'Acceptable return';
      else if (promoROI >= 1) roiVerdict = 'Marginal — review before approving';
      else roiVerdict = 'Below breakeven — reduce promo depth';
      roiNoteEl.innerHTML = `${formatCurrency(promoSpend)} spend → ${formatCurrency(incrementalRevenue)} gain. <strong>${roiVerdict}.</strong>`;
    } else {
      roiNoteEl.textContent = 'Return per $1 of promo spend';
    }
  }

  const marketRow = getExternalFactorsForWeek(currentSeasonWeek) || {};
  latestPromoSnapshot = {
    weekOfSeason: currentSeasonWeek,
    planningHorizonWeeks: getSeasonWeeks(),
    weekStartDate: getSeasonDateForWeek(currentSeasonWeek),
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
    cannibalizationTransfers: migrationTransfers,
    avgCompetitorMassPrice: Number(marketRow.competitor_mass_price) || null,
    avgCompetitorPrestigePrice: Number(marketRow.competitor_prestige_price) || null,
    socialScore: Number(socialScore) || null,
    inventoryProjection,
    objectiveFrontier: frontierRows,
    decomposition: {
      ownPromoPct: scenarios.reduce((sum, row) => sum + ((row.ownMultiplier - 1) * row.baselineUnits), 0) / (totals.baselineUnits || 1),
      competitorPct: scenarios.reduce((sum, row) => sum + ((row.competitorMultiplier - 1) * row.baselineUnits), 0) / (totals.baselineUnits || 1),
      socialPct: (totals.baselineUnits || 1) > 0
        ? (
          scenarios.reduce((sum, row) => sum + Number(row.scenarioUnits || 0), 0) -
          migrationNoSocialScenarios.reduce((sum, row) => sum + Number(row.scenarioUnits || 0), 0)
        ) / (totals.baselineUnits || 1)
        : 0
    }
  };

  if (window.onChannelPromoSnapshotUpdated && typeof window.onChannelPromoSnapshotUpdated === 'function') {
    window.onChannelPromoSnapshotUpdated(latestPromoSnapshot);
  }

}

// --------------- Competitor Alert Banner ---------------
const SKU_DISPLAY_NAMES = {
  SUN_S1: 'Daily Shield SPF 40',
  SUN_S2: 'Invisible Mist SPF 50',
  SUN_S3: 'Sport Gel SPF 60',
  MOI_M1: 'Hydra Daily Lotion',
  MOI_M2: 'Barrier Repair Cream',
  MOI_M3: 'Night Recovery Balm'
};

const CHANNEL_DISPLAY_NAMES = {
  target: 'Target',
  amazon: 'Amazon',
  sephora: 'Sephora',
  ulta: 'Ulta'
};

async function updateCompetitorAlertBanner() {
  const banner = document.getElementById('competitor-alert-banner');
  if (!banner) return;

  try {
    const feed = await loadCompetitorPriceFeed();
    if (!feed?.length) { banner.classList.add('d-none'); return; }

    // Group by week (captured_at date)
    const weekMap = new Map();
    for (const row of feed) {
      const weekKey = row.captured_at?.slice(0, 10) || '';
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
      weekMap.get(weekKey).push(row);
    }

    const sortedWeeks = [...weekMap.keys()].sort();
    if (sortedWeeks.length < 2) { banner.classList.add('d-none'); return; }

    const latestWeek = sortedWeeks[sortedWeeks.length - 1];
    const prevWeek = sortedWeeks[sortedWeeks.length - 2];
    const latestRows = weekMap.get(latestWeek);
    const prevRows = weekMap.get(prevWeek);

    // Build lookup: sku+channel -> price for previous week
    const prevPriceMap = new Map();
    for (const row of prevRows) {
      prevPriceMap.set(`${row.matched_sku_id}_${row.channel}`, Number(row.observed_price) || 0);
    }

    // Find significant drops (>5%)
    const alerts = [];
    for (const row of latestRows) {
      const currPrice = Number(row.observed_price) || 0;
      const prevPrice = prevPriceMap.get(`${row.matched_sku_id}_${row.channel}`) || 0;
      if (prevPrice <= 0 || currPrice <= 0) continue;
      const dropPct = ((prevPrice - currPrice) / prevPrice) * 100;
      if (dropPct > 5) {
        alerts.push({
          sku: row.matched_sku_id,
          skuName: SKU_DISPLAY_NAMES[row.matched_sku_id] || row.matched_sku_id,
          channel: row.channel,
          channelName: CHANNEL_DISPLAY_NAMES[row.channel] || row.channel,
          prevPrice,
          currPrice,
          dropPct,
          promo: String(row.promo_flag).toLowerCase() === 'true'
        });
      }
    }

    if (alerts.length === 0) { banner.classList.add('d-none'); return; }

    // Sort by drop magnitude
    alerts.sort((a, b) => b.dropPct - a.dropPct);

    const titleEl = document.getElementById('competitor-alert-title');
    const bodyEl = document.getElementById('competitor-alert-body');

    if (alerts.length === 1) {
      const a = alerts[0];
      titleEl.textContent = `Competitor Price Alert: ${a.skuName} (${a.sku})`;
      bodyEl.innerHTML = `${a.channelName} competitor undercut <strong>${a.skuName}</strong> by ${a.dropPct.toFixed(1)}% — price dropped from $${a.prevPrice.toFixed(2)} to $${a.currPrice.toFixed(2)}${a.promo ? ' (promo flagged)' : ''}. Your price gap may be widening.`;
    } else {
      titleEl.textContent = `Competitor Price Alert: ${alerts.length} undercuts detected`;
      const lines = alerts.slice(0, 4).map(a =>
        `<strong>${a.skuName}</strong> on ${a.channelName}: down ${a.dropPct.toFixed(1)}% ($${a.prevPrice.toFixed(2)} → $${a.currPrice.toFixed(2)})${a.promo ? ' ⚡promo' : ''}`
      );
      bodyEl.innerHTML = lines.join('<br>');
    }

    banner.classList.remove('d-none');

    // Wire buttons
    const impactBtn = document.getElementById('competitor-alert-impact-btn');
    const adjustBtn = document.getElementById('competitor-alert-adjust-btn');

    if (impactBtn) {
      impactBtn.onclick = () => {
        const skuTable = document.getElementById('channel-promo-sku-response');
        if (skuTable) skuTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }

    if (adjustBtn) {
      adjustBtn.onclick = () => {
        const pivotBtn = document.getElementById('channel-promo-preset-pivot');
        if (pivotBtn) pivotBtn.click();
      };
    }
  } catch (err) {
    console.warn('Competitor alert banner error:', err);
    banner.classList.add('d-none');
  }
}

async function initializeChannelPromoSimulator() {
  const root = document.getElementById('channel-promo-simulator');
  if (!root) return;

  try {
    const [weeklyData, params, skuWeekly, external, social, promoMeta, events] = await Promise.all([
      getWeeklyData('all'),
      loadElasticityParams(),
      loadSkuWeeklyData(),
      loadExternalFactors(),
      loadSocialSignals(),
      loadPromoMetadata(),
      loadEventCalendar()
    ]);

    if (!weeklyData?.length || !skuWeekly?.length || !params) return;

    skuWeeklyData = skuWeekly;
    externalFactors = external || [];
    socialSignals = social || [];
    promoMetadata = promoMeta || {};
    retailEvents = events || [];

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
    const compShockProductSelect = document.getElementById('channel-promo-comp-shock-product');
    const socialShockSlider = document.getElementById('channel-promo-social-shock');
    const presetBaselineBtn = document.getElementById('channel-promo-preset-baseline');
    const presetPivotBtn = document.getElementById('channel-promo-preset-pivot');
    const presetSocialBtn = document.getElementById('channel-promo-preset-social');
    const presetClearanceBtn = document.getElementById('channel-promo-preset-clearance');
    const runCannibalDemoBtn = document.getElementById('channel-promo-run-cannibal-demo');
    const narrativeNoteEl = document.getElementById('channel-promo-narrative-note');
    const applyMass = document.getElementById('channel-promo-apply-mass');
    const applyPrestige = document.getElementById('channel-promo-apply-prestige');
    const skuBoostValue = document.getElementById('channel-promo-sku-boost-value');
    const skuBoostHelp = document.getElementById('channel-promo-sku-boost-help');
    const compShockValue = document.getElementById('channel-promo-comp-shock-value');
    const socialShockValue = document.getElementById('channel-promo-social-shock-value');
    const weekSlider = document.getElementById('channel-promo-week-slider');
    const weekValue = document.getElementById('channel-promo-week-value');
    const horizonInput = document.getElementById('channel-promo-horizon-input');
    const liveToggleBtn = document.getElementById('channel-promo-live-toggle');
    const liveResetBtn = document.getElementById('channel-promo-live-reset');
    const liveSpeedSelect = document.getElementById('channel-promo-live-speed');
    const liveAutoSignal = document.getElementById('channel-promo-live-autosignal');

    maxObservedSeasonWeek = skuWeeklyData.reduce(
      (max, row) => Math.max(max, Number(row.week_of_season) || 0),
      DEFAULT_SEASON_WEEKS
    );
    const requestedHorizon = Number(window.promoPlanningHorizonWeeks || horizonInput?.value || DEFAULT_SEASON_WEEKS);
    populatePlanningHorizonOptions(maxObservedSeasonWeek, requestedHorizon);
    setPlanningHorizonWeeks(requestedHorizon, {
      maxWeekObserved: maxObservedSeasonWeek,
      emit: false
    });
    const getEffectiveMaxWeek = () => Math.min(maxObservedSeasonWeek, getSeasonWeeks());
    if (weekSlider) weekSlider.max = String(getEffectiveMaxWeek());
    if (currentSeasonWeek > getEffectiveMaxWeek()) currentSeasonWeek = getEffectiveMaxWeek();

    const setLivePlaybackButton = (playing) => {
      if (!liveToggleBtn) return;
      if (playing) {
        liveToggleBtn.className = 'btn btn-sm btn-danger';
        liveToggleBtn.innerHTML = '<i class="bi bi-pause-fill me-1"></i>Pause Live';
      } else {
        liveToggleBtn.className = 'btn btn-sm btn-primary';
        liveToggleBtn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Play Live';
      }
    };

    const stopLivePlayback = () => {
      if (livePlaybackTimer) {
        clearInterval(livePlaybackTimer);
        livePlaybackTimer = null;
      }
      setLivePlaybackButton(false);
    };


    const getPlaybackIntervalMs = () => {
      const speed = String(liveSpeedSelect?.value || '1x');
      if (speed === '4x') return 500;
      if (speed === '2x') return 850;
      return 1300;
    };

    const applyAutoSignalsForWeek = (weekOfSeason) => {
      if (!liveAutoSignal?.checked) return;
      const week = clamp(Number(weekOfSeason) || 1, 1, getEffectiveMaxWeek());
      const marketCurrent = getExternalFactorsForWeek(week);
      const marketPrev = getExternalFactorsForWeek(Math.max(1, week - 1));
      const socialCurrent = getSocialSignalForWeek(week);
      const socialPrev = getSocialSignalForWeek(Math.max(1, week - 1));

      const competitorNow = Number(marketCurrent?.competitor_avg_price || 0);
      const competitorPrev = Number(marketPrev?.competitor_avg_price || 0);
      const competitorShock = competitorPrev > 0
        ? ((competitorNow - competitorPrev) / competitorPrev) * 100
        : 0;
      const socialNow = Number(normalizeSocialScore(socialCurrent?.brand_social_index ?? socialCurrent?.social_sentiment ?? null));
      const socialPrevVal = Number(normalizeSocialScore(socialPrev?.brand_social_index ?? socialPrev?.social_sentiment ?? null));
      const socialShock = Number.isFinite(socialNow) && Number.isFinite(socialPrevVal)
        ? (socialNow - socialPrevVal)
        : 0;

      const competitorShockRounded = clamp(quantizeToStep(competitorShock, 5), -20, 20);
      const socialShockRounded = clamp(quantizeToStep(socialShock, 5), -20, 20);
      if (compShockSlider) compShockSlider.value = String(competitorShockRounded);
      if (socialShockSlider) socialShockSlider.value = String(socialShockRounded);
    };

    const setWeek = (weekOfSeason, options = {}) => {
      const { applyAutoSignals = false } = options;
      currentSeasonWeek = clamp(Math.round(Number(weekOfSeason) || 1), 1, getEffectiveMaxWeek());
      if (weekSlider) weekSlider.value = String(currentSeasonWeek);
      if (weekValue) weekValue.textContent = `W${currentSeasonWeek}`;
      if (applyAutoSignals) applyAutoSignalsForWeek(currentSeasonWeek);
    };

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
          ? 'Extra discount on selected product shifts demand from sibling products (cannibalization).'
          : 'Select one product above to model cannibalization shifts from sibling products.';
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
      stopLivePlayback();
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
        setControl(skuSelect, findSkuIdByName('Sport Gel SPF 60') || 'SUN_S3');
        setControl(massSlider, 5);
        setControl(prestigeSlider, 0);
        setControl(skuBoostSlider, 0);
        setControl(compShockSlider, 0);
        setControl(socialShockSlider, 15);
        setControl(objectiveSelect, 'profit');
        if (applyMass) applyMass.checked = false;
        if (applyPrestige) applyPrestige.checked = true;
        updateSkuBoostState();
        setNarrative('In-Season Pivot: TikTok momentum spikes for Sport Gel SPF 60, so we hold depth and protect margin where social pull is strong.');
      } else if (type === 'clearance') {
        setControl(groupSelect, 'all');
        populateSkuSelector();
        setControl(skuSelect, findSkuIdByName('Daily Shield SPF 40') || 'SUN_S1');
        setControl(massSlider, 20);
        setControl(prestigeSlider, 10);
        setControl(skuBoostSlider, 8);
        setControl(compShockSlider, -5);
        setControl(socialShockSlider, -5);
        setControl(objectiveSelect, 'sales');
        if (applyMass) applyMass.checked = true;
        if (applyPrestige) applyPrestige.checked = true;
        updateSkuBoostState();
        setNarrative(`Future Vision: push a guided SKU mix to move inventory close to zero by week ${getSeasonWeeks()}.`);
      }
      updateValues();
    };

    const runCannibalizationDemo = () => {
      stopLivePlayback();
      setControl(groupSelect, 'sunscreen');
      populateSkuSelector();
      setControl(skuSelect, findSkuIdByName('Daily Shield SPF 40') || 'SUN_S1');
      setControl(massSlider, 10);
      setControl(prestigeSlider, 0);
      setControl(skuBoostSlider, 12);
      setControl(compShockSlider, 0);
      setControl(socialShockSlider, 5);
      setControl(objectiveSelect, 'sales');
      if (applyMass) applyMass.checked = true;
      if (applyPrestige) applyPrestige.checked = false;
      updateSkuBoostState();
      setNarrative('Cannibalization demo: discount Daily Shield SPF 40 and track unit migration from sibling sunscreen products.');
      updateValues();
    };



    // Apply Recommendation button
    const applyRecommendationBtn = document.getElementById('channel-promo-apply-recommendation');
    const applyStatusEl = document.getElementById('channel-promo-apply-status');
    if (applyRecommendationBtn) {
      applyRecommendationBtn.addEventListener('click', () => {
        if (!latestRecommendation) return;
        const rec = latestRecommendation;
        setControl(massSlider, rec.massPromo);
        setControl(prestigeSlider, rec.prestigePromo);
        if (rec.focusSku) {
          setControl(groupSelect, 'all');
          populateSkuSelector();
          setControl(skuSelect, rec.focusSku);
          setControl(skuBoostSlider, rec.skuBoost);
          updateSkuBoostState();
        }
        updateValues();
        if (applyStatusEl) {
          applyStatusEl.textContent = `Applied: Mass ${rec.massPromo}%, Prestige ${rec.prestigePromo}%${rec.focusSku ? `, focus ${rec.focusSku}` : ''}`;
          applyStatusEl.className = 'small text-success';
          setTimeout(() => { applyStatusEl.textContent = ''; }, 4000);
        }
      });
    }

    stopLivePlayback();
    massSlider?.addEventListener('input', updateValues);
    prestigeSlider?.addEventListener('input', updateValues);
    skuBoostSlider?.addEventListener('input', updateValues);
    compShockSlider?.addEventListener('input', updateValues);
    compShockProductSelect?.addEventListener('change', updateChannelPromoSimulator);
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
    presetBaselineBtn?.addEventListener('click', () => {
      applyPreset('baseline');
    });
    presetPivotBtn?.addEventListener('click', () => {
      applyPreset('pivot');
    });
    presetSocialBtn?.addEventListener('click', () => {
      applyPreset('social');
    });
    presetClearanceBtn?.addEventListener('click', () => {
      applyPreset('clearance');
    });
    runCannibalDemoBtn?.addEventListener('click', runCannibalizationDemo);
    applyMass?.addEventListener('change', updateChannelPromoSimulator);
    applyPrestige?.addEventListener('change', updateChannelPromoSimulator);
    weekSlider?.addEventListener('input', () => {
      stopLivePlayback();
      setWeek(weekSlider.value, { applyAutoSignals: true });
      updateValues();
    });
    liveAutoSignal?.addEventListener('change', () => {
      if (liveAutoSignal.checked) {
        applyAutoSignalsForWeek(currentSeasonWeek);
      }
      updateValues();
    });
    liveSpeedSelect?.addEventListener('change', () => {
      if (!livePlaybackTimer) return;
      clearInterval(livePlaybackTimer);
      livePlaybackTimer = setInterval(() => {
        const nextWeek = currentSeasonWeek + 1;
        if (nextWeek > getEffectiveMaxWeek()) {
          stopLivePlayback();
          return;
        }
        setWeek(nextWeek, { applyAutoSignals: true });
        updateValues();
      }, getPlaybackIntervalMs());
    });
    liveToggleBtn?.addEventListener('click', () => {
      if (livePlaybackTimer) {
        stopLivePlayback();
        return;
      }
      setLivePlaybackButton(true);
      livePlaybackTimer = setInterval(() => {
        const nextWeek = currentSeasonWeek + 1;
        if (nextWeek > getEffectiveMaxWeek()) {
          stopLivePlayback();
          return;
        }
        setWeek(nextWeek, { applyAutoSignals: true });
        updateValues();
      }, getPlaybackIntervalMs());
    });
    horizonInput?.addEventListener('change', () => {
      const updated = setPlanningHorizonWeeks(horizonInput.value, { maxWeekObserved: maxObservedSeasonWeek });
      if (weekSlider) weekSlider.max = String(getEffectiveMaxWeek());
      if (currentSeasonWeek > updated) {
        setWeek(updated, { applyAutoSignals: true });
      }
      stopLivePlayback();
      updateValues();
    });
    liveResetBtn?.addEventListener('click', () => {
      stopLivePlayback();
      setWeek(1, { applyAutoSignals: true });
      updateValues();
    });

    updateSkuBoostState();
    setWeek(currentSeasonWeek, { applyAutoSignals: true });
    updateValues();

    // Populate competitor alert banner
    updateCompetitorAlertBanner();
  } catch (error) {
    console.error('Error initializing Channel Promotions Simulator:', error);
  }
}

window.initializeChannelPromoSimulator = initializeChannelPromoSimulator;
window.getChannelPromoSnapshot = () => latestPromoSnapshot;
window.setChannelPromoRecommendation = (rec) => {
  latestRecommendation = rec;
};
