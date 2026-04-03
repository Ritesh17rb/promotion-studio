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
import {
  loadProductCatalog,
  buildProductCatalogMap,
  buildProductOptions,
  getCatalogLabel
} from './product-catalog.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

// Global state
let allEvents = [];
let promoMetadata = {};
let validationWindows = {};
let skuCatalog = new Map();
let competitorFeed = [];
let productHistoryRows = [];
let productCatalog = [];
let productCatalogMap = new Map();
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
let activeSkuPriceFilter = 'all';
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
  const catalogName = getCatalogLabel(productCatalogMap, normalized, '');
  if (catalogName) return catalogName;
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

function getEventSocialScore(row = {}) {
  const direct = safeNumber(row.sentiment_score, null);
  if (Number.isFinite(direct)) return direct;

  const buzz = safeNumber(row.social_buzz_score, null);
  if (Number.isFinite(buzz)) return (buzz - 50) * 2;

  const sentiment = safeNumber(row.social_sentiment, null);
  if (Number.isFinite(sentiment)) {
    if (sentiment >= 0 && sentiment <= 1) return (sentiment - 0.5) * 200;
    if (sentiment >= -1 && sentiment <= 1) return sentiment * 100;
    return sentiment;
  }

  const brandIndex = safeNumber(row.brand_social_index, null);
  if (Number.isFinite(brandIndex)) return (brandIndex - 50) * 2;

  return null;
}

