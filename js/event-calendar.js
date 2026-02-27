/**
 * Event Calendar Module
 * Renders and manages the event calendar UI
 * RFP-aligned: Slides 12, 16, 18 compliance
 */

import { loadEventCalendar, loadPromoMetadata, loadValidationWindows, loadExternalFactors, loadSocialSignals, loadElasticityParams } from './data-loader.js';
import { formatCurrency, formatPercent, formatNumber } from './utils.js';

// Global state
let allEvents = [];
let promoMetadata = {};
let validationWindows = {};
let activeFilters = {
  priceChange: true,
  promo: true,
  tentpole: true
};

/**
 * Initialize event calendar section
 */
export async function initializeEventCalendar() {
  console.log('Initializing Event Calendar...');

  try {
    // Load all data
    [allEvents, promoMetadata, validationWindows] = await Promise.all([
      loadEventCalendar(),
      loadPromoMetadata(),
      loadValidationWindows()
    ]);

    // Update event count badge
    updateEventCountBadge();

    // Render all components
    renderMarketSignalsDashboard();
    renderEventTimeline();
    renderEventTable();
    renderPromoCards();
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

/**
 * Update event count badge
 */
function updateEventCountBadge() {
  const badge = document.getElementById('event-count-badge');
  if (badge) {
    const events = Array.isArray(allEvents) ? allEvents : [];
    const counts = {
      priceChange: events.filter(e => e.event_type === 'Price Change').length,
      promo: events.filter(e => (e.event_type || '').includes('Promo')).length,
      tentpole: events.filter(e => e.event_type === 'Tentpole').length
    };
    badge.textContent = `${events.length} Events (${counts.priceChange} Price Changes, ${counts.promo} Promos, ${counts.tentpole} Tentpoles)`;
  }
}

/**
 * Render Market Signals & Listening dashboard (competitive + social)
 * Uses latest rows from market_signals.csv and social_signals.csv plus tier prices.
 */
async function renderMarketSignalsDashboard() {
  const compContainer = document.getElementById('market-signals-competitive');
  const socialContainer = document.getElementById('market-signals-social');
  if (!compContainer || !socialContainer) return;

  try {
    const [externalFactors, socialSignals, params] = await Promise.all([
      loadExternalFactors(),
      loadSocialSignals(),
      loadElasticityParams()
    ]);

    if (!externalFactors || !externalFactors.length || !params) {
      compContainer.textContent = 'Market signals not available.';
      socialContainer.textContent = 'Social listening data not available.';
      return;
    }

    const latestExternal = externalFactors[externalFactors.length - 1];
    const latestSocial = socialSignals && socialSignals.length
      ? socialSignals[socialSignals.length - 1]
      : null;

    const massPrice = params.tiers.ad_supported?.price_range?.current ?? 24;
    const prestigePrice = params.tiers.ad_free?.price_range?.current ?? 36;

    const {
      competitor_mass_price,
      competitor_prestige_price,
      competitor_marketplace_price,
      competitor_promo_flag,
      category_demand_index,
      promo_clutter_index
    } = latestExternal;

    // Competitive posture heuristics
    const massGap = competitor_marketplace_price ? (massPrice - competitor_marketplace_price) / massPrice : 0;
    const prestigeGap = competitor_prestige_price ? (prestigePrice - competitor_prestige_price) / prestigePrice : 0;

    const massUnderPressure = massGap > 0.08; // competitor cheaper by >8%
    const prestigeRoomToHold = prestigeGap < 0.05; // competitor not much cheaper
    const highDemand = category_demand_index >= 1.1;
    const heavyClutter = promo_clutter_index >= 0.5;

    let compHtml = '<ul class="mb-1">';
    if (massUnderPressure) {
      compHtml += `
        <li>
          Mass channels face <strong>price pressure</strong> vs marketplaces
          (our ~$${massPrice.toFixed(0)} vs competitor ~$${competitor_marketplace_price?.toFixed(0) ?? 'N/A'}).
        </li>`;
    } else {
      compHtml += `
        <li>
          Mass channel pricing is roughly in line with marketplaces
          (gap &lt; 8%).
        </li>`;
    }
    if (prestigeRoomToHold) {
      compHtml += `
        <li>
          Prestige competitors are not deeply undercutting us
          (our ~$${prestigePrice.toFixed(0)} vs competitor ~$${competitor_prestige_price?.toFixed(0) ?? 'N/A'}).
        </li>`;
    } else {
      compHtml += `
        <li>
          Prestige competitors are discounting more aggressively—watch for trade-down risk.
        </li>`;
    }
    if (competitor_promo_flag) {
      compHtml += `
        <li>
          Competitors are <strong>currently on promo</strong>; defensive promo on Mass may be needed to defend volume.
        </li>`;
    } else {
      compHtml += `
        <li>
          Competitors are largely at full price—opportunity to <strong>hold price</strong> in Prestige.
        </li>`;
    }
    compHtml += '</ul>';

    let compRecommendation = '';
    if (massUnderPressure && competitor_promo_flag) {
      compRecommendation = 'Consider the “Mass Channel Defensive Promo” scenario in Step 5 to defend share in Target & Amazon.';
    } else if (highDemand && !heavyClutter) {
      compRecommendation = 'Demand is strong and promo clutter is low—lean into full price or light promos in Prestige.';
    } else if (heavyClutter) {
      compRecommendation = 'Promo clutter is high—be selective with promos and focus on elastic segments only.';
    } else {
      compRecommendation = 'Maintain current promo posture; no strong competitive shocks detected this week.';
    }

    compContainer.innerHTML = `
      ${compHtml}
      <p class="mb-0 text-muted">
        <strong>Suggested move:</strong> ${compRecommendation}
      </p>
    `;

    // Social & listening summary
    if (!latestSocial) {
      socialContainer.textContent = 'Social listening data not available.';
      return;
    }

    const sentiment = parseFloat(latestSocial.social_sentiment ?? 0);
    const tiktok = parseFloat(latestSocial.tiktok_mentions ?? 0);
    const instagram = parseFloat(latestSocial.instagram_mentions ?? 0);
    const totalMentions = parseFloat(latestSocial.total_social_mentions ?? 0);

    let socialHtml = '<ul class="mb-1">';
    socialHtml += `
      <li>
        Total social mentions this week: <strong>${totalMentions.toLocaleString()}</strong>
        (${tiktok.toLocaleString()} TikTok, ${instagram.toLocaleString()} Instagram).
      </li>`;

    if (sentiment >= 0.65) {
      socialHtml += `
        <li>
          Social sentiment is <strong>high</strong> (${sentiment.toFixed(2)}). Favor <strong>brand-building</strong> and premium messaging over deep discounting.
        </li>`;
    } else if (sentiment >= 0.45) {
      socialHtml += `
        <li>
          Social sentiment is <strong>mixed</strong> (${sentiment.toFixed(2)}). Use targeted promos for specific cohorts instead of broad cuts.
        </li>`;
    } else {
      socialHtml += `
        <li>
          Social sentiment is <strong>soft</strong> (${sentiment.toFixed(2)}). Consider supportive offers or messaging to defend repeat customers.
        </li>`;
    }
    socialHtml += '</ul>';

    const tiktokShare = totalMentions > 0 ? (tiktok / totalMentions) * 100 : 0;
    let channelCue = '';
    if (tiktokShare >= 40) {
      channelCue = 'TikTok is driving a large share of conversation—anchor creative and promotions around social-first moments.';
    } else {
      channelCue = 'Conversation is more evenly split across channels—coordinate messaging across Sephora, Ulta, Target, Amazon, and DTC.';
    }

    socialContainer.innerHTML = `
      ${socialHtml}
      <p class="mb-0 text-muted">
        <strong>Listening cue:</strong> ${channelCue}
      </p>
    `;
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
    } else if (event.event_type.includes('Promo')) {
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
    </div>
  `;

  detailsPanel.innerHTML = html;
  detailsPanel.style.display = 'block';
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
      ? `${formatCurrency(event.price_before)} → ${formatCurrency(event.price_after)}`
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
  if (!container) return;

  const promos = promoMetadata ? Object.values(promoMetadata) : [];

  if (!promos || promos.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted">No promo campaigns available</div>';
    return;
  }

  const retailChannels = ['sephora', 'ulta', 'target', 'amazon', 'dtc'];
  const channelLabels = { sephora: 'Sephora', ulta: 'Ulta', target: 'Target', amazon: 'Amazon', dtc: 'DTC' };

  let html = '';
  promos.forEach(promo => {
    const status = promo.actual_adds ? 'Complete' : 'In Progress';
    const statusClass = promo.actual_adds ? 'success' : 'warning';
    // Calculate as decimal, formatPercent will multiply by 100
    const attainment = promo.actual_adds ?
      formatPercent(promo.actual_adds / promo.target_adds) : 'TBD';
    const roi = promo.actual_roi ? `${promo.actual_roi}x` : 'TBD';
    const channels = (promo.eligible_channels || []).filter(c => retailChannels.includes(String(c).toLowerCase()));
    const channelLine = channels.length ? channels.map(c => channelLabels[c] || c).join(', ') : '';

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
            ${channelLine ? `<div class="mb-2"><strong>Channel:</strong> <span class="text-primary">${channelLine}</span></div>` : ''}
            <div class="mb-2">
              <strong>Period:</strong> ${formatDate(promo.start_date)} - ${formatDate(promo.end_date)}
              <span class="badge bg-secondary ms-2">${promo.duration_weeks}w</span>
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
            <div class="mb-2">
              <strong>Roll-off:</strong> ${formatDate(promo.roll_off_date)}
              ${promo.repeat_loss_expected ?
                `<span class="badge bg-warning text-dark ms-1" title="Expected repeat-loss spike at ${promo.repeat_loss_lag_weeks} weeks">
                  <i class="bi bi-exclamation-triangle"></i> Repeat-Loss Risk
                </span>` : ''}
          </div>
            <div class="mt-3 small">
              <strong class="text-body-secondary">Tags:</strong>
              <span class="ms-1">
                ${(promo.campaign_tags || [])
                  .map(tag => `<span class="badge bg-primary bg-opacity-90 text-white me-1">${tag}</span>`)
                  .join(' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
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
  const filterPromo = document.getElementById('filter-promo');
  const filterTentpole = document.getElementById('filter-tentpole');

  if (filterAll) {
    filterAll.addEventListener('change', (e) => {
      const checked = e.target.checked;
      activeFilters.priceChange = checked;
      activeFilters.promo = checked;
      activeFilters.tentpole = checked;

      filterPriceChange.checked = checked;
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
    if (eventType.includes('Promo') && !activeFilters.promo) return false;
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
    'Promo Start': { text: 'Promo Start', class: 'bg-info' },
    'Promo End': { text: 'Promo End', class: 'bg-secondary' },
    'Promo Roll-off': { text: 'Roll-off', class: 'bg-warning text-dark' },
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
    const arrow = change > 0 ? '↑' : '↓';
    const color = change > 0 ? 'text-success' : 'text-danger';
    return `
      <span class="${color}">
        <strong>${formatCurrency(event.price_before)} → ${formatCurrency(event.price_after)}</strong>
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
