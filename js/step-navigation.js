/**
 * Step Navigation System
 * Manages the step-by-step navigation flow for the Promotion Optimization Studio
 * Now with 10 steps (0-9) for better progressive disclosure
 */

const TOTAL_STEPS = 10; // 0-9
let currentStep = 0;
const stepSectionMap = {
  0: 'section-0',
  1: 'section-1',
  2: 'section-2',
  3: 'section-8',
  4: 'section-6',
  5: 'section-7',
  6: 'section-3',
  7: 'section-4',
  8: 'section-5',
  9: 'section-9'
};

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
  // Hide all original content sections
  const allSections = [
    'load-data-section',
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
      // Dashboard - load-data-section and kpi-section are now INSIDE section-1
      // Trigger data loading if not already loaded
      if (window.loadAppData && !window.dataLoaded) {
        window.dataLoaded = true; // Set immediately to prevent multiple calls

        // IMPORTANT: Wait for section animation to complete and ensure loading UI is visible
        setTimeout(() => {
          // Make sure loading section is visible
          const loadSection = document.getElementById('load-data-section');
          const loadingProgress = document.getElementById('loading-progress');
          if (loadSection) {
            loadSection.style.display = 'block';
            loadSection.style.visibility = 'visible';
            loadSection.style.opacity = '1';
          }
          if (loadingProgress) {
            loadingProgress.style.display = 'block';
            loadingProgress.style.visibility = 'visible';
          }

          // Start loading data
          window.loadAppData().catch(error => {
            console.error('Failed to load data:', error);
            window.dataLoaded = false; // Reset on error
            // Show error message to user
            if (loadSection) {
              loadSection.innerHTML = `
                <div class="glass-card">
                  <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Failed to load data.</strong> ${error.message}
                    <button class="btn btn-sm btn-outline-danger ms-3" onclick="location.reload()">Retry</button>
                  </div>
                </div>
              `;
            }
          });
        }, 100); // Small delay to ensure DOM is ready after section animation starts
      }
      break;
    case 2:
      // Data Explorer - Show data viewer
      const dataViewerSection = document.getElementById('data-viewer-section');
      const dataViewerContentArea = document.getElementById('step-2-data-viewer-container-content');
      if (dataViewerSection && dataViewerContentArea) {
        dataViewerSection.style.display = 'block';
        // Move data viewer into step 2 content area if not already there
        if (dataViewerSection.parentElement !== dataViewerContentArea) {
          dataViewerContentArea.appendChild(dataViewerSection);
        }
      }
      break;
    case 3:
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
    case 4:
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
    case 5:
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
    case 6:
      // In-Season Planner model board
      renderRoadmapFutureModule('planner', 'step-3-acquisition-container-content');
      break;
    case 7:
      // End-of-Season markdown model board
      renderRoadmapFutureModule('markdown', 'step-4-churn-container-content');
      break;
    case 8:
      // Cross-channel migration model board
      renderRoadmapFutureModule('migration', 'step-5-migration-container-content');
      break;
    case 9:
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
  const inventoryProjection = snapshot?.inventoryProjection || {};
  const startInventory = safeNumber(inventoryProjection.startingInventory);
  const baselineTargetEnd = safeNumber(inventoryProjection.baselineEnd);
  const scenarioTargetEnd = safeNumber(inventoryProjection.scenarioEnd);

  const weeklyDemandMap = new Map();
  rows.forEach(row => {
    const week = safeNumber(row.week_of_season, 0);
    if (week <= currentWeek || week > 17) return;
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

  for (let week = currentWeek + 1; week <= 17; week += 1) {
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
          <p class="text-muted mb-2">Run Step 1 first to feed this section with live promotion outputs.</p>
          <div class="alert alert-light border mb-0">
            These sections are model-driven and consume live week, inventory trajectory, competitor shock, social shock, and SKU migration from Step 1.
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
                  <h6 class="text-uppercase text-muted mb-0">Season Trajectory to Week 17</h6>
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
                    <th class="text-end">Mass Promo</th>
                    <th class="text-end">Prestige Promo</th>
                    <th class="text-end">Expected Unit Lift</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>${actionRows || '<tr><td colspan="8" class="text-center text-muted">No SKU profiles available for this week.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="alert alert-info mb-0">
          <strong>How to pitch this step:</strong> this is a weekly operating model, not static elasticity. Re-run every signal shift and show exactly how channel-specific promo depths change.
          <div class="small mt-1">Data source: <code>sku_channel_weekly.csv</code>, <code>market_signals.csv</code>, <code>social_signals.csv</code>.</div>
        </div>
      `;
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
      const ladderWeeks = [14, 15, 16, 17];
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
          <strong>Past Promotion Effect + Markdown Model:</strong> choose markdown SKUs from historical lift evidence by channel, then sequence markdown depth to land closer to zero by week 17.
        </div>
        <div class="row g-3 mb-3">
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Week-17 Baseline Left</div>
              <div class="fs-5 fw-semibold">${formatUnits(baselineEnd)}</div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="border rounded p-3 h-100 bg-body">
              <div class="small text-muted">Week-17 Scenario Left</div>
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
            <div class="small text-muted mb-2">Target is to drive inventory closer to zero by week 17 without collapsing margin.</div>
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
        <div class="alert alert-info mb-0">
          <strong>How to pitch this step:</strong> markdown is evidence-based. Keep SKUs/channels with repeated positive lift and stop discounting weak responders.
          <div class="small mt-1">Data source: <code>promo_metadata.json</code> + week-level inventory from <code>sku_channel_weekly.csv</code>.</div>
        </div>
      `;
    }).catch(error => {
      contentArea.innerHTML = `
        <div class="alert alert-warning mb-0">
          Could not load markdown model inputs. ${error.message || 'Unknown error'}
        </div>
      `;
    });
    return;
  }
  const policyRows = [
    {
      policy: 'Mass-Only Defense',
      unitLift: (snapshot.unitLiftPct || 0) + 0.022,
      profitDelta: (snapshot.profitDeltaPct || 0) - 0.012,
      note: 'Protect share when marketplaces undercut'
    },
    {
      policy: 'Prestige Hold',
      unitLift: (snapshot.unitLiftPct || 0) - 0.01,
      profitDelta: (snapshot.profitDeltaPct || 0) + 0.018,
      note: 'Preserve margin where social pull is strong'
    },
    {
      policy: 'Balanced Omni',
      unitLift: (snapshot.unitLiftPct || 0) + 0.008,
      profitDelta: (snapshot.profitDeltaPct || 0) + 0.006,
      note: 'Blend volume and margin objectives'
    }
  ];

  const policyHtml = policyRows.map(row => `
    <tr>
      <td>${row.policy}</td>
      <td class="text-end ${row.unitLift >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.unitLift)}</td>
      <td class="text-end ${row.profitDelta >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercent(row.profitDelta)}</td>
      <td>${row.note}</td>
    </tr>
  `).join('');

  const transferHtml = topTransfers.length
    ? topTransfers.map(row => `
      <li>${row.from_sku_name || row.from_sku} -> ${row.to_sku_name || row.to_sku}: ${formatUnits(row.units)} units</li>
    `).join('')
    : '<li>No strong migration routes yet. Use targeted SKU promo to reveal spillover.</li>';

  contentArea.innerHTML = `
    <div class="card border-0 bg-body-tertiary mb-3">
      <div class="card-body">
        <h6 class="text-uppercase text-muted mb-2">Cross-Channel Migration Model</h6>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Policy</th>
                <th class="text-end">Projected Unit Lift</th>
                <th class="text-end">Projected Profit Delta</th>
                <th>Use Case</th>
              </tr>
            </thead>
            <tbody>${policyHtml}</tbody>
          </table>
        </div>
        <div class="mt-3">
          <div class="small text-muted mb-1">Top observed migration routes in current scenario (${formatUnits(totalShift)} shifted units):</div>
          <ul class="small mb-0 ps-3">${transferHtml}</ul>
        </div>
      </div>
    </div>
    <div class="alert alert-info mb-0">
      <strong>Why this matters:</strong> This model helps teams forecast where demand moves when channel-specific promotions run, reducing unintended cannibalization and channel conflict.
    </div>
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
    { step: 2, container: 'step-2-data-viewer-container', prev: 1, next: 3, nextLabel: 'Next: Event Calendar' },
    { step: 3, container: 'step-8-calendar-container', prev: 2, next: 4, nextLabel: 'Next: Customer Cohorts' },
    { step: 4, container: 'step-6-segmentation-container', prev: 3, next: 5, nextLabel: 'Next: Segment Comparison' },
    { step: 5, container: 'step-7-analysis-container', prev: 4, next: 6, nextLabel: 'Next: In-Season Planner Models' },
    { step: 6, container: 'step-3-acquisition-container', prev: 5, next: 7, nextLabel: 'Next: Markdown Decision Models' },
    { step: 7, container: 'step-4-churn-container', prev: 6, next: 8, nextLabel: 'Next: Migration Model' },
    { step: 8, container: 'step-5-migration-container', prev: 7, next: 9, nextLabel: 'Next: AI Assistant' },
    { step: 9, container: 'step-9-chat-container', prev: 8, next: 0, nextLabel: null }
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

  // Start at step 0 (hero)
  goToStep(0);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStepNavigation);
} else {
  initStepNavigation();
}

// Make goToStep available globally for onclick handlers
window.goToStep = goToStep;