function formatSignedScoreText(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
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
    acc.socialWeighted += safeNumber(getEventSocialScore(row), 0) * weight;
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

function formatStep2Date(dateLike, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = new Date(dateLike);
  if (!Number.isFinite(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', options);
}

function getStep2DriversRange() {
  const endDate = startOfWeek(CALENDAR_TODAY) || new Date(CALENDAR_TODAY);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (51 * 7));
  return { startDate, endDate };
}

function renderStep2DateRange() {
  const pill = document.getElementById('step-2-range-pill');
  if (!pill) return;
  const textNode = pill.querySelector('span') || pill;
  const { startDate, endDate } = getStep2DriversRange();
  textNode.textContent = `Last 52 Weeks • ${formatStep2Date(startDate)} - ${formatStep2Date(endDate)}`;
}

function isProductGroupFilter(value) {
  return value === 'Sunscreen' || value === 'Moisturizer';
}

function getCurrentStep2ProductFilter() {
  return activeSkuPriceFilter && activeSkuPriceFilter !== 'all'
    ? activeSkuPriceFilter
    : (activeProductFilter || 'all');
}

function formatProductSelectionLabel(value) {
  if (!value || value === 'all') return 'All Products';
  if (isProductGroupFilter(value)) return value;
  return getSkuName(value, value);
}

function rowMatchesProductSelection(row, selected = getCurrentStep2ProductFilter()) {
  if (!selected || selected === 'all') return true;
  if (isProductGroupFilter(selected)) {
    return String(row?.product_group || '').trim().toLowerCase() === selected.toLowerCase();
  }
  return normalizeSkuId(row?.sku_id) === normalizeSkuId(selected);
}

function buildUnifiedStep2ProductOptions() {
  const groups = new Set();
  const skuOptions = new Map();
  const addSku = (skuId, label, productGroup = '') => {
    const normalized = normalizeSkuId(skuId);
    if (!normalized) return;
    const groupLabel = String(productGroup || '').trim().toLowerCase();
    if (groupLabel === 'sunscreen') groups.add('Sunscreen');
    if (groupLabel === 'moisturizer') groups.add('Moisturizer');
    if (!skuOptions.has(normalized)) {
      skuOptions.set(normalized, {
        value: normalized,
        label: `${normalized} - ${label || getSkuName(normalized, normalized)}`
      });
    }
  };

  (productCatalog || []).forEach(entry => {
    addSku(entry.sku_id, entry.official_name || entry.short_name || entry.sku_id, entry.product_group);
  });
  (skuCatalog instanceof Map ? [...skuCatalog.values()] : []).forEach(entry => {
    addSku(entry.sku_id, entry.sku_name || entry.sku_id, entry.product_group);
  });
  Object.values(promoMetadata || {}).forEach(promo => {
    (promo.promoted_skus || []).forEach(skuId => addSku(skuId, getSkuName(skuId, skuId)));
    (promo.sku_results || []).forEach(row => {
      addSku(row.sku_id, row.sku_name || row.sku_id, row.sku_id?.startsWith('SUN') ? 'sunscreen' : row.sku_id?.startsWith('MOI') ? 'moisturizer' : '');
    });
  });

  const options = [{ value: 'all', label: 'All Products' }];
  ['Sunscreen', 'Moisturizer'].forEach(group => {
    if (groups.has(group)) {
      options.push({ value: group, label: group, isGroup: true });
    }
  });
  return options.concat([...skuOptions.values()].sort((a, b) => a.label.localeCompare(b.label)));
}

function setSelectValueIfPresent(id, value) {
  const select = document.getElementById(id);
  if (!select) return;
  const exists = [...select.options].some(option => option.value === value);
  if (exists) {
    select.value = value;
  }
}

function syncStep2ProductSelection(value) {
  const nextValue = value || 'all';
  activeProductFilter = nextValue;
  activeSkuPriceFilter = nextValue;
  setSelectValueIfPresent('event-calendar-product-filter', nextValue);
  setSelectValueIfPresent('sku-price-filter', nextValue);
  renderMarketSignalsDashboardV2();
  renderEventTimelineV2();
}

function promoMatchesActiveProductFilter(promo, selected = getCurrentStep2ProductFilter()) {
  if (!promo || !selected || selected === 'all') return true;
  const skuIds = [
    ...(promo.promoted_skus || []),
    ...(promo.sku_results || []).map(row => row.sku_id)
  ].map(normalizeSkuId);
  if (isProductGroupFilter(selected)) {
    const prefix = selected === 'Sunscreen' ? 'SUN_' : 'MOI_';
    return skuIds.some(skuId => skuId.startsWith(prefix));
  }
  return skuIds.includes(normalizeSkuId(selected));
}

function getEventDisplayConfig(event) {
  switch (event?.event_type) {
    case 'Competitor Price Change':
      return { type: 'competitor', label: 'Competitor Cut', icon: 'bi-arrow-down-left', color: '#ef4444' };
    case 'Social Spike':
      return { type: 'social', label: 'Social Spike', icon: 'bi-megaphone', color: '#3b82f6' };
    case 'Tentpole':
      return { type: 'seasonal', label: 'Seasonal', icon: 'bi-balloon-heart', color: '#f59e0b' };
    default:
      return { type: 'promo', label: 'Promo', icon: 'bi-tag', color: '#8b5cf6' };
  }
}

function getRecentVisibleEvent(events = []) {
  const pastEvents = events
    .filter(event => new Date(event.date) <= CALENDAR_TODAY)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (pastEvents.length) return pastEvents[0];
  return [...events].sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
}

function buildTimelineHighlights(events = [], limit = 6) {
  if (!Array.isArray(events) || !events.length) return [];
  const selected = [];
  const addEvent = event => {
    if (!event) return;
    if (selected.some(item => item.event_id === event.event_id)) return;
    selected.push(event);
  };
  const nearestByType = predicate => [...events]
    .filter(predicate)
    .sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0];

  addEvent(nearestByType(event => event.event_type === 'Competitor Price Change'));
  addEvent(nearestByType(event => event.event_type === 'Promo Start'));
  addEvent(nearestByType(event => event.event_type === 'Social Spike'));
  addEvent(nearestByType(event => event.event_type === 'Tentpole'));

  [...events]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(event => {
      if (selected.length >= limit) return;
      const eventTime = new Date(event.date).getTime();
      const tooClose = selected.some(item => Math.abs(new Date(item.date).getTime() - eventTime) < (18 * DAY_MS));
      if (!tooClose) addEvent(event);
    });

  return selected
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

function getEventMetricSnapshot(event) {
  if (!event || !Array.isArray(productHistoryRows) || !productHistoryRows.length) return null;
  const eventDate = new Date(event.date);
  const productInfo = getEventProductInfo(event);
  const weekKeys = extractSortedWeekKeys(productHistoryRows, 'week_start');
  const resolvedWeek = resolveComparableWeekKey(eventDate, weekKeys);
  const previousWeekKey = getPreviousAvailableWeekKey(resolvedWeek.weekKey, weekKeys);
  const scope = buildEventScope(event, productInfo);
  const currentSummary = finalizeScopedSummary(summarizeScopedRows(getScopedRowsForWeek(productHistoryRows, resolvedWeek.weekKey, scope)));
  const previousSummary = finalizeScopedSummary(summarizeScopedRows(getScopedRowsForWeek(productHistoryRows, previousWeekKey, scope)));
  const pctChange = (current, previous) => (Number.isFinite(current) && Number.isFinite(previous) && previous !== 0)
    ? ((current - previous) / previous)
    : null;
  const promo = event.promo_id && promoMetadata ? promoMetadata[event.promo_id] : null;
  return {
    productInfo,
    promo,
    resolvedWeek,
    currentSummary,
    previousSummary,
    unitsDelta: currentSummary.units - previousSummary.units,
    revenueDelta: currentSummary.revenue - previousSummary.revenue,
    ownPriceDeltaPct: pctChange(currentSummary.ownPrice, previousSummary.ownPrice),
    competitorPriceDeltaPct: pctChange(currentSummary.competitorPrice, previousSummary.competitorPrice),
    socialDelta: Number.isFinite(currentSummary.social) && Number.isFinite(previousSummary.social)
      ? currentSummary.social - previousSummary.social
      : null
  };
}

function buildEventAnalystFallback(event) {
  if (!event) {
    return {
      selectedHtml: 'Select an event from the timeline to analyze impact and recommended pivot.',
      summary: 'The analyst panel summarizes the selected event using the same Step 2 storyline and weekly scope used elsewhere on this screen.',
      impact: ['Awaiting event selection.'],
      actions: ['Awaiting event selection.']
    };
  }

  const metrics = getEventMetricSnapshot(event);
  const productInfo = metrics?.productInfo || getEventProductInfo(event);
  const promo = metrics?.promo || (event.promo_id && promoMetadata ? promoMetadata[event.promo_id] : null);
  const channels = String(event.affected_channel || event.affected_cohort || 'all')
    .split('|')
    .map(channel => CHANNEL_LABELS[channel] || channel)
    .filter(Boolean);
  const channelLabel = channels.length ? channels.join(', ') : 'All channels';
  const headline = buildEventHeadline(event, promo, productInfo);
  const selectionMeta = `${formatStep2Date(event.date)} • ${channelLabel}`;
  let summary = event.notes || 'Signal selected for analyst review.';
  const impact = [];
  const actions = [];

  if (event.event_type === 'Competitor Price Change') {
    summary = `Competitor pressure is active on ${channelLabel}. The right response is selective defense only where the gap widened and volume exposure is visible.`;
    if (Number.isFinite(metrics?.competitorPriceDeltaPct)) {
      impact.push(`Competitor benchmark moved ${formatSignedPercentText(metrics.competitorPriceDeltaPct)} versus the prior comparable week.`);
    }
    if (Number.isFinite(metrics?.unitsDelta)) {
      impact.push(`Scoped unit change versus baseline: ${metrics.unitsDelta >= 0 ? '+' : ''}${formatNumber(metrics.unitsDelta, 0)} units.`);
    }
    if (Number.isFinite(metrics?.revenueDelta)) {
      impact.push(`Revenue swing versus baseline: ${formatSignedCurrency(metrics.revenueDelta)}.`);
    }
    actions.push(`Defend only the exposed SKUs in ${channelLabel}, not the full portfolio.`);
    actions.push('Hold depth shallow where social pull remains positive.');
  } else if (event.event_type === 'Social Spike') {
    summary = `Demand is being supported by social momentum, which usually lowers elasticity and reduces the need for broad discounting.`;
    if (Number.isFinite(metrics?.socialDelta)) {
      impact.push(`Social signal moved ${formatSignedPointText(metrics.socialDelta)} versus the prior comparable week.`);
    }
    if (Number.isFinite(metrics?.revenueDelta)) {
      impact.push(`Revenue response in scope: ${formatSignedCurrency(metrics.revenueDelta)}.`);
    }
    actions.push('Use creator momentum to hold or trim discount depth.');
    actions.push('Prioritize premium SPF where conversion remains healthy.');
  } else if (event.event_type === 'Tentpole') {
    summary = `${extractTentpoleHolidayName(event) || 'This seasonal window'} is a demand-shaping event. The implication is readiness, inventory coverage, and selective promo depth by channel.`;
    if (Number.isFinite(metrics?.unitsDelta)) {
      impact.push(`Scoped unit change versus baseline: ${metrics.unitsDelta >= 0 ? '+' : ''}${formatNumber(metrics.unitsDelta, 0)} units.`);
    }
    if (Number.isFinite(metrics?.revenueDelta)) {
      impact.push(`Revenue swing versus baseline: ${formatSignedCurrency(metrics.revenueDelta)}.`);
    }
    actions.push('Anchor inventory and promo readiness around the seasonal window.');
    actions.push('Use channel-specific depth rather than portfolio-wide markdowns.');
  } else {
    summary = promo?.story_summary || event.notes || 'Promotion window selected for analyst review.';
    if (Number.isFinite(metrics?.revenueDelta)) {
      impact.push(`Revenue swing versus baseline: ${formatSignedCurrency(metrics.revenueDelta)}.`);
    }
    if (Number.isFinite(promo?.actual_roi)) {
      impact.push(`Campaign ROI: ${promo.actual_roi.toFixed(2)}x.`);
    }
    actions.push(`Keep the response focused on ${productInfo.label || 'the affected products'} only.`);
    if (Number.isFinite(promo?.discount_pct)) {
      actions.push(`Use ${promo.discount_pct.toFixed(0)}% as the current modeled discount reference point.`);
    }
  }

  if (!impact.length && metrics?.resolvedWeek?.basis) {
    impact.push(`Signals are based on ${metrics.resolvedWeek.basis.toLowerCase()}.`);
  }
  if (!actions.length) {
    actions.push('Review this event alongside the timeline and signal snapshot before changing depth.');
  }

  return {
    selectedHtml: `<strong>Top Event:</strong> ${headline}<div class="small text-muted mt-1">${selectionMeta}</div>`,
    summary,
    impact: impact.slice(0, 3),
    actions: actions.slice(0, 3)
  };
}

function renderEventAnalystSelection(event) {
  const selectedEl = document.getElementById('event-llm-selected');
  const summaryEl = document.getElementById('event-llm-summary');
  const impactEl = document.getElementById('event-llm-impact');
  const actionsEl = document.getElementById('event-llm-actions');
  if (!selectedEl || !summaryEl || !impactEl || !actionsEl) return;

  const fallback = buildEventAnalystFallback(event);
  selectedEl.innerHTML = fallback.selectedHtml;
  summaryEl.textContent = fallback.summary;
  impactEl.innerHTML = fallback.impact.map(item => `<li>${item}</li>`).join('');
  actionsEl.innerHTML = fallback.actions.map(item => `<li>${item}</li>`).join('');
}

/**
 * Extract a short holiday name from tentpole event notes or ID.
 */
function extractTentpoleHolidayName(event) {
  if (!event || event.event_type !== 'Tentpole') return null;
  const id = (event.event_id || '').toUpperCase();
  const notes = (event.notes || '').toLowerCase();
  if (id.includes('THANKSGIVING') || notes.includes('thanksgiving')) return 'Thanksgiving & Black Friday';
  if (id.includes('CHRISTMAS') || notes.includes('christmas')) return 'Christmas Gifting';
  if (id.includes('MEMORIAL_DAY') || notes.includes('memorial day')) return 'Memorial Day';
  if (id.includes('LABOR_DAY') || notes.includes('labor day')) return 'Labor Day';
  if (id.includes('PRIME_DAY') || notes.includes('prime day')) return 'Prime Day';
  if (id.includes('HOLIDAY_SET') || notes.includes('holiday set') || notes.includes('holiday gift')) return 'Holiday Set Launch';
  if (id.includes('SPRING_RESET') || notes.includes('spring reset') || notes.includes('spring skincare')) return 'Spring Reset';
  if (id.includes('SUMMER_KICKOFF') || notes.includes('summer kickoff')) return 'Summer Kickoff';
  return null;
}

function buildEventHeadline(event, promo, productInfo) {
  if (promo?.campaign_name) return promo.campaign_name;
  if (event.event_type === 'Tentpole') {
    const holidayName = extractTentpoleHolidayName(event);
    if (holidayName) return holidayName;
    if (event.notes) {
      const firstSentence = String(event.notes).split('.').find(Boolean);
      return firstSentence ? firstSentence.trim() : 'Seasonal Tentpole';
    }
    return 'Seasonal Tentpole';
  }
  if (event.event_type === 'Competitor Price Change') {
    return `${productInfo.label || 'Portfolio'} Competitor Price Move`;
  }
  if (event.event_type === 'Social Spike') {
    return `${productInfo.label || 'Portfolio'} Social Momentum Spike`;
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
  const normalizedFilter = String(activeProductFilter || '').toLowerCase();

  // Filter by product group name
  if (activeProductFilter === 'Sunscreen' || activeProductFilter === 'Moisturizer') {
    if (String(info.productGroup || '').toLowerCase() === normalizedFilter) return true;
    return info.skus.some(s => String(s.product_group || '').toLowerCase() === normalizedFilter);
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
    [allEvents, promoMetadata, validationWindows, skuWeeklyData, competitorFeed, productHistoryRows, productCatalog] = await Promise.all([
      loadEventCalendar(),
      loadPromoMetadata(),
      loadValidationWindows(),
      loadSkuWeeklyData(),
      loadCompetitorPriceFeed(),
      loadProductChannelHistory(),
      loadProductCatalog()
    ]);
    productCatalogMap = buildProductCatalogMap(productCatalog);
    allEvents = augmentEvents(allEvents);
    hydrateSkuCatalog(skuWeeklyData || []);
    window.renderEventAnalystSelection = renderEventAnalystSelection;
    renderStep2DateRange();

    // Update event count badge
    updateEventCountBadge();

    // Setup event listeners
    initializeProductFilter();
    setupEventFilters();

    // Render all components
    renderMarketSignalsDashboardV2();
    renderEventTimelineV2();
    renderValidationWindows();

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
function updateEventCountBadge(visibleCount = null) {
  const badge = document.getElementById('event-count-badge');
  if (!badge) return;
  const events = Array.isArray(allEvents) ? allEvents : [];
  const total = Number.isFinite(visibleCount) ? visibleCount : events.length;
  badge.textContent = `${total} visible signals`;
}

/**
 * Render Market Signals & Listening dashboard (competitive + social)
 * Uses direct weekly data only: market_signals.csv, social_signals.csv, sku_channel_weekly.csv.
 */
function renderSignalSnapshot({ cards = [], feedItems = [] } = {}) {
  const grid = document.getElementById('step2-snapshot-grid');
  const feed = document.getElementById('step2-analysis-feed');
  if (!grid || !feed) return;

  grid.innerHTML = cards.length
    ? cards.map(card => `
      <article class="step2-snapshot-card-item" data-tone="${card.tone}">
        <div class="step2-snapshot-label">
          <i class="bi ${card.icon}"></i>
          <span>${card.label}</span>
        </div>
        ${card.value ? `<div class="step2-snapshot-value ${card.valueClass || ''}">${card.value}</div>` : ''}
        ${card.headline ? `<div class="step2-snapshot-headline">${card.headline}</div>` : ''}
        ${card.subvalue ? `<div class="step2-snapshot-subvalue">${card.subvalue}</div>` : ''}
        ${card.chip ? `<div class="step2-snapshot-chip" data-tone="${card.tone}">${card.chip}</div>` : ''}
        ${card.footnote ? `<div class="step2-snapshot-footnote">${card.footnote}</div>` : ''}
      </article>
    `).join('')
    : '<div class="step2-snapshot-loading">Signal snapshot is not available for the current filter selection.</div>';

  feed.innerHTML = feedItems.map(item => `
    <div class="step2-analysis-feed-item">
      <div class="step2-analysis-feed-icon"><i class="bi ${item.icon}"></i></div>
      <div>
        <div class="step2-analysis-feed-label">${item.label}</div>
        <div class="step2-analysis-feed-copy">${item.copy}</div>
      </div>
    </div>
  `).join('');
}

function renderSignalSnapshotAiRecommendation(payload = null) {
  if (window.renderStep2SignalSnapshotAi && typeof window.renderStep2SignalSnapshotAi === 'function') {
    window.renderStep2SignalSnapshotAi(payload || {});
  }
}

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
    const normalizeSocialScore = (scoreRaw, sentimentRaw) =>
      getEventSocialScore({ brand_social_index: scoreRaw, sentiment_score: sentimentRaw });

    // --- SKU/Product filter dropdown for competitive price delta chart ---
    const compChartParent = compCanvas.parentElement;
    let skuFilterContainer = document.getElementById('sku-price-filter-container');
    if (!skuFilterContainer) {
      skuFilterContainer = document.createElement('div');
      skuFilterContainer.id = 'sku-price-filter-container';
      skuFilterContainer.className = 'd-flex align-items-center gap-2 mb-2';
      skuFilterContainer.innerHTML = `
        <label for="sku-price-filter" class="form-label mb-0 small fw-semibold text-muted">Filter by Product/SKU:</label>
        <select id="sku-price-filter" class="form-select form-select-sm" style="max-width: 320px;">
          ${buildProductOptions(productCatalog, { includeAll: true, includeSku: true }).map(opt => `<option value="${opt.value}"${opt.value === activeSkuPriceFilter ? ' selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      `;
      compChartParent.insertBefore(skuFilterContainer, compCanvas);
      const skuPriceSelect = document.getElementById('sku-price-filter');
      if (skuPriceSelect) {
        skuPriceSelect.addEventListener('change', () => {
          activeSkuPriceFilter = skuPriceSelect.value || 'all';
          renderMarketSignalsDashboard();
        });
      }
    }

    let compLegendContainer = document.getElementById('market-signals-competitive-legend');
    if (!compLegendContainer) {
      compLegendContainer = document.createElement('div');
      compLegendContainer.id = 'market-signals-competitive-legend';
      compLegendContainer.className = 'ec-chart-legend mb-2';
      compChartParent.insertBefore(compLegendContainer, compCanvas);
    }
    compLegendContainer.innerHTML = `
      <div class="ec-legend-item">
        <span class="ec-legend-dot" style="background:#3b82f6; --legend-color:#3b82f6;"></span>
        <span>Supergoop Mass Price</span>
      </div>
      <div class="ec-legend-item">
        <span class="ec-legend-dot ec-legend-dot-dashed" style="background:#ef4444; --legend-color:#ef4444;"></span>
        <span>Competitor Mass Price</span>
      </div>
      <div class="ec-legend-item">
        <span class="ec-legend-dot" style="background:#10b981; --legend-color:#10b981;"></span>
        <span>Supergoop Prestige Price</span>
      </div>
      <div class="ec-legend-item">
        <span class="ec-legend-dot ec-legend-dot-dashed" style="background:#f59e0b; --legend-color:#f59e0b;"></span>
        <span>Competitor Prestige Price</span>
      </div>
    `;

    // Filter skuWeekly data by selected SKU if applicable
    const filteredSkuWeekly = activeSkuPriceFilter === 'all'
      ? skuWeekly
      : skuWeekly.filter(row => normalizeSkuId(row.sku_id) === normalizeSkuId(activeSkuPriceFilter));

    const ourPriceByWeek = new Map();
    filteredSkuWeekly.forEach(row => {
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
    const compWeeks = [];
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
      compWeeks.push(week);
      ourMassSeries.push(Number(ownMass.toFixed(2)));
      compMassSeries.push(Number(compMass.toFixed(2)));
      ourPrestigeSeries.push(Number(ownPrestige.toFixed(2)));
      compPrestigeSeries.push(Number(compPrestige.toFixed(2)));
    });

    if (compLabels.length) {
      if (eventCompetitiveSignalsChart) {
        eventCompetitiveSignalsChart.data.labels = compLabels;
        eventCompetitiveSignalsChart.data.datasets[0].label = 'Supergoop Mass Price';
        eventCompetitiveSignalsChart.data.datasets[1].label = 'Competitor Mass Price';
        eventCompetitiveSignalsChart.data.datasets[2].label = 'Supergoop Prestige Price';
        eventCompetitiveSignalsChart.data.datasets[3].label = 'Competitor Prestige Price';
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
              { label: 'Supergoop Mass Price', data: ourMassSeries, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3b82f6', pointHoverRadius: 5 },
              { label: 'Competitor Mass Price', data: compMassSeries, borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#ef4444', pointHoverRadius: 4, borderDash: [5, 3] },
              { label: 'Supergoop Prestige Price', data: ourPrestigeSeries, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#10b981', pointHoverRadius: 5 },
              { label: 'Competitor Prestige Price', data: compPrestigeSeries, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#f59e0b', pointHoverRadius: 4, borderDash: [5, 3] }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
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
      const massCompWoWClass = massCompWoW < 0 ? 'text-danger' : massCompWoW > 0 ? 'text-success' : 'text-warning';
      const prestigeCompWoWClass = prestigeCompWoW < 0 ? 'text-danger' : prestigeCompWoW > 0 ? 'text-success' : 'text-warning';
      const massAvgGapValue = ourMassSeries.length
        ? (ourMassSeries.reduce((s, v) => s + v, 0) / ourMassSeries.length) - (compMassSeries.reduce((s, v) => s + v, 0) / compMassSeries.length)
        : 0;
      const prestigeAvgGapValue = ourPrestigeSeries.length
        ? (ourPrestigeSeries.reduce((s, v) => s + v, 0) / ourPrestigeSeries.length) - (compPrestigeSeries.reduce((s, v) => s + v, 0) / compPrestigeSeries.length)
        : 0;
      const massAvgGapClass = massAvgGapValue <= -0.25 ? 'text-success' : massAvgGapValue >= 0.25 ? 'text-danger' : 'text-warning';
      const prestigeAvgGapClass = prestigeAvgGapValue <= -0.25 ? 'text-success' : prestigeAvgGapValue >= 0.25 ? 'text-danger' : 'text-warning';
      const latestCompWeek = compWeeks[latestCompIdx];
      const latestCompWeekLabel = latestCompWeek
        ? `Week of ${new Date(`${latestCompWeek}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : 'Latest reported week';
      compContainer.innerHTML = `
        <div class="ec-signal-grid mt-3">
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Mass Gap</div>
            <div class="ec-signal-card-value ${massDeltaClass}">${massDeltaPct >= 0 ? '+' : ''}${massDeltaPct.toFixed(1)}%</div>
            <div class="ec-signal-card-detail-list">
              <div class="ec-signal-card-detail">
                <span class="ec-signal-card-detail-label">Supergoop avg</span>
                <strong class="ec-signal-card-detail-value">${formatCurrency(ourMassSeries[latestCompIdx])}</strong>
              </div>
              <div class="ec-signal-card-detail">
                <span class="ec-signal-card-detail-label">Competitor avg</span>
                <strong class="ec-signal-card-detail-value">${formatCurrency(compMassSeries[latestCompIdx])}</strong>
              </div>
            </div>
            <div class="ec-signal-card-meta">${latestCompWeekLabel}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Prestige Gap</div>
            <div class="ec-signal-card-value ${prestigeDeltaClass}">${prestigeDeltaPct >= 0 ? '+' : ''}${prestigeDeltaPct.toFixed(1)}%</div>
            <div class="ec-signal-card-detail-list">
              <div class="ec-signal-card-detail">
                <span class="ec-signal-card-detail-label">Supergoop avg</span>
                <strong class="ec-signal-card-detail-value">${formatCurrency(ourPrestigeSeries[latestCompIdx])}</strong>
              </div>
              <div class="ec-signal-card-detail">
                <span class="ec-signal-card-detail-label">Competitor avg</span>
                <strong class="ec-signal-card-detail-value">${formatCurrency(compPrestigeSeries[latestCompIdx])}</strong>
              </div>
            </div>
            <div class="ec-signal-card-meta">${latestCompWeekLabel}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Competitor Move Vs Prior Week</div>
            <div class="ec-signal-card-stack">
              <div class="ec-signal-card-line">
                <span>Mass</span>
                <strong class="${massCompWoWClass}">${formatSignedCurrency(massCompWoW)}</strong>
              </div>
              <div class="ec-signal-card-line">
                <span>Prestige</span>
                <strong class="${prestigeCompWoWClass}">${formatSignedCurrency(prestigeCompWoW)}</strong>
              </div>
            </div>
            <div class="ec-signal-card-meta">Latest competitor feed change</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Season Average Gap</div>
            <div class="ec-signal-card-stack">
              <div class="ec-signal-card-line">
                <span>Mass</span>
                <strong class="${massAvgGapClass}">${formatSignedCurrency(massAvgGapValue)}</strong>
              </div>
              <div class="ec-signal-card-line">
                <span>Prestige</span>
                <strong class="${prestigeAvgGapClass}">${formatSignedCurrency(prestigeAvgGapValue)}</strong>
              </div>
            </div>
            <div class="ec-signal-card-meta">${ourMassSeries.length}-week average vs competitor</div>
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
      const score = normalizeSocialScore(row.brand_social_index ?? row.social_sentiment, row.sentiment_score);
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
                label: 'Social Sentiment',
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
                    ? `Social Sentiment: ${ctx.parsed.y.toFixed(1)}`
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
                min: -100,
                max: 100,
                grid: { color: socGridColor, drawBorder: false },
                ticks: { color: socTextColor, font: { size: 10 }, stepSize: 25 },
                title: { display: true, text: 'Social Sentiment (-100 to +100)', color: '#0ea5e9', font: { size: 11, weight: '600' } }
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
            <div class="ec-signal-card-label">Social Sentiment</div>
            <div class="ec-signal-card-value ${socScoreClass}">${formatSignedScoreText(socialScoreSeries[latestSocialIdx])}</div>
            <div class="ec-signal-card-sub">${formatSignedPointText(socialScoreWoW)} WoW</div>
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

async function renderMarketSignalsDashboardV2() {
  const compContainer = document.getElementById('market-signals-competitive');
  const socialContainer = document.getElementById('market-signals-social');
  const compCanvas = document.getElementById('event-competitive-signals-chart');
  const socialCanvas = document.getElementById('event-social-signals-chart');
  const gapCallout = document.getElementById('step2-current-gap-callout');
  if (!compContainer || !socialContainer || !compCanvas || !socialCanvas) return;

  try {
    const [externalFactors, socialSignals, skuWeekly] = await Promise.all([
      loadExternalFactors(),
      loadSocialSignals(),
      loadSkuWeeklyData()
    ]);

    if (!externalFactors?.length || !socialSignals?.length || !skuWeekly?.length) {
      compContainer.textContent = 'Market signals not available.';
      socialContainer.textContent = 'Social listening data not available.';
      if (gapCallout) gapCallout.innerHTML = '';
      renderSignalSnapshot();
      renderSignalSnapshotAiRecommendation();
      return;
    }

    const toNum = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const socialModifier = scoreRaw => {
      const score = toNum(scoreRaw);
      if (!Number.isFinite(score)) return 1;
      const normalized = score <= 1.5 && score >= -1.5 ? score * 100 : score;
      const clipped = clamp(normalized, 35, 95);
      return clamp(1.18 - ((clipped - 35) * 0.0075), 0.72, 1.26);
    };
    const normalizeSocialScore = (scoreRaw, sentimentRaw) =>
      getEventSocialScore({ brand_social_index: scoreRaw, sentiment_score: sentimentRaw });

    const selectedFilter = getCurrentStep2ProductFilter();
    const selectionLabel = formatProductSelectionLabel(selectedFilter);
    const filteredSkuWeekly = skuWeekly.filter(row => rowMatchesProductSelection(row, selectedFilter));
    const { startDate, endDate } = getTimelineWindow();
    const filteredEvents = filterEvents().filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

    const skuFilterContainer = document.getElementById('sku-price-filter-container');
    if (skuFilterContainer) {
      skuFilterContainer.innerHTML = `
        <label for="sku-price-filter" class="form-label mb-0">Product/SKU:</label>
        <select id="sku-price-filter" class="form-select form-select-sm">
          ${buildUnifiedStep2ProductOptions().map(opt => `<option value="${opt.value}"${opt.value === selectedFilter ? ' selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      `;
      document.getElementById('sku-price-filter')?.addEventListener('change', event => {
        syncStep2ProductSelection(event.target.value || 'all');
      });
    }

    const compLegendContainer = document.getElementById('market-signals-competitive-legend');
    if (compLegendContainer) {
      compLegendContainer.innerHTML = `
        <div class="ec-legend-item">
          <span class="ec-legend-dot" style="background:#3b82f6; --legend-color:#3b82f6;"></span>
          <span>Supergoop Mass Price</span>
        </div>
        <div class="ec-legend-item">
          <span class="ec-legend-dot ec-legend-dot-dashed" style="background:#ef4444; --legend-color:#ef4444;"></span>
          <span>Competitor Mass Price</span>
        </div>
        <div class="ec-legend-item">
          <span class="ec-legend-dot" style="background:#10b981; --legend-color:#10b981;"></span>
          <span>Supergoop Prestige Price</span>
        </div>
        <div class="ec-legend-item">
          <span class="ec-legend-dot ec-legend-dot-dashed" style="background:#f59e0b; --legend-color:#f59e0b;"></span>
          <span>Competitor Prestige Price</span>
        </div>
      `;
    }

    const competitiveByWeek = new Map();
    filteredSkuWeekly.forEach(row => {
      const week = row.week_start || row.date;
      if (!week) return;
      if (!competitiveByWeek.has(week)) {
        competitiveByWeek.set(week, {
          massOwnSum: 0,
          massOwnCount: 0,
          massCompSum: 0,
          massCompCount: 0,
          prestigeOwnSum: 0,
          prestigeOwnCount: 0,
          prestigeCompSum: 0,
          prestigeCompCount: 0,
          revenue: 0,
          engagementSum: 0,
          engagementCount: 0
        });
      }
      const bucket = competitiveByWeek.get(week);
      const ownPrice = toNum(row.effective_price);
      const competitorPrice = toNum(row.competitor_price);
      const engagement = toNum(row.social_engagement_score);
      const channelGroup = String(row.channel_group || '').toLowerCase();

      if (channelGroup === 'mass') {
        if (Number.isFinite(ownPrice)) {
          bucket.massOwnSum += ownPrice;
          bucket.massOwnCount += 1;
        }
        if (Number.isFinite(competitorPrice)) {
          bucket.massCompSum += competitorPrice;
          bucket.massCompCount += 1;
        }
      } else if (channelGroup === 'prestige') {
        if (Number.isFinite(ownPrice)) {
          bucket.prestigeOwnSum += ownPrice;
          bucket.prestigeOwnCount += 1;
        }
        if (Number.isFinite(competitorPrice)) {
          bucket.prestigeCompSum += competitorPrice;
          bucket.prestigeCompCount += 1;
        }
      }

      if (Number.isFinite(engagement)) {
        bucket.engagementSum += engagement;
        bucket.engagementCount += 1;
      }
      bucket.revenue += toNum(row.revenue) || 0;
    });

    const externalByWeek = new Map(externalFactors.map(row => [row.week_start || row.date, row]));
    const socialByWeek = new Map(socialSignals.map(row => [row.week_start || row.date, row]));
    const weekKeys = [...competitiveByWeek.keys()].sort();
    const compLabels = [];
    const compWeeks = [];
    const ourMassSeries = [];
    const compMassSeries = [];
    const ourPrestigeSeries = [];
    const compPrestigeSeries = [];
    const revenueSeries = [];
    const engagementSeries = [];

    weekKeys.forEach(week => {
      const bucket = competitiveByWeek.get(week);
      if (!bucket) return;
      const ownMass = bucket.massOwnCount > 0 ? bucket.massOwnSum / bucket.massOwnCount : null;
      const compMass = bucket.massCompCount > 0 ? bucket.massCompSum / bucket.massCompCount : null;
      const ownPrestige = bucket.prestigeOwnCount > 0 ? bucket.prestigeOwnSum / bucket.prestigeOwnCount : null;
      const compPrestige = bucket.prestigeCompCount > 0 ? bucket.prestigeCompSum / bucket.prestigeCompCount : null;
      if (![ownMass, compMass, ownPrestige, compPrestige].some(Number.isFinite)) return;

      compLabels.push(formatStep2Date(`${week}T00:00:00`, { month: 'short', day: 'numeric' }));
      compWeeks.push(week);
      ourMassSeries.push(Number.isFinite(ownMass) ? Number(ownMass.toFixed(2)) : null);
      compMassSeries.push(Number.isFinite(compMass) ? Number(compMass.toFixed(2)) : null);
      ourPrestigeSeries.push(Number.isFinite(ownPrestige) ? Number(ownPrestige.toFixed(2)) : null);
      compPrestigeSeries.push(Number.isFinite(compPrestige) ? Number(compPrestige.toFixed(2)) : null);
      revenueSeries.push(Number((bucket.revenue || 0).toFixed(0)));
      engagementSeries.push(bucket.engagementCount > 0 ? Number((bucket.engagementSum / bucket.engagementCount).toFixed(1)) : null);
    });

    const findLastFinitePair = (left, right) => {
      for (let index = Math.min(left.length, right.length) - 1; index >= 0; index -= 1) {
        if (Number.isFinite(left[index]) && Number.isFinite(right[index])) return index;
      }
      return -1;
    };

    if (compLabels.length) {
      if (eventCompetitiveSignalsChart) {
        eventCompetitiveSignalsChart.data.labels = compLabels;
        eventCompetitiveSignalsChart.data.datasets[0].data = ourMassSeries;
        eventCompetitiveSignalsChart.data.datasets[1].data = compMassSeries;
        eventCompetitiveSignalsChart.data.datasets[2].data = ourPrestigeSeries;
        eventCompetitiveSignalsChart.data.datasets[3].data = compPrestigeSeries;
        eventCompetitiveSignalsChart.options.layout = { padding: { top: 4, right: 160, bottom: 0, left: 0 } };
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
              { label: 'Supergoop Mass Price', data: ourMassSeries, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3b82f6', pointHoverRadius: 5 },
              { label: 'Competitor Mass Price', data: compMassSeries, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', tension: 0.3, fill: true, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#ef4444', pointHoverRadius: 4, borderDash: [5, 3] },
              { label: 'Supergoop Prestige Price', data: ourPrestigeSeries, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#10b981', pointHoverRadius: 5 },
              { label: 'Competitor Prestige Price', data: compPrestigeSeries, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)', tension: 0.3, fill: true, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#f59e0b', pointHoverRadius: 4, borderDash: [5, 3] }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: compIsDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)',
                titleColor: compIsDark ? '#e2e8f0' : '#1e293b',
                bodyColor: compIsDark ? '#94a3b8' : '#64748b',
                borderColor: compIsDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                  label: ctx => Number.isFinite(ctx.parsed.y) ? `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}` : `${ctx.dataset.label}: N/A`
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
                ticks: { color: compTextColor, font: { size: 10 }, callback: value => `$${value}` },
                title: { display: true, text: 'Avg Price ($)', color: compTextColor, font: { size: 11, weight: '600' } }
              }
            }
          },
          layout: { padding: { top: 4, right: 160, bottom: 0, left: 0 } }
        });
      }

      const latestMassIdx = findLastFinitePair(ourMassSeries, compMassSeries);
      const latestPrestigeIdx = findLastFinitePair(ourPrestigeSeries, compPrestigeSeries);
      const prevMassIdx = latestMassIdx > 0 ? findLastFinitePair(ourMassSeries.slice(0, latestMassIdx), compMassSeries.slice(0, latestMassIdx)) : -1;
      const prevPrestigeIdx = latestPrestigeIdx > 0 ? findLastFinitePair(ourPrestigeSeries.slice(0, latestPrestigeIdx), compPrestigeSeries.slice(0, latestPrestigeIdx)) : -1;
      const calcGapPct = (ownSeries, compSeries, idx) => idx >= 0 && compSeries[idx] > 0
        ? ((ownSeries[idx] - compSeries[idx]) / compSeries[idx]) * 100
        : null;
      const massDeltaPct = calcGapPct(ourMassSeries, compMassSeries, latestMassIdx);
      const prestigeDeltaPct = calcGapPct(ourPrestigeSeries, compPrestigeSeries, latestPrestigeIdx);
      const prevMassGapPct = calcGapPct(ourMassSeries, compMassSeries, prevMassIdx);
      const prevPrestigeGapPct = calcGapPct(ourPrestigeSeries, compPrestigeSeries, prevPrestigeIdx);
      const averageGap = (ownSeries, compSeries) => {
        const gaps = ownSeries
          .map((value, index) => (Number.isFinite(value) && Number.isFinite(compSeries[index]) ? value - compSeries[index] : null))
          .filter(Number.isFinite);
        return gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : null;
      };

      const massAvgGapValue = averageGap(ourMassSeries, compMassSeries);
      const prestigeAvgGapValue = averageGap(ourPrestigeSeries, compPrestigeSeries);
      const dominantGap = [
        { tier: 'Mass', pct: massDeltaPct, absolute: latestMassIdx >= 0 ? ourMassSeries[latestMassIdx] - compMassSeries[latestMassIdx] : null, previousPct: prevMassGapPct },
        { tier: 'Prestige', pct: prestigeDeltaPct, absolute: latestPrestigeIdx >= 0 ? ourPrestigeSeries[latestPrestigeIdx] - compPrestigeSeries[latestPrestigeIdx] : null, previousPct: prevPrestigeGapPct }
      ]
        .filter(item => Number.isFinite(item.pct))
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0] || null;
      const dominantGapChange = dominantGap && Number.isFinite(dominantGap.previousPct)
        ? dominantGap.pct - dominantGap.previousPct
        : null;

      const latestWeek = compWeeks[compWeeks.length - 1];
      const latestRevenue = revenueSeries[revenueSeries.length - 1] || 0;
      const latestEngagement = engagementSeries[engagementSeries.length - 1];
      const latestExternal = externalByWeek.get(latestWeek) || {};
      const latestSocialRow = socialByWeek.get(latestWeek) || socialSignals[socialSignals.length - 1] || {};
      const totalMentions = toNum(latestSocialRow.total_social_mentions) || 0;
      const promoEventsInWindow = filteredEvents.filter(event => String(event.event_type || '').includes('Promo')).length;
      const recentPromos = filteredEvents.filter(event => {
        const distance = Math.abs(new Date(event.date) - CALENDAR_TODAY);
        return distance <= (56 * DAY_MS)
          && (event.event_type === 'Promo Start' || event.event_type === 'Social Spike' || event.event_type === 'Competitor Price Change');
      }).length;
      const promoClutterIndex = toNum(latestExternal.promo_clutter_index) || 0;
      const promoIntensity = recentPromos >= 6 || promoClutterIndex >= 0.3 ? 'High' : recentPromos >= 3 || promoClutterIndex >= 0.22 ? 'Moderate' : 'Low';
      const currentEvent = getPriorityCurrentEvent(filteredEvents);
      const currentEventConfig = getEventDisplayConfig(currentEvent);
      const latestCompetitorEvent = [...filteredEvents]
        .filter(event => event.event_type === 'Competitor Price Change')
        .sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0] || null;
      const latestWeekRows = filteredSkuWeekly.filter(row => (row.week_start || row.date) === latestWeek);
      const demandLeader = [...latestWeekRows]
        .filter(row => Number.isFinite(toNum(row.social_engagement_score)))
        .sort((a, b) => {
          const scoreDiff = (toNum(b.social_engagement_score) || 0) - (toNum(a.social_engagement_score) || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return (toNum(b.net_units_sold) || 0) - (toNum(a.net_units_sold) || 0);
        })[0] || null;

      if (gapCallout) {
        gapCallout.innerHTML = `
          <div class="step2-current-gap-title">Current Gap</div>
          <div class="step2-current-gap-week">${formatStep2Date(`${latestWeek}T00:00:00`, { month: 'short', day: 'numeric' })}</div>
          <div class="step2-current-gap-stack">
            <div class="step2-current-gap-stat">
              <span class="step2-current-gap-stat-label" data-tone="mass">Mass</span>
              <strong class="step2-current-gap-stat-value">${Number.isFinite(massDeltaPct) ? `${massDeltaPct >= 0 ? '+' : ''}${massDeltaPct.toFixed(1)}%` : 'N/A'}</strong>
              <span class="step2-current-gap-stat-copy">${latestMassIdx >= 0 ? `${formatSignedCurrency(ourMassSeries[latestMassIdx] - compMassSeries[latestMassIdx])} vs competitor` : selectionLabel}</span>
            </div>
            <div class="step2-current-gap-stat">
              <span class="step2-current-gap-stat-label" data-tone="prestige">Prestige</span>
              <strong class="step2-current-gap-stat-value">${Number.isFinite(prestigeDeltaPct) ? `${prestigeDeltaPct >= 0 ? '+' : ''}${prestigeDeltaPct.toFixed(1)}%` : 'N/A'}</strong>
              <span class="step2-current-gap-stat-copy">${latestPrestigeIdx >= 0 ? `${formatSignedCurrency(ourPrestigeSeries[latestPrestigeIdx] - compPrestigeSeries[latestPrestigeIdx])} vs competitor` : selectionLabel}</span>
            </div>
          </div>
        `;
      }

      const competitorMoveText = latestCompetitorEvent ? formatStep2Date(latestCompetitorEvent.date) : 'No direct competitor move';
      const competitorMoveCopy = latestCompetitorEvent && Number.isFinite(toNum(latestCompetitorEvent.price_before)) && Number.isFinite(toNum(latestCompetitorEvent.price_after))
        ? `${formatEventChannelLabel(latestCompetitorEvent.affected_channel)} moved from ${formatCurrency(toNum(latestCompetitorEvent.price_before))} to ${formatCurrency(toNum(latestCompetitorEvent.price_after))}.`
        : (latestCompetitorEvent?.notes || 'Competitive pricing is currently stable.');

      compContainer.innerHTML = `
        <div class="ec-signal-grid">
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Latest Competitor Move</div>
            <div class="ec-signal-card-value ${dominantGap && dominantGap.pct >= 1 ? 'text-danger' : 'text-success'}">
              ${dominantGap ? `${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}%` : 'N/A'}
            </div>
            <div class="ec-signal-card-sub">${competitorMoveText}</div>
            <div class="ec-signal-card-meta">${competitorMoveCopy}</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">${compWeeks.length}-Week Seasonal Avg Gap</div>
            <div class="ec-signal-card-stack">
              <div class="ec-signal-card-line">
                <span>Mass</span>
                <strong class="${Number.isFinite(massAvgGapValue) && massAvgGapValue >= 0 ? 'text-danger' : 'text-success'}">${Number.isFinite(massAvgGapValue) ? formatSignedCurrency(massAvgGapValue) : 'N/A'}</strong>
              </div>
              <div class="ec-signal-card-line">
                <span>Prestige</span>
                <strong class="${Number.isFinite(prestigeAvgGapValue) && prestigeAvgGapValue >= 0 ? 'text-danger' : 'text-success'}">${Number.isFinite(prestigeAvgGapValue) ? formatSignedCurrency(prestigeAvgGapValue) : 'N/A'}</strong>
              </div>
            </div>
            <div class="ec-signal-card-meta">${selectionLabel} pricing is typically above competitor in both tiers.</div>
          </div>
        </div>
      `;

      const currentEventProductInfo = currentEvent ? getEventProductInfo(currentEvent) : null;
      const currentEventPromo = currentEvent?.promo_id ? promoMetadata[currentEvent.promo_id] : null;
      const currentEventSubvalue = !currentEvent
        ? 'No event selected'
        : currentEvent.event_type === 'Competitor Price Change' && Number.isFinite(toNum(currentEvent.price_after))
          ? `${formatEventChannelLabel(currentEvent.affected_channel)} cut to ${formatCurrency(toNum(currentEvent.price_after))}`
          : currentEvent.event_type === 'Social Spike'
            ? `${currentEventProductInfo?.productGroup || selectionLabel} buzz is carrying conversion`
            : currentEvent.event_type === 'Tentpole'
              ? `${extractTentpoleHolidayName(currentEvent) || 'Seasonal demand window'} is inside the planning view`
              : `${currentEventPromo?.campaign_name || 'Promo window'} is active in ${formatEventChannelLabel(currentEvent.affected_channel)}`;
      const currentEventFootnote = !currentEvent
        ? selectionLabel
        : currentEvent.event_type === 'Competitor Price Change'
          ? `Recommended pivot: defend exposed ${currentEventProductInfo?.label || selectionLabel} only.`
          : currentEvent.event_type === 'Social Spike'
            ? 'Recommended pivot: protect margin while creator demand stays supportive.'
            : currentEvent.event_type === 'Tentpole'
              ? 'Recommended pivot: align inventory and selective depth by channel.'
              : 'Recommended pivot: keep the offer narrow to the responsive products and channels.';
      renderSignalSnapshot({
        cards: [
          {
            tone: 'pricing',
            icon: 'bi-tag',
            label: 'Pricing Pressure',
            value: dominantGap ? `${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}%` : 'N/A',
            valueClass: dominantGap && dominantGap.pct >= 1 ? 'is-negative' : dominantGap && dominantGap.pct <= -1 ? 'is-positive' : 'is-neutral',
            subvalue: dominantGap ? `vs competitor (${dominantGap.tier})` : selectionLabel,
            chip: Number.isFinite(dominantGapChange) ? (dominantGapChange > 0.3 ? 'Gap Widening' : dominantGapChange < -0.3 ? 'Gap Compressing' : 'Gap Stable') : 'Gap Stable',
            footnote: dominantGap && dominantGap.pct >= 1 ? 'Risk to margin and volume' : 'Pricing position remains manageable'
          },
          {
            tone: 'demand',
            icon: 'bi-chat-square-heart',
            label: 'Demand Momentum',
            headline: Number.isFinite(latestEngagement) && latestEngagement >= 72 ? 'High' : Number.isFinite(latestEngagement) && latestEngagement >= 63 ? 'Solid' : 'Mixed',
            subvalue: Number.isFinite(latestEngagement) ? `${selectionLabel} engagement ${latestEngagement.toFixed(1)}` : 'Demand trend not available',
            chip: demandLeader ? 'Demand Leader' : 'Demand Steady',
            footnote: demandLeader ? `Led by ${getSkuName(demandLeader.sku_id)} in ${CHANNEL_LABELS[demandLeader.sales_channel] || demandLeader.sales_channel}` : `Watching ${selectionLabel}`
          },
          {
            tone: 'promo',
            icon: 'bi-tags',
            label: 'Promo Intensity',
            headline: promoIntensity,
            subvalue: `${promoEventsInWindow} promo starts in the last 52 weeks`,
            chip: promoIntensity === 'High' ? 'Tight Market' : promoIntensity === 'Moderate' ? 'Room to Optimize' : 'Promo Light',
            footnote: `Promo clutter index ${promoClutterIndex.toFixed(3)}`
          },
          {
            tone: 'event',
            icon: currentEventConfig.icon,
            label: 'Recent Market Event',
            headline: currentEvent?.event_type === 'Competitor Price Change' ? 'Competitor active' : currentEvent?.event_type === 'Social Spike' ? 'Buzz rising' : currentEvent?.event_type === 'Tentpole' ? 'Seasonal window' : 'Promo in flight',
            subvalue: currentEventSubvalue,
            chip: currentEvent?.event_type === 'Competitor Price Change' ? 'Action Recommended' : currentEvent ? 'Monitor Closely' : 'No Trigger',
            footnote: currentEventFootnote
          }
        ],
        feedItems: [
          {
            icon: 'bi-distribute-horizontal',
            label: 'Pricing Data',
            copy: dominantGap ? `${selectionLabel} gap is ${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}% versus competitor.` : `Monitoring ${selectionLabel} price position.`
          },
          {
            icon: 'bi-calendar3-event',
            label: 'Event Data',
            copy: `${filteredEvents.length} visible signals are shaping the current Step 2 view.`
          },
          {
            icon: 'bi-megaphone',
            label: 'Marketing/Social Data',
            copy: `Brand buzz is at ${formatNumber(totalMentions)} mentions and blended with ${selectionLabel.toLowerCase()} engagement.`
          },
          {
            icon: 'bi-bar-chart',
            label: 'Sales Performance Data',
            copy: `Latest scoped weekly revenue is ${formatCurrency(latestRevenue)} with engagement at ${Number.isFinite(latestEngagement) ? latestEngagement.toFixed(1) : 'N/A'}.`
          }
        ]
      });
      renderSignalSnapshotAiRecommendation({
        event: currentEvent,
        fallbackRecommendation: currentEventFootnote,
        selectedScope: {
          productFilter: getCurrentStep2ProductFilter(),
          selectionLabel
        },
        signalSnapshot: {
          dominantGapPct: dominantGap?.pct ?? null,
          dominantGapTier: dominantGap?.tier || null,
          dominantGapChange: Number.isFinite(dominantGapChange) ? dominantGapChange : null,
          latestEngagement: Number.isFinite(latestEngagement) ? latestEngagement : null,
          demandLeaderSku: demandLeader?.sku_id || null,
          demandLeaderChannel: demandLeader?.sales_channel || null,
          promoIntensity,
          promoEventsInWindow,
          promoClutterIndex: Number.isFinite(promoClutterIndex) ? promoClutterIndex : null
        }
      });

    } else {
      compContainer.textContent = 'Insufficient competitive price history for chart rendering.';
      renderSignalSnapshot();
      renderSignalSnapshotAiRecommendation();
    }

    const socialLabels = [];
    const socialScoreSeries = [];
    const socialElasticitySeries = [];
    const socialWeekKeys = [...socialByWeek.keys()].sort();
    socialWeekKeys.forEach(week => {
      const row = socialByWeek.get(week);
      if (!row) return;
      const score = normalizeSocialScore(row.brand_social_index ?? row.social_sentiment, row.sentiment_score);
      if (!Number.isFinite(score)) return;
      socialLabels.push(formatStep2Date(`${week}T00:00:00`, { month: 'short', day: 'numeric' }));
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
                label: 'Social Sentiment',
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
                    ? `Social Sentiment: ${ctx.parsed.y.toFixed(1)}`
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
                min: -100,
                max: 100,
                grid: { color: socGridColor, drawBorder: false },
                ticks: { color: socTextColor, font: { size: 10 }, stepSize: 25 },
                title: { display: true, text: 'Social Sentiment (-100 to +100)', color: '#0ea5e9', font: { size: 11, weight: '600' } }
              },
              y1: {
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: socTextColor, font: { size: 10 }, callback: value => `${value}x` },
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
      const latestRow = socialByWeek.get(socialWeekKeys[socialWeekKeys.length - 1]) || {};
      const totalMentions = toNum(latestRow.total_social_mentions) || 0;
      const tiktokMentions = toNum(latestRow.tiktok_mentions) || 0;
      const instagramMentions = toNum(latestRow.instagram_mentions) || 0;
      const tiktokPct = totalMentions > 0 ? ((tiktokMentions / totalMentions) * 100).toFixed(0) : '0';
      const instaPct = totalMentions > 0 ? ((instagramMentions / totalMentions) * 100).toFixed(0) : '0';
      const peakScore = Math.max(...socialScoreSeries);
      const troughScore = Math.min(...socialScoreSeries);

      socialContainer.innerHTML = `
        <div class="d-flex flex-wrap gap-3 mt-2">
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Social Sentiment</div>
            <div class="ec-signal-card-value ${socialScoreWoW >= 2 ? 'text-success' : socialScoreWoW <= -2 ? 'text-danger' : ''}">${formatSignedScoreText(socialScoreSeries[latestSocialIdx])}</div>
            <div class="ec-signal-card-sub">${formatSignedPointText(socialScoreWoW)} WoW</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Elasticity Modifier</div>
            <div class="ec-signal-card-value ${elasticityWoW < -0.01 ? 'text-success' : elasticityWoW > 0.01 ? 'text-danger' : ''}">${socialElasticitySeries[latestSocialIdx]?.toFixed(3) || 'N/A'}x</div>
            <div class="ec-signal-card-sub">${elasticityWoW >= 0 ? '+' : ''}${elasticityWoW.toFixed(3)} WoW</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Total Mentions</div>
            <div class="ec-signal-card-value">${formatNumber(totalMentions)}</div>
            <div class="ec-signal-card-sub">TikTok ${tiktokPct}% · Insta ${instaPct}%</div>
          </div>
          <div class="ec-signal-card">
            <div class="ec-signal-card-label">Season Range</div>
            <div class="ec-signal-card-value">${troughScore.toFixed(0)} to ${peakScore.toFixed(0)}</div>
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
    renderSignalSnapshot();
    renderSignalSnapshotAiRecommendation();
  }
}

function renderEventTimelineV2() {
  const container = document.getElementById('event-timeline');
  if (!container) return;

  const { startDate, endDate } = getTimelineWindow();
  const filteredEvents = filterEvents().filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  updateEventCountBadge(filteredEvents.length);
  renderStep2DateRange();

  if (!filteredEvents.length) {
    container.innerHTML = '<div class="step2-timeline-frame text-center text-muted">No events match the current filters.</div>';
    renderGuidedStorylineExamplesV2([]);
    renderEventAnalystSelection(null);
    return;
  }

  const totalDays = Math.max(1, Math.floor((endDate - startDate) / DAY_MS));
  const todayPosition = Math.max(0, Math.min(100, ((CALENDAR_TODAY - startDate) / DAY_MS / totalDays) * 100));
  const monthMarkers = buildTimelineMonthMarkers(startDate, endDate);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const yearSpan = Math.max(1, endYear - startYear);
  const highlightEvents = buildTimelineHighlights(filteredEvents, 6);

  let html = `
    <div class="step2-timeline-frame">
      <div class="step2-timeline-legend">
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#ef4444;"></span>Competitor Price Cut</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#8b5cf6;"></span>Promo</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#3b82f6;"></span>Social Spike</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#f59e0b;"></span>Seasonal</span>
      </div>
      <div class="step2-timeline-meta">
        <div><i class="bi bi-clock-history me-1"></i>History: Last 12 Months</div>
        <div class="step2-timeline-meta-center">Today: ${formatStep2Date(CALENDAR_TODAY)}</div>
        <div class="text-md-end"><i class="bi bi-calendar2-week me-1"></i>Future: Next 12 Months</div>
      </div>
      <div class="step2-timeline-ruler">
        <div class="step2-timeline-year-row">
  `;

  for (let i = 0; i <= yearSpan; i += 1) {
    const year = startYear + i;
    const position = (i / yearSpan) * 100;
    html += `<div class="step2-timeline-year" style="left:${position}%;">${year}</div>`;
  }

  html += `
        </div>
        <div class="step2-timeline-month-row">
          ${monthMarkers.map(marker => `<div class="step2-timeline-month" style="left:${marker.position}%;">${marker.label}</div>`).join('')}
        </div>
        <div class="step2-timeline-track">
          ${monthMarkers.map(marker => `<div class="step2-timeline-guide${marker.isMajor ? ' is-major' : ''}" style="left:${marker.position}%;"></div>`).join('')}
          <div class="step2-timeline-today" style="left:${todayPosition}%;"><span>Today</span></div>
          ${filteredEvents.map(event => {
            const eventDate = new Date(event.date);
            const position = ((eventDate - startDate) / DAY_MS / totalDays) * 100;
            const config = getEventDisplayConfig(event);
            return `<button type="button" class="step2-timeline-dot" data-event-id="${event.event_id}" data-type="${config.type}" style="left:${position}%;"></button>`;
          }).join('')}
        </div>
  `;

  const laneEnds = [-100, -100];
  html += '<div class="step2-timeline-highlight-row">';
  highlightEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const position = ((eventDate - startDate) / DAY_MS / totalDays) * 100;
    const config = getEventDisplayConfig(event);
    const laneIndex = laneEnds[0] + 16 <= position ? 0 : laneEnds[1] + 16 <= position ? 1 : 0;
    laneEnds[laneIndex] = position;
    const top = laneIndex * 58;
    const title = event.event_type === 'Tentpole'
      ? (extractTentpoleHolidayName(event) || 'Seasonal Window')
      : event.event_type === 'Competitor Price Change'
        ? 'Competitor Cut'
        : event.event_type === 'Social Spike'
          ? 'Social Spike'
          : 'Promo Start';
    const copy = (event.notes || buildEventHeadline(event, event.promo_id ? promoMetadata[event.promo_id] : null, getEventProductInfo(event)))
      .replace(/\.$/, '')
      .slice(0, 60);
    html += `
      <button type="button" class="step2-timeline-highlight" data-event-id="${event.event_id}" data-type="${config.type}" style="left:${position}%; top:${top}px;">
        <span class="step2-timeline-chip">${formatStep2Date(event.date, { month: 'short', day: 'numeric' })}</span>
        <div class="step2-timeline-highlight-title">${title}</div>
        <div class="step2-timeline-highlight-copy">${copy}</div>
      </button>
    `;
  });
  html += '</div></div></div>';

  container.innerHTML = html;

  const selectEvent = eventId => {
    const selectedEvent = filteredEvents.find(event => event.event_id === eventId);
    if (!selectedEvent) return;
    container.querySelectorAll('[data-event-id]').forEach(node => {
      node.classList.toggle('is-selected', node.dataset.eventId === eventId);
    });
    renderEventAnalystSelection(selectedEvent);
    if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
      window.onEventCalendarEventSelected(selectedEvent);
    }
  };

  container.querySelectorAll('.step2-timeline-dot, .step2-timeline-highlight').forEach(node => {
    node.addEventListener('click', () => selectEvent(node.dataset.eventId));
  });

  const defaultEvent = getRecentVisibleEvent(filteredEvents) || highlightEvents[0];
  if (defaultEvent) {
    selectEvent(defaultEvent.event_id);
  }

  renderGuidedStorylineExamplesV2(filteredEvents);
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
    renderGuidedStorylineExamples([]);
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
    const holidayName = extractTentpoleHolidayName(event);
    const tentpoleLabel = holidayName ? ` [${holidayName}]` : '';

    html += `
      <div class="${eventClass}"
           style="left: ${positionPercent}%;"
           data-event-id="${event.event_id}"
           title="${event.event_type}${tentpoleLabel} - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${productTooltip}">
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

  renderGuidedStorylineExamples(filteredEvents);
}

function findPreferredStoryEvent(predicate, preferredEvents = []) {
  const primaryPool = Array.isArray(preferredEvents) ? preferredEvents : [];
  const fallbackPool = Array.isArray(allEvents) ? allEvents : [];
  const candidates = [...primaryPool.filter(predicate), ...fallbackPool.filter(predicate)];
  if (!candidates.length) return null;
  return candidates
    .sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0];
}

function buildPromoStoryMetrics(promo) {
  const skuResults = Array.isArray(promo?.sku_results) ? promo.sku_results : [];
  const avgUplift = skuResults.length
    ? skuResults.reduce((sum, row) => sum + Number(row.sales_uplift_pct || 0), 0) / skuResults.length
    : null;
  const downCount = skuResults.filter(row => Number(row.sales_uplift_pct || 0) < 0 || row.outcome === 'down').length;
  const channelEntries = Object.entries(promo?.channel_results || {});
  const bestChannel = channelEntries
    .sort(([, a], [, b]) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))[0];
  return {
    avgUplift,
    downCount,
    roi: safeNumber(promo?.actual_roi, null),
    revenue: safeNumber(promo?.incremental_revenue_usd, null),
    bestChannel: bestChannel ? (CHANNEL_LABELS[bestChannel[0]] || bestChannel[0]) : null,
    bestChannelLift: bestChannel ? safeNumber(bestChannel[1]?.sales_uplift_pct, null) : null
  };
}

function renderGuidedStorylineExamplesV2(filteredEvents = []) {
  const container = document.getElementById('event-storyline-examples');
  if (!container) return;

  const visibleEvents = Array.isArray(filteredEvents) ? filteredEvents : [];
  const visiblePromos = Object.values(promoMetadata || {})
    .filter(promo => promoMatchesActiveProductFilter(promo))
    .map(promo => ({ promo, metrics: buildPromoStoryMetrics(promo) }));

  if (!visibleEvents.length && !visiblePromos.length) {
    container.innerHTML = '<div class="text-muted small">No guided examples available for the current product/filter selection.</div>';
    return;
  }

  const nearestEvent = predicate => [...visibleEvents]
    .filter(predicate)
    .sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0];
  const rankPromos = list => list.sort((a, b) => {
    const revenueDiff = safeNumber(b.metrics.revenue, 0) - safeNumber(a.metrics.revenue, 0);
    if (revenueDiff !== 0) return revenueDiff;
    return safeNumber(b.metrics.roi, 0) - safeNumber(a.metrics.roi, 0);
  });

  const competitorEvent = nearestEvent(event => event.event_type === 'Competitor Price Change');
  const socialEvent = nearestEvent(event => event.event_type === 'Social Spike');
  const seasonalEvent = nearestEvent(event => event.event_type === 'Tentpole');
  const usedPromoIds = new Set();

  const pickPromo = candidates => {
    const match = candidates.find(item => !usedPromoIds.has(item.promo.promo_id));
    if (match) usedPromoIds.add(match.promo.promo_id);
    return match || null;
  };

  const competitorPromo = pickPromo(rankPromos(visiblePromos.filter(({ promo }) =>
    (promo.eligible_channels || []).some(channel => ['target', 'amazon'].includes(String(channel).toLowerCase()))
  )));
  const socialPromo = pickPromo(rankPromos(visiblePromos.filter(({ promo, metrics }) =>
    safeNumber(promo.discount_pct, 99) <= 8 && safeNumber(metrics.roi, 0) >= 1.5
  )));
  const selectivePromo = pickPromo(rankPromos(visiblePromos.filter(({ promo }) =>
    (promo.eligible_channels || []).some(channel => ['sephora', 'ulta'].includes(String(channel).toLowerCase()))
  )));
  const cautionPromo = pickPromo([...visiblePromos].sort((a, b) => {
    const downDiff = (b.metrics.downCount || 0) - (a.metrics.downCount || 0);
    if (downDiff !== 0) return downDiff;
    return safeNumber(a.metrics.roi, 99) - safeNumber(b.metrics.roi, 99);
  }));

  const stories = [
    {
      tone: 'competitor',
      badge: 'Competitor Move',
      title: 'Defend only where the competitor cuts price',
      copy: competitorPromo
        ? `${competitorPromo.promo.campaign_name} is the clearest selective-defense example in the current storyline. Keep the response concentrated in exposed mass channels instead of promoting the full portfolio.`
        : 'The latest competitor move supports a selective defense response instead of a portfolio-wide markdown.',
      meta: [
        competitorPromo ? `Best Channel: ${competitorPromo.metrics.bestChannel || 'Mass retail'}` : null,
        competitorPromo && Number.isFinite(competitorPromo.metrics.revenue) ? `Projected Impact: ${formatSignedCurrency(competitorPromo.metrics.revenue)}` : null,
        competitorEvent ? `Current Trigger: ${formatStep2Date(competitorEvent.date)} ${competitorEvent.notes || ''}` : null
      ].filter(Boolean),
      eventId: competitorEvent?.event_id || null
    },
    {
      tone: 'social',
      badge: 'Social-Led Hold',
      title: 'When social momentum is high, stay shallow on discount',
      copy: socialPromo
        ? `${socialPromo.promo.campaign_name} shows the highest-quality hold-price story. Buzz is doing demand work, so discount depth can stay shallow while premium SPF keeps margin.`
        : 'Use high social momentum as evidence to protect margin before reaching for deeper discounting.',
      meta: [
        socialPromo ? `Best Channel: ${socialPromo.metrics.bestChannel || 'Prestige retail'}` : null,
        socialPromo && Number.isFinite(socialPromo.metrics.roi) ? `ROI: ${socialPromo.metrics.roi.toFixed(2)}x` : null,
        socialEvent ? `Current Trigger: ${formatStep2Date(socialEvent.date)} ${socialEvent.notes || ''}` : null
      ].filter(Boolean),
      eventId: socialEvent?.event_id || null
    },
    {
      tone: 'promo',
      badge: 'Selective Promo',
      title: 'Prestige should be selective, not broad',
      copy: selectivePromo
        ? `${selectivePromo.promo.campaign_name} is the cleanest example of selective promo depth on responsive prestige SKUs and channels.`
        : 'Favor selective promo depth on the few channels and products that actually respond.',
      meta: [
        selectivePromo ? `Best Channel: ${selectivePromo.metrics.bestChannel || 'Sephora / Ulta'}` : null,
        selectivePromo && Number.isFinite(selectivePromo.metrics.avgUplift) ? `Avg Uplift: ${selectivePromo.metrics.avgUplift >= 0 ? '+' : ''}${selectivePromo.metrics.avgUplift.toFixed(1)}%` : null,
        selectivePromo && Number.isFinite(selectivePromo.metrics.revenue) ? `Projected Impact: ${formatSignedCurrency(selectivePromo.metrics.revenue)}` : null
      ].filter(Boolean),
      eventId: nearestEvent(event => event.promo_id === selectivePromo?.promo.promo_id)?.event_id || null
    },
    {
      tone: 'caution',
      badge: 'Caution',
      title: 'Mixed promo results need tighter SKU selection',
      copy: cautionPromo
        ? `${cautionPromo.promo.campaign_name} is the warning case. It still creates lift, but the downside count shows where broad promo logic needs to be narrowed before the next cycle.`
        : 'Use the weak cases to exclude down-SKUs and tighten future promo composition.',
      meta: [
        cautionPromo ? `Down SKUs: ${cautionPromo.metrics.downCount || 0}` : null,
        cautionPromo && Number.isFinite(cautionPromo.metrics.roi) ? `ROI: ${cautionPromo.metrics.roi.toFixed(2)}x` : null,
        seasonalEvent ? `Seasonal Context: ${extractTentpoleHolidayName(seasonalEvent) || formatStep2Date(seasonalEvent.date)}` : null
      ].filter(Boolean),
      eventId: nearestEvent(event => event.promo_id === cautionPromo?.promo.promo_id)?.event_id || seasonalEvent?.event_id || null
    }
  ].filter(story => story.copy);

  container.innerHTML = stories.map(story => `
    <article class="step2-story-card" data-story-tone="${story.tone}"${story.eventId ? ` data-event-id="${story.eventId}"` : ''}>
      <div class="step2-story-badge">${story.badge}</div>
      <div class="step2-story-title">${story.title}</div>
      <div class="step2-story-copy">${story.copy}</div>
      <div class="step2-story-meta">
        ${story.meta.map(line => `<div>${line}</div>`).join('')}
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-event-id]').forEach(card => {
    card.addEventListener('click', () => {
      const eventId = card.dataset.eventId;
      document.querySelectorAll('#event-timeline [data-event-id]').forEach(node => {
        node.classList.toggle('is-selected', node.dataset.eventId === eventId);
      });
      const event = visibleEvents.find(item => item.event_id === eventId) || (allEvents || []).find(item => item.event_id === eventId);
      if (!event) return;
      renderEventAnalystSelection(event);
      if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
        window.onEventCalendarEventSelected(event);
      }
    });
  });
}

function renderGuidedStorylineExamples(filteredEvents = []) {
  const container = document.getElementById('event-storyline-examples');
  if (!container) return;

  const visibleEvents = Array.isArray(filteredEvents) ? filteredEvents : [];
  if (Array.isArray(filteredEvents) && filteredEvents.length === 0) {
    container.innerHTML = '<div class="text-muted small">No guided examples available for the current product/filter selection.</div>';
    return;
  }
  const getPromo = promoId => (promoId && promoMetadata ? promoMetadata[promoId] : null);
  const competitorEvent = findPreferredStoryEvent(
    event => event.event_type === 'Competitor Price Change',
    visibleEvents
  );
  const socialEvent = findPreferredStoryEvent(
    event => event.event_type === 'Social Spike',
    visibleEvents
  );
  const holidayEvent = findPreferredStoryEvent(
    event => event.event_type === 'Tentpole' && /thanksgiving|black friday|christmas|holiday|memorial/i.test(`${extractTentpoleHolidayName(event) || ''} ${event.notes || ''}`),
    visibleEvents
  ) || findPreferredStoryEvent(event => event.event_type === 'Tentpole', visibleEvents);

  const competitorPromo = getPromo('PROMO_MEMORIAL_DAY_MASS_DEFENSE_2026');
  const socialPromo = getPromo('PROMO_TIKTOK_SPF_MOMENTUM_HOLD_2026');
  const prestigePromo = getPromo('PROMO_PRESTIGE_GLOW_WEEKEND_2026');
  const weakPromo = getPromo('PROMO_WINTER_HYDRATION_PUSH_2025');

  const stories = [];
  const pushPromoStory = (config, promo, event) => {
    if (!promo) return;
    if (activeProductFilter !== 'all' && !event) return;
    const metrics = buildPromoStoryMetrics(promo);
    stories.push({
      ...config,
      date: promo.start_date || event?.date || '',
      chips: [
        Number.isFinite(metrics.roi) ? `ROI ${metrics.roi.toFixed(2)}x` : null,
        Number.isFinite(metrics.avgUplift) ? `Avg uplift ${metrics.avgUplift >= 0 ? '+' : ''}${metrics.avgUplift.toFixed(1)}%` : null,
        Number.isFinite(metrics.revenue) ? `Revenue ${formatSignedCurrency(metrics.revenue)}` : null,
        metrics.bestChannel && Number.isFinite(metrics.bestChannelLift) ? `Best channel ${metrics.bestChannel} ${metrics.bestChannelLift >= 0 ? '+' : ''}${metrics.bestChannelLift.toFixed(1)}%` : null,
        metrics.downCount ? `${metrics.downCount} SKU(s) down` : 'No down SKUs'
      ].filter(Boolean),
      actionLabel: 'Open Campaign Detail',
      promoId: promo.promo_id,
      eventId: event?.event_id || null
    });
  };

  pushPromoStory({
    badge: 'Competitor Move',
    title: 'Defend only where the competitor cuts price',
    summary: 'This is the clearest competitor-defense example in the deck. The story is not “promo everywhere”; it is defend SPF volume in Target/Amazon while accepting temporary margin pressure.',
    implication: 'Use this when Ritesh wants to explain why selective defense is better than broad discounting.'
  }, competitorPromo, findPreferredStoryEvent(event => event.promo_id === 'PROMO_MEMORIAL_DAY_MASS_DEFENSE_2026', visibleEvents) || competitorEvent);

  pushPromoStory({
    badge: 'Social-Led Hold',
    title: 'When social momentum is high, stay shallow on discount',
    summary: 'This is the best example of the “buzz is up, don’t give away margin” storyline. Premium SPF held with a light 5% promo because creator momentum did the demand work.',
    implication: 'Use this to explain the missed-opportunity logic elsewhere in the flow.'
  }, socialPromo, findPreferredStoryEvent(event => event.promo_id === 'PROMO_TIKTOK_SPF_MOMENTUM_HOLD_2026', visibleEvents) || socialEvent);

  pushPromoStory({
    badge: 'Selective Promo',
    title: 'Prestige should be selective, not broad',
    summary: 'This weekend offer concentrates discount depth on the few prestige SKUs and channels that actually respond, instead of dragging the entire portfolio into markdown.',
    implication: 'This is the clean “good promo” example for Sephora and Ulta.'
  }, prestigePromo, findPreferredStoryEvent(event => event.promo_id === 'PROMO_PRESTIGE_GLOW_WEEKEND_2026', visibleEvents));

  pushPromoStory({
    badge: 'Caution',
    title: 'Mixed promo result: some lift, but not a universal win',
    summary: 'Winter Hydration delivered volume, but it still produced a down SKU and repeat-loss risk. That is the cautionary example for why broad promo logic should be narrowed.',
    implication: 'Use this as the “bad / mixed promo” story, not as a total failure but as a learning example.'
  }, weakPromo, findPreferredStoryEvent(event => event.promo_id === 'PROMO_WINTER_HYDRATION_PUSH_2025', visibleEvents));

  if (holidayEvent) {
    stories.push({
      badge: 'Tentpole',
      title: `${extractTentpoleHolidayName(holidayEvent) || 'Holiday'} is a demand-shaping event, not just a date on the calendar`,
      summary: holidayEvent.notes || 'Seasonal tentpoles should anchor inventory, promo readiness, and channel planning.',
      implication: 'Use this to explain why tentpoles belong in the same evidence layer as competitor moves and social spikes.',
      date: holidayEvent.date,
      chips: [
        holidayEvent.channel_group && holidayEvent.channel_group !== 'all' ? `${formatTier(holidayEvent.tier)} channels` : 'Portfolio-wide',
        holidayEvent.validation_window ? `Window ${holidayEvent.validation_window}` : null
      ].filter(Boolean),
      actionLabel: 'Open Event Detail',
      eventId: holidayEvent.event_id,
      promoId: null
    });
  }

  if (!stories.length) {
    container.innerHTML = '<div class="text-muted small">No guided examples available for the current product/filter selection.</div>';
    return;
  }

  container.innerHTML = `
    <div class="row g-3">
      ${stories.slice(0, 5).map(story => `
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <span class="badge text-bg-light border">${story.badge}</span>
                <span class="small text-muted">${story.date ? new Date(`${story.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
              </div>
              <h6 class="mb-2">${story.title}</h6>
              <p class="small text-muted mb-3">${story.summary}</p>
              <div class="d-flex flex-wrap gap-2 mb-3">
                ${story.chips.map(chip => `<span class="badge rounded-pill text-bg-light border">${chip}</span>`).join('')}
              </div>
              <div class="small text-muted mb-3">${story.implication}</div>
              <div class="mt-auto d-flex gap-2">
                ${story.eventId ? `<button class="btn btn-sm btn-outline-primary story-example-event" data-event-id="${story.eventId}" type="button">Open Event Detail</button>` : ''}
                ${story.promoId ? `<button class="btn btn-sm btn-outline-secondary story-example-promo" data-promo-id="${story.promoId}" type="button">Open Campaign Detail</button>` : ''}
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.story-example-event').forEach(button => {
    button.addEventListener('click', () => {
      const event = (allEvents || []).find(item => item.event_id === button.dataset.eventId);
      if (event) showEventDetails(event);
    });
  });

  container.querySelectorAll('.story-example-promo').forEach(button => {
    button.addEventListener('click', () => {
      renderPromoDrilldown(button.dataset.promoId);
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
  const socialSentimentDelta = Number.isFinite(avgSocialScore) && Number.isFinite(avgPrevSocialScore)
    ? avgSocialScore - avgPrevSocialScore
    : null;
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
  const socialSentimentDelta = Number.isFinite(avgSocialScore) && Number.isFinite(avgPrevSocialScore)
    ? avgSocialScore - avgPrevSocialScore
    : null;
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
  // --- Event Window: From and To Dates ---
  let eventPeriodText;
  let eventWindowLabel;
  if (event.event_start_date && event.event_end_date) {
    const startFmt = new Date(event.event_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endFmt = new Date(event.event_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    eventPeriodText = `${startFmt} - ${endFmt}`;
    eventWindowLabel = `Event Window: ${startFmt} - ${endFmt}`;
  } else if (promo?.start_date && promo?.end_date) {
    const startFmt = new Date(promo.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt = new Date(promo.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    eventPeriodText = `${startFmt} to ${endFmt}`;
    eventWindowLabel = `Event Window: ${startFmt} - ${endFmt}`;
  } else if (event.week_start) {
    const weekFmt = new Date(event.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    eventPeriodText = weekFmt;
    eventWindowLabel = `Observed Week: ${weekFmt}`;
  } else {
    eventPeriodText = dateStr;
    eventWindowLabel = `Observed Week: ${dateStr}`;
  }
  const revenueImpactClass = incrementalRevenue >= 0 ? 'text-success' : 'text-danger';

  // --- Promotion type from data ---
  const promotionType = event.promotion_type || promo?.promotion_type || null;
  const isFutureEvent = eventDate > CALENDAR_TODAY;

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
  const socialSignalClass = signalColorClass(socialSentimentDelta);
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
            <span class="ed-status-badge ${statusMeta.className}">${isFutureEvent ? 'Projected' : statusMeta.label}</span>
            ${promotionType ? `<span class="ed-phase-badge" style="background: rgba(6,182,212,0.15); color: #0891b2; font-weight: 600;">${promotionType}</span>` : ''}
            ${phaseLabel ? `<span class="ed-phase-badge">${phaseLabel}</span>` : ''}
            ${event.tier !== 'all' ? `<span class="ed-tier-badge">${formatTier(event.tier)}</span>` : ''}
          </div>
          <h3 class="ed-hero-title">${headline}</h3>
          <div class="ed-hero-date">
            <i class="bi bi-calendar3 me-1"></i>${eventWindowLabel}
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

        <!-- Promotion Type -->
        ${promotionType ? `
        <div class="ed-fact mb-2" style="background: rgba(6,182,212,0.08); border-radius: 8px; padding: 8px 12px; display: inline-flex; align-items: center; gap: 8px;">
          <div class="ed-fact-icon"><i class="bi bi-tag-fill" style="color: #0891b2;"></i></div>
          <div>
            <div class="ed-fact-label">Promotion Type</div>
            <div class="ed-fact-value fw-bold" style="color: #0891b2;">${promotionType}</div>
          </div>
        </div>
        ` : ''}

        <!-- Competition Price Percentage -->
        ${Number.isFinite(competitorPriceChangePct) && competitorPriceChangePct !== 0 ? `
        <div class="alert ${competitorPriceChangePct < 0 ? 'alert-danger' : 'alert-warning'} small mb-2 py-2">
          <i class="bi bi-arrow-left-right me-1"></i><strong>Competition price ${competitorPriceChangePct < 0 ? 'dropped' : 'rose'} ${Math.abs(competitorPriceChangePct * 100).toFixed(1)}%</strong>
          ${Number.isFinite(avgPrevCompetitorPrice) && Number.isFinite(avgCompetitorPrice) ? ` (${formatCurrency(avgPrevCompetitorPrice)} &rarr; ${formatCurrency(avgCompetitorPrice)})` : ''}
        </div>
        ` : ''}

        <!-- Narrative -->
        <div class="ed-narrative">
          <div class="ed-narrative-bar" style="background: ${typeConf.accent};"></div>
          <div class="ed-narrative-text">${promo?.story_summary || event.notes || 'No description available.'}</div>
        </div>

        ${promoDetailsHtml}
        ${strategicOutlookHtml}
        ${businessImplicationsHtml}

        <!-- KPI Metrics Grid -->
        ${isFutureEvent ? '<div class="alert alert-info small mb-3"><i class="bi bi-clock-history me-2"></i><strong>Projected:</strong> This event is in the future. Figures below are projected based on historical patterns and seasonal analogs.</div>' : ''}
        <div class="ed-kpi-grid">
          <div class="ed-kpi ed-kpi-highlight">
            <div class="ed-kpi-label">${isFutureEvent ? 'Projected Revenue Impact' : 'Revenue Impact'}</div>
            <div class="ed-kpi-value ${revenueSignalClass}">${formatSignedCurrency(incrementalRevenue)}</div>
            <div class="ed-kpi-sub">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x ${isPlannedPromo || isFutureEvent ? 'modeled ROI' : 'ROI'}` : 'ROI not modeled'}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Baseline Sales</div>
            <div class="ed-kpi-value">${formatNumber(Math.round(baselineSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatCurrency(baselineRevenue)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">${isFutureEvent ? 'Projected Incremental Sales' : 'Incremental Sales'}</div>
            <div class="ed-kpi-value ${incrementalSalesUnits >= 0 ? 'ed-signal-up' : 'ed-signal-down'}">${incrementalSalesUnits >= 0 ? '+' : ''}${formatNumber(Math.round(incrementalSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatSignedCurrency(revenueDelta)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">${isFutureEvent ? 'Projected Total Sales' : 'Total Sales'}</div>
            <div class="ed-kpi-value">${formatNumber(Math.round(eventSalesUnits))}<span class="ed-kpi-unit"> units</span></div>
            <div class="ed-kpi-sub">${formatCurrency(eventRevenue)}</div>
          </div>
          <div class="ed-kpi">
            <div class="ed-kpi-label">Event ROI</div>
            <div class="ed-kpi-value">${Number.isFinite(roiValue) ? `${roiValue.toFixed(2)}x` : 'N/A'}</div>
            <div class="ed-kpi-sub">${Number.isFinite(roiValue) ? (isPlannedPromo || isFutureEvent ? 'Modeled' : 'Observed') : 'Organic event'}</div>
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
              <div class="ed-signal-detail">${isFutureEvent ? 'Based on last year\'s pattern' : (Number.isFinite(avgPrevCompetitorPrice) ? `${formatCurrency(avgPrevCompetitorPrice)} &rarr; ${formatCurrency(avgCompetitorPrice)}` : 'No benchmark')}</div>
            </div>
          </div>
          <div class="ed-signal ${socialSignalClass}">
            <div class="ed-signal-icon"><i class="bi bi-megaphone"></i></div>
            <div class="ed-signal-body">
              <div class="ed-signal-label">Social Sentiment</div>
              <div class="ed-signal-value">${signalArrow(socialSentimentDelta)} ${formatSignedPointText(socialSentimentDelta)}</div>
              <div class="ed-signal-detail">${isFutureEvent ? 'Assumed: same as current' : (Number.isFinite(avgPrevSocialScore) ? `${formatSignedScoreText(avgPrevSocialScore)} &rarr; ${formatSignedScoreText(avgSocialScore)}` : 'No benchmark')}</div>
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
    const currentSocial = getEventSocialScore(currentRow || {});
    const previousSocial = getEventSocialScore(previousRow || {});
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
    const socialDelta = Number.isFinite(avgSocial) && Number.isFinite(avgPrevSocial) ? avgSocial - avgPrevSocial : null;
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
            <div class="ed-sku-metric-label">Sentiment</div>
            <div class="ed-sku-metric-value ${signalColorClass(socialDelta)}">${formatSignedScoreText(avgSocial)}</div>
            <div class="ed-sku-metric-sub">${formatSignedPointText(socialDelta)} vs baseline</div>
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
              <td class="fw-semibold">Social Sentiment</td>
              <td>${formatSignedPointText(socialSentimentDelta)}</td>
              <td>${formatSignedScoreText(avgPrevSocialScore)}</td>
              <td>${formatSignedScoreText(avgSocialScore)}</td>
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
        <td>${formatSignedScoreText(row.currentSocial)}</td>
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
              <th>Social Sentiment</th>
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

      renderEventTimelineV2();
    });
  }

  if (filterPriceChange) {
    filterPriceChange.addEventListener('change', (e) => {
      activeFilters.priceChange = e.target.checked;
      renderEventTimelineV2();
    });
  }

  if (filterCompetitorPriceChange) {
    filterCompetitorPriceChange.addEventListener('change', (e) => {
      activeFilters.competitorPriceChange = e.target.checked;
      renderEventTimelineV2();
    });
  }

  if (filterPromo) {
    filterPromo.addEventListener('change', (e) => {
      activeFilters.promo = e.target.checked;
      renderEventTimelineV2();
    });
  }

  if (filterTentpole) {
    filterTentpole.addEventListener('change', (e) => {
      activeFilters.tentpole = e.target.checked;
      renderEventTimelineV2();
    });
  }
}

/**
 * Initialize the product filter dropdown and wire its change handler.
 */
function initializeProductFilter() {
  const select = document.getElementById('event-calendar-product-filter');
  if (!select) return;

  const options = buildUnifiedStep2ProductOptions();
  select.innerHTML = '';
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.isGroup) {
      el.style.fontWeight = 'bold';
    }
    select.appendChild(el);
  });

  select.value = getCurrentStep2ProductFilter();

  select.addEventListener('change', () => {
    syncStep2ProductSelection(select.value || 'all');
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

function renderStep2DateRangeLegacy() {
  const pill = document.getElementById('step-2-range-pill');
  if (!pill) return;
  const textNode = pill.querySelector('span') || pill;
  const { startDate, endDate } = getStep2DriversRange();
  textNode.textContent = `Last 52 Weeks - ${formatStep2Date(startDate)} - ${formatStep2Date(endDate)}`;
}

function formatEventChannelLabel(rawValue = 'all') {
  const channels = String(rawValue || 'all')
    .split('|')
    .map(channel => channel.trim().toLowerCase())
    .filter(channel => channel && channel !== 'all')
    .map(channel => CHANNEL_LABELS[channel] || channel.charAt(0).toUpperCase() + channel.slice(1));
  return channels.length ? channels.join(', ') : 'All channels';
}

function getPriorityCurrentEvent(events = []) {
  if (!Array.isArray(events) || !events.length) return null;
  const typePriority = {
    'Competitor Price Change': 0,
    'Social Spike': 1,
    'Promo Start': 2,
    Tentpole: 3
  };
  const nearbyEvents = events.filter(event => Math.abs(new Date(event.date) - CALENDAR_TODAY) <= (28 * DAY_MS));
  const pool = nearbyEvents.length ? nearbyEvents : events;
  return [...pool].sort((a, b) => {
    const aPriority = typePriority[a.event_type] ?? 4;
    const bPriority = typePriority[b.event_type] ?? 4;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aDistance = Math.abs(new Date(a.date) - CALENDAR_TODAY);
    const bDistance = Math.abs(new Date(b.date) - CALENDAR_TODAY);
    if (aDistance !== bDistance) return aDistance - bDistance;
    return new Date(a.date) - new Date(b.date);
  })[0] || null;
}

function buildTimelineEventTitle(event, promo, productInfo) {
  if (event.event_type === 'Competitor Price Change') {
    const channelLabel = formatEventChannelLabel(event.affected_channel || event.affected_cohort || 'all').split(',')[0];
    return `${channelLabel} price cut`;
  }
  if (event.event_type === 'Social Spike') {
    return `${productInfo.productGroup || 'Market'} social spike`;
  }
  if (event.event_type === 'Tentpole') {
    return extractTentpoleHolidayName(event) || 'Seasonal window';
  }
  if (promo?.campaign_name) {
    return promo.campaign_name;
  }
  return buildEventHeadline(event, promo, productInfo);
}

function buildTimelineEventCopy(event, promo, productInfo) {
  const baseCopy = String(promo?.story_summary || event.notes || productInfo.label || 'Signal in focus').replace(/\.$/, '');
  return baseCopy.length > 82 ? `${baseCopy.slice(0, 79).trimEnd()}...` : baseCopy;
}

function buildTimelineEventMeta(event, productInfo) {
  const channelLabel = formatEventChannelLabel(event.affected_channel || event.affected_cohort || 'all');
  return productInfo?.label ? `${channelLabel} | ${productInfo.label}` : channelLabel;
}

function buildStep2DemandSeries(filteredSkuWeekly = [], socialByWeek = new Map()) {
  const demandByWeek = new Map();
  filteredSkuWeekly.forEach(row => {
    const week = row.week_start || row.date;
    if (!week) return;
    if (!demandByWeek.has(week)) {
      demandByWeek.set(week, {
        momentumWeighted: 0,
        momentumWeight: 0,
        modifierWeighted: 0,
        modifierWeight: 0
      });
    }

    const bucket = demandByWeek.get(week);
    const units = Math.max(safeNumber(row.net_units_sold, 0), safeNumber(row.own_units_sold, 0), 1);
    const engagementScore = safeNumber(row.social_engagement_score, null);
    const baseElasticity = Math.abs(safeNumber(row.base_elasticity, null));
    const effectiveElasticity = Math.abs(safeNumber(row.effective_elasticity, null));

    if (Number.isFinite(engagementScore)) {
      bucket.momentumWeighted += ((engagementScore - 50) * 2) * units;
      bucket.momentumWeight += units;
    }
    if (Number.isFinite(baseElasticity) && baseElasticity > 0 && Number.isFinite(effectiveElasticity)) {
      bucket.modifierWeighted += (effectiveElasticity / baseElasticity) * units;
      bucket.modifierWeight += units;
    }
  });

  const weekKeys = [...new Set([...demandByWeek.keys(), ...socialByWeek.keys()])].sort();
  const labels = [];
  const scoreSeries = [];
  const modifierSeries = [];
  const usedWeekKeys = [];

  weekKeys.forEach(week => {
    const bucket = demandByWeek.get(week);
    const brandRow = socialByWeek.get(week) || null;
    const brandScore = brandRow ? getEventSocialScore(brandRow) : null;
    const productScore = bucket?.momentumWeight ? (bucket.momentumWeighted / bucket.momentumWeight) : null;
    const combinedScore = Number.isFinite(brandScore) && Number.isFinite(productScore)
      ? ((brandScore * 0.6) + (productScore * 0.4))
      : (Number.isFinite(brandScore) ? brandScore : productScore);
    const modifier = bucket?.modifierWeight ? (bucket.modifierWeighted / bucket.modifierWeight) : null;
    if (!Number.isFinite(combinedScore) && !Number.isFinite(modifier)) return;
    usedWeekKeys.push(week);
    labels.push(formatStep2Date(`${week}T00:00:00`, { month: 'short', day: 'numeric' }));
    scoreSeries.push(Number.isFinite(combinedScore) ? Number(combinedScore.toFixed(1)) : null);
    modifierSeries.push(Number.isFinite(modifier) ? Number(modifier.toFixed(3)) : null);
  });

  return { labels, scoreSeries, modifierSeries, weekKeys: usedWeekKeys };
}

function buildEventAnalystFallbackLegacy(event) {
  if (!event) {
    return {
      selectedHtml: `
        <div class="step2-analyst-event-kicker">Top Event</div>
        <div class="step2-analyst-event-title">Select an event from the timeline</div>
        <div class="step2-analyst-event-meta">The analyst panel will translate the selected signal into impact and pivot guidance.</div>
      `,
      summary: 'The analyst panel summarizes the selected event using the same Step 2 storyline and weekly scope used elsewhere on this screen.',
      impact: ['Awaiting event selection.'],
      actions: ['Awaiting event selection.']
    };
  }

  const metrics = getEventMetricSnapshot(event);
  const productInfo = metrics?.productInfo || getEventProductInfo(event);
  const promo = metrics?.promo || (event.promo_id && promoMetadata ? promoMetadata[event.promo_id] : null);
  const channelLabel = formatEventChannelLabel(event.affected_channel || event.affected_cohort || 'all');
  const headline = buildEventHeadline(event, promo, productInfo);
  const selectionMeta = `${formatStep2Date(event.date)} | ${channelLabel}`;
  let summary = event.notes || 'Signal selected for analyst review.';
  const impact = [];
  const actions = [];
  const toplineItems = [];

  if (event.event_type === 'Competitor Price Change') {
    summary = `Competitor pressure is active on ${channelLabel}. This is a selective defense case: protect the exposed SKUs, but avoid dragging the full portfolio into discounting.`;
    if (Number.isFinite(metrics?.competitorPriceDeltaPct)) {
      const moveText = formatSignedPercentText(metrics.competitorPriceDeltaPct);
      impact.push(`Competitor benchmark moved ${moveText} versus the prior comparable week.`);
      toplineItems.push({ label: 'Competitor Move', value: moveText });
    }
    if (Number.isFinite(metrics?.revenueDelta)) {
      const revenueText = formatSignedCurrency(metrics.revenueDelta);
      impact.push(`Revenue swing versus baseline: ${revenueText}.`);
      toplineItems.push({ label: 'Revenue', value: revenueText });
    }
    if (Number.isFinite(metrics?.unitsDelta)) {
      const unitsText = `${metrics.unitsDelta >= 0 ? '+' : ''}${formatNumber(metrics.unitsDelta, 0)}`;
      impact.push(`Scoped unit change versus baseline: ${unitsText} units.`);
      toplineItems.push({ label: 'Units', value: unitsText });
    }
    actions.push(`Defend only the exposed SKUs in ${channelLabel}, not the full portfolio.`);
    actions.push('Hold depth shallow where social pull remains positive.');
    if (promo?.notes) actions.push(promo.notes);
  } else if (event.event_type === 'Social Spike') {
    summary = 'Demand is being supported by social momentum, which lowers elasticity and makes broad discounting unnecessary if premium conversion is holding.';
    if (Number.isFinite(metrics?.socialDelta)) {
      const socialText = formatSignedPointText(metrics.socialDelta);
      impact.push(`Social signal moved ${socialText} versus the prior comparable week.`);
      toplineItems.push({ label: 'Social Shift', value: socialText });
    }
    if (Number.isFinite(metrics?.revenueDelta)) {
      const revenueText = formatSignedCurrency(metrics.revenueDelta);
      impact.push(`Revenue response in scope: ${revenueText}.`);
      toplineItems.push({ label: 'Revenue', value: revenueText });
    }
    if (Number.isFinite(promo?.actual_roi)) {
      toplineItems.push({ label: 'ROI', value: `${promo.actual_roi.toFixed(2)}x` });
    }
    actions.push('Use creator momentum to hold or trim discount depth.');
    actions.push('Prioritize premium SPF where conversion remains healthy.');
  } else if (event.event_type === 'Tentpole') {
    summary = `${extractTentpoleHolidayName(event) || 'This seasonal window'} is a demand-shaping event. The implication is readiness, inventory coverage, and selective promo depth by channel.`;
    if (Number.isFinite(metrics?.revenueDelta)) {
      const revenueText = formatSignedCurrency(metrics.revenueDelta);
      impact.push(`Revenue swing versus baseline: ${revenueText}.`);
      toplineItems.push({ label: 'Revenue', value: revenueText });
    }
    if (Number.isFinite(metrics?.unitsDelta)) {
      const unitsText = `${metrics.unitsDelta >= 0 ? '+' : ''}${formatNumber(metrics.unitsDelta, 0)}`;
      impact.push(`Scoped unit change versus baseline: ${unitsText} units.`);
      toplineItems.push({ label: 'Units', value: unitsText });
    }
    actions.push('Anchor inventory and promo readiness around the seasonal window.');
    actions.push('Use channel-specific depth rather than portfolio-wide markdowns.');
  } else {
    summary = promo?.story_summary || event.notes || 'Promotion window selected for analyst review.';
    if (Number.isFinite(metrics?.revenueDelta)) {
      const revenueText = formatSignedCurrency(metrics.revenueDelta);
      impact.push(`Revenue swing versus baseline: ${revenueText}.`);
      toplineItems.push({ label: 'Revenue', value: revenueText });
    }
    if (Number.isFinite(promo?.actual_roi)) {
      const roiText = `${promo.actual_roi.toFixed(2)}x`;
      impact.push(`Campaign ROI: ${roiText}.`);
      toplineItems.push({ label: 'ROI', value: roiText });
    }
    if (Number.isFinite(promo?.discount_pct)) {
      toplineItems.push({ label: 'Depth', value: `${promo.discount_pct.toFixed(0)}%` });
      actions.push(`Use ${promo.discount_pct.toFixed(0)}% as the current modeled discount reference point.`);
    }
    actions.push(`Keep the response focused on ${productInfo.label || 'the affected products'} only.`);
  }

  if (!impact.length && metrics?.resolvedWeek?.basis) {
    impact.push(`Signals are based on ${metrics.resolvedWeek.basis.toLowerCase()}.`);
  }
  if (!actions.length) {
    actions.push('Review this event alongside the timeline and signal snapshot before changing depth.');
  }

  return {
    selectedHtml: `
      <div class="step2-analyst-event-kicker">Top Event | Top This Week</div>
      <div class="step2-analyst-event-title">${headline}</div>
      <div class="step2-analyst-event-meta">${selectionMeta}</div>
      ${toplineItems.length ? `
        <div class="step2-analyst-topline">
          ${toplineItems.slice(0, 3).map(item => `
            <div class="step2-analyst-topline-item">
              <span class="step2-analyst-topline-label">${item.label}</span>
              <strong class="step2-analyst-topline-value">${item.value}</strong>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `,
    summary,
    impact: impact.slice(0, 3),
    actions: actions.slice(0, 3)
  };
}

function buildPromoStoryMetricsLegacy(promo) {
  const skuResults = Array.isArray(promo?.sku_results) ? promo.sku_results : [];
  const avgUplift = skuResults.length
    ? skuResults.reduce((sum, row) => sum + Number(row.sales_uplift_pct || 0), 0) / skuResults.length
    : null;
  const downCount = skuResults.filter(row => Number(row.sales_uplift_pct || 0) < 0 || row.outcome === 'down').length;
  const bestSku = [...skuResults].sort((a, b) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))[0];
  const worstSku = [...skuResults].sort((a, b) => Number(a.sales_uplift_pct || 0) - Number(b.sales_uplift_pct || 0))[0];
  const channelEntries = Object.entries(promo?.channel_results || {});
  const bestChannel = channelEntries
    .sort(([, a], [, b]) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))[0];
  return {
    avgUplift,
    downCount,
    roi: safeNumber(promo?.actual_roi, null),
    revenue: safeNumber(promo?.incremental_revenue_usd, null),
    bestChannel: bestChannel ? (CHANNEL_LABELS[bestChannel[0]] || bestChannel[0]) : null,
    bestChannelLift: bestChannel ? safeNumber(bestChannel[1]?.sales_uplift_pct, null) : null,
    bestSku: bestSku?.sku_name || bestSku?.sku_id || null,
    bestSkuLift: bestSku ? safeNumber(bestSku.sales_uplift_pct, null) : null,
    worstSku: worstSku?.sku_name || worstSku?.sku_id || null,
    worstSkuLift: worstSku ? safeNumber(worstSku.sales_uplift_pct, null) : null,
    discountPct: safeNumber(promo?.discount_pct, null),
    repeatLossExpected: Boolean(promo?.repeat_loss_expected)
  };
}
async function renderMarketSignalsDashboardV2Legacy() {
  const compContainer = document.getElementById('market-signals-competitive');
  const socialContainer = document.getElementById('market-signals-social');
  const compCanvas = document.getElementById('event-competitive-signals-chart');
  const socialCanvas = document.getElementById('event-social-signals-chart');
  const gapCallout = document.getElementById('step2-current-gap-callout');
  if (!compContainer || !socialContainer || !compCanvas || !socialCanvas) return;

  try {
    const [externalFactors, socialSignals, skuWeekly] = await Promise.all([
      loadExternalFactors(),
      loadSocialSignals(),
      loadSkuWeeklyData()
    ]);
    if (!externalFactors?.length || !socialSignals?.length || !skuWeekly?.length) {
      compContainer.textContent = 'Market signals not available.';
      socialContainer.textContent = 'Social listening data not available.';
      if (gapCallout) gapCallout.innerHTML = '';
      renderSignalSnapshot();
      renderSignalSnapshotAiRecommendation();
      return;
    }

    const toNum = value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const selectedFilter = getCurrentStep2ProductFilter();
    const selectionLabel = formatProductSelectionLabel(selectedFilter);
    const filteredSkuWeekly = skuWeekly.filter(row => rowMatchesProductSelection(row, selectedFilter));
    const { startDate, endDate } = getTimelineWindow();
    const filteredEvents = filterEvents().filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

    const skuFilterContainer = document.getElementById('sku-price-filter-container');
    if (skuFilterContainer) {
      skuFilterContainer.innerHTML = `
        <label for="sku-price-filter" class="form-label mb-0">Product/SKU:</label>
        <select id="sku-price-filter" class="form-select form-select-sm">
          ${buildUnifiedStep2ProductOptions().map(opt => `<option value="${opt.value}"${opt.value === selectedFilter ? ' selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      `;
      document.getElementById('sku-price-filter')?.addEventListener('change', event => {
        syncStep2ProductSelection(event.target.value || 'all');
      });
    }

    const compLegendContainer = document.getElementById('market-signals-competitive-legend');
    if (compLegendContainer) {
      compLegendContainer.innerHTML = `
        <div class="ec-legend-item"><span class="ec-legend-dot" style="background:#3b82f6; --legend-color:#3b82f6;"></span><span>Supergoop Mass Price</span></div>
        <div class="ec-legend-item"><span class="ec-legend-dot ec-legend-dot-dashed" style="background:#ef4444; --legend-color:#ef4444;"></span><span>Competitor Mass Price</span></div>
        <div class="ec-legend-item"><span class="ec-legend-dot" style="background:#10b981; --legend-color:#10b981;"></span><span>Supergoop Prestige Price</span></div>
        <div class="ec-legend-item"><span class="ec-legend-dot ec-legend-dot-dashed" style="background:#f59e0b; --legend-color:#f59e0b;"></span><span>Competitor Prestige Price</span></div>
      `;
    }

    const competitiveByWeek = new Map();
    filteredSkuWeekly.forEach(row => {
      const week = row.week_start || row.date;
      if (!week) return;
      if (!competitiveByWeek.has(week)) competitiveByWeek.set(week, { massOwnSum: 0, massOwnCount: 0, massCompSum: 0, massCompCount: 0, prestigeOwnSum: 0, prestigeOwnCount: 0, prestigeCompSum: 0, prestigeCompCount: 0, revenue: 0, engagementSum: 0, engagementCount: 0 });
      const bucket = competitiveByWeek.get(week);
      const ownPrice = toNum(row.effective_price);
      const competitorPrice = toNum(row.competitor_price);
      const engagement = toNum(row.social_engagement_score);
      const channelGroup = String(row.channel_group || '').toLowerCase();
      if (channelGroup === 'mass') {
        if (Number.isFinite(ownPrice)) { bucket.massOwnSum += ownPrice; bucket.massOwnCount += 1; }
        if (Number.isFinite(competitorPrice)) { bucket.massCompSum += competitorPrice; bucket.massCompCount += 1; }
      } else if (channelGroup === 'prestige') {
        if (Number.isFinite(ownPrice)) { bucket.prestigeOwnSum += ownPrice; bucket.prestigeOwnCount += 1; }
        if (Number.isFinite(competitorPrice)) { bucket.prestigeCompSum += competitorPrice; bucket.prestigeCompCount += 1; }
      }
      if (Number.isFinite(engagement)) { bucket.engagementSum += engagement; bucket.engagementCount += 1; }
      bucket.revenue += toNum(row.revenue) || 0;
    });

    const externalByWeek = new Map(externalFactors.map(row => [row.week_start || row.date, row]));
    const socialByWeek = new Map(socialSignals.map(row => [row.week_start || row.date, row]));
    const weekKeys = [...competitiveByWeek.keys()].sort();
    const compLabels = [];
    const compWeeks = [];
    const ourMassSeries = [];
    const compMassSeries = [];
    const ourPrestigeSeries = [];
    const compPrestigeSeries = [];
    const revenueSeries = [];
    const engagementSeries = [];
    weekKeys.forEach(week => {
      const bucket = competitiveByWeek.get(week);
      if (!bucket) return;
      const ownMass = bucket.massOwnCount > 0 ? bucket.massOwnSum / bucket.massOwnCount : null;
      const compMass = bucket.massCompCount > 0 ? bucket.massCompSum / bucket.massCompCount : null;
      const ownPrestige = bucket.prestigeOwnCount > 0 ? bucket.prestigeOwnSum / bucket.prestigeOwnCount : null;
      const compPrestige = bucket.prestigeCompCount > 0 ? bucket.prestigeCompSum / bucket.prestigeCompCount : null;
      if (![ownMass, compMass, ownPrestige, compPrestige].some(Number.isFinite)) return;
      compLabels.push(formatStep2Date(`${week}T00:00:00`, { month: 'short', day: 'numeric' }));
      compWeeks.push(week);
      ourMassSeries.push(Number.isFinite(ownMass) ? Number(ownMass.toFixed(2)) : null);
      compMassSeries.push(Number.isFinite(compMass) ? Number(compMass.toFixed(2)) : null);
      ourPrestigeSeries.push(Number.isFinite(ownPrestige) ? Number(ownPrestige.toFixed(2)) : null);
      compPrestigeSeries.push(Number.isFinite(compPrestige) ? Number(compPrestige.toFixed(2)) : null);
      revenueSeries.push(Number((bucket.revenue || 0).toFixed(0)));
      engagementSeries.push(bucket.engagementCount > 0 ? Number((bucket.engagementSum / bucket.engagementCount).toFixed(1)) : null);
    });

    const findLastFinitePair = (left, right) => {
      for (let index = Math.min(left.length, right.length) - 1; index >= 0; index -= 1) {
        if (Number.isFinite(left[index]) && Number.isFinite(right[index])) return index;
      }
      return -1;
    };
    const findLastFiniteIndex = series => {
      for (let index = series.length - 1; index >= 0; index -= 1) {
        if (Number.isFinite(series[index])) return index;
      }
      return -1;
    };

    if (compLabels.length) {
      if (eventCompetitiveSignalsChart) {
        eventCompetitiveSignalsChart.data.labels = compLabels;
        eventCompetitiveSignalsChart.data.datasets[0].data = ourMassSeries;
        eventCompetitiveSignalsChart.data.datasets[1].data = compMassSeries;
        eventCompetitiveSignalsChart.data.datasets[2].data = ourPrestigeSeries;
        eventCompetitiveSignalsChart.data.datasets[3].data = compPrestigeSeries;
        eventCompetitiveSignalsChart.options.layout = { padding: { top: 4, right: 160, bottom: 0, left: 0 } };
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
              { label: 'Supergoop Mass Price', data: ourMassSeries, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3b82f6', pointHoverRadius: 5 },
              { label: 'Competitor Mass Price', data: compMassSeries, borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#ef4444', pointHoverRadius: 4, borderDash: [5, 3] },
              { label: 'Supergoop Prestige Price', data: ourPrestigeSeries, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#10b981', pointHoverRadius: 5 },
              { label: 'Competitor Prestige Price', data: compPrestigeSeries, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3, fill: false, borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: '#f59e0b', pointHoverRadius: 4, borderDash: [5, 3] }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 4, right: 160, bottom: 0, left: 0 } },
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: compGridColor, drawBorder: false }, ticks: { color: compTextColor, font: { size: 10 }, maxRotation: 0 } },
              y: { grid: { color: compGridColor, drawBorder: false }, ticks: { color: compTextColor, font: { size: 10 }, callback: value => `$${value}` }, title: { display: true, text: 'Avg Price ($)', color: compTextColor, font: { size: 11, weight: '600' } } }
            }
          }
        });
      }

      const latestMassIdx = findLastFinitePair(ourMassSeries, compMassSeries);
      const latestPrestigeIdx = findLastFinitePair(ourPrestigeSeries, compPrestigeSeries);
      const prevMassIdx = latestMassIdx > 0 ? findLastFinitePair(ourMassSeries.slice(0, latestMassIdx), compMassSeries.slice(0, latestMassIdx)) : -1;
      const prevPrestigeIdx = latestPrestigeIdx > 0 ? findLastFinitePair(ourPrestigeSeries.slice(0, latestPrestigeIdx), compPrestigeSeries.slice(0, latestPrestigeIdx)) : -1;
      const calcGapPct = (ownSeries, compSeries, idx) => idx >= 0 && compSeries[idx] > 0 ? ((ownSeries[idx] - compSeries[idx]) / compSeries[idx]) * 100 : null;
      const massDeltaPct = calcGapPct(ourMassSeries, compMassSeries, latestMassIdx);
      const prestigeDeltaPct = calcGapPct(ourPrestigeSeries, compPrestigeSeries, latestPrestigeIdx);
      const prevMassGapPct = calcGapPct(ourMassSeries, compMassSeries, prevMassIdx);
      const prevPrestigeGapPct = calcGapPct(ourPrestigeSeries, compPrestigeSeries, prevPrestigeIdx);
      const averageGap = (ownSeries, compSeries) => {
        const gaps = ownSeries.map((value, index) => (Number.isFinite(value) && Number.isFinite(compSeries[index]) ? value - compSeries[index] : null)).filter(Number.isFinite);
        return gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : null;
      };
      const massAvgGapValue = averageGap(ourMassSeries, compMassSeries);
      const prestigeAvgGapValue = averageGap(ourPrestigeSeries, compPrestigeSeries);
      const dominantGap = [
        { tier: 'Mass', pct: massDeltaPct, absolute: latestMassIdx >= 0 ? ourMassSeries[latestMassIdx] - compMassSeries[latestMassIdx] : null, previousPct: prevMassGapPct },
        { tier: 'Prestige', pct: prestigeDeltaPct, absolute: latestPrestigeIdx >= 0 ? ourPrestigeSeries[latestPrestigeIdx] - compPrestigeSeries[latestPrestigeIdx] : null, previousPct: prevPrestigeGapPct }
      ].filter(item => Number.isFinite(item.pct)).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0] || null;
      const dominantGapChange = dominantGap && Number.isFinite(dominantGap.previousPct) ? dominantGap.pct - dominantGap.previousPct : null;
      const latestWeek = compWeeks[compWeeks.length - 1];
      const latestRevenue = revenueSeries[revenueSeries.length - 1] || 0;
      const latestEngagement = engagementSeries[engagementSeries.length - 1];
      const latestExternal = externalByWeek.get(latestWeek) || {};
      const latestSocialRow = socialByWeek.get(latestWeek) || socialSignals[socialSignals.length - 1] || {};
      const totalMentions = toNum(latestSocialRow.total_social_mentions) || 0;
      const promoEventsInWindow = filteredEvents.filter(event => String(event.event_type || '').includes('Promo')).length;
      const recentPromos = filteredEvents.filter(event => {
        const distance = Math.abs(new Date(event.date) - CALENDAR_TODAY);
        return distance <= (56 * DAY_MS) && (event.event_type === 'Promo Start' || event.event_type === 'Social Spike' || event.event_type === 'Competitor Price Change');
      }).length;
      const promoClutterIndex = toNum(latestExternal.promo_clutter_index) || 0;
      const promoIntensity = recentPromos >= 6 || promoClutterIndex >= 0.3 ? 'High' : recentPromos >= 3 || promoClutterIndex >= 0.22 ? 'Moderate' : 'Low';
      const currentEvent = getPriorityCurrentEvent(filteredEvents);
      const currentEventConfig = getEventDisplayConfig(currentEvent);
      const latestCompetitorEvent = [...filteredEvents].filter(event => event.event_type === 'Competitor Price Change').sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0] || null;
      const latestWeekRows = filteredSkuWeekly.filter(row => (row.week_start || row.date) === latestWeek);
      const demandLeader = [...latestWeekRows].filter(row => Number.isFinite(toNum(row.social_engagement_score))).sort((a, b) => {
        const scoreDiff = (toNum(b.social_engagement_score) || 0) - (toNum(a.social_engagement_score) || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (toNum(b.net_units_sold) || 0) - (toNum(a.net_units_sold) || 0);
      })[0] || null;

      if (gapCallout) {
        gapCallout.innerHTML = `
          <div class="step2-current-gap-title">Current Gap</div>
          <div class="step2-current-gap-week">${formatStep2Date(`${latestWeek}T00:00:00`, { month: 'short', day: 'numeric' })}</div>
          <div class="step2-current-gap-stack">
            <div class="step2-current-gap-stat"><span class="step2-current-gap-stat-label" data-tone="mass">Mass</span><strong class="step2-current-gap-stat-value">${Number.isFinite(massDeltaPct) ? `${massDeltaPct >= 0 ? '+' : ''}${massDeltaPct.toFixed(1)}%` : 'N/A'}</strong><span class="step2-current-gap-stat-copy">${latestMassIdx >= 0 ? `${formatSignedCurrency(ourMassSeries[latestMassIdx] - compMassSeries[latestMassIdx])} vs competitor` : selectionLabel}</span></div>
            <div class="step2-current-gap-stat"><span class="step2-current-gap-stat-label" data-tone="prestige">Prestige</span><strong class="step2-current-gap-stat-value">${Number.isFinite(prestigeDeltaPct) ? `${prestigeDeltaPct >= 0 ? '+' : ''}${prestigeDeltaPct.toFixed(1)}%` : 'N/A'}</strong><span class="step2-current-gap-stat-copy">${latestPrestigeIdx >= 0 ? `${formatSignedCurrency(ourPrestigeSeries[latestPrestigeIdx] - compPrestigeSeries[latestPrestigeIdx])} vs competitor` : selectionLabel}</span></div>
          </div>
        `;
      }

      const competitorMoveText = latestCompetitorEvent ? formatStep2Date(latestCompetitorEvent.date) : 'No direct competitor move';
      const competitorMoveCopy = latestCompetitorEvent && Number.isFinite(toNum(latestCompetitorEvent.price_before)) && Number.isFinite(toNum(latestCompetitorEvent.price_after)) ? `${formatEventChannelLabel(latestCompetitorEvent.affected_channel)} moved from ${formatCurrency(toNum(latestCompetitorEvent.price_before))} to ${formatCurrency(toNum(latestCompetitorEvent.price_after))}.` : (latestCompetitorEvent?.notes || 'Competitive pricing is currently stable.');
      compContainer.innerHTML = `
        <div class="ec-signal-grid">
          <div class="ec-signal-card"><div class="ec-signal-card-label">Latest Competitor Move</div><div class="ec-signal-card-value ${dominantGap && dominantGap.pct >= 1 ? 'text-danger' : 'text-success'}">${dominantGap ? `${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}%` : 'N/A'}</div><div class="ec-signal-card-sub">${competitorMoveText}</div><div class="ec-signal-card-meta">${competitorMoveCopy}</div></div>
          <div class="ec-signal-card"><div class="ec-signal-card-label">${compWeeks.length}-Week Seasonal Avg Gap</div><div class="ec-signal-card-stack"><div class="ec-signal-card-line"><span>Mass</span><strong class="${Number.isFinite(massAvgGapValue) && massAvgGapValue >= 0 ? 'text-danger' : 'text-success'}">${Number.isFinite(massAvgGapValue) ? formatSignedCurrency(massAvgGapValue) : 'N/A'}</strong></div><div class="ec-signal-card-line"><span>Prestige</span><strong class="${Number.isFinite(prestigeAvgGapValue) && prestigeAvgGapValue >= 0 ? 'text-danger' : 'text-success'}">${Number.isFinite(prestigeAvgGapValue) ? formatSignedCurrency(prestigeAvgGapValue) : 'N/A'}</strong></div></div><div class="ec-signal-card-meta">${selectionLabel} pricing is typically above competitor in both tiers.</div></div>
        </div>
      `;

      const currentEventProductInfo = currentEvent ? getEventProductInfo(currentEvent) : null;
      const currentEventPromo = currentEvent?.promo_id ? promoMetadata[currentEvent.promo_id] : null;
      const currentEventSubvalue = !currentEvent ? 'No event selected' : currentEvent.event_type === 'Competitor Price Change' && Number.isFinite(toNum(currentEvent.price_after)) ? `${formatEventChannelLabel(currentEvent.affected_channel)} cut to ${formatCurrency(toNum(currentEvent.price_after))}` : currentEvent.event_type === 'Social Spike' ? `${currentEventProductInfo?.productGroup || selectionLabel} buzz is carrying conversion` : currentEvent.event_type === 'Tentpole' ? `${extractTentpoleHolidayName(currentEvent) || 'Seasonal demand window'} is inside the planning view` : `${currentEventPromo?.campaign_name || 'Promo window'} is active in ${formatEventChannelLabel(currentEvent.affected_channel)}`;
      const currentEventFootnote = !currentEvent ? selectionLabel : currentEvent.event_type === 'Competitor Price Change' ? `Recommended pivot: defend exposed ${currentEventProductInfo?.label || selectionLabel} only.` : currentEvent.event_type === 'Social Spike' ? 'Recommended pivot: protect margin while creator demand stays supportive.' : currentEvent.event_type === 'Tentpole' ? 'Recommended pivot: align inventory and selective depth by channel.' : 'Recommended pivot: keep the offer narrow to the responsive products and channels.';
      renderSignalSnapshot({
        cards: [
          { tone: 'pricing', icon: 'bi-tag', label: 'Pricing Pressure', value: dominantGap ? `${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}%` : 'N/A', valueClass: dominantGap && dominantGap.pct >= 1 ? 'is-negative' : dominantGap && dominantGap.pct <= -1 ? 'is-positive' : 'is-neutral', subvalue: dominantGap ? `vs competitor (${dominantGap.tier})` : selectionLabel, chip: Number.isFinite(dominantGapChange) ? (dominantGapChange > 0.3 ? 'Gap Widening' : dominantGapChange < -0.3 ? 'Gap Compressing' : 'Gap Stable') : 'Gap Stable', footnote: dominantGap && dominantGap.pct >= 1 ? 'Risk to margin and volume' : 'Pricing position remains manageable' },
          { tone: 'demand', icon: 'bi-chat-square-heart', label: 'Demand Momentum', headline: Number.isFinite(latestEngagement) && latestEngagement >= 72 ? 'High' : Number.isFinite(latestEngagement) && latestEngagement >= 63 ? 'Solid' : 'Mixed', subvalue: Number.isFinite(latestEngagement) ? `${selectionLabel} engagement ${latestEngagement.toFixed(1)}` : 'Demand trend not available', chip: demandLeader ? 'Demand Leader' : 'Demand Steady', footnote: demandLeader ? `Led by ${getSkuName(demandLeader.sku_id)} in ${CHANNEL_LABELS[demandLeader.sales_channel] || demandLeader.sales_channel}` : `Watching ${selectionLabel}` },
          { tone: 'promo', icon: 'bi-tags', label: 'Promo Intensity', headline: promoIntensity, subvalue: `${promoEventsInWindow} promo starts in the last 52 weeks`, chip: promoIntensity === 'High' ? 'Tight Market' : promoIntensity === 'Moderate' ? 'Room to Optimize' : 'Promo Light', footnote: `Promo clutter index ${promoClutterIndex.toFixed(3)}` },
          { tone: 'event', icon: currentEventConfig.icon, label: 'Recent Market Event', headline: currentEvent?.event_type === 'Competitor Price Change' ? 'Competitor active' : currentEvent?.event_type === 'Social Spike' ? 'Buzz rising' : currentEvent?.event_type === 'Tentpole' ? 'Seasonal window' : 'Promo in flight', subvalue: currentEventSubvalue, chip: currentEvent?.event_type === 'Competitor Price Change' ? 'Action Recommended' : currentEvent ? 'Monitor Closely' : 'No Trigger', footnote: currentEventFootnote }
        ],
        feedItems: [
          { icon: 'bi-distribute-horizontal', label: 'Pricing Data', copy: dominantGap ? `${selectionLabel} gap is ${dominantGap.pct >= 0 ? '+' : ''}${dominantGap.pct.toFixed(1)}% versus competitor.` : `Monitoring ${selectionLabel} price position.` },
          { icon: 'bi-calendar3-event', label: 'Event Data', copy: `${filteredEvents.length} visible signals are shaping the current Step 2 view.` },
          { icon: 'bi-megaphone', label: 'Marketing/Social Data', copy: `Brand buzz is at ${formatNumber(totalMentions)} mentions and blended with ${selectionLabel.toLowerCase()} engagement.` },
          { icon: 'bi-bar-chart', label: 'Sales Performance Data', copy: `Latest scoped weekly revenue is ${formatCurrency(latestRevenue)} with engagement at ${Number.isFinite(latestEngagement) ? latestEngagement.toFixed(1) : 'N/A'}.` }
        ]
      });
      renderSignalSnapshotAiRecommendation({
        event: currentEvent,
        fallbackRecommendation: currentEventFootnote,
        selectedScope: {
          productFilter: getCurrentStep2ProductFilter(),
          selectionLabel
        },
        signalSnapshot: {
          dominantGapPct: dominantGap?.pct ?? null,
          dominantGapTier: dominantGap?.tier || null,
          dominantGapChange: Number.isFinite(dominantGapChange) ? dominantGapChange : null,
          latestEngagement: Number.isFinite(latestEngagement) ? latestEngagement : null,
          demandLeaderSku: demandLeader?.sku_id || null,
          demandLeaderChannel: demandLeader?.sales_channel || null,
          promoIntensity,
          promoEventsInWindow,
          promoClutterIndex: Number.isFinite(promoClutterIndex) ? promoClutterIndex : null
        }
      });
    } else {
      compContainer.textContent = 'Insufficient competitive price history for chart rendering.';
      if (gapCallout) gapCallout.innerHTML = '';
      renderSignalSnapshot();
      renderSignalSnapshotAiRecommendation();
    }

    const demandSeries = buildStep2DemandSeries(filteredSkuWeekly, socialByWeek);
    const socialLabels = demandSeries.labels;
    const socialScoreSeries = demandSeries.scoreSeries;
    const socialElasticitySeries = demandSeries.modifierSeries;
    const socialWeekKeys = demandSeries.weekKeys;
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
              { label: 'Social Sentiment', data: socialScoreSeries, borderColor: '#0ea5e9', backgroundColor: socIsDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)', fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#0ea5e9', pointHoverRadius: 6, pointHoverBackgroundColor: '#0ea5e9', yAxisID: 'y' },
              { label: 'Elasticity Modifier', data: socialElasticitySeries, borderColor: '#8b5cf6', backgroundColor: 'transparent', fill: false, tension: 0.35, borderWidth: 2, borderDash: [6, 4], pointRadius: 2.5, pointBackgroundColor: '#8b5cf6', pointHoverRadius: 5, yAxisID: 'y1' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { color: socTextColor, font: { size: 11, weight: '500' }, boxWidth: 14, padding: 16, usePointStyle: true, pointStyle: 'circle' } } },
            scales: {
              x: { grid: { color: socGridColor, drawBorder: false }, ticks: { color: socTextColor, font: { size: 10 }, maxRotation: 0 } },
              y: { min: -100, max: 100, grid: { color: socGridColor, drawBorder: false }, ticks: { color: socTextColor, font: { size: 10 }, stepSize: 25 }, title: { display: true, text: 'Social Sentiment (-100 to +100)', color: '#0ea5e9', font: { size: 11, weight: '600' } } },
              y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: socTextColor, font: { size: 10 }, callback: value => `${value}x` }, title: { display: true, text: 'Elasticity Modifier', color: '#8b5cf6', font: { size: 11, weight: '600' } } }
            }
          }
        });
      }
      const latestSocialIdx = findLastFiniteIndex(socialScoreSeries);
      const prevSocialIdx = latestSocialIdx > 0 ? findLastFiniteIndex(socialScoreSeries.slice(0, latestSocialIdx)) : -1;
      const latestElasticityIdx = findLastFiniteIndex(socialElasticitySeries);
      const prevElasticityIdx = latestElasticityIdx > 0 ? findLastFiniteIndex(socialElasticitySeries.slice(0, latestElasticityIdx)) : -1;
      const socialScoreWoW = latestSocialIdx >= 0 && prevSocialIdx >= 0 ? socialScoreSeries[latestSocialIdx] - socialScoreSeries[prevSocialIdx] : 0;
      const elasticityWoW = latestElasticityIdx >= 0 && prevElasticityIdx >= 0 ? socialElasticitySeries[latestElasticityIdx] - socialElasticitySeries[prevElasticityIdx] : 0;
      const latestRow = socialByWeek.get(socialWeekKeys[Math.max(latestSocialIdx, 0)]) || socialSignals[socialSignals.length - 1] || {};
      const totalMentions = toNum(latestRow.total_social_mentions) || 0;
      const tiktokMentions = toNum(latestRow.tiktok_mentions) || 0;
      const instagramMentions = toNum(latestRow.instagram_mentions) || 0;
      const tiktokPct = totalMentions > 0 ? ((tiktokMentions / totalMentions) * 100).toFixed(0) : '0';
      const instaPct = totalMentions > 0 ? ((instagramMentions / totalMentions) * 100).toFixed(0) : '0';
      const finiteScores = socialScoreSeries.filter(Number.isFinite);
      const peakScore = finiteScores.length ? Math.max(...finiteScores) : 0;
      const troughScore = finiteScores.length ? Math.min(...finiteScores) : 0;
      socialContainer.innerHTML = `
        <div class="d-flex flex-wrap gap-3 mt-2">
          <div class="ec-signal-card"><div class="ec-signal-card-label">Social Sentiment</div><div class="ec-signal-card-value ${socialScoreWoW >= 2 ? 'text-success' : socialScoreWoW <= -2 ? 'text-danger' : ''}">${latestSocialIdx >= 0 ? formatSignedScoreText(socialScoreSeries[latestSocialIdx]) : 'N/A'}</div><div class="ec-signal-card-sub">${formatSignedPointText(socialScoreWoW)} WoW</div></div>
          <div class="ec-signal-card"><div class="ec-signal-card-label">Elasticity Modifier</div><div class="ec-signal-card-value ${elasticityWoW < -0.01 ? 'text-success' : elasticityWoW > 0.01 ? 'text-danger' : ''}">${latestElasticityIdx >= 0 ? `${socialElasticitySeries[latestElasticityIdx].toFixed(3)}x` : 'N/A'}</div><div class="ec-signal-card-sub">${elasticityWoW >= 0 ? '+' : ''}${elasticityWoW.toFixed(3)} WoW</div></div>
          <div class="ec-signal-card"><div class="ec-signal-card-label">Total Mentions</div><div class="ec-signal-card-value">${formatNumber(totalMentions)}</div><div class="ec-signal-card-sub">TikTok ${tiktokPct}% | Insta ${instaPct}%</div></div>
          <div class="ec-signal-card"><div class="ec-signal-card-label">Season Range</div><div class="ec-signal-card-value">${troughScore.toFixed(0)} to ${peakScore.toFixed(0)}</div><div class="ec-signal-card-sub">Peak ${peakScore.toFixed(1)} | Low ${troughScore.toFixed(1)}</div></div>
        </div>
      `;
    } else {
      socialContainer.textContent = 'Insufficient social history for chart rendering.';
    }
  } catch (error) {
    console.error('Error rendering Market Signals dashboard:', error);
    compContainer.textContent = 'Error loading market signals.';
    socialContainer.textContent = 'Error loading social listening data.';
    if (gapCallout) gapCallout.innerHTML = '';
    renderSignalSnapshot();
    renderSignalSnapshotAiRecommendation();
  }
}
function renderEventTimelineV2Legacy() {
  const container = document.getElementById('event-timeline');
  if (!container) return;

  const { startDate, endDate } = getTimelineWindow();
  const filteredEvents = filterEvents().filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= startDate && eventDate <= endDate;
  });

  updateEventCountBadge(filteredEvents.length);
  renderStep2DateRange();

  if (!filteredEvents.length) {
    container.innerHTML = '<div class="step2-timeline-frame text-center text-muted">No events match the current filters.</div>';
    renderGuidedStorylineExamplesV2([]);
    renderEventAnalystSelection(null);
    return;
  }

  const totalDays = Math.max(1, Math.floor((endDate - startDate) / DAY_MS));
  const todayPosition = Math.max(0, Math.min(100, ((CALENDAR_TODAY - startDate) / DAY_MS / totalDays) * 100));
  const monthMarkers = buildTimelineMonthMarkers(startDate, endDate);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const yearSpan = Math.max(1, endYear - startYear);
  const highlightEvents = buildTimelineHighlights(filteredEvents, 6);

  let html = `
    <div class="step2-timeline-frame">
      <div class="step2-timeline-legend">
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#ef4444;"></span>Competitor Price Cut</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#8b5cf6;"></span>Promo</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#3b82f6;"></span>Social Spike</span>
        <span class="step2-timeline-legend-item"><span class="step2-timeline-legend-dot" style="background:#f59e0b;"></span>Seasonal</span>
      </div>
      <div class="step2-timeline-meta">
        <div><i class="bi bi-clock-history me-1"></i>History: Last 12 Months</div>
        <div class="step2-timeline-meta-center">Today: ${formatStep2Date(CALENDAR_TODAY)}</div>
        <div class="text-md-end"><i class="bi bi-calendar2-week me-1"></i>Future: Next 12 Months</div>
      </div>
      <div class="step2-timeline-ruler">
        <div class="step2-timeline-year-row">
  `;

  for (let i = 0; i <= yearSpan; i += 1) {
    const year = startYear + i;
    const position = (i / yearSpan) * 100;
    html += `<div class="step2-timeline-year" style="left:${position}%;">${year}</div>`;
  }

  html += `
        </div>
        <div class="step2-timeline-month-row">
          ${monthMarkers.map(marker => `<div class="step2-timeline-month" style="left:${marker.position}%;">${marker.label}</div>`).join('')}
        </div>
        <div class="step2-timeline-track">
          ${monthMarkers.map(marker => `<div class="step2-timeline-guide${marker.isMajor ? ' is-major' : ''}" style="left:${marker.position}%;"></div>`).join('')}
          <div class="step2-timeline-today" style="left:${todayPosition}%;"><span>Today</span></div>
          ${filteredEvents.map(event => {
            const eventDate = new Date(event.date);
            const position = ((eventDate - startDate) / DAY_MS / totalDays) * 100;
            const config = getEventDisplayConfig(event);
            return `<button type="button" class="step2-timeline-dot" data-event-id="${event.event_id}" data-type="${config.type}" style="left:${position}%;"></button>`;
          }).join('')}
        </div>
  `;

  const laneEnds = [-100, -100, -100];
  html += '<div class="step2-timeline-highlight-row">';
  highlightEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const position = ((eventDate - startDate) / DAY_MS / totalDays) * 100;
    const config = getEventDisplayConfig(event);
    const promo = event.promo_id ? promoMetadata[event.promo_id] : null;
    const productInfo = getEventProductInfo(event);
    const laneIndex = laneEnds.findIndex(lastEnd => lastEnd + 18 <= position);
    const resolvedLane = laneIndex >= 0 ? laneIndex : 0;
    laneEnds[resolvedLane] = position;
    const top = resolvedLane * 58;
    html += `
      <button type="button" class="step2-timeline-highlight" data-event-id="${event.event_id}" data-type="${config.type}" style="left:${position}%; top:${top}px;">
        <span class="step2-timeline-chip">${formatStep2Date(event.date, { month: 'short', day: 'numeric' })}</span>
        <div class="step2-timeline-highlight-title">${buildTimelineEventTitle(event, promo, productInfo)}</div>
        <div class="step2-timeline-highlight-copy">${buildTimelineEventCopy(event, promo, productInfo)}</div>
        <div class="step2-timeline-highlight-meta">${buildTimelineEventMeta(event, productInfo)}</div>
      </button>
    `;
  });
  html += '</div></div></div>';

  container.innerHTML = html;

  const selectEvent = eventId => {
    const selectedEvent = filteredEvents.find(event => event.event_id === eventId);
    if (!selectedEvent) return;
    container.querySelectorAll('[data-event-id]').forEach(node => {
      node.classList.toggle('is-selected', node.dataset.eventId === eventId);
    });
    renderEventAnalystSelection(selectedEvent);
    if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
      window.onEventCalendarEventSelected(selectedEvent);
    }
  };

  container.querySelectorAll('.step2-timeline-dot, .step2-timeline-highlight').forEach(node => {
    node.addEventListener('click', () => selectEvent(node.dataset.eventId));
  });

  const defaultEvent = getPriorityCurrentEvent(filteredEvents) || highlightEvents[0];
  if (defaultEvent) {
    selectEvent(defaultEvent.event_id);
  }

  renderGuidedStorylineExamplesV2(filteredEvents);
}
function renderGuidedStorylineExamplesV2Legacy(filteredEvents = []) {
  const container = document.getElementById('event-storyline-examples');
  if (!container) return;

  const visibleEvents = Array.isArray(filteredEvents) ? filteredEvents : [];
  const visiblePromos = Object.values(promoMetadata || {})
    .filter(promo => promoMatchesActiveProductFilter(promo))
    .map(promo => ({ promo, metrics: buildPromoStoryMetrics(promo) }));

  if (!visibleEvents.length && !visiblePromos.length) {
    container.innerHTML = '<div class="text-muted small">No guided examples available for the current product/filter selection.</div>';
    return;
  }

  const nearestEvent = predicate => [...visibleEvents]
    .filter(predicate)
    .sort((a, b) => Math.abs(new Date(a.date) - CALENDAR_TODAY) - Math.abs(new Date(b.date) - CALENDAR_TODAY))[0];
  const rankPromos = list => [...list].sort((a, b) => {
    const revenueDiff = safeNumber(b.metrics.revenue, 0) - safeNumber(a.metrics.revenue, 0);
    if (revenueDiff !== 0) return revenueDiff;
    return safeNumber(b.metrics.roi, 0) - safeNumber(a.metrics.roi, 0);
  });
  const hasTag = (promo, tag) => (promo?.campaign_tags || []).some(item => String(item).toLowerCase() === tag);

  const competitorEvent = nearestEvent(event => event.event_type === 'Competitor Price Change');
  const socialEvent = nearestEvent(event => event.event_type === 'Social Spike');
  const seasonalEvent = nearestEvent(event => event.event_type === 'Tentpole');
  const usedPromoIds = new Set();
  const pickPromo = candidates => {
    const match = candidates.find(item => !usedPromoIds.has(item.promo.promo_id));
    if (match) usedPromoIds.add(match.promo.promo_id);
    return match || null;
  };

  const competitorPromo = pickPromo(rankPromos(visiblePromos.filter(({ promo }) => hasTag(promo, 'competitive') || String(promo.story_summary || '').toLowerCase().includes('competitor'))));
  const socialPromo = pickPromo(rankPromos(visiblePromos.filter(({ promo }) => hasTag(promo, 'social') || String(promo.story_summary || '').toLowerCase().includes('social'))));
  const selectivePromo = pickPromo(rankPromos(visiblePromos.filter(({ promo, metrics }) => (promo.eligible_channels || []).some(channel => ['sephora', 'ulta'].includes(String(channel).toLowerCase())) && safeNumber(metrics.discountPct, 99) <= 8)));
  const cautionPromo = pickPromo([...visiblePromos].filter(({ metrics, promo }) => (metrics.downCount || 0) > 0 || metrics.repeatLossExpected || String(promo.notes || '').toLowerCase().includes('exclude')).sort((a, b) => {
    const downDiff = (b.metrics.downCount || 0) - (a.metrics.downCount || 0);
    if (downDiff !== 0) return downDiff;
    return safeNumber(a.metrics.roi, 99) - safeNumber(b.metrics.roi, 99);
  }));

  const stories = [
    competitorPromo ? {
      tone: 'competitor',
      badge: 'Competitor Move',
      title: 'Defend only where the competitor cuts price',
      copy: `${competitorPromo.promo.campaign_name} protected the exposed mass business, but ${competitorPromo.metrics.worstSku ? `${competitorPromo.metrics.worstSku} still lagged ${competitorPromo.metrics.worstSkuLift >= 0 ? '+' : ''}${competitorPromo.metrics.worstSkuLift.toFixed(1)}%.` : 'the weak SKUs still need to be excluded next cycle.'}`,
      metaItems: [
        { label: 'Best Channel', value: competitorPromo.metrics.bestChannel ? `${competitorPromo.metrics.bestChannel}${Number.isFinite(competitorPromo.metrics.bestChannelLift) ? ` (${competitorPromo.metrics.bestChannelLift >= 0 ? '+' : ''}${competitorPromo.metrics.bestChannelLift.toFixed(1)}%)` : ''}` : 'Target / Amazon focus' },
        { label: 'Projected Impact', value: Number.isFinite(competitorPromo.metrics.revenue) ? formatSignedCurrency(competitorPromo.metrics.revenue) : 'Volume protection' },
        { label: 'Lesson', value: competitorPromo.metrics.downCount ? `Exclude ${competitorPromo.metrics.downCount} weak SKU(s) from the next defense wave.` : 'Keep the response narrow to exposed SPF only.' }
      ],
      eventId: nearestEvent(event => event.promo_id === competitorPromo.promo.promo_id)?.event_id || competitorEvent?.event_id || null
    } : null,
    socialPromo ? {
      tone: 'social',
      badge: 'Social-Led Hold',
      title: 'When social momentum is high, stay shallow on discount',
      copy: `${socialPromo.promo.campaign_name} delivered ${Number.isFinite(socialPromo.metrics.roi) ? `${socialPromo.metrics.roi.toFixed(2)}x ROI` : 'strong returns'} with only ${Number.isFinite(socialPromo.metrics.discountPct) ? `${socialPromo.metrics.discountPct.toFixed(0)}% depth` : 'light depth'}, showing that creator demand can do the conversion work.`,
      metaItems: [
        { label: 'Best Channel', value: socialPromo.metrics.bestChannel ? `${socialPromo.metrics.bestChannel}${Number.isFinite(socialPromo.metrics.bestChannelLift) ? ` (${socialPromo.metrics.bestChannelLift >= 0 ? '+' : ''}${socialPromo.metrics.bestChannelLift.toFixed(1)}%)` : ''}` : 'Prestige focus' },
        { label: 'ROI', value: Number.isFinite(socialPromo.metrics.roi) ? `${socialPromo.metrics.roi.toFixed(2)}x` : 'N/A' },
        { label: 'Lesson', value: 'Protect price when buzz and prestige conversion are both carrying demand.' }
      ],
      eventId: nearestEvent(event => event.promo_id === socialPromo.promo.promo_id)?.event_id || socialEvent?.event_id || null
    } : null,
    selectivePromo ? {
      tone: 'promo',
      badge: 'Selective Promo',
      title: 'Prestige should be selective, not broad',
      copy: `${selectivePromo.promo.campaign_name} is the clearest example of targeted prestige depth. It lifts the responsive products without putting the whole portfolio into markdown.`,
      metaItems: [
        { label: 'Best Channel', value: selectivePromo.metrics.bestChannel ? `${selectivePromo.metrics.bestChannel}${Number.isFinite(selectivePromo.metrics.bestChannelLift) ? ` (${selectivePromo.metrics.bestChannelLift >= 0 ? '+' : ''}${selectivePromo.metrics.bestChannelLift.toFixed(1)}%)` : ''}` : 'Sephora / Ulta' },
        { label: 'Projected Impact', value: Number.isFinite(selectivePromo.metrics.revenue) ? formatSignedCurrency(selectivePromo.metrics.revenue) : 'Selective lift' },
        { label: 'Lesson', value: Number.isFinite(selectivePromo.metrics.avgUplift) ? `Average uplift ${selectivePromo.metrics.avgUplift >= 0 ? '+' : ''}${selectivePromo.metrics.avgUplift.toFixed(1)}% across the included SKUs.` : 'Use narrow depth on the highest-response prestige products.' }
      ],
      eventId: nearestEvent(event => event.promo_id === selectivePromo.promo.promo_id)?.event_id || null
    } : null,
    cautionPromo ? {
      tone: 'caution',
      badge: 'Caution',
      title: 'Mixed promo results need tighter SKU selection',
      copy: `${cautionPromo.promo.campaign_name} created lift, but ${cautionPromo.metrics.worstSku ? `${cautionPromo.metrics.worstSku} still moved ${cautionPromo.metrics.worstSkuLift >= 0 ? '+' : ''}${cautionPromo.metrics.worstSkuLift.toFixed(1)}%.` : 'the weakest SKUs still diluted the result.'} Use it as the exclusion template for the next cycle.`,
      metaItems: [
        { label: 'Down SKU', value: cautionPromo.metrics.worstSku || `${cautionPromo.metrics.downCount || 0} weak SKU(s)` },
        { label: 'Revenue', value: Number.isFinite(cautionPromo.metrics.revenue) ? formatSignedCurrency(cautionPromo.metrics.revenue) : 'Mixed return' },
        { label: 'Lesson', value: cautionPromo.metrics.repeatLossExpected ? 'Broad promo logic creates repeat-loss risk if you do not exclude the weak products.' : 'Tighten the SKU list before the next wave.' }
      ],
      eventId: nearestEvent(event => event.promo_id === cautionPromo.promo.promo_id)?.event_id || seasonalEvent?.event_id || null
    } : null
  ].filter(Boolean);

  if (!stories.length) {
    container.innerHTML = '<div class="text-muted small">No guided examples available for the current product/filter selection.</div>';
    return;
  }

  if (window.renderStep2AiStorylines && typeof window.renderStep2AiStorylines === 'function') {
    window.renderStep2AiStorylines({
      stories,
      visibleEvents,
      selectedScope: {
        productFilter: getCurrentStep2ProductFilter(),
        selectionLabel: formatProductSelectionLabel(getCurrentStep2ProductFilter())
      },
      signalSnapshot: {
        storyCount: stories.length,
        eventCount: visibleEvents.length
      }
    });
    return;
  }

  container.innerHTML = stories.map(story => `
    <article class="step2-story-card" data-story-tone="${story.tone}"${story.eventId ? ` data-event-id="${story.eventId}"` : ''}>
      <div class="step2-story-badge">${story.badge}</div>
      <div class="step2-story-title">${story.title}</div>
      <div class="step2-story-copy">${story.copy}</div>
      <div class="step2-story-meta">
        ${story.metaItems.map(item => `
          <div class="step2-story-meta-row">
            <span class="step2-story-meta-label">${item.label}</span>
            <span class="step2-story-meta-value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-event-id]').forEach(card => {
    card.addEventListener('click', () => {
      const eventId = card.dataset.eventId;
      document.querySelectorAll('#event-timeline [data-event-id]').forEach(node => {
        node.classList.toggle('is-selected', node.dataset.eventId === eventId);
      });
      const event = visibleEvents.find(item => item.event_id === eventId) || (allEvents || []).find(item => item.event_id === eventId);
      if (!event) return;
      renderEventAnalystSelection(event);
      if (window.onEventCalendarEventSelected && typeof window.onEventCalendarEventSelected === 'function') {
        window.onEventCalendarEventSelected(event);
      }
    });
  });
}
