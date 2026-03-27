/**
 * Step Navigation System
 * Manages the step-by-step navigation flow for the Promotion Optimization Studio
 * Now with 11 steps (0-10) for better progressive disclosure
 */

const TOTAL_STEPS = 11; // 0-10
let currentStep = 0;
const DEFAULT_PLANNING_HORIZON_WEEKS = 17;
const stepSectionMap = {
  0: 'section-0',
  1: 'section-2',
  2: 'section-1',
  3: 'section-10',
  4: 'section-8',
  5: 'section-6',
  6: 'section-7',
  7: 'section-3',
  8: 'section-4',
  9: 'section-5',
  10: 'section-9'
};
const stepVisualCharts = {};

function renderStartupIssue({ title, message, actions = '' }) {
  const loadSection = document.getElementById('load-data-section');
  const kpiSection = document.getElementById('kpi-section');
  if (!loadSection) return;

  if (kpiSection) {
    kpiSection.style.display = 'none';
  }

  loadSection.style.display = 'block';
  loadSection.style.visibility = 'visible';
  loadSection.style.opacity = '1';
  loadSection.innerHTML = `
    <div class="glass-card text-start" style="padding: 2rem;">
      <div class="alert alert-warning mb-0">
        <div class="d-flex align-items-start gap-3">
          <i class="bi bi-exclamation-triangle fs-4"></i>
          <div>
            <h5 class="alert-heading mb-2">${title}</h5>
            <p class="mb-2">${message}</p>
            ${actions}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getPlanningHorizonWeeks() {
  const fromGlobalGetter = typeof window.getPromoPlanningHorizonWeeks === 'function'
    ? Number(window.getPromoPlanningHorizonWeeks())
    : Number(window.promoPlanningHorizonWeeks);
  if (Number.isFinite(fromGlobalGetter) && fromGlobalGetter > 0) {
    return Math.max(1, Math.round(fromGlobalGetter));
  }
  return DEFAULT_PLANNING_HORIZON_WEEKS;
}

function renderStepVisualChart(chartKey, canvasId, config) {
  if (!window.Chart) return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  if (stepVisualCharts[chartKey]) {
    try {
      stepVisualCharts[chartKey].destroy();
    } catch (_error) {
      // no-op
    }
    stepVisualCharts[chartKey] = null;
  }

  const finalConfig = {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 260 },
      ...(config.options || {})
    }
  };
  stepVisualCharts[chartKey] = new Chart(canvas, finalConfig);
  return stepVisualCharts[chartKey];
}

/**
 * Navigate to a specific step
 * @param {number} step - Step number (0-9)
 */
function goToStep(step) {
  if (step < 0 || step >= TOTAL_STEPS) return;

  // Hide all section wrappers
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  // Show the target section wrapper
  const sectionId = stepSectionMap[step];
  const section = sectionId ? document.getElementById(sectionId) : null;
  if (section) {
    section.classList.add('active');
  }

  // Update step indicators
  document.querySelectorAll('.step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step, 10);
    dot.classList.remove('active', 'completed');
    if (!Number.isNaN(dotStep) && dotStep < step) {
      dot.classList.add('completed');
    } else if (dotStep === step) {
      dot.classList.add('active');
    }
  });

  currentStep = step;
  window.__currentStepNavigation = step;

  // Show/hide appropriate original content sections
  showStepContent(step);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Show content for the current step
 * @param {number} step - Step number
 */
function showStepContent(step) {
  document.body.classList.remove('app-loading-step');

  // Hide all original content sections
  const allSections = [
    'load-data-section',
    'current-state-history-section',
    'kpi-section',
    'elasticity-models-section',
    'comparison-section',
    'analytics-section',
    'segmentation-section',
    'segment-analysis-section',
    'event-calendar-section',
    'data-viewer-section',
    'chat-section'
  ];

  allSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      // Remove hide-tabs class when hiding elasticity section
      if (id === 'elasticity-models-section') {
        el.classList.remove('hide-elasticity-tabs');
      }
    }
  });

  // Show sections based on current step
  switch(step) {
    case 0:
      // Hero - no additional content
      break;
    case 1:
      // Data Explorer - bootstrap the app before showing the explorer.
      if (window.location.protocol === 'file:') {
        renderStartupIssue({
          title: 'Open the app through a local server',
          message: 'This experience cannot boot correctly from a local file because the browser blocks the JavaScript modules and data files. Launch it through localhost instead.',
          actions: `
            <p class="mb-2"><strong>Recommended:</strong> run <code>start-promotion-studio.bat</code> from this project folder.</p>
            <p class="mb-2">Manual fallback from <code>C:\\Users\\admin\\work\\promotion-studio</code>:</p>
            <pre class="mb-2"><code>py -m http.server 8000</code></pre>
            <p class="mb-2">Then open <a href="http://127.0.0.1:8000/index.html" target="_blank" rel="noopener noreferrer">http://127.0.0.1:8000/index.html</a>.</p>
            <button class="btn btn-sm btn-primary" onclick="window.open('http://127.0.0.1:8000/index.html', '_blank', 'noopener')">
              Open localhost:8000
            </button>
          `
        });
        break;
      }

      const step1LoadSection = document.getElementById('load-data-section');
      const step1LoadingProgress = document.getElementById('loading-progress');
      const dataViewerSection = document.getElementById('data-viewer-section');
      const dataViewerContentArea = document.getElementById('step-2-data-viewer-container-content');
      const step1AppDataState = window.appDataLoadState || (window.dataLoaded ? 'loaded' : 'idle');

      if (dataViewerSection && dataViewerContentArea) {
        if (dataViewerSection.parentElement !== dataViewerContentArea) {
          dataViewerContentArea.appendChild(dataViewerSection);
        }
      }

      if (!window.loadAppData || typeof window.loadAppData !== 'function') {
        renderStartupIssue({
          title: 'Application bootstrap did not complete',
          message: 'The main application bundle is not available, so data loading cannot start. Reload the page through the local server and try again.',
          actions: `
            <button class="btn btn-sm btn-outline-primary me-2" onclick="location.reload()">Reload</button>
            <a class="btn btn-sm btn-primary" href="http://127.0.0.1:8000/index.html" target="_blank" rel="noopener noreferrer">Open localhost:8000</a>
          `
        });
        break;
      }

      if (step1AppDataState === 'loaded') {
        if (step1LoadSection) {
          step1LoadSection.style.display = '';
          step1LoadSection.style.visibility = '';
          step1LoadSection.style.opacity = '';
        }
        if (dataViewerSection) dataViewerSection.style.display = 'block';
        break;
      }

      if (dataViewerSection) dataViewerSection.style.display = 'none';
      if (step1LoadSection) {
        step1LoadSection.style.display = '';
        step1LoadSection.style.visibility = '';
        step1LoadSection.style.opacity = '';
      }
      document.body.classList.add('app-loading-step');
      if (step1LoadingProgress) {
        step1LoadingProgress.style.display = 'block';
        step1LoadingProgress.style.visibility = 'visible';
      }

      if (step1AppDataState !== 'loading') {
        window.appDataLoadState = 'loading';
        setTimeout(() => {
          window.loadAppData().catch(error => {
            console.error('Failed to load data:', error);
            window.dataLoaded = false;
            window.appDataLoadState = 'idle';
          });
        }, 100);
      }
      break;
    case 2:
      // Current state dashboard - 52-week overview
      if (window.location.protocol === 'file:') {
        renderStartupIssue({
          title: 'Open the app through a local server',
          message: 'This experience cannot boot correctly from a local file because the browser blocks the JavaScript modules and data files. Launch it through localhost instead.',
          actions: `
            <p class="mb-2"><strong>Recommended:</strong> run <code>start-promotion-studio.bat</code> from this project folder.</p>
            <p class="mb-2">Manual fallback from <code>C:\\Users\\admin\\work\\promotion-studio</code>:</p>
            <pre class="mb-2"><code>py -m http.server 8000</code></pre>
            <p class="mb-2">Then open <a href="http://127.0.0.1:8000/index.html" target="_blank" rel="noopener noreferrer">http://127.0.0.1:8000/index.html</a>.</p>
            <button class="btn btn-sm btn-primary" onclick="window.open('http://127.0.0.1:8000/index.html', '_blank', 'noopener')">
              Open localhost:8000
            </button>
          `
        });
        break;
      }

      const loadSection = document.getElementById('load-data-section');
      const historySection = document.getElementById('current-state-history-section');
      const appDataState = window.appDataLoadState || (window.dataLoaded ? 'loaded' : 'idle');

      if (!window.loadAppData || typeof window.loadAppData !== 'function') {
        renderStartupIssue({
          title: 'Application bootstrap did not complete',
          message: 'The main application bundle is not available, so data loading cannot start. Reload the page through the local server and try again.',
          actions: `
            <button class="btn btn-sm btn-outline-primary me-2" onclick="location.reload()">Reload</button>
            <a class="btn btn-sm btn-primary" href="http://127.0.0.1:8000/index.html" target="_blank" rel="noopener noreferrer">Open localhost:8000</a>
          `
        });
        break;
      }

      if (appDataState === 'loaded') {
        if (loadSection) loadSection.style.display = 'none';
        if (historySection) historySection.style.display = 'block';
        if (window.initializeCurrentStateHistoryDashboard && typeof window.initializeCurrentStateHistoryDashboard === 'function') {
          window.initializeCurrentStateHistoryDashboard();
        }
        break;
      }

      goToStep(1);
      break;
    case 3:
      // Last week drilldown dashboard - dedicated view
      const weeklyDataState = window.appDataLoadState || (window.dataLoaded ? 'loaded' : 'idle');

      if (weeklyDataState === 'loaded') {
        const wdContent = document.getElementById('weekly-drilldown-content');
        const wdLoading = document.getElementById('wd-loading-state');
        if (wdContent) wdContent.style.display = 'block';
        if (wdLoading) wdLoading.style.display = 'none';
        if (window.initializeWeeklyDrilldown && typeof window.initializeWeeklyDrilldown === 'function') {
          window.initializeWeeklyDrilldown();
        }
        break;
      }

      goToStep(1);
      break;
    case 4:
      // Event Calendar
      const eventCalendarSection = document.getElementById('event-calendar-section');
      const calendarContentArea = document.getElementById('step-8-calendar-container-content');
      if (eventCalendarSection && calendarContentArea) {
        eventCalendarSection.style.display = 'block';
        if (eventCalendarSection.parentElement !== calendarContentArea) {
          calendarContentArea.appendChild(eventCalendarSection);
        }
      }
      break;
    case 5:
      // Customer Cohorts & Elasticity (segmentation only)
      const segmentationSection6 = document.getElementById('segmentation-section');
      const segmentContentArea6 = document.getElementById('step-6-segmentation-container-content');
      if (segmentationSection6 && segmentContentArea6) {
        segmentationSection6.style.display = 'block';
        if (segmentationSection6.parentElement !== segmentContentArea6) {
          segmentContentArea6.appendChild(segmentationSection6);
        }
      }
      break;
    case 6:
      // Segment Elasticity Comparison (analysis only)
      const segmentAnalysisSection7 = document.getElementById('segment-analysis-section');
      const analysisContentArea7 = document.getElementById('step-7-analysis-container-content');
      if (segmentAnalysisSection7 && analysisContentArea7) {
        segmentAnalysisSection7.style.display = 'block';
        if (segmentAnalysisSection7.parentElement !== analysisContentArea7) {
          analysisContentArea7.appendChild(segmentAnalysisSection7);
        }
      }
      break;
    case 7:
      // In-Season Planner - show elasticity models, force Acquisition tab
      showElasticityModel('acquisition', 'step-3-acquisition-container');
      if (window.initAcquisitionSimple && typeof window.initAcquisitionSimple === 'function') {
        setTimeout(() => window.initAcquisitionSimple(), 100);
      }
      break;
    case 8:
      // End-of-Season Markdown - show elasticity models, force Churn tab
      showElasticityModel('churn', 'step-4-churn-container');
      if (window.initChurnSimple && typeof window.initChurnSimple === 'function') {
        setTimeout(() => window.initChurnSimple(), 100);
      }
      break;
    case 9:
      // Cross-Channel Migration - show elasticity models, force Migration tab
      showElasticityModel('migration', 'step-5-migration-container');
      if (window.initMigrationSimple && typeof window.initMigrationSimple === 'function') {
        setTimeout(() => window.initMigrationSimple(), 100);
      }
      break;
    case 10:
      // Chat & Advanced Tools
      const chatSection = document.getElementById('chat-section');
      const chatContentArea = document.getElementById('step-9-chat-container-content');
      if (chatSection && chatContentArea) {
        chatSection.style.display = 'block';
        if (chatSection.parentElement !== chatContentArea) {
          chatContentArea.appendChild(chatSection);
        }
      }
      break;
  }
}

function getPromoSnapshot() {
  if (window.getChannelPromoSnapshot && typeof window.getChannelPromoSnapshot === 'function') {
    return window.getChannelPromoSnapshot();
  }
  return null;
}

function formatSignedPercent(decimalValue, digits = 1) {
  const raw = Number(decimalValue) * 100;
  if (!Number.isFinite(raw)) return '--';
  return `${raw >= 0 ? '+' : ''}${raw.toFixed(digits)}%`;
}

function formatUnits(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return Math.round(num).toLocaleString();
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

let narrativeDataCache = {
  skuWeekly: null,
  promoMetadata: null,
  marketSignals: null,
  socialSignals: null,
  seasonCalendar: null,
  loadingPromise: null
};
let promoAdvancedScenarioBank = [];

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampValue(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function parseCsvText(csvText) {
  const text = String(csvText || '').trim();
  if (!text) return [];
  const rows = [];
  let current = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      record.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      record.push(current);
      rows.push(record);
      record = [];
      current = '';
      continue;
    }
    current += char;
  }
  record.push(current);
  rows.push(record);

  const headers = rows[0] || [];
  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx];
    });
    return obj;
  });
}

async function ensureNarrativeDataLoaded() {
  if (
    narrativeDataCache.skuWeekly &&
    narrativeDataCache.promoMetadata &&
    narrativeDataCache.marketSignals &&
    narrativeDataCache.socialSignals &&
    narrativeDataCache.seasonCalendar
  ) {
    return narrativeDataCache;
  }
  if (narrativeDataCache.loadingPromise) {
    return narrativeDataCache.loadingPromise;
  }

  narrativeDataCache.loadingPromise = Promise.all([
    fetch('data/sku_channel_weekly.csv').then(response => {
      if (!response.ok) throw new Error(`Failed to load sku_channel_weekly.csv (${response.status})`);
      return response.text();
    }),
    fetch('data/promo_metadata.json').then(response => {
      if (!response.ok) throw new Error(`Failed to load promo_metadata.json (${response.status})`);
      return response.json();
    }),
    fetch('data/market_signals.csv').then(response => {
      if (!response.ok) throw new Error(`Failed to load market_signals.csv (${response.status})`);
      return response.text();
    }),
    fetch('data/social_signals.csv').then(response => {
      if (!response.ok) throw new Error(`Failed to load social_signals.csv (${response.status})`);
      return response.text();
    }),
    fetch('data/season_calendar.csv').then(response => {
      if (!response.ok) throw new Error(`Failed to load season_calendar.csv (${response.status})`);
      return response.text();
    })
  ])
    .then(([skuCsv, promoMetadata, marketCsv, socialCsv, seasonCsv]) => {
      narrativeDataCache.skuWeekly = parseCsvText(skuCsv);
      narrativeDataCache.promoMetadata = promoMetadata || {};
      narrativeDataCache.marketSignals = parseCsvText(marketCsv);
      narrativeDataCache.socialSignals = parseCsvText(socialCsv);
      narrativeDataCache.seasonCalendar = parseCsvText(seasonCsv);
      return narrativeDataCache;
    })
    .finally(() => {
      narrativeDataCache.loadingPromise = null;
    });

  return narrativeDataCache.loadingPromise;
}

function summarizeSkuRowsForWeek(skuWeeklyRows, week) {
  const targetWeek = safeNumber(week, 1);
  const grouped = new Map();

  (skuWeeklyRows || [])
    .filter(row => safeNumber(row.week_of_season, 0) === targetWeek)
    .forEach(row => {
      const key = row.sku_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          sku_id: row.sku_id,
          sku_name: row.sku_name || row.sku_id,
          product_group: row.product_group || 'product',
          units: 0,
          inventory: 0,
          gapSum: 0,
          socialSum: 0,
          elasticitySum: 0,
          massPriceSum: 0,
          prestigePriceSum: 0,
          massCount: 0,
          prestigeCount: 0,
          count: 0
        });
      }
      const entry = grouped.get(key);
      entry.units += safeNumber(row.net_units_sold);
      entry.inventory += safeNumber(row.end_inventory_units);
      entry.gapSum += safeNumber(row.price_gap_vs_competitor);
      entry.socialSum += safeNumber(row.social_engagement_score);
      entry.elasticitySum += Math.abs(safeNumber(row.base_elasticity));
      entry.count += 1;

      const price = safeNumber(row.effective_price, safeNumber(row.list_price));
      if (row.channel_group === 'mass') {
        entry.massPriceSum += price;
        entry.massCount += 1;
      } else if (row.channel_group === 'prestige') {
        entry.prestigePriceSum += price;
        entry.prestigeCount += 1;
      }
    });

  return [...grouped.values()].map(entry => ({
    sku_id: entry.sku_id,
    sku_name: entry.sku_name,
    product_group: entry.product_group,
    units: entry.units,
    inventory: entry.inventory,
    avgGapPct: entry.count ? (entry.gapSum / entry.count) : 0,
    avgSocial: entry.count ? (entry.socialSum / entry.count) : 0,
    absElasticity: entry.count ? (entry.elasticitySum / entry.count) : 0,
    massPrice: entry.massCount ? (entry.massPriceSum / entry.massCount) : null,
    prestigePrice: entry.prestigeCount ? (entry.prestigePriceSum / entry.prestigeCount) : null
  }));
}

function derivePromoEvidenceRows(promoMetadata) {
  const campaigns = Object.values(promoMetadata || {})
    .filter(item => item && item.campaign_name && item.start_date)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));

  const campaignRowsAll = campaigns.map(campaign => {
    const skuResults = Array.isArray(campaign.sku_results) ? campaign.sku_results : [];
    const upCount = skuResults.filter(row => String(row.outcome).toLowerCase() === 'up').length;
    const downCount = skuResults.filter(row => String(row.outcome).toLowerCase() === 'down').length;
    const avgUplift = skuResults.length
      ? (skuResults.reduce((sum, row) => sum + safeNumber(row.sales_uplift_pct), 0) / skuResults.length)
      : 0;
    const bestChannel = Object.entries(campaign.channel_results || {})
      .sort((a, b) => safeNumber(b[1]?.sales_uplift_pct) - safeNumber(a[1]?.sales_uplift_pct))[0]?.[0] || '--';
    const promotedNames = [...new Set(skuResults.map(row => row?.sku_name).filter(Boolean))];
    const promotedLabels = promotedNames.length
      ? promotedNames.join(', ')
      : (Array.isArray(campaign.promoted_skus) ? campaign.promoted_skus.join(', ') : '--');

    return {
      campaign_name: campaign.campaign_name,
      start_date: campaign.start_date,
      season: campaign.season || '--',
      story_phase: campaign.story_phase || 'baseline',
      story_summary: campaign.story_summary || '',
      promoted_count: (campaign.promoted_skus || []).length,
      promoted_labels: promotedLabels,
      up_count: upCount,
      down_count: downCount,
      avg_uplift_pct: avgUplift,
      best_channel: bestChannel
    };
  });
  const campaignRows = campaignRowsAll.slice(0, 5);

  const skuMap = new Map();
  campaigns.forEach(campaign => {
    const skuResults = Array.isArray(campaign.sku_results) ? campaign.sku_results : [];
    skuResults.forEach(row => {
      if (!row?.sku_id) return;
      if (!skuMap.has(row.sku_id)) {
        skuMap.set(row.sku_id, {
          sku_id: row.sku_id,
          sku_name: row.sku_name || row.sku_id,
          campaigns: 0,
          up: 0,
          down: 0,
          upliftSum: 0,
          channelLift: {}
        });
      }
      const entry = skuMap.get(row.sku_id);
      entry.product_group = String(row.sku_id || '').startsWith('SUN_') ? 'sunscreen' : 'moisturizer';
      entry.campaigns += 1;
      if (String(row.outcome).toLowerCase() === 'up') entry.up += 1;
      if (String(row.outcome).toLowerCase() === 'down') entry.down += 1;
      entry.upliftSum += safeNumber(row.sales_uplift_pct);
      const channel = row.channel || '--';
      if (!entry.channelLift[channel]) {
        entry.channelLift[channel] = { sum: 0, count: 0 };
      }
      entry.channelLift[channel].sum += safeNumber(row.sales_uplift_pct);
      entry.channelLift[channel].count += 1;
    });
  });

  const skuRows = [...skuMap.values()].map(entry => {
    const avgUplift = entry.campaigns ? (entry.upliftSum / entry.campaigns) : 0;
    const bestChannel = Object.entries(entry.channelLift)
      .map(([channel, stat]) => ({ channel, avg: stat.count ? (stat.sum / stat.count) : 0 }))
      .sort((a, b) => b.avg - a.avg)[0]?.channel || '--';
    let policy = 'Hold';
    if (entry.campaigns >= 2 && entry.up > entry.down && avgUplift >= 4) {
      policy = 'Include';
    } else if (entry.campaigns >= 2 && entry.down >= entry.up) {
      policy = 'Exclude';
    }
    return {
      sku_id: entry.sku_id,
      sku_name: entry.sku_name,
      product_group: entry.product_group || 'product',
      campaigns: entry.campaigns,
      up: entry.up,
      down: entry.down,
      avgUplift,
      bestChannel,
      policy,
      policyReason: policy === 'Include'
        ? 'Repeated positive SKU lift in past promotions'
        : policy === 'Exclude'
          ? 'Frequent down-response in prior promotions'
          : 'Mixed response, run controlled tests'
    };
  }).sort((a, b) => b.avgUplift - a.avgUplift);

  const phaseMap = new Map();
  campaignRowsAll.forEach(row => {
    const key = String(row.story_phase || 'baseline');
    if (!phaseMap.has(key)) {
      phaseMap.set(key, {
        phase: key,
        campaigns: 0,
        promotedSkuCount: 0,
        upCount: 0,
        downCount: 0,
        upliftSum: 0
      });
    }
    const entry = phaseMap.get(key);
    entry.campaigns += 1;
    entry.promotedSkuCount += safeNumber(row.promoted_count);
    entry.upCount += safeNumber(row.up_count);
    entry.downCount += safeNumber(row.down_count);
    entry.upliftSum += safeNumber(row.avg_uplift_pct);
  });
  const phaseRows = [...phaseMap.values()].map(entry => ({
    phase: entry.phase,
    campaigns: entry.campaigns,
    promotedSkuCount: entry.promotedSkuCount,
    upCount: entry.upCount,
    downCount: entry.downCount,
    avgUpliftPct: entry.campaigns > 0 ? (entry.upliftSum / entry.campaigns) : 0
  }));

  return { campaignRows, campaignRowsAll, phaseRows, skuRows };
}

function getNarrativeRowsForSnapshot(skuWeeklyRows, snapshot) {
  return (skuWeeklyRows || []).filter(row => {
    const week = safeNumber(row.week_of_season, 0);
    if (week <= 0) return false;
    if (snapshot?.selectedGroup && snapshot.selectedGroup !== 'all' && row.product_group !== snapshot.selectedGroup) {
      return false;
    }
    if (snapshot?.selectedSku && snapshot.selectedSku !== 'all' && row.sku_id !== snapshot.selectedSku) {
      return false;
    }
    if (row.channel_group === 'mass' && snapshot?.applyMass === false) return false;
    if (row.channel_group === 'prestige' && snapshot?.applyPrestige === false) return false;
    return true;
  });
}

function buildInventoryTrajectory(rows, snapshot, marketSignals = [], socialSignals = []) {
  const currentWeek = safeNumber(snapshot?.weekOfSeason, 1);
  const horizonWeeks = getPlanningHorizonWeeks();
  const inventoryProjection = snapshot?.inventoryProjection || {};
  const startInventory = safeNumber(inventoryProjection.startingInventory);
  const baselineTargetEnd = safeNumber(inventoryProjection.baselineEnd);
  const scenarioTargetEnd = safeNumber(inventoryProjection.scenarioEnd);

  const weeklyDemandMap = new Map();
  rows.forEach(row => {
    const week = safeNumber(row.week_of_season, 0);
    if (week <= currentWeek || week > horizonWeeks) return;
    if (!weeklyDemandMap.has(week)) {
      weeklyDemandMap.set(week, { demand: 0, weekStart: row.week_start || '' });
    }
    const entry = weeklyDemandMap.get(week);
    entry.demand += safeNumber(row.net_units_sold);
    if (!entry.weekStart && row.week_start) entry.weekStart = row.week_start;
  });

  const demandDenominator = [...weeklyDemandMap.values()].reduce((sum, entry) => sum + safeNumber(entry.demand), 0);
  const baselineMultiplier = demandDenominator > 0
    ? clampValue((startInventory - baselineTargetEnd) / demandDenominator, 0, 3)
    : 1;
  const scenarioMultiplier = demandDenominator > 0
    ? clampValue((startInventory - scenarioTargetEnd) / demandDenominator, 0, 3)
    : clampValue(1 + safeNumber(snapshot?.unitLiftPct), 0, 3);

  const marketByDate = new Map((marketSignals || []).map(row => [row.week_start, row]));
  const socialByDate = new Map((socialSignals || []).map(row => [row.week_start, row]));

  let baselineLeft = startInventory;
  let scenarioLeft = startInventory;
  const trajectory = [{
    week: currentWeek,
    weekStart: snapshot?.weekStartDate || '',
    baselineLeft,
    scenarioLeft,
    demandBaseline: 0,
    competitorAvgPrice: null,
    socialIndex: safeNumber(snapshot?.socialScore, null)
  }];

  for (let week = currentWeek + 1; week <= horizonWeeks; week += 1) {
    const weekDemand = safeNumber(weeklyDemandMap.get(week)?.demand);
    baselineLeft = Math.max(0, baselineLeft - (weekDemand * baselineMultiplier));
    scenarioLeft = Math.max(0, scenarioLeft - (weekDemand * scenarioMultiplier));
    const weekStart = weeklyDemandMap.get(week)?.weekStart || '';
    const market = marketByDate.get(weekStart) || {};
    const social = socialByDate.get(weekStart) || {};
    trajectory.push({
      week,
      weekStart,
      baselineLeft,
      scenarioLeft,
      demandBaseline: weekDemand,
      competitorAvgPrice: safeNumber(market.competitor_avg_price, null),
      socialIndex: safeNumber(social.brand_social_index, null)
    });
  }

  return trajectory;
}

function getObjectiveLabel(key) {
  if (key === 'sales') return 'Maximize Sales';
  if (key === 'profit') return 'Maximize Profit';
  return 'Balance Sales + Profit';
}

function getNarrativePhaseLabel(phase) {
  const normalized = String(phase || '').toLowerCase();
  if (normalized === 'pivot') return 'In-Season Pivot';
  if (normalized === 'future') return 'Future Vision';
  if (normalized === 'clearance') return 'End-of-Season';
  return 'Start of Season';
}

function savePromoAdvancedScenario(entry) {
  if (!entry || !entry.stepKey) return;
  const record = {
    id: `${entry.stepKey}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
    ...entry
  };
  promoAdvancedScenarioBank = [record, ...promoAdvancedScenarioBank].slice(0, 24);
}

