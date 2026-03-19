/**
 * Event Calendar Module
 * Renders and manages the event calendar UI
 * RFP-aligned: Slides 12, 16, 18 compliance
 */

import {
  loadEventCalendar,
  loadPromoMetadata,
  loadValidationWindows,
  loadExternalFactors,
  loadSocialSignals,
  loadSkuWeeklyData,
  loadCompetitorPriceFeed,
  loadProductChannelHistory
} from './data-loader.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

// Global state
let allEvents = [];
let promoMetadata = {};
let validationWindows = {};
let skuCatalog = new Map();
let competitorFeed = [];
let productHistoryRows = [];
let activeFilters = {
  priceChange: true,
  competitorPriceChange: true,
  promo: true,
  tentpole: true
};
let activePromoFilters = {
  season: 'all',
  channel: 'all'
};
let activeProductFilter = 'all';
let selectedPromoId = null;
let eventCompetitiveSignalsChart = null;
let eventSocialSignalsChart = null;
let promoStoryPhaseChart = null;
let promoChannelLiftChart = null;

const RETAIL_CHANNELS = ['sephora', 'ulta', 'target', 'amazon', 'dtc'];
const CHANNEL_LABELS = {
  sephora: 'Sephora',
  ulta: 'Ulta',
  target: 'Target',
  amazon: 'Amazon',
  dtc: 'DTC'
};

const STORY_PHASE_LABELS = {
  baseline: 'Historical Baseline',
  pivot: 'In-Season Pivot',
  future: 'End-of-Season Plan'
};
const CALENDAR_TODAY = new Date('2026-03-19T00:00:00');
const DAY_MS = 24 * 60 * 60 * 1000;

function formatIsoDate(date) {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
}

function getTimelineWindow() {
  const startDate = new Date(CALENDAR_TODAY);
  startDate.setDate(startDate.getDate() - 365);
  const endDate = new Date(CALENDAR_TODAY);
  endDate.setDate(endDate.getDate() + 365);
  return { startDate, endDate };
}

