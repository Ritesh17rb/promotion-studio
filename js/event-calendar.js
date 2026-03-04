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
  loadCompetitorPriceFeed
} from './data-loader.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

// Global state
let allEvents = [];
let promoMetadata = {};
let validationWindows = {};
let skuCatalog = new Map();
let competitorFeed = [];
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
  baseline: 'Start of Season',
  pivot: 'In-Season Pivot',
  future: 'Future Vision'
};

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

/**
 * Initialize event calendar section
 */
export async function initializeEventCalendar() {
  console.log('Initializing Event Calendar...');

  try {
    // Load all data
    let skuWeeklyData = [];
    [allEvents, promoMetadata, validationWindows, skuWeeklyData, competitorFeed] = await Promise.all([
      loadEventCalendar(),
      loadPromoMetadata(),
      loadValidationWindows(),
      loadSkuWeeklyData(),
      loadCompetitorPriceFeed()
    ]);
    hydrateSkuCatalog(skuWeeklyData || []);

    // Update event count badge
    updateEventCountBadge();

    // Render all components
    renderMarketSignalsDashboard();
    renderEventTimeline();
    renderEventTable();
    initializePromoControls();
    renderPromoMethodology();
    renderPromoCards();
    renderPromoStoryVisuals(getFilteredPromos());
    renderValidationWindows();

    // Setup event listeners
    setupEventFilters();

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
      priceChange: events.filter(e => e.event_type === 'Price Change').length,
      competitorPriceChange: events.filter(e => e.event_type === 'Competitor Price Change').length,
      promo: events.filter(e => (e.event_type || '').includes('Promo') || e.event_type === 'Social Spike').length,
      tentpole: events.filter(e => e.event_type === 'Tentpole').length
    };
    badge.textContent = `${events.length} Events (${counts.priceChange} Price Changes, ${counts.competitorPriceChange} Competitor Moves, ${counts.promo} Promos, ${counts.tentpole} Tentpoles)`;
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
        eventCompetitiveSignalsChart = new Chart(compCanvas, {
          type: 'line',
          data: {
            labels: compLabels,
            datasets: [
              { label: 'Our Mass Avg Price', data: ourMassSeries, borderColor: 'rgba(2, 132, 199, 0.95)', tension: 0.25, fill: false },
              { label: 'Competitor Mass Price', data: compMassSeries, borderColor: 'rgba(239, 68, 68, 0.95)', tension: 0.25, fill: false },
              { label: 'Our Prestige Avg Price', data: ourPrestigeSeries, borderColor: 'rgba(16, 185, 129, 0.95)', tension: 0.25, borderDash: [4, 3], fill: false },
              { label: 'Competitor Prestige Price', data: compPrestigeSeries, borderColor: 'rgba(217, 119, 6, 0.95)', tension: 0.25, borderDash: [4, 3], fill: false }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
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

      compContainer.innerHTML = `
        <div><strong>Latest delta vs competitor:</strong> Mass ${massDeltaPct >= 0 ? '+' : ''}${massDeltaPct.toFixed(1)}%, Prestige ${prestigeDeltaPct >= 0 ? '+' : ''}${prestigeDeltaPct.toFixed(1)}%.</div>
        <div class="mt-1"><strong>Week-over-week competitor move:</strong> Mass ${massCompWoW >= 0 ? '+' : ''}${massCompWoW.toFixed(2)}, Prestige ${prestigeCompWoW >= 0 ? '+' : ''}${prestigeCompWoW.toFixed(2)}.</div>
        <div class="mt-1">Method: own weekly price is averaged from <code>sku_channel_weekly.csv</code>; competitor weekly price is from <code>market_signals.csv</code>.</div>
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
        eventSocialSignalsChart = new Chart(socialCanvas, {
          type: 'line',
          data: {
            labels: socialLabels,
            datasets: [
              { label: 'Brand Social Score', data: socialScoreSeries, borderColor: 'rgba(14, 165, 233, 0.95)', fill: false, tension: 0.25, yAxisID: 'y' },
              { label: 'Elasticity Modifier', data: socialElasticitySeries, borderColor: 'rgba(99, 102, 241, 0.95)', fill: false, tension: 0.25, yAxisID: 'y1' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
              y: { title: { display: true, text: 'Social score' } },
              y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Elasticity modifier' } }
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

      socialContainer.innerHTML = `
        <div><strong>Latest social score:</strong> ${socialScoreSeries[latestSocialIdx]?.toFixed(1) || 'N/A'} (${socialScoreWoW >= 0 ? '+' : ''}${socialScoreWoW.toFixed(1)} WoW).</div>
        <div class="mt-1"><strong>Implied elasticity modifier:</strong> ${socialElasticitySeries[latestSocialIdx]?.toFixed(3) || 'N/A'} (${elasticityWoW >= 0 ? '+' : ''}${elasticityWoW.toFixed(3)} WoW).</div>
        <div class="mt-1"><strong>Mention mix:</strong> ${formatNumber(totalMentions)} total, TikTok ${formatNumber(tiktokMentions)}, Instagram ${formatNumber(instagramMentions)}.</div>
        <div class="mt-1">Method: score from <code>social_signals.csv</code>; modifier uses the same transformation used by the promotion simulator.</div>
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
  const filteredEvents = filterEvents();

  if (!filteredEvents || filteredEvents.length === 0) {
    container.innerHTML = '<div class="text-center text-muted">No events match the current filters</div>';
    return;
  }

  // Get date range from data
  const eventDates = filteredEvents.map(event => new Date(event.date));
  const startDate = new Date(Math.min(...eventDates));
  const endDate = new Date(Math.max(...eventDates));
  const totalDays = Math.max(1, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));

  // Build timeline slider HTML
  let html = '<div class="timeline-slider-container">';

  // Legend
  html += `
    <div class="d-flex justify-content-center gap-4 mb-3">
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--dplus-green); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);"></div>
        <span class="ms-2 small">Price Changes</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);"></div>
        <span class="ms-2 small">Competitor Price Changes</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--dplus-blue); box-shadow: 0 0 0 4px rgba(0, 102, 255, 0.2);"></div>
        <span class="ms-2 small">Promos</span>
      </div>
      <div class="d-flex align-items-center">
        <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--dplus-orange); box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);"></div>
        <span class="ms-2 small">Seasonal Tentpoles</span>
      </div>
    </div>
    <p class="text-center text-muted small mb-3"><i class="bi bi-info-circle me-1"></i>Click on any event marker to see details</p>
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

  // Timeline track
  html += '<div class="timeline-track">';

  // Add event markers
  filteredEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const daysSinceStart = Math.floor((eventDate - startDate) / (1000 * 60 * 60 * 24));
    const positionPercent = (daysSinceStart / totalDays) * 100;

    // Determine event class based on type
    let eventClass = 'timeline-event';
    if (event.event_type === 'Price Change') {
      eventClass += ' event-price';
    } else if (event.event_type === 'Competitor Price Change') {
      eventClass += ' event-competitor';
    } else if (event.event_type.includes('Promo') || event.event_type === 'Social Spike') {
      eventClass += ' event-promo';
    } else if (event.event_type === 'Tentpole') {
      eventClass += ' event-content';
    }

    html += `
      <div class="${eventClass}"
           style="left: ${positionPercent}%;"
           data-event-id="${event.event_id}"
           title="${event.event_type} - ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}">
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
function showEventDetails(event) {
  const detailsPanel = document.getElementById('timeline-details');
  if (!detailsPanel) return;

  const eventDate = new Date(event.date);
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const badge = getEventBadge(event.event_type);
  const priceInfo = getEventPriceInfo(event);
  const promoContext = buildEventPromoContext(event);

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
      <p class="mb-2">${event.notes || 'No description available'}</p>
      ${priceInfo ? `<div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i>${priceInfo}</div>` : ''}
      ${promoContext}
    </div>
  `;

  detailsPanel.innerHTML = html;
  detailsPanel.style.display = 'block';

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
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No events match the current filters</td></tr>';
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

    html += `
      <tr>
        <td class="text-nowrap">${dateStr}</td>
        <td><span class="badge ${badge.class}">${badge.text}</span></td>
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
      `Showing ${promos.length} campaigns. Story flow: ${phaseCounts.baseline} start-of-season, ${phaseCounts.pivot} in-season pivots, ${phaseCounts.future} future-vision. SKU outcomes: ${filteredSkuRows.length}, average uplift ${filteredAvgUplift >= 0 ? '+' : ''}${filteredAvgUplift.toFixed(1)}%, down outcomes ${filteredDownCount}.`;
  }

  let html = '';
  promos.forEach(promo => {
    const status = promo.actual_adds ? 'Complete' : 'In Progress';
    const statusClass = promo.actual_adds ? 'success' : 'warning';
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

    html += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card h-100">
          <div class="card-header bg-${statusClass} text-white">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0">${promo.campaign_name}</h6>
              <span class="badge text-dark">${status}</span>
            </div>
          </div>
          <div class="card-body">
            <div class="mb-2">
              <span class="badge bg-primary-subtle text-primary">${storyPhase}</span>
            </div>
            ${channelLine ? `<div class="mb-2"><strong>Channel:</strong> <span class="text-primary">${channelLine}</span></div>` : ''}
            ${promotedSkus.length ? `<div class="mb-2"><strong>Promoted Products:</strong><div class="mt-1">${promotedSkuBadges}</div></div>` : ''}
            <div class="mb-2">
              <strong>Period:</strong> ${formatDate(promo.start_date)} - ${formatDate(promo.end_date)}
              <span class="badge bg-secondary ms-2">${promo.duration_weeks}w</span>
              ${promo.season ? `<span class="badge bg-light text-dark border ms-1">${formatSeasonLabel(promo.season)}</span>` : ''}
            </div>
            <div class="mb-2">
              <strong>Discount:</strong> <span class="text-success">${promo.discount_pct}% off</span>
            </div>
            <div class="mb-2">
              <strong>Target:</strong> ${formatNumber(promo.target_adds)} adds
            </div>
            ${promo.actual_adds ? `
              <div class="mb-2">
                <strong>Actual:</strong> ${formatNumber(promo.actual_adds)}
                <span class="badge bg-primary">${attainment}</span>
              </div>
              <div class="mb-2">
                <strong>ROI:</strong> <span class="text-success">${roi}</span>
              </div>
            ` : ''}
            ${storySummary ? `<div class="mb-2 small text-muted"><strong>Narrative:</strong> ${storySummary}</div>` : ''}
            <div class="mb-2">
              <strong>Roll-off:</strong> ${formatDate(promo.roll_off_date)}
              ${promo.repeat_loss_expected ?
                `<span class="badge bg-warning text-dark ms-1" title="Expected repeat-loss spike at ${promo.repeat_loss_lag_weeks} weeks">
                  <i class="bi bi-exclamation-triangle"></i> Repeat-Loss Risk
                </span>` : ''}
          </div>
            <div class="mt-3 small">
              ${skuResults.length ? `<div class="mb-2"><strong>SKU Outcomes:</strong> ${skuUpCount} up, ${skuDownCount} down ${downBadge}</div>` : ''}
              <strong class="text-body-secondary">Tags:</strong>
              <span class="ms-1">
                ${(promo.campaign_tags || [])
                  .map(tag => `<span class="badge bg-primary bg-opacity-90 text-white me-1">${tag}</span>`)
                  .join(' ')}
              </span>
              <div class="mt-2">
                <button class="btn btn-sm btn-outline-primary promo-drilldown-btn" data-promo-id="${promo.promo_id}" type="button">
                  View SKU + Channel Outcomes
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
  const phaseLabels = ['Start of Season', 'In-Season Pivot', 'Future Vision'];
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
    `Story mix in current filters: ${phaseData[0]} baseline, ${phaseData[1]} pivot, ${phaseData[2]} future campaigns. ` +
    `Best channel response is ${channelLabels[bestChannelIdx]} (${channelData[bestChannelIdx] >= 0 ? '+' : ''}${channelData[bestChannelIdx].toFixed(1)}% avg uplift). ` +
    `Portfolio average: ${avgUplift >= 0 ? '+' : ''}${avgUplift.toFixed(1)}%.`;
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
    return;
  }

  const promo = promoMetadata ? promoMetadata[promoId] : null;
  if (!promo) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  selectedPromoId = promoId;

  const skuResults = Array.isArray(promo.sku_results) ? promo.sku_results : [];
  const channelResults = promo.channel_results || {};
  const underperformers = skuResults.filter(s => s.outcome === 'down' || Number(s.sales_uplift_pct) < 0);
  const performers = skuResults.filter(s => s.outcome === 'up' || Number(s.sales_uplift_pct) > 0);

  const skuRows = skuResults.length
    ? skuResults
      .sort((a, b) => Number(b.sales_uplift_pct || 0) - Number(a.sales_uplift_pct || 0))
      .map(row => {
        const uplift = Number(row.sales_uplift_pct || 0);
        const upliftClass = uplift >= 0 ? 'text-success' : 'text-danger';
        const outcomeBadge = uplift >= 0
          ? '<span class="badge bg-success-subtle text-success">Up</span>'
          : '<span class="badge bg-danger-subtle text-danger">Down</span>';
        const channel = CHANNEL_LABELS[String(row.channel || '').toLowerCase()] || row.channel || '-';
        const skuLabel = formatSkuDisplay(row.sku_id, row.sku_name, false);
        return `
            <tr>
              <td class="fw-semibold">${skuLabel}</td>
              <td>${channel}</td>
              <td class="${upliftClass}">${uplift >= 0 ? '+' : ''}${uplift.toFixed(1)}%</td>
              <td>${outcomeBadge}</td>
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
    <div class="card border-primary-subtle">
      <div class="card-header bg-primary-subtle">
        <div class="d-flex justify-content-between align-items-center">
          <h6 class="mb-0">
            <i class="bi bi-search me-2"></i>Promo Drill-Down: ${promo.campaign_name}
          </h6>
          <span class="badge bg-light text-dark border">${formatSeasonLabel(promo.season)}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="alert alert-light border mb-3">
          <div><strong>Recommendation:</strong> ${exclusionLine}</div>
          <div>${includeLine}</div>
        </div>
        <div class="row g-3">
          <div class="col-lg-7">
            <h6 class="small text-uppercase text-muted mb-2">SKU Outcomes</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead class="table-light">
                  <tr>
                    <th>SKU</th>
                    <th>Channel</th>
                    <th>Sales Uplift</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>${skuRows}</tbody>
              </table>
            </div>
          </div>
          <div class="col-lg-5">
            <h6 class="small text-uppercase text-muted mb-2">Channel Outcomes</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Channel</th>
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

      filterPriceChange.checked = checked;
      if (filterCompetitorPriceChange) filterCompetitorPriceChange.checked = checked;
      filterPromo.checked = checked;
      filterTentpole.checked = checked;

      renderEventTimeline();
      renderEventTable();
    });
  }

  if (filterPriceChange) {
    filterPriceChange.addEventListener('change', (e) => {
      activeFilters.priceChange = e.target.checked;
      renderEventTimeline();
      renderEventTable();
    });
  }

  if (filterCompetitorPriceChange) {
    filterCompetitorPriceChange.addEventListener('change', (e) => {
      activeFilters.competitorPriceChange = e.target.checked;
      renderEventTimeline();
      renderEventTable();
    });
  }

  if (filterPromo) {
    filterPromo.addEventListener('change', (e) => {
      activeFilters.promo = e.target.checked;
      renderEventTimeline();
      renderEventTable();
    });
  }

  if (filterTentpole) {
    filterTentpole.addEventListener('change', (e) => {
      activeFilters.tentpole = e.target.checked;
      renderEventTimeline();
      renderEventTable();
    });
  }
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