function rankPromoAdvancedScenarios(objective = 'balanced') {
  const obj = String(objective || 'balanced');
  const scored = promoAdvancedScenarioBank.map(item => {
    const revenue = safeNumber(item.revenueDeltaPct);
    const profit = safeNumber(item.profitDeltaPct);
    const clearance = safeNumber(item.clearancePct);
    const risk = safeNumber(item.riskPct);
    let score = 0;
    if (obj === 'growth') {
      score = (revenue * 0.55) + (clearance * 0.35) - (risk * 0.2) + (profit * 0.1);
    } else if (obj === 'profit') {
      score = (profit * 0.65) + (revenue * 0.15) + (clearance * 0.15) - (risk * 0.25);
    } else {
      score = (revenue * 0.35) + (profit * 0.35) + (clearance * 0.2) - (risk * 0.2);
    }
    return { ...item, score };
  });
  return scored.sort((a, b) => b.score - a.score);
}

function getPromoPythonPresets(stepKey) {
  const horizonWeeks = getPlanningHorizonWeeks();
  const baseByStep = {
    step6: [
      {
        id: 'baseline_hold',
        name: 'Baseline Hold Plan',
        tier: 'ad_supported',
        currentPrice: 24,
        discountPct: 6,
        elasticity: 1.7,
        durationMonths: 1
      },
      {
        id: 'sunscreen_competitor_undercut',
        name: 'Sunscreen Competitor Undercut',
        tier: 'ad_supported',
        currentPrice: 22,
        discountPct: 12,
        elasticity: 2.3,
        durationMonths: 1
      },
      {
        id: 'viral_creator_spike',
        name: 'Viral Creator Spike',
        tier: 'ad_free',
        currentPrice: 31,
        discountPct: 8,
        elasticity: 2.1,
        durationMonths: 1
      },
      {
        id: 'margin_defense_moisturizer',
        name: 'Moisturizer Margin Defense',
        tier: 'ad_free',
        currentPrice: 29,
        discountPct: 4,
        elasticity: 1.4,
        durationMonths: 1
      }
    ],
    step7: [
      {
        id: 'clearance_balanced',
        name: 'Balanced Clearance Ladder',
        tier: 'ad_supported',
        currentPrice: 20,
        discountPct: 14,
        elasticity: 1.8,
        durationMonths: 1
      },
      {
        id: 'aggressive_liquidation',
        name: `Aggressive Week-${horizonWeeks} Liquidation`,
        tier: 'ad_supported',
        currentPrice: 18,
        discountPct: 22,
        elasticity: 2.2,
        durationMonths: 1
      },
      {
        id: 'premium_hold',
        name: 'Premium Holdout Protection',
        tier: 'ad_free',
        currentPrice: 30,
        discountPct: 6,
        elasticity: 1.3,
        durationMonths: 1
      }
    ],
    step8: [
      {
        id: 'balanced_omni',
        name: 'Balanced Omni Migration',
        tier: 'ad_supported',
        currentPrice: 24,
        discountPct: 9,
        elasticity: 1.8,
        durationMonths: 1
      },
      {
        id: 'prestige_halo',
        name: 'Prestige Halo Shift',
        tier: 'ad_free',
        currentPrice: 32,
        discountPct: 7,
        elasticity: 1.5,
        durationMonths: 1
      },
      {
        id: 'entry_pack_recovery',
        name: 'Entry Pack Recovery',
        tier: 'basic',
        currentPrice: 15,
        discountPct: 15,
        elasticity: 2.4,
        durationMonths: 1
      }
    ]
  };
  return baseByStep[stepKey] || baseByStep.step6;
}