function buildTimelineMonthMarkers(startDate, endDate) {
  const totalDays = Math.max(1, Math.floor((endDate - startDate) / DAY_MS));
  const markers = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  if (cursor < startDate) {
    cursor.setMonth(cursor.getMonth() + 1);
  }

  while (cursor <= endDate) {
    const position = Math.max(0, Math.min(100, ((cursor - startDate) / DAY_MS / totalDays) * 100));
    const month = cursor.getMonth();
    markers.push({
      position,
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      fullLabel: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isMajor: month === 0 || month === 3 || month === 6 || month === 9
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return markers;
}

function buildRollingTentpoleEvents() {
  return [
    {
      event_id: 'AUTO_TENTPOLE_2025_SPRING_RESET',
      date: '2025-04-15',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Spring reset skincare period with hydration demand lift and new-routine basket building.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_MEMORIAL_DAY',
      date: '2025-05-26',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Memorial Day sun-care traffic spike across mass and prestige channels.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_PRIME_DAY',
      date: '2025-07-15',
      event_type: 'Tentpole',
      channel_group: 'mass',
      affected_channel: 'amazon|target',
      tier: 'ad_supported',
      affected_cohort: 'amazon|target',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Prime Day marketplace disruption with concentrated mass-channel discounting and competitor undercut risk.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_LABOR_DAY',
      date: '2025-09-01',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Labor Day closeout window with summer inventory compression and elevated markdown pressure.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_HOLIDAY_SET_LAUNCH',
      date: '2025-10-15',
      event_type: 'Tentpole',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Holiday gift-set launch period with prestige-led traffic and higher basket attachment.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_THANKSGIVING',
      date: '2025-11-27',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Thanksgiving and Black Friday basket-building window with elevated promo intensity.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2025_CHRISTMAS',
      date: '2025-12-25',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Christmas gifting halo with late-season replenishment and premium gift-set demand.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_SPRING_RESET',
      date: '2026-04-14',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Spring skincare reset with moisture-led discovery and routine refresh demand.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_MEMORIAL_DAY',
      date: '2026-05-25',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Memorial Day sun-care traffic spike across mass and prestige channels.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_SUMMER_KICKOFF',
      date: '2026-06-21',
      event_type: 'Tentpole',
      channel_group: 'mass',
      affected_channel: 'target|amazon|dtc',
      tier: 'ad_supported',
      affected_cohort: 'target|amazon|dtc',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Summer kickoff with sun-care replenishment acceleration and DTC discovery content support.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_PRIME_DAY',
      date: '2026-07-14',
      event_type: 'Tentpole',
      channel_group: 'mass',
      affected_channel: 'amazon|target',
      tier: 'ad_supported',
      affected_cohort: 'amazon|target',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Prime Day marketplace pressure with heightened competitor undercut risk on mass channels.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_LABOR_DAY',
      date: '2026-09-07',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Labor Day closeout and late-summer inventory clearing window across the portfolio.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_HOLIDAY_SET_LAUNCH',
      date: '2026-10-13',
      event_type: 'Tentpole',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Holiday set launch and premium gifting build with prestige-first conversion.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_THANKSGIVING',
      date: '2026-11-26',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Thanksgiving and Black Friday traffic spike with holiday gift conversion across all channels.'
    },
    {
      event_id: 'AUTO_TENTPOLE_2026_CHRISTMAS',
      date: '2026-12-25',
      event_type: 'Tentpole',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      notes: 'Christmas gifting halo with prestige-led basket mix and refill demand spillover into mass.'
    }
  ];
}

function buildRollingMixedEvents() {
  return [
    {
      event_id: 'AUTO_MIX_2025_EARLY_SUMMER_PROMO',
      date: '2025-06-10',
      event_type: 'Promo Start',
      channel_group: 'mass',
      affected_channel: 'target|amazon',
      tier: 'ad_supported',
      affected_cohort: 'target|amazon',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 14,
      validation_window: 'test',
      notes: 'Early-summer sunscreen push on SUN_S1 and SUN_S2 across Target and Amazon to capture rising weekend traffic.'
    },
    {
      event_id: 'AUTO_MIX_2025_VIRAL_HYDRATION_SPIKE',
      date: '2025-07-22',
      event_type: 'Social Spike',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'clean',
      notes: 'Barrier-repair routine content lifts MOI_M2 and MOI_M3 buzz across Sephora and Ulta without immediate pricing changes.'
    },
    {
      event_id: 'AUTO_MIX_2025_LATE_SUMMER_UNDERCUT',
      date: '2025-08-18',
      event_type: 'Competitor Price Change',
      channel_group: 'mass',
      affected_channel: 'target|amazon',
      tier: 'ad_supported',
      affected_cohort: 'target|amazon',
      price_before: 21.5,
      price_after: 19.8,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'confounded',
      notes: 'Mass rival undercuts SUN_S3 in Target and Amazon ahead of late-summer sell-through, forcing sharper price-gap monitoring.'
    },
    {
      event_id: 'AUTO_MIX_2025_HOLIDAY_PREVIEW_PROMO',
      date: '2025-10-28',
      event_type: 'Promo Start',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 9,
      validation_window: 'clean',
      notes: 'Prestige holiday preview event on SUN_S2 and MOI_M2 to build gifting baskets without broad margin erosion.'
    },
    {
      event_id: 'AUTO_MIX_2025_BLACK_FRIDAY_UNDERCUT',
      date: '2025-11-24',
      event_type: 'Competitor Price Change',
      channel_group: 'mass',
      affected_channel: 'amazon',
      tier: 'ad_supported',
      affected_cohort: 'amazon',
      price_before: 20.9,
      price_after: 18.9,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'confounded',
      notes: 'Black Friday marketplace rival drops MOI_M2 pricing on Amazon, widening the mass-channel price gap just before peak traffic.'
    },
    {
      event_id: 'AUTO_MIX_2025_GIFTING_SOCIAL_SURGE',
      date: '2025-12-08',
      event_type: 'Social Spike',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'test',
      notes: 'Holiday gifting conversation lifts SUN_S2 and MOI_M3 mention volume across both mass and prestige cohorts.'
    },
    {
      event_id: 'AUTO_MIX_2026_POST_WINTER_SOCIAL',
      date: '2026-04-07',
      event_type: 'Social Spike',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta|dtc',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta|dtc',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'clean',
      notes: 'Skin-reset content trend boosts MOI_M1 and MOI_M2 interest in prestige and DTC before major promotional activity begins.'
    },
    {
      event_id: 'AUTO_MIX_2026_PRIME_DAY_LEADIN_UNDERCUT',
      date: '2026-06-30',
      event_type: 'Competitor Price Change',
      channel_group: 'mass',
      affected_channel: 'amazon|target',
      tier: 'ad_supported',
      affected_cohort: 'amazon|target',
      price_before: 22.4,
      price_after: 20.2,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'confounded',
      notes: 'Prime Day lead-in undercut on SUN_S3 across Amazon and Target increases urgency for mass-channel defense planning.'
    },
    {
      event_id: 'AUTO_MIX_2026_POST_SUMMER_RECOVERY_PROMO',
      date: '2026-08-11',
      event_type: 'Promo Start',
      channel_group: 'mass',
      affected_channel: 'target|amazon|dtc',
      tier: 'ad_supported',
      affected_cohort: 'target|amazon|dtc',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 12,
      validation_window: 'test',
      notes: 'Post-peak replenishment program on MOI_M1 and MOI_M2 supports repeat purchase after summer skincare usage spikes.'
    },
    {
      event_id: 'AUTO_MIX_2026_BARRIER_REPAIR_VIRAL',
      date: '2026-09-22',
      event_type: 'Social Spike',
      channel_group: 'all',
      affected_channel: 'all',
      tier: 'all',
      affected_cohort: 'all',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'clean',
      notes: 'Barrier-repair and nightly-reset content sends MOI_M3 into a broad mention surge across all channels.'
    },
    {
      event_id: 'AUTO_MIX_2026_HOLIDAY_VALUE_SHOCK',
      date: '2026-11-20',
      event_type: 'Competitor Price Change',
      channel_group: 'prestige',
      affected_channel: 'ulta|sephora',
      tier: 'ad_free',
      affected_cohort: 'ulta|sephora',
      price_before: 33.5,
      price_after: 30.9,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'confounded',
      notes: 'Prestige competitor launches an early holiday value event on SUN_S2, putting Sephora and Ulta pricing under pressure.'
    },
    {
      event_id: 'AUTO_MIX_2027_NEW_YEAR_RESET_PROMO',
      date: '2027-01-12',
      event_type: 'Promo Start',
      channel_group: 'prestige',
      affected_channel: 'sephora|ulta|dtc',
      tier: 'ad_free',
      affected_cohort: 'sephora|ulta|dtc',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 10,
      validation_window: 'test',
      notes: 'New-year skincare reset activation on MOI_M1 and MOI_M2 supports regimen starts in prestige and DTC.'
    },
    {
      event_id: 'AUTO_MIX_2027_Q1_SOCIAL_BURST',
      date: '2027-02-09',
      event_type: 'Social Spike',
      channel_group: 'mass',
      affected_channel: 'target|amazon|dtc',
      tier: 'ad_supported',
      affected_cohort: 'target|amazon|dtc',
      price_before: 0,
      price_after: 0,
      promo_id: '',
      promo_discount_pct: 0,
      validation_window: 'clean',
      notes: 'Short-form creator content revives SUN_S1 and MOI_M1 traffic in mass and DTC during an otherwise quiet planning period.'
    }
  ];
}

function augmentEvents(events = []) {
  const { startDate, endDate } = getTimelineWindow();
  const timelineEvents = [
    ...(Array.isArray(events) ? events : []),
    ...buildRollingTentpoleEvents(),
    ...buildRollingMixedEvents()
  ]
    .filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

  const deduped = new Map();
  timelineEvents.forEach(event => {
    const key = `${event.event_type}|${event.date}|${event.notes}`;
    if (!deduped.has(key)) {
      deduped.set(key, event);
    }
  });

  return [...deduped.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function normalizeSkuId(skuId) {
  return String(skuId || '').trim().toUpperCase();
}

function hydrateSkuCatalog(rows) {
  skuCatalog = new Map();
  (rows || []).forEach(row => {
    const skuId = normalizeSkuId(row.sku_id);
    if (!skuId || skuCatalog.has(skuId)) return;
    skuCatalog.set(skuId, {
      sku_id: skuId,
      sku_name: row.sku_name || skuId,
      product_group: row.product_group || ''
    });
  });
}

function getSkuName(skuId, fallbackName = null) {
  const normalized = normalizeSkuId(skuId);
  if (fallbackName) return String(fallbackName);
  if (skuCatalog.has(normalized)) return skuCatalog.get(normalized).sku_name;
  return normalized || '-';
}

function formatSkuDisplay(skuId, fallbackName = null, includeCode = true) {
  const normalized = normalizeSkuId(skuId);
  const skuName = getSkuName(normalized, fallbackName);
  if (!includeCode || !normalized) return skuName;
  return `${skuName} (${normalized})`;
}

function formatSeasonLabel(season) {
  return String(season || 'season_n/a').replaceAll('_', ' ');
}

function safeNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function startOfWeek(dateLike) {
  const date = new Date(dateLike);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

function extractSortedWeekKeys(rows = [], dateField = 'week_start') {
  return [...new Set(
    rows
      .map(row => String(row?.[dateField] || row?.date || '').substring(0, 10))
      .filter(Boolean)
  )].sort();
}

function resolveComparableWeekKey(targetDateLike, weekKeys = []) {
  const targetWeekDate = startOfWeek(targetDateLike);
  if (!targetWeekDate || !weekKeys.length) {
    return { weekKey: null, basis: 'No comparable week available', requestedWeekKey: null };
  }

  const requestedWeekKey = formatIsoDate(targetWeekDate);
  if (weekKeys.includes(requestedWeekKey)) {
    return {
      weekKey: requestedWeekKey,
      basis: 'Observed week',
      requestedWeekKey
    };
  }

  const targetDate = new Date(`${requestedWeekKey}T00:00:00`);
  const minKey = weekKeys[0];
  const maxKey = weekKeys[weekKeys.length - 1];
  let bestKey = weekKeys[0];
  let bestScore = Number.POSITIVE_INFINITY;

  weekKeys.forEach(key => {
    const candidate = new Date(`${key}T00:00:00`);
    if (!Number.isFinite(candidate.getTime())) return;

    const seasonalVariants = [
      new Date(targetDate.getFullYear() - 1, candidate.getMonth(), candidate.getDate()),
      new Date(targetDate.getFullYear(), candidate.getMonth(), candidate.getDate()),
      new Date(targetDate.getFullYear() + 1, candidate.getMonth(), candidate.getDate())
    ];
    const seasonalDistance = Math.min(...seasonalVariants.map(variant => Math.abs(variant - targetDate)));
    const absoluteDistance = Math.abs(candidate - targetDate);
    const score = seasonalDistance + (absoluteDistance * 0.05);

    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  const targetMs = targetDate.getTime();
  const minMs = new Date(`${minKey}T00:00:00`).getTime();
  const maxMs = new Date(`${maxKey}T00:00:00`).getTime();
  const basis = targetMs > maxMs || targetMs < minMs
    ? 'Modeled from seasonal analog week'
    : 'Nearest observed week';

  return {
    weekKey: bestKey,
    basis,
    requestedWeekKey
  };
}

function getPreviousAvailableWeekKey(weekKey, weekKeys = []) {
  const index = weekKeys.indexOf(weekKey);
  if (index > 0) return weekKeys[index - 1];
  return null;
}

function buildEventScope(event, productInfo) {
  const affectedChannels = (event?.affected_channel || event?.affected_cohort || '')
    .split('|')
    .map(channel => channel.trim().toLowerCase())
    .filter(channel => channel && channel !== 'all');
  const affectedSkuIds = new Set((productInfo?.skus || []).map(sku => normalizeSkuId(sku.sku_id)));
  const productGroupFilter = productInfo?.productGroup && productInfo.productGroup !== 'Multiple'
    ? String(productInfo.productGroup).toLowerCase()
    : null;

  return {
    affectedChannels,
    affectedSkuIds,
    productGroupFilter
  };
}

function matchesScopeRow(row, scope, options = {}) {
  const { ignoreChannels = false, ignoreProduct = false } = options;
  const channel = String(row.sales_channel || '').toLowerCase();
  const skuId = normalizeSkuId(row.sku_id);
  const productGroup = String(row.product_group || '').toLowerCase();

  const channelMatches = ignoreChannels
    || !scope.affectedChannels.length
    || scope.affectedChannels.includes(channel);
  const productMatches = ignoreProduct
    || !scope.affectedSkuIds.size
    || scope.affectedSkuIds.has(skuId)
    || (!scope.affectedSkuIds.size && !scope.productGroupFilter)
    || (scope.productGroupFilter && productGroup === scope.productGroupFilter);

  return channelMatches && productMatches;
}

function getScopedRowsForWeek(rows = [], weekKey, scope) {
  if (!weekKey) return [];
  const weekRows = rows.filter(row => String(row.week_start || row.date || '').substring(0, 10) === weekKey);
  if (!weekRows.length) return [];

  const exactRows = weekRows.filter(row => matchesScopeRow(row, scope));
  if (exactRows.length) return exactRows;

  const withoutChannel = weekRows.filter(row => matchesScopeRow(row, scope, { ignoreChannels: true }));
  if (withoutChannel.length) return withoutChannel;

  const withoutProduct = weekRows.filter(row => matchesScopeRow(row, scope, { ignoreChannels: true, ignoreProduct: true }));
  return withoutProduct.length ? withoutProduct : weekRows;
}

function summarizeScopedRows(rows = []) {
  return rows.reduce((acc, row) => {
    const units = safeNumber(row.units_sold, 0);
    const weight = units > 0 ? units : 1;
    acc.units += units;
    acc.revenue += safeNumber(row.revenue, 0);
    acc.ownPriceWeighted += safeNumber(row.own_price, 0) * weight;
    acc.competitorPriceWeighted += safeNumber(row.competitor_price, 0) * weight;
    acc.socialWeighted += safeNumber(row.social_buzz_score, 0) * weight;
    acc.promoDepthWeighted += safeNumber(row.promo_depth_pct, 0) * weight;
    return acc;
  }, {
    units: 0,
    revenue: 0,
    ownPriceWeighted: 0,
    competitorPriceWeighted: 0,
    socialWeighted: 0,
    promoDepthWeighted: 0
  });
}

function finalizeScopedSummary(summary) {
  const units = safeNumber(summary?.units, 0);
  const weight = units > 0 ? units : 1;
  return {
    units,
    revenue: safeNumber(summary?.revenue, 0),
    ownPrice: safeNumber(summary?.ownPriceWeighted, 0) / weight,
    competitorPrice: safeNumber(summary?.competitorPriceWeighted, 0) / weight,
    social: safeNumber(summary?.socialWeighted, 0) / weight,
    promoDepth: safeNumber(summary?.promoDepthWeighted, 0) / weight
  };
}

function formatSignedCurrency(value) {
  const numeric = safeNumber(value, 0);
  return `${numeric >= 0 ? '+' : '-'}${formatCurrency(Math.abs(numeric))}`;
}

function formatSignedPercentText(rate) {
  if (!Number.isFinite(rate)) return 'N/A';
  return `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(1)}%`;
}

function formatSignedPointText(delta) {
  if (!Number.isFinite(delta)) return 'N/A';
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts`;
}

function buildEventHeadline(event, promo, productInfo) {
  if (promo?.campaign_name) return promo.campaign_name;
  if (event.event_type === 'Tentpole' && event.notes) {
    const firstSentence = String(event.notes).split('.').find(Boolean);
    return firstSentence ? firstSentence.trim() : 'Seasonal Tentpole';
  }
  if (event.event_type === 'Competitor Price Change') {
    return `${productInfo.label || 'Portfolio'} Competitor Price Move`;
  }
  if (event.event_type === 'Social Spike') {
    return `${productInfo.label || 'Portfolio'} Social Buzz Spike`;
  }
  if ((event.event_type || '').includes('Promo')) {
    return `${productInfo.label || 'Portfolio'} Promotion Window`;
  }
  return event.event_type || 'Event';
}

function buildEventStatus(event, promo, eventDate) {
  if (promo) {
    if (String(promo.story_phase || '').toLowerCase() === 'future') {
      return { label: 'Planned', className: 'bg-secondary-subtle text-secondary-emphasis' };
    }
    if (promo.actual_adds || promo.actual_roi) {
      return { label: 'Complete', className: 'bg-success-subtle text-success' };
    }
    return { label: 'In Flight', className: 'bg-warning-subtle text-warning-emphasis' };
  }

  if (eventDate > CALENDAR_TODAY) {
    return { label: 'Upcoming', className: 'bg-secondary-subtle text-secondary-emphasis' };
  }
  return { label: 'Complete', className: 'bg-success-subtle text-success' };
}

function describeEventRowImpact(eventType, unitsDelta, revenueDelta, ownPriceDelta, competitorPriceDelta, socialDelta) {
  if (eventType === 'Promo Start') {
    if (revenueDelta > 0 && unitsDelta > 0) return 'Promo lift captured';
    if (revenueDelta < 0) return 'Promo underdelivered';
    return 'Promo held demand';
  }
  if (eventType === 'Competitor Price Change') {
    if (competitorPriceDelta < 0 && revenueDelta < 0) return 'Competitor undercut hurt sales';
    if (competitorPriceDelta < 0 && revenueDelta >= 0) return 'Held volume vs undercut';
    return 'Competitive pricing stable';
  }
  if (eventType === 'Social Spike') {
    if (socialDelta > 0 && revenueDelta > 0) return 'Buzz amplified demand';
    if (socialDelta > 0 && revenueDelta <= 0) return 'Buzz rose, conversion lagged';
    return 'Social pull faded';
  }
  if (eventType === 'Tentpole') {
    if (revenueDelta > 0) return 'Seasonal demand lift';
    if (revenueDelta < 0) return 'Seasonal demand did not convert';
    return 'Seasonal demand held flat';
  }
  if (revenueDelta > 0) return 'Positive event contribution';
  if (revenueDelta < 0) return 'Negative demand pressure';
  if (ownPriceDelta !== 0 || competitorPriceDelta !== 0 || socialDelta !== 0) return 'Signals moved, sales held';
  return 'Stable week';
}

/**
 * Get product/SKU info associated with an event.
 * Returns { skus: [{sku_id, sku_name, product_group}], productGroup: string, label: string }
 */
function getEventProductInfo(event) {
  const result = { skus: [], productGroup: '', label: '' };
  if (!event) return result;

  const promoId = event.promo_id;
  const promo = promoId && promoMetadata ? promoMetadata[promoId] : null;

  if (promo && Array.isArray(promo.promoted_skus) && promo.promoted_skus.length > 0) {
    result.skus = promo.promoted_skus.map(skuId => {
      const normalized = normalizeSkuId(skuId);
      const catalogEntry = skuCatalog.get(normalized);
      const skuResult = (promo.sku_results || []).find(r => normalizeSkuId(r.sku_id) === normalized);
      return {
        sku_id: normalized,
        sku_name: skuResult?.sku_name || catalogEntry?.sku_name || normalized,
        product_group: catalogEntry?.product_group || (normalized.startsWith('SUN') ? 'Sunscreen' : normalized.startsWith('MOI') ? 'Moisturizer' : '')
      };
    });
  }

  // Derive product group from SKUs or event context
  if (result.skus.length > 0) {
    const groups = [...new Set(result.skus.map(s => s.product_group).filter(Boolean))];
    result.productGroup = groups.length === 1 ? groups[0] : groups.length > 1 ? 'Multiple' : '';
  }

  // For competitor price changes, resolve specific SKUs from competitor feed
  if (!result.skus.length && event.event_type === 'Competitor Price Change') {
    const eventDate = event.date || '';
    const eventWeek = eventDate.substring(0, 10);
    const affectedChannels = (event.affected_channel || event.affected_cohort || '')
      .split('|').map(c => c.trim().toLowerCase()).filter(Boolean);

    // Find competitor feed entries for this week+channel with promo_flag=true
    const feedMatches = (competitorFeed || []).filter(f => {
      const feedDate = (f.captured_at || '').substring(0, 10);
      const feedChannel = String(f.channel || '').toLowerCase();
      const isPromo = f.promo_flag === true || f.promo_flag === 'True' || f.promo_flag === 'true';
      return feedDate === eventWeek && (affectedChannels.length === 0 || affectedChannels.includes(feedChannel)) && isPromo;
    });

    if (feedMatches.length > 0) {
      const seenSkus = new Set();
      feedMatches.forEach(f => {
        const skuId = normalizeSkuId(f.matched_sku_id);
        if (!skuId || seenSkus.has(skuId)) return;
        seenSkus.add(skuId);
        const catalogEntry = skuCatalog.get(skuId);
        result.skus.push({
          sku_id: skuId,
          sku_name: catalogEntry?.sku_name || skuId,
          product_group: catalogEntry?.product_group || (skuId.startsWith('SUN') ? 'Sunscreen' : skuId.startsWith('MOI') ? 'Moisturizer' : '')
        });
      });
    }

    // Fallback: infer from notes if no feed matches
    if (!result.skus.length) {
      const notes = (event.notes || '').toLowerCase();
      // Extract SKU IDs mentioned in notes (e.g. SUN_S3, MOI_M2)
      const skuPattern = /\b(SUN_S[1-3]|MOI_M[1-3])\b/gi;
      const noteMatches = (event.notes || '').match(skuPattern) || [];
      if (noteMatches.length > 0) {
        const seenSkus = new Set();
        noteMatches.forEach(m => {
          const skuId = normalizeSkuId(m);
          if (seenSkus.has(skuId)) return;
          seenSkus.add(skuId);
          const catalogEntry = skuCatalog.get(skuId);
          result.skus.push({
            sku_id: skuId,
            sku_name: catalogEntry?.sku_name || skuId,
            product_group: catalogEntry?.product_group || (skuId.startsWith('SUN') ? 'Sunscreen' : skuId.startsWith('MOI') ? 'Moisturizer' : '')
          });
        });
      } else if (notes.includes('spf') || notes.includes('sun')) {
        result.productGroup = 'Sunscreen';
      } else if (notes.includes('moistur') || notes.includes('hydra')) {
        result.productGroup = 'Moisturizer';
      } else if (event.tier === 'ad_supported' || notes.includes('mass')) {
        result.productGroup = 'Sunscreen';
      }
    }
  }

  // For non-competitor events without promo link, try extracting SKU IDs from notes
  if (!result.skus.length && event.event_type !== 'Competitor Price Change') {
    const skuPattern = /\b(SUN_S[1-3]|MOI_M[1-3])\b/gi;
    const noteMatches = (event.notes || '').match(skuPattern) || [];
    if (noteMatches.length > 0) {
      const seenSkus = new Set();
      noteMatches.forEach(m => {
        const skuId = normalizeSkuId(m);
        if (seenSkus.has(skuId)) return;
        seenSkus.add(skuId);
        const catalogEntry = skuCatalog.get(skuId);
        result.skus.push({
          sku_id: skuId,
          sku_name: catalogEntry?.sku_name || skuId,
          product_group: catalogEntry?.product_group || (skuId.startsWith('SUN') ? 'Sunscreen' : skuId.startsWith('MOI') ? 'Moisturizer' : '')
        });
      });
    }
  }

  // Build display label
  if (result.skus.length > 0) {
    result.label = result.skus.map(s => s.sku_name).join(', ');
  } else if (result.productGroup) {
    result.label = result.productGroup;
  }

  return result;
}

/**
 * Check if an event matches the active product filter.
 */
function eventMatchesProductFilter(event) {
  if (activeProductFilter === 'all') return true;
  const info = getEventProductInfo(event);

  // Filter by product group name
  if (activeProductFilter === 'Sunscreen' || activeProductFilter === 'Moisturizer') {
    if (info.productGroup === activeProductFilter) return true;
    return info.skus.some(s => s.product_group === activeProductFilter);
  }

  // Filter by specific SKU id (e.g. "SUN_S1")
  if (info.skus.some(s => s.sku_id === normalizeSkuId(activeProductFilter))) return true;

  return false;
}

/**
 * Build all unique product filter options from promo metadata and events.
 */
function buildProductFilterOptions() {
  const options = [];
  const seenGroups = new Set();
  const seenSkus = new Set();

  // Gather from promo metadata
  if (promoMetadata) {
    Object.values(promoMetadata).forEach(promo => {
      (promo.sku_results || []).forEach(skuResult => {
        const skuId = normalizeSkuId(skuResult.sku_id);
        const group = skuId.startsWith('SUN') ? 'Sunscreen' : skuId.startsWith('MOI') ? 'Moisturizer' : '';
        if (group && !seenGroups.has(group)) {
          seenGroups.add(group);
        }
        if (skuId && !seenSkus.has(skuId)) {
          seenSkus.add(skuId);
          options.push({
            value: skuId,
            label: `${skuId} - ${skuResult.sku_name || skuId}`,
            group: group
          });
        }
      });
    });
  }

  // Sort: groups first, then SKUs alphabetically
  const result = [];
  ['Sunscreen', 'Moisturizer'].forEach(g => {
    if (seenGroups.has(g)) {
      result.push({ value: g, label: g, isGroup: true });
    }
  });
  options.sort((a, b) => a.value.localeCompare(b.value));
  result.push(...options);
  return result;
}

/**
 * Initialize event calendar section
 */
export async function initializeEventCalendar() {
  console.log('Initializing Event Calendar...');

  try {
    // Load all data
    let skuWeeklyData = [];
    [allEvents, promoMetadata, validationWindows, skuWeeklyData, competitorFeed, productHistoryRows] = await Promise.all([
      loadEventCalendar(),
      loadPromoMetadata(),
      loadValidationWindows(),
      loadSkuWeeklyData(),
      loadCompetitorPriceFeed(),
      loadProductChannelHistory()
    ]);
    allEvents = augmentEvents(allEvents);
    hydrateSkuCatalog(skuWeeklyData || []);

    // Update event count badge
    updateEventCountBadge();

    // Render all components
    renderMarketSignalsDashboard();
    renderEventTimeline();
    renderValidationWindows();

    // Setup event listeners
    setupEventFilters();
    initializeProductFilter();

    console.log('Event Calendar initialized successfully');
  } catch (error) {
    console.error('Error initializing event calendar:', error);
    document.getElementById('event-timeline').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Error loading event calendar data: ${error.message}
      </div>
    `;
  }
}

function initializePromoControls() {
  const seasonSelect = document.getElementById('promo-season-filter');
  const channelSelect = document.getElementById('promo-channel-filter');
  const resetBtn = document.getElementById('promo-clear-filters');

  if (!seasonSelect || !channelSelect || !resetBtn) return;

  const promos = promoMetadata ? Object.values(promoMetadata) : [];
  const seasons = [...new Set(promos.map(p => p.season).filter(Boolean))].sort();

  seasonSelect.innerHTML = '<option value="all" selected>All Seasons</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season;
    option.textContent = formatSeasonLabel(season);
    seasonSelect.appendChild(option);
  });

  channelSelect.innerHTML = '<option value="all" selected>All Channels</option>';
  RETAIL_CHANNELS.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel;
    option.textContent = CHANNEL_LABELS[channel] || channel;
    channelSelect.appendChild(option);
  });

  seasonSelect.value = activePromoFilters.season;
  channelSelect.value = activePromoFilters.channel;

  seasonSelect.addEventListener('change', (event) => {
    activePromoFilters.season = event.target.value || 'all';
    renderPromoCards();
  });

  channelSelect.addEventListener('change', (event) => {
    activePromoFilters.channel = event.target.value || 'all';
    renderPromoCards();
  });

  resetBtn.addEventListener('click', () => {
    activePromoFilters.season = 'all';
    activePromoFilters.channel = 'all';
    seasonSelect.value = 'all';
    channelSelect.value = 'all';
    renderPromoCards();
  });
}

function getFilteredPromos() {
  const promos = promoMetadata ? Object.values(promoMetadata) : [];
  return promos
    .filter(promo => {
      if (activePromoFilters.season !== 'all' && promo.season !== activePromoFilters.season) {
        return false;
      }
      if (activePromoFilters.channel !== 'all') {
        const channels = (promo.eligible_channels || []).map(c => String(c).toLowerCase());
        if (!channels.includes(activePromoFilters.channel)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
}

function renderPromoMethodology() {
  const container = document.getElementById('promo-data-methodology');
  if (!container) return;

  const promos = promoMetadata ? Object.values(promoMetadata) : [];
  const skuRows = promos.flatMap(promo => Array.isArray(promo.sku_results) ? promo.sku_results : []);
  const avgSkuUplift = skuRows.length
    ? skuRows.reduce((sum, row) => sum + Number(row.sales_uplift_pct || 0), 0) / skuRows.length
    : 0;
  const competitorEvents = (allEvents || []).filter(e => e.event_type === 'Competitor Price Change').length;
  const socialEvents = (allEvents || []).filter(e => e.event_type === 'Social Spike').length;
  const promoEvents = (allEvents || []).filter(e => (e.event_type || '').includes('Promo')).length;
  const feedRows = Array.isArray(competitorFeed) ? competitorFeed : [];
  const sourceDomains = [...new Set(feedRows.map(row => row.source_domain).filter(Boolean))];
  const avgMatchConfidence = feedRows.length
    ? feedRows.reduce((sum, row) => sum + Number(row.match_confidence || 0), 0) / feedRows.length
    : 0;

  container.innerHTML = `
    <div><strong>How this is built:</strong> Event stream from <code>retail_events.csv</code>, campaign outcomes from <code>promo_metadata.json</code>, SKU names + inventory from <code>sku_channel_weekly.csv</code>, market context from <code>market_signals.csv</code>, and social context from <code>social_signals.csv</code>.</div>
    <div class="mt-1"><strong>Competitor pricing source:</strong> <code>competitor_price_feed.csv</code> simulates website-scraped prices from ${sourceDomains.join(', ') || 'retail websites'} and SKU-matching confidence (avg ${avgMatchConfidence.toFixed(3)}).</div>
    <div class="mt-1"><strong>How this is analyzed:</strong> We classify event type, map each campaign to promoted products and channels, compute product-channel uplift from <code>sku_results</code>, and extract include/exclude policy signals for the next cycle.</div>
    <div class="mt-1 text-muted">Coverage: ${promos.length} campaigns, ${promoEvents} promo events, ${competitorEvents} competitor-price events, ${socialEvents} social spikes, ${feedRows.length} scraped competitor rows; average SKU uplift ${avgSkuUplift >= 0 ? '+' : ''}${avgSkuUplift.toFixed(1)}%.</div>
  `;
}

/**
 * Update event count badge
 */
function updateEventCountBadge() {
  const badge = document.getElementById('event-count-badge');
  if (badge) {
    const events = Array.isArray(allEvents) ? allEvents : [];
    const counts = {
      competitorPriceChange: events.filter(e => e.event_type === 'Competitor Price Change').length,
      promo: events.filter(e => (e.event_type || '').includes('Promo') || e.event_type === 'Social Spike').length,
      tentpole: events.filter(e => e.event_type === 'Tentpole').length
    };
    badge.textContent = `${events.length} Events (${counts.competitorPriceChange} Competitor Moves, ${counts.promo} Promos & Social, ${counts.tentpole} Tentpoles)`;
  }
}

/**
 * Render Market Signals & Listening dashboard (competitive + social)
 * Uses direct weekly data only: market_signals.csv, social_signals.csv, sku_channel_weekly.csv.
 */
async function renderMarketSignalsDashboard() {
  const compContainer = document.getElementById('market-signals-competitive');
  const socialContainer = document.getElementById('market-signals-social');
  const compCanvas = document.getElementById('event-competitive-signals-chart');
  const socialCanvas = document.getElementById('event-social-signals-chart');
  if (!compContainer || !socialContainer || !compCanvas || !socialCanvas) return;

  try {
    const [externalFactors, socialSignals, skuWeekly] = await Promise.all([
      loadExternalFactors(),
      loadSocialSignals(),
      loadSkuWeeklyData()
    ]);

    if (!externalFactors || !externalFactors.length || !socialSignals || !socialSignals.length || !skuWeekly || !skuWeekly.length) {
      compContainer.textContent = 'Market signals not available.';
      socialContainer.textContent = 'Social listening data not available.';
      return;
    }

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const socialModifier = (scoreRaw) => {
      const score = toNum(scoreRaw);
      if (!Number.isFinite(score)) return 1;
      const normalized = score <= 1.5 && score >= -1.5 ? score * 100 : score;
      const clipped = clamp(normalized, 35, 95);
      return clamp(1.18 - ((clipped - 35) * 0.0075), 0.72, 1.26);
    };
    const normalizeSocialScore = (scoreRaw) => {
      const score = toNum(scoreRaw);
      if (!Number.isFinite(score)) return null;
      return score <= 1.5 && score >= -1.5 ? score * 100 : score;
    };

    const ourPriceByWeek = new Map();
    skuWeekly.forEach(row => {
      const week = row.date;
      if (!week) return;
      if (!ourPriceByWeek.has(week)) {
        ourPriceByWeek.set(week, {
          massSum: 0,
          massCount: 0,
          prestigeSum: 0,
          prestigeCount: 0
        });
      }
      const bucket = ourPriceByWeek.get(week);
      const price = toNum(row.effective_price);
      if (!Number.isFinite(price)) return;
      if (row.channel_group === 'mass') {
        bucket.massSum += price;
        bucket.massCount += 1;
      } else if (row.channel_group === 'prestige') {
        bucket.prestigeSum += price;
        bucket.prestigeCount += 1;
      }
    });

    const externalByWeek = new Map(externalFactors.map(row => [row.date, row]));
    const weekLabels = [...new Set([
      ...externalFactors.map(r => r.date),
      ...socialSignals.map(r => r.week_start || r.date)
    ])].sort();

    const compLabels = [];
    const ourMassSeries = [];
    const compMassSeries = [];
    const ourPrestigeSeries = [];
    const compPrestigeSeries = [];

    weekLabels.forEach(week => {
      const own = ourPriceByWeek.get(week);
      const ext = externalByWeek.get(week);
      if (!own || !ext) return;
      const ownMass = own.massCount > 0 ? own.massSum / own.massCount : null;
      const ownPrestige = own.prestigeCount > 0 ? own.prestigeSum / own.prestigeCount : null;
      const compMass = toNum(ext.competitor_mass_price);
      const compPrestige = toNum(ext.competitor_prestige_price);
      if (!Number.isFinite(ownMass) || !Number.isFinite(ownPrestige) || !Number.isFinite(compMass) || !Number.isFinite(compPrestige)) return;

      compLabels.push(week.slice(5));
      ourMassSeries.push(Number(ownMass.toFixed(2)));
      compMassSeries.push(Number(compMass.toFixed(2)));
      ourPrestigeSeries.push(Number(ownPrestige.toFixed(2)));
      compPrestigeSeries.push(Number(compPrestige.toFixed(2)));
    });

    if (compLabels.length) {
      if (eventCompetitiveSignalsChart) {
        eventCompetitiveSignalsChart.data.labels = compLabels;
        eventCompetitiveSignalsChart.data.datasets[0].data = ourMassSeries;
        eventCompetitiveSignalsChart.data.datasets[1].data = compMassSeries;
        eventCompetitiveSignalsChart.data.datasets[2].data = ourPrestigeSeries;
        eventCompetitiveSignalsChart.data.datasets[3].data = compPrestigeSeries;
        eventCompetitiveSignalsChart.update();
      } else if (window.Chart) {
        const compIsDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const compGridColor = compIsDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.07)';
        const compTextColor = compIsDark ? 'rgba(226,232,240,0.7)' : '#64748b';
        eventCompetitiveSignalsChart = new Chart(compCanvas, {
          type: 'line',
          data: {
            labels: compLabels,
            datasets: [
              { label: 'Supergoop Mass Avg', data: ourMassSeries, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3b82f6', pointHoverRadius: 5 },
              { label: 'Competitor Mass', data: compMassSeries, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', tension: 0.3, fill: true, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#ef4444', pointHoverRadius: 4, borderDash: [5, 3] },
              { label: 'Supergoop Prestige Avg', data: ourPrestigeSeries, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#10b981', pointHoverRadius: 5 },
              { label: 'Competitor Prestige', data: compPrestigeSeries, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)', tension: 0.3, fill: true, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#f59e0b', pointHoverRadius: 4, borderDash: [5, 3] }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: compTextColor, font: { size: 11, weight: '500' }, boxWidth: 14, padding: 16, usePointStyle: true, pointStyle: 'circle' }
              },
              tooltip: {
                backgroundColor: compIsDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)',
                titleColor: compIsDark ? '#e2e8f0' : '#1e293b',
                bodyColor: compIsDark ? '#94a3b8' : '#64748b',
                borderColor: compIsDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                  label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`
                }
              }
            },
            scales: {
              x: {
                grid: { color: compGridColor, drawBorder: false },
                ticks: { color: compTextColor, font: { size: 10 }, maxRotation: 0 }
              },
              y: {
                grid: { color: compGridColor, drawBorder: false },
                ticks: { color: compTextColor, font: { size: 10 }, callback: v => `$${v}` },
                title: { display: true, text: 'Avg Price ($)', color: compTextColor, font: { size: 11, weight: '600' } }
              }
            }
          }
        });
      }

      const latestCompIdx = ourMassSeries.length - 1;
      const prevCompIdx = Math.max(latestCompIdx - 1, 0);
      const massDeltaPct = compMassSeries[latestCompIdx] > 0
        ? ((ourMassSeries[latestCompIdx] - compMassSeries[latestCompIdx]) / compMassSeries[latestCompIdx]) * 100
        : 0;
      const prestigeDeltaPct = compPrestigeSeries[latestCompIdx] > 0
        ? ((ourPrestigeSeries[latestCompIdx] - compPrestigeSeries[latestCompIdx]) / compPrestigeSeries[latestCompIdx]) * 100
        : 0;
      const massCompWoW = compMassSeries[latestCompIdx] - compMassSeries[prevCompIdx];
      const prestigeCompWoW = compPrestigeSeries[latestCompIdx] - compPrestigeSeries[prevCompIdx];

      const massDeltaClass = massDeltaPct <= -1 ? 'text-success' : massDeltaPct >= 1 ? 'text-danger' : 'text-warning';
      const prestigeDeltaClass = prestigeDeltaPct <= -1 ? 'text-success' : prestigeDeltaPct >= 1 ? 'text-danger' : 'text-warning';
      const massAvgGap = ourMassSeries.length ? (ourMassSeries.reduce((s, v) => s + v, 0) / ourMassSeries.length - compMassSeries.reduce((s, v) => s + v, 0) / compMassSeries.length).toFixed(2) : '0';
      const prestigeAvgGap = ourPrestigeSeries.length ? (ourPrestigeSeries.reduce((s, v) => s + v, 0) / ourPrestigeSeries.length - compPrestigeSeries.reduce((s, v) => s + v, 0) / compPrestigeSeries.length).toFixed(2) : '0';
      compContainer.innerHTML = `
        <div class="d-flex flex-wrap gap-3 mt-2">
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Mass Price Gap</div>
            <div class="ec-signal-card-value ${massDeltaClass}">${massDeltaPct >= 0 ? '+' : ''}${massDeltaPct.toFixed(1)}%</div>
            <div class="ec-signal-card-sub">$${ourMassSeries[latestCompIdx]?.toFixed(2)} vs $${compMassSeries[latestCompIdx]?.toFixed(2)}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Prestige Price Gap</div>
            <div class="ec-signal-card-value ${prestigeDeltaClass}">${prestigeDeltaPct >= 0 ? '+' : ''}${prestigeDeltaPct.toFixed(1)}%</div>
            <div class="ec-signal-card-sub">$${ourPrestigeSeries[latestCompIdx]?.toFixed(2)} vs $${compPrestigeSeries[latestCompIdx]?.toFixed(2)}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Competitor WoW Move</div>
            <div class="ec-signal-card-value">Mass ${massCompWoW >= 0 ? '+' : ''}$${massCompWoW.toFixed(2)}</div>
            <div class="ec-signal-card-sub">Prestige ${prestigeCompWoW >= 0 ? '+' : ''}$${prestigeCompWoW.toFixed(2)}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Avg Season Gap</div>
            <div class="ec-signal-card-value">Mass $${massAvgGap}</div>
            <div class="ec-signal-card-sub">Prestige $${prestigeAvgGap}</div>
          </div>
        </div>
      `;
    } else {
      compContainer.textContent = 'Insufficient competitive price history for chart rendering.';
    }

    const socialByWeek = new Map(socialSignals.map(row => [row.week_start || row.date, row]));
    const socialLabels = [];
    const socialScoreSeries = [];
    const socialElasticitySeries = [];

    weekLabels.forEach(week => {
      const row = socialByWeek.get(week);
      if (!row) return;
      const score = normalizeSocialScore(row.brand_social_index ?? row.social_sentiment);
      if (!Number.isFinite(score)) return;
      socialLabels.push(week.slice(5));
      socialScoreSeries.push(Number(score.toFixed(2)));
      socialElasticitySeries.push(Number(socialModifier(score).toFixed(3)));
    });

    if (socialLabels.length) {
      if (eventSocialSignalsChart) {
        eventSocialSignalsChart.data.labels = socialLabels;
        eventSocialSignalsChart.data.datasets[0].data = socialScoreSeries;
        eventSocialSignalsChart.data.datasets[1].data = socialElasticitySeries;
        eventSocialSignalsChart.update();
      } else if (window.Chart) {
        const socIsDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const socGridColor = socIsDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.07)';
        const socTextColor = socIsDark ? 'rgba(226,232,240,0.7)' : '#64748b';
        eventSocialSignalsChart = new Chart(socialCanvas, {
          type: 'line',
          data: {
            labels: socialLabels,
            datasets: [
              {
                label: 'Brand Social Index',
                data: socialScoreSeries,
                borderColor: '#0ea5e9',
                backgroundColor: socIsDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)',
                fill: true,
                tension: 0.35,
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: '#0ea5e9',
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#0ea5e9',
                yAxisID: 'y'
              },
              {
                label: 'Elasticity Modifier',
                data: socialElasticitySeries,
                borderColor: '#8b5cf6',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 2.5,
                pointBackgroundColor: '#8b5cf6',
                pointHoverRadius: 5,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: socTextColor, font: { size: 11, weight: '500' }, boxWidth: 14, padding: 16, usePointStyle: true, pointStyle: 'circle' }
              },
              tooltip: {
                backgroundColor: socIsDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)',
                titleColor: socIsDark ? '#e2e8f0' : '#1e293b',
                bodyColor: socIsDark ? '#94a3b8' : '#64748b',
                borderColor: socIsDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                  label: ctx => ctx.datasetIndex === 0
                    ? `Social Index: ${ctx.parsed.y.toFixed(1)}`
                    : `Elasticity Mod: ${ctx.parsed.y.toFixed(3)}x`
                }
              }
            },
            scales: {
              x: {
                grid: { color: socGridColor, drawBorder: false },
                ticks: { color: socTextColor, font: { size: 10 }, maxRotation: 0 }
              },
              y: {
                grid: { color: socGridColor, drawBorder: false },
                ticks: { color: socTextColor, font: { size: 10 } },
                title: { display: true, text: 'Brand Social Index', color: '#0ea5e9', font: { size: 11, weight: '600' } }
              },
              y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: socTextColor, font: { size: 10 }, callback: v => `${v}x` },
                title: { display: true, text: 'Elasticity Modifier', color: '#8b5cf6', font: { size: 11, weight: '600' } }
              }
            }
          }
        });
      }

      const latestSocialIdx = socialScoreSeries.length - 1;
      const prevSocialIdx = Math.max(latestSocialIdx - 1, 0);
      const socialScoreWoW = socialScoreSeries[latestSocialIdx] - socialScoreSeries[prevSocialIdx];
      const elasticityWoW = socialElasticitySeries[latestSocialIdx] - socialElasticitySeries[prevSocialIdx];
      const latestRow = socialByWeek.get(weekLabels[weekLabels.length - 1]) || {};
      const totalMentions = toNum(latestRow.total_social_mentions) || 0;
      const tiktokMentions = toNum(latestRow.tiktok_mentions) || 0;
      const instagramMentions = toNum(latestRow.instagram_mentions) || 0;

      const socScoreClass = socialScoreWoW >= 2 ? 'text-success' : socialScoreWoW <= -2 ? 'text-danger' : '';
      const elastModClass = elasticityWoW < -0.01 ? 'text-success' : elasticityWoW > 0.01 ? 'text-danger' : '';
      const tiktokPct = totalMentions > 0 ? ((tiktokMentions / totalMentions) * 100).toFixed(0) : '0';
      const instaPct = totalMentions > 0 ? ((instagramMentions / totalMentions) * 100).toFixed(0) : '0';
      const peakScore = Math.max(...socialScoreSeries);
      const troughScore = Math.min(...socialScoreSeries);
      socialContainer.innerHTML = `
        <div class="d-flex flex-wrap gap-3 mt-2">
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Social Index</div>
            <div class="ec-signal-card-value ${socScoreClass}">${socialScoreSeries[latestSocialIdx]?.toFixed(1) || 'N/A'}</div>
            <div class="ec-signal-card-sub">${socialScoreWoW >= 0 ? '+' : ''}${socialScoreWoW.toFixed(1)} WoW</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Elasticity Modifier</div>
            <div class="ec-signal-card-value ${elastModClass}">${socialElasticitySeries[latestSocialIdx]?.toFixed(3) || 'N/A'}x</div>
            <div class="ec-signal-card-sub">${elasticityWoW >= 0 ? '+' : ''}${elasticityWoW.toFixed(3)} WoW</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Total Mentions</div>
            <div class="ec-signal-card-value">${formatNumber(totalMentions)}</div>
            <div class="ec-signal-card-sub">TikTok ${tiktokPct}% · Insta ${instaPct}%</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Season Range</div>
            <div class="ec-signal-card-value">${troughScore.toFixed(0)}-${peakScore.toFixed(0)}</div>
            <div class="ec-signal-card-sub">Peak ${peakScore.toFixed(1)} · Low ${troughScore.toFixed(1)}</div>
          </div>
        </div>
      `;
    } else {
      socialContainer.textContent = 'Insufficient social history for chart rendering.';
    }
  } catch (error) {
    console.error('Error rendering Market Signals dashboard:', error);
    compContainer.textContent = 'Error loading market signals.';
    socialContainer.textContent = 'Error loading social listening data.';
  }
}

/**
 * Render event timeline visualization
 */
function renderEventTimeline() {
  const container = document.getElementById('event-timeline');
  if (!container) return;

  // Filter events based on active filters
  const { startDate, endDate } = getTimelineWindow();
  const filteredEvents = filterEvents().filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  if (!filteredEvents || filteredEvents.length === 0) {
    container.innerHTML = '<div class="text-center text-muted">No events match the current filters</div>';
    return;
  }

  const totalDays = Math.max(1, Math.floor((endDate - startDate) / DAY_MS));
  const todayPosition = Math.max(0, Math.min(100, ((CALENDAR_TODAY - startDate) / DAY_MS / totalDays) * 100));
  const monthMarkers = buildTimelineMonthMarkers(startDate, endDate);

  // Build timeline slider HTML
  let html = '<div class="timeline-slider-container">';

  // Legend
  html += `
    <div class="d-flex justify-content-center gap-4 mb-3">
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);"></div>
        <span class="ms-2 small">Competitor Price Changes</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--dplus-blue); box-shadow: 0 0 0 4px rgba(0, 102, 255, 0.2);"></div>
        <span class="ms-2 small">Promos</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);"></div>
        <span class="ms-2 small">Social Spikes</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--dplus-orange); box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);"></div>
        <span class="ms-2 small">Seasonal Tentpoles</span>
      </div>
    </div>
    <div class="d-flex justify-content-between align-items-center small text-muted mb-3">
      <span><i class="bi bi-clock-history me-1"></i>History: last 12 months</span>
      <span class="fw-semibold text-body">Today: ${CALENDAR_TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span><i class="bi bi-calendar2-week me-1"></i>Future: next 12 months</span>
    </div>
    <p class="text-center text-muted small mb-3"><i class="bi bi-info-circle me-1"></i>Click any event marker to inspect units, revenue impact, and underlying signal changes</p>
  `;

  // Year markers
  html += '<div class="timeline-years">';
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const yearSpan = Math.max(1, endYear - startYear);
  for (let i = 0; i <= yearSpan; i++) {
    const year = startYear + i;
    const position = (i / yearSpan) * 100;
    html += `<div class=\"timeline-year-marker\" style=\"left: ${position}%;\">${year}</div>`;
  }
  html += '</div>';

  html += '<div class="timeline-months">';
  monthMarkers.forEach(marker => {
    html += `<div class="timeline-month-marker${marker.isMajor ? ' is-major' : ''}" style="left: ${marker.position}%;" title="${marker.fullLabel}">${marker.label}</div>`;
  });
  html += '</div>';

  // Timeline track
  html += '<div class="timeline-track">';
  monthMarkers.forEach(marker => {
    html += `<div class="timeline-month-guide${marker.isMajor ? ' is-major' : ''}" style="left: ${marker.position}%;" title="${marker.fullLabel}"></div>`;
  });
  html += `
    <div class="timeline-today-line" style="left: ${todayPosition}%;">
      <span class="timeline-today-label">Today</span>
    </div>
  `;

  const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const daysSinceStart = Math.floor((eventDate - startDate) / (1000 * 60 * 60 * 24));
    const positionPercent = (daysSinceStart / totalDays) * 100;

    // Determine event class based on type
    let eventClass = 'timeline-event';
    if (event.event_type === 'Price Change') {
      eventClass += ' event-price';
    } else if (event.event_type === 'Competitor Price Change') {
      eventClass += ' event-competitor';
    } else if (event.event_type === 'Social Spike') {
      eventClass += ' event-social';
    } else if (event.event_type.includes('Promo')) {
      eventClass += ' event-promo';
    } else if (event.event_type === 'Tentpole') {
      eventClass += ' event-content';
    }

    const productInfo = getEventProductInfo(event);
    const productTooltip = productInfo.label ? ` | Products: ${productInfo.label}` : '';

    html += `
      <div class="${eventClass}"
           style="left: ${positionPercent}%;"
           data-event-id="${event.event_id}"
           title="${event.event_type} - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${productTooltip}">
      </div>
    `;
  });

  html += '</div>'; // Close timeline-track

  // Selected event details panel
  html += '<div class="timeline-details mt-4" id="timeline-details" style="display: none;"></div>';

  html += '</div>'; // Close timeline-slider-container

  container.innerHTML = html;

  // Add click event listeners to show event details
  const eventMarkers = container.querySelectorAll('.timeline-event');
  eventMarkers.forEach(marker => {
    marker.addEventListener('click', () => {
      eventMarkers.forEach(node => node.classList.remove('is-selected'));
      marker.classList.add('is-selected');
      const eventId = marker.dataset.eventId;
      const event = filteredEvents.find(e => e.event_id === eventId);
      if (event) {
        showEventDetails(event);
      }
    });
  });
}

function buildEventPromoContext(event) {
  if (!event || !event.promo_id) return '';
  const promo = promoMetadata ? promoMetadata[event.promo_id] : null;
  if (!promo) return '';

  const phaseLabel = STORY_PHASE_LABELS[promo.story_phase] || 'Campaign';
  const promotedSkus = Array.isArray(promo.promoted_skus) ? promo.promoted_skus : [];
  const promotedProducts = promotedSkus.length
    ? promotedSkus.map(skuId => formatSkuDisplay(skuId, null, false)).join(', ')
    : 'Not specified';
  const channels = Array.isArray(promo.eligible_channels)
    ? promo.eligible_channels.map(channel => CHANNEL_LABELS[channel] || channel).join(', ')
    : 'Not specified';

  return `
    <div class="alert alert-light border mt-2 mb-0 small">
      <div><strong>Campaign Context:</strong> ${promo.campaign_name} (${phaseLabel})</div>
      <div><strong>Promoted Products:</strong> ${promotedProducts}</div>
      <div><strong>Channels:</strong> ${channels}</div>
      ${promo.story_summary ? `<div class="text-muted mt-1">${promo.story_summary}</div>` : ''}
    </div>
  `;
}

/**
 * Show detailed information for a selected event
 * @param {object} event - Event object
 */
async function showEventDetailsLegacy(event) {
  const detailsPanel = document.getElementById('timeline-details');
  if (!detailsPanel) return;

  const eventDate = new Date(event.date);
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const badge = getEventBadge(event.event_type);
  const productInfo = getEventProductInfo(event);
  const historyRows = productHistoryRows?.length ? productHistoryRows : await loadProductChannelHistory();
  const historyWeekKeys = extractSortedWeekKeys(historyRows, 'week_start');
  const resolvedWeek = resolveComparableWeekKey(eventDate, historyWeekKeys);
  const previousWeekKey = getPreviousAvailableWeekKey(resolvedWeek.weekKey, historyWeekKeys);
  const scope = buildEventScope(event, productInfo);
  const eventRows = getScopedRowsForWeek(historyRows, resolvedWeek.weekKey, scope);
  const previousRows = getScopedRowsForWeek(historyRows, previousWeekKey, scope);
  const currentSummary = finalizeScopedSummary(summarizeScopedRows(eventRows));
  const previousSummary = finalizeScopedSummary(summarizeScopedRows(previousRows));
  const pctChange = (current, previous) => (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0)
    ? ((current - previous) / previous)
    : null;
  const baselineSalesUnits = previousSummary.units;
  const eventSalesUnits = currentSummary.units;
  const baselineRevenue = previousSummary.revenue;
  const eventRevenue = currentSummary.revenue;
  const avgOwnPrice = currentSummary.ownPrice;
  const avgPrevOwnPrice = previousSummary.ownPrice;
  const avgCompetitorPrice = currentSummary.competitorPrice;
  const avgPrevCompetitorPrice = previousSummary.competitorPrice;
  const avgSocialScore = currentSummary.social;
  const avgPrevSocialScore = previousSummary.social;
  const ownPriceChangePct = pctChange(avgOwnPrice, avgPrevOwnPrice);
  const competitorPriceChangePct = pctChange(avgCompetitorPrice, avgPrevCompetitorPrice);
  const socialBuzzChangePct = pctChange(avgSocialScore, avgPrevSocialScore);
  const incrementalSalesUnits = eventSalesUnits - baselineSalesUnits;
  const revenueDelta = eventRevenue - baselineRevenue;

  // Build per-product impact section from promo metadata sku_results
  let perProductImpactHtml = '';
  const promoId = event.promo_id;
  const promo = promoId && promoMetadata ? promoMetadata[promoId] : null;
  const isPlannedPromo = String(promo?.story_phase || '').toLowerCase() === 'future';
  const discountPct = safeNumber(promo?.discount_pct ?? event.promo_discount_pct, 0);
  const unitsLabelValue = safeNumber(promo?.actual_adds, eventSalesUnits);
  const roiValue = safeNumber(promo?.actual_roi, null);
  const incrementalRevenue = safeNumber(promo?.incremental_revenue_usd, revenueDelta);
  const summaryChannels = scope.affectedChannels.length
    ? scope.affectedChannels.map(channel => CHANNEL_LABELS[channel] || channel).join(', ')
    : 'All channels in scope';
  const summaryProducts = productInfo.label || 'Portfolio-wide';
  const headline = buildEventHeadline(event, promo, productInfo);
  const statusMeta = buildEventStatus(event, promo, eventDate);
  const phaseLabel = promo ? (STORY_PHASE_LABELS[promo.story_phase] || 'Campaign') : null;
  const discountLabel = Number.isFinite(discountPct) && discountPct > 0 ? `${discountPct.toFixed(1)}%` : 'No explicit discount';
  const basisText = resolvedWeek.weekKey
    ? `${resolvedWeek.basis}: week of ${new Date(`${resolvedWeek.weekKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'No weekly analog available';
  const eventStoryHtml = `
    <div class="alert alert-light border mb-3">
      <div class="fw-semibold mb-1">What happened during this event</div>
      <div class="small">
        ${summaryProducts} across ${summaryChannels.toLowerCase()} moved from a baseline of ${formatNumber(Math.round(baselineSalesUnits))} units and ${formatCurrency(baselineRevenue)}
        to ${formatNumber(Math.round(eventSalesUnits))} units and ${formatCurrency(eventRevenue)} in the event week.
        The three key levers moved as follows: your price ${formatSignedPercentText(ownPriceChangePct)}, competitor price ${formatSignedPercentText(competitorPriceChangePct)},
        and social media buzz ${formatSignedPercentText(socialBuzzChangePct)}. Net revenue impact was ${formatSignedCurrency(revenueDelta)}.
      </div>
      <div class="small text-muted mt-2">${basisText}</div>
    </div>
  `;
  const summaryMetricCardsHtml = `
    <div class="row g-3 mb-3">
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">My Price Change</div>
          <div class="fw-semibold fs-5">${formatSignedPercentText(ownPriceChangePct)}</div>
          <div class="small text-muted">${Number.isFinite(avgPrevOwnPrice) ? `${formatCurrency(avgPrevOwnPrice)} -> ${formatCurrency(avgOwnPrice)}` : 'No prior benchmark'}</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Competitor Price Change</div>
          <div class="fw-semibold fs-5">${formatSignedPercentText(competitorPriceChangePct)}</div>
          <div class="small text-muted">${Number.isFinite(avgPrevCompetitorPrice) ? `${formatCurrency(avgPrevCompetitorPrice)} -> ${formatCurrency(avgCompetitorPrice)}` : 'No prior benchmark'}</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Social Buzz Change</div>
          <div class="fw-semibold fs-5">${formatSignedPercentText(socialBuzzChangePct)}</div>
          <div class="small text-muted">${Number.isFinite(avgPrevSocialScore) ? `${avgPrevSocialScore.toFixed(1)} -> ${avgSocialScore.toFixed(1)}` : 'No prior benchmark'}</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Revenue Impact</div>
          <div class="fw-semibold fs-5">${formatSignedCurrency(incrementalRevenue)}</div>
          <div class="small text-muted">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x ${isPlannedPromo ? 'modeled ROI' : 'ROI'}` : 'ROI not modeled'}</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Baseline Sales</div>
          <div class="fw-semibold fs-5">${formatNumber(Math.round(baselineSalesUnits))} units</div>
          <div class="small text-muted">${formatCurrency(baselineRevenue)} baseline week</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Additional Sales</div>
          <div class="fw-semibold fs-5">${incrementalSalesUnits >= 0 ? '+' : ''}${formatNumber(Math.round(incrementalSalesUnits))} units</div>
          <div class="small text-muted">${formatSignedCurrency(revenueDelta)} vs baseline week</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Total Sales</div>
          <div class="fw-semibold fs-5">${formatNumber(Math.round(eventSalesUnits))} units</div>
          <div class="small text-muted">${formatCurrency(eventRevenue)} event week</div>
        </div>
      </div>
      <div class="col-md-3 col-sm-6">
        <div class="border rounded p-3 h-100 bg-body-tertiary">
          <div class="small text-muted text-uppercase mb-1">Event ROI</div>
          <div class="fw-semibold fs-5">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x` : 'N/A'}</div>
          <div class="small text-muted">${Number.isFinite(roiValue) ? (isPlannedPromo ? 'Modeled campaign ROI' : 'Observed campaign ROI') : 'Organic / non-paid event'}</div>
        </div>
      </div>
    </div>
  `;
  if (promo && Array.isArray(promo.sku_results) && promo.sku_results.length > 0) {
    const skuRows = promo.sku_results
      .sort((a, b) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))
      .map(row => {
        const uplift = Number(row.sales_uplift_pct || 0);
        const upliftClass = uplift >= 0 ? 'text-success' : 'text-danger';
        const outcomeBadge = uplift >= 0
          ? '<span class="badge bg-success-subtle text-success">Up</span>'
          : '<span class="badge bg-danger-subtle text-danger">Down</span>';
        const channel = CHANNEL_LABELS[String(row.channel || '').toLowerCase()] || row.channel || '-';
        return `<tr>
          <td class="fw-semibold">${row.sku_name || row.sku_id}</td>
          <td><code class="small">${normalizeSkuId(row.sku_id)}</code></td>
          <td>${channel}</td>
          <td class="${upliftClass}">${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}%</td>
          <td>${outcomeBadge}</td>
        </tr>`;
      }).join('');

    perProductImpactHtml = `
      <div class="mt-3">
        <h6 class="small text-uppercase text-muted mb-2"><i class="bi bi-box-seam me-1"></i>Per-Product Impact</h6>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
              <tr><th>Product</th><th>SKU</th><th>Channel</th><th>Sales Uplift</th><th>Outcome</th></tr>
            </thead>
            <tbody>${skuRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Build per-SKU competitor price breakdown for Competitor Price Change events
  let competitorBreakdownHtml = '';
  if (event.event_type === 'Competitor Price Change') {
    const currentMap = new Map();
    eventRows.forEach(row => {
      currentMap.set(`${normalizeSkuId(row.sku_id)}__${String(row.sales_channel || '').toLowerCase()}`, row);
    });
    const previousMap = new Map();
    previousRows.forEach(row => {
      previousMap.set(`${normalizeSkuId(row.sku_id)}__${String(row.sales_channel || '').toLowerCase()}`, row);
    });

    const compRows = [...currentMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, row]) => {
      const [skuId, channel] = key.split('__');
      const previousRow = previousMap.get(key) || row;
      const currentComp = safeNumber(row.competitor_price, 0);
      const previousComp = safeNumber(previousRow?.competitor_price, currentComp);
      const currentGap = safeNumber(row.price_gap_vs_competitor, 0) * 100;
      const compChangePct = previousComp > 0 ? ((currentComp - previousComp) / previousComp) * 100 : 0;
      const changeClass = compChangePct < -3 ? 'text-danger fw-bold' : compChangePct < 0 ? 'text-warning' : 'text-muted';

      return `
        <tr>
          <td class="fw-semibold">${getSkuName(skuId)}</td>
          <td><code class="small">${skuId}</code></td>
          <td>${CHANNEL_LABELS[channel] || channel}</td>
          <td>${formatCurrency(previousComp)}</td>
          <td>${formatCurrency(currentComp)}</td>
          <td class="${changeClass}">${compChangePct >= 0 ? '+' : ''}${compChangePct.toFixed(1)}%</td>
          <td class="${currentGap >= 0 ? 'text-danger' : 'text-success'}">${currentGap >= 0 ? '+' : ''}${currentGap.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    if (compRows) {
      competitorBreakdownHtml = `
        <div class="mt-3">
          <h6 class="small text-uppercase text-muted mb-2"><i class="bi bi-graph-down-arrow me-1"></i>Competitor Price Breakdown by Product & Retailer</h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0">
              <thead class="table-light">
                <tr><th>Product</th><th>SKU</th><th>Retailer</th><th>Prior Week</th><th>This Week</th><th>Change</th><th>Current Gap</th></tr>
              </thead>
              <tbody>${compRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  // Build social spike enrichment section
  let socialSpikeHtml = '';
  if (event.event_type === 'Social Spike') {
    try {
      const socialSignals = await loadSocialSignals();
      const socialWeekKeys = extractSortedWeekKeys(socialSignals, 'week_start');
      const resolvedSocialWeek = resolveComparableWeekKey(eventDate, socialWeekKeys);
      const previousSocialWeek = getPreviousAvailableWeekKey(resolvedSocialWeek.weekKey, socialWeekKeys);
      const thisWeekData = (socialSignals || []).find(r => (r.week_start || r.date) === resolvedSocialWeek.weekKey);
      const prevWeekData = (socialSignals || []).find(r => (r.week_start || r.date) === previousSocialWeek);

      if (thisWeekData) {
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        const totalMentions = safeNumber(thisWeekData.total_social_mentions, 0);
        const tiktokMentions = safeNumber(thisWeekData.tiktok_mentions, 0);
        const instaMentions = safeNumber(thisWeekData.instagram_mentions, 0);
        const sentiment = safeNumber(thisWeekData.social_sentiment, 0);
        const influencerScore = safeNumber(thisWeekData.influencer_score, 0);
        const paidSpend = safeNumber(thisWeekData.paid_social_spend, 0);
        const earnedValue = safeNumber(thisWeekData.earned_social_value, 0);
        const brandIndex = safeNumber(thisWeekData.brand_social_index, 0);

        // Compute elasticity modifier (same formula as promotion simulator)
        const normalizedScore = brandIndex <= 1.5 && brandIndex >= -1.5 ? brandIndex * 100 : brandIndex;
        const clippedScore = clamp(normalizedScore, 35, 95);
        const elasticityMod = clamp(1.18 - ((clippedScore - 35) * 0.0075), 0.72, 1.26);
        const demandMult = clamp(0.78 + ((clippedScore - 35) * 0.008), 0.72, 1.26);

        // Week-over-week changes
        let mentionWoW = '';
        let sentimentWoW = '';
        if (prevWeekData) {
          const prevMentions = safeNumber(prevWeekData.total_social_mentions, 0);
          const prevSentiment = safeNumber(prevWeekData.social_sentiment, 0);
          if (prevMentions > 0) {
            const mentionPct = ((totalMentions - prevMentions) / prevMentions * 100);
            mentionWoW = ` <span class="${mentionPct >= 0 ? 'text-success' : 'text-danger'}">(${mentionPct >= 0 ? '+' : ''}${mentionPct.toFixed(1)}% WoW)</span>`;
          }
          if (prevSentiment > 0) {
            const sentDelta = sentiment - prevSentiment;
            sentimentWoW = ` <span class="${sentDelta >= 0 ? 'text-success' : 'text-danger'}">(${sentDelta >= 0 ? '+' : ''}${sentDelta.toFixed(3)} WoW)</span>`;
          }
        }

        // Determine buzz level
        const buzzLevel = brandIndex >= 75 ? 'Very High' : brandIndex >= 60 ? 'High' : brandIndex >= 45 ? 'Moderate' : 'Low';
        const buzzClass = brandIndex >= 75 ? 'text-success' : brandIndex >= 60 ? 'text-primary' : brandIndex >= 45 ? 'text-warning' : 'text-muted';
        const buzzIcon = brandIndex >= 75 ? 'bi-fire' : brandIndex >= 60 ? 'bi-graph-up-arrow' : 'bi-dash';

        // Business interpretation
        let bizInsight = '';
        if (elasticityMod < 0.9) {
          bizInsight = 'Consumers are much less price-sensitive right now. Hold or raise prices — discounting would leave money on the table.';
        } else if (elasticityMod < 1.0) {
          bizInsight = 'Social buzz is reducing price sensitivity. You can hold price and let organic demand drive volume.';
        } else if (elasticityMod > 1.1) {
          bizInsight = 'Low social engagement means consumers are more price-sensitive. Targeted discounts would help drive volume.';
        } else {
          bizInsight = 'Social sentiment is near neutral. Standard pricing strategy applies.';
        }

        socialSpikeHtml = `
          <div class="mt-3">
            <h6 class="small text-uppercase text-muted mb-2"><i class="bi bi-megaphone me-1"></i>Social Media Impact Analysis</h6>
            <div class="row g-2 mb-3">
              <div class="col-6 col-md-3">
                <div class="border rounded p-2 text-center">
                  <div class="small text-muted">Total Mentions</div>
                  <div class="fw-bold fs-5">${formatNumber(totalMentions)}</div>
                  <div class="small">${mentionWoW}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="border rounded p-2 text-center">
                  <div class="small text-muted">TikTok</div>
                  <div class="fw-bold fs-5">${formatNumber(tiktokMentions)}</div>
                  <div class="small text-muted">${totalMentions > 0 ? ((tiktokMentions / totalMentions) * 100).toFixed(0) : 0}% of total</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="border rounded p-2 text-center">
                  <div class="small text-muted">Instagram</div>
                  <div class="fw-bold fs-5">${formatNumber(instaMentions)}</div>
                  <div class="small text-muted">${totalMentions > 0 ? ((instaMentions / totalMentions) * 100).toFixed(0) : 0}% of total</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="border rounded p-2 text-center">
                  <div class="small text-muted">Buzz Level</div>
                  <div class="fw-bold fs-5 ${buzzClass}"><i class="bi ${buzzIcon} me-1"></i>${buzzLevel}</div>
                  <div class="small text-muted">Index: ${brandIndex.toFixed(1)}</div>
                </div>
              </div>
            </div>
            <div class="table-responsive mb-3">
              <table class="table table-sm table-bordered align-middle mb-0">
                <thead class="table-light">
                  <tr><th>Metric</th><th>Value</th><th>What It Means</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="fw-semibold">Sentiment Score</td>
                    <td>${sentiment.toFixed(3)}${sentimentWoW}</td>
                    <td class="small">${sentiment >= 0.7 ? 'Very positive — brand is loved' : sentiment >= 0.5 ? 'Positive — healthy brand perception' : 'Neutral or mixed — watch for issues'}</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Influencer Score</td>
                    <td>${influencerScore.toFixed(3)}</td>
                    <td class="small">${influencerScore >= 0.6 ? 'Strong creator engagement amplifying reach' : influencerScore >= 0.4 ? 'Moderate creator involvement' : 'Limited influencer amplification'}</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Earned Media Value</td>
                    <td>${formatCurrency(earnedValue)}</td>
                    <td class="small">Organic exposure value (vs. ${formatCurrency(paidSpend)} paid spend)</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Elasticity Modifier</td>
                    <td class="${elasticityMod < 1 ? 'text-success fw-bold' : elasticityMod > 1.05 ? 'text-danger fw-bold' : ''}">${elasticityMod.toFixed(3)}</td>
                    <td class="small">${elasticityMod < 1 ? 'Below 1.0 = consumers less price-sensitive (hold price)' : 'At/above 1.0 = normal or elevated price sensitivity'}</td>
                  </tr>
                  <tr>
                    <td class="fw-semibold">Demand Multiplier</td>
                    <td class="${demandMult > 1 ? 'text-success fw-bold' : ''}">${demandMult.toFixed(3)}</td>
                    <td class="small">${demandMult > 1 ? 'Above 1.0 = social buzz is pulling additional demand' : 'Demand impact is neutral'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="alert alert-light border mb-0 small">
              <i class="bi bi-lightbulb me-1 text-warning"></i><strong>Pricing Recommendation:</strong> ${bizInsight}
            </div>
            <div class="small text-muted mt-2">${resolvedSocialWeek.basis}: week of ${new Date(`${resolvedSocialWeek.weekKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</div>
          </div>
        `;
      }
    } catch (err) {
      console.warn('Could not load social data for event details:', err);
    }
  }

  // Product badge line
  let productBadgeLine = '';
  if (productInfo.skus.length > 0) {
    const badges = productInfo.skus.map(s =>
      `<span class="badge bg-light text-dark border me-1">${s.sku_name} (${s.sku_id})</span>`
    ).join('');
    productBadgeLine = `<div class="mb-2"><i class="bi bi-box-seam me-1 text-muted"></i><strong>Products:</strong> ${badges}</div>`;
  } else if (productInfo.productGroup) {
    productBadgeLine = `<div class="mb-2"><i class="bi bi-box-seam me-1 text-muted"></i><strong>Product Category:</strong> <span class="badge bg-light text-dark border">${productInfo.productGroup}</span></div>`;
  }

  let html = `
    <div class="glass-card p-4">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h6 class="mb-2">
            <span class="badge ${badge.class} me-2">${badge.text}</span>
            ${event.tier !== 'all' ? `<span class="badge bg-secondary">${formatTier(event.tier)}</span>` : ''}
          </h6>
          <div class="text-muted small">
            <i class="bi bi-calendar-event me-2"></i>${dateStr}
          </div>
        </div>
        <button type="button" class="btn-close" onclick="document.getElementById('timeline-details').style.display='none'"></button>
      </div>
      ${(event.event_type === 'Competitor Price Change' || event.event_type === 'Social Spike' || promo) ? `
      <div class="mb-3">
        <div class="d-flex flex-wrap gap-2">
          ${event.event_type === 'Competitor Price Change' || event.event_type === 'Social Spike' ? `
            <button class="btn btn-primary btn-sm" id="event-simulate-btn">
              <i class="bi bi-play-circle me-1"></i>Open Planner
            </button>
          ` : ''}
          ${promo ? `
            <button class="btn btn-outline-primary btn-sm" id="event-promo-drilldown-btn">
              <i class="bi bi-arrow-down-right-circle me-1"></i>Open Promo Outcomes Below
            </button>
          ` : ''}
        </div>
      </div>
      ` : ''}
      ${productBadgeLine}
      <p class="mb-2">${event.notes || 'No description available'}</p>
      ${priceInfo ? `<div class="alert alert-info mb-2"><i class="bi bi-info-circle me-2"></i>${priceInfo}</div>` : ''}
      ${promoContext}
      ${eventStoryHtml}
      ${eventImpactSummaryHtml}
      ${eventMetricsDeltaHtml}
      ${competitorBreakdownHtml}
      ${socialSpikeHtml}
      ${perProductImpactHtml}
    </div>
  `;

  detailsPanel.innerHTML = html;
  detailsPanel.style.display = 'block';
  requestAnimationFrame(() => {
    detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Attach Simulate Response button handler for supported event types
  const simulateBtn = document.getElementById('event-simulate-btn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      if (typeof window.goToStep === 'function') {
        window.goToStep(7);
      }
      if (event.event_type === 'Competitor Price Change') {
        // Click the pivot preset to set up a defensive scenario
        setTimeout(() => {
          const pivotBtn = document.getElementById('channel-promo-preset-pivot');
          if (pivotBtn) pivotBtn.click();
          // Set the competitor shock product dropdown to the affected product group
          const pg = productInfo.productGroup;
          if (pg) {
            setTimeout(() => {
              const compShockProductSelect = document.getElementById('channel-promo-comp-shock-product');
              if (compShockProductSelect) {
                const targetValue = pg.toLowerCase();
                const optionExists = [...compShockProductSelect.options].some(o => o.value === targetValue);
                if (optionExists) {
                  compShockProductSelect.value = targetValue;
                  compShockProductSelect.dispatchEvent(new Event('change'));
                }
              }
            }, 100);
          }
        }, 100);
      } else if (event.event_type === 'Social Spike') {
        // Select baseline preset — hold pricing since social buzz is high
        setTimeout(() => {
          const baselineBtn = document.getElementById('channel-promo-preset-baseline');
          if (baselineBtn) baselineBtn.click();
        }, 100);
      }
    });
  }

  const promoDrilldownBtn = document.getElementById('event-promo-drilldown-btn');
  if (promoDrilldownBtn && promo?.promo_id) {
    promoDrilldownBtn.addEventListener('click', () => {
      renderPromoDrilldown(promo.promo_id);
    });
  }

  if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
    window.onEventCalendarEventSelected(event);
  }
}

async function showEventDetails(event) {
  const detailsPanel = document.getElementById('timeline-details');
  if (!detailsPanel) return;

  const eventDate = new Date(event.date);
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const badge = getEventBadge(event.event_type);
  const productInfo = getEventProductInfo(event);
  const historyRows = productHistoryRows?.length ? productHistoryRows : await loadProductChannelHistory();
  const historyWeekKeys = extractSortedWeekKeys(historyRows, 'week_start');
  const resolvedWeek = resolveComparableWeekKey(eventDate, historyWeekKeys);
  const previousWeekKey = getPreviousAvailableWeekKey(resolvedWeek.weekKey, historyWeekKeys);
  const scope = buildEventScope(event, productInfo);
  const eventRows = getScopedRowsForWeek(historyRows, resolvedWeek.weekKey, scope);
  const previousRows = getScopedRowsForWeek(historyRows, previousWeekKey, scope);
  const currentSummary = finalizeScopedSummary(summarizeScopedRows(eventRows));
  const previousSummary = finalizeScopedSummary(summarizeScopedRows(previousRows));
  const pctChange = (current, previous) => (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0)
    ? ((current - previous) / previous)
    : null;
  const formatCurrencyOrNA = value => Number.isFinite(value) ? formatCurrency(value) : 'N/A';
  const formatValueOrNA = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'N/A';

  const baselineSalesUnits = previousSummary.units;
  const eventSalesUnits = currentSummary.units;
  const baselineRevenue = previousSummary.revenue;
  const eventRevenue = currentSummary.revenue;
  const avgOwnPrice = currentSummary.ownPrice;
  const avgPrevOwnPrice = previousSummary.ownPrice;
  const avgCompetitorPrice = currentSummary.competitorPrice;
  const avgPrevCompetitorPrice = previousSummary.competitorPrice;
  const avgSocialScore = currentSummary.social;
  const avgPrevSocialScore = previousSummary.social;
  const ownPriceChangePct = pctChange(avgOwnPrice, avgPrevOwnPrice);
  const competitorPriceChangePct = pctChange(avgCompetitorPrice, avgPrevCompetitorPrice);
  const socialBuzzChangePct = pctChange(avgSocialScore, avgPrevSocialScore);
  const incrementalSalesUnits = eventSalesUnits - baselineSalesUnits;
  const revenueDelta = eventRevenue - baselineRevenue;

  const promoId = event.promo_id;
  const promo = promoId && promoMetadata ? promoMetadata[promoId] : null;
  const isPlannedPromo = String(promo?.story_phase || '').toLowerCase() === 'future';
  const discountPct = safeNumber(promo?.discount_pct ?? event.promo_discount_pct, 0);
  const roiValue = safeNumber(promo?.actual_roi, null);
  const incrementalRevenue = safeNumber(promo?.incremental_revenue_usd, revenueDelta);
  const totalMarketingSpend = safeNumber(promo?.marketing_spend_usd, 0);
  const summaryChannels = scope.affectedChannels.length
    ? scope.affectedChannels.map(channel => CHANNEL_LABELS[channel] || channel).join(', ')
    : 'All channels in scope';
  const summaryProducts = productInfo.label || 'Portfolio-wide';
  const headline = buildEventHeadline(event, promo, productInfo);
  const statusMeta = buildEventStatus(event, promo, eventDate);
  const phaseLabel = promo ? (STORY_PHASE_LABELS[promo.story_phase] || 'Campaign') : null;
  const discountLabel = Number.isFinite(discountPct) && discountPct > 0 ? `${discountPct.toFixed(1)}%` : 'No explicit discount';
  const basisText = resolvedWeek.weekKey
    ? `${resolvedWeek.basis}: week of ${new Date(`${resolvedWeek.weekKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'No weekly analog available';
  const eventPeriodText = promo?.start_date && promo?.end_date
    ? `${new Date(promo.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(promo.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : dateStr;
  const revenueImpactClass = incrementalRevenue >= 0 ? 'text-success' : 'text-danger';

  // --- Event type icon & gradient ---
  const eventTypeConfig = {
    'Competitor Price Change': { icon: 'bi-arrow-left-right', gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', accent: '#ef4444' },
    'Social Spike': { icon: 'bi-megaphone-fill', gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', accent: '#8b5cf6' },
    'Tentpole': { icon: 'bi-star-fill', gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)', accent: '#f59e0b' },
    'Price Change': { icon: 'bi-tag-fill', gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', accent: '#3b82f6' },
    'Promo Start': { icon: 'bi-lightning-fill', gradient: 'linear-gradient(135deg, #0891b2 0%, #155e75 100%)', accent: '#06b6d4' },
    'Promo End': { icon: 'bi-flag-fill', gradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)', accent: '#64748b' },
    'Promo Roll-off': { icon: 'bi-arrow-return-left', gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)', accent: '#f97316' }
  };
  const typeConf = eventTypeConfig[event.event_type] || { icon: 'bi-calendar-event', gradient: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', accent: '#64748b' };

  // --- Product badges ---
  let productBadgesHtml = '';
  if (productInfo.skus.length > 0) {
    productBadgesHtml = productInfo.skus.map(sku =>
      `<span class="ed-product-badge">${sku.sku_name} <span class="ed-product-badge-code">${sku.sku_id}</span></span>`
    ).join('');
  } else if (productInfo.productGroup) {
    productBadgesHtml = `<span class="ed-product-badge">${productInfo.productGroup}</span>`;
  }

  // --- Channel badges ---
  const channelBadgesHtml = scope.affectedChannels.length
    ? scope.affectedChannels.map(ch => `<span class="ed-channel-badge">${CHANNEL_LABELS[ch] || ch}</span>`).join('')
    : '<span class="ed-channel-badge">All Channels</span>';

  // --- Signal change arrow helper ---
  const signalArrow = (val) => {
    if (!Number.isFinite(val)) return '';
    return val > 0 ? '<i class="bi bi-arrow-up-short"></i>' : val < 0 ? '<i class="bi bi-arrow-down-short"></i>' : '<i class="bi bi-dash"></i>';
  };
  const signalColorClass = (val) => {
    if (!Number.isFinite(val)) return '';
    return val > 0 ? 'ed-signal-up' : val < 0 ? 'ed-signal-down' : 'ed-signal-flat';
  };
  // For price changes, down is good for us (competitor) or bad (our price down means discount)
  const ownPriceSignalClass = signalColorClass(ownPriceChangePct);
  const compPriceSignalClass = Number.isFinite(competitorPriceChangePct)
    ? (competitorPriceChangePct < 0 ? 'ed-signal-down' : competitorPriceChangePct > 0 ? 'ed-signal-up' : 'ed-signal-flat')
    : '';
  const socialSignalClass = signalColorClass(socialBuzzChangePct);
  const revenueSignalClass = incrementalRevenue >= 0 ? 'ed-signal-up' : 'ed-signal-down';

  // --- Campaign timeline bar helper ---
  function buildCampaignTimelineHtml(p) {
    if (!p?.start_date || !p?.end_date) return '';
    const sDate = new Date(p.start_date);
    const eDate = new Date(p.end_date);
    const rDate = p.roll_off_date ? new Date(p.roll_off_date) : null;
    const totalSpan = (rDate || eDate) - sDate;
    if (totalSpan <= 0) return '';
    const activePct = Math.round(((eDate - sDate) / totalSpan) * 100);
    const rollOffPct = rDate ? 100 - activePct : 0;
    const durationWeeks = p.duration_weeks || Math.round((eDate - sDate) / (7 * DAY_MS));
    const rollOffWeeks = rDate ? Math.round((rDate - eDate) / (7 * DAY_MS)) : 0;
    const isFuture = eDate > CALENDAR_TODAY;
    const isActive = sDate <= CALENDAR_TODAY && eDate >= CALENDAR_TODAY;
    const todayPct = isActive ? Math.round(((CALENDAR_TODAY - sDate) / totalSpan) * 100) : -1;

    return `
      <div class="ed-timeline-bar">
        <div class="ed-timeline-labels">
          <span>${formatDate(p.start_date)}</span>
          <span class="ed-timeline-duration"><i class="bi bi-clock me-1"></i>${durationWeeks}w active${rollOffWeeks > 0 ? ` + ${rollOffWeeks}w roll-off` : ''}</span>
          <span>${formatDate(rDate ? p.roll_off_date : p.end_date)}</span>
        </div>
        <div class="ed-timeline-track">
          <div class="ed-timeline-active" style="width: ${activePct}%;">
            <span class="ed-timeline-segment-label">Active</span>
          </div>
          ${rollOffPct > 0 ? `<div class="ed-timeline-rolloff" style="width: ${rollOffPct}%;"><span class="ed-timeline-segment-label">${p.roll_off_type === 'soft' ? 'Soft' : 'Hard'} Roll-off</span></div>` : ''}
          ${todayPct >= 0 ? `<div class="ed-timeline-today-marker" style="left: ${todayPct}%;"><span>Now</span></div>` : ''}
        </div>
      </div>
    `;
  }

  // --- Promo-specific details ---
  let promoDetailsHtml = '';
  let strategicOutlookHtml = '';
  if (promo) {
    const skuResults = Array.isArray(promo.sku_results) ? promo.sku_results : [];
    const skuUpCount = skuResults.filter(row => row.outcome === 'up' || Number(row.sales_uplift_pct || 0) >= 0).length;
    const skuDownCount = skuResults.filter(row => row.outcome === 'down' || Number(row.sales_uplift_pct || 0) < 0).length;
    const avgSkuUplift = skuResults.length ? skuResults.reduce((s, r) => s + Number(r.sales_uplift_pct || 0), 0) / skuResults.length : null;
    const performanceUnitsValue = Number.isFinite(safeNumber(promo.actual_adds, null)) ? formatNumber(promo.actual_adds) : 'TBD';
    const attainmentPct = Number.isFinite(safeNumber(promo.actual_adds, null)) && Number.isFinite(safeNumber(promo.target_adds, null)) && Number(promo.target_adds) !== 0
      ? Number(promo.actual_adds) / Number(promo.target_adds) : null;
    const attainmentLabel = attainmentPct !== null ? formatPercent(attainmentPct) : null;
    const seasonLabel = promo.season ? formatSeasonLabel(promo.season) : null;
    const tags = Array.isArray(promo.campaign_tags) ? promo.campaign_tags : [];
    const ap = promo.actual_performance || {};
    const sc = promo.success_criteria || {};
    const channelRes = promo.channel_results || {};
    const spendVal = safeNumber(promo.marketing_spend_usd, null);
    const durationWeeks = promo.duration_weeks || 0;

    // Campaign timeline
    const timelineHtml = buildCampaignTimelineHtml(promo);

    // --- Attainment gauge bar ---
    const attainmentBarPct = attainmentPct !== null ? Math.min(Math.round(attainmentPct * 100), 150) : 0;
    const attainmentColor = attainmentPct !== null ? (attainmentPct >= 1 ? '#10b981' : attainmentPct >= 0.8 ? '#f59e0b' : '#ef4444') : '#94a3b8';

    // --- Success criteria scorecard (completed promos) ---
    let scorecardHtml = '';
    if (!isPlannedPromo && (ap.adds_achieved || ap.ltv_cac_ratio)) {
      const checks = [
        { label: 'Units Acquired', actual: ap.adds_achieved, target: sc.adds_min, format: v => formatNumber(Math.round(v)), pass: ap.adds_achieved >= (sc.adds_min || 0) },
        { label: 'Repeat Loss Rate (8w)', actual: ap.repeat_loss_rate_at_8w, target: sc.repeat_loss_rate_max, format: v => `${(v * 100).toFixed(1)}%`, pass: (ap.repeat_loss_rate_at_8w || 0) <= (sc.repeat_loss_rate_max || 1), lower: true },
        { label: 'Payback Period', actual: ap.payback_months, target: sc.payback_months_max, format: v => `${v.toFixed(1)}mo`, pass: (ap.payback_months || 99) <= (sc.payback_months_max || 99), lower: true },
        { label: 'LTV:CAC Ratio', actual: ap.ltv_cac_ratio, target: sc.ltv_cac_ratio_min, format: v => `${v.toFixed(1)}x`, pass: (ap.ltv_cac_ratio || 0) >= (sc.ltv_cac_ratio_min || 0) }
      ].filter(c => Number.isFinite(c.actual));

      if (checks.length) {
        scorecardHtml = `
          <div class="ed-scorecard">
            <div class="ed-scorecard-title"><i class="bi bi-clipboard-check me-1"></i>Success Criteria Scorecard</div>
            <div class="ed-scorecard-grid">
              ${checks.map(c => `
                <div class="ed-scorecard-item ${c.pass ? 'ed-scorecard-pass' : 'ed-scorecard-fail'}">
                  <div class="ed-scorecard-icon">${c.pass ? '<i class="bi bi-check-circle-fill"></i>' : '<i class="bi bi-x-circle-fill"></i>'}</div>
                  <div>
                    <div class="ed-scorecard-label">${c.label}</div>
                    <div class="ed-scorecard-value">${c.format(c.actual)} <span class="ed-scorecard-vs">vs ${Number.isFinite(c.target) ? c.format(c.target) + ' target' : 'no target'}</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    // --- Channel results breakdown ---
    let channelResHtml = '';
    const channelEntries = Object.entries(channelRes).filter(([, v]) => v && (Number.isFinite(v.sales_uplift_pct) || Number.isFinite(v.margin_delta_pct)));
    if (channelEntries.length) {
      channelResHtml = `
        <div class="ed-channel-results">
          ${channelEntries.map(([ch, v]) => {
            const uplift = safeNumber(v.sales_uplift_pct, 0);
            const margin = safeNumber(v.margin_delta_pct, 0);
            return `
              <div class="ed-channel-result-item">
                <div class="ed-channel-result-name">${CHANNEL_LABELS[ch] || ch}</div>
                <div class="ed-channel-result-bar-wrap">
                  <div class="ed-channel-result-bar ${uplift >= 0 ? 'ed-bar-positive' : 'ed-bar-negative'}" style="width: ${Math.min(Math.abs(uplift) * 3, 100)}%;"></div>
                </div>
                <div class="ed-channel-result-metrics">
                  <span class="${uplift >= 0 ? 'ed-signal-up' : 'ed-signal-down'}">${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}% sales</span>
                  <span class="${margin >= 0 ? 'ed-signal-up' : 'ed-signal-down'}">${margin >= 0 ? '+' : ''}${margin.toFixed(1)}% margin</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    promoDetailsHtml = `
      ${timelineHtml}
      <div class="ed-promo-details">
        <div class="ed-promo-kpi-row">
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">Target</div>
            <div class="ed-promo-kpi-value">${Number.isFinite(safeNumber(promo.target_adds, null)) ? formatNumber(promo.target_adds) : 'TBD'}<span class="ed-kpi-unit"> units</span></div>
          </div>
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">${isPlannedPromo ? 'Projected' : 'Actual'}</div>
            <div class="ed-promo-kpi-value">${performanceUnitsValue}<span class="ed-kpi-unit"> units</span></div>
          </div>
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">Attainment</div>
            <div class="ed-promo-kpi-value">
              ${attainmentLabel || 'TBD'}
              ${attainmentPct !== null ? `<div class="ed-attainment-bar"><div class="ed-attainment-fill" style="width: ${Math.min(attainmentBarPct, 100)}%; background: ${attainmentColor};"></div></div>` : ''}
            </div>
          </div>
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">Spend</div>
            <div class="ed-promo-kpi-value">${Number.isFinite(spendVal) ? formatCurrency(spendVal) : 'N/A'}</div>
          </div>
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">Avg SKU Uplift</div>
            <div class="ed-promo-kpi-value ${Number.isFinite(avgSkuUplift) ? (avgSkuUplift >= 0 ? 'ed-signal-up' : 'ed-signal-down') : ''}">${Number.isFinite(avgSkuUplift) ? `${avgSkuUplift >= 0 ? '+' : ''}${avgSkuUplift.toFixed(1)}%` : 'N/A'}</div>
          </div>
          <div class="ed-promo-kpi">
            <div class="ed-promo-kpi-label">SKU Outcomes</div>
            <div class="ed-promo-kpi-value">${skuUpCount}<span class="ed-signal-up"> up</span> / ${skuDownCount}<span class="ed-signal-down"> down</span></div>
          </div>
        </div>
        ${promo.repeat_loss_expected ? `
          <div class="ed-risk-flag">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>Repeat-loss risk flagged &mdash; expected at ${promo.repeat_loss_lag_weeks || '?'}w post roll-off. Monitor repurchase rates on ${(promo.eligible_channels || []).map(c => CHANNEL_LABELS[c] || c).join(', ')}.</span>
          </div>
        ` : ''}
        ${seasonLabel || tags.length ? `
          <div class="ed-promo-tags-row">
            ${seasonLabel ? `<span class="ed-tag-pill">${seasonLabel}</span>` : ''}
            ${tags.map(t => `<span class="ed-tag-pill">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      ${channelResHtml}
      ${scorecardHtml}
    `;

    // --- Strategic Outlook for FUTURE promos ---
    if (isPlannedPromo) {
      const projectedRev = safeNumber(promo.incremental_revenue_usd, null);
      const targetRoi = safeNumber(promo.target_roi, null);
      const cohorts = Array.isArray(promo.eligible_cohorts) ? promo.eligible_cohorts : [];
      const exclusions = Array.isArray(promo.exclusions) ? promo.exclusions : [];

      // Risk assessment
      const risks = [];
      if (promo.repeat_loss_expected) risks.push({ level: 'high', text: `Post-promo repeat loss expected at ${promo.repeat_loss_lag_weeks || '?'} weeks. Plan retention offers for high-value cohorts.` });
      if (discountPct > 15) risks.push({ level: 'medium', text: `Deep discount (${discountPct.toFixed(0)}%) may erode brand equity on prestige channels. Consider tiered discounting.` });
      if (durationWeeks > 3) risks.push({ level: 'low', text: `Extended ${durationWeeks}-week window increases markdown fatigue risk. Watch weekly conversion decay.` });
      if (channelEntries.length === 0) risks.push({ level: 'medium', text: 'No channel-level performance benchmarks from prior campaigns. ROI forecast carries higher uncertainty.' });
      if (exclusions.length) risks.push({ level: 'info', text: `${exclusions.length} SKU(s) excluded: ${exclusions.map(s => getSkuName(s)).join(', ')}. Validate exclusion rationale against current inventory.` });

      // Recommendations
      const recommendations = [];
      if (promo.roll_off_type === 'soft') recommendations.push('Soft roll-off is configured. Taper messaging 1 week before end to avoid cliff-edge demand drop.');
      if (cohorts.length) recommendations.push(`Target cohorts: ${cohorts.map(c => c.replace(/_/g, ' ')).join(', ')}. Align creative and landing pages to these segments.`);
      if (Number.isFinite(projectedRev) && projectedRev > 0) recommendations.push(`Projected incremental revenue of ${formatCurrency(projectedRev)} at ${targetRoi ? targetRoi.toFixed(1) + 'x' : 'TBD'} ROI. Set weekly checkpoints at 33% and 66% of window.`);
      recommendations.push('Run A/B holdout on 10-15% of eligible traffic to measure true incrementality.');

      strategicOutlookHtml = `
        <div class="ed-strategic-outlook">
          <div class="ed-strategic-header">
            <i class="bi bi-binoculars me-2"></i>Strategic Outlook
          </div>
          <div class="ed-strategic-body">
            <div class="ed-strategic-section">
              <div class="ed-strategic-section-title"><i class="bi bi-shield-exclamation me-1"></i>Risk Assessment</div>
              ${risks.length ? risks.map(r => `
                <div class="ed-risk-item ed-risk-${r.level}">
                  <span class="ed-risk-level">${r.level}</span>
                  <span>${r.text}</span>
                </div>
              `).join('') : '<div class="ed-risk-item ed-risk-low"><span class="ed-risk-level">low</span><span>No elevated risk factors identified. Standard monitoring applies.</span></div>'}
            </div>
            <div class="ed-strategic-section">
              <div class="ed-strategic-section-title"><i class="bi bi-lightbulb me-1"></i>Recommended Actions</div>
              <div class="ed-reco-list">
                ${recommendations.map(r => `<div class="ed-reco-item"><i class="bi bi-arrow-right-circle"></i><span>${r}</span></div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // --- Business implications for non-promo events ---
  let businessImplicationsHtml = '';
  if (!promo) {
    const eventDurationText = event.event_type === 'Tentpole'
      ? 'Seasonal window typically spans 2-4 weeks of elevated traffic.'
      : event.event_type === 'Social Spike'
        ? 'Social-driven demand typically peaks within 5-10 days and decays over 3 weeks.'
        : event.event_type === 'Competitor Price Change'
          ? 'Competitor pricing adjustments usually sustain for 4-8 weeks.'
          : '';

    let implicationBullets = [];
    if (event.event_type === 'Competitor Price Change') {
      const priceDrop = safeNumber(event.price_before, 0) - safeNumber(event.price_after, 0);
      const pricePctDrop = safeNumber(event.price_before, 0) > 0 ? (priceDrop / event.price_before) * 100 : 0;
      if (pricePctDrop > 0) implicationBullets.push(`Competitor dropped price by ${pricePctDrop.toFixed(1)}% (${formatCurrency(event.price_before)} &rarr; ${formatCurrency(event.price_after)}). This widens the competitive gap on affected channels.`);
      implicationBullets.push('Evaluate whether to match, partially match, or hold pricing and compete on value proposition.');
      implicationBullets.push('Monitor unit share shift over next 2-3 weeks before deciding on defensive action.');
      if (incrementalRevenue < 0) implicationBullets.push(`Revenue impact already negative (${formatSignedCurrency(incrementalRevenue)}). Consider targeted promo on affected SKUs to recapture lost share.`);
    } else if (event.event_type === 'Social Spike') {
      implicationBullets.push('Social buzz creates organic demand lift. This is an opportunity to hold full price and protect margins.');
      implicationBullets.push('Ensure affected SKUs have sufficient inventory depth on high-traffic channels.');
      if (incrementalRevenue > 0) implicationBullets.push(`Positive revenue lift (${formatSignedCurrency(incrementalRevenue)}) without discounting. Maximize organic conversion with content amplification.`);
      implicationBullets.push('Avoid launching discounts during buzz periods &mdash; let organic demand play out before promotional intervention.');
    } else if (event.event_type === 'Tentpole') {
      implicationBullets.push('Seasonal tentpole drives broad category traffic. Ensure assortment depth and promotional readiness.');
      implicationBullets.push('Pre-position inventory 2-3 weeks before the event to avoid stockouts on fast-moving SKUs.');
      implicationBullets.push('Coordinate marketing calendar to amplify tent-pole messaging across digital and in-store.');
      if (event.channel_group !== 'all') implicationBullets.push(`This event primarily impacts ${formatTier(event.tier)} channels. Align promotional depth to channel-specific elasticity.`);
    }

    if (implicationBullets.length) {
      businessImplicationsHtml = `
        <div class="ed-implications">
          <div class="ed-implications-header"><i class="bi bi-briefcase me-2"></i>Business Implications</div>
          ${eventDurationText ? `<div class="ed-implications-duration"><i class="bi bi-clock me-1"></i>${eventDurationText}</div>` : ''}
          <div class="ed-reco-list">
            ${implicationBullets.map(b => `<div class="ed-reco-item"><i class="bi bi-arrow-right-circle"></i><span>${b}</span></div>`).join('')}
          </div>
        </div>
      `;
    }
  }

  // === BUILD THE CARD HTML ===
  const eventCardHtml = `
    <div class="ed-card">
      <!-- Close button -->
      <button type="button" class="ed-close-btn" onclick="document.getElementById('timeline-details').style.display='none'">
        <i class="bi bi-x-lg"></i>
      </button>

      <!-- Hero Header -->
      <div class="ed-hero" style="background: ${typeConf.gradient};">
        <div class="ed-hero-icon">
          <i class="bi ${typeConf.icon}"></i>
        </div>
        <div class="ed-hero-content">
          <div class="ed-hero-type">
            <span class="ed-type-badge">${badge.text}</span>
            <span class="ed-status-badge ${statusMeta.className}">${statusMeta.label}</span>
            ${phaseLabel ? `<span class="ed-phase-badge">${phaseLabel}</span>` : ''}
            ${event.tier !== 'all' ? `<span class="ed-tier-badge">${formatTier(event.tier)}</span>` : ''}
          </div>
          <h3 class="ed-hero-title">${headline}</h3>
          <div class="ed-hero-date">
            <i class="bi bi-calendar3 me-1"></i>${eventPeriodText}
            ${promo?.duration_weeks ? `<span class="ed-duration-pill">${promo.duration_weeks}w</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Business Context Section -->
      <div class="ed-body">
        <!-- Key Facts Row -->
        <div class="ed-facts-row">
          <div class="ed-fact">
            <div class="ed-fact-icon"><i class="bi bi-shop"></i></div>
            <div>
              <div class="ed-fact-label">Channels</div>
              <div class="ed-fact-value">${channelBadgesHtml}</div>
            </div>
          </div>
          <div class="ed-fact">
            <div class="ed-fact-icon"><i class="bi bi-box-seam"></i></div>
            <div>
              <div class="ed-fact-label">Products</div>
              <div class="ed-fact-value">${productBadgesHtml || summaryProducts}</div>
            </div>
          </div>
          <div class="ed-fact">
            <div class="ed-fact-icon"><i class="bi bi-percent"></i></div>
            <div>
              <div class="ed-fact-label">Discount</div>
              <div class="ed-fact-value fw-semibold">${discountLabel}</div>
            </div>
          </div>
        </div>

        <!-- Narrative -->
        <div class="ed-narrative">
          <div class="ed-narrative-bar" style="background: ${typeConf.accent};"></div>
          <div class="ed-narrative-text">${promo?.story_summary || event.notes || 'No description available.'}</div>
        </div>

        ${promoDetailsHtml}
        ${strategicOutlookHtml}
        ${businessImplicationsHtml}

        <!-- KPI Metrics Grid -->
        <div class="ed-kpi-grid">
          <div class="ed-kpi ed-kpi-highlight">
            <div class="ed-kpi-label">Revenue Impact</div>
            <div class="ed-kpi-value ${revenueSignalClass}">${formatSignedCurrency(incrementalRevenue)}</div>
            <div class="ed-kpi-sub">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x ${isPlannedPromo ? 'modeled ROI' : 'ROI'}` : 'ROI not modeled'}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Baseline Sales</div>
            <div class="ed-kpi-value">${formatNumber(Math.round(baselineSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatCurrency(baselineRevenue)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Incremental Sales</div>
            <div class="ed-kpi-value ${incrementalSalesUnits >= 0 ? 'ed-signal-up' : 'ed-signal-down'}">${incrementalSalesUnits >= 0 ? '+' : ''}${formatNumber(Math.round(incrementalSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatSignedCurrency(revenueDelta)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Total Sales</div>
            <div class="ed-kpi-value">${formatNumber(Math.round(eventSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatCurrency(eventRevenue)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Event ROI</div>
            <div class="ed-kpi-value">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x` : 'N/A'}</div>
            <div class="ed-kpi-sub">${Number.isFinite(roiValue) ? (isPlannedPromo ? 'Modeled' : 'Observed') : 'Organic event'}</div>
          </div>
        </div>

        <!-- Signal Changes -->
        <div class="ed-signals-header">Market Signal Changes</div>
        <div class="ed-signals-row">
          <div class="ed-signal ${ownPriceSignalClass}">
            <div class="ed-signal-icon"><i class="bi bi-tag"></i></div>
            <div class="ed-signal-body">
              <div class="ed-signal-label">Our Price</div>
              <div class="ed-signal-value">${signalArrow(ownPriceChangePct)} ${formatSignedPercentText(ownPriceChangePct)}</div>
              <div class="ed-signal-detail">${Number.isFinite(avgPrevOwnPrice) ? `${formatCurrency(avgPrevOwnPrice)} &rarr; ${formatCurrency(avgOwnPrice)}` : 'No benchmark'}</div>
            </div>
          </div>
          <div class="ed-signal ${compPriceSignalClass}">
            <div class="ed-signal-icon"><i class="bi bi-arrow-left-right"></i></div>
            <div class="ed-signal-body">
              <div class="ed-signal-label">Competitor Price</div>
              <div class="ed-signal-value">${signalArrow(competitorPriceChangePct)} ${formatSignedPercentText(competitorPriceChangePct)}</div>
              <div class="ed-signal-detail">${Number.isFinite(avgPrevCompetitorPrice) ? `${formatCurrency(avgPrevCompetitorPrice)} &rarr; ${formatCurrency(avgCompetitorPrice)}` : 'No benchmark'}</div>
            </div>
          </div>
          <div class="ed-signal ${socialSignalClass}">
            <div class="ed-signal-icon"><i class="bi bi-megaphone"></i></div>
            <div class="ed-signal-body">
              <div class="ed-signal-label">Social Buzz</div>
              <div class="ed-signal-value">${signalArrow(socialBuzzChangePct)} ${formatSignedPercentText(socialBuzzChangePct)}</div>
              <div class="ed-signal-detail">${Number.isFinite(avgPrevSocialScore) ? `${avgPrevSocialScore.toFixed(1)} &rarr; ${avgSocialScore.toFixed(1)}` : 'No benchmark'}</div>
            </div>
          </div>
        </div>

        <div class="ed-basis-note">${basisText}</div>
      </div>
    </div>
  `;

  // === BUILD VISUAL BREAKDOWN ===
  const currentRowMap = new Map();
  eventRows.forEach(row => {
    currentRowMap.set(`${normalizeSkuId(row.sku_id)}__${String(row.sales_channel || '').toLowerCase()}`, row);
  });
  const previousRowMap = new Map();
  previousRows.forEach(row => {
    previousRowMap.set(`${normalizeSkuId(row.sku_id)}__${String(row.sales_channel || '').toLowerCase()}`, row);
  });
  const rowKeys = [...new Set([...currentRowMap.keys(), ...previousRowMap.keys()])].sort((a, b) => a.localeCompare(b));
  const allocationDenominator = rowKeys.reduce((sum, key) => {
    const row = currentRowMap.get(key) || previousRowMap.get(key);
    return sum + Math.max(safeNumber(row?.revenue, 0), 1);
  }, 0) || rowKeys.length || 1;

  // Aggregate data by channel and by SKU for charts
  const channelAgg = new Map();
  const skuAgg = new Map();
  const rowData = [];

  rowKeys.forEach(key => {
    const currentRow = currentRowMap.get(key) || null;
    const previousRow = previousRowMap.get(key) || null;
    const baseRow = currentRow || previousRow || {};
    const skuId = normalizeSkuId(baseRow.sku_id);
    const channel = String(baseRow.sales_channel || '').toLowerCase();
    const retailer = CHANNEL_LABELS[channel] || baseRow.sales_channel || 'N/A';
    const currentUnits = safeNumber(currentRow?.units_sold, 0);
    const previousUnits = safeNumber(previousRow?.units_sold, 0);
    const currentRevenue = safeNumber(currentRow?.revenue, 0);
    const previousRevenue = safeNumber(previousRow?.revenue, 0);
    const currentOwn = safeNumber(currentRow?.own_price, null);
    const previousOwn = safeNumber(previousRow?.own_price, null);
    const currentCompetitor = safeNumber(currentRow?.competitor_price, null);
    const previousCompetitor = safeNumber(previousRow?.competitor_price, null);
    const currentSocial = safeNumber(currentRow?.social_buzz_score, null);
    const previousSocial = safeNumber(previousRow?.social_buzz_score, null);
    const unitsDelta = currentUnits - previousUnits;
    const rowRevenueDelta = currentRevenue - previousRevenue;
    const ownDelta = Number.isFinite(currentOwn) && Number.isFinite(previousOwn) ? currentOwn - previousOwn : null;
    const competitorDelta = Number.isFinite(currentCompetitor) && Number.isFinite(previousCompetitor) ? currentCompetitor - previousCompetitor : null;
    const socialDelta = Number.isFinite(currentSocial) && Number.isFinite(previousSocial) ? currentSocial - previousSocial : null;
    const rowSpendShare = totalMarketingSpend > 0 ? (Math.max(currentRevenue || previousRevenue, 1) / allocationDenominator) : null;
    const rowSpend = Number.isFinite(rowSpendShare) ? totalMarketingSpend * rowSpendShare : null;
    const rowRoi = Number.isFinite(rowSpend) && rowSpend > 0 ? rowRevenueDelta / rowSpend : (Number.isFinite(roiValue) ? roiValue : null);
    const impactLabel = describeEventRowImpact(event.event_type, unitsDelta, rowRevenueDelta, ownDelta || 0, competitorDelta || 0, socialDelta || 0);

    const rd = { skuId, retailer, channel, currentUnits, previousUnits, unitsDelta, currentRevenue, previousRevenue, revenueDelta: rowRevenueDelta, currentOwn, previousOwn, currentCompetitor, previousCompetitor, currentSocial, previousSocial, ownDelta, competitorDelta, socialDelta, rowRoi, impactLabel, skuName: baseRow.sku_name || getSkuName(skuId) };
    rowData.push(rd);

    // Channel aggregation
    if (!channelAgg.has(retailer)) channelAgg.set(retailer, { units: 0, prevUnits: 0, revenue: 0, prevRevenue: 0 });
    const ca = channelAgg.get(retailer);
    ca.units += currentUnits; ca.prevUnits += previousUnits;
    ca.revenue += currentRevenue; ca.prevRevenue += previousRevenue;

    // SKU aggregation
    if (!skuAgg.has(skuId)) skuAgg.set(skuId, { skuName: rd.skuName, units: 0, prevUnits: 0, revenue: 0, prevRevenue: 0, channels: new Set(), ownPrices: [], compPrices: [], socialScores: [], prevSocialScores: [] });
    const sa = skuAgg.get(skuId);
    sa.units += currentUnits; sa.prevUnits += previousUnits;
    sa.revenue += currentRevenue; sa.prevRevenue += previousRevenue;
    sa.channels.add(retailer);
    if (Number.isFinite(currentOwn)) sa.ownPrices.push(currentOwn);
    if (Number.isFinite(currentCompetitor)) sa.compPrices.push(currentCompetitor);
    if (Number.isFinite(currentSocial)) sa.socialScores.push(currentSocial);
    if (Number.isFinite(previousSocial)) sa.prevSocialScores.push(previousSocial);
  });

  const chartUid = `ed_${Date.now()}`;
  const hasData = rowKeys.length > 0;

  // --- Channel revenue chart data ---
  const channelNames = [...channelAgg.keys()];
  const channelRevDeltas = channelNames.map(ch => channelAgg.get(ch).revenue - channelAgg.get(ch).prevRevenue);
  const channelBarColors = channelRevDeltas.map(d => d >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)');

  // --- SKU cards ---
  const skuEntries = [...skuAgg.entries()].sort((a, b) => (b[1].revenue - b[1].prevRevenue) - (a[1].revenue - a[1].prevRevenue));
  const maxSkuRevenue = Math.max(...skuEntries.map(([, s]) => Math.max(s.revenue, s.prevRevenue, 1)));

  const skuCardsHtml = skuEntries.map(([skuId, s]) => {
    const revDelta = s.revenue - s.prevRevenue;
    const unitsDelta = s.units - s.prevUnits;
    const revPct = pctChange(s.revenue, s.prevRevenue);
    const unitsPct = pctChange(s.units, s.prevUnits);
    const avgOwn = s.ownPrices.length ? s.ownPrices.reduce((a, b) => a + b, 0) / s.ownPrices.length : null;
    const avgComp = s.compPrices.length ? s.compPrices.reduce((a, b) => a + b, 0) / s.compPrices.length : null;
    const avgSocial = s.socialScores.length ? s.socialScores.reduce((a, b) => a + b, 0) / s.socialScores.length : null;
    const avgPrevSocial = s.prevSocialScores.length ? s.prevSocialScores.reduce((a, b) => a + b, 0) / s.prevSocialScores.length : null;
    const socialPct = pctChange(avgSocial, avgPrevSocial);
    const priceGap = Number.isFinite(avgOwn) && Number.isFinite(avgComp) ? avgOwn - avgComp : null;
    const barWidthPrev = Math.round((s.prevRevenue / maxSkuRevenue) * 100);
    const barWidthCurr = Math.round((s.revenue / maxSkuRevenue) * 100);
    const revColor = revDelta >= 0 ? 'ed-signal-up' : 'ed-signal-down';
    const unitsColor = unitsDelta >= 0 ? 'ed-signal-up' : 'ed-signal-down';

    return `
      <div class="ed-sku-card">
        <div class="ed-sku-card-header">
          <div>
            <div class="ed-sku-card-name">${s.skuName}</div>
            <div class="ed-sku-card-code">${skuId} &middot; ${[...s.channels].join(', ')}</div>
          </div>
          <div class="ed-sku-card-verdict ${revColor}">${formatSignedCurrency(revDelta)}</div>
        </div>
        <div class="ed-sku-card-bars">
          <div class="ed-sku-bar-row">
            <span class="ed-sku-bar-label">Baseline</span>
            <div class="ed-sku-bar-track">
              <div class="ed-sku-bar-fill ed-sku-bar-baseline" style="width: ${barWidthPrev}%;"></div>
            </div>
            <span class="ed-sku-bar-value">${formatCurrency(s.prevRevenue)}</span>
          </div>
          <div class="ed-sku-bar-row">
            <span class="ed-sku-bar-label">Event Wk</span>
            <div class="ed-sku-bar-track">
              <div class="ed-sku-bar-fill ${revDelta >= 0 ? 'ed-sku-bar-up' : 'ed-sku-bar-down'}" style="width: ${barWidthCurr}%;"></div>
            </div>
            <span class="ed-sku-bar-value">${formatCurrency(s.revenue)}</span>
          </div>
        </div>
        <div class="ed-sku-card-metrics">
          <div class="ed-sku-metric">
            <div class="ed-sku-metric-label">Units</div>
            <div class="ed-sku-metric-value ${unitsColor}">${unitsDelta >= 0 ? '+' : ''}${formatNumber(Math.round(unitsDelta))}</div>
            <div class="ed-sku-metric-sub">${formatSignedPercentText(unitsPct)}</div>
          </div>
          <div class="ed-sku-metric">
            <div class="ed-sku-metric-label">Our Price</div>
            <div class="ed-sku-metric-value">${Number.isFinite(avgOwn) ? formatCurrency(avgOwn) : 'N/A'}</div>
            <div class="ed-sku-metric-sub">${Number.isFinite(priceGap) ? `Gap ${formatSignedCurrency(priceGap)}` : ''}</div>
          </div>
          <div class="ed-sku-metric">
            <div class="ed-sku-metric-label">Comp Price</div>
            <div class="ed-sku-metric-value">${Number.isFinite(avgComp) ? formatCurrency(avgComp) : 'N/A'}</div>
            <div class="ed-sku-metric-sub">&nbsp;</div>
          </div>
          <div class="ed-sku-metric">
            <div class="ed-sku-metric-label">Social</div>
            <div class="ed-sku-metric-value ${signalColorClass(socialPct)}">${formatSignedPercentText(socialPct)}</div>
            <div class="ed-sku-metric-sub">${Number.isFinite(avgSocial) ? avgSocial.toFixed(1) : 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // --- Price positioning: compact dumbbell by SKU ---
  const priceByProduct = new Map();
  rowData.forEach(rd => {
    if (!Number.isFinite(rd.currentOwn) && !Number.isFinite(rd.currentCompetitor)) return;
    const key = rd.skuId;
    if (!priceByProduct.has(key)) priceByProduct.set(key, { name: rd.skuName, ownPrices: [], compPrices: [], channels: [] });
    const pb = priceByProduct.get(key);
    if (Number.isFinite(rd.currentOwn)) pb.ownPrices.push(rd.currentOwn);
    if (Number.isFinite(rd.currentCompetitor)) pb.compPrices.push(rd.currentCompetitor);
    pb.channels.push(rd.retailer);
  });

  let pricePositionHtml = '';
  if (priceByProduct.size) {
    const allPrices = [...priceByProduct.values()].flatMap(p => [...p.ownPrices, ...p.compPrices]).filter(Number.isFinite);
    const scaleMin = Math.floor(Math.min(...allPrices) * 0.92);
    const scaleMax = Math.ceil(Math.max(...allPrices) * 1.04);
    const range = scaleMax - scaleMin || 1;
    const toPct = v => ((v - scaleMin) / range) * 100;

    const rowsHtml = [...priceByProduct.entries()].map(([, p]) => {
      const avgOwn = p.ownPrices.reduce((s, v) => s + v, 0) / p.ownPrices.length;
      const avgComp = p.compPrices.length ? p.compPrices.reduce((s, v) => s + v, 0) / p.compPrices.length : null;
      const gapPct = avgComp ? ((avgOwn - avgComp) / avgComp * 100) : null;
      const gapClass = gapPct !== null ? (gapPct <= -1 ? 'ed-gap-below' : gapPct >= 1 ? 'ed-gap-above' : 'ed-gap-parity') : '';
      const gapLabel = gapPct !== null ? `${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%` : '';
      const ownPct = toPct(avgOwn);
      const compPct = avgComp !== null ? toPct(avgComp) : null;
      const leftPct = compPct !== null ? Math.min(ownPct, compPct) : ownPct;
      const rightPct = compPct !== null ? Math.max(ownPct, compPct) : ownPct;
      const connWidth = rightPct - leftPct;

      return `
        <div class="ed-dumbbell-row">
          <div class="ed-dumbbell-label">${p.name.split(' ').slice(0, 3).join(' ')}</div>
          <div class="ed-dumbbell-track">
            ${connWidth > 0.5 ? `<div class="ed-dumbbell-connector ${gapClass}" style="left: ${leftPct}%; width: ${connWidth}%;"></div>` : ''}
            <div class="ed-dumbbell-dot ed-dumbbell-ours" style="left: ${ownPct}%;" title="Our avg: ${formatCurrency(avgOwn)}"></div>
            ${compPct !== null ? `<div class="ed-dumbbell-dot ed-dumbbell-comp" style="left: ${compPct}%;" title="Competitor avg: ${formatCurrency(avgComp)}"></div>` : ''}
          </div>
          <div class="ed-dumbbell-values">
            <span class="ed-dumbbell-price">${formatCurrency(avgOwn)}</span>
            ${gapLabel ? `<span class="ed-dumbbell-gap ${gapClass}">${gapLabel}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    pricePositionHtml = `
      <div class="ed-price-position">
        <div class="ed-price-position-header">
          <span class="ed-chart-panel-title">Price Positioning vs Competitor</span>
          <div class="ed-dumbbell-legend">
            <span><span class="ed-legend-dot ed-dumbbell-ours"></span>Ours</span>
            <span><span class="ed-legend-dot ed-dumbbell-comp"></span>Competitor</span>
          </div>
        </div>
        <div class="ed-price-position-scale">
          <span>$${scaleMin}</span><span>$${Math.round((scaleMin + scaleMax) / 2)}</span><span>$${scaleMax}</span>
        </div>
        ${rowsHtml}
      </div>`;
  }

  const impactSummaryTableHtml = `
    <div class="ed-table-section">
      <div class="ed-table-header">
        <div>
          <div class="ed-table-title">Event Impact Summary</div>
          <div class="ed-table-subtitle">Business context for the selected event</div>
        </div>
        <div class="ed-table-basis">${basisText}</div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Measure</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="fw-semibold">Event Type</td>
              <td>${badge.text}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Status</td>
              <td>${statusMeta.label}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Event Window</td>
              <td>${eventPeriodText}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Channels Affected</td>
              <td>${summaryChannels}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Products Affected</td>
              <td>${productBadgesHtml || summaryProducts}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Discount Given</td>
              <td>${discountLabel}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Units Sold</td>
              <td>${formatNumber(Math.round(eventSalesUnits))} units</td>
            </tr>
            <tr>
              <td class="fw-semibold">ROI</td>
              <td>${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x` : 'N/A'}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Revenue Impact</td>
              <td class="${revenueImpactClass}">${formatSignedCurrency(incrementalRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const metricChangeTableHtml = `
    <div class="ed-table-section">
      <div class="ed-table-header">
        <div>
          <div class="ed-table-title">Metric Change vs Baseline</div>
          <div class="ed-table-subtitle">Three key levers and commercial outcome vs previous comparable week</div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Metric</th>
              <th>Change</th>
              <th>Baseline</th>
              <th>Event Week</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="fw-semibold">Our Price</td>
              <td>${formatSignedPercentText(ownPriceChangePct)}</td>
              <td>${Number.isFinite(avgPrevOwnPrice) ? formatCurrency(avgPrevOwnPrice) : 'N/A'}</td>
              <td>${Number.isFinite(avgOwnPrice) ? formatCurrency(avgOwnPrice) : 'N/A'}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Competitor Price</td>
              <td>${formatSignedPercentText(competitorPriceChangePct)}</td>
              <td>${Number.isFinite(avgPrevCompetitorPrice) ? formatCurrency(avgPrevCompetitorPrice) : 'N/A'}</td>
              <td>${Number.isFinite(avgCompetitorPrice) ? formatCurrency(avgCompetitorPrice) : 'N/A'}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Social Buzz</td>
              <td>${formatSignedPercentText(socialBuzzChangePct)}</td>
              <td>${Number.isFinite(avgPrevSocialScore) ? avgPrevSocialScore.toFixed(1) : 'N/A'}</td>
              <td>${Number.isFinite(avgSocialScore) ? avgSocialScore.toFixed(1) : 'N/A'}</td>
            </tr>
            <tr>
              <td class="fw-semibold">Baseline Sales</td>
              <td>-</td>
              <td>${formatNumber(Math.round(baselineSalesUnits))} units</td>
              <td>${formatNumber(Math.round(baselineSalesUnits))} units</td>
            </tr>
            <tr>
              <td class="fw-semibold">Additional Sales</td>
              <td>${incrementalSalesUnits >= 0 ? '+' : ''}${formatNumber(Math.round(incrementalSalesUnits))} units</td>
              <td>0 units</td>
              <td>${incrementalSalesUnits >= 0 ? '+' : ''}${formatNumber(Math.round(incrementalSalesUnits))} units</td>
            </tr>
            <tr>
              <td class="fw-semibold">Total Sales</td>
              <td>${formatSignedPercentText(pctChange(eventSalesUnits, baselineSalesUnits))}</td>
              <td>${formatNumber(Math.round(baselineSalesUnits))} units</td>
              <td>${formatNumber(Math.round(eventSalesUnits))} units</td>
            </tr>
            <tr>
              <td class="fw-semibold">Sales Revenue</td>
              <td>${formatSignedCurrency(revenueDelta)}</td>
              <td>${formatCurrency(baselineRevenue)}</td>
              <td>${formatCurrency(eventRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const eventDetailRowsHtml = rowData.length
    ? rowData.map(row => `
      <tr>
        <td class="fw-semibold">${row.skuName}</td>
        <td>${row.retailer}</td>
        <td><code class="small">${row.skuId}</code></td>
        <td>${formatCurrencyOrNA(row.currentOwn)}</td>
        <td>${formatCurrencyOrNA(row.currentCompetitor)}</td>
        <td>${formatCurrencyOrNA(row.previousOwn)}</td>
        <td>${formatCurrencyOrNA(row.previousCompetitor)}</td>
        <td>${Number.isFinite(row.currentSocial) ? row.currentSocial.toFixed(1) : 'N/A'}</td>
        <td>${row.impactLabel}</td>
        <td>${formatNumber(Math.round(row.previousUnits))} units</td>
        <td>${row.unitsDelta >= 0 ? '+' : ''}${formatNumber(Math.round(row.unitsDelta))} units</td>
        <td>${formatNumber(Math.round(row.currentUnits))} units</td>
        <td class="${row.revenueDelta >= 0 ? 'text-success' : 'text-danger'}">${formatSignedCurrency(row.revenueDelta)}</td>
        <td>${Number.isFinite(row.rowRoi) ? `${row.rowRoi.toFixed(2)}x` : 'N/A'}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="14" class="text-center text-muted py-4">No comparable product-channel data found for this event week.</td></tr>';

  const eventDetailTableSectionHtml = `
    <div class="ed-table-section">
      <div class="ed-table-header">
        <div>
          <div class="ed-table-title">Event Detail Table</div>
          <div class="ed-table-subtitle">Product x retailer x SKU readout for what changed during the event</div>
        </div>
      </div>
      <div class="table-responsive event-details-table">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Product</th>
              <th>Retailer</th>
              <th>SKU</th>
              <th>Our Price This Week</th>
              <th>Competitor Price This Week</th>
              <th>Our Price Last Week</th>
              <th>Competitor Price Last Week</th>
              <th>Social Buzz</th>
              <th>Impact of Event</th>
              <th>Baseline Sales</th>
              <th>Additional Sales</th>
              <th>Total Sales</th>
              <th>Revenue Impact</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>${eventDetailRowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  const eventTablesHtml = `
    <div class="ed-summary-tables-grid">
      ${impactSummaryTableHtml}
      ${metricChangeTableHtml}
    </div>
    ${eventDetailTableSectionHtml}
  `;

  const breakdownHtml = hasData ? `
    <div class="ed-breakdown">
      <div class="ed-breakdown-header">
        <div class="ed-breakdown-title"><i class="bi bi-bar-chart-line me-2"></i>Event Impact Breakdown</div>
        <div class="ed-table-basis">${basisText}</div>
      </div>

      <!-- Row 1: Channel Revenue Lift + Price Positioning -->
      <div class="ed-charts-row">
        <div class="ed-chart-panel">
          <div class="ed-chart-panel-title">Revenue Lift by Channel</div>
          <div class="ed-chart-panel-subtitle">Incremental revenue vs prior week</div>
          <div class="ed-chart-wrap" style="height: ${Math.max(160, channelNames.length * 48)}px;">
            <canvas id="${chartUid}_channel_rev"></canvas>
          </div>
        </div>
        <div class="ed-chart-panel">
          ${pricePositionHtml || '<div class="text-center text-muted py-4">No price data available</div>'}
        </div>
      </div>

      <!-- Row 2: SKU Performance Cards -->
      <div class="ed-sku-section">
        <div class="ed-chart-panel-title">Product Performance</div>
        <div class="ed-chart-panel-subtitle">Revenue and unit change per SKU with competitive and social context</div>
        <div class="ed-sku-grid">${skuCardsHtml}</div>
      </div>
    </div>
  ` : `
    <div class="ed-breakdown">
      <div class="ed-breakdown-header">
        <div class="ed-breakdown-title"><i class="bi bi-bar-chart-line me-2"></i>Event Impact Breakdown</div>
      </div>
      <div class="text-center py-5 text-muted">
        <i class="bi bi-inbox display-4 mb-3 d-block opacity-50"></i>
        <div>No comparable product-channel data found for this event week.</div>
      </div>
    </div>
  `;

  const html = `${eventCardHtml}${eventTablesHtml}${breakdownHtml}`;

  // --- Chart rendering helper (called after DOM insert) ---
  const renderBreakdownCharts = () => {
    if (!hasData) return;
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
    const textColor = isDark ? 'rgba(226,232,240,0.75)' : '#64748b';

    // --- Channel Revenue Lift (horizontal bar) ---
    const channelCtx = document.getElementById(`${chartUid}_channel_rev`);
    if (channelCtx) {
      new Chart(channelCtx, {
        type: 'bar',
        data: {
          labels: channelNames,
          datasets: [{
            data: channelRevDeltas,
            backgroundColor: channelBarColors,
            borderRadius: 6,
            barThickness: 28,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const val = ctx.raw;
                  return `${val >= 0 ? '+' : ''}${formatCurrency(val)}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11, weight: '600' },
                callback: val => `${val >= 0 ? '+' : ''}$${Math.round(val).toLocaleString()}`
              }
            },
            y: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 12, weight: '600' } }
            }
          }
        }
      });
    }

    // Price Positioning is now rendered as inline HTML dumbbell chart (no Chart.js needed)
  };

  detailsPanel.innerHTML = html;
  detailsPanel.style.display = 'block';

  // Render Chart.js charts after DOM is ready
  requestAnimationFrame(() => {
    renderBreakdownCharts();
    detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
    window.onEventCalendarEventSelected(event);
  }
}

/**
 * Render event table
 */
function renderEventTable() {
  const tbody = document.getElementById('event-table-body');
  if (!tbody) return;

  const filteredEvents = filterEvents();

  if (!filteredEvents || filteredEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No events match the current filters</td></tr>';
    return;
  }

  let html = '';
  filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(event => {
    const date = new Date(event.date);
    const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const badge = getEventBadge(event.event_type);
    const priceChange = event.price_before && event.price_after && event.price_before !== event.price_after
      ? `${formatCurrency(event.price_before)} -> ${formatCurrency(event.price_after)}`
      : '-';
    const promo = event.promo_discount_pct > 0
      ? `${event.promo_discount_pct}% off`
      : '-';

    // Product info column
    const productInfo = getEventProductInfo(event);
    let productCell = '-';
    if (productInfo.skus.length > 0) {
      productCell = productInfo.skus
        .map(s => `<span class="badge bg-light text-dark border me-1 mb-1">${s.sku_name}</span>`)
        .join('');
    } else if (productInfo.productGroup) {
      productCell = `<span class="badge bg-light text-dark border">${productInfo.productGroup}</span>`;
    }

    html += `
      <tr>
        <td class="text-nowrap">${dateStr}</td>
        <td><span class="badge ${badge.class}">${badge.text}</span></td>
        <td>${productCell}</td>
        <td>${formatTier(event.tier)}</td>
        <td class="text-nowrap">${priceChange}</td>
        <td>${promo}</td>
        <td class="small">${event.notes || '-'}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Render promo campaign performance cards
 */
function renderPromoCards() {
  const container = document.getElementById('promo-cards-container');
  const summaryEl = document.getElementById('promo-campaign-summary');
  if (!container) return;

  const promos = getFilteredPromos();

  if (!promos || promos.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted">No promo campaigns match the selected filters.</div>';
    if (summaryEl) summaryEl.textContent = 'No campaigns for the selected season/channel filters.';
    renderPromoDrilldown(null);
    renderPromoOutcomeMatrix([]);
    renderPromoPolicyExtractor([]);
    renderPromoStoryVisuals([]);
    return;
  }

  const filteredSkuRows = promos.flatMap(promo => Array.isArray(promo.sku_results) ? promo.sku_results : []);
  const filteredAvgUplift = filteredSkuRows.length
    ? filteredSkuRows.reduce((sum, row) => sum + Number(row.sales_uplift_pct || 0), 0) / filteredSkuRows.length
    : 0;
  const filteredDownCount = filteredSkuRows.filter(row => Number(row.sales_uplift_pct || 0) < 0 || row.outcome === 'down').length;
  const phaseCounts = promos.reduce((acc, promo) => {
    const key = String(promo.story_phase || '').toLowerCase();
    if (key === 'baseline') acc.baseline += 1;
    else if (key === 'pivot') acc.pivot += 1;
    else if (key === 'future') acc.future += 1;
    return acc;
  }, { baseline: 0, pivot: 0, future: 0 });
  if (summaryEl) {
    summaryEl.textContent =
      `Showing ${promos.length} campaigns. Story flow: ${phaseCounts.baseline} historical baselines, ${phaseCounts.pivot} in-season pivots, ${phaseCounts.future} end-of-season plans. SKU outcomes: ${filteredSkuRows.length}, average uplift ${filteredAvgUplift >= 0 ? '+' : ''}${filteredAvgUplift.toFixed(1)}%, down outcomes ${filteredDownCount}.`;
  }

  let html = '';
  promos.forEach(promo => {
    const isPlannedPromo = String(promo.story_phase || '').toLowerCase() === 'future';
    const status = isPlannedPromo ? 'Planned' : (promo.actual_adds ? 'Complete' : 'In Progress');
    const statusClass = isPlannedPromo ? 'bg-secondary-subtle text-secondary-emphasis' : (promo.actual_adds ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis');
    // Calculate as decimal, formatPercent will multiply by 100
    const attainment = promo.actual_adds ?
      formatPercent(promo.actual_adds / promo.target_adds) : 'TBD';
    const roi = promo.actual_roi ? `${promo.actual_roi}x` : 'TBD';
    const channels = (promo.eligible_channels || []).filter(c => RETAIL_CHANNELS.includes(String(c).toLowerCase()));
    const channelLine = channels.length ? channels.map(c => CHANNEL_LABELS[c] || c).join(', ') : '';
    const promotedSkus = Array.isArray(promo.promoted_skus) ? promo.promoted_skus : [];
    const promotedSkuBadges = promotedSkus.length
      ? promotedSkus.map(skuId => `<span class="badge bg-light text-dark border me-1 mb-1">${formatSkuDisplay(skuId, null, false)}</span>`).join('')
      : '';
    const skuResults = Array.isArray(promo.sku_results) ? promo.sku_results : [];
    const skuUpCount = skuResults.filter(s => s.outcome === 'up').length;
    const skuDownCount = skuResults.filter(s => s.outcome === 'down').length;
    const downBadge = skuDownCount > 0
      ? `<span class="badge bg-danger-subtle text-danger ms-1">${skuDownCount} down</span>`
      : '<span class="badge bg-success-subtle text-success ms-1">No down SKUs</span>';
    const storyPhase = STORY_PHASE_LABELS[promo.story_phase] || 'Campaign';
    const storySummary = promo.story_summary || promo.notes || '';
    const performanceUnitsLabel = isPlannedPromo ? 'Modeled Units' : 'Actual Units';
    const performanceRoiLabel = isPlannedPromo ? 'Modeled ROI' : 'ROI';
    const revenueImpactLabel = Number.isFinite(Number(promo.incremental_revenue_usd))
      ? formatSignedCurrency(Number(promo.incremental_revenue_usd))
      : 'N/A';
    const repeatLossLabel = promo.repeat_loss_expected ? `Risk at ${promo.repeat_loss_lag_weeks || '-'}w` : 'No repeat-loss flag';
    const seasonLabel = promo.season ? formatSeasonLabel(promo.season) : 'Season n/a';

    html += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card h-100 promo-story-card border-0 shadow-sm">
          <div class="card-body d-flex flex-column">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge ${statusClass}">${status}</span>
              <span class="badge bg-primary-subtle text-primary">${storyPhase}</span>
              <span class="badge bg-light text-dark border">${seasonLabel}</span>
            </div>
            <h6 class="mb-1">${promo.campaign_name}</h6>
            <div class="small text-muted mb-3">${storySummary || 'No narrative provided.'}</div>

            <div class="promo-story-metrics mb-3">
              <div class="promo-story-metric">
                <div class="label">Window</div>
                <div class="value">${formatDate(promo.start_date)} - ${formatDate(promo.end_date)}</div>
                <div class="subvalue">${promo.duration_weeks}w</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">Channels</div>
                <div class="value">${channelLine || 'Not specified'}</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">Discount</div>
                <div class="value">${promo.discount_pct}% off</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">Target Units</div>
                <div class="value">${formatNumber(promo.target_adds)}</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">${performanceUnitsLabel}</div>
                <div class="value">${promo.actual_adds ? formatNumber(promo.actual_adds) : 'TBD'}</div>
                <div class="subvalue">${promo.actual_adds ? `${attainment} of target` : 'Awaiting outcome'}</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">${performanceRoiLabel}</div>
                <div class="value">${roi}</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">Revenue Impact</div>
                <div class="value ${Number(promo.incremental_revenue_usd || 0) >= 0 ? 'text-success' : 'text-danger'}">${revenueImpactLabel}</div>
              </div>
              <div class="promo-story-metric">
                <div class="label">Roll-off / Repeat</div>
                <div class="value">${formatDate(promo.roll_off_date)}</div>
                <div class="subvalue">${repeatLossLabel}</div>
              </div>
            </div>

            <div class="promo-story-narrative mb-3">
              <div class="fw-semibold small mb-1">${isPlannedPromo ? 'What this plan is expected to do' : 'What happened during this campaign'}</div>
              <div class="small">
                ${storySummary || 'No narrative provided.'}
              </div>
            </div>

            ${promotedSkus.length ? `<div class="mb-3"><div class="small text-muted text-uppercase mb-1">Promoted Products</div><div>${promotedSkuBadges}</div></div>` : ''}

            <div class="mt-auto small">
              ${skuResults.length ? `<div class="mb-2"><strong>SKU Outcomes:</strong> ${skuUpCount} up, ${skuDownCount} down ${downBadge}</div>` : ''}
              <div class="mb-2">
                <strong class="text-body-secondary">Tags:</strong>
                <span class="ms-1">
                  ${(promo.campaign_tags || [])
                    .map(tag => `<span class="badge bg-primary bg-opacity-90 text-white me-1">${tag}</span>`)
                    .join(' ')}
                </span>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-primary promo-drilldown-btn" data-promo-id="${promo.promo_id}" type="button">
                  Open Campaign Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.promo-drilldown-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderPromoDrilldown(btn.dataset.promoId);
    });
  });

  const visiblePromoIds = promos.map(p => p.promo_id);
  if (!selectedPromoId || !visiblePromoIds.includes(selectedPromoId)) {
    selectedPromoId = promos[0].promo_id;
  }
  renderPromoDrilldown(selectedPromoId);
  renderPromoOutcomeMatrix(promos);
  renderPromoPolicyExtractor(promos);
  renderPromoStoryVisuals(promos);
}

function renderPromoStoryVisuals(promos) {
  const phaseCanvas = document.getElementById('promo-story-phase-chart');
  const channelCanvas = document.getElementById('promo-channel-impact-chart');
  const noteEl = document.getElementById('promo-story-visual-note');
  if (!phaseCanvas || !channelCanvas || !noteEl) return;

  const campaignList = Array.isArray(promos) ? promos : [];
  if (!campaignList.length) {
    if (promoStoryPhaseChart) {
      promoStoryPhaseChart.destroy();
      promoStoryPhaseChart = null;
    }
    if (promoChannelLiftChart) {
      promoChannelLiftChart.destroy();
      promoChannelLiftChart = null;
    }
    noteEl.textContent = 'No campaigns in current filter selection to render story visuals.';
    return;
  }

  const phaseKeys = ['baseline', 'pivot', 'future'];
  const phaseLabels = ['Historical Baseline', 'In-Season Pivot', 'End-of-Season Plan'];
  const phaseData = phaseKeys.map(key =>
    campaignList.filter(p => String(p.story_phase || '').toLowerCase() === key).length
  );

  if (promoStoryPhaseChart) {
    promoStoryPhaseChart.data.labels = phaseLabels;
    promoStoryPhaseChart.data.datasets[0].data = phaseData;
    promoStoryPhaseChart.update();
  } else if (window.Chart) {
    promoStoryPhaseChart = new Chart(phaseCanvas, {
      type: 'doughnut',
      data: {
        labels: phaseLabels,
        datasets: [
          {
            data: phaseData,
            backgroundColor: [
              'rgba(14, 165, 233, 0.85)',
              'rgba(245, 158, 11, 0.88)',
              'rgba(34, 197, 94, 0.88)'
            ],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  const channelOrder = ['target', 'amazon', 'sephora', 'ulta'];
  const channelLabels = channelOrder.map(c => CHANNEL_LABELS[c] || c);
  const channelAgg = new Map(channelOrder.map(c => [c, { sum: 0, count: 0 }]));
  campaignList.forEach(promo => {
    (promo.sku_results || []).forEach(row => {
      const channel = String(row.channel || '').toLowerCase();
      if (!channelAgg.has(channel)) return;
      const metric = channelAgg.get(channel);
      metric.sum += Number(row.sales_uplift_pct || 0);
      metric.count += 1;
    });
  });
  const channelData = channelOrder.map(channel => {
    const metric = channelAgg.get(channel);
    return metric.count > 0 ? (metric.sum / metric.count) : 0;
  });

  if (promoChannelLiftChart) {
    promoChannelLiftChart.data.labels = channelLabels;
    promoChannelLiftChart.data.datasets[0].data = channelData;
    promoChannelLiftChart.update();
  } else if (window.Chart) {
    promoChannelLiftChart = new Chart(channelCanvas, {
      type: 'bar',
      data: {
        labels: channelLabels,
        datasets: [
          {
            label: 'Avg sales uplift %',
            data: channelData,
            backgroundColor: channelData.map(value =>
              value >= 0 ? 'rgba(22, 163, 74, 0.85)' : 'rgba(220, 38, 38, 0.85)'
            )
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      }
    });
  }

  const bestChannelIdx = channelData.reduce((bestIdx, value, idx, arr) =>
    value > arr[bestIdx] ? idx : bestIdx, 0
  );
  const avgUplift = channelData.length
    ? channelData.reduce((sum, value) => sum + value, 0) / channelData.length
    : 0;
  noteEl.textContent =
    `Story mix in current filters: ${phaseData[0]} historical baseline, ${phaseData[1]} in-season pivot, ${phaseData[2]} end-of-season plans. ` +
    `Best channel response is ${channelLabels[bestChannelIdx]} (${channelData[bestChannelIdx] >= 0 ? '+' : ''}${channelData[bestChannelIdx].toFixed(1)}% avg uplift). ` +
    `Portfolio average: ${avgUplift >= 0 ? '+' : ''}${avgUplift.toFixed(1)}%.`;
}

function updatePromoDrilldownButtonState(activePromoId) {
  document.querySelectorAll('.promo-drilldown-btn').forEach(btn => {
    const isActive = String(btn.dataset.promoId) === String(activePromoId);
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline-primary', !isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.innerHTML = isActive
      ? '<i class="bi bi-check-circle me-1"></i>Showing Campaign Detail'
      : 'Open Campaign Detail';
  });
}

function renderPromoOutcomeMatrix(promos) {
  const summaryEl = document.getElementById('promo-outcome-summary');
  const tbody = document.getElementById('promo-outcome-matrix-body');
  if (!summaryEl || !tbody) return;

  const campaignList = Array.isArray(promos) ? promos : [];
  const channels = ['target', 'amazon', 'sephora', 'ulta'];
  const bySku = new Map();

  campaignList.forEach(promo => {
    (promo.sku_results || []).forEach(row => {
      const skuId = normalizeSkuId(row.sku_id);
      const skuInfo = skuCatalog.get(skuId);
      const skuName = getSkuName(skuId, row.sku_name);
      const productGroup = String(skuInfo?.product_group || row.product_group || '').toLowerCase();
      const channel = String(row.channel || '').toLowerCase();
      if (!channels.includes(channel)) return;

      if (!bySku.has(skuId)) {
        bySku.set(skuId, {
          sku_id: skuId,
          sku_name: skuName,
          product_group: productGroup,
          channels: {}
        });
      }
      const entry = bySku.get(skuId);
      if (!entry.channels[channel]) {
        entry.channels[channel] = { sum: 0, count: 0 };
      }
      const uplift = Number(row.sales_uplift_pct || 0);
      entry.channels[channel].sum += uplift;
      entry.channels[channel].count += 1;
    });
  });

  const rows = [...bySku.values()].sort((a, b) => {
    const groupCmp = String(a.product_group).localeCompare(String(b.product_group));
    if (groupCmp !== 0) return groupCmp;
    return String(a.sku_name).localeCompare(String(b.sku_name));
  });

  if (!rows.length) {
    summaryEl.textContent = 'No SKU-by-channel outcomes available for current filters.';
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No matrix rows.</td></tr>';
    return;
  }

  const allAverages = [];
  rows.forEach(row => {
    channels.forEach(channel => {
      const cell = row.channels[channel];
      if (!cell || !cell.count) return;
      allAverages.push(cell.sum / cell.count);
    });
  });
  const strongPositive = allAverages.filter(v => v >= 8).length;
  const negativeCells = allAverages.filter(v => v < 0).length;
  summaryEl.textContent =
    `Matrix built from ${campaignList.length} campaigns: ${allAverages.length} product-channel cells, ${strongPositive} strong positive cells (>= +8%), ${negativeCells} negative cells.`;

  const groupLabel = (group) => {
    if (!group) return '-';
    return group.charAt(0).toUpperCase() + group.slice(1);
  };

  const renderCell = (stats) => {
    if (!stats || !stats.count) {
      return '<td class="text-end text-muted">--</td>';
    }
    const avg = stats.sum / stats.count;
    const intensity = Math.min(0.55, 0.14 + (Math.abs(avg) / 18) * 0.41);
    const color = avg >= 0
      ? `rgba(22, 163, 74, ${intensity.toFixed(3)})`
      : `rgba(220, 38, 38, ${intensity.toFixed(3)})`;
    return `
      <td class="text-end fw-semibold" style="background: ${color};" title="${stats.count} campaign outcomes">
        ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%
      </td>
    `;
  };

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${row.sku_name}</td>
      <td>${groupLabel(row.product_group)}</td>
      ${channels.map(channel => renderCell(row.channels[channel])).join('')}
    </tr>
  `).join('');
}

function renderPromoPolicyExtractor(promos) {
  const summaryEl = document.getElementById('promo-policy-summary');
  const tbody = document.getElementById('promo-policy-table-body');
  if (!summaryEl || !tbody) return;

  const campaignList = Array.isArray(promos) ? promos : [];
  const skuStats = new Map();

  campaignList.forEach(promo => {
    (promo.sku_results || []).forEach(row => {
      const skuId = normalizeSkuId(row.sku_id);
      if (!skuStats.has(skuId)) {
        skuStats.set(skuId, {
          sku_id: skuId,
          sku_name: getSkuName(skuId, row.sku_name),
          campaigns: 0,
          up: 0,
          down: 0,
          upliftSum: 0,
          channelUplift: {}
        });
      }
      const entry = skuStats.get(skuId);
      const uplift = Number(row.sales_uplift_pct || 0);
      const channel = String(row.channel || '').toLowerCase();
      entry.campaigns += 1;
      entry.upliftSum += uplift;
      if (uplift >= 0 || row.outcome === 'up') entry.up += 1;
      if (uplift < 0 || row.outcome === 'down') entry.down += 1;
      if (!entry.channelUplift[channel]) entry.channelUplift[channel] = [];
      entry.channelUplift[channel].push(uplift);
    });
  });

  const policies = [...skuStats.values()].map(entry => {
    const avgUplift = entry.campaigns > 0 ? entry.upliftSum / entry.campaigns : 0;
    const downRate = entry.campaigns > 0 ? entry.down / entry.campaigns : 0;
    const channelAverages = Object.entries(entry.channelUplift).map(([channel, vals]) => ({
      channel,
      avg: vals.reduce((sum, v) => sum + v, 0) / vals.length
    })).sort((a, b) => b.avg - a.avg);
    const bestChannel = channelAverages[0]?.channel || '-';
    const bestChannelLabel = CHANNEL_LABELS[bestChannel] || bestChannel || '-';

    let policy = 'Test Selective Promo';
    let policyClass = 'bg-info-subtle text-info';
    if (entry.down >= 2 || downRate >= 0.5) {
      policy = 'Avoid Broad Promo';
      policyClass = 'bg-danger-subtle text-danger';
    } else if (entry.up >= 2 && avgUplift >= 8) {
      policy = 'Scale in Responsive Channels';
      policyClass = 'bg-success-subtle text-success';
    } else if (entry.up > entry.down && avgUplift > 2) {
      policy = 'Selective Include';
      policyClass = 'bg-primary-subtle text-primary';
    }

    return {
      ...entry,
      avgUplift,
      bestChannelLabel,
      policy,
      policyClass
    };
  }).sort((a, b) => b.avgUplift - a.avgUplift);

  if (!policies.length) {
    summaryEl.textContent = 'No SKU outcome history available for policy extraction in current filter.';
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No policy rows.</td></tr>';
    return;
  }

  const avoidCount = policies.filter(p => p.policy === 'Avoid Broad Promo').length;
  const scaleCount = policies.filter(p => p.policy === 'Scale in Responsive Channels').length;
  summaryEl.textContent =
    `Policy extraction from ${campaignList.length} campaigns: ${scaleCount} SKUs to scale, ${avoidCount} SKUs to avoid in broad promos.`;

  tbody.innerHTML = policies.map(row => `
    <tr>
      <td>${row.sku_name}</td>
      <td class="text-end">${formatNumber(row.campaigns, 0)}</td>
      <td class="text-end ${row.avgUplift >= 0 ? 'text-success' : 'text-danger'}">${row.avgUplift >= 0 ? '+' : ''}${row.avgUplift.toFixed(1)}%</td>
      <td>${row.bestChannelLabel}</td>
      <td><span class="badge ${row.policyClass}">${row.policy}</span></td>
    </tr>
  `).join('');
}

function renderPromoDrilldown(promoId) {
  const panel = document.getElementById('promo-drilldown-panel');
  if (!panel) return;

  if (!promoId) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    updatePromoDrilldownButtonState(null);
    return;
  }

  const promo = promoMetadata ? promoMetadata[promoId] : null;
  if (!promo) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    updatePromoDrilldownButtonState(null);
    return;
  }

  selectedPromoId = promoId;
  updatePromoDrilldownButtonState(promoId);
  window.dispatchEvent(new CustomEvent('promo:drilldown-selected', {
    detail: {
      promoId,
      campaignName: promo.campaign_name,
      promotedSkus: promo.promoted_skus || [],
      channels: promo.eligible_channels || []
    }
  }));

  const skuResults = Array.isArray(promo.sku_results) ? promo.sku_results : [];
  const channelResults = promo.channel_results || {};
  const underperformers = skuResults.filter(s => s.outcome === 'down' || Number(s.sales_uplift_pct) < 0);
  const performers = skuResults.filter(s => s.outcome === 'up' || Number(s.sales_uplift_pct) > 0);
  const isPlannedPromo = String(promo.story_phase || '').toLowerCase() === 'future';
  const status = isPlannedPromo ? 'Planned' : (promo.actual_adds ? 'Complete' : 'In Progress');
  const statusClass = isPlannedPromo ? 'bg-secondary-subtle text-secondary-emphasis' : (promo.actual_adds ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning-emphasis');
  const storyPhase = STORY_PHASE_LABELS[promo.story_phase] || 'Campaign';
  const channels = (promo.eligible_channels || []).filter(c => RETAIL_CHANNELS.includes(String(c).toLowerCase()));
  const channelLine = channels.length ? channels.map(c => CHANNEL_LABELS[c] || c).join(', ') : 'Not specified';
  const promotedSkuBadges = (promo.promoted_skus || [])
    .map(skuId => `<span class="badge bg-light text-dark border me-1 mb-1">${formatSkuDisplay(skuId, null, false)}</span>`)
    .join('');
  const attainment = promo.actual_adds ? formatPercent(promo.actual_adds / promo.target_adds) : 'TBD';
  const revenueImpactLabel = Number.isFinite(Number(promo.incremental_revenue_usd))
    ? formatSignedCurrency(Number(promo.incremental_revenue_usd))
    : 'N/A';

  const skuRows = skuResults.length
    ? skuResults
      .sort((a, b) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))
      .map(row => {
        const uplift = Number(row.sales_uplift_pct || 0);
        const upliftClass = uplift >= 0 ? 'text-success' : 'text-danger';
        const channel = CHANNEL_LABELS[String(row.channel || '').toLowerCase()] || row.channel || '-';
        const skuLabel = formatSkuDisplay(row.sku_id, row.sku_name, false);
        const recommendation = uplift >= 8
          ? 'Scale next cycle'
          : uplift >= 0
            ? 'Keep in mix'
            : 'Exclude / narrow next cycle';
        return `
            <tr>
              <td class="fw-semibold">${skuLabel}</td>
              <td>${channel}</td>
              <td class="${upliftClass}">${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}%</td>
              <td>${recommendation}</td>
            </tr>
          `;
      })
      .join('')
    : '<tr><td colspan="4" class="text-center text-muted">No SKU-level results available.</td></tr>';

  const channelRows = Object.keys(channelResults).length
    ? Object.entries(channelResults).map(([channel, metrics]) => {
      const label = CHANNEL_LABELS[channel] || channel;
      const sales = Number(metrics.sales_uplift_pct || 0);
      const margin = Number(metrics.margin_delta_pct || 0);
      return `
          <tr>
            <td>${label}</td>
            <td class="${sales >= 0 ? 'text-success' : 'text-danger'}">${sales >= 0 ? '+' : ''}${sales.toFixed(1)}%</td>
            <td class="${margin >= 0 ? 'text-success' : 'text-danger'}">${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%</td>
          </tr>
        `;
    }).join('')
    : '<tr><td colspan="3" class="text-center text-muted">No channel-level results available.</td></tr>';

  const exclusionLine = underperformers.length
    ? `Exclude next cycle: ${underperformers.map(s => formatSkuDisplay(s.sku_id, s.sku_name, false)).join(', ')}.`
    : 'No exclusions suggested from this campaign.';
  const includeLine = performers.length
    ? `Keep/scale next cycle: ${performers.map(s => formatSkuDisplay(s.sku_id, s.sku_name, false)).join(', ')}.`
    : 'No positive performers identified.';

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card border-0 promo-detail-card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div class="flex-grow-1">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge ${statusClass}">${status}</span>
              <span class="badge bg-primary-subtle text-primary">${storyPhase}</span>
              <span class="badge bg-light text-dark border">${formatSeasonLabel(promo.season)}</span>
            </div>
            <h6 class="mb-1">${promo.campaign_name}</h6>
            <div class="small text-muted">${promo.story_summary || 'No campaign narrative available.'}</div>
          </div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Campaign Window</div>
              <div class="value">${formatDate(promo.start_date)} - ${formatDate(promo.end_date)}</div>
              <div class="subvalue">${promo.duration_weeks}w</div>
            </div>
          </div>
          <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Channels</div>
              <div class="value">${channelLine}</div>
            </div>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Discount</div>
              <div class="value">${promo.discount_pct}% off</div>
            </div>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Target Units</div>
              <div class="value">${formatNumber(promo.target_adds)}</div>
            </div>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">${isPlannedPromo ? 'Modeled Units' : 'Actual Units'}</div>
              <div class="value">${promo.actual_adds ? formatNumber(promo.actual_adds) : 'TBD'}</div>
              <div class="subvalue">${promo.actual_adds ? `${attainment} of target` : 'Awaiting outcome'}</div>
            </div>
          </div>
          <div class="col-lg-2 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">${isPlannedPromo ? 'Modeled ROI' : 'ROI'}</div>
              <div class="value">${promo.actual_roi ? `${promo.actual_roi}x` : 'TBD'}</div>
            </div>
          </div>
          <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Revenue Impact</div>
              <div class="value ${Number(promo.incremental_revenue_usd || 0) >= 0 ? 'text-success' : 'text-danger'}">${revenueImpactLabel}</div>
            </div>
          </div>
          <div class="col-lg-3 col-md-4 col-sm-6">
            <div class="event-summary-tile h-100">
              <div class="label">Roll-off / Repeat</div>
              <div class="value">${formatDate(promo.roll_off_date)}</div>
              <div class="subvalue">${promo.repeat_loss_expected ? `Repeat-loss risk at ${promo.repeat_loss_lag_weeks || '-'}w` : 'No repeat-loss flag'}</div>
            </div>
          </div>
          <div class="col-lg-4 col-md-8 col-sm-12">
            <div class="event-summary-tile h-100">
              <div class="label">Promoted Products</div>
              <div class="value">${promotedSkuBadges || 'Not specified'}</div>
            </div>
          </div>
        </div>

        <div class="event-story-panel mb-3">
          <div class="fw-semibold mb-1">${isPlannedPromo ? 'What this plan is expected to do' : 'What happened during this campaign'}</div>
          <div class="small mb-2">${promo.story_summary || 'No campaign narrative available.'}</div>
          <div class="small"><strong>Recommendation:</strong> ${exclusionLine}</div>
          <div class="small">${includeLine}</div>
        </div>

        <div class="row g-3">
          <div class="col-lg-7">
            <h6 class="small text-uppercase text-muted mb-2">SKU Outcome Readout</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Product / SKU</th>
                    <th>Retailer</th>
                    <th>Sales Uplift</th>
                    <th>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>${skuRows}</tbody>
              </table>
            </div>
          </div>
          <div class="col-lg-5">
            <h6 class="small text-uppercase text-muted mb-2">Channel Outcome Readout</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Retailer</th>
                    <th>Sales Uplift</th>
                    <th>Margin Delta</th>
                  </tr>
                </thead>
                <tbody>${channelRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/**
 * Render validation windows table
 */
function renderValidationWindows() {
  const tbody = document.getElementById('validation-windows-body');
  if (!tbody) return;

  const windows = (validationWindows && validationWindows.validation_windows) ? validationWindows.validation_windows : [];

  if (!windows || windows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No validation windows defined</td></tr>';
    return;
  }

  let html = '';
  windows.forEach(window => {
    const statusBadge = getWindowBadge(window.status);
    const typeBadge = window.type === 'train' ? 'bg-primary' : 'bg-info';

    html += `
      <tr>
        <td><code class="small">${window.window_id}</code></td>
        <td><span class="badge ${typeBadge}">${window.type}</span></td>
        <td class="text-nowrap small">${formatDate(window.start)} - ${formatDate(window.end)}</td>
        <td>${window.weeks}</td>
        <td><span class="badge ${statusBadge}">${window.status}</span></td>
        <td class="small">${window.purpose || '-'}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Setup event filter listeners
 */
function setupEventFilters() {
  const filterAll = document.getElementById('filter-all');
  const filterPriceChange = document.getElementById('filter-price-change');
  const filterCompetitorPriceChange = document.getElementById('filter-competitor-price-change');
  const filterPromo = document.getElementById('filter-promo');
  const filterTentpole = document.getElementById('filter-tentpole');

  if (filterAll) {
    filterAll.addEventListener('change', (e) => {
      const checked = e.target.checked;
      activeFilters.priceChange = checked;
      activeFilters.competitorPriceChange = checked;
      activeFilters.promo = checked;
      activeFilters.tentpole = checked;

      if (filterPriceChange) filterPriceChange.checked = checked;
      if (filterCompetitorPriceChange) filterCompetitorPriceChange.checked = checked;
      if (filterPromo) filterPromo.checked = checked;
      if (filterTentpole) filterTentpole.checked = checked;

      renderEventTimeline();
    });
  }

  if (filterPriceChange) {
    filterPriceChange.addEventListener('change', (e) => {
      activeFilters.priceChange = e.target.checked;
      renderEventTimeline();
    });
  }

  if (filterCompetitorPriceChange) {
    filterCompetitorPriceChange.addEventListener('change', (e) => {
      activeFilters.competitorPriceChange = e.target.checked;
      renderEventTimeline();
    });
  }

  if (filterPromo) {
    filterPromo.addEventListener('change', (e) => {
      activeFilters.promo = e.target.checked;
      renderEventTimeline();
    });
  }

  if (filterTentpole) {
    filterTentpole.addEventListener('change', (e) => {
      activeFilters.tentpole = e.target.checked;
      renderEventTimeline();
    });
  }
}

/**
 * Initialize the product filter dropdown and wire its change handler.
 */
function initializeProductFilter() {
  const select = document.getElementById('event-calendar-product-filter');
  if (!select) return;

  const options = buildProductFilterOptions();
  select.innerHTML = '<option value="all" selected>All Products</option>';
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.isGroup) {
      el.style.fontWeight = 'bold';
    }
    select.appendChild(el);
  });

  select.value = activeProductFilter;

  select.addEventListener('change', () => {
    activeProductFilter = select.value || 'all';
    renderEventTimeline();
  });
}

/**
 * Filter events based on active filters
 */
function filterEvents() {
  const events = Array.isArray(allEvents) ? allEvents : [];
  return events.filter(event => {
    const eventType = event.event_type || '';
    if (eventType === 'Price Change' && !activeFilters.priceChange) return false;
    if (eventType === 'Competitor Price Change' && !activeFilters.competitorPriceChange) return false;
    if ((eventType.includes('Promo') || eventType === 'Social Spike') && !activeFilters.promo) return false;
    if (eventType === 'Tentpole' && !activeFilters.tentpole) return false;
    if (!eventMatchesProductFilter(event)) return false;
    return true;
  });
}

/**
 * Get event badge configuration
 */
function getEventBadge(eventType) {
  const badges = {
    'Price Change': { text: 'Price Change', class: 'bg-success' },
    'Competitor Price Change': { text: 'Competitor Price', class: 'bg-danger' },
    'Promo Start': { text: 'Promo Start', class: 'bg-info' },
    'Promo End': { text: 'Promo End', class: 'bg-secondary' },
    'Promo Roll-off': { text: 'Roll-off', class: 'bg-warning text-dark' },
    'Social Spike': { text: 'Social Spike', class: 'bg-primary' },
    'Tentpole': { text: 'Tentpole', class: 'bg-warning text-dark' }
  };
  return badges[eventType] || { text: eventType, class: 'bg-secondary' };
}

/**
 * Get validation window badge
 */
function getWindowBadge(status) {
  const badges = {
    'clean': 'bg-success',
    'test': 'bg-info',
    'confounded': 'bg-warning text-dark'
  };
  return badges[status] || 'bg-secondary';
}

/**
 * Get event price info string
 */
function getEventPriceInfo(event) {
  if (event.price_before && event.price_after && event.price_before !== event.price_after) {
    // Calculate as decimal (0.4293 = 42.93%), formatPercent will multiply by 100
    const change = (event.price_after - event.price_before) / event.price_before;
    const arrow = change > 0 ? 'up' : 'down';
    const color = change > 0 ? 'text-success' : 'text-danger';
    return `
      <span class="${color}">
        <strong>${formatCurrency(event.price_before)} -> ${formatCurrency(event.price_after)}</strong>
        (${arrow} ${formatPercent(Math.abs(change))})
      </span>
    `;
  }
  if (event.promo_discount_pct > 0) {
    return `<span class="text-info"><strong>${event.promo_discount_pct}% discount</strong></span>`;
  }
  return null;
}

/**
 * Format tier name
 */
function formatTier(tier) {
  const tiers = {
    'ad_supported': 'Mass',
    'ad_free': 'Prestige',
    'bundle': 'Bundle',
    'all': 'All Tiers'
  };
  return tiers[tier] || tier;
}

/**
 * Format cohort name
 */
function formatCohortName(cohort) {
  if (!cohort || cohort === 'all') return 'All Cohorts';
  return cohort.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Format date string
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