function renderPromoPythonResultChart(stepKey, modelType, result, canvasId) {
  const chartKey = `${stepKey}_${modelType}_python_result`;
  if (!result) return;

  if (modelType === 'acquisition') {
    const acquisition = result?.python_models?.acquisition || {};
    const predictedAdds = safeNumber(acquisition.predicted_adds);
    const ciLower = safeNumber(acquisition.ci_lower);
    const ciUpper = safeNumber(acquisition.ci_upper);
    const netAdds = safeNumber(result?.forecasted?.netAdds);
    renderStepVisualChart(chartKey, canvasId, {
      type: 'bar',
      data: {
        labels: ['CI Lower', 'Predicted Adds', 'CI Upper', 'Net Adds'],
        datasets: [{
          label: 'Customers',
          data: [ciLower, predictedAdds, ciUpper, netAdds],
          backgroundColor: [
            'rgba(148, 163, 184, 0.75)',
            'rgba(16, 185, 129, 0.85)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(245, 158, 11, 0.85)'
          ]
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(148, 163, 184, 0.18)' } }
        }
      }
    });
    return;
  }

  if (modelType === 'churn') {
    const churn = result?.python_models?.churn || {};
    const horizons = ['0-4 Weeks', '4-8 Weeks', '8-12 Weeks', '12+ Weeks'];
    const uplift = horizons.map(h => safeNumber(churn?.[h]?.repeat_loss_uplift_pp));
    renderStepVisualChart(chartKey, canvasId, {
      type: 'line',
      data: {
        labels: horizons,
        datasets: [{
          label: 'Repeat-loss uplift (pp)',
          data: uplift,
          borderColor: 'rgba(239, 68, 68, 0.95)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.25,
          pointRadius: 2
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(148, 163, 184, 0.18)' } }
        }
      }
    });
    return;
  }

  const migration = result?.python_models?.migration || {};
  const routes = [];
  Object.entries(migration).forEach(([fromKey, values]) => {
    if (!String(fromKey).startsWith('from_') || typeof values !== 'object' || !values) return;
    const fromLabel = fromKey.replace('from_', '').replace(/_/g, ' ');
    Object.entries(values).forEach(([toKey, raw]) => {
      if (toKey === 'stay') return;
      const rate = safeNumber(raw);
      if (rate <= 0) return;
      const toLabel = toKey.replace('to_', '').replace(/_/g, ' ');
      routes.push({ label: `${fromLabel} -> ${toLabel}`, rate: rate * 100 });
    });
  });
  const topRoutes = routes.sort((a, b) => b.rate - a.rate).slice(0, 8);
  renderStepVisualChart(chartKey, canvasId, {
    type: 'bar',
    data: {
      labels: topRoutes.map(row => row.label),
      datasets: [{
        label: 'Migration rate (%)',
        data: topRoutes.map(row => Number(row.rate.toFixed(2))),
        backgroundColor: 'rgba(37, 99, 235, 0.82)'
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(148, 163, 184, 0.18)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderPromoPythonScenarioRunner({
  containerId,
  stepKey,
  modelType,
  defaultPrice = 24,
  defaultTier = 'ad_supported',
  title = 'Python Scenario Studio'
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const localPresets = getPromoPythonPresets(stepKey).map(item => ({
    ...item,
    id: `local:${item.id}`,
    source: 'Local'
  }));
  const libraryPresets = (
    window.getScenarioTemplatesByModel && typeof window.getScenarioTemplatesByModel === 'function'
      ? window.getScenarioTemplatesByModel(modelType)
      : []
  ).map(item => ({
    id: `library:${item.id}`,
    source: 'Library',
    name: item.name,
    tier: item.tier || defaultTier,
    currentPrice: safeNumber(item.currentPrice, defaultPrice),
    discountPct: Number.isFinite(item.discountPct)
      ? item.discountPct
      : (
        Number.isFinite(item.currentPrice) && Number.isFinite(item.newPrice) && Number(item.currentPrice) > 0
          ? ((Number(item.currentPrice) - Number(item.newPrice)) / Number(item.currentPrice)) * 100
          : 0
      ),
    elasticity: 1.8,
    durationMonths: safeNumber(item.durationMonths, 1)
  }));
  const presets = [...localPresets, ...libraryPresets];
  const runnerStepKey = `${stepKey}-python`;
  const objectiveOptions = `
    <option value="balanced">Balanced</option>
    <option value="growth">Growth</option>
    <option value="profit">Profit</option>
  `;
  const tierOptions = ['ad_supported', 'ad_free', 'basic', 'premium', 'bundle']
    .map(tier => `<option value="${tier}" ${tier === defaultTier ? 'selected' : ''}>${tier.replace(/_/g, ' ')}</option>`)
    .join('');

  container.innerHTML = `
    <div class="card border-primary-subtle mt-3">
      <div class="card-header bg-primary-subtle d-flex justify-content-between align-items-center">
        <h6 class="mb-0 text-primary-emphasis">${title}</h6>
        <span class="badge text-bg-primary">Python Models</span>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-lg-3">
            <label class="form-label small fw-semibold mb-1">Scenario Preset</label>
            <select class="form-select form-select-sm" id="${stepKey}-py-preset">
              ${presets.map(item => `<option value="${item.id}">${item.source}: ${item.name}</option>`).join('')}
            </select>
          </div>
          <div class="col-lg-3">
            <label class="form-label small fw-semibold mb-1">Scenario Name</label>
            <input type="text" class="form-control form-control-sm" id="${stepKey}-py-name" value="${presets[0]?.name || `${modelType} scenario`}">
          </div>
          <div class="col-lg-2">
            <label class="form-label small fw-semibold mb-1">Tier</label>
            <select class="form-select form-select-sm" id="${stepKey}-py-tier">
              ${tierOptions}
            </select>
          </div>
          <div class="col-lg-2">
            <label class="form-label small fw-semibold mb-1">Current Price</label>
            <input type="number" class="form-control form-control-sm" min="1" step="0.5" id="${stepKey}-py-current-price" value="${defaultPrice.toFixed(2)}">
          </div>
          <div class="col-lg-2">
            <label class="form-label small fw-semibold mb-1">Duration</label>
            <input type="number" class="form-control form-control-sm" min="1" max="6" step="1" id="${stepKey}-py-duration" value="1">
          </div>
          <div class="col-lg-4">
            <label class="form-label small fw-semibold mb-1">Promo Discount <span id="${stepKey}-py-discount-value">0%</span></label>
            <input type="range" class="form-range" min="0" max="35" step="1" value="0" id="${stepKey}-py-discount">
          </div>
          <div class="col-lg-4">
            <label class="form-label small fw-semibold mb-1">Elasticity Intensity <span id="${stepKey}-py-elasticity-value">1.8</span></label>
            <input type="range" class="form-range" min="0.8" max="3.2" step="0.1" value="1.8" id="${stepKey}-py-elasticity">
          </div>
          <div class="col-lg-4">
            <label class="form-label small fw-semibold mb-1">Ranking Objective</label>
            <select class="form-select form-select-sm" id="${stepKey}-py-objective">
              ${objectiveOptions}
            </select>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-sm btn-primary" id="${stepKey}-py-run-btn"><i class="bi bi-play-fill me-1"></i>Run Python Model</button>
          <button type="button" class="btn btn-sm btn-outline-success" id="${stepKey}-py-save-btn"><i class="bi bi-bookmark-plus me-1"></i>Save Scenario</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" id="${stepKey}-py-rank-btn"><i class="bi bi-sort-down me-1"></i>Rank Saved</button>
          <div class="small text-muted align-self-center" id="${stepKey}-py-status">Select a preset and run model.</div>
        </div>
        <div class="row g-2 mt-2">
          <div class="col-md-3">
            <div class="border rounded p-2 bg-body h-100">
              <div class="small text-muted">Revenue Delta</div>
              <div class="fw-semibold" id="${stepKey}-py-kpi-revenue">--</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-2 bg-body h-100">
              <div class="small text-muted">Customer Delta</div>
              <div class="fw-semibold" id="${stepKey}-py-kpi-customers">--</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-2 bg-body h-100">
              <div class="small text-muted">Repeat-Loss Delta</div>
              <div class="fw-semibold" id="${stepKey}-py-kpi-churn">--</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-2 bg-body h-100">
              <div class="small text-muted">Model Source</div>
              <div class="fw-semibold" id="${stepKey}-py-kpi-source">--</div>
            </div>
          </div>
        </div>
        <div class="border rounded p-2 bg-body mt-2">
          <div class="small text-muted fw-semibold mb-1">Model Output Diagram</div>
          <div style="height: 220px;">
            <canvas id="${stepKey}-py-chart"></canvas>
          </div>
        </div>
        <div class="table-responsive mt-2">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Saved Scenario</th>
                <th class="text-end">Revenue</th>
                <th class="text-end">Profit</th>
                <th class="text-end">Risk</th>
                <th class="text-end">Score</th>
              </tr>
            </thead>
            <tbody id="${stepKey}-py-rank-body">
              <tr><td colspan="5" class="text-center text-muted">No saved model scenarios yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const els = {
    preset: document.getElementById(`${stepKey}-py-preset`),
    name: document.getElementById(`${stepKey}-py-name`),
    tier: document.getElementById(`${stepKey}-py-tier`),
    currentPrice: document.getElementById(`${stepKey}-py-current-price`),
    duration: document.getElementById(`${stepKey}-py-duration`),
    discount: document.getElementById(`${stepKey}-py-discount`),
    discountValue: document.getElementById(`${stepKey}-py-discount-value`),
    elasticity: document.getElementById(`${stepKey}-py-elasticity`),
    elasticityValue: document.getElementById(`${stepKey}-py-elasticity-value`),
    objective: document.getElementById(`${stepKey}-py-objective`),
    runBtn: document.getElementById(`${stepKey}-py-run-btn`),
    saveBtn: document.getElementById(`${stepKey}-py-save-btn`),
    rankBtn: document.getElementById(`${stepKey}-py-rank-btn`),
    status: document.getElementById(`${stepKey}-py-status`),
    kpiRevenue: document.getElementById(`${stepKey}-py-kpi-revenue`),
    kpiCustomers: document.getElementById(`${stepKey}-py-kpi-customers`),
    kpiChurn: document.getElementById(`${stepKey}-py-kpi-churn`),
    kpiSource: document.getElementById(`${stepKey}-py-kpi-source`),
    rankBody: document.getElementById(`${stepKey}-py-rank-body`)
  };

  const updateSliderLabels = () => {
    const discountPct = safeNumber(els.discount?.value);
    const elasticity = safeNumber(els.elasticity?.value, 1.8);
    if (els.discountValue) els.discountValue.textContent = `${discountPct.toFixed(0)}%`;
    if (els.elasticityValue) els.elasticityValue.textContent = elasticity.toFixed(1);
  };

  const applyPreset = () => {
    const preset = presets.find(item => item.id === (els.preset?.value || '')) || presets[0];
    if (!preset) return;
    if (els.name) els.name.value = preset.name;
    if (els.tier) els.tier.value = preset.tier || defaultTier;
    if (els.currentPrice) els.currentPrice.value = safeNumber(preset.currentPrice, defaultPrice).toFixed(2);
    if (els.discount) els.discount.value = safeNumber(preset.discountPct, 0);
    if (els.elasticity) els.elasticity.value = safeNumber(preset.elasticity, 1.8);
    if (els.duration) els.duration.value = safeNumber(preset.durationMonths, 1).toFixed(0);
    updateSliderLabels();
  };

  const buildPayload = () => {
    const currentPrice = Math.max(1, safeNumber(els.currentPrice?.value, defaultPrice));
    const discountPct = clampValue(safeNumber(els.discount?.value, 0), 0, 35);
    const newPrice = Math.max(0.5, currentPrice * (1 - (discountPct / 100)));
    const elasticity = safeNumber(els.elasticity?.value, 1.8);
    const durationMonths = Math.max(1, safeNumber(els.duration?.value, 1));
    const tier = els.tier?.value || defaultTier;
    const name = (els.name?.value || '').trim() || `${modelType} scenario`;
    return {
      id: `${runnerStepKey}-${Date.now()}`,
      modelType,
      name,
      description: `Scenario from ${stepKey} ${title}`,
      tier,
      currentPrice,
      newPrice,
      discountPct,
      durationMonths,
      segmentElasticity: elasticity,
      rationale: 'Scenario configured from interactive promotion controls.'
    };
  };

  let lastRunPayload = null;
  let lastRunResult = null;

  const renderRanking = () => {
    const objective = els.objective?.value || 'balanced';
    const rows = rankPromoAdvancedScenarios(objective)
      .filter(item => item.stepKey === runnerStepKey)
      .slice(0, 6);
    if (!els.rankBody) return;
    if (!rows.length) {
      els.rankBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No saved model scenarios yet.</td></tr>';
      return;
    }
    els.rankBody.innerHTML = rows.map(row => `
      <tr>
        <td>
          <div class="fw-semibold">${row.title}</div>
          <div class="small text-muted">${row.meta || ''}</div>
        </td>
        <td class="text-end ${row.revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.revenueDeltaPct)}</td>
        <td class="text-end ${row.profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.profitDeltaPct)}</td>
        <td class="text-end text-danger">${formatSignedPercent(row.riskPct)}</td>
        <td class="text-end fw-semibold">${row.score.toFixed(2)}</td>
      </tr>
    `).join('');
  };

  const runModel = async () => {
    if (!window.runPromoScenarioModel || typeof window.runPromoScenarioModel !== 'function') {
      if (els.status) els.status.textContent = 'Model bridge unavailable. Ensure app initialization completed.';
      return;
    }
    const payload = buildPayload();
    lastRunPayload = payload;
    if (els.status) els.status.textContent = 'Running Python models for selected scenario...';
    if (els.runBtn) {
      els.runBtn.disabled = true;
      els.runBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Running...';
    }
    try {
      const result = await window.runPromoScenarioModel(payload);
      lastRunResult = result;
      const revenueDeltaDecimal = safeNumber(result?.delta?.revenue_pct) / 100;
      const customersDeltaDecimal = safeNumber(result?.delta?.customers_pct) / 100;
      const repeatLossDelta = safeNumber(result?.delta?.repeat_loss_rate);
      if (els.kpiRevenue) els.kpiRevenue.textContent = formatSignedPercent(revenueDeltaDecimal);
      if (els.kpiCustomers) els.kpiCustomers.textContent = formatSignedPercent(customersDeltaDecimal);
      if (els.kpiChurn) els.kpiChurn.textContent = formatSignedPercent(repeatLossDelta);
      if (els.kpiSource) els.kpiSource.textContent = result?.model_source === 'pyodide-python' ? 'Python (Pyodide)' : 'JavaScript fallback';
      if (els.status) {
        const priceNote = `${formatCurrency(payload.currentPrice)} -> ${formatCurrency(payload.newPrice)}`;
        els.status.textContent = `${result?.model_source === 'pyodide-python' ? 'Python run complete' : 'Fallback run complete'}: ${payload.name} (${priceNote}).`;
      }
      renderPromoPythonResultChart(stepKey, modelType, result, `${stepKey}-py-chart`);
    } catch (error) {
      if (els.status) els.status.textContent = `Model run failed: ${error?.message || 'Unknown error'}`;
    } finally {
      if (els.runBtn) {
        els.runBtn.disabled = false;
        els.runBtn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Run Python Model';
      }
    }
  };

  const saveLastRun = () => {
    if (!lastRunResult || !lastRunPayload) {
      if (els.status) els.status.textContent = 'Run a scenario first, then save.';
      return;
    }
    const revenueDeltaPct = safeNumber(lastRunResult?.delta?.revenue_pct) / 100;
    const customersDeltaPct = safeNumber(lastRunResult?.delta?.customers_pct) / 100;
    const repeatLossDelta = safeNumber(lastRunResult?.delta?.repeat_loss_rate);
    const profitDeltaPct = clampValue(
      (revenueDeltaPct * 0.62) + (customersDeltaPct * 0.18) - (repeatLossDelta * 0.55),
      -1,
      1
    );
    const riskPct = clampValue(
      Math.max(0, repeatLossDelta) + (Math.max(0, -revenueDeltaPct) * 0.35),
      0,
      0.75
    );
    const clearancePct = clampValue(
      0.58 + (customersDeltaPct * 0.45) + (Math.max(0, revenueDeltaPct) * 0.25) - (riskPct * 0.2),
      0,
      1
    );
    savePromoAdvancedScenario({
      stepKey: runnerStepKey,
      title: lastRunPayload.name,
      revenueDeltaPct,
      profitDeltaPct,
      clearancePct,
      riskPct,
      meta: `${modelType} | tier ${lastRunPayload.tier} | ${formatCurrency(lastRunPayload.currentPrice)} -> ${formatCurrency(lastRunPayload.newPrice)}`
    });
    renderRanking();
    if (els.status) els.status.textContent = `Saved scenario "${lastRunPayload.name}" and refreshed ranking.`;
  };

  if (els.preset) els.preset.addEventListener('change', applyPreset);
  [els.discount, els.elasticity].filter(Boolean).forEach(el => el.addEventListener('input', updateSliderLabels));
  if (els.runBtn) els.runBtn.addEventListener('click', runModel);
  if (els.saveBtn) els.saveBtn.addEventListener('click', saveLastRun);
  if (els.rankBtn) els.rankBtn.addEventListener('click', renderRanking);
  if (els.objective) els.objective.addEventListener('input', renderRanking);

  applyPreset();
  renderRanking();
}

function renderRoadmapFutureModule(type, contentAreaId) {
  const contentArea = document.getElementById(contentAreaId);
  if (!contentArea) return;

  const snapshot = getPromoSnapshot();
  const week = Number(snapshot?.weekOfSeason || 7);
  const objective = snapshot?.objective || 'balance';
  const inv = snapshot?.inventoryProjection || {};
  const baselineEnd = Number(inv?.baselineEnd || 0);
  const scenarioEnd = Number(inv?.scenarioEnd || 0);
  const transferRows = Array.isArray(snapshot?.cannibalizationTransfers) ? snapshot.cannibalizationTransfers : [];
  const topTransfers = [...transferRows].sort((a, b) => Number(b.units || 0) - Number(a.units || 0)).slice(0, 3);
  const totalShift = transferRows.reduce((sum, row) => sum + Number(row.units || 0), 0);

  if (!snapshot) {
    contentArea.innerHTML = `
      <div class="card border-warning-subtle">
        <div class="card-body">
          <h6 class="mb-2"><i class="bi bi-hourglass-split me-2"></i>Model Input Required</h6>
          <p class="text-muted mb-2">Run Step 2 first to feed this section with live promotion outputs.</p>
          <div class="alert alert-light border mb-0">
            These sections are model-driven and consume live week, inventory trajectory, competitor shock, social shock, and SKU migration from the Current State Overview in Step 2.
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (type === 'planner') {
    contentArea.innerHTML = `
      <div class="card border-0 bg-body-tertiary mb-0">
        <div class="card-body">
          <div class="small text-muted">Loading in-season model inputs...</div>
        </div>
      </div>
    `;

    ensureNarrativeDataLoaded().then(data => {
      const scopedRows = getNarrativeRowsForSnapshot(data.skuWeekly || [], snapshot);
      const skuProfiles = summarizeSkuRowsForWeek(scopedRows, week);
      const trajectory = buildInventoryTrajectory(
        scopedRows,
        snapshot,
        data.marketSignals || [],
        data.socialSignals || []
      );
      const ownPromoPct = safeNumber(snapshot.decomposition?.ownPromoPct);
      const competitorPct = safeNumber(snapshot.decomposition?.competitorPct);
      const socialPct = safeNumber(snapshot.decomposition?.socialPct);
      const transferUnits = transferRows.reduce((sum, row) => sum + safeNumber(row.units), 0);
      const massBase = safeNumber(snapshot.massPromoDepthPct);
      const prestigeBase = safeNumber(snapshot.prestigePromoDepthPct);
      const sellThroughPct = inv?.startingInventory > 0
        ? ((safeNumber(inv.startingInventory) - scenarioEnd) / safeNumber(inv.startingInventory))
        : 0;
      const maxInventoryOnPath = Math.max(1, ...trajectory.map(row => safeNumber(row.baselineLeft)));
      const cannibalBySku = new Map();
      transferRows.forEach(row => {
        const fromSku = row.from_sku;
        const toSku = row.to_sku;
        const units = safeNumber(row.units);
        if (fromSku) cannibalBySku.set(fromSku, (cannibalBySku.get(fromSku) || 0) - units);
        if (toSku) cannibalBySku.set(toSku, (cannibalBySku.get(toSku) || 0) + units);
      });

      const trajectoryRows = trajectory.map(row => {
        const baselinePct = clampValue((safeNumber(row.baselineLeft) / maxInventoryOnPath) * 100, 0, 100);
        const scenarioPct = clampValue((safeNumber(row.scenarioLeft) / maxInventoryOnPath) * 100, 0, 100);
        const deltaUnits = safeNumber(row.scenarioLeft) - safeNumber(row.baselineLeft);
        return `
          <tr>
            <td class="fw-semibold">W${row.week}</td>
            <td class="text-end">${row.competitorAvgPrice ? formatCurrency(row.competitorAvgPrice) : '--'}</td>
            <td class="text-end">${Number.isFinite(row.socialIndex) ? row.socialIndex.toFixed(1) : '--'}</td>
            <td class="text-end">${formatUnits(row.baselineLeft)}</td>
            <td class="text-end">${formatUnits(row.scenarioLeft)}</td>
            <td class="text-end ${deltaUnits <= 0 ? 'text-success' : 'text-danger'}">${deltaUnits > 0 ? '+' : ''}${formatUnits(deltaUnits)}</td>
            <td style="min-width: 180px;">
              <div class="progress mb-1" style="height: 7px;">
                <div class="progress-bar bg-secondary" role="progressbar" style="width: ${baselinePct}%;"></div>
              </div>
              <div class="progress" style="height: 7px;">
                <div class="progress-bar bg-primary" role="progressbar" style="width: ${scenarioPct}%;"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      const actionRows = [...skuProfiles]
        .sort((a, b) => b.inventory - a.inventory)
        .slice(0, 8)
        .map(profile => {
          const elasticityBand = profile.absElasticity >= 2.0 ? 'High' : (profile.absElasticity >= 1.4 ? 'Medium' : 'Low');
          const massRec = Math.max(0, Math.min(25,
            massBase +
            (profile.avgGapPct > 0.05 ? 4 : (profile.avgGapPct < 0 ? -2 : 1)) +
            (profile.absElasticity >= 2 ? 2 : 0) +
            (profile.avgSocial >= 70 ? -2 : 1)
          ));
          const prestigeRec = Math.max(0, Math.min(25,
            prestigeBase +
            (profile.avgGapPct > 0.03 ? 2 : (profile.avgGapPct < -0.01 ? -1 : 0)) +
            (profile.absElasticity >= 1.8 ? 1 : 0) +
            (profile.avgSocial >= 72 ? -2 : 0)
          ));
          const expectedLift = (
            (profile.absElasticity * ((massRec + prestigeRec) / 200)) +
            ((profile.avgSocial - 60) / 120) -
            (profile.avgGapPct * 0.55)
          );
          const cannibalNet = safeNumber(cannibalBySku.get(profile.sku_id));
          const cannibalLabel = cannibalNet < -0.5
            ? 'Losing volume to sibling SKU'
            : cannibalNet > 0.5
              ? 'Winning volume from sibling SKU'
              : 'Low cannibal pressure';
          const action = profile.avgGapPct > 0.05
            ? 'Defend against competitor undercut'
            : (profile.absElasticity >= 1.8 ? 'Push selective promo' : 'Hold depth and protect margin');
          return `
            <tr>
              <td>
                <div class="fw-semibold">${profile.sku_name}</div>
                <div class="small text-muted text-capitalize">${String(profile.product_group).replace('_', ' ')}</div>
              </td>
              <td class="text-end">${formatUnits(profile.inventory)}</td>
              <td class="text-end">${elasticityBand}</td>
              <td class="text-end ${profile.avgGapPct > 0 ? 'text-danger' : 'text-success'}">${(profile.avgGapPct * 100).toFixed(1)}%</td>
              <td class="text-end">${massRec.toFixed(0)}%</td>
              <td class="text-end">${prestigeRec.toFixed(0)}%</td>
              <td class="text-end ${expectedLift >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(expectedLift)}</td>
              <td>
                <div>${action}</div>
                <div class="small text-muted">${cannibalLabel}</div>
              </td>
            </tr>
          `;
        }).join('');

      const pivotSignalText = `Competitor shock ${safeNumber(snapshot.competitorShockPct).toFixed(0)}%, social shock ${safeNumber(snapshot.socialShockPts).toFixed(0)} pts, objective ${getObjectiveLabel(objective)}.`;
      const horizonWeeks = getPlanningHorizonWeeks();
      const step6SkuOptions = [
        '<option value="all">All Products</option>',
        ...skuProfiles.map(row => `<option value="${row.sku_id}">${row.sku_name}</option>`)
      ].join('');

      contentArea.innerHTML = `
        <div class="alert alert-primary mb-3">
          <strong>Start of Season -> In-Season Pivot:</strong> week ${week} recalculation combines own-promo elasticity, competitor delta, social momentum, and cannibalization to produce SKU x channel actions.
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Model 1: Own Promo Effect</div>
              <div class="fs-5 fw-semibold ${ownPromoPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(ownPromoPct)}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Model 2: Competitor Delta</div>
              <div class="fs-5 fw-semibold ${competitorPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(competitorPct)}</div>
              <div class="small text-muted">Shock: ${safeNumber(snapshot.competitorShockPct).toFixed(0)}% vs live market</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Model 3: Social Momentum</div>
              <div class="fs-5 fw-semibold ${socialPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(socialPct)}</div>
              <div class="small text-muted">Index: ${safeNumber(snapshot.socialScore).toFixed(1)}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Model 4: SKU Migration</div>
              <div class="fs-5 fw-semibold">${formatUnits(transferUnits)} units</div>
              <div class="small text-muted">Current cannibalization flow</div>
            </div>
          </div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-lg-5">
            <div class="card border-0 bg-body-tertiary h-100">
              <div class="card-body">
                <h6 class="text-uppercase text-muted mb-2">Model Mechanics (What Changed This Week)</h6>
                <ul class="small mb-3 ps-3">
                  <li><strong>Demand Model:</strong> Units move by promo depth x effective elasticity per SKU.</li>
                  <li><strong>Competitor Delta Model:</strong> Price gap to competitor directly shifts conversion in each channel group.</li>
                  <li><strong>Social Momentum Model:</strong> Higher social index lowers elasticity drag and lifts baseline demand.</li>
                  <li><strong>Cannibalization Model:</strong> SKU promo asymmetry reallocates demand inside each product family.</li>
                </ul>
                <div class="small text-muted">${pivotSignalText}</div>
              </div>
            </div>
          </div>
          <div class="col-lg-7">
            <div class="card border-0 bg-body-tertiary h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <h6 class="text-uppercase text-muted mb-0">Season Trajectory to Week ${horizonWeeks}</h6>
                  <span class="badge text-bg-light border">Baseline vs Scenario</span>
                </div>
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Week</th>
                        <th class="text-end">Comp Avg</th>
                        <th class="text-end">Social</th>
                        <th class="text-end">Baseline Left</th>
                        <th class="text-end">Scenario Left</th>
                        <th class="text-end">Scenario-Baseline</th>
                        <th>Inventory Runway</th>
                      </tr>
                    </thead>
                    <tbody>${trajectoryRows || '<tr><td colspan="7" class="text-center text-muted">No trajectory available.</td></tr>'}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">In-Season Action Model (Next Decision Cycle)</h6>
              <span class="badge text-bg-light border">Objective: ${getObjectiveLabel(objective)}</span>
            </div>
            <div class="small text-muted mb-2">Projected sell-through from current position: ${formatSignedPercent(sellThroughPct)}</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Product</th>
                    <th class="text-end">Inventory Left</th>
                    <th class="text-end">Elasticity</th>
                    <th class="text-end">Gap vs Competitor</th>
                    <th class="text-end">Target & Amazon</th>
                    <th class="text-end">Sephora & Ulta</th>
                    <th class="text-end">Expected Unit Lift</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>${actionRows || '<tr><td colspan="8" class="text-center text-muted">No SKU profiles available for this week.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">Simulation Lab: Test Weekly Actions</h6>
              <span class="badge text-bg-primary">Interactive</span>
            </div>
            <div class="row g-3">
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Simulation Mode</label>
                <select id="step6-sim-mode" class="form-select form-select-sm">
                  <option value="balanced">Balanced</option>
                  <option value="defense">Competitor Defense</option>
                  <option value="momentum">Social Momentum Push</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Product Group Focus</label>
                <select id="step6-sim-group" class="form-select form-select-sm">
                  <option value="all">All Groups</option>
                  <option value="sunscreen">Sunscreen</option>
                  <option value="moisturizer">Moisturizer</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">SKU Focus</label>
                <select id="step6-sim-sku" class="form-select form-select-sm">
                  ${step6SkuOptions}
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Cannibalization Sensitivity <span id="step6-sim-cannibal-value">100%</span></label>
                <input type="range" id="step6-sim-cannibal" class="form-range" min="50" max="160" step="10" value="100">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Target & Amazon Adj <span id="step6-sim-mass-value">0%</span></label>
                <input type="range" id="step6-sim-mass" class="form-range" min="-10" max="10" step="1" value="0">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Sephora & Ulta Adj <span id="step6-sim-prestige-value">0%</span></label>
                <input type="range" id="step6-sim-prestige" class="form-range" min="-10" max="10" step="1" value="0">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Competitor Shift <span id="step6-sim-comp-value">0%</span></label>
                <input type="range" id="step6-sim-comp" class="form-range" min="-15" max="15" step="1" value="0">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Social Shift <span id="step6-sim-social-value">0 pts</span></label>
                <input type="range" id="step6-sim-social" class="form-range" min="-20" max="20" step="2" value="0">
              </div>
            </div>
            <div class="row g-2 mt-2">
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Sim Revenue Delta</div>
                  <div class="fw-semibold" id="step6-sim-revenue">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Sim Profit Delta</div>
                  <div class="fw-semibold" id="step6-sim-profit">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Week-${horizonWeeks} Left</div>
                  <div class="fw-semibold" id="step6-sim-leftover">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Clearance from Current</div>
                  <div class="fw-semibold" id="step6-sim-clearance">--</div>
                </div>
              </div>
            </div>
            <div class="row g-3 mt-1">
              <div class="col-lg-7">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">Inventory Runway Diagram (W${week} -> W${horizonWeeks})</div>
                  <div style="height: 220px;">
                    <canvas id="step6-sim-trajectory-chart"></canvas>
                  </div>
                </div>
              </div>
              <div class="col-lg-5">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">SKU Lift Diagram</div>
                  <div style="height: 220px;">
                    <canvas id="step6-sim-lift-chart"></canvas>
                  </div>
                </div>
              </div>
            </div>
            <div class="promo-story-flow mt-2" id="step6-sim-story-flow"></div>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Product</th>
                    <th class="text-end">Sim Mass Promo</th>
                    <th class="text-end">Sim Prestige Promo</th>
                    <th class="text-end">Sim Unit Lift</th>
                    <th class="text-end">Cannibal Net</th>
                    <th>Action Cue</th>
                  </tr>
                </thead>
                <tbody id="step6-sim-table-body">
                  <tr><td colspan="6" class="text-center text-muted">Run a simulation to view SKU action deltas.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="small text-muted mt-2" id="step6-sim-note">Simulation note will appear here.</div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="step6-save-scenario">Save This Growth Scenario</button>
          </div>
        </div>
        <div id="step6-python-runner" class="mt-3"></div>
        <div class="alert alert-info mb-0">
          <strong>How to pitch this step:</strong> this is a weekly operating model, not static elasticity. Re-run every signal shift and show exactly how channel-specific promo depths change.
          <div class="small mt-1">Data source: <code>sku_channel_weekly.csv</code>, <code>market_signals.csv</code>, <code>social_signals.csv</code>.</div>
        </div>
      `;

      const step6Els = {
        mode: document.getElementById('step6-sim-mode'),
        group: document.getElementById('step6-sim-group'),
        sku: document.getElementById('step6-sim-sku'),
        mass: document.getElementById('step6-sim-mass'),
        prestige: document.getElementById('step6-sim-prestige'),
        comp: document.getElementById('step6-sim-comp'),
        social: document.getElementById('step6-sim-social'),
        cannibal: document.getElementById('step6-sim-cannibal'),
        massValue: document.getElementById('step6-sim-mass-value'),
        prestigeValue: document.getElementById('step6-sim-prestige-value'),
        compValue: document.getElementById('step6-sim-comp-value'),
        socialValue: document.getElementById('step6-sim-social-value'),
        cannibalValue: document.getElementById('step6-sim-cannibal-value'),
        revenue: document.getElementById('step6-sim-revenue'),
        profit: document.getElementById('step6-sim-profit'),
        leftover: document.getElementById('step6-sim-leftover'),
        clearance: document.getElementById('step6-sim-clearance'),
        tableBody: document.getElementById('step6-sim-table-body'),
        note: document.getElementById('step6-sim-note'),
        saveBtn: document.getElementById('step6-save-scenario'),
        storyFlow: document.getElementById('step6-sim-story-flow')
      };
      let step6LastScenario = null;

      const renderStep6Simulation = () => {
        const mode = step6Els.mode?.value || 'balanced';
        const groupFilter = step6Els.group?.value || 'all';
        const skuFilter = step6Els.sku?.value || 'all';
        const massAdj = safeNumber(step6Els.mass?.value);
        const prestigeAdj = safeNumber(step6Els.prestige?.value);
        const compShift = safeNumber(step6Els.comp?.value);
        const socialShift = safeNumber(step6Els.social?.value);
        const cannibalSensitivity = safeNumber(step6Els.cannibal?.value, 100) / 100;

        const modeConfig = mode === 'defense'
          ? { massBias: 3, prestigeBias: -1, liftBias: 0.02, note: 'Defend volume where competitors are undercutting.' }
          : mode === 'momentum'
            ? { massBias: 0, prestigeBias: 2, liftBias: 0.03, note: 'Use social pull to reduce unnecessary discounting.' }
            : { massBias: 1, prestigeBias: 1, liftBias: 0.0, note: 'Balanced weekly posture across volume and margin.' };

        const filtered = skuProfiles
          .filter(row => groupFilter === 'all' || row.product_group === groupFilter)
          .filter(row => skuFilter === 'all' || row.sku_id === skuFilter);
        const simulationRows = filtered.map(profile => {
          const baseMassDepth = clampValue(
            massBase +
            (profile.avgGapPct > 0.05 ? 4 : (profile.avgGapPct < 0 ? -2 : 1)) +
            (profile.absElasticity >= 2 ? 2 : 0) +
            (profile.avgSocial >= 70 ? -2 : 1),
            0,
            35
          );
          const basePrestigeDepth = clampValue(
            prestigeBase +
            (profile.avgGapPct > 0.03 ? 2 : (profile.avgGapPct < -0.01 ? -1 : 0)) +
            (profile.absElasticity >= 1.8 ? 1 : 0) +
            (profile.avgSocial >= 72 ? -2 : 0),
            0,
            35
          );
          const simMass = clampValue(baseMassDepth + massAdj + modeConfig.massBias, 0, 35);
          const simPrestige = clampValue(basePrestigeDepth + prestigeAdj + modeConfig.prestigeBias, 0, 35);
          const gapPenalty = profile.avgGapPct * (0.55 + (compShift < 0 ? 0.25 : -0.1));
          const socialBoost = (socialShift / 100) * 0.65;
          const compEffect = (-compShift / 100) * (profile.avgGapPct > 0 ? 0.75 : 0.45);
          const cannibalNetBase = safeNumber(cannibalBySku.get(profile.sku_id));
          const cannibalNet = cannibalNetBase * cannibalSensitivity;
          const unitLift = (
            (profile.absElasticity * ((simMass + simPrestige) / 200)) +
            ((profile.avgSocial - 60) / 120) -
            gapPenalty +
            socialBoost +
            compEffect +
            modeConfig.liftBias +
            ((cannibalNet / Math.max(profile.units, 1)) * 0.07)
          );
          const cue = unitLift > 0.18
            ? 'Accelerate promo this week'
            : unitLift < 0
              ? 'Reduce depth, protect margin'
              : 'Selective activation';
          return {
            ...profile,
            simMass,
            simPrestige,
            unitLift,
            cannibalNet,
            cue
          };
        });

        const weightedLift = simulationRows.length
          ? simulationRows.reduce((sum, row) => sum + (row.unitLift * Math.max(1, row.units)), 0) /
            simulationRows.reduce((sum, row) => sum + Math.max(1, row.units), 0)
          : 0;
        const avgDepthAdj = ((massAdj + prestigeAdj) / 2) / 100;
        const simRevenueDelta = safeNumber(snapshot.revenueDeltaPct) + (weightedLift * 0.45) + (socialShift / 1000) - (Math.max(0, -compShift) / 600);
        const simProfitDelta = safeNumber(snapshot.profitDeltaPct) + (weightedLift * 0.28) - (avgDepthAdj * 0.7) + (socialShift / 1200);
        const simLeftover = Math.max(0, Math.round(scenarioEnd * (1 - (weightedLift * 0.85))));
        const simClearance = safeNumber(inv.startingInventory) > 0
          ? (safeNumber(inv.startingInventory) - simLeftover) / safeNumber(inv.startingInventory)
          : 0;
        step6LastScenario = {
          stepKey: 'step6-growth',
          title: `${mode} / ${groupFilter} / ${skuFilter}`,
          revenueDeltaPct: simRevenueDelta,
          profitDeltaPct: simProfitDelta,
          clearancePct: simClearance,
          riskPct: clampValue(Math.abs(safeNumber(snapshot.competitorShockPct, 0)) / 100 + (Math.max(0, -weightedLift) * 0.4), 0, 0.5),
          meta: `mass ${massAdj >= 0 ? '+' : ''}${massAdj}%, prestige ${prestigeAdj >= 0 ? '+' : ''}${prestigeAdj}%, comp ${compShift >= 0 ? '+' : ''}${compShift}%`
        };

        if (step6Els.massValue) step6Els.massValue.textContent = `${massAdj >= 0 ? '+' : ''}${massAdj}%`;
        if (step6Els.prestigeValue) step6Els.prestigeValue.textContent = `${prestigeAdj >= 0 ? '+' : ''}${prestigeAdj}%`;
        if (step6Els.compValue) step6Els.compValue.textContent = `${compShift >= 0 ? '+' : ''}${compShift}%`;
        if (step6Els.socialValue) step6Els.socialValue.textContent = `${socialShift >= 0 ? '+' : ''}${socialShift} pts`;
        if (step6Els.cannibalValue) step6Els.cannibalValue.textContent = `${Math.round(cannibalSensitivity * 100)}%`;
        if (step6Els.revenue) step6Els.revenue.textContent = formatSignedPercent(simRevenueDelta);
        if (step6Els.profit) step6Els.profit.textContent = formatSignedPercent(simProfitDelta);
        if (step6Els.leftover) step6Els.leftover.textContent = formatUnits(simLeftover);
        if (step6Els.clearance) step6Els.clearance.textContent = formatSignedPercent(simClearance);
        if (step6Els.note) {
          step6Els.note.textContent =
            `${modeConfig.note} Scenario applies ${groupFilter === 'all' ? 'all product groups' : groupFilter} and ${skuFilter === 'all' ? 'all SKUs' : `SKU ${skuFilter}`} with cannibal sensitivity ${Math.round(cannibalSensitivity * 100)}%.`;
        }

        if (step6Els.tableBody) {
          const rowsHtml = simulationRows
            .sort((a, b) => b.inventory - a.inventory)
            .slice(0, 8)
            .map(row => `
              <tr>
                <td>
                  <div class="fw-semibold">${row.sku_name}</div>
                  <div class="small text-muted text-capitalize">${String(row.product_group).replace('_', ' ')}</div>
                </td>
                <td class="text-end">${row.simMass.toFixed(0)}%</td>
                <td class="text-end">${row.simPrestige.toFixed(0)}%</td>
                <td class="text-end ${row.unitLift >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.unitLift)}</td>
                <td class="text-end ${row.cannibalNet >= 0 ? 'text-success' : 'text-danger'}">${row.cannibalNet >= 0 ? '+' : ''}${formatUnits(row.cannibalNet)}</td>
                <td>${row.cue}</td>
              </tr>
            `).join('');
          step6Els.tableBody.innerHTML = rowsHtml || '<tr><td colspan="6" class="text-center text-muted">No SKU available for selected filters.</td></tr>';
        }

        const trajectoryLabels = trajectory.map(row => `W${row.week}`);
        const baselinePath = trajectory.map(row => Math.round(safeNumber(row.baselineLeft)));
        const scenarioPath = trajectory.map((row, idx) => {
          const phaseFactor = trajectory.length > 1 ? (idx / (trajectory.length - 1)) : 0;
          const simAdjust = 1 - (weightedLift * 0.28 * phaseFactor);
          return Math.max(0, Math.round(safeNumber(row.scenarioLeft) * simAdjust));
        });
        renderStepVisualChart('step6_trajectory', 'step6-sim-trajectory-chart', {
          type: 'line',
          data: {
            labels: trajectoryLabels,
            datasets: [
              {
                label: 'Baseline inventory left',
                data: baselinePath,
                borderColor: 'rgba(107, 114, 128, 0.95)',
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                fill: false,
                tension: 0.25,
                pointRadius: 1.5
              },
              {
                label: 'Simulated inventory left',
                data: scenarioPath,
                borderColor: 'rgba(37, 99, 235, 0.95)',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                fill: true,
                tension: 0.25,
                pointRadius: 1.5
              }
            ]
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            scales: {
              x: { grid: { display: false } },
              y: { grid: { color: 'rgba(148, 163, 184, 0.18)' } }
            }
          }
        });

        const topLiftRows = [...simulationRows]
          .sort((a, b) => Math.abs(b.unitLift) - Math.abs(a.unitLift))
          .slice(0, 6);
        renderStepVisualChart('step6_lift', 'step6-sim-lift-chart', {
          type: 'bar',
          data: {
            labels: topLiftRows.map(row => row.sku_name),
            datasets: [{
              label: 'Unit lift %',
              data: topLiftRows.map(row => Number((row.unitLift * 100).toFixed(2))),
              backgroundColor: topLiftRows.map(row => row.unitLift >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)')
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0 } },
              y: { grid: { color: 'rgba(148, 163, 184, 0.18)' } }
            }
          }
        });

        if (step6Els.storyFlow) {
          const posture = simProfitDelta > 0 && simRevenueDelta > 0
            ? 'Win-Win'
            : simRevenueDelta > 0
              ? 'Volume Push'
              : 'Margin Defense';
          step6Els.storyFlow.innerHTML = `
            <div class="story-node">
              <div class="label">Start</div>
              <div class="value">${formatUnits(safeNumber(inv.startingInventory))} units</div>
            </div>
            <div class="story-arrow">&rarr;</div>
            <div class="story-node">
              <div class="label">Signal Shock</div>
              <div class="value">Comp ${compShift >= 0 ? '+' : ''}${compShift}% | Social ${socialShift >= 0 ? '+' : ''}${socialShift}</div>
            </div>
            <div class="story-arrow">&rarr;</div>
            <div class="story-node">
              <div class="label">Action</div>
              <div class="value">${modeConfig.note}</div>
            </div>
            <div class="story-arrow">&rarr;</div>
            <div class="story-node">
              <div class="label">Outcome</div>
              <div class="value">${posture}, W${getPlanningHorizonWeeks()} left ${formatUnits(simLeftover)}</div>
            </div>
          `;
        }
      };

      [step6Els.mode, step6Els.group, step6Els.sku, step6Els.mass, step6Els.prestige, step6Els.comp, step6Els.social, step6Els.cannibal]
        .filter(Boolean)
        .forEach(el => el.addEventListener('input', renderStep6Simulation));
      if (step6Els.saveBtn) {
        step6Els.saveBtn.addEventListener('click', () => {
          if (step6LastScenario) savePromoAdvancedScenario(step6LastScenario);
        });
      }
      renderStep6Simulation();
      const avgStep6Price = skuProfiles.length
        ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.massPrice || row.prestigePrice || 24), 0) / skuProfiles.length
        : 24;
      renderPromoPythonScenarioRunner({
        containerId: 'step6-python-runner',
        stepKey: 'step6',
        modelType: 'acquisition',
        defaultPrice: avgStep6Price,
        defaultTier: 'ad_supported',
        title: 'Scenario Studio: Start-of-Season / In-Season Pivot'
      });
    }).catch(error => {
      contentArea.innerHTML = `
        <div class="alert alert-warning mb-0">
          Could not load in-season model inputs. ${error.message || 'Unknown error'}
        </div>
      `;
    });
    return;
  }
  if (type === 'markdown') {
    contentArea.innerHTML = `
      <div class="card border-0 bg-body-tertiary mb-0">
        <div class="card-body">
          <div class="small text-muted">Loading markdown model inputs...</div>
        </div>
      </div>
    `;

    ensureNarrativeDataLoaded().then(data => {
      const scopedRows = getNarrativeRowsForSnapshot(data.skuWeekly || [], snapshot);
      const skuProfiles = summarizeSkuRowsForWeek(scopedRows, week);
      const promoEvidence = derivePromoEvidenceRows(data.promoMetadata || {});
      const horizonWeeks = getPlanningHorizonWeeks();
      const ladderStart = Math.max(week + 1, horizonWeeks - 3);
      const ladderWeeks = Array.from(
        { length: Math.max(1, horizonWeeks - ladderStart + 1) },
        (_, idx) => ladderStart + idx
      );
      const remainingStart = Math.max(0, scenarioEnd);
      const markdownTarget = Math.max(0, Math.round(remainingStart * 0.28));
      let running = remainingStart;
      const stepReduction = ladderWeeks.length > 0 ? (Math.max(0, remainingStart - markdownTarget) / ladderWeeks.length) : 0;
      const ladderRows = ladderWeeks.map((w, idx) => {
        const depth = Math.min(30, 8 + (idx * 4) + (remainingStart > 12000 ? 3 : 0) + (baselineEnd > scenarioEnd ? 1 : 0));
        running = Math.max(markdownTarget, Math.round(running - stepReduction));
        const marginFloor = Math.max(28, 44 - (idx * 3));
        const clearancePct = remainingStart > 0 ? (1 - (running / remainingStart)) : 0;
        return `
          <tr>
            <td>Week ${w}</td>
            <td class="text-end">${depth}%</td>
            <td class="text-end">${formatUnits(running)}</td>
            <td class="text-end">${marginFloor}%</td>
            <td style="min-width: 140px;">
              <div class="progress" style="height: 7px;">
                <div class="progress-bar bg-success" role="progressbar" style="width: ${(clearancePct * 100).toFixed(1)}%;"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      const profileBySku = new Map(skuProfiles.map(row => [row.sku_id, row]));
      const policyRows = promoEvidence.skuRows
        .slice(0, 8)
        .map(row => {
          const profile = profileBySku.get(row.sku_id);
          const inventory = profile ? formatUnits(profile.inventory) : '--';
          const policyBadge = row.policy === 'Include'
            ? '<span class="badge bg-success-subtle text-success-emphasis">Include</span>'
            : row.policy === 'Exclude'
              ? '<span class="badge bg-danger-subtle text-danger-emphasis">Exclude</span>'
              : '<span class="badge bg-secondary-subtle text-secondary-emphasis">Hold</span>';
          const suggestedDepth = row.policy === 'Include'
            ? '16% - 22%'
            : row.policy === 'Exclude'
              ? '0% - 5%'
              : '8% - 12%';
          return `
            <tr>
              <td>${row.sku_name}</td>
              <td class="text-capitalize">${row.product_group || '--'}</td>
              <td class="text-end">${row.campaigns}</td>
              <td class="text-end">${row.up}/${row.down}</td>
              <td class="text-end ${row.avgUplift >= 0 ? 'text-success' : 'text-danger'}">${row.avgUplift.toFixed(1)}%</td>
              <td>${row.bestChannel}</td>
              <td class="text-end">${inventory}</td>
              <td class="text-end">${suggestedDepth}</td>
              <td>${policyBadge}</td>
              <td class="small text-muted">${row.policyReason}</td>
            </tr>
          `;
        }).join('');

      const campaignRows = promoEvidence.campaignRows.map(row => `
        <tr>
          <td>${row.campaign_name}</td>
          <td>${getNarrativePhaseLabel(row.story_phase)}</td>
          <td>${row.start_date}</td>
          <td class="text-end">${row.promoted_count}</td>
          <td>${row.promoted_labels}</td>
          <td class="text-end text-success">${row.up_count}</td>
          <td class="text-end text-danger">${row.down_count}</td>
          <td class="text-end ${row.avg_uplift_pct >= 0 ? 'text-success' : 'text-danger'}">${row.avg_uplift_pct.toFixed(1)}%</td>
          <td>${row.best_channel}</td>
        </tr>
      `).join('');

      const phaseRows = promoEvidence.phaseRows.map(row => {
        const total = Math.max(1, row.upCount + row.downCount);
        const hitRate = row.upCount / total;
        return `
          <tr>
            <td>${getNarrativePhaseLabel(row.phase)}</td>
            <td class="text-end">${row.campaigns}</td>
            <td class="text-end">${row.promotedSkuCount}</td>
            <td class="text-end">${row.upCount}/${row.downCount}</td>
            <td class="text-end ${row.avgUpliftPct >= 0 ? 'text-success' : 'text-danger'}">${row.avgUpliftPct.toFixed(1)}%</td>
            <td style="min-width: 130px;">
              <div class="progress" style="height: 7px;">
                <div class="progress-bar bg-primary" role="progressbar" style="width: ${(hitRate * 100).toFixed(1)}%;"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      const excludedSkus = promoEvidence.skuRows
        .filter(row => row.policy === 'Exclude')
        .slice(0, 4)
        .map(row => row.sku_name);
      const includeSkus = promoEvidence.skuRows
        .filter(row => row.policy === 'Include')
        .slice(0, 4)
        .map(row => row.sku_name);

      contentArea.innerHTML = `
        <div class="alert alert-primary mb-3">
          <strong>Past Promotion Effect + Markdown Model:</strong> choose markdown SKUs from historical lift evidence by channel, then sequence markdown depth to land closer to zero by week ${horizonWeeks}.
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Week-${horizonWeeks} Baseline Left</div>
              <div class="fs-5 fw-semibold">${formatUnits(baselineEnd)}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Week-${horizonWeeks} Scenario Left</div>
              <div class="fs-5 fw-semibold">${formatUnits(scenarioEnd)}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Historical Campaigns Modeled</div>
              <div class="fs-5 fw-semibold">${promoEvidence.campaignRowsAll.length}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Clearance Improvement</div>
              <div class="fs-5 fw-semibold ${baselineEnd - scenarioEnd >= 0 ? 'text-success' : 'text-danger'}">
                ${baselineEnd - scenarioEnd >= 0 ? '+' : ''}${formatUnits(baselineEnd - scenarioEnd)}
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Narrative Coverage by Phase</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Story Phase</th>
                    <th class="text-end">Campaigns</th>
                    <th class="text-end">SKU Promoted</th>
                    <th class="text-end">Up/Down</th>
                    <th class="text-end">Avg SKU Uplift</th>
                    <th>Hit Rate</th>
                  </tr>
                </thead>
                <tbody>${phaseRows || '<tr><td colspan="6" class="text-center text-muted">No narrative-phase coverage found.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Model A: Historical Campaign Effectiveness (Top 5)</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Campaign</th>
                    <th>Story Phase</th>
                    <th>Start Date</th>
                    <th class="text-end">Promoted SKUs</th>
                    <th>Promoted Products</th>
                    <th class="text-end">SKU Up</th>
                    <th class="text-end">SKU Down</th>
                    <th class="text-end">Avg Uplift</th>
                    <th>Best Channel</th>
                  </tr>
                </thead>
                <tbody>${campaignRows || '<tr><td colspan="9" class="text-center text-muted">No campaign history available.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Model B: SKU Include/Exclude Policy for Markdown</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>SKU</th>
                    <th>Group</th>
                    <th class="text-end">Campaigns</th>
                    <th class="text-end">Up/Down</th>
                    <th class="text-end">Avg Uplift</th>
                    <th>Best Channel</th>
                    <th class="text-end">Inventory</th>
                    <th class="text-end">Suggested Depth</th>
                    <th>Policy</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>${policyRows || '<tr><td colspan="10" class="text-center text-muted">No SKU evidence available.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Model C: End-of-Season Markdown Ladder</h6>
            <div class="small text-muted mb-2">Target is to drive inventory closer to zero by week ${horizonWeeks} without collapsing margin.</div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Week</th>
                    <th class="text-end">Markdown Depth</th>
                    <th class="text-end">Projected Units Left</th>
                    <th class="text-end">Margin Floor</th>
                    <th>Clearance Progress</th>
                  </tr>
                </thead>
                <tbody>${ladderRows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Decision Summary</h6>
            <div class="small mb-2"><strong>Keep promoting:</strong> ${includeSkus.length ? includeSkus.join(', ') : 'No clear include candidates yet.'}</div>
            <div class="small mb-0"><strong>Remove from broad markdown:</strong> ${excludedSkus.length ? excludedSkus.join(', ') : 'No strong exclude candidates yet.'}</div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">Simulation Lab: Markdown Decisioning</h6>
              <span class="badge text-bg-primary">Interactive</span>
            </div>
            <div class="row g-3">
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Policy Strictness</label>
                <select id="step7-sim-strictness" class="form-select form-select-sm">
                  <option value="balanced">Balanced</option>
                  <option value="conservative">Conservative</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Phase Focus</label>
                <select id="step7-sim-phase" class="form-select form-select-sm">
                  <option value="all">All Phases</option>
                  <option value="baseline">Start of Season</option>
                  <option value="pivot">In-Season Pivot</option>
                  <option value="future">Future Vision</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Channel Focus</label>
                <select id="step7-sim-channel" class="form-select form-select-sm">
                  <option value="all">All Channels</option>
                  <option value="target">Target</option>
                  <option value="amazon">Amazon</option>
                  <option value="sephora">Sephora</option>
                  <option value="ulta">Ulta</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Markdown Aggressiveness <span id="step7-sim-aggr-value">0 pts</span></label>
                <input type="range" id="step7-sim-aggr" class="form-range" min="0" max="20" step="1" value="0">
              </div>
              <div class="col-lg-4">
                <label class="form-label small fw-semibold mb-1">Margin Floor Guardrail <span id="step7-sim-margin-value">32%</span></label>
                <input type="range" id="step7-sim-margin" class="form-range" min="26" max="40" step="1" value="32">
              </div>
              <div class="col-lg-8">
                <div class="row g-2">
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">Sim Week-${horizonWeeks} Left</div>
                      <div class="fw-semibold" id="step7-sim-left">--</div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">Include / Exclude</div>
                      <div class="fw-semibold" id="step7-sim-policy-count">--</div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">Projected Margin Risk</div>
                      <div class="fw-semibold" id="step7-sim-margin-risk">--</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="row g-3 mt-1">
              <div class="col-lg-5">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">Policy Mix Diagram</div>
                  <div style="height: 220px;">
                    <canvas id="step7-policy-mix-chart"></canvas>
                  </div>
                </div>
              </div>
              <div class="col-lg-7">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">Markdown Ladder Diagram</div>
                  <div style="height: 220px;">
                    <canvas id="step7-clearance-chart"></canvas>
                  </div>
                </div>
              </div>
            </div>
            <div class="border rounded p-2 bg-body mt-2">
              <div class="small text-muted fw-semibold mb-1">Lagged Repeat-Risk Diagram</div>
              <div style="height: 200px;">
                <canvas id="step7-lag-risk-chart"></canvas>
              </div>
            </div>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>SKU</th>
                    <th class="text-end">Score</th>
                    <th class="text-end">Sim Depth</th>
                    <th>Sim Policy</th>
                    <th>Action Rationale</th>
                  </tr>
                </thead>
                <tbody id="step7-sim-policy-body">
                  <tr><td colspan="5" class="text-center text-muted">Adjust controls to simulate markdown decisions.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Week</th>
                    <th class="text-end">Sim Markdown</th>
                    <th class="text-end">Sim Units Left</th>
                    <th class="text-end">Margin Floor</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody id="step7-sim-ladder-body">
                  <tr><td colspan="5" class="text-center text-muted">Ladder simulation updates here.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="small text-muted mt-2" id="step7-sim-note">Simulation note will appear here.</div>
            <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="step7-save-scenario">Save This Markdown Scenario</button>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">Repeat-Risk Elasticity Lab (Churn in Promo Context)</h6>
              <span class="badge text-bg-warning text-dark">Lag Model</span>
            </div>
            <div class="row g-3">
              <div class="col-lg-4">
                <label class="form-label small fw-semibold mb-1">Product</label>
                <select id="step7-churn-sku" class="form-select form-select-sm">
                  <option value="all">Portfolio Avg</option>
                  ${skuProfiles.map(row => `<option value="${row.sku_id}">${row.sku_name}</option>`).join('')}
                </select>
              </div>
              <div class="col-lg-4">
                <label class="form-label small fw-semibold mb-1">Price Posture Change <span id="step7-churn-price-value">+0%</span></label>
                <input type="range" id="step7-churn-price" class="form-range" min="-15" max="20" step="1" value="0">
              </div>
              <div class="col-lg-4">
                <label class="form-label small fw-semibold mb-1">Promo Fatigue Intensity <span id="step7-churn-fatigue-value">0 pts</span></label>
                <input type="range" id="step7-churn-fatigue" class="form-range" min="0" max="20" step="1" value="0">
              </div>
              <div class="col-lg-4">
                <label class="form-label small fw-semibold mb-1">Social Protection <span id="step7-churn-social-value">0 pts</span></label>
                <input type="range" id="step7-churn-social" class="form-range" min="0" max="20" step="1" value="0">
              </div>
              <div class="col-lg-8">
                <div class="row g-2">
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">Peak Repeat-Loss Lift</div>
                      <div class="fw-semibold" id="step7-churn-peak">--</div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">Retained Customers</div>
                      <div class="fw-semibold" id="step7-churn-retained">--</div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="border rounded p-2 bg-body h-100">
                      <div class="small text-muted">12-Week Revenue Impact</div>
                      <div class="fw-semibold" id="step7-churn-revenue">--</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="table-responsive mt-3">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Lag Window</th>
                    <th class="text-end">Repeat-Loss Lift</th>
                    <th class="text-end">Customers at Risk</th>
                    <th class="text-end">Revenue Effect</th>
                  </tr>
                </thead>
                <tbody id="step7-churn-body">
                  <tr><td colspan="4" class="text-center text-muted">Adjust controls to model lagged repeat-loss effects.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="small text-muted mt-2" id="step7-churn-note">Lag-based repeat-loss signal updates here.</div>
          </div>
        </div>
        <div id="step7-python-runner" class="mt-3"></div>
        <div class="alert alert-info mb-0">
          <strong>How to pitch this step:</strong> markdown is evidence-based. Keep SKUs/channels with repeated positive lift and stop discounting weak responders.
          <div class="small mt-1">Data source: <code>promo_metadata.json</code> + week-level inventory from <code>sku_channel_weekly.csv</code>.</div>
        </div>
      `;

      const step7Els = {
        strictness: document.getElementById('step7-sim-strictness'),
        phase: document.getElementById('step7-sim-phase'),
        channel: document.getElementById('step7-sim-channel'),
        aggr: document.getElementById('step7-sim-aggr'),
        margin: document.getElementById('step7-sim-margin'),
        aggrValue: document.getElementById('step7-sim-aggr-value'),
        marginValue: document.getElementById('step7-sim-margin-value'),
        left: document.getElementById('step7-sim-left'),
        policyCount: document.getElementById('step7-sim-policy-count'),
        marginRisk: document.getElementById('step7-sim-margin-risk'),
        policyBody: document.getElementById('step7-sim-policy-body'),
        ladderBody: document.getElementById('step7-sim-ladder-body'),
        note: document.getElementById('step7-sim-note'),
        saveBtn: document.getElementById('step7-save-scenario')
      };
      const step7ChurnEls = {
        sku: document.getElementById('step7-churn-sku'),
        price: document.getElementById('step7-churn-price'),
        fatigue: document.getElementById('step7-churn-fatigue'),
        social: document.getElementById('step7-churn-social'),
        priceValue: document.getElementById('step7-churn-price-value'),
        fatigueValue: document.getElementById('step7-churn-fatigue-value'),
        socialValue: document.getElementById('step7-churn-social-value'),
        peak: document.getElementById('step7-churn-peak'),
        retained: document.getElementById('step7-churn-retained'),
        revenue: document.getElementById('step7-churn-revenue'),
        body: document.getElementById('step7-churn-body'),
        note: document.getElementById('step7-churn-note')
      };
      let step7LastScenario = null;

      const renderStep7Simulation = () => {
        const strictness = step7Els.strictness?.value || 'balanced';
        const phase = step7Els.phase?.value || 'all';
        const channel = step7Els.channel?.value || 'all';
        const aggression = safeNumber(step7Els.aggr?.value);
        const marginFloorBase = safeNumber(step7Els.margin?.value, 32);

        const strictnessCfg = strictness === 'conservative'
          ? { includeMin: 6.0, includeCampaigns: 3, excludeTrigger: -0.5, note: 'Conservative policy prioritizes margin stability.' }
          : strictness === 'aggressive'
            ? { includeMin: 2.5, includeCampaigns: 1, excludeTrigger: -1.2, note: 'Aggressive policy pushes clearance with broader inclusion.' }
            : { includeMin: 4.0, includeCampaigns: 2, excludeTrigger: -0.8, note: 'Balanced policy mixes evidence and clearance need.' };

        const campaignMapBySku = new Map();
        promoEvidence.campaignRowsAll.forEach(campaign => {
          if (phase !== 'all' && String(campaign.story_phase || 'baseline') !== phase) return;
          const src = Object.values(data.promoMetadata || {}).find(item => item && item.campaign_name === campaign.campaign_name);
          const skuResults = Array.isArray(src?.sku_results) ? src.sku_results : [];
          skuResults.forEach(result => {
            if (channel !== 'all' && String(result.channel || '').toLowerCase() !== channel) return;
            if (!campaignMapBySku.has(result.sku_id)) campaignMapBySku.set(result.sku_id, []);
            campaignMapBySku.get(result.sku_id).push(result);
          });
        });

        const scoredRows = promoEvidence.skuRows.map(row => {
          const profile = profileBySku.get(row.sku_id);
          const scopedCampaigns = campaignMapBySku.get(row.sku_id) || [];
          const scopedCount = scopedCampaigns.length || row.campaigns;
          const scopedAvg = scopedCampaigns.length
            ? (scopedCampaigns.reduce((sum, item) => sum + safeNumber(item.sales_uplift_pct), 0) / scopedCampaigns.length)
            : row.avgUplift;
          const score = (scopedAvg * 0.55) + ((row.up - row.down) * 1.2) + (safeNumber(profile?.inventory) / 2000) + (aggression * 0.22);

          let policy = 'Hold';
          if (scopedCount >= strictnessCfg.includeCampaigns && scopedAvg >= strictnessCfg.includeMin && (row.up > row.down || aggression >= 12)) {
            policy = 'Include';
          } else if (scopedAvg <= strictnessCfg.excludeTrigger || (row.down > row.up && strictness !== 'aggressive')) {
            policy = 'Exclude';
          }

          const simDepth = policy === 'Include'
            ? clampValue(12 + aggression + (score > 10 ? 4 : 0), 8, 32)
            : policy === 'Exclude'
              ? clampValue(2 + Math.max(0, aggression - 8) * 0.25, 0, 8)
              : clampValue(8 + (aggression * 0.45), 6, 18);
          const reason = policy === 'Include'
            ? 'High historical lift and/or inventory pressure'
            : policy === 'Exclude'
              ? 'Weak historical response for current focus'
              : 'Mixed signal, keep controlled markdown';
          return {
            ...row,
            scopedCount,
            scopedAvg,
            score,
            policy,
            simDepth,
            reason
          };
        }).sort((a, b) => b.score - a.score);

        const includeCount = scoredRows.filter(row => row.policy === 'Include').length;
        const excludeCount = scoredRows.filter(row => row.policy === 'Exclude').length;
        const avgDepth = scoredRows.length
          ? scoredRows.reduce((sum, row) => sum + row.simDepth, 0) / scoredRows.length
          : 0;
        const inventoryPressure = scoredRows.reduce((sum, row) => sum + safeNumber(profileBySku.get(row.sku_id)?.inventory), 0);
        const clearanceMultiplier = clampValue(0.22 + (avgDepth / 100) + (includeCount * 0.02) + (aggression / 120), 0.15, 0.7);

        let runningUnits = Math.max(0, scenarioEnd);
        const ladderSimRows = ladderWeeks.map((wk, idx) => {
          const stepDepth = clampValue((avgDepth * (0.75 + (idx * 0.12))), 6, 35);
          const marginFloor = Math.max(24, marginFloorBase - (idx * 1.8));
          const unitsDrop = runningUnits * clearanceMultiplier * (stepDepth / 25);
          runningUnits = Math.max(0, Math.round(runningUnits - unitsDrop));
          const progress = scenarioEnd > 0 ? (1 - (runningUnits / scenarioEnd)) : 0;
          return {
            week: wk,
            depth: stepDepth,
            units: runningUnits,
            marginFloor,
            progress
          };
        });

        const marginRiskPct = clampValue((avgDepth / 35) - (marginFloorBase / 100) + (strictness === 'aggressive' ? 0.14 : 0.05), 0, 0.95);
        const residualRatio = safeNumber(inv.startingInventory) > 0 ? (runningUnits / safeNumber(inv.startingInventory)) : 0;
        step7LastScenario = {
          stepKey: 'step7-markdown',
          title: `${strictness} / ${phase} / ${channel}`,
          revenueDeltaPct: (safeNumber(snapshot.revenueDeltaPct) * 0.4) + (includeCount * 0.01) - (excludeCount * 0.004),
          profitDeltaPct: (safeNumber(snapshot.profitDeltaPct) * 0.55) - (avgDepth / 140),
          clearancePct: safeNumber(inv.startingInventory) > 0
            ? (safeNumber(inv.startingInventory) - runningUnits) / safeNumber(inv.startingInventory)
            : 0,
          riskPct: marginRiskPct,
          meta: `aggr ${aggression} / margin floor ${marginFloorBase}%`
        };

        if (step7Els.aggrValue) step7Els.aggrValue.textContent = `${aggression} pts`;
        if (step7Els.marginValue) step7Els.marginValue.textContent = `${marginFloorBase}%`;
        if (step7Els.left) step7Els.left.textContent = formatUnits(runningUnits);
        if (step7Els.policyCount) step7Els.policyCount.textContent = `${includeCount} Include / ${excludeCount} Exclude`;
        if (step7Els.marginRisk) step7Els.marginRisk.textContent = formatSignedPercent(marginRiskPct);
        if (step7Els.note) {
          step7Els.note.textContent =
            `${strictnessCfg.note} Focus: ${phase === 'all' ? 'all phases' : getNarrativePhaseLabel(phase)}; channel ${channel}. Clearance multiplier ${clearanceMultiplier.toFixed(2)} with inventory pressure ${formatUnits(inventoryPressure)} units.`;
        }

        if (step7Els.policyBody) {
          const policyHtml = scoredRows.slice(0, 8).map(row => {
            const badge = row.policy === 'Include'
              ? '<span class="badge bg-success-subtle text-success-emphasis">Include</span>'
              : row.policy === 'Exclude'
                ? '<span class="badge bg-danger-subtle text-danger-emphasis">Exclude</span>'
                : '<span class="badge bg-secondary-subtle text-secondary-emphasis">Hold</span>';
            return `
              <tr>
                <td>${row.sku_name}</td>
                <td class="text-end ${row.score >= 0 ? 'text-success' : 'text-danger'}">${row.score.toFixed(1)}</td>
                <td class="text-end">${row.simDepth.toFixed(0)}%</td>
                <td>${badge}</td>
                <td>${row.reason}</td>
              </tr>
            `;
          }).join('');
          step7Els.policyBody.innerHTML = policyHtml || '<tr><td colspan="5" class="text-center text-muted">No SKU evidence for selected filter.</td></tr>';
        }

        if (step7Els.ladderBody) {
          step7Els.ladderBody.innerHTML = ladderSimRows.map(row => `
            <tr>
              <td>Week ${row.week}</td>
              <td class="text-end">${row.depth.toFixed(0)}%</td>
              <td class="text-end">${formatUnits(row.units)}</td>
              <td class="text-end">${row.marginFloor.toFixed(0)}%</td>
              <td style="min-width: 130px;">
                <div class="progress" style="height: 7px;">
                  <div class="progress-bar ${residualRatio < 0.12 ? 'bg-success' : 'bg-warning'}" role="progressbar" style="width: ${(row.progress * 100).toFixed(1)}%;"></div>
                </div>
              </td>
            </tr>
          `).join('');
        }

        renderStepVisualChart('step7_policy_mix', 'step7-policy-mix-chart', {
          type: 'doughnut',
          data: {
            labels: ['Include', 'Hold', 'Exclude'],
            datasets: [{
              data: [
                includeCount,
                Math.max(0, scoredRows.length - includeCount - excludeCount),
                excludeCount
              ],
              backgroundColor: [
                'rgba(16, 185, 129, 0.85)',
                'rgba(148, 163, 184, 0.85)',
                'rgba(239, 68, 68, 0.85)'
              ],
              borderWidth: 0
            }]
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            cutout: '62%'
          }
        });

        renderStepVisualChart('step7_clearance_path', 'step7-clearance-chart', {
          type: 'line',
          data: {
            labels: ladderSimRows.map(row => `W${row.week}`),
            datasets: [
              {
                label: 'Units Left',
                data: ladderSimRows.map(row => row.units),
                borderColor: 'rgba(37, 99, 235, 0.95)',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                fill: true,
                tension: 0.25,
                pointRadius: 2
              },
              {
                label: 'Markdown Depth %',
                data: ladderSimRows.map(row => row.depth),
                borderColor: 'rgba(245, 158, 11, 0.95)',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                fill: false,
                tension: 0.2,
                pointRadius: 2,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            scales: {
              x: { grid: { display: false } },
              y: { position: 'left', grid: { color: 'rgba(148, 163, 184, 0.18)' } },
              y1: { position: 'right', grid: { drawOnChartArea: false } }
            }
          }
        });
      };

      [step7Els.strictness, step7Els.phase, step7Els.channel, step7Els.aggr, step7Els.margin]
        .filter(Boolean)
        .forEach(el => el.addEventListener('input', renderStep7Simulation));
      if (step7Els.saveBtn) {
        step7Els.saveBtn.addEventListener('click', () => {
          if (step7LastScenario) savePromoAdvancedScenario(step7LastScenario);
        });
      }
      renderStep7Simulation();

      const renderStep7ChurnSimulation = () => {
        const sku = step7ChurnEls.sku?.value || 'all';
        const pricePosture = safeNumber(step7ChurnEls.price?.value);
        const fatigue = safeNumber(step7ChurnEls.fatigue?.value);
        const socialProtection = safeNumber(step7ChurnEls.social?.value);

        const profile = sku !== 'all' ? profileBySku.get(sku) : null;
        const baseElasticity = profile ? profile.absElasticity : (
          skuProfiles.length
            ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.absElasticity), 0) / skuProfiles.length
            : 1.5
        );
        const baselineUnits = profile ? safeNumber(profile.units) : (
          skuProfiles.reduce((sum, row) => sum + safeNumber(row.units), 0)
        );
        const avgPrice = profile
          ? (safeNumber(profile.massPrice, 0) > 0 ? safeNumber(profile.massPrice) : safeNumber(profile.prestigePrice, 22))
          : 22;

        const repeatLossBase = 0.045 + (baseElasticity * 0.004);
        const postureImpact = (pricePosture / 100) * (0.36 + (baseElasticity * 0.08));
        const fatigueImpact = (fatigue / 100) * 0.24;
        const socialOffset = (socialProtection / 100) * 0.21;
        const totalImpact = Math.max(-0.04, postureImpact + fatigueImpact - socialOffset);
        const peakLift = repeatLossBase + totalImpact;

        const lagWeights = [
          { label: '0-4 Weeks', weight: 0.22 },
          { label: '4-8 Weeks', weight: 0.31 },
          { label: '8-12 Weeks', weight: 0.32 },
          { label: '12+ Weeks', weight: 0.15 }
        ];
        const rows = lagWeights.map(item => {
          const lift = totalImpact * item.weight;
          const atRisk = Math.max(0, Math.round(baselineUnits * Math.max(0, lift)));
          const revenueEffect = -1 * atRisk * avgPrice * 1.6;
          return { ...item, lift, atRisk, revenueEffect };
        });

        const totalAtRisk = rows.reduce((sum, row) => sum + row.atRisk, 0);
        const retained = Math.max(0, Math.round(baselineUnits - totalAtRisk));
        const totalRevenue = rows.reduce((sum, row) => sum + row.revenueEffect, 0);

        if (step7ChurnEls.priceValue) step7ChurnEls.priceValue.textContent = `${pricePosture >= 0 ? '+' : ''}${pricePosture}%`;
        if (step7ChurnEls.fatigueValue) step7ChurnEls.fatigueValue.textContent = `${fatigue} pts`;
        if (step7ChurnEls.socialValue) step7ChurnEls.socialValue.textContent = `${socialProtection} pts`;
        if (step7ChurnEls.peak) step7ChurnEls.peak.textContent = formatSignedPercent(peakLift);
        if (step7ChurnEls.retained) step7ChurnEls.retained.textContent = formatUnits(retained);
        if (step7ChurnEls.revenue) step7ChurnEls.revenue.textContent = `${totalRevenue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(totalRevenue))}`;
        if (step7ChurnEls.note) {
          step7ChurnEls.note.textContent =
            `${sku === 'all' ? 'Portfolio' : (profile?.sku_name || sku)} repeat-loss model uses lagged impact windows. Higher social protection lowers effective repeat-loss elasticity.`;
        }
        if (step7ChurnEls.body) {
          step7ChurnEls.body.innerHTML = rows.map(row => `
            <tr>
              <td>${row.label}</td>
              <td class="text-end ${row.lift <= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.lift)}</td>
              <td class="text-end">${formatUnits(row.atRisk)}</td>
              <td class="text-end text-danger">-${formatCurrency(Math.abs(row.revenueEffect))}</td>
            </tr>
          `).join('');
        }

        renderStepVisualChart('step7_lag_risk', 'step7-lag-risk-chart', {
          type: 'bar',
          data: {
            labels: rows.map(row => row.label),
            datasets: [
              {
                label: 'Repeat-loss lift %',
                data: rows.map(row => Number((row.lift * 100).toFixed(2))),
                backgroundColor: rows.map(row => row.lift <= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.8)')
              },
              {
                label: 'Customers at risk',
                data: rows.map(row => row.atRisk),
                backgroundColor: 'rgba(37, 99, 235, 0.7)',
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            scales: {
              x: { grid: { display: false } },
              y: { position: 'left', grid: { color: 'rgba(148, 163, 184, 0.18)' } },
              y1: { position: 'right', grid: { drawOnChartArea: false } }
            }
          }
        });
      };

      [step7ChurnEls.sku, step7ChurnEls.price, step7ChurnEls.fatigue, step7ChurnEls.social]
        .filter(Boolean)
        .forEach(el => el.addEventListener('input', renderStep7ChurnSimulation));
      renderStep7ChurnSimulation();
      const avgStep7Price = skuProfiles.length
        ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.massPrice || row.prestigePrice || 22), 0) / skuProfiles.length
        : 22;
      renderPromoPythonScenarioRunner({
        containerId: 'step7-python-runner',
        stepKey: 'step7',
        modelType: 'churn',
        defaultPrice: avgStep7Price,
        defaultTier: 'ad_supported',
        title: 'Scenario Studio: End-of-Season Markdown'
      });
    }).catch(error => {
      contentArea.innerHTML = `
        <div class="alert alert-warning mb-0">
          Could not load markdown model inputs. ${error.message || 'Unknown error'}
        </div>
      `;
    });
    return;
  }
  if (type === 'migration') {
    contentArea.innerHTML = `
      <div class="card border-0 bg-body-tertiary mb-0">
        <div class="card-body">
          <div class="small text-muted">Loading cross-channel migration model inputs...</div>
        </div>
      </div>
    `;

    ensureNarrativeDataLoaded().then(data => {
      const scopedRows = getNarrativeRowsForSnapshot(data.skuWeekly || [], snapshot);
      const skuProfiles = summarizeSkuRowsForWeek(scopedRows, week)
        .sort((a, b) => b.units - a.units)
        .slice(0, 8);
      const skuMap = new Map(skuProfiles.map(row => [row.sku_id, row]));
      const basePolicies = [
        {
          policy: 'Mass-Only Defense',
          key: 'defense_mass',
          unitLift: (snapshot.unitLiftPct || 0) + 0.022,
          profitDelta: (snapshot.profitDeltaPct || 0) - 0.012,
          note: 'Protect share when marketplaces undercut in mass channels.'
        },
        {
          policy: 'Prestige Halo',
          key: 'prestige_halo',
          unitLift: (snapshot.unitLiftPct || 0) - 0.01,
          profitDelta: (snapshot.profitDeltaPct || 0) + 0.018,
          note: 'Use social pull to shift into premium SKUs with lower discount dependency.'
        },
        {
          policy: 'Balanced Omni',
          key: 'balanced_omni',
          unitLift: (snapshot.unitLiftPct || 0) + 0.008,
          profitDelta: (snapshot.profitDeltaPct || 0) + 0.006,
          note: 'Blend volume and margin objectives across channel groups.'
        }
      ];
      const defaultTargetSku = (snapshot.selectedSku && snapshot.selectedSku !== 'all')
        ? snapshot.selectedSku
        : (skuProfiles[0]?.sku_id || '');
      const targetOptionsHtml = skuProfiles.map(row => `
        <option value="${row.sku_id}" ${row.sku_id === defaultTargetSku ? 'selected' : ''}>${row.sku_name}</option>
      `).join('');

      contentArea.innerHTML = `
        <div class="alert alert-primary mb-3">
          <strong>Future Vision -> Interactive Migration Sandbox:</strong> simulate how channel strategy and SKU focus reallocate demand across your own portfolio and from competitors.
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">Simulation Lab: Cross-Channel Migration</h6>
              <span class="badge text-bg-primary">Interactive</span>
            </div>
            <div class="row g-3">
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Strategy</label>
                <select id="step8-sim-strategy" class="form-select form-select-sm">
                  <option value="balanced_omni">Balanced Omni</option>
                  <option value="defense_mass">Mass-Only Defense</option>
                  <option value="prestige_halo">Prestige Halo</option>
                </select>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Target Product</label>
                <select id="step8-sim-target" class="form-select form-select-sm">
                  ${targetOptionsHtml || '<option value="">No products available</option>'}
                </select>
              </div>
              <div class="col-lg-2">
                <label class="form-label small fw-semibold mb-1">Migration Intensity <span id="step8-sim-intensity-value">100%</span></label>
                <input type="range" id="step8-sim-intensity" class="form-range" min="50" max="180" step="10" value="100">
              </div>
              <div class="col-lg-2">
                <label class="form-label small fw-semibold mb-1">Competitor Move <span id="step8-sim-comp-value">0%</span></label>
                <input type="range" id="step8-sim-comp" class="form-range" min="-15" max="15" step="1" value="0">
              </div>
              <div class="col-lg-2">
                <label class="form-label small fw-semibold mb-1">Media Amplifier <span id="step8-sim-media-value">0 pts</span></label>
                <input type="range" id="step8-sim-media" class="form-range" min="0" max="20" step="1" value="0">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Target & Amazon Depth <span id="step8-sim-mass-value">12%</span></label>
                <input type="range" id="step8-sim-mass" class="form-range" min="0" max="30" step="1" value="${Math.round(safeNumber(snapshot.massPromoDepthPct, 12))}">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Sephora & Ulta Depth <span id="step8-sim-prestige-value">8%</span></label>
                <input type="range" id="step8-sim-prestige" class="form-range" min="0" max="30" step="1" value="${Math.round(safeNumber(snapshot.prestigePromoDepthPct, 8))}">
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Tier Gap Index</label>
                <div class="border rounded p-2 bg-body h-100 d-flex align-items-center justify-content-center fw-semibold" id="step8-sim-gap-index">--</div>
              </div>
              <div class="col-lg-3">
                <label class="form-label small fw-semibold mb-1">Growth Outlook</label>
                <div class="border rounded p-2 bg-body h-100 d-flex align-items-center justify-content-center fw-semibold" id="step8-sim-growth-outlook">--</div>
              </div>
            </div>
            <div class="row g-2 mt-2">
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Migrated Units</div>
                  <div class="fw-semibold" id="step8-sim-units">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Pulled from Competitors</div>
                  <div class="fw-semibold" id="step8-sim-competitor-pull">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Internal Cannibalization</div>
                  <div class="fw-semibold" id="step8-sim-cannibal">--</div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted">Profit Delta (Policy)</div>
                  <div class="fw-semibold" id="step8-sim-profit">--</div>
                </div>
              </div>
            </div>
            <div class="row g-3 mt-1">
              <div class="col-lg-6">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">Policy Tradeoff Diagram (Revenue vs Profit)</div>
                  <div style="height: 220px;">
                    <canvas id="step8-policy-tradeoff-chart"></canvas>
                  </div>
                </div>
              </div>
              <div class="col-lg-6">
                <div class="border rounded p-2 bg-body h-100">
                  <div class="small text-muted fw-semibold mb-1">Tier Transition Diagram</div>
                  <div style="height: 220px;">
                    <canvas id="step8-tier-flow-chart"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Policy Outcome Board</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Policy</th>
                    <th class="text-end">Projected Unit Lift</th>
                    <th class="text-end">Projected Profit Delta</th>
                    <th>When to Use</th>
                  </tr>
                </thead>
                <tbody id="step8-sim-policy-body">
                  <tr><td colspan="4" class="text-center text-muted">Adjust controls to see policy outcomes.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Tier Migration Flow (Mass vs Prestige)</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Transition</th>
                    <th class="text-end">Rate</th>
                    <th class="text-end">Customers</th>
                    <th class="text-end">Revenue Effect</th>
                    <th>Flow Intensity</th>
                  </tr>
                </thead>
                <tbody id="step8-tier-flow-body">
                  <tr><td colspan="5" class="text-center text-muted">Adjust controls to simulate tier migration.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Top Migration Routes</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>From Product</th>
                    <th>To Product</th>
                    <th>Group</th>
                    <th class="text-end">Sim Shift Units</th>
                    <th>Signal Driver</th>
                  </tr>
                </thead>
                <tbody id="step8-sim-route-body">
                  <tr><td colspan="5" class="text-center text-muted">No migration simulated yet.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="border rounded p-2 bg-body mt-2">
              <div class="small text-muted fw-semibold mb-1">Route Intensity Diagram</div>
              <div style="height: 200px;">
                <canvas id="step8-route-chart"></canvas>
              </div>
            </div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Migration Matrix (Cannibalization Heatmap)</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0" id="step8-sim-matrix">
                <tbody><tr><td class="text-center text-muted">Adjust inputs to render matrix.</td></tr></tbody>
              </table>
            </div>
            <div class="small text-muted mt-2" id="step8-sim-note">Simulation note will appear here.</div>
          </div>
        </div>
        <div class="card border-0 bg-body-tertiary mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="text-uppercase text-muted mb-0">Advanced Analysis: Scenario Comparator</h6>
              <button type="button" class="btn btn-sm btn-outline-primary" id="step8-save-scenario">Save Current Scenario</button>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-md-4">
                <label class="form-label small fw-semibold mb-1">Ranking Objective</label>
                <select id="step8-rank-objective" class="form-select form-select-sm">
                  <option value="balanced">Balanced</option>
                  <option value="growth">Growth Focus</option>
                  <option value="profit">Profit Focus</option>
                </select>
              </div>
              <div class="col-md-8">
                <div class="border rounded p-2 bg-body h-100 small text-muted" id="step8-scenario-summary">
                  Save scenarios to compare growth, profit, clearance, and risk tradeoffs.
                </div>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Scenario</th>
                    <th class="text-end">Revenue</th>
                    <th class="text-end">Profit</th>
                    <th class="text-end">Clearance</th>
                    <th class="text-end">Risk</th>
                    <th class="text-end">Score</th>
                  </tr>
                </thead>
                <tbody id="step8-ranked-scenarios-body">
                  <tr><td colspan="6" class="text-center text-muted">No saved scenarios yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div id="step8-python-runner" class="mt-3"></div>
        <div class="alert alert-info mb-0">
          <strong>Why this matters:</strong> teams can test channel-specific promo policies before execution and quantify where volume comes from: competitor capture vs internal migration.
        </div>
      `;

      const step8Els = {
        strategy: document.getElementById('step8-sim-strategy'),
        target: document.getElementById('step8-sim-target'),
        intensity: document.getElementById('step8-sim-intensity'),
        comp: document.getElementById('step8-sim-comp'),
        media: document.getElementById('step8-sim-media'),
        mass: document.getElementById('step8-sim-mass'),
        prestige: document.getElementById('step8-sim-prestige'),
        intensityValue: document.getElementById('step8-sim-intensity-value'),
        compValue: document.getElementById('step8-sim-comp-value'),
        mediaValue: document.getElementById('step8-sim-media-value'),
        massValue: document.getElementById('step8-sim-mass-value'),
        prestigeValue: document.getElementById('step8-sim-prestige-value'),
        gapIndex: document.getElementById('step8-sim-gap-index'),
        growthOutlook: document.getElementById('step8-sim-growth-outlook'),
        units: document.getElementById('step8-sim-units'),
        competitorPull: document.getElementById('step8-sim-competitor-pull'),
        cannibal: document.getElementById('step8-sim-cannibal'),
        profit: document.getElementById('step8-sim-profit'),
        policyBody: document.getElementById('step8-sim-policy-body'),
        tierFlowBody: document.getElementById('step8-tier-flow-body'),
        routeBody: document.getElementById('step8-sim-route-body'),
        matrix: document.getElementById('step8-sim-matrix'),
        note: document.getElementById('step8-sim-note'),
        saveBtn: document.getElementById('step8-save-scenario'),
        rankObjective: document.getElementById('step8-rank-objective'),
        rankedBody: document.getElementById('step8-ranked-scenarios-body'),
        summary: document.getElementById('step8-scenario-summary')
      };

      const renderStep8Simulation = () => {
        const strategy = step8Els.strategy?.value || 'balanced_omni';
        const targetSku = step8Els.target?.value || defaultTargetSku;
        const intensity = safeNumber(step8Els.intensity?.value, 100) / 100;
        const compShift = safeNumber(step8Els.comp?.value);
        const mediaBoost = safeNumber(step8Els.media?.value);
        const massDepth = safeNumber(step8Els.mass?.value, safeNumber(snapshot.massPromoDepthPct, 12));
        const prestigeDepth = safeNumber(step8Els.prestige?.value, safeNumber(snapshot.prestigePromoDepthPct, 8));
        const tierGapIndex = clampValue((prestigeDepth - massDepth) / 30, -1, 1);
        const targetProfile = skuMap.get(targetSku) || skuProfiles[0] || null;
        const strategyBias = strategy === 'defense_mass'
          ? { unit: 0.03, profit: -0.012 }
          : strategy === 'prestige_halo'
            ? { unit: -0.004, profit: 0.018 }
            : { unit: 0.012, profit: 0.006 };

        const simPolicies = basePolicies.map(row => {
          const strategyMatchBonus = row.key === strategy ? 0.024 : 0;
          const unitLift = row.unitLift + strategyBias.unit + strategyMatchBonus + ((intensity - 1) * 0.05) + ((-compShift / 100) * 0.06) + ((mediaBoost / 100) * 0.03) - (tierGapIndex * 0.015);
          const profitDelta = row.profitDelta + strategyBias.profit + (row.key === strategy ? 0.009 : 0) - ((intensity - 1) * 0.025) + ((mediaBoost / 100) * 0.018) + (tierGapIndex * 0.014);
          return { ...row, unitLift, profitDelta };
        });
        const selectedPolicy = simPolicies.find(row => row.key === strategy) || simPolicies[0];

        const transferMap = new Map();
        const pushTransfer = (fromSku, toSku, units, driver) => {
          if (!fromSku || !toSku || fromSku === toSku) return;
          if (!skuMap.has(fromSku) || !skuMap.has(toSku)) return;
          const bounded = clampValue(units, 0, safeNumber(skuMap.get(fromSku)?.units, 0) * 0.32);
          if (bounded <= 0) return;
          const key = `${fromSku}|${toSku}`;
          if (!transferMap.has(key)) {
            transferMap.set(key, {
              from_sku: fromSku,
              to_sku: toSku,
              from_name: skuMap.get(fromSku)?.sku_name || fromSku,
              to_name: skuMap.get(toSku)?.sku_name || toSku,
              group: skuMap.get(toSku)?.product_group || '-',
              units: 0,
              driver
            });
          }
          const entry = transferMap.get(key);
          entry.units += bounded;
        };

        transferRows.forEach(row => {
          const fromSku = row.from_sku;
          const toSku = row.to_sku;
          if (!skuMap.has(fromSku) || !skuMap.has(toSku)) return;
          const scaled = safeNumber(row.units) * (0.55 + ((intensity - 1) * 0.9));
          pushTransfer(fromSku, toSku, scaled, 'Observed baseline pattern');
        });

        if (targetProfile) {
          skuProfiles.forEach(source => {
            if (source.sku_id === targetProfile.sku_id) return;
            let flow = safeNumber(source.units) * (0.012 + (0.055 * intensity) + (mediaBoost / 1000));
            if (source.product_group === targetProfile.product_group) flow *= 1.35;
            else flow *= 0.42;
            if (strategy === 'prestige_halo' && safeNumber(targetProfile.prestigePrice) > safeNumber(source.prestigePrice)) flow *= 1.18;
            if (strategy === 'defense_mass' && targetProfile.avgGapPct > 0) flow *= 1.22;
            if (tierGapIndex > 0 && source.product_group !== targetProfile.product_group) flow *= 0.9;
            if (tierGapIndex < 0 && source.product_group === targetProfile.product_group) flow *= 1.08;
            if (compShift < 0) flow *= 1.08;
            if (compShift > 0) flow *= 0.92;
            pushTransfer(source.sku_id, targetProfile.sku_id, flow, source.product_group === targetProfile.product_group ? 'Within-group cannibalization' : 'Cross-group migration');
          });
        }

        const transfers = [...transferMap.values()].sort((a, b) => b.units - a.units);
        const totalMoved = transfers.reduce((sum, row) => sum + safeNumber(row.units), 0);
        const competitorCaptureShare = clampValue(0.34 + (Math.max(0, -compShift) / 45) + (mediaBoost / 120), 0.12, 0.82);
        const competitorCapture = totalMoved * competitorCaptureShare;
        const internalCannibal = Math.max(0, totalMoved - competitorCapture);
        const massUnits = skuProfiles
          .filter(row => Number.isFinite(safeNumber(row.massPrice, null)))
          .reduce((sum, row) => sum + safeNumber(row.units), 0);
        const prestigeUnits = skuProfiles
          .filter(row => Number.isFinite(safeNumber(row.prestigePrice, null)))
          .reduce((sum, row) => sum + safeNumber(row.units), 0);
        const upgradeRate = clampValue(0.035 + ((massDepth - prestigeDepth) / 240) + (mediaBoost / 400) + (strategy === 'prestige_halo' ? 0.015 : 0), 0.01, 0.18);
        const downgradeRate = clampValue(0.022 + ((prestigeDepth - massDepth) / 260) + (strategy === 'defense_mass' ? 0.01 : 0), 0.005, 0.16);
        const cancelMassRate = clampValue(0.028 + (Math.max(0, compShift) / 250) + (massDepth / 700) + (mediaBoost > 10 ? -0.004 : 0), 0.01, 0.14);
        const cancelPrestigeRate = clampValue(0.024 + (Math.max(0, compShift) / 300) + (prestigeDepth / 800), 0.008, 0.12);
        const upgradedCustomers = Math.round(massUnits * upgradeRate);
        const downgradedCustomers = Math.round(prestigeUnits * downgradeRate);
        const cancelMassCustomers = Math.round(massUnits * cancelMassRate);
        const cancelPrestigeCustomers = Math.round(prestigeUnits * cancelPrestigeRate);
        const avgMassPrice = skuProfiles.length
          ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.massPrice, 20), 0) / skuProfiles.length
          : 20;
        const avgPrestigePrice = skuProfiles.length
          ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.prestigePrice, 31), 0) / skuProfiles.length
          : 31;
        const upgradeRev = upgradedCustomers * Math.max(0, (avgPrestigePrice - avgMassPrice));
        const downgradeRev = -1 * downgradedCustomers * Math.max(0, (avgPrestigePrice - avgMassPrice));
        const cancelMassRev = -1 * cancelMassCustomers * avgMassPrice;
        const cancelPrestigeRev = -1 * cancelPrestigeCustomers * avgPrestigePrice;
        const growthOutlook = selectedPolicy.unitLift > 0.07
          ? 'High Growth'
          : selectedPolicy.unitLift > 0.025
            ? 'Moderate Growth'
            : 'Cautious';

        if (step8Els.intensityValue) step8Els.intensityValue.textContent = `${Math.round(intensity * 100)}%`;
        if (step8Els.compValue) step8Els.compValue.textContent = `${compShift >= 0 ? '+' : ''}${compShift}%`;
        if (step8Els.mediaValue) step8Els.mediaValue.textContent = `${mediaBoost} pts`;
        if (step8Els.massValue) step8Els.massValue.textContent = `${massDepth.toFixed(0)}%`;
        if (step8Els.prestigeValue) step8Els.prestigeValue.textContent = `${prestigeDepth.toFixed(0)}%`;
        if (step8Els.gapIndex) step8Els.gapIndex.textContent = `${tierGapIndex >= 0 ? '+' : ''}${(tierGapIndex * 100).toFixed(0)} pts`;
        if (step8Els.growthOutlook) step8Els.growthOutlook.textContent = growthOutlook;
        if (step8Els.units) step8Els.units.textContent = formatUnits(totalMoved);
        if (step8Els.competitorPull) step8Els.competitorPull.textContent = formatUnits(competitorCapture);
        if (step8Els.cannibal) step8Els.cannibal.textContent = formatUnits(internalCannibal);
        if (step8Els.profit) step8Els.profit.textContent = formatSignedPercent(selectedPolicy?.profitDelta || 0);
        if (step8Els.note) {
          step8Els.note.textContent =
            `Target ${targetProfile?.sku_name || '--'} with ${strategy.replace('_', ' ')} strategy. Simulated ${formatUnits(totalMoved)} migrating units (${Math.round(competitorCaptureShare * 100)}% competitor capture).`;
        }

        if (step8Els.policyBody) {
          step8Els.policyBody.innerHTML = simPolicies.map(row => `
            <tr class="${row.key === strategy ? 'table-primary' : ''}">
              <td>${row.policy}</td>
              <td class="text-end ${row.unitLift >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.unitLift)}</td>
              <td class="text-end ${row.profitDelta >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.profitDelta)}</td>
              <td>${row.note}</td>
            </tr>
          `).join('');
        }

        const tierFlows = [
          { label: 'Mass -> Prestige (Upgrade)', rate: upgradeRate, customers: upgradedCustomers, revenue: upgradeRev, cls: 'bg-success' },
          { label: 'Prestige -> Mass (Downgrade)', rate: downgradeRate, customers: downgradedCustomers, revenue: downgradeRev, cls: 'bg-warning' },
          { label: 'Mass -> Exit', rate: cancelMassRate, customers: cancelMassCustomers, revenue: cancelMassRev, cls: 'bg-danger' },
          { label: 'Prestige -> Exit', rate: cancelPrestigeRate, customers: cancelPrestigeCustomers, revenue: cancelPrestigeRev, cls: 'bg-danger' }
        ];

        if (step8Els.tierFlowBody) {
          const maxFlowCustomers = Math.max(1, ...tierFlows.map(flow => flow.customers));
          step8Els.tierFlowBody.innerHTML = tierFlows.map(flow => `
            <tr>
              <td>${flow.label}</td>
              <td class="text-end">${formatSignedPercent(flow.rate)}</td>
              <td class="text-end">${formatUnits(flow.customers)}</td>
              <td class="text-end ${flow.revenue >= 0 ? 'text-success' : 'text-danger'}">${flow.revenue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(flow.revenue))}</td>
              <td style="min-width: 130px;">
                <div class="progress" style="height: 7px;">
                  <div class="progress-bar ${flow.cls}" role="progressbar" style="width: ${((flow.customers / maxFlowCustomers) * 100).toFixed(1)}%;"></div>
                </div>
              </td>
            </tr>
          `).join('');
        }

        if (step8Els.routeBody) {
          const routeHtml = transfers.slice(0, 10).map(row => `
            <tr>
              <td>${row.from_name}</td>
              <td>${row.to_name}</td>
              <td class="text-capitalize">${String(row.group || '-').replace('_', ' ')}</td>
              <td class="text-end">${formatUnits(row.units)}</td>
              <td>${row.driver}</td>
            </tr>
          `).join('');
          step8Els.routeBody.innerHTML = routeHtml || '<tr><td colspan="5" class="text-center text-muted">No routes for current simulation.</td></tr>';
        }

        renderStepVisualChart('step8_tradeoff', 'step8-policy-tradeoff-chart', {
          type: 'scatter',
          data: {
            datasets: [{
              label: 'Policy scenarios',
              data: simPolicies.map(row => ({
                x: Number((row.unitLift * 100).toFixed(2)),
                y: Number((row.profitDelta * 100).toFixed(2)),
                policy: row.policy,
                selected: row.key === strategy
              })),
              pointRadius: simPolicies.map(row => row.key === strategy ? 8 : 5),
              pointBackgroundColor: simPolicies.map(row => row.key === strategy ? 'rgba(37, 99, 235, 0.95)' : 'rgba(148, 163, 184, 0.75)')
            }]
          },
          options: {
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const raw = ctx.raw || {};
                    return `${raw.policy || 'Policy'}: Revenue ${ctx.parsed.x.toFixed(1)}%, Profit ${ctx.parsed.y.toFixed(1)}%`;
                  }
                }
              }
            },
            scales: {
              x: { title: { display: true, text: 'Revenue Lift %' }, grid: { color: 'rgba(148, 163, 184, 0.18)' } },
              y: { title: { display: true, text: 'Profit Delta %' }, grid: { color: 'rgba(148, 163, 184, 0.18)' } }
            }
          }
        });

        renderStepVisualChart('step8_tier_flow_chart', 'step8-tier-flow-chart', {
          type: 'bar',
          data: {
            labels: tierFlows.map(flow => flow.label.replace(' -> ', '→')),
            datasets: [
              {
                label: 'Customers',
                data: tierFlows.map(flow => flow.customers),
                backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(220, 38, 38, 0.8)'],
                yAxisID: 'y'
              },
              {
                label: 'Rate %',
                data: tierFlows.map(flow => Number((flow.rate * 100).toFixed(2))),
                backgroundColor: 'rgba(37, 99, 235, 0.3)',
                borderColor: 'rgba(37, 99, 235, 0.9)',
                type: 'line',
                tension: 0.25,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            plugins: { legend: { position: 'bottom' } },
            scales: {
              x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0 } },
              y: { position: 'left', grid: { color: 'rgba(148, 163, 184, 0.18)' } },
              y1: { position: 'right', grid: { drawOnChartArea: false } }
            }
          }
        });

        const routeTop = transfers.slice(0, 8);
        renderStepVisualChart('step8_route_chart', 'step8-route-chart', {
          type: 'bar',
          data: {
            labels: routeTop.map(row => `${row.from_name}→${row.to_name}`),
            datasets: [{
              label: 'Shift units',
              data: routeTop.map(row => Number(row.units.toFixed(1))),
              backgroundColor: routeTop.map(row => row.driver.includes('Within') ? 'rgba(245, 158, 11, 0.85)' : 'rgba(59, 130, 246, 0.85)')
            }]
          },
          options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(148, 163, 184, 0.18)' } },
              y: { grid: { display: false } }
            }
          }
        });

        if (step8Els.matrix) {
          const matrixSkus = skuProfiles.slice(0, 6);
          const matrixMap = new Map();
          let maxUnits = 0;
          transfers.forEach(row => {
            const key = `${row.from_sku}|${row.to_sku}`;
            const units = safeNumber(row.units);
            matrixMap.set(key, (matrixMap.get(key) || 0) + units);
            if (units > maxUnits) maxUnits = units;
          });

          const header = `
            <thead class="table-light">
              <tr>
                <th>From \\ To</th>
                ${matrixSkus.map(item => `<th class="text-center">${item.sku_name}</th>`).join('')}
              </tr>
            </thead>
          `;
          const body = matrixSkus.map(from => {
            const cells = matrixSkus.map(to => {
              if (from.sku_id === to.sku_id) return '<td class="text-center text-muted">-</td>';
              const value = matrixMap.get(`${from.sku_id}|${to.sku_id}`) || 0;
              if (value <= 0) return '<td class="text-center text-muted">0</td>';
              const alpha = maxUnits > 0 ? (0.12 + ((value / maxUnits) * 0.58)) : 0.12;
              return `<td class="text-center fw-semibold" style="background: rgba(59, 130, 246, ${alpha.toFixed(3)});">${formatUnits(value)}</td>`;
            }).join('');
            return `<tr><th class="text-nowrap">${from.sku_name}</th>${cells}</tr>`;
          }).join('');
          step8Els.matrix.innerHTML = `${header}<tbody>${body}</tbody>`;
        }

        if (step8Els.saveBtn) {
          step8Els.saveBtn.onclick = () => {
            savePromoAdvancedScenario({
              stepKey: 'step8-migration',
              title: `${strategy.replace('_', ' ')} / ${targetProfile?.sku_name || 'Portfolio'}`,
              revenueDeltaPct: selectedPolicy.unitLift * 0.82,
              profitDeltaPct: selectedPolicy.profitDelta,
              clearancePct: safeNumber(inv.startingInventory) > 0
                ? (safeNumber(inv.startingInventory) - Math.max(0, scenarioEnd - totalMoved)) / safeNumber(inv.startingInventory)
                : 0,
              riskPct: clampValue((cancelMassRate + cancelPrestigeRate) / 2, 0, 0.5),
              meta: `mass ${massDepth.toFixed(0)}%, prestige ${prestigeDepth.toFixed(0)}%, comp ${compShift >= 0 ? '+' : ''}${compShift}%`
            });
            renderRankedScenarios();
          };
        }
      };

      const renderRankedScenarios = () => {
        const objective = step8Els.rankObjective?.value || 'balanced';
        const ranked = rankPromoAdvancedScenarios(objective).slice(0, 8);
        if (step8Els.rankedBody) {
          if (!ranked.length) {
            step8Els.rankedBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No saved scenarios yet.</td></tr>';
          } else {
            step8Els.rankedBody.innerHTML = ranked.map(row => `
              <tr>
                <td>
                  <div class="fw-semibold">${row.title}</div>
                  <div class="small text-muted">${row.meta || ''}</div>
                </td>
                <td class="text-end ${row.revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.revenueDeltaPct)}</td>
                <td class="text-end ${row.profitDeltaPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.profitDeltaPct)}</td>
                <td class="text-end">${formatSignedPercent(row.clearancePct)}</td>
                <td class="text-end text-danger">${formatSignedPercent(row.riskPct)}</td>
                <td class="text-end fw-semibold">${row.score.toFixed(2)}</td>
              </tr>
            `).join('');
          }
        }
        if (step8Els.summary) {
          const count = promoAdvancedScenarioBank.length;
          step8Els.summary.textContent = count > 0
            ? `${count} scenarios saved. Ranking objective: ${objective}. Top score ${ranked[0] ? ranked[0].score.toFixed(2) : '--'}.`
            : 'Save scenarios to compare growth, profit, clearance, and risk tradeoffs.';
        }
      };

      [step8Els.strategy, step8Els.target, step8Els.intensity, step8Els.comp, step8Els.media, step8Els.mass, step8Els.prestige]
        .filter(Boolean)
        .forEach(el => el.addEventListener('input', renderStep8Simulation));
      if (step8Els.rankObjective) {
        step8Els.rankObjective.addEventListener('input', renderRankedScenarios);
      }
      renderStep8Simulation();
      renderRankedScenarios();
      const avgStep8Price = skuProfiles.length
        ? skuProfiles.reduce((sum, row) => sum + safeNumber(row.massPrice || row.prestigePrice || 24), 0) / skuProfiles.length
        : 24;
      renderPromoPythonScenarioRunner({
        containerId: 'step8-python-runner',
        stepKey: 'step8',
        modelType: 'migration',
        defaultPrice: avgStep8Price,
        defaultTier: 'ad_free',
        title: 'Scenario Studio: Future Vision Migration'
      });
    }).catch(error => {
      contentArea.innerHTML = `
        <div class="alert alert-warning mb-0">
          Could not load migration model inputs. ${error.message || 'Unknown error'}
        </div>
      `;
    });
    return;
  }

  contentArea.innerHTML = `
    <div class="alert alert-warning mb-0">Unknown model type: ${type}</div>
  `;
}

/**
 * Helper function to show elasticity model for a specific tab
 * @param {string} modelType - 'acquisition', 'churn', or 'migration'
 * @param {string} containerId - ID of the container to append content to
 */
function showElasticityModel(modelType, containerId) {
  const elasticityModelsSection = document.getElementById('elasticity-models-section');
  const contentArea = document.getElementById(`${containerId}-content`);

  if (!elasticityModelsSection || !contentArea) return;

  if (window.hideScenarioResults && typeof window.hideScenarioResults === 'function') {
    window.hideScenarioResults();
  }

  // Show ONLY the elasticity models section (scenario engine)
  // NOT the comparison or analytics sections - those are separate
  elasticityModelsSection.style.display = 'block';

  // Move it into the content area if not already there
  if (elasticityModelsSection.parentElement !== contentArea) {
    contentArea.appendChild(elasticityModelsSection);
  }

  // Hide the tab navigation (we'll show content directly)
  const tabNav = elasticityModelsSection.querySelector('.nav-tabs');
  if (tabNav) {
    tabNav.style.display = 'none';
  }

  // Activate the correct tab pane
  const allTabs = elasticityModelsSection.querySelectorAll('.tab-pane');
  allTabs.forEach(tab => {
    tab.classList.remove('show', 'active');
  });

  // Show the specific tab based on modelType
  let targetTabId = '';
  if (modelType === 'acquisition') {
    targetTabId = 'acquisition-pane';
  } else if (modelType === 'churn') {
    targetTabId = 'churn-pane';
  } else if (modelType === 'migration') {
    targetTabId = 'migration-pane';
  }

  const targetTab = document.getElementById(targetTabId);
  if (targetTab) {
    targetTab.classList.add('show', 'active');
  }

  if (window.setActiveModelType && typeof window.setActiveModelType === 'function') {
    window.setActiveModelType(modelType);
  }

  // Ensure scenario cards are populated
  if (window.populateElasticityModelTabs && typeof window.populateElasticityModelTabs === 'function') {
    window.populateElasticityModelTabs();
  }

  // If the target model has no results yet, ensure results stay hidden
  if (window.getCurrentResultForModel && typeof window.getCurrentResultForModel === 'function') {
    const modelResult = window.getCurrentResultForModel(modelType);
    if (!modelResult && window.hideScenarioResults && typeof window.hideScenarioResults === 'function') {
      window.hideScenarioResults();
    }
  }
}

/**
 * Create navigation buttons for a step
 * @param {number} prevStep - Previous step number
 * @param {number} nextStep - Next step number
 * @param {string} nextLabel - Label for next button
 * @returns {HTMLElement} Navigation div element
 */
function createStepNavigation(prevStep, nextStep, nextLabel = 'Next') {
  const nav = document.createElement('div');
  nav.className = 'section-header-nav';

  // Back button
  if (prevStep !== null) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary-custom';
    backBtn.onclick = () => goToStep(prevStep);
    backBtn.innerHTML = '<i class="bi bi-arrow-left me-2"></i> Back';
    nav.appendChild(backBtn);
  }

  // Next button
  if (nextStep !== null) {
    const nextBtn = document.createElement('button');
    nextBtn.className = nextStep === 0 ? 'btn btn-secondary-custom' : 'btn btn-primary-custom';
    nextBtn.onclick = () => goToStep(nextStep);

    if (nextStep === 0) {
      nextBtn.innerHTML = '<i class="bi bi-house me-2"></i> Back to Start';
    } else {
      nextBtn.innerHTML = `${nextLabel} <i class="bi bi-arrow-right ms-2"></i>`;
    }
    nav.appendChild(nextBtn);
  }

  return nav;
}

/**
 * Inject navigation buttons into step containers
 */
function injectStepNavigations() {
  const stepConfigs = [
    { step: 1, container: 'step-2-data-viewer-container', prev: 0, next: 2, nextLabel: 'Next: Current State Overview' },
    { step: 3, container: 'step-10-weekly-container', prev: 2, next: 4, nextLabel: 'Next: Event Calendar' },
    { step: 4, container: 'step-8-calendar-container', prev: 3, next: 5, nextLabel: 'Next: Customer Cohorts' },
    { step: 5, container: 'step-6-segmentation-container', prev: 4, next: 6, nextLabel: 'Next: Segment Comparison' },
    { step: 6, container: 'step-7-analysis-container', prev: 5, next: 7, nextLabel: 'Next: In-Season Planner Models' },
    { step: 7, container: 'step-3-acquisition-container', prev: 6, next: 8, nextLabel: 'Next: Markdown Decision Models' },
    { step: 8, container: 'step-4-churn-container', prev: 7, next: 9, nextLabel: 'Next: Migration Model' },
    { step: 9, container: 'step-5-migration-container', prev: 8, next: 10, nextLabel: 'Next: AI Assistant' },
    { step: 10, container: 'step-9-chat-container', prev: 9, next: 0, nextLabel: null }
  ];

  stepConfigs.forEach(config => {
    const container = document.getElementById(config.container);
    if (!container) return;

    // Create wrapper structure: top-nav, content-area, bottom-nav
    const topNav = createStepNavigation(config.prev, config.next, config.nextLabel);
    topNav.classList.add('step-nav-top');

    const contentArea = document.createElement('div');
    contentArea.classList.add('step-content-area');
    contentArea.id = `${config.container}-content`;

    const bottomNav = createStepNavigation(config.prev, config.next, config.nextLabel);
    bottomNav.classList.add('step-nav-bottom');

    // Clear container and append in order
    container.innerHTML = '';
    container.appendChild(topNav);
    container.appendChild(contentArea);
    container.appendChild(bottomNav);
  });
}

/**
 * Initialize the steps overview modal behavior
 */
function initStepsOverviewModal() {
  const modalEl = document.getElementById('stepsOverviewModal');
  if (!modalEl || !window.bootstrap) return;

  modalEl.querySelectorAll('.steps-table-row').forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.dataset.step, 10);
      if (Number.isNaN(step)) return;

      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalEl.addEventListener('hidden.bs.modal', () => {
        goToStep(step);
      }, { once: true });
      modalInstance.hide();
    });
  });
}

/**
 * Initialize step navigation
 */
function initStepNavigation() {
  // Add click handlers to step dots
  document.querySelectorAll('.step-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const step = parseInt(dot.dataset.step);
      goToStep(step);
    });
  });

  // Inject navigation buttons for all steps
  injectStepNavigations();

  // Hook up steps overview modal
  initStepsOverviewModal();

  // Refresh advanced model sections when planning horizon changes (default 17 -> configurable)
  window.addEventListener('promo:horizon-change', () => {
    if ([7, 8, 9].includes(currentStep)) {
      showStepContent(currentStep);
    }
  });

  const pendingStep = Number(window.__pendingStepNavigation);
  if (Number.isFinite(pendingStep) && pendingStep >= 0 && pendingStep < TOTAL_STEPS) {
    window.__pendingStepNavigation = null;
    goToStep(pendingStep);
    return;
  }

  // Auto-load into Step 1 (skip hero splash)
  goToStep(1);
}

// Make goToStep available globally before initialization completes.
window.goToStep = goToStep;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStepNavigation);
} else {
  initStepNavigation();
}


