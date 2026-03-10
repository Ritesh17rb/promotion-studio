/**
 * Main Application Module
 * Orchestrates the Supergoop Seasonal Promotion POC
 *
 * Dependencies: data-loader.js, scenario-engine.js, charts.js
 */

import {
  loadAllData,
  loadScenarios,
  getWeeklyData,
  loadElasticityParams,
  getChannelElasticityData,
  loadSkuWeeklyData,
  loadExternalFactors,
  loadCompetitorPriceFeed,
  loadSocialSignals,
  loadPromoMetadata
} from './data-loader.js';
import {
  simulateScenario,
  simulateScenarioWithPyodide,
  initializePyodideModels,
  isPyodideAvailable,
  compareScenarios as compareScenariosEngine
} from './scenario-engine.js';
import { renderDemandCurve, renderElasticityHeatmap, renderTierMixShift, renderTradeoffsScatter, renderComparisonBarChart, renderRadarChart } from './charts.js';
import {
  initializeChat,
  configureLLM,
  sendMessage,
  clearHistory,
  isLLMConfigured,
  generateLiveCopilot,
  generateScenarioPlanFromText,
  generateEventAnalyst
} from './chat.js';
import { initializeDataViewer } from './data-viewer.js';
import { renderSegmentKPICards, renderSegmentElasticityHeatmap, render3AxisRadialChart, renderSegmentScatterPlot, exportSVG } from './segment-charts.js';
import { renderChannelElasticityBar, renderChannelElasticityHeatmap, renderChannelSummary } from './channel-charts.js';
import { getAcquisitionCohorts, getChurnCohorts } from './cohort-aggregator.js';
import { pyodideBridge } from './pyodide-bridge.js';
import { initializeEventCalendar } from './event-calendar.js';
import { rankScenarios, getObjectiveDescription } from './decision-engine.js';
import { exportToPDF, exportToXLSX } from './decision-pack.js';

// Global state
let allScenarios = [];
let dataLoaded = false;

const modelTypes = ['acquisition', 'churn', 'migration'];
let activeModelType = 'acquisition';

let selectedScenarioByModel = {
  acquisition: null,
  churn: null,
  migration: null
};

let currentResultByModel = {
  acquisition: null,
  churn: null,
  migration: null
};

let savedScenariosByModel = {
  acquisition: [],
  churn: [],
  migration: []
};

let allSimulationResultsByModel = {
  acquisition: [],
  churn: [],
  migration: []
};

let selectedScenario = selectedScenarioByModel[activeModelType];
let savedScenarios = savedScenariosByModel[activeModelType];
let currentResult = currentResultByModel[activeModelType];
let step2CompetitiveChart = null;
let step2SocialChart = null;
let step2SkuImpactChart = null;
let commercialSalesProjectionChart = null;
let commercialSocialPowerChart = null;
let comparisonWeek5Chart = null;
let activeCommercialContext = null;
let llmStatusCached = null;
let llmStatusLastCheckedAt = 0;
let liveCopilotDebounceTimer = null;
let liveCopilotInFlight = false;
let selectedEventForLlm = null;
let llmBusinessContext = {};

const CHANNEL_PRICE = {
  ad_supported: 24.0,
  ad_free: 36.0
};

const segmentSkuProfiles = {
  all: {
    sku_id: 'all',
    sku_name: 'All Products',
    product_group: 'all',
    elasticityByTier: { ad_supported: 2.0, ad_free: 1.4 }
  }
};
let cohortWatchlistContext = null;
let cohortWatchlistContextPromise = null;
let selectedWatchlistCompositeKey = null;

// Format helpers
function formatNumber(num) {
  // Check for null, undefined, NaN, and Infinity
  if (num === null || num === undefined || !Number.isFinite(num)) {
    return 'N/A';
  }
  return num.toLocaleString();
}

function formatCurrency(num) {
  // Check for null, undefined, NaN, and Infinity
  if (num === null || num === undefined || !Number.isFinite(num)) {
    return 'N/A';
  }
  return `$${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function formatPercent(num, decimals = 1) {
  // Check for null, undefined, NaN, and Infinity
  if (num === null || num === undefined || !Number.isFinite(num)) {
    return 'N/A';
  }
  return `${num.toFixed(decimals)}%`;
}

function formatRatePercent(rate, options = {}) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return 'N/A';
  }

  const {
    standardDecimals = 1,
    smallDecimals = 2,
    tinyThresholdPct = 0.01
  } = options;

  const pct = Number(rate) * 100;
  const absPct = Math.abs(pct);

  if (absPct > 0 && absPct < tinyThresholdPct) {
    return `<${tinyThresholdPct.toFixed(2)}%`;
  }

  const decimals = absPct < 0.1 ? smallDecimals : standardDecimals;
  return `${pct.toFixed(decimals)}%`;
}

function formatPercentagePointDelta(rateDelta, options = {}) {
  if (rateDelta === null || rateDelta === undefined || !Number.isFinite(rateDelta)) {
    return 'N/A';
  }

  const {
    standardDecimals = 2,
    smallDecimals = 3
  } = options;

  const pp = Number(rateDelta) * 100;
  const absPp = Math.abs(pp);
  const decimals = absPp < 0.01 && absPp > 0 ? smallDecimals : standardDecimals;

  return `${pp >= 0 ? '+' : ''}${pp.toFixed(decimals)} pp`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatClockTime(value) {
  if (!value) return 'Not simulated yet';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not simulated yet';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatShortDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function startButtonLoading(buttonOrId, loadingText) {
  const buttonEl = typeof buttonOrId === 'string'
    ? document.getElementById(buttonOrId)
    : buttonOrId;
  if (!buttonEl) return () => {};

  const originalHtml = buttonEl.innerHTML;
  const originalDisabled = buttonEl.disabled;
  buttonEl.disabled = true;
  buttonEl.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${loadingText}`;

  return ({ disabled } = {}) => {
    buttonEl.innerHTML = originalHtml;
    if (typeof disabled === 'boolean') {
      buttonEl.disabled = disabled;
    } else {
      buttonEl.disabled = originalDisabled;
    }
  };
}

function updateRecommendationBrief(text = '') {
  const briefEl = document.getElementById('recommended-scenario-brief');
  if (!briefEl) return;

  if (text) {
    briefEl.innerHTML = text;
    return;
  }

  const count = savedScenariosByModel[activeModelType]?.length || 0;
  if (count === 0) {
    briefEl.textContent = 'Save at least one simulated scenario for this step to enable quick recommendation.';
    return;
  }
  briefEl.textContent = `${count} saved scenario(s) available for one-click recommendation.`;
}

function updateAdvancedScenarioStatePanels() {
  const panelMap = {
    acquisition: {
      stateId: 'acquisition-advanced-state',
      updatedId: 'acquisition-advanced-updated',
      modelNote: 'Start-of-season baseline with in-season acquisition push.'
    },
    churn: {
      stateId: 'churn-advanced-state',
      updatedId: 'churn-advanced-updated',
      modelNote: 'Markdown path with delayed repeat-risk across 0-4 / 4-8 / 8-12 / 12+ weeks.'
    },
    migration: {
      stateId: 'migration-advanced-state',
      updatedId: 'migration-advanced-updated',
      modelNote: 'Competitor capture vs internal SKU cannibalization route economics.'
    }
  };

  Object.entries(panelMap).forEach(([modelType, meta]) => {
    const stateEl = document.getElementById(meta.stateId);
    const updatedEl = document.getElementById(meta.updatedId);
    if (!stateEl || !updatedEl) return;

    const scenario = selectedScenarioByModel[modelType];
    const activeResultForModel = currentResultByModel[modelType];

    if (!scenario) {
      stateEl.textContent = 'Select a scenario and run simulation to populate this state.';
      updatedEl.textContent = 'No scenario selected';
      return;
    }

    const result = activeResultForModel && activeResultForModel.scenario_id === scenario.id
      ? activeResultForModel
      : null;

    const currentPrice = Number(scenario?.config?.current_price);
    const newPrice = Number(scenario?.config?.new_price);
    const priceMovePctRaw = Number(scenario?.config?.price_change_pct);
    const fallbackPriceMovePct = (Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(newPrice))
      ? ((newPrice - currentPrice) / currentPrice) * 100
      : 0;
    const priceMovePct = Number.isFinite(priceMovePctRaw) ? priceMovePctRaw : fallbackPriceMovePct;
    const promoStart = scenario?.config?.promotion?.start_date || scenario?.config?.effective_date;
    const promoEnd = scenario?.config?.promotion?.end_date || scenario?.config?.effective_date;
    const revDelta = Number(result?.delta?.revenue_pct) || 0;
    const volumeDelta = Number(result?.delta?.customers_pct) || 0;
    const repeatRiskDelta = Number(result?.delta?.repeat_loss_rate) || 0;

    const resultLine = result
      ? `Latest sim: Revenue ${revDelta >= 0 ? '+' : ''}${formatPercent(revDelta, 1)}, Volume proxy ${volumeDelta >= 0 ? '+' : ''}${formatPercent(volumeDelta, 1)}, Repeat-risk ${repeatRiskDelta >= 0 ? '+' : ''}${formatPercent(repeatRiskDelta, 2)} pp.`
      : 'No simulation yet for this scenario in current session.';

    stateEl.innerHTML = `
      <strong>${scenario.name}</strong><br>
      Price path: ${formatCurrency(currentPrice)} to ${formatCurrency(newPrice)} (${priceMovePct >= 0 ? '+' : ''}${formatPercent(priceMovePct, 1)}).<br>
      Window: ${formatShortDate(promoStart)} to ${formatShortDate(promoEnd)}.<br>
      ${meta.modelNote}<br>
      ${resultLine}
    `;
    updatedEl.textContent = result?.recalculated_at
      ? `Last recalculated ${formatClockTime(result.recalculated_at)}`
      : 'Selected, not simulated';
  });

  updateRecommendationBrief();
}

function normalizeSocialScore(rawScore) {
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  if (score <= 1.5 && score >= -1.5) return score * 100;
  return score;
}

function socialElasticityModifier(score) {
  const normalized = normalizeSocialScore(score);
  if (!Number.isFinite(normalized)) return 1.0;
  const clipped = clamp(normalized, 35, 95);
  return clamp(1.18 - ((clipped - 35) * 0.0075), 0.72, 1.26);
}

function socialDemandMultiplier(score) {
  const normalized = normalizeSocialScore(score);
  if (!Number.isFinite(normalized)) return 1.0;
  const clipped = clamp(normalized, 35, 95);
  return clamp(0.8 + ((clipped - 35) * 0.0067), 0.75, 1.22);
}

function getScenarioConfigFromResult(result) {
  if (result?.scenario_config) return result.scenario_config;
  if (result?.scenario_id) {
    const match = allScenarios.find(s => s.id === result.scenario_id);
    if (match?.config) return match.config;
  }
  const modelType = resolveModelTypeForResult(result);
  return selectedScenarioByModel[modelType]?.config || selectedScenario?.config || {};
}

function safeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDateKey(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function findSeasonWeekForDate(rows, dateValue) {
  const normalizedDate = normalizeDateKey(dateValue);
  if (!normalizedDate || !Array.isArray(rows)) return null;
  const exact = rows.find(row => normalizeDateKey(row.week_start || row.date) === normalizedDate);
  return exact ? asFiniteNumber(exact.week_of_season) : null;
}

function resolveCommercialScopeFromScenario(result, skuRows, liveSnapshot) {
  const config = getScenarioConfigFromResult(result);
  const eligibility = String(config?.promotion?.eligibility || '').trim().toLowerCase();
  const scope = {
    selectedGroup: 'all',
    selectedSku: 'all',
    applyMass: true,
    applyPrestige: true,
    source: eligibility || config?.tier || 'default',
    description: 'Portfolio-wide'
  };

  let channelLocked = false;

  switch (eligibility) {
    case 'mass_channels':
      scope.applyMass = true;
      scope.applyPrestige = false;
      scope.description = 'Mass channels';
      channelLocked = true;
      break;
    case 'moisturizer_prestige':
      scope.selectedGroup = 'moisturizer';
      scope.applyMass = false;
      scope.applyPrestige = true;
      scope.description = 'Prestige moisturizer';
      channelLocked = true;
      break;
    case 'sunscreen_group':
      scope.selectedGroup = 'sunscreen';
      scope.description = 'Sunscreen portfolio';
      break;
    case 'sunscreen_sku_1':
      scope.selectedGroup = 'sunscreen';
      scope.selectedSku = 'SUN_S1';
      scope.description = 'Sunscreen SKU-1';
      break;
    case 'selected_skus':
      scope.description = 'Selected SKUs';
      break;
    case 'omni':
      scope.applyMass = true;
      scope.applyPrestige = true;
      scope.description = 'Omni-channel portfolio';
      channelLocked = true;
      break;
    default:
      break;
  }

  if (!channelLocked) {
    if (config?.tier === 'ad_supported') {
      scope.applyMass = true;
      scope.applyPrestige = false;
      if (scope.description === 'Portfolio-wide') {
        scope.description = 'Mass-channel portfolio';
      }
    } else if (config?.tier === 'ad_free') {
      scope.applyMass = false;
      scope.applyPrestige = true;
      if (scope.description === 'Portfolio-wide') {
        scope.description = 'Prestige-channel portfolio';
      }
    } else {
      scope.applyMass = liveSnapshot?.applyMass ?? true;
      scope.applyPrestige = liveSnapshot?.applyPrestige ?? true;
    }
  }

  if (scope.selectedSku === 'all' && liveSnapshot?.selectedSku && liveSnapshot.selectedSku !== 'all' && eligibility === 'selected_skus') {
    scope.selectedSku = liveSnapshot.selectedSku;
    scope.description = `Selected SKUs (${liveSnapshot.selectedSku})`;
  }

  if (scope.selectedGroup === 'all' && liveSnapshot?.selectedGroup && liveSnapshot.selectedGroup !== 'all' && eligibility === 'selected_skus') {
    scope.selectedGroup = liveSnapshot.selectedGroup;
  }

  const maxDataWeek = skuRows.reduce((max, row) => Math.max(max, safeNumber(row.week_of_season, 0)), 0) || 17;
  const scenarioWeek = findSeasonWeekForDate(skuRows, config?.effective_date || config?.promotion?.start_date);
  const defaultDataWeek = skuRows.find(row => safeBoolean(row.is_current_week, false))?.week_of_season;
  const resolvedCurrentWeek = asFiniteNumber(scenarioWeek)
    ?? asFiniteNumber(defaultDataWeek)
    ?? asFiniteNumber(liveSnapshot?.weekOfSeason)
    ?? 5;
  const currentWeek = clamp(
    resolvedCurrentWeek,
    1,
    maxDataWeek
  );

  return {
    ...scope,
    effectiveDate: normalizeDateKey(config?.effective_date || config?.promotion?.start_date),
    currentWeek,
    horizonWeek: maxDataWeek,
    scenarioStartWeek: currentWeek
  };
}

function formatSignedPercentFromRatio(ratio, decimals = 1) {
  if (!Number.isFinite(ratio)) return 'N/A';
  const pct = ratio * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(decimals)}%`;
}

function getCommercialPosture(priceHeadroomPct, priceMovePct, socialTrendDelta) {
  if (priceHeadroomPct >= 0.08) return 'Raise selectively / trim discounts';
  if (priceHeadroomPct >= 0.03) return 'Hold price, do not over-discount';
  if (priceMovePct > 0 && priceHeadroomPct <= 0) return 'Price increase needs stronger support';
  if (priceMovePct < 0 && priceHeadroomPct >= 0.04) return 'Discount may be deeper than needed';
  if (socialTrendDelta < -4) return 'Demand support is fading; stay tactical';
  return 'Use targeted promotion only';
}

function getModelTypeFromTabId(tabId) {
  if (tabId === 'acquisition-tab') return 'acquisition';
  if (tabId === 'churn-tab') return 'churn';
  if (tabId === 'migration-tab') return 'migration';
  return activeModelType;
}

function syncScenarioSelectionUI() {
  const activePane = document.querySelector('.tab-pane.active');
  if (!activePane) return;
  activePane.querySelectorAll('.scenario-card-tab').forEach(card => card.classList.remove('selected'));
  if (selectedScenario) {
    const card = activePane.querySelector(`.scenario-card-tab[data-scenario-id="${selectedScenario.id}"]`);
    if (card) card.classList.add('selected');
  }
}

function updateScenarioComparisonUI() {
  const count = savedScenarios.length;
  const countLabel = document.getElementById('saved-scenarios-count');
  const compareBtn = document.getElementById('compare-btn');
  const comparisonSection = document.getElementById('comparison-section');
  const comparisonCharts = document.getElementById('comparison-charts');

  if (countLabel) {
    countLabel.textContent = `${count} scenario${count !== 1 ? 's' : ''} saved`;
  }
  if (compareBtn) {
    compareBtn.disabled = count < 2;
  }
  if (comparisonSection) {
    comparisonSection.style.display = count > 0 ? 'block' : 'none';
  }
  if (comparisonCharts && count < 2) {
    comparisonCharts.style.display = 'none';
    if (comparisonWeek5Chart) {
      comparisonWeek5Chart.destroy();
      comparisonWeek5Chart = null;
    }
    renderScenarioComparisonOutlookTable();
  }
}

function updateSimulateButtonState() {
  const simulateBtn = document.getElementById('simulate-btn-models');
  if (simulateBtn) {
    simulateBtn.disabled = !selectedScenario;
  }
}

function updateResultContainerForModel() {
  const resultContainer = document.getElementById('result-container-models');
  if (!resultContainer) return;
  const resolvedModelType = resolveModelTypeForResult(currentResult);
  if (!currentResult || (resolvedModelType && resolvedModelType !== activeModelType)) {
    resultContainer.style.display = 'none';
    clearResultsUI();
    return;
  }
  resultContainer.style.display = 'block';
  displayResultsInTabs(currentResult);
}

function clearResultsUI() {
  const cards = document.getElementById('result-cards-models');
  if (cards) cards.innerHTML = '';
  const warning = document.getElementById('new-tier-warning');
  if (warning) {
    warning.style.display = 'none';
    warning.innerHTML = '';
  }
  const acquisitionDetail = document.getElementById('acquisition-results-detail');
  const churnDetail = document.getElementById('churn-results-detail');
  const migrationDetail = document.getElementById('migration-results-detail');
  const commercialSection = document.getElementById('commercial-context-section');
  activeCommercialContext = null;
  if (acquisitionDetail) acquisitionDetail.style.display = 'none';
  if (churnDetail) churnDetail.style.display = 'none';
  if (migrationDetail) migrationDetail.style.display = 'none';
  if (commercialSection) commercialSection.style.display = 'none';
  if (commercialSalesProjectionChart) {
    commercialSalesProjectionChart.destroy();
    commercialSalesProjectionChart = null;
  }
  if (commercialSocialPowerChart) {
    commercialSocialPowerChart.destroy();
    commercialSocialPowerChart = null;
  }
}

function hideScenarioResults() {
  const resultContainer = document.getElementById('result-container-models');
  if (resultContainer) {
    resultContainer.style.display = 'none';
  }
  clearResultsUI();
}

/**
 * Update Decision Engine ranking display for the current active model type
 */
function updateDecisionEngineDisplay() {
  const container = document.getElementById('top-scenarios-container');
  const list = document.getElementById('top-scenarios-list');

  if (!container || !list) return;

  // Check if rankings exist for the current model type
  const currentTop3 = window.currentTop3ScenariosByModel?.[activeModelType];

  if (currentTop3 && currentTop3.length > 0) {
    // Rankings exist for this model, display them
    displayTop3Scenarios(currentTop3);
  } else {
    // No rankings for this model, hide the container
    container.style.display = 'none';
    list.innerHTML = '';
  }
}

function setActiveModelType(modelType) {
  if (!modelTypes.includes(modelType)) return;
  activeModelType = modelType;
  selectedScenario = selectedScenarioByModel[modelType];
  savedScenarios = savedScenariosByModel[modelType];
  currentResult = currentResultByModel[modelType];
  allSimulationResults = allSimulationResultsByModel[modelType];

  // Debug logging
  console.log(`🔄 Switching to ${modelType} model`, {
    hasResult: !!currentResult,
    resultModelType: currentResult?.model_type,
    resultScenarioId: currentResult?.scenario_id,
    storedResults: Object.keys(currentResultByModel).reduce((acc, key) => {
      acc[key] = currentResultByModel[key] ? {
        model_type: currentResultByModel[key].model_type,
        scenario_id: currentResultByModel[key].scenario_id
      } : null;
      return acc;
    }, {})
  });

  const comparisonCharts = document.getElementById('comparison-charts');
  if (comparisonCharts) comparisonCharts.style.display = 'none';
  // Clear any previously displayed results from other models
  hideScenarioResults();
  // Re-render results for this model if they exist
  if (currentResult) {
    const resultContainer = document.getElementById('result-container-models');
    if (resultContainer) resultContainer.style.display = 'block';
    displayResultsInTabs(currentResult, true); // Pass true to indicate this is a re-display, not a new simulation
  }
  syncScenarioSelectionUI();
  updateScenarioComparisonUI();
  updateSimulateButtonState();
  // Update Decision Engine display for this model
  updateDecisionEngineDisplay();
  updateAdvancedScenarioStatePanels();
}

function resolveModelTypeForResult(result) {
  if (!result) return null;
  if (result.model_type) return result.model_type;
  if (result.scenario_config?.model_type) return result.scenario_config.model_type;
  if (result.scenario_id) {
    const match = allScenarios.find(s => s.id === result.scenario_id);
    if (match?.model_type) return match.model_type;
  }
  return null;
}

function startSimulateLoading() {
  const loadingEl = document.getElementById('simulate-loading');
  const labelEl = document.getElementById('simulate-loading-label');
  const barEl = document.getElementById('simulate-loading-bar');

  if (!loadingEl || !labelEl || !barEl) {
    return {
      done: Promise.resolve(),
      stop: () => {}
    };
  }

  const duration = 2600 + Math.random() * 1000;
  const start = performance.now();

  loadingEl.style.display = 'block';
  labelEl.textContent = 'Running scenario simulation...';
  barEl.style.width = '0%';
  barEl.textContent = '0%';
  barEl.setAttribute('aria-valuenow', '0');

  let resolveDone;
  const done = new Promise(resolve => {
    resolveDone = resolve;
  });

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const percent = Math.round(progress * 100);
    barEl.style.width = `${percent}%`;
    barEl.textContent = `${percent}%`;
    barEl.setAttribute('aria-valuenow', String(percent));

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      labelEl.textContent = 'Finalizing...';
      resolveDone();
    }
  };

  requestAnimationFrame(tick);

  return {
    done,
    stop: () => {
      loadingEl.style.display = 'none';
    }
  };
}

// Load KPI data
async function loadKPIs() {
  try {
    const weeklyData = await getWeeklyData('all');
    const latestWeek = {};
    const previousWeek = {};

    // Get latest week for each tier
    ['ad_supported', 'ad_free'].forEach(tier => {
      const tierData = weeklyData.filter(d => d.tier === tier);
      latestWeek[tier] = tierData[tierData.length - 1];
      previousWeek[tier] = tierData.length > 1 ? tierData[tierData.length - 2] : tierData[tierData.length - 1];
    });

    // Calculate totals
    const totalSubs = Object.values(latestWeek).reduce((sum, d) => sum + d.active_customers, 0);
    const totalRevenue = Object.values(latestWeek).reduce((sum, d) => sum + d.revenue, 0) * 4; // Weekly to monthly
    const avgAOV = totalRevenue / totalSubs;
    const avgChurn = Object.values(latestWeek).reduce((sum, d) => sum + d.repeat_loss_rate, 0) / 2;

    const prevSubs = Object.values(previousWeek).reduce((sum, d) => sum + d.active_customers, 0);
    const prevRevenue = Object.values(previousWeek).reduce((sum, d) => sum + d.revenue, 0) * 4;
    const prevAOV = prevSubs > 0 ? prevRevenue / prevSubs : 0;
    const prevChurn = Object.values(previousWeek).reduce((sum, d) => sum + d.repeat_loss_rate, 0) / 2;

    const subsDelta = prevSubs > 0 ? (totalSubs - prevSubs) / prevSubs : 0;
    const revenueDelta = prevRevenue > 0 ? (totalRevenue - prevRevenue) / prevRevenue : 0;
    const aovDelta = avgAOV - prevAOV;
    const churnDelta = avgChurn - prevChurn;

    // Update KPI cards
    document.getElementById('kpi-customers').textContent = formatNumber(totalSubs);
    document.getElementById('kpi-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpi-aov').textContent = formatCurrency(avgAOV);
    // repeat_loss_rate is stored as a decimal (0.05 = 5%), so convert to a display percent here.
    document.getElementById('kpi-churn').textContent = formatRatePercent(avgChurn);

    document.getElementById('kpi-customers-change').textContent = `${subsDelta >= 0 ? '+' : ''}${(subsDelta * 100).toFixed(1)}% vs prior week`;
    document.getElementById('kpi-revenue-change').textContent = `${revenueDelta >= 0 ? '+' : ''}${(revenueDelta * 100).toFixed(1)}% vs prior week`;
    document.getElementById('kpi-aov-change').textContent = `${aovDelta >= 0 ? '+' : ''}${formatCurrency(Math.abs(aovDelta))} vs prior week`;
    document.getElementById('kpi-churn-change').textContent = `${formatPercentagePointDelta(churnDelta)} vs prior week`;

  } catch (error) {
    console.error('Error loading KPIs:', error);
  }
}

async function initializeStep2SignalsLab() {
  const massEl = document.getElementById('step2-signal-comp-mass');
  const prestigeEl = document.getElementById('step2-signal-comp-prestige');
  const socialScoreEl = document.getElementById('step2-signal-social-score');
  const socialTrendEl = document.getElementById('step2-signal-social-trend');
  const changeLogEl = document.getElementById('step2-signal-change-log');
  const methodNoteEl = document.getElementById('step2-signal-method-note');
  const skuImpactBodyEl = document.getElementById('step2-signal-sku-impact-body');
  const skuImpactNoteEl = document.getElementById('step2-signal-sku-impact-note');
  const compCanvas = document.getElementById('step2-signal-comp-chart');
  const socialCanvas = document.getElementById('step2-signal-social-chart');
  const skuCanvas = document.getElementById('step2-signal-sku-chart');

  if (
    !massEl || !prestigeEl || !socialScoreEl || !socialTrendEl || !changeLogEl ||
    !methodNoteEl || !skuImpactBodyEl || !skuImpactNoteEl ||
    !compCanvas || !socialCanvas || !skuCanvas
  ) {
    return;
  }

  try {
    const [externalFactors, socialSignals, skuWeekly] = await Promise.all([
      loadExternalFactors(),
      loadSocialSignals(),
      loadSkuWeeklyData()
    ]);
    if (!externalFactors?.length || !socialSignals?.length || !skuWeekly?.length) return;

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const toPct = (decimal, digits = 1) => `${(decimal * 100).toFixed(digits)}%`;

    const currentWeek = skuWeekly.find(r => r.is_current_week === true)?.week_of_season
      || Math.max(...skuWeekly.map(r => Number(r.week_of_season || 0)));
    const previousWeek = Math.max(1, Number(currentWeek) - 1);
    const currentRows = skuWeekly.filter(r => Number(r.week_of_season) === Number(currentWeek));
    const previousRows = skuWeekly.filter(r => Number(r.week_of_season) === Number(previousWeek));
    const prevRowBySkuChannel = new Map(
      previousRows.map(row => [`${row.sku_id}|${row.sales_channel}`, row])
    );

    const skuWeekByDate = new Map();
    skuWeekly.forEach(row => {
      if (!skuWeekByDate.has(row.date)) skuWeekByDate.set(row.date, Number(row.week_of_season));
    });

    const ownByDate = new Map();
    skuWeekly.forEach(row => {
      const key = row.date;
      if (!ownByDate.has(key)) {
        ownByDate.set(key, {
          massSum: 0,
          massCount: 0,
          prestigeSum: 0,
          prestigeCount: 0
        });
      }
      const bucket = ownByDate.get(key);
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

    const externalSorted = [...externalFactors].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const compLabels = [];
    const ownMassSeries = [];
    const compMassSeries = [];
    const ownPrestigeSeries = [];
    const compPrestigeSeries = [];

    externalSorted.forEach(row => {
      const own = ownByDate.get(row.date);
      if (!own) return;
      const ownMass = own.massCount ? own.massSum / own.massCount : null;
      const ownPrestige = own.prestigeCount ? own.prestigeSum / own.prestigeCount : null;
      const compMass = toNum(row.competitor_mass_price);
      const compPrestige = toNum(row.competitor_prestige_price);
      if (!Number.isFinite(ownMass) || !Number.isFinite(ownPrestige) || !Number.isFinite(compMass) || !Number.isFinite(compPrestige)) return;

      const wk = skuWeekByDate.get(row.date);
      compLabels.push(Number.isFinite(wk) ? `W${wk}` : String(row.date).slice(5));
      ownMassSeries.push(Number(ownMass.toFixed(2)));
      compMassSeries.push(Number(compMass.toFixed(2)));
      ownPrestigeSeries.push(Number(ownPrestige.toFixed(2)));
      compPrestigeSeries.push(Number(compPrestige.toFixed(2)));
    });

    if (compLabels.length) {
      if (step2CompetitiveChart) {
        step2CompetitiveChart.data.labels = compLabels;
        step2CompetitiveChart.data.datasets[0].data = ownMassSeries;
        step2CompetitiveChart.data.datasets[1].data = compMassSeries;
        step2CompetitiveChart.data.datasets[2].data = ownPrestigeSeries;
        step2CompetitiveChart.data.datasets[3].data = compPrestigeSeries;
        step2CompetitiveChart.update();
      } else if (window.Chart) {
        step2CompetitiveChart = new Chart(compCanvas, {
          type: 'line',
          data: {
            labels: compLabels,
            datasets: [
              { label: 'Our Mass Avg Price', data: ownMassSeries, borderColor: 'rgba(2, 132, 199, 0.95)', fill: false, tension: 0.25 },
              { label: 'Competitor Mass Price', data: compMassSeries, borderColor: 'rgba(239, 68, 68, 0.95)', fill: false, tension: 0.25 },
              { label: 'Our Prestige Avg Price', data: ownPrestigeSeries, borderColor: 'rgba(16, 185, 129, 0.95)', borderDash: [4, 3], fill: false, tension: 0.25 },
              { label: 'Competitor Prestige Price', data: compPrestigeSeries, borderColor: 'rgba(217, 119, 6, 0.95)', borderDash: [4, 3], fill: false, tension: 0.25 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
          }
        });
      }
    }

    const socialSorted = [...socialSignals].sort((a, b) => String(a.week_start || a.date).localeCompare(String(b.week_start || b.date)));
    const socialLabels = [];
    const socialScoreSeries = [];
    const socialModifierSeries = [];

    socialSorted.forEach(row => {
      const score = normalizeSocialScore(row.brand_social_index ?? row.social_sentiment);
      if (!Number.isFinite(score)) return;
      const wk = skuWeekByDate.get(row.week_start || row.date);
      socialLabels.push(Number.isFinite(wk) ? `W${wk}` : String(row.week_start || row.date).slice(5));
      socialScoreSeries.push(Number(score.toFixed(2)));
      socialModifierSeries.push(Number(socialElasticityModifier(score).toFixed(3)));
    });

    if (socialLabels.length) {
      if (step2SocialChart) {
        step2SocialChart.data.labels = socialLabels;
        step2SocialChart.data.datasets[0].data = socialScoreSeries;
        step2SocialChart.data.datasets[1].data = socialModifierSeries;
        step2SocialChart.update();
      } else if (window.Chart) {
        step2SocialChart = new Chart(socialCanvas, {
          type: 'line',
          data: {
            labels: socialLabels,
            datasets: [
              { label: 'Brand Social Score', data: socialScoreSeries, borderColor: 'rgba(14, 165, 233, 0.95)', fill: false, tension: 0.25, yAxisID: 'y' },
              { label: 'Elasticity Modifier', data: socialModifierSeries, borderColor: 'rgba(99, 102, 241, 0.95)', fill: false, tension: 0.25, yAxisID: 'y1' }
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
    }

    const latestExternal = externalSorted[externalSorted.length - 1];
    const prevExternal = externalSorted[externalSorted.length - 2] || latestExternal;
    const latestSocial = socialSorted[socialSorted.length - 1];
    const prevSocial = socialSorted[socialSorted.length - 2] || latestSocial;

    const latestMassComp = toNum(latestExternal?.competitor_mass_price) || 0;
    const prevMassComp = toNum(prevExternal?.competitor_mass_price) || latestMassComp;
    const latestPrestigeComp = toNum(latestExternal?.competitor_prestige_price) || 0;
    const prevPrestigeComp = toNum(prevExternal?.competitor_prestige_price) || latestPrestigeComp;
    const massCompDeltaPct = prevMassComp > 0 ? (latestMassComp - prevMassComp) / prevMassComp : 0;
    const prestigeCompDeltaPct = prevPrestigeComp > 0 ? (latestPrestigeComp - prevPrestigeComp) / prevPrestigeComp : 0;

    const socialScore = normalizeSocialScore(latestSocial?.brand_social_index ?? latestSocial?.social_sentiment);
    const prevSocialScore = normalizeSocialScore(prevSocial?.brand_social_index ?? prevSocial?.social_sentiment);
    const socialDeltaPts = (Number.isFinite(socialScore) && Number.isFinite(prevSocialScore))
      ? (socialScore - prevSocialScore)
      : 0;
    const modifierNow = socialElasticityModifier(socialScore);
    const modifierPrev = socialElasticityModifier(prevSocialScore);
    const modifierDeltaPct = modifierPrev > 0 ? (modifierNow - modifierPrev) / modifierPrev : 0;

    massEl.textContent = formatCurrency(latestMassComp);
    prestigeEl.textContent = formatCurrency(latestPrestigeComp);
    socialScoreEl.textContent = Number.isFinite(socialScore) ? socialScore.toFixed(1) : 'N/A';
    socialTrendEl.textContent = `${socialDeltaPts >= 0 ? '+' : ''}${socialDeltaPts.toFixed(1)} pts WoW`;

    const perSku = new Map();
    currentRows.forEach(row => {
      const key = `${row.sku_id}|${row.sales_channel}`;
      const prevRow = prevRowBySkuChannel.get(key) || row;
      const ownPrice = toNum(row.effective_price) || toNum(row.list_price) || 0;
      const currComp = toNum(row.competitor_price) || ownPrice;
      const prevComp = toNum(prevRow.competitor_price) || currComp;
      const sens = row.channel_group === 'mass' ? 0.72 : 0.46;
      const currGap = currComp > 0 ? (ownPrice - currComp) / currComp : 0;
      const prevGap = prevComp > 0 ? (ownPrice - prevComp) / prevComp : 0;
      const currCompMult = clamp(1 - currGap * sens, 0.55, 1.38);
      const prevCompMult = clamp(1 - prevGap * sens, 0.55, 1.38);
      const compRatio = prevCompMult > 0 ? (currCompMult / prevCompMult) : 1;

      const currSocial = normalizeSocialScore(row.social_engagement_score);
      const prevSocialRow = normalizeSocialScore(prevRow.social_engagement_score);
      const socialRatio = socialDemandMultiplier(currSocial) / socialDemandMultiplier(prevSocialRow ?? currSocial);
      const baselineUnits = toNum(row.net_units_sold) || 0;
      const shockOnlyUnits = baselineUnits * compRatio * socialRatio;

      if (!perSku.has(row.sku_id)) {
        perSku.set(row.sku_id, {
          sku_id: row.sku_id,
          sku_name: row.sku_name || row.sku_id,
          product_group: row.product_group || '-',
          baselineUnits: 0,
          shockUnits: 0,
          gapSum: 0,
          count: 0
        });
      }
      const entry = perSku.get(row.sku_id);
      entry.baselineUnits += baselineUnits;
      entry.shockUnits += shockOnlyUnits;
      entry.gapSum += toNum(row.price_gap_vs_competitor) || 0;
      entry.count += 1;
    });

    const skuRows = [...perSku.values()]
      .map(row => ({
        ...row,
        avgGap: row.count > 0 ? row.gapSum / row.count : 0,
        deltaUnits: row.shockUnits - row.baselineUnits
      }))
      .sort((a, b) => {
        const groupCmp = String(a.product_group).localeCompare(String(b.product_group));
        if (groupCmp !== 0) return groupCmp;
        return String(a.sku_name).localeCompare(String(b.sku_name));
      });

    skuImpactBodyEl.innerHTML = skuRows.length
      ? skuRows.map(row => `
        <tr>
          <td>${row.sku_name}</td>
          <td class="text-capitalize">${row.product_group}</td>
          <td class="text-end">${formatNumber(row.baselineUnits)}</td>
          <td class="text-end">${formatNumber(row.shockUnits)}</td>
          <td class="text-end ${row.deltaUnits >= 0 ? 'text-success' : 'text-danger'}">${row.deltaUnits >= 0 ? '+' : ''}${formatNumber(row.deltaUnits)}</td>
          <td class="text-end ${row.avgGap >= 0 ? 'text-danger' : 'text-success'}">${row.avgGap >= 0 ? '+' : ''}${(row.avgGap * 100).toFixed(1)}%</td>
        </tr>
      `).join('')
      : '<tr><td colspan="6" class="text-center text-muted">No SKU rows available for current week.</td></tr>';

    const skuLabels = skuRows.map(row => row.sku_name);
    const skuBaseline = skuRows.map(row => Number(row.baselineUnits.toFixed(2)));
    const skuShock = skuRows.map(row => Number(row.shockUnits.toFixed(2)));

    if (skuRows.length) {
      if (step2SkuImpactChart) {
        step2SkuImpactChart.data.labels = skuLabels;
        step2SkuImpactChart.data.datasets[0].data = skuBaseline;
        step2SkuImpactChart.data.datasets[1].data = skuShock;
        step2SkuImpactChart.update();
      } else if (window.Chart) {
        step2SkuImpactChart = new Chart(skuCanvas, {
          type: 'bar',
          data: {
            labels: skuLabels,
            datasets: [
              { label: 'Baseline Units', data: skuBaseline, backgroundColor: 'rgba(148, 163, 184, 0.85)' },
              { label: 'Shock-Only Units', data: skuShock, backgroundColor: 'rgba(245, 158, 11, 0.85)' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
          }
        });
      }
    }

    const totalBaseline = skuRows.reduce((sum, row) => sum + row.baselineUnits, 0);
    const totalShock = skuRows.reduce((sum, row) => sum + row.shockUnits, 0);
    const totalShockDeltaPct = totalBaseline > 0 ? (totalShock - totalBaseline) / totalBaseline : 0;

    changeLogEl.textContent =
      `Week ${currentWeek} vs Week ${previousWeek}: competitor mass ${massCompDeltaPct >= 0 ? 'up' : 'down'} ${toPct(Math.abs(massCompDeltaPct))}, ` +
      `competitor prestige ${prestigeCompDeltaPct >= 0 ? 'up' : 'down'} ${toPct(Math.abs(prestigeCompDeltaPct))}, ` +
      `social score ${socialDeltaPts >= 0 ? 'up' : 'down'} ${Math.abs(socialDeltaPts).toFixed(1)} pts.`;

    methodNoteEl.innerHTML =
      `<strong>Method:</strong> ` +
      `<code>gap_pct = (our_price - competitor_price) / competitor_price</code>; ` +
      `<code>competitor_multiplier = clamp(1 - gap_pct * sensitivity, 0.55, 1.38)</code>; ` +
      `<code>social_modifier = f(social_score)</code> from simulator. ` +
      `Data sources: <code>sku_channel_weekly.csv</code>, <code>market_signals.csv</code>, <code>social_signals.csv</code>.`;

    skuImpactNoteEl.textContent =
      `Shock-only total vs baseline: ${totalShockDeltaPct >= 0 ? '+' : ''}${toPct(totalShockDeltaPct)} with own promo depth held at 0%.`;
  } catch (error) {
    console.error('Error initializing Step 2 Signal Lab:', error);
    changeLogEl.textContent = 'Signal lab failed to load. Check data files.';
  }
}

// Load scenarios data only (no UI rendering)
async function loadScenariosData() {
  try {
    allScenarios = await loadScenarios();
    console.log(`✅ Loaded ${allScenarios.length} scenarios`);
  } catch (error) {
    console.error('Error loading scenarios:', error);
  }
}

// [OLD SIMULATION FUNCTIONS REMOVED - Using tabbed interface]

// Update elasticity analysis with scenario data
async function updateElasticityAnalysis(result) {
  try {
    const params = await loadElasticityParams();
    const weeklyData = await getWeeklyData('all');

    // Get baseline data
    const latestWeek = {};
    ['ad_supported', 'ad_free'].forEach(tier => {
      const tierData = weeklyData.filter(d => d.tier === tier);
      latestWeek[tier] = tierData[tierData.length - 1];
    });

    // Determine which tier was affected by the scenario
    const affectedTier = result.tier || selectedScenario?.config?.tier;
    const scenarioPrice = result.new_price || selectedScenario?.config?.new_price;

    const demandCurveData = {
      tiers: [
        {
          name: 'Mass Channel',
          elasticity: params.tiers.ad_supported.base_elasticity,
          currentPrice: CHANNEL_PRICE.ad_supported,
          currentSubs: latestWeek.ad_supported.active_customers,
          newPrice: affectedTier === 'ad_supported' ? scenarioPrice : null,
          newSubs: affectedTier === 'ad_supported' ? result.forecasted.customers : null,
          color: '#dc3545'
        },
        {
          name: 'Prestige Channel',
          elasticity: params.tiers.ad_free.base_elasticity,
          currentPrice: CHANNEL_PRICE.ad_free,
          currentSubs: latestWeek.ad_free.active_customers,
          newPrice: affectedTier === 'ad_free' ? scenarioPrice : null,
          newSubs: affectedTier === 'ad_free' ? result.forecasted.customers : null,
          color: '#ffc107'
        },
        
      ]
    };

    renderDemandCurve('demand-curve-chart', demandCurveData, { width: 1100, height: 500 });
  } catch (error) {
    console.error('Error updating elasticity analysis:', error);
  }
}

// Load and render elasticity analytics
async function loadElasticityAnalytics() {
  try {
    const params = await loadElasticityParams();
    const weeklyData = await getWeeklyData('all');

    // Prepare demand curve data
    const latestWeek = {};
    ['ad_supported', 'ad_free'].forEach(tier => {
      const tierData = weeklyData.filter(d => d.tier === tier);
      latestWeek[tier] = tierData[tierData.length - 1];
    });

    const demandCurveData = {
      tiers: [
        {
          name: 'Mass Channel',
          elasticity: params.tiers.ad_supported.base_elasticity,
          currentPrice: CHANNEL_PRICE.ad_supported,
          currentSubs: latestWeek.ad_supported.active_customers,
          color: '#dc3545'
        },
        {
          name: 'Prestige Channel',
          elasticity: params.tiers.ad_free.base_elasticity,
          currentPrice: CHANNEL_PRICE.ad_free,
          currentSubs: latestWeek.ad_free.active_customers,
          color: '#ffc107'
        },
        
      ]
    };

    renderDemandCurve('demand-curve-chart', demandCurveData, { width: 1100, height: 500 });

    // Prepare heatmap data
    const segments = ['new_0_3mo', 'tenured_3_12mo', 'tenured_12plus'];
    const tiers = ['ad_supported', 'ad_free'];
    const values = segments.map(segment =>
      tiers.map(tier => {
        if (params.tiers[tier].segments && params.tiers[tier].segments[segment]) {
          return params.tiers[tier].segments[segment].elasticity;
        }
        return params.tiers[tier].base_elasticity;
      })
    );

    const heatmapData = {
      segments: ['New (0-3mo)', 'Tenured (3-12mo)', 'Tenured (12+mo)'],
      tiers: ['Mass Channel', 'Prestige Channel'],
      values: values
    };

    renderElasticityHeatmap('elasticity-heatmap', heatmapData, { cellSize: 100 });

  } catch (error) {
    console.error('Error loading elasticity analytics:', error);
  }
}

// Store all simulation results for chatbot access
let allSimulationResults = allSimulationResultsByModel[activeModelType];

// Initialize chat context with scenario-focused tools
async function initializeChatContext() {
  try {
    // Load core context for chat
    const [
      weeklyData,
      elasticityParams,
      skuWeekly,
      externalFactors,
      competitorPriceFeed,
      socialSignals,
      promoMetadata
    ] = await Promise.all([
      getWeeklyData('all'),
      loadElasticityParams(),
      loadSkuWeeklyData(),
      loadExternalFactors(),
      loadCompetitorPriceFeed(),
      loadSocialSignals(),
      loadPromoMetadata()
    ]);

    const currentWeek = skuWeekly.find(r => r.is_current_week === true)?.week_of_season
      || Math.max(...skuWeekly.map(r => Number(r.week_of_season || 0)));
    const seasonWeeks = Math.max(...skuWeekly.map(r => Number(r.week_of_season || 0)), 17);

    const currentRows = skuWeekly.filter(r => Number(r.week_of_season) === Number(currentWeek));
    const latestExternal = externalFactors[externalFactors.length - 1] || {};
    const latestSocial = socialSignals[socialSignals.length - 1] || {};
    const prevSocial = socialSignals[socialSignals.length - 2] || latestSocial;

    const latestWeek = {};
    ['ad_supported', 'ad_free'].forEach(tier => {
      const tierData = weeklyData.filter(d => d.tier === tier);
      latestWeek[tier] = tierData[tierData.length - 1];
    });

    const totalSubs = Object.values(latestWeek).reduce((sum, d) => sum + d.active_customers, 0);
    const totalRevenue = Object.values(latestWeek).reduce((sum, d) => sum + d.revenue, 0) * 4;
    const avgChurn = Object.values(latestWeek).reduce((sum, d) => sum + d.repeat_loss_rate, 0) / 2;

    const socialScore = Number(latestSocial.brand_social_index ?? latestSocial.social_sentiment ?? 0);
    const previousSocialScore = Number(prevSocial.brand_social_index ?? prevSocial.social_sentiment ?? socialScore);
    const socialTrendDelta = socialScore - previousSocialScore;

    const getGroupRows = (group) => currentRows.filter(r => r.channel_group === group);
    const avg = (values) => values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const massRows = getGroupRows('mass');
    const prestigeRows = getGroupRows('prestige');
    const competitorSignals = {
      massAvgCompetitorPrice: Number(latestExternal.competitor_mass_price || avg(massRows.map(r => Number(r.competitor_price || 0)))),
      prestigeAvgCompetitorPrice: Number(latestExternal.competitor_prestige_price || avg(prestigeRows.map(r => Number(r.competitor_price || 0)))),
      massGapAvgPct: avg(massRows.map(r => Number(r.price_gap_vs_competitor || 0))),
      prestigeGapAvgPct: avg(prestigeRows.map(r => Number(r.price_gap_vs_competitor || 0)))
    };

    const skuMap = new Map();
    currentRows.forEach(row => {
      const key = row.sku_id;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          sku_id: row.sku_id,
          sku_name: row.sku_name,
          product_group: row.product_group,
          remaining_inventory_units: 0,
          baseline_weekly_units: 0,
          avg_base_elasticity: 0,
          avg_gap_vs_competitor: 0,
          channel_groups: new Set(),
          _count: 0
        });
      }
      const entry = skuMap.get(key);
      entry.remaining_inventory_units += Number(row.end_inventory_units || 0);
      entry.baseline_weekly_units += Number(row.net_units_sold || 0);
      entry.avg_base_elasticity += Number(row.base_elasticity || 0);
      entry.avg_gap_vs_competitor += Number(row.price_gap_vs_competitor || 0);
      entry.channel_groups.add(row.channel_group);
      entry._count += 1;
    });

    const skuInventory = [...skuMap.values()]
      .map(entry => ({
        sku_id: entry.sku_id,
        sku_name: entry.sku_name,
        product_group: entry.product_group,
        remaining_inventory_units: Math.round(entry.remaining_inventory_units),
        baseline_weekly_units: Math.round(entry.baseline_weekly_units),
        avg_base_elasticity: entry._count ? entry.avg_base_elasticity / entry._count : 0,
        avg_gap_vs_competitor: entry._count ? entry.avg_gap_vs_competitor / entry._count : 0,
        channel_groups: [...entry.channel_groups]
      }))
      .sort((a, b) => b.remaining_inventory_units - a.remaining_inventory_units);

    const promoCampaigns = promoMetadata ? Object.values(promoMetadata) : [];
    const underperformingSkuCounts = {};
    const outperformingSkuCounts = {};

    promoCampaigns.forEach(promo => {
      (promo.sku_results || []).forEach(row => {
        const sku = row.sku_id;
        const uplift = Number(row.sales_uplift_pct || 0);
        if (row.outcome === 'down' || uplift < 0) {
          underperformingSkuCounts[sku] = (underperformingSkuCounts[sku] || 0) + 1;
        } else if (row.outcome === 'up' || uplift > 0) {
          outperformingSkuCounts[sku] = (outperformingSkuCounts[sku] || 0) + 1;
        }
      });
    });

    const sortedUnderperformers = Object.entries(underperformingSkuCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([sku]) => sku);
    const sortedOutperformers = Object.entries(outperformingSkuCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([sku]) => sku);
    const skuNameById = new Map(skuInventory.map(item => [item.sku_id, item.sku_name]));
    const sortedUnderperformerLabels = sortedUnderperformers.map(sku => skuNameById.get(sku) || sku);
    const sortedOutperformerLabels = sortedOutperformers.map(sku => skuNameById.get(sku) || sku);

    const promoHistory = promoCampaigns.map(promo => {
      const skuResults = promo.sku_results || [];
      const underperformers = skuResults
        .filter(s => s.outcome === 'down' || Number(s.sales_uplift_pct || 0) < 0)
        .map(s => s.sku_name || s.sku_id);
      const winners = skuResults
        .filter(s => s.outcome === 'up' || Number(s.sales_uplift_pct || 0) > 0)
        .map(s => s.sku_name || s.sku_id);
      return {
        promo_id: promo.promo_id,
        campaign_name: promo.campaign_name,
        season: promo.season,
        channels: promo.eligible_channels || [],
        discount_pct: promo.discount_pct,
        promoted_skus: promo.promoted_skus || [],
        winners,
        underperformers
      };
    });

    const competitorFeedSummary = {
      rows: Array.isArray(competitorPriceFeed) ? competitorPriceFeed.length : 0,
      sources: Array.from(new Set((competitorPriceFeed || []).map(r => r.source_domain))).slice(0, 8),
      matchedSkus: Array.from(new Set((competitorPriceFeed || []).map(r => r.matched_sku_id))).length
    };

    const getLivePromoSnapshot = () => (
      window.getChannelPromoSnapshot && typeof window.getChannelPromoSnapshot === 'function'
        ? window.getChannelPromoSnapshot()
        : null
    );

    const buildPromoMixRecommendation = ({ objective = 'balance', channel_group = 'all' } = {}) => {
      const objectiveWeights = {
        maximize_revenue: { inv: 1.1, elast: 1.0, gap: 1.2 },
        grow_customers: { inv: 0.9, elast: 1.3, gap: 1.1 },
        reduce_churn: { inv: 0.8, elast: 0.7, gap: 0.9 },
        maximize_aov: { inv: 0.7, elast: 0.8, gap: 0.6 },
        balance: { inv: 1.0, elast: 1.0, gap: 1.0 },
        profit: { inv: 0.8, elast: 0.7, gap: 0.8 },
        sales: { inv: 1.0, elast: 1.2, gap: 1.1 }
      };
      const weights = objectiveWeights[objective] || objectiveWeights.balance;
      const underperformerSet = new Set(sortedUnderperformers);

      const candidates = skuInventory.filter(item => {
        if (channel_group === 'all') return true;
        return item.channel_groups.includes(channel_group);
      });

      const ranked = candidates.map(item => {
        let score = 0;
        const reasons = [];

        if (item.remaining_inventory_units >= 450) {
          score += 2.0 * weights.inv;
          reasons.push('high remaining inventory');
        }
        if (Math.abs(item.avg_base_elasticity) >= 1.8) {
          score += 2.0 * weights.elast;
          reasons.push('elastic response to promotion');
        } else {
          score -= 0.8 * weights.elast;
          reasons.push('limited price responsiveness');
        }
        if (item.avg_gap_vs_competitor > 0.02) {
          score += 1.4 * weights.gap;
          reasons.push('priced above competitor set');
        }
        if (underperformerSet.has(item.sku_id)) {
          score -= 2.2;
          reasons.push('historical underperformance in promos');
        }
        if (socialScore >= 75 && Math.abs(item.avg_base_elasticity) < 1.5) {
          score -= 1.4;
          reasons.push('strong social momentum supports price hold');
        }

        return {
          ...item,
          score: Number(score.toFixed(2)),
          reasons
        };
      }).sort((a, b) => b.score - a.score);

      const include = ranked.filter(r => r.score >= 1.8).slice(0, 4);
      const exclude = ranked.filter(r => r.score < 1.8).slice(0, 4);
      return {
        objective,
        channel_group,
        include,
        exclude,
        notes: {
          social_signal: {
            score: socialScore,
            trend_delta: socialTrendDelta
          },
          competitor_signals: competitorSignals
        }
      };
    };

    // Create scenario-focused context for chat
    const context = {
      // All scenario definitions
      allScenarios: allScenarios,

      // Current simulation result (if any)
      getCurrentSimulation: () => currentResult,

      // All saved scenarios for comparison
      getSavedScenarios: () => savedScenarios,

      // All simulation results
      getAllSimulationResults: () => allSimulationResults,

      // Business context
      businessContext: {
        currentCustomers: totalSubs,
        currentRevenue: totalRevenue,
        currentChurn: avgChurn,
        currentSeasonWeek: currentWeek,
        seasonWeeks,
        elasticityByTier: {
          ad_supported: elasticityParams.tiers.ad_supported.base_elasticity,
          ad_free: elasticityParams.tiers.ad_free.base_elasticity
        },
        tierPricing: {
          ad_supported: CHANNEL_PRICE.ad_supported,
          ad_free: CHANNEL_PRICE.ad_free
        },
        competitorSignals,
        socialSignal: {
          score: socialScore,
          trendDelta: socialTrendDelta
        },
        inventoryHighlights: skuInventory.slice(0, 8),
        promoHistorySummary: {
          campaignCount: promoHistory.length,
          topUnderperformingSkus: sortedUnderperformerLabels.slice(0, 5),
          topWinningSkus: sortedOutperformerLabels.slice(0, 5)
        },
        competitorFeedSummary,
        skuOptimizationInsights: {
          recommended_includes: sortedOutperformerLabels.slice(0, 4),
          recommended_excludes: sortedUnderperformerLabels.slice(0, 4),
          objective_note: 'Prioritize high-elastic SKUs with low leftover risk; avoid SKUs with repeated negative promo lift.'
        },
        recommendedQuestions: [
          `Which SKUs should I include in a week-${window.getPromoPlanningHorizonWeeks ? window.getPromoPlanningHorizonWeeks() : seasonWeeks} clearance promo by channel?`,
          'Which SKUs are inelastic and should be held at higher prices despite competitor pressure?'
        ]
      },

      // Visualization data context
      getVisualizationData: () => ({
        livePromoSnapshot: getLivePromoSnapshot(),
        inventory_projection: getLivePromoSnapshot()?.inventoryProjection || null,
        promo_history: promoHistory,
        competitor_feed_summary: competitorFeedSummary,
        competitor_signal: competitorSignals,
        social_signal: {
          score: socialScore,
          trend_delta: socialTrendDelta
        },
        tierMix: currentResult ? {
          description: "Baseline vs Forecasted customer distribution across tiers",
          baseline: currentResult.baseline,
          forecasted: currentResult.forecasted
        } : null,
        forecast: currentResult ? {
          description: "12-month customer forecast with 90% confidence intervals",
          timeSeries: currentResult.time_series
        } : null
      }),

      // SCENARIO-FOCUSED TOOLS

      // Interpret a specific scenario's results
      interpretScenario: async (scenarioId) => {
        // Check if we have results for this scenario
        let result = allSimulationResults.find(r => r.scenario_id === scenarioId);

        // If not, check if it's the current result
        if (!result && currentResult && currentResult.scenario_id === scenarioId) {
          result = currentResult;
        }

        // If still not found, run the simulation
        if (!result) {
          const scenario = allScenarios.find(s => s.id === scenarioId);
          if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
          }
          result = await simulateScenario(scenario);
        }

        // Build interpretation
        const interpretation = {
          scenario_id: result.scenario_id,
          scenario_name: result.scenario_name,

          // Key metrics
          metrics: {
            revenue: {
              change_pct: result.delta.revenue_pct,
              change_amount: result.delta.revenue,
              forecasted: result.forecasted.revenue,
              baseline: result.baseline.revenue
            },
            customers: {
              change_pct: result.delta.customers_pct,
              change_amount: result.delta.customers,
              forecasted: result.forecasted.customers,
              baseline: result.baseline.customers
            },
            churn: {
              change_pct: result.delta.repeat_loss_rate_pct,
              forecasted_rate: result.forecasted.repeat_loss_rate,
              baseline_rate: result.baseline.repeat_loss_rate
            },
            aov: {
              change_pct: result.delta.aov_pct,
              forecasted: result.forecasted.aov,
              baseline: result.baseline.aov
            }
          },

          // Trade-offs
          tradeoffs: {
            revenue_vs_customers: `${result.delta.revenue_pct >= 0 ? 'Gain' : 'Loss'} ${Math.abs(result.delta.revenue_pct).toFixed(1)}% revenue, ${result.delta.customers_pct >= 0 ? 'gain' : 'lose'} ${Math.abs(result.delta.customers_pct).toFixed(1)}% customers`,
            price_sensitivity: result.elasticity < -2.0 ? 'High' : result.elasticity < -1.5 ? 'Medium' : 'Low'
          },

          // Warnings and risks
          warnings: result.warnings || [],

          // Elasticity info
          elasticity: result.elasticity,

          // Time series forecast
          forecast_12m: result.time_series,

          summary: `${result.scenario_name} analysis: Revenue ${result.delta.revenue_pct >= 0 ? 'increases' : 'decreases'} by ${Math.abs(result.delta.revenue_pct).toFixed(1)}% while customers ${result.delta.customers_pct >= 0 ? 'grow' : 'decline'} by ${Math.abs(result.delta.customers_pct).toFixed(1)}%. Repeat loss ${result.delta.repeat_loss_rate_pct >= 0 ? 'increases' : 'decreases'} by ${Math.abs(result.delta.repeat_loss_rate_pct).toFixed(1)}%.`
        };

        return interpretation;
      },

      // Suggest a new scenario based on business goal
      suggestScenario: async (goal) => {
        const objectiveMap = {
          maximize_revenue: 'sales',
          grow_customers: 'sales',
          reduce_churn: 'balance',
          maximize_aov: 'profit'
        };
        const recommended = buildPromoMixRecommendation({ objective: objectiveMap[goal] || 'balance', channel_group: 'all' });
        const includeSkus = recommended.include.map(s => s.sku_id);
        const excludeSkus = recommended.exclude.map(s => s.sku_id);
        const includeSkuLabels = recommended.include.map(s => s.sku_name || s.sku_id);
        const excludeSkuLabels = recommended.exclude.map(s => s.sku_name || s.sku_id);
        const primaryChannel = (recommended.notes.competitor_signals.massGapAvgPct > 0.02) ? 'mass' : 'prestige';
        return {
          goal: goal,
          suggested_scenario: {
            name: `${primaryChannel === 'mass' ? 'Mass Defensive Promo' : 'Prestige Selective Promo'} (${goal.replace('_', ' ')})`,
            channel_group: primaryChannel,
            include_skus: includeSkus,
            include_products: includeSkuLabels,
            exclude_skus: excludeSkus,
            exclude_products: excludeSkuLabels,
            season_week: currentWeek
          },
          rationale: `Recommendation uses week-${currentWeek} inventory, elasticity, competitor gap, social trend, and historical promo outcomes.`,
          estimated_impact: `Focus on ${includeSkuLabels.join(', ') || 'top elastic products'} and avoid ${excludeSkuLabels.join(', ') || 'historical underperformers'}.`,
          next_steps: `Apply this mix in Step 1 and compare baseline vs scenario inventory runway to week ${window.getPromoPlanningHorizonWeeks ? window.getPromoPlanningHorizonWeeks() : seasonWeeks}.`
        };
      },

      // Analyze a specific chart/visualization
      analyzeChart: async (chartName) => {
        const chartAnalysis = {
          inventory_projection: {
            name: `${window.getPromoPlanningHorizonWeeks ? window.getPromoPlanningHorizonWeeks() : seasonWeeks}-Week Inventory Projection`,
            description: 'Baseline versus scenario projection for end-of-season inventory.',
            current_week: currentWeek,
            data: getLivePromoSnapshot()?.inventoryProjection || null,
            interpretation: `Use this chart to determine whether current promo plan gets inventory close to zero by week ${window.getPromoPlanningHorizonWeeks ? window.getPromoPlanningHorizonWeeks() : seasonWeeks}.`
          },
          promo_history: {
            name: 'Historical Promo Effectiveness',
            description: 'SKU and channel outcomes from prior campaigns.',
            campaigns: promoHistory,
            interpretation: 'SKUs that repeatedly underperform should be excluded from future broad promos.'
          },
          competitor_signal: {
            name: 'Competitive Pricing Signal',
            description: 'Average competitor price levels and relative price gap by channel group.',
            data: competitorSignals,
            interpretation: 'Positive gap means we are priced above competitors and may need defensive promotions.'
          },
          competitor_feed: {
            name: 'Competitor Price Feed',
            description: 'Simulated website-scraped competitor prices matched to our SKU catalog.',
            data: competitorFeedSummary,
            interpretation: 'Use source coverage and match confidence to explain where competitor delta signals originate.'
          },
          social_signal: {
            name: 'Social Engagement Signal',
            description: 'Brand social score and week-over-week trend.',
            data: { score: socialScore, trend_delta: socialTrendDelta },
            interpretation: 'High social momentum lowers effective elasticity and supports selective price holds.'
          },
          demand_curve: {
            name: 'Demand Curve by Channel Group',
            description: 'Channel-group elasticity context for promo depth decisions.',
            interpretation: [
              `Mass Channel baseline elasticity: ${elasticityParams.tiers.ad_supported.base_elasticity}`,
              `Prestige Channel baseline elasticity: ${elasticityParams.tiers.ad_free.base_elasticity}`
            ]
          },
          tier_mix: currentResult ? {
            name: 'Tier Mix: Baseline vs Forecasted',
            description: 'Compares current vs forecasted customer distribution across tiers',
            baseline: currentResult.baseline,
            forecasted: currentResult.forecasted,
            interpretation: `Scenario "${currentResult.scenario_name}" shifts channel distribution. Revenue impact depends on AOV differences.`
          } : null,
          forecast: currentResult ? {
            name: '12-Month Customer Forecast',
            description: 'Projects customer count over 12 months with 90% confidence intervals',
            timeSeries: currentResult.time_series,
            interpretation: 'Confidence intervals widen over time due to increasing uncertainty. Use for medium-term planning (3-6 months most reliable).'
          } : null,
          heatmap: {
            name: 'Elasticity Heatmap by Cohort',
            description: 'Shows how price sensitivity varies by customer tenure and tier',
            interpretation: [
              'New customers (0-3mo) are typically more price-sensitive',
              'Tenured customers (12+mo) show lower elasticity (more loyal)',
              'This guides targeted pricing strategies by segment'
            ]
          }
        };

        const analysis = chartAnalysis[chartName];
        if (!analysis) {
          throw new Error(`Unknown chart: ${chartName}. Available charts: ${Object.keys(chartAnalysis).join(', ')}`);
        }

        return analysis;
      },

      // Analyze historical promotion outcomes with optional filters
      queryPromoHistory: async (filters = {}) => {
        const season = filters.season || 'all';
        const channel = filters.channel || 'all';
        const filtered = promoHistory.filter(promo => {
          if (season !== 'all' && promo.season !== season) return false;
          if (channel !== 'all' && !promo.channels.map(c => String(c).toLowerCase()).includes(channel)) return false;
          return true;
        });

        return {
          filters_applied: { season, channel },
          campaign_count: filtered.length,
          campaigns: filtered,
          recommended_exclusions: sortedUnderperformers.slice(0, 5),
          recommended_inclusions: sortedOutperformers.slice(0, 5)
        };
      },

      // Generate SKU-level promotion mix recommendation from live data
      recommendPromoMix: async (params = {}) => {
        return buildPromoMixRecommendation(params);
      },

      // Deep comparison of multiple scenarios
      compareOutcomes: async (scenarioIds) => {
        if (scenarioIds.length < 2) {
          throw new Error('Need at least 2 scenarios to compare');
        }

        const scenarios = scenarioIds.map(id => allScenarios.find(s => s.id === id)).filter(s => s);
        if (scenarios.length === 0) {
          throw new Error('No valid scenarios found');
        }

        // Run all scenarios if not already simulated
        const results = [];
        for (const scenario of scenarios) {
          let result = allSimulationResults.find(r => r.scenario_id === scenario.id);
          if (!result && currentResult && currentResult.scenario_id === scenario.id) {
            result = currentResult;
          }
          if (!result) {
            result = await simulateScenario(scenario);
            allSimulationResults.push(result);
          }
          results.push(result);
        }

        // Analyze trade-offs
        const comparison = {
          scenarios: results.map(r => ({
            id: r.scenario_id,
            name: r.scenario_name,
            revenue_pct: r.delta.revenue_pct,
            customers_pct: r.delta.customers_pct,
            repeat_loss_pct: r.delta.repeat_loss_rate_pct,
            aov_pct: r.delta.aov_pct
          })),

          best_for: {
            revenue: results.reduce((best, r) => r.delta.revenue_pct > best.delta.revenue_pct ? r : best).scenario_name,
            customers: results.reduce((best, r) => r.delta.customers_pct > best.delta.customers_pct ? r : best).scenario_name,
            churn: results.reduce((best, r) => r.delta.repeat_loss_rate_pct < best.delta.repeat_loss_rate_pct ? r : best).scenario_name,
            aov: results.reduce((best, r) => r.delta.aov_pct > best.delta.aov_pct ? r : best).scenario_name
          },

          tradeoffs: results.map(r => ({
            scenario: r.scenario_name,
            tradeoff: `Revenue ${r.delta.revenue_pct >= 0 ? '+' : ''}${r.delta.revenue_pct.toFixed(1)}% vs Customers ${r.delta.customers_pct >= 0 ? '+' : ''}${r.delta.customers_pct.toFixed(1)}%`,
            risk_level: r.warnings && r.warnings.length > 0 ? 'High' : Math.abs(r.delta.customers_pct) > 10 ? 'Medium' : 'Low'
          })),

          recommendation: `Best scenario depends on business priority. For revenue: ${results.reduce((best, r) => r.delta.revenue_pct > best.delta.revenue_pct ? r : best).scenario_name}. For growth: ${results.reduce((best, r) => r.delta.customers_pct > best.delta.customers_pct ? r : best).scenario_name}.`
        };

        return comparison;
      },

      // Create a new scenario from parameters
      createScenario: async (parameters) => {
        const { tier, price_change, promotion_discount, promotion_duration } = parameters;

        if (!tier || !['ad_supported', 'ad_free'].includes(tier)) {
          throw new Error('Invalid tier. Must be: ad_supported or ad_free');
        }

        const tierPrices = { ...CHANNEL_PRICE };

        const currentPrice = tierPrices[tier];
        let newPrice;
        let scenarioType;

        if (promotion_discount && promotion_duration) {
          // Promotion scenario
          newPrice = currentPrice * (1 - promotion_discount / 100);
          scenarioType = 'promotion';
        } else if (price_change !== undefined) {
          // Price change scenario
          newPrice = currentPrice + price_change;
          scenarioType = 'price_change';
        } else {
          throw new Error('Must specify either price_change or (promotion_discount and promotion_duration)');
        }

        const newScenario = {
          id: `scenario_custom_${Date.now()}`,
          name: scenarioType === 'promotion'
            ? `${promotion_discount}% Off Promo (${promotion_duration}mo) - ${tier.replace('_', ' ')}`
            : `${tier.replace('_', ' ')} ${price_change >= 0 ? '+' : ''}$${price_change.toFixed(2)}`,
          description: `Custom scenario created via chatbot`,
          category: scenarioType,
          config: {
            tier: tier,
            current_price: currentPrice,
            new_price: newPrice,
            price_change_pct: ((newPrice - currentPrice) / currentPrice) * 100
          },
          constraints: {
            min_price: currentPrice * 0.5,
            max_price: currentPrice * 1.5
          }
        };

        if (scenarioType === 'promotion') {
          newScenario.config.promotion = {
            discount_pct: promotion_discount,
            duration_months: promotion_duration
          };
        }

        // Add to scenarios list
        allScenarios.push(newScenario);

        return {
          created: true,
          scenario: newScenario,
          message: `Created scenario: ${newScenario.name}. Use interpretScenario('${newScenario.id}') to simulate and analyze results.`
        };
      }
    };

    // Initialize chat module with scenario-focused context
    llmBusinessContext = context.businessContext || {};
    initializeChat(context);
  } catch (error) {
    console.error('Error initializing chat context:', error);
    throw error;
  }
}

// Load sample data with progress bar
async function loadData() {
  const btn = document.getElementById('load-data-btn');
  const progressContainer = document.getElementById('loading-progress');
  const progressBar = document.getElementById('loading-progress-bar');
  const progressText = document.getElementById('loading-percentage');
  const stageText = document.getElementById('loading-stage');

  // Hide button, show progress
  btn.style.display = 'none';
  progressContainer.style.display = 'block';

  // Ensure loading UI elements exist and are visible
  if (!progressContainer || !progressBar || !progressText || !stageText) {
    console.error('Loading UI elements not found');
    return;
  }

  // Force visibility
  progressContainer.style.display = 'block';
  progressContainer.style.visibility = 'visible';

  // Define loading stages
  const stages = [
    { progress: 5, text: 'Initializing data loader...' },
    { progress: 15, text: 'Loading CSV files...' },
    { progress: 30, text: 'Parsing weekly aggregated data...' },
    { progress: 45, text: 'Calculating KPIs...' },
    { progress: 60, text: 'Loading pricing scenarios...' },
    { progress: 75, text: 'Analyzing promotion response patterns...' },
    { progress: 85, text: 'Initializing AI chat context...' },
    { progress: 95, text: 'Finalizing data viewer...' },
    { progress: 100, text: 'Complete!' }
  ];

  // Random total duration between 2-7 seconds
  const totalDuration = 2000 + Math.random() * 5000;
  const stageInterval = totalDuration / stages.length;

  try {
    console.log('Starting data load with visible progress bar');

    // Show progress through stages
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      console.log(`Loading stage ${i+1}/${stages.length}: ${stage.text} (${stage.progress}%)`);

      // Update UI
      progressBar.style.width = stage.progress + '%';
      progressBar.style.minWidth = '5%'; // Always show at least 5%
      progressBar.setAttribute('aria-valuenow', stage.progress);
      progressText.textContent = stage.progress + '%';
      stageText.textContent = stage.text;

      // Add color transition as we progress
      if (stage.progress >= 75) {
        progressBar.classList.remove('bg-primary');
        progressBar.classList.add('bg-success');
      }

      // Wait for stage interval
      await new Promise(resolve => setTimeout(resolve, stageInterval));

      // Load actual data at specific stages
      if (stage.progress === 45) {
        await loadKPIs();
      } else if (stage.progress === 60) {
        await loadScenariosData();
        // Populate elasticity model tabs with filtered scenarios
        populateElasticityModelTabs();
        // Load segmentation data
        if (window.segmentEngine) {
          const segmentDataLoaded = await window.segmentEngine.loadSegmentData();
          if (!segmentDataLoaded) {
            console.error('Failed to load segmentation data');
          }
        } else {
          console.error('Segmentation engine not available');
        }
      } else if (stage.progress === 75) {
        await loadElasticityAnalytics();
      } else if (stage.progress === 85) {
        await initializeChatContext();
      } else if (stage.progress === 95) {
        initializeDataViewer();
      }
    }

    // Wait a bit before transitioning
    await new Promise(resolve => setTimeout(resolve, 500));

    // Hide loading progress, show KPI dashboard
    const loadDataSection = document.getElementById('load-data-section');
    const kpiSection = document.getElementById('kpi-section');
    if (loadDataSection) loadDataSection.style.display = 'none';
    if (kpiSection) kpiSection.style.display = 'block';

    // Initialize Channel Promotions Simulator in Step 1 (if available)
    if (window.initializeChannelPromoSimulator &&
        typeof window.initializeChannelPromoSimulator === 'function') {
      try {
        await window.initializeChannelPromoSimulator();
      } catch (simError) {
        console.warn('Channel Promotions Simulator initialization failed:', simError);
      }
    }
    await initializeStep2SignalsLab();

    // NOTE: We're already on Step 1 (navigated before loadData was called)
    // All section visibility is now controlled by step navigation
    // After data loads, we auto-navigate to Step 1 which shows:
    // - load-data-section (hidden after load completes)
    // - kpi-section (with dashboard KPI cards)
    //
    // Other sections controlled by their respective steps:
    // Step 2-4: Individual elasticity models (insight boxes only)
    // Step 5: Scenario Analysis (elasticity-models-section with full scenarios)
    // Step 6: Customer Segmentation
    // Step 7: Event Calendar
    // Step 8: Data Explorer & Chat

    // Initialize segmentation section if data is available (but keep hidden)
    if (window.segmentEngine && window.segmentEngine.isDataLoaded()) {
      initializeSegmentationSection();
      initializeSegmentComparison();
      // initializeFilterPresets(); // Removed - Quick Presets feature removed from UI
      initializeExportButtons();
    updateCohortWatchlist();
    }

    // Initialize Event Calendar (RFP-aligned: Slide 12)
    try {
      await initializeEventCalendar();
      console.log('✅ Event Calendar initialized');
    } catch (error) {
      console.error('⚠️ Event Calendar initialization failed:', error);
    }

    // Re-initialize popovers for newly visible sections
    initializePopovers();

    dataLoaded = true;
    window.dataLoaded = true;

    // Initialize Pyodide models in background (non-blocking)
    initializePyodideModels().then(success => {
      if (success) {
        console.log('✅ Pyodide Python models ready to use');
      } else {
        console.log('⚠️ Pyodide initialization failed, using JavaScript fallback');
      }
    });

  } catch (error) {
    console.error('Error loading data:', error);
    dataLoaded = false;
    window.dataLoaded = false;

    // Show error state
    progressBar.classList.remove('bg-success');
    progressBar.classList.add('bg-danger');
    stageText.textContent = 'Error loading data: ' + error.message;

    // Reset after 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    progressContainer.style.display = 'none';
    btn.style.display = 'inline-block';
    btn.disabled = false;
  }
}

// Save current scenario
function saveScenario() {
  const activeResult = currentResultByModel[activeModelType];
  if (!activeResult) return;

  savedScenariosByModel[activeModelType].push({
    ...activeResult,
    savedAt: new Date().toISOString()
  });
  savedScenarios = savedScenariosByModel[activeModelType];

  updateScenarioComparisonUI();
  updateRecommendationBrief();

  alert(`Scenario "${activeResult.scenario_name}" saved! You can now compare it with other scenarios.`);
}

// Compare saved scenarios
async function compareScenarios() {
  if (savedScenarios.length < 2) {
    alert('Please save at least 2 scenarios to compare.');
    return;
  }

  await Promise.all(savedScenarios.map(scenario => enrichScenarioWithCommercialContext(scenario)));

  // Prepare data for grouped bar chart with proper null/undefined handling
  const barChartData = savedScenarios.map(s => {
    // Calculate repeat_loss_pct if not already present
    const repeatLossPct = s.delta.repeat_loss_rate_pct ||
      (s.delta.repeat_loss_rate && s.baseline && s.baseline.repeat_loss_rate
        ? (s.delta.repeat_loss_rate / s.baseline.repeat_loss_rate) * 100
        : 0);

    return {
      name: s.scenario_name || 'Unnamed Scenario',
      customers_pct: s.delta?.customers_pct || 0,
      revenue_pct: s.delta?.revenue_pct || 0,
      aov_pct: s.delta?.aov_pct || 0,
      repeat_loss_pct: repeatLossPct,
      repeat_loss_pct: repeatLossPct
    };
  });

  // Prepare data for radar chart with proper null/undefined handling
  const radarChartData = savedScenarios.map(s => {
    // Calculate repeat_loss_rate_pct if not already present
    const repeatLossPct = s.delta.repeat_loss_rate_pct ||
      (s.delta.repeat_loss_rate && s.baseline && s.baseline.repeat_loss_rate
        ? (s.delta.repeat_loss_rate / s.baseline.repeat_loss_rate) * 100
        : 0);

    // Calculate CLTV change estimate (simple approximation if not available)
    const cltvPct = s.delta?.cltv_pct ||
      ((s.delta?.revenue_pct || 0) - (repeatLossPct * 0.5));

    return {
      name: s.scenario_name || 'Unnamed Scenario',
      dimensions: {
        revenue: s.delta?.revenue_pct || 0,
        growth: s.delta?.customers_pct || 0,
        aov: s.delta?.aov_pct || 0,
        churn: repeatLossPct,
        cltv: cltvPct
      }
    };
  });

  // Render charts
  renderComparisonBarChart('comparison-bar-chart', barChartData, { width: 750, height: 450 });
  renderRadarChart('comparison-radar-chart', radarChartData, { width: 500, height: 500 });

  // Show comparison charts
  document.getElementById('comparison-charts').style.display = 'block';
  renderScenarioComparisonOutlookTable();

  // Scroll to comparison
  document.getElementById('comparison-section').scrollIntoView({ behavior: 'smooth' });
}

// Clear saved scenarios
function clearScenarios() {
  if (savedScenarios.length === 0) return;

  if (confirm('Are you sure you want to clear all saved scenarios?')) {
    savedScenariosByModel[activeModelType] = [];
    savedScenarios = savedScenariosByModel[activeModelType];

    // Also clear rankings for this model
    if (window.currentTop3ScenariosByModel) {
      window.currentTop3ScenariosByModel[activeModelType] = null;
    }

    updateScenarioComparisonUI();
    updateDecisionEngineDisplay();
    updateRecommendationBrief();
  }
}

function applyPromotionCopySweep() {
  // Roadmap/legacy scenario engine copy updates
  const scenarioHeaderTitle = document.querySelector('#elasticity-models-section .card-header h2');
  const scenarioHeaderSubtitle = document.querySelector('#elasticity-models-section .card-header p');
  const scenarioFrameworkAlert = document.querySelector('#elasticity-models-section .alert.alert-info');
  if (scenarioHeaderTitle) {
    scenarioHeaderTitle.innerHTML = '<i class="bi bi-signpost-split me-2"></i>Promotion Optimization Scenario Studio';
  }
  if (scenarioHeaderSubtitle) {
    scenarioHeaderSubtitle.textContent = 'Start of Season baseline, In-Season pivots, and portfolio migration what-if simulation.';
  }
  if (scenarioFrameworkAlert) {
    scenarioFrameworkAlert.innerHTML = '<i class="bi bi-info-circle me-2"></i><strong>Live Workflow:</strong> Select scenarios, run models, save options, rank tradeoffs, and compare recommendations.';
  }

  const acquisitionTab = document.getElementById('acquisition-tab');
  const churnTab = document.getElementById('churn-tab');
  const migrationTab = document.getElementById('migration-tab');
  if (acquisitionTab) {
    acquisitionTab.innerHTML = '<i class="bi bi-calendar-week me-2"></i><strong>1. In-Season Planner</strong><small class="d-block text-muted" style="font-size: 0.75rem;">Live Simulation</small>';
  }
  if (churnTab) {
    churnTab.innerHTML = '<i class="bi bi-hourglass-split me-2"></i><strong>2. End-of-Season Markdown</strong><small class="d-block text-muted" style="font-size: 0.75rem;">Live Simulation</small>';
  }
  if (migrationTab) {
    migrationTab.innerHTML = '<i class="bi bi-arrows-angle-expand me-2"></i><strong>3. Portfolio Migration</strong><small class="d-block text-muted" style="font-size: 0.75rem;">Live Simulation</small>';
  }

  // Segmentation copy alignment
  const segmentationHeader = document.querySelector('#segmentation-section .card-header h2');
  const segmentationSub = document.querySelector('#segmentation-section .card-header p');
  if (segmentationHeader) {
    segmentationHeader.innerHTML = '<i class="bi bi-people me-2"></i>Customer Cohorts';
  }
  if (segmentationSub) {
    segmentationSub.textContent = 'Promotion response differs by cohort and should guide targeting decisions.';
  }
  const comparisonTitle = document.querySelector('#segment-analysis-section .card-header h2');
  if (comparisonTitle) {
    comparisonTitle.innerHTML = '<i class="bi bi-bar-chart-line me-2"></i>Segment Response Comparison';
  }
  const segmentElasticityCardTitle = document.querySelector('#segment-analysis-section h4');
  if (segmentElasticityCardTitle && segmentElasticityCardTitle.textContent.includes('Cohort Elasticity Comparison')) {
    segmentElasticityCardTitle.textContent = 'Cohort Response Comparison';
  }
  const segmentMetricOption = document.querySelector('#comparison-metric-select option[value="elasticity"]');
  if (segmentMetricOption) {
    segmentMetricOption.textContent = 'Response Sensitivity';
  }

  // Methodology modal alignment for roadmap placeholders
  const step3Title = document.getElementById('methodology-modal-step3-label');
  const step4Title = document.getElementById('methodology-modal-step4-label');
  const step5Title = document.getElementById('methodology-modal-step5-label');
  const step3Body = document.querySelector('#methodology-modal-step3 .modal-body');
  const step4Body = document.querySelector('#methodology-modal-step4 .modal-body');
  const step5Body = document.querySelector('#methodology-modal-step5 .modal-body');

  if (step3Title) {
    step3Title.innerHTML = '<i class="bi bi-signpost-split me-2"></i>Methodology: In-Season Planner';
  }
  if (step4Title) {
    step4Title.innerHTML = '<i class="bi bi-signpost-split me-2"></i>Methodology: End-of-Season Markdown';
  }
  if (step5Title) {
    step5Title.innerHTML = '<i class="bi bi-signpost-split me-2"></i>Methodology: Portfolio Migration & Advanced Analysis';
  }

  if (step3Body) {
    step3Body.innerHTML = `
      <h6 class="mb-3"><i class="bi bi-calendar-week me-2"></i>Active Capability</h6>
      <p>Scenario-based in-season planning across SKUs and channels using inventory runway, competitor pricing, and social demand signals.</p>
      <div class="alert alert-info mb-0">
        <strong>Current implementation:</strong> Select scenario, run simulation, save, and rank outcomes for weekly in-season pivots.
      </div>
    `;
  }
  if (step4Body) {
    step4Body.innerHTML = `
      <h6 class="mb-3"><i class="bi bi-hourglass-split me-2"></i>Active Capability</h6>
      <p>Model-driven markdown sequencing for late-season liquidation while balancing margin floors, repeat-purchase risk, competitor price moves, and social momentum.</p>
      <div class="alert alert-info mb-0">
        <strong>Current implementation:</strong> Run scenario experiments to find the markdown path that clears inventory with controlled risk by SKU and channel.
      </div>
    `;
  }
  if (step5Body) {
    step5Body.innerHTML = `
      <h6 class="mb-3"><i class="bi bi-arrow-left-right me-2"></i>Active Capability</h6>
      <p>Models how actions in one channel group shift demand across portfolio SKUs, separating competitor capture from internal cannibalization.</p>
      <div class="alert alert-info mb-0">
        <strong>Current implementation:</strong> Test migration paths with scenarios, save alternatives, and rank by growth/profit objective before campaign launch.
      </div>
    `;
  }

  const step7ModalTitle = document.getElementById('methodology-modal-step7-label');
  const step7ModalBodyIntro = document.querySelector('#methodology-modal-step7 .modal-body p');
  if (step7ModalTitle) {
    step7ModalTitle.innerHTML = '<i class="bi bi-calculator me-2"></i>Methodology: Segment Response Comparison';
  }
  if (step7ModalBodyIntro) {
    step7ModalBodyIntro.textContent = 'Compares promotion response sensitivity across customer cohorts to guide targeted offer selection.';
  }
}

function renderList(el, items, fallbackText) {
  if (!el) return;
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    el.innerHTML = `<li>${fallbackText}</li>`;
    return;
  }
  el.innerHTML = list.slice(0, 4).map(item => `<li>${item}</li>`).join('');
}

async function getLlmReady(force = false) {
  const now = Date.now();
  if (!force && llmStatusCached !== null && (now - llmStatusLastCheckedAt) < 30000) {
    return llmStatusCached;
  }
  try {
    llmStatusCached = await isLLMConfigured();
  } catch {
    llmStatusCached = false;
  }
  llmStatusLastCheckedAt = now;
  return llmStatusCached;
}

function setLlmBadgeState(elementId, ready) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  if (ready) {
    badge.className = 'badge text-bg-success';
    badge.textContent = 'Connected';
  } else {
    badge.className = 'badge text-bg-secondary';
    badge.textContent = 'Not Connected';
  }
}

async function refreshLlmStatuses(force = false) {
  const ready = await getLlmReady(force);
  setLlmBadgeState('channel-promo-llm-status', ready);
  setLlmBadgeState('event-llm-status', ready);
  return ready;
}

function getLivePromoSnapshotSafe() {
  return (
    window.getChannelPromoSnapshot && typeof window.getChannelPromoSnapshot === 'function'
      ? window.getChannelPromoSnapshot()
      : null
  );
}

function findOptionValueByText(selectEl, text) {
  if (!selectEl || !text) return null;
  const needle = String(text).trim().toLowerCase();
  if (!needle) return null;
  const options = [...selectEl.options];
  const exact = options.find(opt => String(opt.textContent || '').trim().toLowerCase() === needle);
  if (exact) return exact.value;
  const partial = options.find(opt => String(opt.textContent || '').toLowerCase().includes(needle));
  return partial ? partial.value : null;
}

function setControlValue(elementId, value, eventName = 'input') {
  const el = document.getElementById(elementId);
  if (!el || value === undefined || value === null) return;
  el.value = String(value);
  el.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function applyScenarioPlanToControls(plan) {
  if (!plan || typeof plan !== 'object') return;

  if (plan.objective) {
    setControlValue('channel-promo-objective', plan.objective, 'change');
  }

  if (typeof plan.massPromoDepthPct === 'number') {
    setControlValue('mass-promo-slider', clamp(plan.massPromoDepthPct, 0, 40), 'input');
  }
  if (typeof plan.prestigePromoDepthPct === 'number') {
    setControlValue('prestige-promo-slider', clamp(plan.prestigePromoDepthPct, 0, 30), 'input');
  }
  if (typeof plan.skuBoostPct === 'number') {
    setControlValue('channel-promo-sku-boost-slider', clamp(plan.skuBoostPct, 0, 20), 'input');
  }
  if (typeof plan.competitorShockPct === 'number') {
    setControlValue('channel-promo-comp-shock', clamp(plan.competitorShockPct, -20, 20), 'input');
  }
  if (typeof plan.socialShockPts === 'number') {
    setControlValue('channel-promo-social-shock', clamp(plan.socialShockPts, -20, 20), 'input');
  }

  const applyMassEl = document.getElementById('channel-promo-apply-mass');
  if (applyMassEl && typeof plan.applyMass === 'boolean') {
    applyMassEl.checked = plan.applyMass;
    applyMassEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const applyPrestigeEl = document.getElementById('channel-promo-apply-prestige');
  if (applyPrestigeEl && typeof plan.applyPrestige === 'boolean') {
    applyPrestigeEl.checked = plan.applyPrestige;
    applyPrestigeEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const groupEl = document.getElementById('channel-promo-product-group');
  if (groupEl && plan.productGroup) {
    const allowed = ['all', 'sunscreen', 'moisturizer'];
    const nextGroup = allowed.includes(plan.productGroup) ? plan.productGroup : 'all';
    groupEl.value = nextGroup;
    groupEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const skuFocusName = String(plan.skuFocusName || '').trim();
  if (skuFocusName) {
    setTimeout(() => {
      const skuEl = document.getElementById('channel-promo-sku');
      if (!skuEl) return;
      const matchedValue = findOptionValueByText(skuEl, skuFocusName);
      if (!matchedValue) return;
      skuEl.value = matchedValue;
      skuEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, 120);
  }
}

async function runLiveCopilotAnalysis({ force = false, source = 'auto' } = {}) {
  const summaryEl = document.getElementById('channel-promo-llm-summary');
  const actionsEl = document.getElementById('channel-promo-llm-actions');
  const risksEl = document.getElementById('channel-promo-llm-risks');
  const autoEl = document.getElementById('channel-promo-llm-auto');
  if (!summaryEl || !actionsEl || !risksEl) return;
  if (!force && autoEl && !autoEl.checked) return;
  if (liveCopilotInFlight) {
    if (source === 'manual') {
      summaryEl.textContent = 'Analysis already running. Please wait...';
    }
    return;
  }
  const stopAnalyzeLoading = source === 'manual'
    ? startButtonLoading('channel-promo-llm-analyze', 'Analyzing...')
    : () => {};

  const snapshot = getLivePromoSnapshotSafe();
  if (!snapshot) {
    summaryEl.textContent = 'Run simulator controls first to generate a live scenario snapshot.';
    renderList(actionsEl, [], 'No actions available yet.');
    renderList(risksEl, [], 'No risks available yet.');
    stopAnalyzeLoading();
    return;
  }

  const ready = await refreshLlmStatuses();
  if (!ready) {
    summaryEl.textContent = 'LLM not configured. Use settings key icon to connect and enable co-pilot.';
    stopAnalyzeLoading();
    return;
  }

  liveCopilotInFlight = true;
  summaryEl.textContent = 'Analyzing current scenario with LLM...';

  try {
    const result = await generateLiveCopilot({
      liveSnapshot: snapshot,
      businessContext: llmBusinessContext
    });
    const confidenceText = Number.isFinite(Number(result.confidence))
      ? ` (confidence ${Math.round(Number(result.confidence))}%)`
      : '';
    summaryEl.textContent = `${result.summary || 'Analysis ready.'}${confidenceText}`;
    renderList(actionsEl, result.actions, 'No immediate action required.');
    renderList(risksEl, result.risks, 'No material risks flagged.');
  } catch (error) {
    summaryEl.textContent = `LLM analysis failed: ${error.message}`;
    renderList(actionsEl, [], 'Could not generate actions.');
    renderList(risksEl, [], 'Could not generate risks.');
  } finally {
    liveCopilotInFlight = false;
    stopAnalyzeLoading();
  }
}

function scheduleLiveCopilotAnalysis({ force = false } = {}) {
  if (liveCopilotDebounceTimer) {
    clearTimeout(liveCopilotDebounceTimer);
  }
  const delay = force ? 80 : 900;
  liveCopilotDebounceTimer = setTimeout(() => {
    runLiveCopilotAnalysis({ force });
  }, delay);
}

async function applyLlmPlanFromText() {
  const inputEl = document.getElementById('channel-promo-llm-plan-input');
  const resultEl = document.getElementById('channel-promo-llm-plan-result');
  if (!inputEl || !resultEl) return;

  const planText = inputEl.value.trim();
  if (!planText) {
    resultEl.textContent = 'Enter a plan first.';
    return;
  }

  const stopApplyLoading = startButtonLoading('channel-promo-llm-plan-apply', 'Applying...');
  const ready = await refreshLlmStatuses();
  if (!ready) {
    resultEl.textContent = 'LLM not configured. Connect API first.';
    stopApplyLoading();
    return;
  }

  const snapshot = getLivePromoSnapshotSafe();
  resultEl.textContent = 'Interpreting plan and applying controls...';

  try {
    const plan = await generateScenarioPlanFromText({
      userText: planText,
      liveSnapshot: snapshot
    });
    applyScenarioPlanToControls(plan);
    resultEl.textContent = `Applied plan. ${plan.reasoning || 'Controls updated from natural-language instruction.'}`;
    setTimeout(() => scheduleLiveCopilotAnalysis({ force: true }), 180);
  } catch (error) {
    resultEl.textContent = `Failed to apply plan: ${error.message}`;
  } finally {
    stopApplyLoading();
  }
}

function setSelectedEventForLlmAnalysis(event) {
  selectedEventForLlm = event || null;
  const selectedEl = document.getElementById('event-llm-selected');
  if (!selectedEl) return;
  if (!selectedEventForLlm) {
    selectedEl.textContent = 'Select an event from timeline to analyze impact and recommended pivot.';
    return;
  }
  const eventDate = selectedEventForLlm.date
    ? new Date(selectedEventForLlm.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'N/A';
  selectedEl.textContent = `Selected: ${selectedEventForLlm.event_type} (${eventDate}) - ${selectedEventForLlm.notes || 'No notes'}`;
}

async function runEventLlmAnalysis() {
  const summaryEl = document.getElementById('event-llm-summary');
  const impactEl = document.getElementById('event-llm-impact');
  const actionsEl = document.getElementById('event-llm-actions');
  if (!summaryEl || !impactEl || !actionsEl) return;

  if (!selectedEventForLlm) {
    summaryEl.textContent = 'Select an event on the timeline first.';
    return;
  }

  const stopEventLoading = startButtonLoading('event-llm-analyze-btn', 'Analyzing...');
  const ready = await refreshLlmStatuses();
  if (!ready) {
    summaryEl.textContent = 'LLM not configured. Connect API first.';
    stopEventLoading();
    return;
  }

  summaryEl.textContent = 'Analyzing selected event...';
  try {
    const result = await generateEventAnalyst({
      event: selectedEventForLlm,
      liveSnapshot: getLivePromoSnapshotSafe(),
      businessContext: llmBusinessContext
    });
    summaryEl.textContent = result.summary || 'Event analysis ready.';
    renderList(impactEl, result.impact, 'No major measurable impact detected.');
    renderList(actionsEl, result.actions, 'No immediate pivot needed.');
  } catch (error) {
    summaryEl.textContent = `Event analysis failed: ${error.message}`;
    renderList(impactEl, [], 'Unable to compute impact.');
    renderList(actionsEl, [], 'Unable to compute actions.');
  } finally {
    stopEventLoading();
  }
}

function initializeLlmAssistPanels() {
  refreshLlmStatuses(true);

  document.getElementById('channel-promo-llm-analyze')?.addEventListener('click', () => {
    runLiveCopilotAnalysis({ force: true, source: 'manual' });
  });

  document.getElementById('channel-promo-llm-auto')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      scheduleLiveCopilotAnalysis({ force: true });
    }
  });

  document.getElementById('channel-promo-llm-plan-apply')?.addEventListener('click', applyLlmPlanFromText);
  document.getElementById('channel-promo-llm-plan-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLlmPlanFromText();
    }
  });

  document.getElementById('event-llm-analyze-btn')?.addEventListener('click', runEventLlmAnalysis);

  window.onChannelPromoSnapshotUpdated = () => {
    scheduleLiveCopilotAnalysis({ force: false });
  };
  window.onEventCalendarEventSelected = (event) => {
    setSelectedEventForLlmAnalysis(event);
  };
}

// Handle chat message send
async function handleChatSend() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const message = input.value.trim();

  if (!message) return;

  const stopChatLoading = startButtonLoading(sendBtn, 'Sending...');
  input.value = '';
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    await sendMessage(message);
  } finally {
    input.disabled = false;
    stopChatLoading({ disabled: false });
    input.focus();
  }
}

// Open Scenario Editor
function openScenarioEditor(scenarioId) {
  const scenario = allScenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  // Populate form
  document.getElementById('edit-scenario-id').value = scenario.id;
  document.getElementById('edit-scenario-name').value = scenario.name;
  document.getElementById('edit-tier').value = scenario.config.tier.replace('_', ' ').toUpperCase();
  document.getElementById('edit-current-price').value = scenario.config.current_price;
  document.getElementById('edit-new-price').value = scenario.config.new_price;

  // Show constraints
  const constraints = scenario.constraints;
  document.getElementById('price-constraints').textContent =
    `Valid range: $${constraints.min_price} - $${constraints.max_price}`;

  // Show promotion settings if applicable
  if (scenario.config.promotion) {
    document.getElementById('promotion-settings').style.display = 'block';
    document.getElementById('edit-discount-pct').value = scenario.config.promotion.discount_pct;
    document.getElementById('edit-duration-months').value = scenario.config.promotion.duration_months;
  } else {
    document.getElementById('promotion-settings').style.display = 'none';
  }

  // Update price change indicator
  updatePriceChangeIndicator();

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('scenarioEditorModal'));
  modal.show();
}

// Update price change indicator
function updatePriceChangeIndicator() {
  const currentPrice = parseFloat(document.getElementById('edit-current-price').value);
  const newPrice = parseFloat(document.getElementById('edit-new-price').value);

  if (currentPrice && newPrice) {
    const change = ((newPrice - currentPrice) / currentPrice) * 100;
    const indicator = document.getElementById('price-change-indicator');
    indicator.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    indicator.className = 'input-group-text';
    if (change > 0) indicator.classList.add('bg-danger', 'text-white');
    else if (change < 0) indicator.classList.add('bg-success', 'text-white');
  }
}

// Save edited scenario
async function saveEditedScenario() {
  const scenarioId = document.getElementById('edit-scenario-id').value;
  const scenario = allScenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  // Get new values
  const newPrice = parseFloat(document.getElementById('edit-new-price').value);
  const discountPct = document.getElementById('edit-discount-pct').value ?
    parseFloat(document.getElementById('edit-discount-pct').value) : null;
  const durationMonths = document.getElementById('edit-duration-months').value ?
    parseInt(document.getElementById('edit-duration-months').value) : null;

  // Validate constraints
  if (newPrice < scenario.constraints.min_price || newPrice > scenario.constraints.max_price) {
    alert(`Price must be between $${scenario.constraints.min_price} and $${scenario.constraints.max_price}`);
    return;
  }

  // Update scenario
  scenario.config.new_price = newPrice;
  scenario.config.price_change_pct = ((newPrice - scenario.config.current_price) / scenario.config.current_price) * 100;

  if (scenario.config.promotion && discountPct && durationMonths) {
    scenario.config.promotion.discount_pct = discountPct;
    scenario.config.promotion.duration_months = durationMonths;

    // Recalculate promo price
    scenario.config.new_price = scenario.config.current_price * (1 - discountPct / 100);
  }

  // Update description
  if (scenario.category === 'promotion') {
    scenario.name = `Launch ${discountPct}% Off Promo (${durationMonths} months)`;
    scenario.description = `Offer ${discountPct}% discount for ${durationMonths} months on ${scenario.config.tier.replace('_', '-')} tier`;
  } else {
    const priceDiff = newPrice - scenario.config.current_price;
    scenario.name = `${scenario.config.tier.replace('_', ' ')} ${priceDiff >= 0 ? '+' : ''}$${Math.abs(priceDiff).toFixed(2)}`;
  }

  // Close modal properly to avoid focus issues
  const modalElement = document.getElementById('scenarioEditorModal');
  const modalInstance = bootstrap.Modal.getInstance(modalElement);
  if (modalInstance) {
    modalInstance.hide();
  }

  // Wait for modal to close animation
  await new Promise(resolve => setTimeout(resolve, 300));

  // Reload scenario data and refresh tabs
  await loadScenariosData();
  populateElasticityModelTabs();

  // If this was the selected scenario, re-select it
  const modelType = scenario.model_type;
  if (selectedScenarioByModel[modelType] && selectedScenarioByModel[modelType].id === scenarioId) {
    selectedScenarioByModel[modelType] = scenario;
    if (modelType === activeModelType) {
      selectedScenario = scenario;
      syncScenarioSelectionUI();
      updateSimulateButtonState();
    }
  }

  alert('Scenario updated! Click "Simulate" to see the new results.');
}

// Initialize Bootstrap popovers for ML methodology
function initializePopovers() {
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  const popoverList = [...popoverTriggerList].map(popoverTriggerEl => {
    return new bootstrap.Popover(popoverTriggerEl, {
      html: true,
      sanitize: false,
      trigger: 'focus'
    });
  });
}

// ========== Segmentation Section Functions ==========

/**
 * Initialize the segmentation section
 */
function initializeSegmentationSection() {
  // Populate filter pills for each axis
  populateFilterPills(
    'acquisition-filters',
    window.segmentEngine.axisDefinitions.acquisition,
    'acquisition'
  );
  populateFilterPills(
    'engagement-filters',
    window.segmentEngine.axisDefinitions.engagement,
    'engagement'
  );
  populateFilterPills(
    'monetization-filters',
    window.segmentEngine.axisDefinitions.monetization,
    'monetization'
  );

  // Set up event listeners for controls
  const tierSelector = document.getElementById('segment-tier-select');
  const axisSelector = document.getElementById('segment-axis-select');
  const vizTypeSelector = document.getElementById('segment-viz-select');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  tierSelector.addEventListener('change', updateSegmentVisualization);
  axisSelector.addEventListener('change', updateSegmentVisualization);
  vizTypeSelector.addEventListener('change', updateSegmentVisualization);
  clearFiltersBtn.addEventListener('click', clearAllFilters);

  // 3-axis view buttons
  const reset3AxisBtn = document.getElementById('reset-3axis-btn');
  const export3AxisBtn = document.getElementById('export-3axis-btn');

  if (reset3AxisBtn) {
    reset3AxisBtn.addEventListener('click', () => {
      updateSegmentVisualization();
    });
  }

  if (export3AxisBtn) {
    export3AxisBtn.addEventListener('click', () => {
      const tier = document.getElementById('segment-tier-select').value;
      const filename = `segment-3axis-${tier}-${new Date().toISOString().slice(0, 10)}.svg`;
      exportSVG('three-axis-radial-viz', filename);
    });
  }

  // Initial render
  updateSegmentVisualization();
}

/**
 * Populate cohort selector options
 * @param {string} selectId - Select element ID
 */
function populateCohortSelector(selectId) {
  const selector = document.getElementById(selectId);
  if (!selector || !window.segmentEngine) return;

  const cohorts = window.segmentEngine.getCohortDefinitions();
  if (!cohorts.length) return;

  selector.innerHTML = '';
  cohorts.forEach(cohort => {
    const option = document.createElement('option');
    option.value = cohort.id;
    option.textContent = cohort.label;
    if (cohort.id === window.segmentEngine.getActiveCohort()) {
      option.selected = true;
    }
    selector.appendChild(option);
  });
}

/**
 * Keep cohort selectors in sync (only Step 5 now)
 * @param {string} cohortId - Selected cohort id
 */
function syncCohortSelectors(cohortId) {
  // Only Step 5 has cohort selector now
  const selector = document.getElementById('compare-cohort-select');
  if (selector && selector.value !== cohortId) {
    selector.value = cohortId;
  }
}

/**
 * Populate filter pills for a specific axis
 * @param {string} containerId - Container element ID
 * @param {Array<string>} values - Filter values
 * @param {string} axisType - Axis type (engagement, monetization, acquisition)
 */
function populateFilterPills(containerId, values, axisType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  values.forEach(value => {
    const pill = document.createElement('div');
    pill.className = 'filter-pill';
    pill.dataset.value = value;
    pill.dataset.axis = axisType;
    pill.textContent = window.segmentEngine.formatSegmentLabel(value);

    // Toggle active state on click
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      updateSegmentVisualization();
    });

    container.appendChild(pill);
  });
}

/**
 * Update segment visualization based on current filters and selections.
 * Cohort views use segment data (segments.csv, segment_kpis.csv, segment_elasticity.json).
 * Channel View uses only elasticity-params.json by_channel (your data).
 */
function updateSegmentVisualization() {
  const tier = document.getElementById('segment-tier-select').value;
  const axis = document.getElementById('segment-axis-select').value;
  const vizType = document.getElementById('segment-viz-select').value;

  const heatmapView = document.getElementById('heatmap-view');
  const threeAxisView = document.getElementById('3axis-view');
  const scatterView = document.getElementById('scatter-view');
  const channelView = document.getElementById('channel-view');

  // Channel View: built only from our data (elasticity-params.json by_channel)
  if (vizType === 'channel') {
    if (heatmapView) heatmapView.style.display = 'none';
    if (threeAxisView) threeAxisView.style.display = 'none';
    if (scatterView) scatterView.style.display = 'none';
    if (channelView) channelView.style.display = 'block';

    getChannelElasticityData()
      .then(data => {
        if (document.getElementById('channel-elasticity-bar')) {
          renderChannelElasticityBar('channel-elasticity-bar', data);
        }
        if (document.getElementById('channel-elasticity-heatmap')) {
          renderChannelElasticityHeatmap('channel-elasticity-heatmap', data);
        }
        if (document.getElementById('channel-summary')) {
          renderChannelSummary('channel-summary', data);
        }
      })
      .catch(error => {
        console.warn('Channel elasticity data failed:', error);
        if (channelView) {
          channelView.innerHTML =
            '<p class="text-muted">Load data in Step 1 to see channel charts.</p>';
        }
      });

    const kpiDashboard = document.getElementById('segment-kpi-dashboard');
    if (kpiDashboard) {
      kpiDashboard.innerHTML =
        '<p class="text-muted small mb-0">Channel View uses <code>elasticity-params.json</code> (by_channel) for each channel.</p>';
    }
    return;
  }

  // Hide channel view when not selected
  if (channelView) channelView.style.display = 'none';

  // Cohort views require segment engine and data
  if (!window.segmentEngine || !window.segmentEngine.isDataLoaded()) {
    if (heatmapView) heatmapView.style.display = 'none';
    if (threeAxisView) threeAxisView.style.display = 'none';
    if (scatterView) scatterView.style.display = 'none';

    const kpiDashboard = document.getElementById('segment-kpi-dashboard');
    if (kpiDashboard) {
      kpiDashboard.innerHTML =
        '<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Cohort data not loaded. Load data in Step 1, or use <strong>Channel View</strong> for elasticity by channel.</div>';
    }
    return;
  }

  // Collect active filters
  const filters = {
    acquisition: getActivePillValues('acquisition-filters'),
    engagement: getActivePillValues('engagement-filters'),
    monetization: getActivePillValues('monetization-filters')
  };

  // Get filtered segments (with cohort adjustments applied)
  const filteredSegments = window.segmentEngine.filterSegments(filters);

  // Filter by selected tier
  const tierSegments = filteredSegments.filter(s => s.tier === tier);

  // Aggregate KPIs (cohort adjustments already applied in filterSegments)
  const aggregatedKPIs = window.segmentEngine.aggregateKPIs(tierSegments);

  // Render KPI cards
  renderSegmentKPICards('segment-kpi-dashboard', aggregatedKPIs);

  // Show/hide views based on visualization type
  if (vizType === 'heatmap') {
    if (heatmapView) heatmapView.style.display = 'block';
    if (threeAxisView) threeAxisView.style.display = 'none';
    if (scatterView) scatterView.style.display = 'none';
    renderSegmentElasticityHeatmap('segment-elasticity-heatmap', tier, filters, axis);
  } else if (vizType === '3axis') {
    if (heatmapView) heatmapView.style.display = 'none';
    if (threeAxisView) threeAxisView.style.display = 'block';
    if (scatterView) scatterView.style.display = 'none';
    render3AxisRadialChart('three-axis-radial-viz', tier, null);
  } else if (vizType === 'scatter') {
    if (heatmapView) heatmapView.style.display = 'none';
    if (threeAxisView) threeAxisView.style.display = 'none';
    if (scatterView) scatterView.style.display = 'block';
    renderSegmentScatterPlot('segment-scatter-plot', tier, axis);
  }

  // Refresh watchlist whenever visualization updates
  updateCohortWatchlist();
}

/**
 * Get active pill values from a container
 * @param {string} containerId - Container element ID
 * @returns {Array<string>} Array of active filter values
 */
function getActivePillValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  const activePills = container.querySelectorAll('.filter-pill.active');
  return Array.from(activePills).map(pill => pill.dataset.value);
}

/**
 * Clear all filter pills
 */
function clearAllFilters() {
  // Remove active class from all pills
  document.querySelectorAll('.filter-pill.active').forEach(pill => {
    pill.classList.remove('active');
  });

  // Update visualization
  updateSegmentVisualization();
  updateCohortWatchlist();
}

async function initializeSegmentSkuSelector() {
  const skuSelect = document.getElementById('compare-sku-select');
  if (!skuSelect) return;

  try {
    const skuWeekly = await loadSkuWeeklyData();
    const currentWeek = skuWeekly.find(r => r.is_current_week === true)?.week_of_season
      || Math.max(...skuWeekly.map(r => Number(r.week_of_season || 0)));
    const currentRows = skuWeekly.filter(r => Number(r.week_of_season) === Number(currentWeek));

    const avgTierElasticity = (rows, group) => {
      const subset = rows.filter(r => r.channel_group === group);
      if (!subset.length) return group === 'mass' ? 2.0 : 1.4;
      return subset.reduce((sum, row) => sum + Math.abs(Number(row.base_elasticity || 0)), 0) / subset.length;
    };
    segmentSkuProfiles.all.elasticityByTier = {
      ad_supported: avgTierElasticity(currentRows, 'mass'),
      ad_free: avgTierElasticity(currentRows, 'prestige')
    };

    const bySku = {};
    currentRows.forEach(row => {
      const key = row.sku_id;
      if (!bySku[key]) {
        bySku[key] = {
          sku_id: row.sku_id,
          sku_name: row.sku_name,
          product_group: row.product_group,
          elasticityByTier: { ad_supported: [], ad_free: [] }
        };
      }
      const tier = row.channel_group === 'mass' ? 'ad_supported' : 'ad_free';
      bySku[key].elasticityByTier[tier].push(Math.abs(Number(row.base_elasticity || 0)));
    });

    Object.values(bySku).forEach(profile => {
      profile.elasticityByTier = {
        ad_supported: profile.elasticityByTier.ad_supported.length
          ? profile.elasticityByTier.ad_supported.reduce((s, v) => s + v, 0) / profile.elasticityByTier.ad_supported.length
          : 2.0,
        ad_free: profile.elasticityByTier.ad_free.length
          ? profile.elasticityByTier.ad_free.reduce((s, v) => s + v, 0) / profile.elasticityByTier.ad_free.length
          : 1.4
      };
      segmentSkuProfiles[profile.sku_id] = profile;
    });

    const previous = skuSelect.value || 'all';
    skuSelect.innerHTML = '<option value="all" selected>All Products</option>';
    Object.values(bySku)
      .sort((a, b) => a.sku_id.localeCompare(b.sku_id))
      .forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.sku_id;
        const groupLabel = profile.product_group
          ? `${profile.product_group.charAt(0).toUpperCase()}${profile.product_group.slice(1)}`
          : 'Product';
        option.textContent = `${profile.sku_name} (${groupLabel})`;
        skuSelect.appendChild(option);
      });

    if ([...skuSelect.options].some(o => o.value === previous)) {
      skuSelect.value = previous;
    }
  } catch (error) {
    console.error('Failed to initialize SKU selector for segment comparison:', error);
  }
}

/**
 * Render segment comparison table
 */
function renderSegmentComparisonTable() {
  const axis = document.getElementById('compare-axis-select').value;
  const tier = document.getElementById('compare-tier-select').value;
  const sortBy = document.getElementById('compare-sort-select').value;
  const selectedSku = document.getElementById('compare-sku-select')?.value || 'all';
  const skuSummaryEl = document.getElementById('compare-sku-summary');
  const skuProfile = segmentSkuProfiles[selectedSku] || segmentSkuProfiles.all;
  const tierBaseAbsElasticity = Math.abs(segmentSkuProfiles.all.elasticityByTier?.[tier] || (tier === 'ad_supported' ? 2.0 : 1.4));
  const skuAbsElasticity = Math.abs(skuProfile.elasticityByTier?.[tier] || tierBaseAbsElasticity);
  const skuElasticityMultiplier = tierBaseAbsElasticity > 0 ? (skuAbsElasticity / tierBaseAbsElasticity) : 1;

  // Get segments with cohort adjustments already applied
  const segments = window.segmentEngine.getSegmentsForTier(tier);
  const axisSegments = [...new Set(segments.map(s => s[axis]))];

  // Aggregate by axis
  const comparisonData = axisSegments.map(segmentId => {
    const matching = segments.filter(s => s[axis] === segmentId);
    const totalCustomers = matching.reduce((sum, s) => sum + parseInt(s.customer_count), 0);
    const avgRepeatLoss = matching.reduce((sum, s) => sum + (parseFloat(s.repeat_loss_rate) * parseInt(s.customer_count)), 0) / totalCustomers;
    const avgOrderValue = matching.reduce((sum, s) => sum + (parseFloat(s.avg_order_value) * parseInt(s.customer_count)), 0) / totalCustomers;

    // Get elasticity from segment_elasticity.json (with cohort multiplier applied)
    const segmentElasticity = window.segmentEngine.getElasticity(tier, matching[0].compositeKey, axis);
    const elasticity = segmentElasticity * skuElasticityMultiplier;

    // Calculate axis-aware risk level
    let risk_level;
    if (axis === 'engagement') {
      // Engagement (churn) elasticity is POSITIVE - higher = more risky
      // Realistic thresholds based on actual business impact:
      // Low: < 0.7 (churn increases < 70% when price doubles - very sticky)
      // Medium: 0.7 - 1.5 (70-150% churn increase - moderate risk)
      // High: > 1.5 (> 150% churn increase - very risky)
      risk_level = elasticity < 0.7 ? 'Low' : (elasticity < 1.5 ? 'Medium' : 'High');
    } else if (axis === 'acquisition') {
      // Acquisition elasticity is NEGATIVE - more negative = more risky
      // Low: > -1.2 (inelastic)
      // Medium: -1.8 to -1.2
      // High: < -1.8 (very elastic)
      const absElasticity = Math.abs(elasticity);
      risk_level = absElasticity < 1.2 ? 'Low' : (absElasticity < 1.8 ? 'Medium' : 'High');
    } else if (axis === 'monetization') {
      // Monetization (migration) - higher upgrade willingness
      // Low: < 0.8 (sticky to current tier)
      // Medium: 0.8 - 1.3
      // High: > 1.3 (very likely to switch tiers)
      risk_level = elasticity < 0.8 ? 'Low' : (elasticity < 1.3 ? 'Medium' : 'High');
    } else {
      // Fallback for unknown axis
      risk_level = 'Medium';
    }

    return {
      segment: segmentId,
      label: window.segmentEngine.formatSegmentLabel(segmentId),
      customers: totalCustomers,
      repeat_loss_rate: avgRepeatLoss,
      avg_order_value: avgOrderValue,
      elasticity: elasticity || -2.0,
      segmentElasticity: segmentElasticity || -2.0,
      risk_level: risk_level
    };
  });

  // Sort
  comparisonData.sort((a, b) => {
    switch(sortBy) {
      case 'elasticity': return a.elasticity - b.elasticity;
      case 'customers': return b.customers - a.customers;
      case 'churn': return b.repeat_loss_rate - a.repeat_loss_rate;
      case 'aov': return b.avg_order_value - a.avg_order_value;
      default: return 0;
    }
  });

  // Render table
  const container = document.getElementById('segment-comparison-table');
  container.innerHTML = `
    <table class="table table-hover">
      <thead class="table-light">
        <tr>
          <th>Segment</th>
          <th class="text-end">Customers</th>
          <th class="text-end">Repeat Loss</th>
          <th class="text-end">Avg Order Value</th>
          <th class="text-end">Segment Elasticity</th>
          <th class="text-end">SKU-Adjusted Elasticity</th>
          <th class="text-center">Risk Level</th>
        </tr>
      </thead>
      <tbody>
        ${comparisonData.map(d => `
          <tr>
            <td><strong>${d.label}</strong></td>
            <td class="text-end">${formatNumber(d.customers)}</td>
            <td class="text-end">${(d.repeat_loss_rate * 100).toFixed(2)}%</td>
            <td class="text-end">${formatCurrency(d.avg_order_value)}</td>
            <td class="text-end">${d.segmentElasticity.toFixed(2)}</td>
            <td class="text-end">
              <span class="badge ${d.risk_level === 'High' ? 'bg-danger' : (d.risk_level === 'Medium' ? 'bg-warning' : 'bg-success')}">
                ${d.elasticity.toFixed(2)}
              </span>
            </td>
            <td class="text-center">
              <span class="badge ${d.risk_level === 'High' ? 'bg-danger' : (d.risk_level === 'Medium' ? 'bg-warning' : 'bg-success')}">
                ${d.risk_level}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  if (skuSummaryEl) {
    if (selectedSku === 'all') {
      skuSummaryEl.textContent = 'Segment response metrics shown at channel-group level (all SKUs). Select one SKU to view product-specific elasticity and risk shifts.';
    } else {
      const profileLabel = `${skuProfile.sku_id} (${skuProfile.product_group})`;
      const multPct = ((skuElasticityMultiplier - 1) * 100);
      skuSummaryEl.textContent =
        `SKU mode: ${profileLabel}. This SKU is ${multPct >= 0 ? '+' : ''}${multPct.toFixed(1)}% more elastic than channel baseline, so table risk and elasticity are adjusted for this product.`;
    }
  }

  // Render chart
  renderSegmentComparisonChart(comparisonData);
}

/**
 * Render comparison chart (Chart.js bar chart)
 */
function renderSegmentComparisonChart(data) {
  const ctx = document.getElementById('segment-comparison-chart');

  if (window.comparisonChart) {
    window.comparisonChart.destroy();
  }

  window.comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Price Elasticity',
        data: data.map(d => Math.abs(d.elasticity)),
        backgroundColor: data.map(d =>
          d.risk_level === 'High' ? '#dc3545' : (d.risk_level === 'Medium' ? '#ffc107' : '#28a745')
        ),
        borderColor: '#fff',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Elasticity: ${context.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Absolute Elasticity' }
        }
      }
    }
  });
}

/**
 * Initialize segment comparison table
 */
function initializeSegmentComparison() {
  const compareAxisSelect = document.getElementById('compare-axis-select');
  const compareTierSelect = document.getElementById('compare-tier-select');
  const compareSortSelect = document.getElementById('compare-sort-select');
  const compareSkuSelect = document.getElementById('compare-sku-select');

  if (!compareAxisSelect || !compareTierSelect || !compareSortSelect || !compareSkuSelect) return;

  compareAxisSelect.addEventListener('change', renderSegmentComparisonTable);
  compareTierSelect.addEventListener('change', renderSegmentComparisonTable);
  compareSortSelect.addEventListener('change', renderSegmentComparisonTable);
  compareSkuSelect.addEventListener('change', renderSegmentComparisonTable);

  // Initial render
  initializeSegmentSkuSelector().finally(() => {
    renderSegmentComparisonTable();
  });

  // Section stays hidden until user clicks "Explore Segments" button
  // document.getElementById('segment-analysis-section').style.display = 'block';
}

/**
 * Initialize filter presets
 */
function initializeFilterPresets() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyFilterPreset(preset);
    });
  });

  // Search toggle
  document.getElementById('filter-search-toggle')?.addEventListener('click', () => {
    const searchBox = document.getElementById('filter-search-box');
    searchBox.style.display = searchBox.style.display === 'none' ? 'block' : 'none';
  });

  // Search input
  document.getElementById('segment-search-input')?.addEventListener('input', (e) => {
    searchSegments(e.target.value);
  });
}

/**
 * Apply filter preset
 */
function applyFilterPreset(preset) {
  clearAllFilters();

  const tier = document.getElementById('segment-tier-select').value;
  const segments = window.segmentEngine.getSegmentsForTier(tier);

  let targetSegments = [];

  switch(preset) {
    case 'high-risk':
      // High repeat-loss rate (> 15%)
      targetSegments = segments
        .filter(s => parseFloat(s.repeat_loss_rate) > 0.15)
        .map(s => s.engagement);
      break;
    case 'low-elastic':
      // Low elasticity (> -2.0)
      targetSegments = segments
        .filter(s => {
          const elasticity = window.segmentEngine.getElasticity(tier, s.compositeKey, 'engagement');
          return elasticity > -2.0;
        })
        .map(s => s.engagement);
      break;
    case 'high-value':
      // High AOV (> $40)
      targetSegments = segments
        .filter(s => parseFloat(s.avg_order_value) > 40)
        .map(s => s.monetization);
      break;
    case 'large':
      // Large customer count (> 2000)
      targetSegments = segments
        .filter(s => parseInt(s.customer_count) > 2000)
        .map(s => s.acquisition);
      break;
  }

  // Activate relevant pills
  targetSegments = [...new Set(targetSegments)];
  targetSegments.forEach(segmentId => {
    const pill = document.querySelector(`[data-segment-id="${segmentId}"]`);
    if (pill) pill.classList.add('active');
  });

  updateSegmentVisualization();
  updateFilterSummary();
}

/**
 * Search segments by name
 */
function searchSegments(query) {
  const resultsContainer = document.getElementById('search-results');

  if (!query || query.length < 2) {
    resultsContainer.innerHTML = '';
    return;
  }

  const allSegments = [
    ...window.segmentEngine.axisDefinitions.acquisition,
    ...window.segmentEngine.axisDefinitions.engagement,
    ...window.segmentEngine.axisDefinitions.monetization
  ];

  const matches = allSegments.filter(segmentId => {
    const info = window.segmentEngine.getSegmentInfo(segmentId);
    const label = info ? info.label : segmentId;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  resultsContainer.innerHTML = matches.map(segmentId => {
    const info = window.segmentEngine.getSegmentInfo(segmentId);
    return `
      <button class="btn btn-sm btn-outline-secondary me-2 mb-2"
              onclick="selectSegmentFromSearch('${segmentId}')">
        ${info ? info.label : segmentId}
      </button>
    `;
  }).join('');
}

/**
 * Select segment from search results
 */
window.selectSegmentFromSearch = function(segmentId) {
  const pill = document.querySelector(`[data-segment-id="${segmentId}"]`);
  if (pill) {
    pill.classList.add('active');
    updateSegmentVisualization();
    updateFilterSummary();
  }
};

function getWatchlistRiskBandMeta(riskPct) {
  if (riskPct < 12) return { color: 'success', label: 'Fewer at risk' };
  if (riskPct < 18) return { color: 'warning', label: 'Some at risk' };
  return { color: 'danger', label: 'Many at risk' };
}

function formatProductGroupLabel(productGroup) {
  const raw = String(productGroup || 'product').trim();
  if (!raw) return 'Product';
  return raw.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizeRange(value, min, max, fallback = 0.5) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return fallback;
  return clamp((v - min) / (max - min), 0, 1);
}

function buildCohortWatchlistContextFromSkuData(rows) {
  const validRows = (rows || []).filter(row => Number(row.week_of_season) > 0);
  if (!validRows.length) return null;

  const currentWeek =
    validRows.find(row => row.is_current_week === true)?.week_of_season ||
    validRows.reduce((max, row) => Math.max(max, Number(row.week_of_season || 0)), 0);
  const currentWeekNum = Number(currentWeek) || 1;
  const previousWeekNum = Math.max(1, currentWeekNum - 1);

  const currentRows = validRows.filter(row => Number(row.week_of_season) === currentWeekNum);
  const previousRows = validRows.filter(row => Number(row.week_of_season) === previousWeekNum);
  if (!currentRows.length) return null;

  const previousUnitsBySku = new Map();
  previousRows.forEach(row => {
    const key = row.sku_id;
    previousUnitsBySku.set(key, (previousUnitsBySku.get(key) || 0) + (Number(row.net_units_sold) || 0));
  });

  const skuMap = new Map();
  currentRows.forEach(row => {
    const key = row.sku_id;
    if (!skuMap.has(key)) {
      skuMap.set(key, {
        sku_id: row.sku_id,
        sku_name: row.sku_name || row.sku_id,
        product_group: row.product_group || 'product',
        channels: new Set(),
        mass_units: 0,
        prestige_units: 0,
        units: 0,
        inventory: 0,
        price_sum: 0,
        gap_sum: 0,
        promo_sum: 0,
        social_sum: 0,
        elasticity_sum: 0,
        row_count: 0,
        prev_units: previousUnitsBySku.get(key) || 0
      });
    }

    const entry = skuMap.get(key);
    const units = Number(row.net_units_sold) || 0;
    entry.channels.add(row.sales_channel || row.channel_group || 'channel');
    entry.units += units;
    entry.inventory += Number(row.end_inventory_units) || 0;
    entry.price_sum += Number(row.effective_price || row.list_price) || 0;
    entry.gap_sum += Number(row.price_gap_vs_competitor) || 0;
    entry.promo_sum += Number(row.promo_depth_pct) || 0;
    entry.social_sum += Number(row.social_engagement_score) || 0;
    entry.elasticity_sum += Math.abs(Number(row.base_elasticity) || 0);
    entry.row_count += 1;
    if (row.channel_group === 'mass') entry.mass_units += units;
    if (row.channel_group === 'prestige') entry.prestige_units += units;
  });

  const skuProfiles = [...skuMap.values()].map(entry => {
    const count = Math.max(1, entry.row_count);
    const avgPrice = entry.price_sum / count;
    const avgGapPct = entry.gap_sum / count;
    const avgPromoDepth = entry.promo_sum / count;
    const avgSocial = entry.social_sum / count;
    const avgElasticity = entry.elasticity_sum / count;
    const wowUnitsPct = entry.prev_units > 0 ? ((entry.units - entry.prev_units) / entry.prev_units) : 0;
    const massShare = entry.units > 0 ? (entry.mass_units / entry.units) : 0.5;
    const channelSwitchFit = clamp(1 - (Math.abs(massShare - 0.5) * 2), 0, 1);

    return {
      sku_id: entry.sku_id,
      sku_name: entry.sku_name,
      product_group: entry.product_group,
      channels: [...entry.channels],
      units: entry.units,
      inventory: entry.inventory,
      avgPrice,
      avgGapPct,
      avgPromoDepth,
      avgSocial,
      avgElasticity,
      wowUnitsPct,
      massShare,
      channelSwitchFit
    };
  });

  if (!skuProfiles.length) return null;

  const prices = skuProfiles.map(row => row.avgPrice);
  const socials = skuProfiles.map(row => row.avgSocial);
  const elasticities = skuProfiles.map(row => row.avgElasticity);
  const maxPositiveGap = Math.max(0.0001, ...skuProfiles.map(row => Math.max(0, row.avgGapPct)));
  const totalUnits = Math.max(1, skuProfiles.reduce((sum, row) => sum + row.units, 0));
  const totalInventory = Math.max(1, skuProfiles.reduce((sum, row) => sum + row.inventory, 0));

  skuProfiles.forEach(row => {
    row.premiumScore = normalizeRange(row.avgPrice, Math.min(...prices), Math.max(...prices), 0.5);
    row.valueScore = clamp(1 - row.premiumScore, 0, 1);
    row.socialMomentum = normalizeRange(row.avgSocial, Math.min(...socials), Math.max(...socials), 0.5);
    row.elasticityScore = normalizeRange(row.avgElasticity, Math.min(...elasticities), Math.max(...elasticities), 0.5);
    row.promoSupport = clamp(row.avgPromoDepth / 25, 0, 1);
    row.compPressure = clamp(Math.max(0, row.avgGapPct) / maxPositiveGap, 0, 1);
    row.inventoryShare = clamp(row.inventory / totalInventory, 0, 1);
    row.volumeShare = clamp(row.units / totalUnits, 0, 1);
  });

  return { currentWeek: currentWeekNum, skuProfiles };
}

function ensureCohortWatchlistContextLoaded() {
  if (cohortWatchlistContext?.skuProfiles?.length) return Promise.resolve(cohortWatchlistContext);
  if (cohortWatchlistContextPromise) return cohortWatchlistContextPromise;

  cohortWatchlistContextPromise = loadSkuWeeklyData()
    .then(rows => {
      cohortWatchlistContext = buildCohortWatchlistContextFromSkuData(rows);
      return cohortWatchlistContext;
    })
    .catch(error => {
      console.warn('Failed to load SKU drilldown context for cohort watchlist:', error);
      cohortWatchlistContext = null;
      return null;
    })
    .finally(() => {
      cohortWatchlistContextPromise = null;
    });

  return cohortWatchlistContextPromise;
}

function deriveCohortPreferenceWeights(entry) {
  const weights = {
    value: 0.35,
    premium: 0.35,
    trend: 0.35,
    promo: 0.35,
    loyalty: 0.35,
    channelSwitch: 0.35,
    trial: 0.35,
    routine: 0.35
  };
  const boost = patch => {
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (weights[key] === undefined) return;
      weights[key] = Math.max(weights[key], Number(value) || 0);
    });
  };

  const acquisitionMap = {
    seasonal_first_time: { trend: 0.76, value: 0.48, routine: 0.28 },
    routine_refill: { routine: 0.94, loyalty: 0.76, value: 0.42 },
    gift_buyer: { premium: 0.8, trend: 0.36, value: 0.28 },
    influencer_discovered: { trend: 0.97, premium: 0.58, promo: 0.52 },
    promo_triggered: { promo: 0.98, value: 0.88, loyalty: 0.18 }
  };
  const engagementMap = {
    prestige_loyalist: { loyalty: 0.94, premium: 0.9, channelSwitch: 0.22 },
    value_seeker: { value: 0.93, promo: 0.68, loyalty: 0.3 },
    deal_hunter: { promo: 1.0, value: 0.96, loyalty: 0.18 },
    occasional_shop: { promo: 0.52, trend: 0.46, loyalty: 0.28 },
    channel_switcher: { channelSwitch: 0.98, value: 0.58, premium: 0.5 }
  };
  const monetizationMap = {
    single_sku_staple: { routine: 0.88, loyalty: 0.58, premium: 0.32 },
    multi_sku_builder: { premium: 0.64, trend: 0.57, routine: 0.65 },
    value_bundle_buyer: { value: 0.98, promo: 0.82, routine: 0.54 },
    premium_add_on: { premium: 1.0, loyalty: 0.64, trend: 0.56 },
    trial_size_sampler: { trial: 1.0, value: 0.74, trend: 0.58 }
  };

  boost(acquisitionMap[entry.acquisition]);
  boost(engagementMap[entry.engagement]);
  boost(monetizationMap[entry.monetization]);

  if (entry.profileWeights) {
    const profile = entry.profileWeights;
    boost({
      loyalty: Number(profile.brand_loyal) || 0,
      value: Number(profile.value_conscious) || 0,
      promo: Number(profile.deal_seeker) || 0,
      trend: Number(profile.trend_driven) || 0,
      channelSwitch: Number(profile.channel_switcher) || 0,
      premium: Number(profile.premium_loyal) || 0,
      trial: Number(profile.at_risk) || 0,
      routine: Number(profile.brand_loyal) || 0
    });
  }

  const maxWeight = Math.max(1, ...Object.values(weights));
  Object.keys(weights).forEach(key => {
    weights[key] = clamp(weights[key] / maxWeight, 0, 1);
  });
  return weights;
}

function getWatchlistChannelFocusLabel(profile) {
  if (profile.massShare >= 0.58) return 'Mass: Target + Amazon';
  if (profile.massShare <= 0.42) return 'Prestige: Sephora + Ulta';
  return 'Balanced channels';
}

function getWatchlistSkuAction(profile, promoSensitivity, cohortEntry) {
  if (profile.compPressure > 0.62 && profile.promoFit > 0.55) {
    return `Run selective 8-12% defense promo in ${profile.channelFocus}.`;
  }
  if (profile.socialMomentum > 0.68 && profile.premiumScore > 0.58) {
    return `Hold depth and use creator-led messaging in ${profile.channelFocus}.`;
  }
  if (promoSensitivity > 0.58 && profile.elasticityScore > 0.55 && profile.inventoryShare > 0.14) {
    return 'Prioritize this SKU in the next promo burst to clear inventory.';
  }
  if (cohortEntry.monetization === 'trial_size_sampler' || profile.trialFit > 0.68) {
    return 'Package as trial-friendly offer with low entry barrier.';
  }
  return 'Monitor and retarget this cohort with channel-specific creative.';
}

function computeCohortSkuDrilldown(entry, context) {
  if (!context?.skuProfiles?.length) return null;

  const weights = deriveCohortPreferenceWeights(entry);
  const atRiskCustomers = Math.max(0, Number(entry.atRiskCustomers) || 0);
  const promoSensitivity = clamp((Math.abs(Number(entry.promoElasticity) || 1.8) - 1.0) / 2.2, 0, 1);
  const repeatSensitivity = clamp((Math.abs(Number(entry.repeatElasticity) || 0.8) - 0.25) / 1.8, 0, 1);

  const scored = context.skuProfiles.map(profile => {
    const isSunscreen = profile.product_group === 'sunscreen';
    const routineFit = clamp((isSunscreen ? 0.46 : 0.86) * (0.7 + ((1 - profile.compPressure) * 0.3)), 0, 1);
    const trendFit = clamp((profile.socialMomentum * 0.58) + ((isSunscreen ? 1 : 0.48) * 0.42), 0, 1);
    const promoFit = clamp((profile.elasticityScore * 0.62) + (profile.promoSupport * 0.38), 0, 1);
    const loyaltyFit = clamp(((1 - profile.compPressure) * 0.58) + (profile.socialMomentum * 0.3) + (Math.max(0, profile.wowUnitsPct) * 0.12), 0, 1);
    const trialFit = clamp((profile.valueScore * 0.68) + (profile.promoSupport * 0.32), 0, 1);

    const affinityRaw =
      (weights.value * profile.valueScore) +
      (weights.premium * profile.premiumScore) +
      (weights.trend * trendFit) +
      (weights.promo * promoFit) +
      (weights.loyalty * loyaltyFit) +
      (weights.channelSwitch * profile.channelSwitchFit) +
      (weights.trial * trialFit) +
      (weights.routine * routineFit);

    return { ...profile, routineFit, trendFit, promoFit, loyaltyFit, trialFit, affinityRaw };
  });

  const affinityTotal = Math.max(0.0001, scored.reduce((sum, row) => sum + row.affinityRaw, 0));
  scored.forEach(row => {
    row.affinityShare = row.affinityRaw / affinityTotal;
    const competitionEffect = row.compPressure * 0.32;
    const socialEffect = (0.5 - row.socialMomentum) * 0.24;
    const promoEffect = Math.max(0, promoSensitivity - row.promoSupport) * 0.22;
    const trendEffect = Math.max(0, -row.wowUnitsPct) * 0.14;
    row.riskMultiplier = clamp(1 + competitionEffect + socialEffect + promoEffect + trendEffect, 0.72, 1.85);
    row.lossEstimate = Math.max(0, atRiskCustomers * row.affinityShare * row.riskMultiplier);
    row.recoverableCustomers = row.lossEstimate * clamp(0.16 + (row.promoFit * 0.36) + (row.compPressure * 0.18), 0.08, 0.66);
    row.channelFocus = getWatchlistChannelFocusLabel(row);
    row.action = getWatchlistSkuAction(row, promoSensitivity, entry);
  });

  scored.sort((a, b) => b.lossEstimate - a.lossEstimate);
  const topSkus = scored.slice(0, 4);
  const topLossTotal = Math.max(0.0001, topSkus.reduce((sum, row) => sum + row.lossEstimate, 0));
  const weighted = fn => topSkus.reduce((sum, row) => sum + (fn(row) * (row.lossEstimate / topLossTotal)), 0);

  const competitionIndex = weighted(row => row.compPressure);
  const socialIndex = weighted(row => row.socialMomentum);
  const promoGapIndex = weighted(row => Math.max(0, promoSensitivity - row.promoSupport));

  const baseDriver = atRiskCustomers;
  const competitionDriver = atRiskCustomers * (0.1 + (competitionIndex * 0.24));
  const socialDriver = atRiskCustomers * ((0.5 - socialIndex) * 0.2);
  const promoDriver = atRiskCustomers * promoGapIndex * 0.2;
  const projectedNet = Math.max(0, baseDriver + competitionDriver + socialDriver + promoDriver);

  return {
    currentWeek: context.currentWeek,
    atRiskCustomers,
    promoSensitivity,
    repeatSensitivity,
    projectedNet,
    topSkus,
    drivers: [
      { key: 'base', label: 'Base repeat-loss risk', value: baseDriver, color: 'secondary' },
      { key: 'competition', label: 'Competitive price pressure', value: competitionDriver, color: 'danger' },
      { key: 'social', label: 'Social momentum effect', value: socialDriver, color: socialDriver >= 0 ? 'warning' : 'success' },
      { key: 'promo_gap', label: 'Promo mismatch vs elasticity', value: promoDriver, color: 'danger' }
    ]
  };
}

function updateSegmentDetailFromWatchlist(entry, drilldown) {
  const titleEl = document.getElementById('segment-detail-title');
  const bodyEl = document.getElementById('segment-detail-body');
  if (!titleEl || !bodyEl || !entry) return;

  const topSkus = (drilldown?.topSkus || []).slice(0, 2).map(row => row.sku_name).join(', ');
  titleEl.textContent = `Watchlist focus: ${entry.labelParts.join(' • ')}`;
  bodyEl.innerHTML = `
    <div>
      Current price-point risk in week ${drilldown?.currentWeek || '--'} is <strong>${(entry.repeatLoss * 100).toFixed(1)}%</strong>
      (${Math.round(entry.atRiskCustomers).toLocaleString()} customers). ${topSkus ? `Most exposed SKUs: ${topSkus}.` : ''}
    </div>
  `;
}

function renderWatchlistDrilldown(entry, drilldown, containerEl) {
  if (!containerEl) return;
  if (!entry || !drilldown) {
    containerEl.innerHTML = `
      <div class="text-center py-4 text-body-secondary small">
        <i class="bi bi-hourglass-split fs-5 d-block mb-1"></i>
        SKU drilldown is loading...
      </div>
    `;
    return;
  }

  const riskPct = entry.repeatLoss * 100;
  const riskBand = getWatchlistRiskBandMeta(riskPct);
  const driverMax = Math.max(1, ...drilldown.drivers.map(driver => Math.abs(driver.value)));
  const segmentChips = [
    `<span class="badge text-bg-light border">${entry.acquisitionLabel}</span>`,
    `<span class="badge text-bg-light border">${entry.engagementLabel}</span>`,
    `<span class="badge text-bg-light border">${entry.monetizationLabel}</span>`
  ].join('');

  const skuRiskBars = drilldown.topSkus.slice(0, 3).map(row => {
    const width = clamp((row.lossEstimate / Math.max(1, drilldown.topSkus[0]?.lossEstimate || 1)) * 100, 6, 100);
    return `
      <div class="mb-2">
        <div class="d-flex justify-content-between small">
          <span>${row.sku_name}</span>
          <span class="text-body-secondary">${Math.round(row.lossEstimate).toLocaleString()} customers</span>
        </div>
        <div class="progress rounded-pill">
          <div class="progress-bar bg-danger" role="progressbar" style="width: ${width}%;"></div>
        </div>
      </div>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
      <div class="small text-body-secondary">Drilldown: specific SKUs this cohort is likely to churn on</div>
      <span class="badge bg-${riskBand.color}-subtle text-${riskBand.color}-emphasis">${riskPct.toFixed(1)}% at risk</span>
    </div>
    <div class="d-flex flex-wrap gap-1 mb-2">${segmentChips}</div>

    <div class="row g-2 mb-2">
      <div class="col-6 col-lg-3">
        <div class="watchlist-kpi h-100">
          <div class="label">Customers</div>
          <div class="value">${entry.customers.toLocaleString()}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="watchlist-kpi h-100">
          <div class="label">At-Risk Now</div>
          <div class="value">${Math.round(drilldown.atRiskCustomers).toLocaleString()}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="watchlist-kpi h-100">
          <div class="label">Promo Sensitivity</div>
          <div class="value">${drilldown.promoSensitivity.toFixed(2)}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="watchlist-kpi h-100">
          <div class="label">Projected Net Risk</div>
          <div class="value">${Math.round(drilldown.projectedNet).toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="small text-body-secondary mb-2">
      Modeled at week ${drilldown.currentWeek} effective prices, competitor website deltas, and current social signal.
    </div>

    <div class="mb-2">${skuRiskBars}</div>

    <div class="table-responsive mb-2">
      <table class="table table-sm watchlist-sku-table mb-0">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Channel Focus</th>
            <th class="text-end">Comp Gap</th>
            <th class="text-end">Social</th>
            <th class="text-end">At-Risk</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${drilldown.topSkus.map(row => `
            <tr>
              <td>
                <div class="watchlist-sku-name">${row.sku_name}</div>
                <div class="text-body-secondary">${formatProductGroupLabel(row.product_group)}</div>
              </td>
              <td>${row.channelFocus}</td>
              <td class="text-end ${row.avgGapPct > 0 ? 'text-danger' : 'text-success'}">${(row.avgGapPct * 100).toFixed(1)}%</td>
              <td class="text-end">${row.avgSocial.toFixed(1)}</td>
              <td class="text-end">${Math.round(row.lossEstimate).toLocaleString()}</td>
              <td>${row.action}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div>
      ${drilldown.drivers.map(driver => {
        const width = clamp((Math.abs(driver.value) / driverMax) * 100, 8, 100);
        const sign = driver.key === 'base' ? '' : (driver.value >= 0 ? '+' : '');
        return `
          <div class="watchlist-driver-row mb-2">
            <div class="d-flex justify-content-between small">
              <span>${driver.label}</span>
              <span class="text-${driver.color}">${sign}${Math.round(driver.value).toLocaleString()} customers</span>
            </div>
            <div class="progress rounded-pill">
              <div class="progress-bar bg-${driver.color}" role="progressbar" style="width: ${width}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function updateCohortWatchlist() {
  const badge = document.getElementById('segment-watchlist-badge');
  const body = document.getElementById('segment-watchlist-body');
  const drilldownEl = document.getElementById('segment-watchlist-drilldown');
  if (!badge || !body || !window.segmentEngine || !window.segmentEngine.isDataLoaded()) return;

  const tier = document.getElementById('segment-tier-select')?.value || 'ad_free';
  const filters = {
    acquisition: getActivePillValues('acquisition-filters'),
    engagement: getActivePillValues('engagement-filters'),
    monetization: getActivePillValues('monetization-filters')
  };

  const segments = window.segmentEngine.filterSegments(filters).filter(s => s.tier === tier);
  if (!segments.length) {
    selectedWatchlistCompositeKey = null;
    badge.textContent = '0';
    body.innerHTML = `
      <div class="text-center py-3 text-body-secondary small">
        <i class="bi bi-inbox fs-4 d-block mb-1"></i>
        No cohorts match the current filters.
      </div>
    `;
    if (drilldownEl) {
      drilldownEl.innerHTML = `
        <div class="text-center py-4 text-body-secondary small">
          <i class="bi bi-funnel fs-5 d-block mb-1"></i>
          Expand filters to bring back cohort drilldown.
        </div>
      `;
    }
    return;
  }

  const scored = segments.map(seg => {
    const customers = parseInt(seg.customer_count || 0);
    const repeatLoss = parseFloat(seg.repeat_loss_rate || 0);
    const atRiskCustomers = customers * repeatLoss;
    const score = atRiskCustomers;
    const segmentData = window.segmentEngine.getSegmentData(seg.compositeKey, tier) || null;
    const promoElasticity = Math.abs(
      Number(segmentData?.acquisition_axis?.elasticity) ||
      Number(window.segmentEngine.getElasticity(tier, seg.compositeKey, 'acquisition')) ||
      1.8
    );
    const repeatElasticity = Math.abs(
      Number(segmentData?.repeat_loss_axis?.elasticity) ||
      Number(window.segmentEngine.getElasticity(tier, seg.compositeKey, 'engagement')) ||
      0.8
    );

    return {
      compositeKey: seg.compositeKey,
      label: window.segmentEngine.formatCompositeKey(seg.compositeKey),
      labelParts: [
        window.segmentEngine.formatSegmentLabel(seg.acquisition),
        window.segmentEngine.formatSegmentLabel(seg.engagement),
        window.segmentEngine.formatSegmentLabel(seg.monetization)
      ],
      acquisition: seg.acquisition,
      engagement: seg.engagement,
      monetization: seg.monetization,
      acquisitionLabel: window.segmentEngine.formatSegmentLabel(seg.acquisition),
      engagementLabel: window.segmentEngine.formatSegmentLabel(seg.engagement),
      monetizationLabel: window.segmentEngine.formatSegmentLabel(seg.monetization),
      customers,
      repeatLoss,
      atRiskCustomers,
      promoElasticity,
      repeatElasticity,
      profileWeights: segmentData?.profile_weights || null,
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  badge.textContent = `Top ${top.length} at risk`;

  if (!selectedWatchlistCompositeKey || !top.some(item => item.compositeKey === selectedWatchlistCompositeKey)) {
    selectedWatchlistCompositeKey = top[0].compositeKey;
  }

  const hasContext = !!(cohortWatchlistContext?.skuProfiles?.length);
  if (!hasContext && !cohortWatchlistContextPromise) {
    ensureCohortWatchlistContextLoaded().then(() => updateCohortWatchlist());
  }

  const topWithDrilldown = top.map(item => ({
    ...item,
    drilldown: hasContext ? computeCohortSkuDrilldown(item, cohortWatchlistContext) : null
  }));

  body.innerHTML = topWithDrilldown.map((item, i) => {
    const rank = i + 1;
    const pct = item.repeatLoss * 100;
    const riskBand = getWatchlistRiskBandMeta(pct);
    const isActive = item.compositeKey === selectedWatchlistCompositeKey;
    const topSkuChips = item.drilldown?.topSkus?.slice(0, 2).map(row => `
      <span class="watchlist-sku-chip">${row.sku_name}</span>
    `).join('') || '<span class="text-body-secondary small">Loading SKU mapping...</span>';

    return `
      <button
        type="button"
        class="cohort-watchlist-item ${isActive ? 'active' : ''}"
        data-watchlist-key="${item.compositeKey}"
        title="Customer group: ${item.label}&#10;Customers: ${item.customers.toLocaleString()}&#10;At risk now: ${pct.toFixed(1)}%"
      >
        <div class="d-flex align-items-start gap-2">
          <span class="cohort-rank badge rounded-circle flex-shrink-0 ${rank <= 2 ? 'bg-danger' : rank === 3 ? 'bg-warning text-dark' : 'bg-secondary'}">${rank}</span>
          <div class="flex-grow-1 min-w-0">
            <div class="small fw-semibold text-body-emphasis mb-1">
              ${item.labelParts.join(' &middot; ')}
            </div>
            <div class="d-flex flex-wrap align-items-center gap-1 mb-1">
              <span class="badge bg-${riskBand.color}-subtle text-${riskBand.color}-emphasis">${pct.toFixed(1)}% at risk</span>
              <span class="badge text-bg-light border watchlist-at-risk-count">${Math.round(item.atRiskCustomers).toLocaleString()} customers</span>
            </div>
            <div class="progress rounded-pill mb-1" style="height: 8px;" title="${riskBand.label}">
              <div class="progress-bar bg-${riskBand.color}" role="progressbar" style="width: ${Math.min(pct * 4, 100)}%;"></div>
            </div>
            <div class="d-flex flex-wrap gap-1 align-items-center">
              ${topSkuChips}
            </div>
          </div>
        </div>
      </button>
    `;
  }).join('');

  body.querySelectorAll('[data-watchlist-key]').forEach(button => {
    button.addEventListener('click', () => {
      selectedWatchlistCompositeKey = button.getAttribute('data-watchlist-key');
      updateCohortWatchlist();
    });
  });

  const selectedEntry =
    topWithDrilldown.find(item => item.compositeKey === selectedWatchlistCompositeKey) ||
    topWithDrilldown[0];
  renderWatchlistDrilldown(selectedEntry, selectedEntry?.drilldown, drilldownEl);
  updateSegmentDetailFromWatchlist(selectedEntry, selectedEntry?.drilldown);
}

/**
 * Update filter summary stats
 */
function updateFilterSummary() {
  const filters = {
    acquisition: getActivePillValues('acquisition-filters'),
    engagement: getActivePillValues('engagement-filters'),
    monetization: getActivePillValues('monetization-filters')
  };

  const tier = document.getElementById('segment-tier-select').value;
  const filteredSegments = window.segmentEngine.filterSegments(filters);
  const tierSegments = filteredSegments.filter(s => s.tier === tier);

  const totalSubs = tierSegments.reduce((sum, s) => sum + parseInt(s.customer_count || 0), 0);

  const statsElement = document.getElementById('filter-stats');
  if (tierSegments.length === window.segmentEngine.getSegmentsForTier(tier).length) {
    statsElement.textContent = 'All segments';
  } else {
    statsElement.innerHTML = `
      ${tierSegments.length} segments,
      ${totalSubs.toLocaleString()} customers
    `;
  }
}

/**
 * Export segments to CSV
 */
function exportSegmentsToCSV() {
  const tier = document.getElementById('segment-tier-select').value;
  const segments = window.segmentEngine.getSegmentsForTier(tier);
  const cohort = window.segmentEngine.getActiveCohort();

  const headers = [
    'Composite Key',
    'Acquisition',
    'Engagement',
    'Monetization',
    'Customers',
    'Repeat Loss',
    'Avg Order Value',
    'Elasticity'
  ];

  const rows = segments.map(seg => {
    const elasticity = window.segmentEngine.getElasticity(tier, seg.compositeKey, 'engagement');
    return [
      seg.compositeKey,
      seg.acquisition,
      seg.engagement,
      seg.monetization,
      seg.customer_count,
      seg.repeat_loss_rate,
      seg.avg_order_value,
      elasticity
    ];
  });

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `segments-${tier}-${cohort}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export visualization to SVG
 */
function exportVisualizationToSVG(containerId, filename) {
  const container = document.getElementById(containerId);
  const svg = container.querySelector('svg');

  if (!svg) {
    alert('No SVG visualization found to export');
    return;
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `visualization-${new Date().toISOString().slice(0, 10)}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Initialize export buttons
 */
function initializeExportButtons() {
  document.getElementById('export-segments-csv')?.addEventListener('click', exportSegmentsToCSV);
  document.getElementById('export-viz-svg')?.addEventListener('click', () => {
    const vizType = document.getElementById('segment-viz-select').value;
    let containerId;
    switch(vizType) {
      case '3axis':
        containerId = 'three-axis-radial-viz';
        break;
      case 'scatter':
        containerId = 'segment-scatter-plot';
        break;
      case 'channel':
        containerId = 'channel-elasticity-bar';
        break;
      default:
        containerId = 'segment-elasticity-heatmap';
    }
    exportVisualizationToSVG(containerId, `segment-viz-${vizType}.svg`);
  });
}

// Initialize app
async function init() {
  applyPromotionCopySweep();

  // Add event listeners
  document.getElementById('load-data-btn')?.addEventListener('click', loadData);
  // Old simulate-btn and save-scenario-btn removed - using tabbed interface now
  document.getElementById('save-scenario-btn-models')?.addEventListener('click', saveScenario);
  document.getElementById('compare-btn')?.addEventListener('click', compareScenarios);
  document.getElementById('clear-scenarios-btn')?.addEventListener('click', clearScenarios);

  // Chat event listeners
  document.getElementById('configure-llm')?.addEventListener('click', async () => {
    await configureLLM();
    refreshLlmStatuses(true);
  });
  document.getElementById('chat-send-btn')?.addEventListener('click', handleChatSend);
  document.getElementById('chat-reset-btn')?.addEventListener('click', () => {
    clearHistory();
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  });
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    });
  }

  // Suggested query buttons
  document.querySelectorAll('.suggested-query').forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.textContent.trim();
      document.getElementById('chat-input').value = query;
      handleChatSend();
    });
  });

  initializeLlmAssistPanels();

  // Initialize popovers (will be initialized again after data loads)
  initializePopovers();
  initializeCommercialContextTabs();

  // Scenario editor event listeners
  document.getElementById('edit-new-price')?.addEventListener('input', updatePriceChangeIndicator);
  document.getElementById('save-edited-scenario-btn')?.addEventListener('click', saveEditedScenario);

  // Make loadData available globally so it can be called when navigating to step 1
  window.loadAppData = loadData;
  window.dataLoaded = false;
}

// Start app
init().catch(error => {
  console.error('Failed to initialize app:', error);
  alert('Failed to load application. Please check console for details.');
});

/**
 * Populate scenarios into elasticity model tabs
 * Filters scenarios by model_type and displays them in respective tabs
 */
function populateElasticityModelTabs() {
  const scenarios = allScenarios;
  if (!scenarios || scenarios.length === 0) {
    console.error('No scenarios loaded');
    return;
  }

  // Filter scenarios by model type
  const acquisitionScenarios = scenarios.filter(s => s.model_type === 'acquisition');
  const churnScenarios = scenarios.filter(s => s.model_type === 'churn');
  const migrationScenarios = scenarios.filter(s => s.model_type === 'migration');

  console.log(`Populating tabs: Acquisition(${acquisitionScenarios.length}), Churn(${churnScenarios.length}), Migration(${migrationScenarios.length})`);

  // Populate acquisition tab
  const acquisitionContainer = document.getElementById('acquisition-scenarios');
  if (acquisitionContainer) {
    acquisitionContainer.innerHTML = acquisitionScenarios.length
      ? acquisitionScenarios.map(scenario => createScenarioCard(scenario)).join('')
      : '<div class="col-12"><div class="alert alert-warning mb-0 small">No in-season scenarios configured yet.</div></div>';
  }

  // Populate churn tab
  const churnContainer = document.getElementById('churn-scenarios');
  if (churnContainer) {
    churnContainer.innerHTML = churnScenarios.length
      ? churnScenarios.map(scenario => createScenarioCard(scenario)).join('')
      : '<div class="col-12"><div class="alert alert-warning mb-0 small">No markdown/repeat-risk scenarios configured yet.</div></div>';
  }

  // Populate migration tab with custom order
  const migrationContainer = document.getElementById('migration-scenarios');
  let sortedMigration = migrationScenarios;
  if (migrationContainer) {
    // Custom order aligned to portfolio migration story
    const migrationOrder = ['scenario_007', 'scenario_008', 'scenario_009'];
    sortedMigration = [...migrationScenarios].sort((a, b) => {
      const indexA = migrationOrder.indexOf(a.id);
      const indexB = migrationOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    migrationContainer.innerHTML = sortedMigration.length
      ? sortedMigration.map(scenario => createScenarioCard(scenario)).join('')
      : '<div class="col-12"><div class="alert alert-warning mb-0 small">No migration/cannibalization scenarios configured yet.</div></div>';
  }

  // Add click handlers for scenario cards
  document.querySelectorAll('.scenario-card-tab').forEach(card => {
    card.addEventListener('click', function(e) {
      // Don't select if clicking edit button
      if (e.target.closest('.edit-scenario-btn-tab')) return;

      const pane = this.closest('.tab-pane');
      if (pane) {
        pane.querySelectorAll('.scenario-card-tab').forEach(c => c.classList.remove('selected'));
      }
      this.classList.add('selected');

      const scenarioId = this.dataset.scenarioId;
      const selected = scenarios.find(s => s.id === scenarioId);
      if (selected) {
        selectedScenarioByModel[selected.model_type] = selected;
        if (selected.model_type !== activeModelType) {
          setActiveModelType(selected.model_type);
        } else {
          selectedScenario = selected;
        }
        updateSimulateButtonState();
        updateAdvancedScenarioStatePanels();
        console.log('Selected scenario:', scenarioId);
      }
    });
  });

  // Ensure each model has a default selected scenario if available
  if (!selectedScenarioByModel.acquisition && acquisitionScenarios[0]) {
    selectedScenarioByModel.acquisition = acquisitionScenarios[0];
  }
  if (!selectedScenarioByModel.churn && churnScenarios[0]) {
    selectedScenarioByModel.churn = churnScenarios[0];
  }
  if (!selectedScenarioByModel.migration && sortedMigration[0]) {
    selectedScenarioByModel.migration = sortedMigration[0];
  }

  // Restore selected card states in each pane
  document.querySelectorAll('.scenario-card-tab').forEach(card => {
    const scenarioId = card.dataset.scenarioId;
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    const selectedByModel = selectedScenarioByModel[scenario.model_type];
    if (selectedByModel && selectedByModel.id === scenarioId) {
      card.classList.add('selected');
    }
  });

  selectedScenario = selectedScenarioByModel[activeModelType] || null;
  updateSimulateButtonState();

  // Add click handlers for edit buttons in tabs
  document.querySelectorAll('.edit-scenario-btn-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const scenarioId = btn.dataset.scenarioId;
      openScenarioEditor(scenarioId);
    });
  });

  // Add decision engine event listeners (RFP Slide 18)
  const objectiveLensSelect = document.getElementById('objective-lens-select');
  if (objectiveLensSelect) {
    objectiveLensSelect.onchange = (e) => {
      const description = getObjectiveDescription(e.target.value);
      document.getElementById('objective-description').textContent = description;
      updateRecommendationBrief();
    };
  }

  const rankScenariosBtn = document.getElementById('rank-scenarios-btn');
  if (rankScenariosBtn) {
    rankScenariosBtn.onclick = rankAndDisplayScenarios;
  }

  const recommendScenarioBtn = document.getElementById('recommend-scenario-btn');
  if (recommendScenarioBtn) {
    recommendScenarioBtn.onclick = recommendBestScenario;
  }

  // Export button event listeners
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      try {
        exportPdfBtn.disabled = true;
        exportPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating PDF...';

        // Get current top 3 scenarios from the UI
        const top3Container = document.getElementById('top-scenarios-list');
        const currentTop3 = window.currentTop3ScenariosByModel?.[activeModelType] || [];
        if (!top3Container || currentTop3.length === 0) {
          alert('Please rank scenarios first to generate a decision pack.');
          return;
        }

        const objective = document.getElementById('objective-lens-select').value;

        await exportToPDF(currentTop3, objective, {});

      } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error generating PDF: ' + error.message);
      } finally {
        exportPdfBtn.disabled = false;
        exportPdfBtn.innerHTML = '<i class="bi bi-file-pdf me-2"></i>Export to PDF';
      }
    });
  }

  if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener('click', async () => {
      try {
        exportXlsxBtn.disabled = true;
        exportXlsxBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating Excel...';

        // Export all saved scenarios with top 3 highlighted
        if (!savedScenarios || savedScenarios.length === 0) {
          alert('No saved scenarios to export. Please save at least one scenario first.');
          return;
        }

        const currentTop3 = window.currentTop3ScenariosByModel?.[activeModelType] || null;
        await exportToXLSX(savedScenarios, currentTop3);

      } catch (error) {
        console.error('Error exporting XLSX:', error);
        alert('Error generating Excel file: ' + error.message);
      } finally {
        exportXlsxBtn.disabled = false;
        exportXlsxBtn.innerHTML = '<i class="bi bi-file-excel me-2"></i>Export to Excel';
      }
    });
  }

  // Track active model tab for model-scoped state
  document.querySelectorAll('#elasticityTabs .nav-link').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const modelType = getModelTypeFromTabId(e.currentTarget.id);
      setActiveModelType(modelType);
    });
    tab.addEventListener('shown.bs.tab', (e) => {
      const modelType = getModelTypeFromTabId(e.target.id);
      setActiveModelType(modelType);
    });
  });

  // Only auto-detect active tab on first load (when activeModelType is not set)
  // Don't do this on subsequent calls because setActiveModelType is called before populateElasticityModelTabs()
  // Doing auto-detection on every call was causing the active model to be overwritten during step navigation
  // because the tab links weren't being updated, only the tab panes
  if (!activeModelType) {
    const activeTab = document.querySelector('#elasticityTabs .nav-link.active');
    if (activeTab) {
      setActiveModelType(getModelTypeFromTabId(activeTab.id));
    }
  }

  // Add simulate button handler (remove old handler first to prevent duplicates)
  const simulateBtn = document.getElementById('simulate-btn-models');
  if (simulateBtn) {
    // Clone and replace button to remove all event listeners
    const newSimulateBtn = simulateBtn.cloneNode(true);
    simulateBtn.parentNode.replaceChild(newSimulateBtn, simulateBtn);

    newSimulateBtn.addEventListener('click', async function() {
      const activeScenario = selectedScenarioByModel[activeModelType];
      if (!activeScenario) {
        console.warn('⚠️ No scenario selected!');
        return;
      }

      console.log('🎬 Starting simulation for:', activeScenario.id, activeScenario.name);

      const resultContainer = document.getElementById('result-container-models');

      try {
        newSimulateBtn.disabled = true;
        newSimulateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Simulating...';
        const loadingState = startSimulateLoading();

        console.log('📝 Scenario config:', {
          tier: activeScenario.config.tier,
          current_price: activeScenario.config.current_price,
          new_price: activeScenario.config.new_price,
          price_change: activeScenario.config.new_price - activeScenario.config.current_price,
          price_change_pct: ((activeScenario.config.new_price - activeScenario.config.current_price) / activeScenario.config.current_price * 100).toFixed(2) + '%',
          model_type: activeScenario.model_type
        });

        // Run simulation with Pyodide if available, otherwise fallback to JS
        let result;
        if (isPyodideAvailable()) {
          console.log('✅ Using Pyodide Python models');
          newSimulateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Running Python models...';
          result = await simulateScenarioWithPyodide(activeScenario, {
            targetSegment: 'all',
            segmentAxis: null
          });
      } else {
        console.log('⚠️ Pyodide not ready, using JavaScript simulation');
        result = await simulateScenario(activeScenario, {
          targetSegment: 'all',
          segmentAxis: null
        });
      }
      result.model_type = activeScenario.model_type;

      // Debug: Verify result has correct model_type before displaying
      console.log(`🎯 Simulation complete for ${activeScenario.model_type}:`, {
        scenario_id: result.scenario_id,
        model_type: result.model_type,
        activeModelType: activeModelType
      });

      await enrichScenarioWithCommercialContext(result);
      await loadingState.done;
      loadingState.stop();

        resultContainer.style.display = 'block';
        // Display results in the new containers
        displayResultsInTabs(result);
        resultContainer.scrollIntoView({ behavior: 'smooth' });

      } catch (error) {
        console.error('Error simulating scenario:', error);
        alert('Error running simulation: ' + error.message);
      } finally {
        newSimulateBtn.disabled = false;
        newSimulateBtn.innerHTML = '<i class="bi bi-play-fill me-2"></i>Simulate Selected Scenario';
        const loadingEl = document.getElementById('simulate-loading');
        if (loadingEl) loadingEl.style.display = 'none';
      }
    });
  }
  updateAdvancedScenarioStatePanels();
}

// Expose populateElasticityModelTabs globally for step navigation
window.populateElasticityModelTabs = populateElasticityModelTabs;
window.setActiveModelType = setActiveModelType;
window.hideScenarioResults = hideScenarioResults;
window.getCurrentResultForModel = function(modelType) {
  return currentResultByModel[modelType] || null;
};

/**
 * Run promotional scenario through the same JS/Python model pipeline used by the core scenario engine.
 * Exposed globally so step-navigation (non-module script) can invoke model-backed simulations.
 *
 * @param {Object} payload
 * @returns {Promise<Object>} simulation result
 */
async function runPromoScenarioModel(payload = {}) {
  const modelType = String(payload.modelType || 'acquisition');
  const currentPrice = Number(payload.currentPrice);
  const newPrice = Number(payload.newPrice);
  const normalizedCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 24;
  const normalizedNewPrice = Number.isFinite(newPrice) && newPrice > 0 ? newPrice : normalizedCurrentPrice;
  const discountPctRaw = Number(payload.discountPct);
  const discountPct = Number.isFinite(discountPctRaw)
    ? discountPctRaw
    : ((normalizedCurrentPrice - normalizedNewPrice) / normalizedCurrentPrice) * 100;
  const durationMonthsRaw = Number(payload.durationMonths);
  const durationMonths = Number.isFinite(durationMonthsRaw) && durationMonthsRaw > 0 ? durationMonthsRaw : 1;
  const tier = String(payload.tier || 'ad_supported');
  const segmentElasticityRaw = Number(payload.segmentElasticity);
  const segmentElasticity = Number.isFinite(segmentElasticityRaw)
    ? -Math.abs(segmentElasticityRaw)
    : -1.8;

  const scenario = {
    id: payload.id || `promo_${modelType}_${Date.now()}`,
    name: payload.name || `${modelType} promo scenario`,
    description: payload.description || 'Scenario generated from promotion model board controls',
    category: 'promotion',
    model_type: modelType,
    priority: 'medium',
    business_rationale: payload.rationale || 'Evaluate promo tradeoffs with model-backed simulation.',
    config: {
      tier,
      current_price: normalizedCurrentPrice,
      new_price: normalizedNewPrice,
      promotion: {
        discount_pct: discountPct,
        duration_months: durationMonths
      }
    },
    constraints: {
      min_price: 0,
      max_price: Math.max(normalizedCurrentPrice * 2, normalizedNewPrice * 2),
      platform_compliant: true,
      notice_period_30d: true,
      price_change_12mo_limit: true
    }
  };

  let result;
  try {
    if (!isPyodideAvailable()) {
      await initializePyodideModels();
    }
    if (isPyodideAvailable()) {
      result = await simulateScenarioWithPyodide(scenario, {
        targetSegment: 'all',
        segmentAxis: null,
        segmentElasticity
      });
    } else {
      result = await simulateScenario(scenario, {
        targetSegment: 'all',
        segmentAxis: null
      });
    }
  } catch (error) {
    console.warn('Model run fallback to JavaScript simulation due to:', error);
    result = await simulateScenario(scenario, {
      targetSegment: 'all',
      segmentAxis: null
    });
  }

  result.model_type = modelType;
  result.request_payload = {
    ...payload,
    currentPrice: normalizedCurrentPrice,
    newPrice: normalizedNewPrice,
    discountPct,
    durationMonths,
    segmentElasticity
  };

  return result;
}

window.runPromoScenarioModel = runPromoScenarioModel;
window.getScenarioTemplatesByModel = function(modelType) {
  const key = String(modelType || '');
  return (allScenarios || [])
    .filter(scenario => !key || scenario.model_type === key)
    .map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      tier: scenario?.config?.tier || 'ad_supported',
      currentPrice: Number(scenario?.config?.current_price),
      newPrice: Number(scenario?.config?.new_price),
      discountPct: Number(scenario?.config?.promotion?.discount_pct),
      durationMonths: Number(scenario?.config?.promotion?.duration_months) || 1
    }));
};

/**
 * Create scenario card HTML for tabs
 */
function createScenarioCard(scenario) {
  const priorityBadge = {
    'high': '<span class="badge bg-danger">High</span>',
    'medium': '<span class="badge bg-warning">Medium</span>',
    'low': '<span class="badge bg-secondary">Low</span>',
    'n/a': ''
  }[scenario.priority] || '';

  return `
    <div class="col-md-4">
      <div class="card scenario-card-tab h-100" data-scenario-id="${scenario.id}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="card-title mb-0 flex-grow-1">${scenario.name}</h6>
            <div class="scenario-card-actions">
              ${priorityBadge}
              <button class="btn btn-sm btn-outline-secondary edit-scenario-btn-tab ms-1" data-scenario-id="${scenario.id}" title="Edit parameters">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </div>
          <p class="card-text small text-muted mb-2">${scenario.description}</p>
          <div class="small text-muted">
            <i class="bi bi-lightbulb me-1"></i>
            ${scenario.business_rationale}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Calculate acquisition payback period (RFP Slide 15)
 * Payback = Months to recover customer acquisition cost through revenue
 * Formula: CAC / (AOV - marginal costs)
 */
function calculateAcquisitionPayback(result) {
  try {
    // Estimate CAC based on retail DTC benchmarks ($20-45)
    // For promos, CAC is higher due to discount
    const isPromo = result.scenario_config?.promotional_status === true;
    const baseCAC = 35; // Industry median
    const promoCACMultiplier = isPromo ? 1.4 : 1.0;
    const estimatedCAC = baseCAC * promoCACMultiplier;

    // Monthly contribution margin = AOV - marginal costs (~30% of AOV for fulfillment/marketing)
    const aov = result.forecasted.aov || 0;
    const marginPercent = 0.70; // 70% contribution margin
    const monthlyContribution = aov * marginPercent;

    if (monthlyContribution <= 0) {
      return { value: 'N/A', label: 'Negative margin' };
    }

    const paybackMonths = estimatedCAC / monthlyContribution;

    // Format output
    if (paybackMonths > 24) {
      return { value: '>24', label: 'months' };
    } else if (paybackMonths < 1) {
      return { value: '<1', label: 'month' };
    } else {
      return { value: paybackMonths.toFixed(1), label: 'months' };
    }
  } catch (error) {
    console.error('Error calculating acquisition payback:', error);
    return { value: 'N/A', label: 'calc error' };
  }
}

/**
 * Calculate churn payback period (RFP Slide 16)
 * Churn Payback = Weeks until churn rate stabilizes after price change
 * Based on time-lagged churn model: 0-4, 4-8, 8-12, 12+ weeks
 */
function calculateChurnPayback(result) {
  try {
    // Check if we have time-lagged churn data
    const churnData = result.forecasted.repeat_loss_by_weeks || result.repeat_loss_by_weeks;

    if (churnData) {
      // Find when churn stabilizes (delta < 10% of peak)
      const weeks_0_4 = churnData.weeks_0_4 || 0;
      const weeks_4_8 = churnData.weeks_4_8 || 0;
      const weeks_8_12 = churnData.weeks_8_12 || 0;
      const weeks_12plus = churnData.weeks_12plus || 0;

      const peak = Math.max(weeks_0_4, weeks_4_8, weeks_8_12, weeks_12plus);
      const threshold = peak * 0.1;

      if (weeks_0_4 <= threshold) return { value: '<4', label: 'weeks' };
      if (weeks_4_8 <= threshold) return { value: '4-8', label: 'weeks' };
      if (weeks_8_12 <= threshold) return { value: '8-12', label: 'weeks' };
      return { value: '12+', label: 'weeks' };
    }

    // Fallback: Estimate based on churn delta magnitude
    const churnDelta = Math.abs(result.delta.repeat_loss_rate || 0);

    if (churnDelta < 0.01) {
      // Low impact: stabilizes quickly
      return { value: '<4', label: 'weeks' };
    } else if (churnDelta < 0.03) {
      // Medium impact: stabilizes in 4-8 weeks
      return { value: '4-8', label: 'weeks' };
    } else if (churnDelta < 0.05) {
      // High impact: stabilizes in 8-12 weeks
      return { value: '8-12', label: 'weeks' };
    } else {
      // Very high impact: takes 12+ weeks
      return { value: '12+', label: 'weeks' };
    }
  } catch (error) {
    console.error('Error calculating churn payback:', error);
    return { value: 'N/A', label: 'calc error' };
  }
}

function buildCommercialScenarioContext(result, skuRows, socialRows, liveSnapshot) {
  if (!result || !Array.isArray(skuRows) || skuRows.length === 0) {
    return null;
  }

  const scope = resolveCommercialScopeFromScenario(result, skuRows, liveSnapshot);
  const {
    selectedGroup,
    selectedSku,
    applyMass,
    applyPrestige,
    currentWeek: scopedCurrentWeek,
    horizonWeek,
    scenarioStartWeek: rawScenarioStartWeek,
    description: scopeDescription,
    effectiveDate
  } = scope;

  const filteredRows = skuRows.filter(row => {
    const week = safeNumber(row.week_of_season, 0);
    if (week <= 0 || week > horizonWeek) return false;
    if (selectedGroup !== 'all' && row.product_group !== selectedGroup) return false;
    if (selectedSku !== 'all' && row.sku_id !== selectedSku) return false;
    if (row.channel_group === 'mass' && !applyMass) return false;
    if (row.channel_group === 'prestige' && !applyPrestige) return false;
    return true;
  });

  if (!filteredRows.length) {
    return null;
  }

  const weekly = new Map();
  filteredRows.forEach(row => {
    const week = safeNumber(row.week_of_season, 0);
    if (!weekly.has(week)) {
      weekly.set(week, {
        week,
        date: row.week_start || row.date,
        units: 0,
        revenue: 0,
        endInventory: 0,
        startInventory: 0,
        elasticityWeightedSum: 0,
        elasticityWeight: 0
      });
    }
    const bucket = weekly.get(week);
    const units = safeNumber(row.net_units_sold, 0);
    const revenue = safeNumber(row.revenue, 0);
    const weight = Math.max(units, 1);
    bucket.units += units;
    bucket.revenue += revenue;
    bucket.endInventory += safeNumber(row.end_inventory_units, 0);
    if (week === 1) {
      bucket.startInventory += safeNumber(row.start_inventory_units, 0);
    }
    bucket.elasticityWeightedSum += safeNumber(row.base_elasticity, 0) * weight;
    bucket.elasticityWeight += weight;
  });

  const currentWeek = Math.min(
    safeNumber(
      scopedCurrentWeek,
      safeNumber(
        filteredRows.find(row => safeBoolean(row.is_current_week, false))?.week_of_season,
        [...weekly.keys()].reduce((max, week) => Math.max(max, week), 1)
      )
    ),
    horizonWeek
  );
  const checkpointWeek = Math.min(5, horizonWeek);
  const scenarioStartWeek = horizonWeek > checkpointWeek
    ? clamp(Math.max(rawScenarioStartWeek || currentWeek, checkpointWeek + 1), checkpointWeek + 1, horizonWeek)
    : checkpointWeek;
  const seasonStartInventory = safeNumber(weekly.get(1)?.startInventory, 0);

  let cumulativeUnits = 0;
  let cumulativeRevenue = 0;
  const cumulativeUnitsByWeek = new Map();
  const cumulativeRevenueByWeek = new Map();
  for (let week = 1; week <= horizonWeek; week += 1) {
    cumulativeUnits += safeNumber(weekly.get(week)?.units, 0);
    cumulativeRevenue += safeNumber(weekly.get(week)?.revenue, 0);
    cumulativeUnitsByWeek.set(week, cumulativeUnits);
    cumulativeRevenueByWeek.set(week, cumulativeRevenue);
  }

  const checkpointUnits = safeNumber(cumulativeUnitsByWeek.get(checkpointWeek), 0);
  const checkpointRevenue = safeNumber(cumulativeRevenueByWeek.get(checkpointWeek), 0);
  const checkpointInventory = safeNumber(weekly.get(checkpointWeek)?.endInventory, 0);
  const currentUnits = safeNumber(cumulativeUnitsByWeek.get(currentWeek), checkpointUnits);
  const currentRevenue = safeNumber(cumulativeRevenueByWeek.get(currentWeek), checkpointRevenue);
  const currentInventory = safeNumber(weekly.get(currentWeek)?.endInventory, checkpointInventory);
  const anchorUnits = safeNumber(cumulativeUnitsByWeek.get(checkpointWeek), 0);
  const anchorRevenue = safeNumber(cumulativeRevenueByWeek.get(checkpointWeek), 0);
  const anchorInventory = safeNumber(weekly.get(checkpointWeek)?.endInventory, 0);
  const remainingEntries = [...weekly.values()]
    .filter(entry => entry.week > checkpointWeek)
    .sort((a, b) => a.week - b.week);
  const baselineRemainingUnits = remainingEntries.reduce((sum, entry) => sum + safeNumber(entry.units, 0), 0);
  const baselineRemainingRevenue = remainingEntries.reduce((sum, entry) => sum + safeNumber(entry.revenue, 0), 0);
  const baselinePreScenarioUnits = remainingEntries
    .filter(entry => entry.week < scenarioStartWeek)
    .reduce((sum, entry) => sum + safeNumber(entry.units, 0), 0);
  const baselinePreScenarioRevenue = remainingEntries
    .filter(entry => entry.week < scenarioStartWeek)
    .reduce((sum, entry) => sum + safeNumber(entry.revenue, 0), 0);
  const baselineScenarioWindowUnits = remainingEntries
    .filter(entry => entry.week >= scenarioStartWeek)
    .reduce((sum, entry) => sum + safeNumber(entry.units, 0), 0);
  const baselineScenarioWindowRevenue = remainingEntries
    .filter(entry => entry.week >= scenarioStartWeek)
    .reduce((sum, entry) => sum + safeNumber(entry.revenue, 0), 0);

  const config = getScenarioConfigFromResult(result);
  const currentPrice = safeNumber(config.current_price, safeNumber(result?.baseline?.aov, 0));
  const newPrice = safeNumber(config.new_price, safeNumber(result?.forecasted?.aov, currentPrice));
  const priceMovePct = currentPrice > 0 ? (newPrice - currentPrice) / currentPrice : 0;
  const priceRatio = currentPrice > 0 ? newPrice / currentPrice : 1;

  const currentWeekElasticityEntry = weekly.get(currentWeek);
  const fallbackElasticity = currentWeekElasticityEntry?.elasticityWeight
    ? currentWeekElasticityEntry.elasticityWeightedSum / currentWeekElasticityEntry.elasticityWeight
    : -1.8;
  const baseElasticity = safeNumber(result.elasticity, fallbackElasticity || -1.8);

  const getSocialScoreForWeek = (week) => {
    const seasonDate = weekly.get(week)?.date || null;
    if (seasonDate) {
      const exact = socialRows.find(row => row.week_start === seasonDate || row.date === seasonDate);
      if (exact) {
        return normalizeSocialScore(exact.brand_social_index ?? exact.social_sentiment);
      }
    }
    const idx = clamp(week - 1, 0, socialRows.length - 1);
    const row = socialRows[idx];
    return normalizeSocialScore(row?.brand_social_index ?? row?.social_sentiment);
  };

  const checkpointSocialScores = [];
  for (let week = 1; week <= checkpointWeek; week += 1) {
    const score = getSocialScoreForWeek(week);
    if (Number.isFinite(score)) checkpointSocialScores.push(score);
  }
  const neutralSocialScore = checkpointSocialScores.length
    ? checkpointSocialScores.reduce((sum, score) => sum + score, 0) / checkpointSocialScores.length
    : 60;
  const currentSocialScore = asFiniteNumber(getSocialScoreForWeek(currentWeek)) ?? neutralSocialScore;
  const priorSocialScore = asFiniteNumber(getSocialScoreForWeek(Math.max(1, currentWeek - 1))) ?? neutralSocialScore;
  const socialTrendDelta = currentSocialScore - priorSocialScore;

  const neutralElasticity = baseElasticity * socialElasticityModifier(neutralSocialScore);
  const neutralDemand = socialDemandMultiplier(neutralSocialScore);

  const scenarioUnitMultiplier = clamp(
    Number.isFinite(result?.delta?.customers_pct)
      ? 1 + (safeNumber(result.delta.customers_pct, 0) / 100)
      : Math.pow(priceRatio || 1, baseElasticity || -1.8),
    0.45,
    1.9
  );
  const scenarioRevenueMultiplier = clamp(
    Number.isFinite(result?.delta?.revenue_pct)
      ? 1 + (safeNumber(result.delta.revenue_pct, 0) / 100)
      : scenarioUnitMultiplier * priceRatio,
    0.45,
    2.4
  );

  function computeStateForScore(label, score, variant = 'generic') {
    const normalizedScore = clamp(safeNumber(score, neutralSocialScore), 35, 95);
    const scenarioElasticity = baseElasticity * socialElasticityModifier(normalizedScore);
    const demandMultiplier = socialDemandMultiplier(normalizedScore);
    const demandRatioVsNeutral = neutralDemand > 0 ? demandMultiplier / neutralDemand : 1;
    const noSocialVolumeMultiplier = Math.pow(priceRatio || 1, baseElasticity || -1.8);
    const withSocialVolumeMultiplier = Math.pow(priceRatio || 1, scenarioElasticity || -1.8) * demandRatioVsNeutral;
    const socialTailwindMultiplier = noSocialVolumeMultiplier !== 0
      ? clamp(withSocialVolumeMultiplier / noSocialVolumeMultiplier, 0.8, 1.4)
      : 1;
    const unitMultiplier = clamp(scenarioUnitMultiplier * socialTailwindMultiplier, 0.4, 2.1);
    const revenueMultiplier = clamp(scenarioRevenueMultiplier * socialTailwindMultiplier, 0.4, 2.6);
    const demandTailwindPct = socialTailwindMultiplier - 1;

    let priceHeadroomPct = 0;
    if (demandRatioVsNeutral > 1 && scenarioElasticity < 0) {
      priceHeadroomPct = clamp(Math.pow(1 / demandRatioVsNeutral, 1 / scenarioElasticity) - 1, 0, 0.25);
    } else if (demandRatioVsNeutral < 1 && scenarioElasticity < 0) {
      priceHeadroomPct = clamp(Math.pow(1 / demandRatioVsNeutral, 1 / scenarioElasticity) - 1, -0.15, 0);
    }

    const projectedRemainingUnits = baselinePreScenarioUnits + (baselineScenarioWindowUnits * unitMultiplier);
    const projectedRemainingRevenue = baselinePreScenarioRevenue + (baselineScenarioWindowRevenue * revenueMultiplier);
    const fullSeasonUnits = anchorUnits + projectedRemainingUnits;
    const fullSeasonRevenue = anchorRevenue + projectedRemainingRevenue;
    const posture = getCommercialPosture(priceHeadroomPct, priceMovePct, normalizedScore - priorSocialScore);

    const chartSeries = [];
    let running = anchorUnits;
    for (let week = 1; week <= horizonWeek; week += 1) {
      if (week < checkpointWeek) {
        chartSeries.push(null);
        continue;
      }
      if (week === checkpointWeek) {
        chartSeries.push(Math.round(anchorUnits));
        continue;
      }
      const weekUnits = safeNumber(weekly.get(week)?.units, 0);
      if (week < scenarioStartWeek) {
        running += weekUnits;
        chartSeries.push(Math.round(running));
        continue;
      }
      const rampFactor = Math.min((week - scenarioStartWeek + 1) / 2, 1);
      const weekMultiplier = 1 + ((unitMultiplier - 1) * rampFactor);
      running += weekUnits * weekMultiplier;
      chartSeries.push(Math.round(running));
    }

    return {
      label,
      variant,
      socialScore: normalizedScore,
      effectiveElasticity: scenarioElasticity,
      demandTailwindPct,
      headroomPct: priceHeadroomPct,
      projectedRemainingUnits,
      projectedRemainingRevenue,
      fullSeasonUnits,
      fullSeasonRevenue,
      posture,
      chartSeries
    };
  }

  const momentumStates = [
    computeStateForScore('Cooling Off', currentSocialScore - 10, 'cooling'),
    computeStateForScore('Neutral Buzz', neutralSocialScore, 'neutral'),
    computeStateForScore('Current Trend', currentSocialScore, 'current'),
    computeStateForScore('Viral Spike', Math.max(currentSocialScore + 12, 82), 'viral')
  ];
  const selectedState = momentumStates.find(state => state.variant === 'current') || momentumStates[2];
  const neutralState = momentumStates.find(state => state.variant === 'neutral') || momentumStates[1];

  const labels = [];
  const actualSeries = [];
  const baselineSeries = [];
  let baselineProjected = anchorUnits;
  for (let week = 1; week <= horizonWeek; week += 1) {
    labels.push(`W${week}`);
    actualSeries.push(week <= checkpointWeek ? Math.round(safeNumber(cumulativeUnitsByWeek.get(week), 0)) : null);
    if (week < checkpointWeek) {
      baselineSeries.push(null);
      continue;
    }
    if (week === checkpointWeek) {
      baselineSeries.push(Math.round(anchorUnits));
      continue;
    }
    baselineProjected += safeNumber(weekly.get(week)?.units, 0);
    baselineSeries.push(Math.round(baselineProjected));
  }

  const summary = `${scopeDescription} has sold ${formatNumber(checkpointUnits)} units by week ${checkpointWeek} (${formatSignedPercentFromRatio(seasonStartInventory > 0 ? checkpointUnits / seasonStartInventory : 0, 1).replace('+', '')} sell-through). The selected scenario turns on in week ${scenarioStartWeek} and changes remaining-season revenue ${formatSignedPercentFromRatio(baselineRemainingRevenue > 0 ? (selectedState.projectedRemainingRevenue / baselineRemainingRevenue) - 1 : 0, 1)} vs baseline, while current social momentum adds ${formatSignedPercentFromRatio(selectedState.demandTailwindPct, 1)} demand support and ${formatSignedPercentFromRatio(selectedState.headroomPct, 1)} pricing headroom.`;

  return {
    filters: {
      selectedGroup,
      selectedSku,
      applyMass,
      applyPrestige,
      description: scopeDescription
    },
    timing: {
      effectiveDate,
      scenarioStartWeek
    },
    checkpoint: {
      week: checkpointWeek,
      actualUnitsSold: checkpointUnits,
      actualRevenue: checkpointRevenue,
      inventoryRemaining: checkpointInventory,
      sellThroughPct: seasonStartInventory > 0 ? checkpointUnits / seasonStartInventory : 0
    },
    anchorPosition: {
      week: checkpointWeek,
      cumulativeUnits: anchorUnits,
      cumulativeRevenue: anchorRevenue,
      inventoryRemaining: anchorInventory
    },
    currentPosition: {
      week: currentWeek,
      cumulativeUnits: currentUnits,
      cumulativeRevenue: currentRevenue,
      inventoryRemaining: currentInventory
    },
    scenarioPrice: {
      currentPrice,
      newPrice,
      priceChangePct: priceMovePct
    },
    projection: {
      currentWeek,
      anchorWeek: checkpointWeek,
      horizonWeek,
      baselineRemainingUnits,
      baselineRemainingRevenue,
      scenarioRemainingUnitsNeutral: neutralState.projectedRemainingUnits,
      scenarioRemainingRevenueNeutral: neutralState.projectedRemainingRevenue,
      scenarioRemainingUnitsSocial: selectedState.projectedRemainingUnits,
      scenarioRemainingRevenueSocial: selectedState.projectedRemainingRevenue,
      fullSeasonBaselineUnits: anchorUnits + baselineRemainingUnits,
      fullSeasonBaselineRevenue: anchorRevenue + baselineRemainingRevenue,
      fullSeasonScenarioUnits: selectedState.fullSeasonUnits,
      fullSeasonScenarioRevenue: selectedState.fullSeasonRevenue,
      scenarioVsBaselineUnitsPct: baselineRemainingUnits > 0 ? (selectedState.projectedRemainingUnits / baselineRemainingUnits) - 1 : 0,
      scenarioVsBaselineRevenuePct: baselineRemainingRevenue > 0 ? (selectedState.projectedRemainingRevenue / baselineRemainingRevenue) - 1 : 0,
      socialStates: momentumStates,
      chart: {
        labels,
        actualSeries,
        baselineSeries,
        scenarioNeutralSeries: neutralState.chartSeries,
        scenarioSocialSeries: selectedState.chartSeries,
        coolingSeries: momentumStates[0].chartSeries,
        viralSeries: momentumStates[3].chartSeries
      }
    },
    socialPricingPower: {
      currentScore: currentSocialScore,
      neutralScore: neutralSocialScore,
      trendDelta: socialTrendDelta,
      baseElasticity,
      neutralElasticity,
      effectiveElasticity: selectedState.effectiveElasticity,
      elasticityChangePct: baseElasticity !== 0 ? (selectedState.effectiveElasticity / baseElasticity) - 1 : 0,
      demandTailwindPct: selectedState.demandTailwindPct,
      headroomPct: selectedState.headroomPct,
      posture: selectedState.posture,
      states: momentumStates,
      note: Number.isFinite(selectedState.headroomPct) && selectedState.headroomPct > 0
        ? `Current social momentum supports roughly ${formatSignedPercentFromRatio(selectedState.headroomPct, 1).replace('+', '')} additional price headroom before unit demand returns to neutral baseline.`
        : 'Current social signal does not justify incremental pricing beyond the base scenario.'
    },
    summary
  };
}

async function enrichScenarioWithCommercialContext(result) {
  if (!result) return result;
  if (result.commercial_context?.summary) return result;

  try {
    const [skuRows, socialRows] = await Promise.all([
      loadSkuWeeklyData(),
      loadSocialSignals()
    ]);
    const context = buildCommercialScenarioContext(
      result,
      skuRows || [],
      socialRows || [],
      getLivePromoSnapshotSafe()
    );
    if (context) {
      result.commercial_context = context;
    }
  } catch (error) {
    console.error('Error enriching scenario with commercial context:', error);
  }

  return result;
}

function renderCommercialSalesProjectionChart(context) {
  const canvas = document.getElementById('commercial-sales-projection-chart');
  if (!canvas || !window.Chart) return;

  const chart = context?.projection?.chart;
  if (!chart) return;

  if (commercialSalesProjectionChart) {
    commercialSalesProjectionChart.destroy();
  }

  commercialSalesProjectionChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: chart.labels,
      datasets: [
        {
          label: 'Actual cumulative sold (weeks 1-5)',
          data: chart.actualSeries,
          borderColor: 'rgba(15, 23, 42, 0.9)',
          backgroundColor: 'rgba(15, 23, 42, 0.08)',
          tension: 0.25,
          pointRadius: 2,
          spanGaps: false
        },
        {
          label: 'Baseline projection',
          data: chart.baselineSeries,
          borderColor: 'rgba(100, 116, 139, 0.95)',
          backgroundColor: 'rgba(100, 116, 139, 0.12)',
          borderDash: [6, 5],
          tension: 0.2,
          pointRadius: 1.5,
          spanGaps: true
        },
        {
          label: 'Scenario (price only)',
          data: chart.scenarioNeutralSeries,
          borderColor: 'rgba(37, 99, 235, 0.95)',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderDash: [4, 4],
          tension: 0.2,
          pointRadius: 1.5,
          spanGaps: true
        },
        {
          label: 'Selected scenario + current trend',
          data: chart.scenarioSocialSeries,
          borderColor: 'rgba(16, 185, 129, 0.95)',
          backgroundColor: 'rgba(16, 185, 129, 0.16)',
          tension: 0.2,
          pointRadius: 1.5,
          spanGaps: true
        },
        {
          label: 'Cooling-off trend case',
          data: chart.coolingSeries,
          borderColor: 'rgba(245, 158, 11, 0.95)',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          tension: 0.2,
          pointRadius: 0,
          borderDash: [3, 4],
          spanGaps: true
        },
        {
          label: 'Viral spike case',
          data: chart.viralSeries,
          borderColor: 'rgba(168, 85, 247, 0.95)',
          backgroundColor: 'rgba(168, 85, 247, 0.12)',
          tension: 0.2,
          pointRadius: 0,
          borderDash: [8, 4],
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (tooltipItem) => `${tooltipItem.dataset.label}: ${formatNumber(tooltipItem.parsed.y || 0)} units`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatNumber(value)
          }
        }
      }
    }
  });
}

function initializeCommercialContextTabs() {
  if (window.__commercialContextTabsInitialized) return;

  document.querySelectorAll('#commercialContextTabs [data-bs-toggle="pill"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', (event) => {
      if (!activeCommercialContext) return;

      const targetPane = event.target?.getAttribute('data-bs-target');
      if (targetPane === '#commercial-week5-pane') {
        scheduleCommercialPaneRender('week5', activeCommercialContext);
      } else if (targetPane === '#commercial-social-pane') {
        scheduleCommercialPaneRender('social', activeCommercialContext);
      }
    });
  });

  window.__commercialContextTabsInitialized = true;
}

function scheduleCommercialPaneRender(pane, context, attempt = 0) {
  if (!context) return;

  const paneId = pane === 'social' ? 'commercial-social-pane' : 'commercial-week5-pane';
  const canvasId = pane === 'social' ? 'commercial-social-power-chart' : 'commercial-sales-projection-chart';
  const paneEl = document.getElementById(paneId);
  const canvasEl = document.getElementById(canvasId);
  const sectionEl = document.getElementById('commercial-context-section');

  if (!paneEl || !canvasEl || !sectionEl) return;

  const paneVisible = paneEl.classList.contains('active') && paneEl.classList.contains('show');
  const sectionVisible = sectionEl.style.display !== 'none' && sectionEl.getBoundingClientRect().width > 0;
  const canvasReady = canvasEl.getBoundingClientRect().width > 0 && canvasEl.getBoundingClientRect().height > 0;

  if (!paneVisible || !sectionVisible || !canvasReady) {
    if (attempt >= 12) {
      requestAnimationFrame(() => {
        if (pane === 'social') {
          renderCommercialSocialPowerChart(context);
          commercialSocialPowerChart?.resize();
          commercialSocialPowerChart?.update('none');
        } else {
          renderCommercialSalesProjectionChart(context);
          commercialSalesProjectionChart?.resize();
          commercialSalesProjectionChart?.update('none');
        }
      });
      return;
    }

    setTimeout(() => scheduleCommercialPaneRender(pane, context, attempt + 1), 80);
    return;
  }

  requestAnimationFrame(() => {
    if (pane === 'social') {
      renderCommercialSocialPowerChart(context);
      commercialSocialPowerChart?.resize();
      commercialSocialPowerChart?.update('none');
    } else {
      renderCommercialSalesProjectionChart(context);
      commercialSalesProjectionChart?.resize();
      commercialSalesProjectionChart?.update('none');
    }
  });
}

function renderCommercialSocialPowerChart(context) {
  const canvas = document.getElementById('commercial-social-power-chart');
  if (!canvas || !window.Chart) return;

  const states = context?.socialPricingPower?.states || [];
  if (!states.length) return;

  if (commercialSocialPowerChart) {
    commercialSocialPowerChart.destroy();
  }

  commercialSocialPowerChart = new Chart(canvas, {
    data: {
      labels: states.map(state => state.label),
      datasets: [
        {
          type: 'bar',
          label: 'Price headroom %',
          data: states.map(state => Number((state.headroomPct || 0) * 100).toFixed(2)),
          backgroundColor: [
            'rgba(245, 158, 11, 0.7)',
            'rgba(148, 163, 184, 0.7)',
            'rgba(16, 185, 129, 0.78)',
            'rgba(168, 85, 247, 0.78)'
          ],
          borderRadius: 8,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Effective elasticity',
          data: states.map(state => Number(state.effectiveElasticity.toFixed(2))),
          borderColor: 'rgba(37, 99, 235, 0.95)',
          backgroundColor: 'rgba(37, 99, 235, 0.14)',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(37, 99, 235, 1)',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (tooltipItem) => {
              if (tooltipItem.dataset.yAxisID === 'y1') {
                return `${tooltipItem.dataset.label}: ${tooltipItem.parsed.y.toFixed(2)}`;
              }
              return `${tooltipItem.dataset.label}: ${tooltipItem.parsed.y >= 0 ? '+' : ''}${tooltipItem.parsed.y.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          position: 'left',
          ticks: {
            callback: (value) => `${value >= 0 ? '+' : ''}${value}%`
          }
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (value) => Number(value).toFixed(1)
          }
        }
      }
    }
  });
}

function renderComparisonWeek5Chart() {
  const canvas = document.getElementById('comparison-week5-chart');
  const noteEl = document.getElementById('comparison-week5-note');
  if (!canvas || !window.Chart) return;

  const validScenarios = savedScenarios.filter(scenario => scenario?.commercial_context?.projection?.chart);
  if (comparisonWeek5Chart) {
    comparisonWeek5Chart.destroy();
    comparisonWeek5Chart = null;
  }

  if (!validScenarios.length) {
    if (noteEl) {
      noteEl.textContent = 'Save multiple scenarios to see how the remaining season changes from the same week-5 checkpoint.';
    }
    return;
  }

  const baseContext = validScenarios[0].commercial_context;
  const labels = baseContext.projection.chart.labels;
  const datasets = [
    {
      label: 'Actual cumulative sold (weeks 1-5)',
      data: baseContext.projection.chart.actualSeries,
      borderColor: 'rgba(15, 23, 42, 0.9)',
      backgroundColor: 'rgba(15, 23, 42, 0.08)',
      tension: 0.2,
      pointRadius: 2,
      spanGaps: false
    },
    {
      label: 'Baseline projection',
      data: baseContext.projection.chart.baselineSeries,
      borderColor: 'rgba(100, 116, 139, 0.95)',
      backgroundColor: 'rgba(100, 116, 139, 0.1)',
      borderDash: [6, 5],
      tension: 0.2,
      pointRadius: 0,
      spanGaps: true
    }
  ];

  const palette = [
    'rgba(37, 99, 235, 0.95)',
    'rgba(16, 185, 129, 0.95)',
    'rgba(168, 85, 247, 0.95)',
    'rgba(245, 158, 11, 0.95)'
  ];

  validScenarios.slice(0, 4).forEach((scenario, index) => {
    datasets.push({
      label: scenario.scenario_name || scenario.scenario_id || `Scenario ${index + 1}`,
      data: scenario.commercial_context.projection.chart.scenarioSocialSeries,
      borderColor: palette[index % palette.length],
      backgroundColor: palette[index % palette.length].replace('0.95', '0.12'),
      tension: 0.2,
      pointRadius: 0,
      spanGaps: true
    });
  });

  comparisonWeek5Chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatNumber(value)
          }
        }
      }
    }
  });

  if (noteEl) {
    noteEl.textContent = `All curves start from the same week-${baseContext.checkpoint.week} checkpoint so scenario differences represent the remaining-season effect only.`;
  }
}

function renderCommercialScenarioBoard(result) {
  const context = result?.commercial_context;
  const section = document.getElementById('commercial-context-section');
  if (!section) return;

  if (!context) {
    section.style.display = 'none';
    activeCommercialContext = null;
    return;
  }

  activeCommercialContext = context;
  section.style.display = 'block';

  const anchorEl = document.getElementById('commercial-context-anchor');
  const summaryEl = document.getElementById('commercial-context-summary');
  const checkpointUnitsEl = document.getElementById('commercial-checkpoint-units');
  const checkpointRevenueEl = document.getElementById('commercial-checkpoint-revenue');
  const checkpointSellThroughEl = document.getElementById('commercial-checkpoint-sellthrough');
  const checkpointInventoryEl = document.getElementById('commercial-checkpoint-inventory');
  const restScenarioUnitsEl = document.getElementById('commercial-rest-scenario-units');
  const restBaselineUnitsEl = document.getElementById('commercial-rest-baseline-units');
  const socialHeadroomEl = document.getElementById('commercial-social-headroom');
  const socialPostureEl = document.getElementById('commercial-social-posture');
  const chartNoteEl = document.getElementById('commercial-chart-note');
  const week5TableBodyEl = document.getElementById('commercial-week5-scenario-body');
  const week5NoteEl = document.getElementById('commercial-week5-note');
  const socialScoreEl = document.getElementById('commercial-social-score');
  const socialTrendEl = document.getElementById('commercial-social-trend');
  const baseElasticityEl = document.getElementById('commercial-base-elasticity');
  const effectiveElasticityEl = document.getElementById('commercial-effective-elasticity');
  const priceMoveEl = document.getElementById('commercial-price-move');
  const demandTailwindEl = document.getElementById('commercial-demand-tailwind');
  const socialStateBodyEl = document.getElementById('commercial-social-state-body');
  const socialNoteEl = document.getElementById('commercial-social-note');

  if (anchorEl) {
    const scopeLabel = context.filters?.description || 'Portfolio-wide';
    const effectiveDateText = context.timing?.effectiveDate ? ` | Effective ${context.timing.effectiveDate}` : '';
    anchorEl.textContent = `${scopeLabel} | Week ${context.checkpoint.week} checkpoint | Scenario starts W${context.timing?.scenarioStartWeek || context.currentPosition.week}${effectiveDateText}`;
  }
  if (summaryEl) {
    summaryEl.textContent = context.summary;
  }
  if (checkpointUnitsEl) {
    checkpointUnitsEl.textContent = `${formatNumber(context.checkpoint.actualUnitsSold)} units`;
  }
  if (checkpointRevenueEl) {
    checkpointRevenueEl.textContent = `${formatCurrency(context.checkpoint.actualRevenue)} revenue by week ${context.checkpoint.week}`;
  }
  if (checkpointSellThroughEl) {
    checkpointSellThroughEl.textContent = formatSignedPercentFromRatio(context.checkpoint.sellThroughPct, 1).replace('+', '');
  }
  if (checkpointInventoryEl) {
    checkpointInventoryEl.textContent = `${formatNumber(context.checkpoint.inventoryRemaining)} units left at checkpoint`;
  }
  if (restScenarioUnitsEl) {
    restScenarioUnitsEl.textContent = `${formatNumber(context.projection.scenarioRemainingUnitsSocial)} units`;
  }
  if (restBaselineUnitsEl) {
    restBaselineUnitsEl.textContent = `Baseline ${formatNumber(context.projection.baselineRemainingUnits)} | ${formatSignedPercentFromRatio(context.projection.scenarioVsBaselineUnitsPct, 1)} vs baseline`;
  }
  if (socialHeadroomEl) {
    socialHeadroomEl.textContent = formatSignedPercentFromRatio(context.socialPricingPower.headroomPct, 1);
  }
  if (socialPostureEl) {
    socialPostureEl.textContent = context.socialPricingPower.posture;
  }
  if (chartNoteEl) {
    chartNoteEl.textContent = `Weeks 1-${context.checkpoint.week} are actuals. The selected scenario starts in week ${context.timing?.scenarioStartWeek || (context.checkpoint.week + 1)}, so only later weeks carry scenario lift vs baseline.`;
  }
  if (socialScoreEl) {
    socialScoreEl.textContent = Number.isFinite(context.socialPricingPower.currentScore)
      ? context.socialPricingPower.currentScore.toFixed(1)
      : 'N/A';
  }
  if (socialTrendEl) {
    socialTrendEl.textContent = Number.isFinite(context.socialPricingPower.trendDelta)
      ? `${context.socialPricingPower.trendDelta >= 0 ? '+' : ''}${context.socialPricingPower.trendDelta.toFixed(1)} vs prior week`
      : 'N/A';
  }
  if (baseElasticityEl) {
    baseElasticityEl.textContent = context.socialPricingPower.baseElasticity.toFixed(2);
  }
  if (effectiveElasticityEl) {
    effectiveElasticityEl.textContent = `${context.socialPricingPower.effectiveElasticity.toFixed(2)} (${formatSignedPercentFromRatio(context.socialPricingPower.elasticityChangePct, 1)})`;
  }
  if (priceMoveEl) {
    priceMoveEl.textContent = formatSignedPercentFromRatio(context.scenarioPrice.priceChangePct, 1);
  }
  if (demandTailwindEl) {
    demandTailwindEl.textContent = formatSignedPercentFromRatio(context.socialPricingPower.demandTailwindPct, 1);
  }
  if (socialNoteEl) {
    socialNoteEl.textContent = context.socialPricingPower.note;
  }

  if (week5TableBodyEl) {
    const states = context.projection.socialStates || [];
    week5TableBodyEl.innerHTML = states.map(state => `
      <tr>
        <td>${state.label}</td>
        <td class="text-end">${formatNumber(state.projectedRemainingUnits)}</td>
        <td class="text-end">${formatCurrency(state.projectedRemainingRevenue)}</td>
      </tr>
    `).join('');
  }
  if (week5NoteEl) {
    week5NoteEl.textContent = `The selected scenario is shown as "${(context.projection.socialStates || []).find(state => state.variant === 'current')?.label || 'Current Trend'}" for ${context.filters?.description || 'the scoped portfolio'}. Viral and cooling cases show how the same price move behaves if brand buzz changes from the scenario start week.`;
  }
  if (socialStateBodyEl) {
    const states = context.socialPricingPower.states || [];
    socialStateBodyEl.innerHTML = states.map(state => `
      <tr>
        <td>${state.label}</td>
        <td class="text-end">${state.effectiveElasticity.toFixed(2)}</td>
        <td class="text-end ${state.headroomPct >= 0 ? 'text-success' : 'text-danger'}">${formatSignedPercentFromRatio(state.headroomPct, 1)}</td>
      </tr>
    `).join('');
  }

  const week5TabTrigger = document.getElementById('commercial-week5-tab');
  if (week5TabTrigger && window.bootstrap?.Tab) {
    window.bootstrap.Tab.getOrCreateInstance(week5TabTrigger).show();
  }

  scheduleCommercialPaneRender('week5', context);
  scheduleCommercialPaneRender('social', context);
}

function renderScenarioComparisonOutlookTable() {
  const body = document.getElementById('comparison-outlook-body');
  if (!body) return;

  if (!savedScenarios.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Save and compare scenarios to render the reforecast table.</td></tr>';
    renderComparisonWeek5Chart();
    return;
  }

  body.innerHTML = savedScenarios.map(scenario => {
    const context = scenario.commercial_context;
    if (!context) {
      return `
        <tr>
          <td>${scenario.scenario_name || scenario.scenario_id}</td>
          <td colspan="6" class="text-muted">Commercial reforecast not available.</td>
        </tr>
      `;
    }

    const priceMove = formatSignedPercentFromRatio(context.scenarioPrice.priceChangePct, 1);
    const restUnits = formatNumber(context.projection.scenarioRemainingUnitsSocial);
    const restRevenue = formatCurrency(context.projection.scenarioRemainingRevenueSocial);
    const vsBaseline = formatSignedPercentFromRatio(context.projection.scenarioVsBaselineRevenuePct, 1);
    const headroom = formatSignedPercentFromRatio(context.socialPricingPower.headroomPct, 1);
    const readout = context.socialPricingPower.headroomPct > 0.04
      ? 'Brand heat supports firmer pricing.'
      : context.projection.scenarioVsBaselineRevenuePct > 0
        ? 'Scenario lifts revenue, but pricing power is limited.'
        : 'Scenario needs tighter targeting or less discount depth.';

    return `
      <tr>
        <td><strong>${scenario.scenario_name || scenario.scenario_id}</strong></td>
        <td class="text-end">${priceMove}</td>
        <td class="text-end">${restUnits}</td>
        <td class="text-end">${restRevenue}</td>
        <td class="text-end ${context.projection.scenarioVsBaselineRevenuePct >= 0 ? 'text-success' : 'text-danger'}">${vsBaseline}</td>
        <td class="text-end ${context.socialPricingPower.headroomPct >= 0 ? 'text-primary' : 'text-danger'}">${headroom}</td>
        <td>${readout}</td>
      </tr>
    `;
  }).join('');
  renderComparisonWeek5Chart();
}

/**
 * Display simulation results in the tabbed interface
 * @param {Object} result - The simulation result to display
 * @param {boolean} isRedisplay - True if this is re-displaying an existing result (don't re-store it)
 */
function displayResultsInTabs(result, isRedisplay = false) {
  const modelType = resolveModelTypeForResult(result);
  if (!modelType) {
    console.warn('Unable to resolve model type for result; skipping render', result);
    return;
  }

  // Ensure the result object has the correct model_type
  if (!result.model_type) {
    result.model_type = modelType;
  }

  // Verify that the result's model_type matches the resolved modelType
  if (result.model_type !== modelType) {
    console.warn(`⚠️ Result model_type mismatch! result.model_type=${result.model_type}, resolved=${modelType}. Using resolved.`);
    result.model_type = modelType;
  }

  // Only store the result if this is a NEW simulation, not a re-display
  if (!isRedisplay) {
    result.recalculated_at = new Date().toISOString();
    currentResultByModel[modelType] = result;
    console.log(`💾 Storing result for ${modelType} model:`, result.scenario_id);
  } else {
    console.log(`🔁 Re-displaying existing result for ${modelType} model:`, result.scenario_id);
  }

  // Debug logging
  console.log(`📊 displayResultsInTabs called`, {
    resolvedModelType: modelType,
    activeModelType: activeModelType,
    isRedisplay: isRedisplay,
    willRender: modelType === activeModelType,
    scenario_id: result.scenario_id,
    resultModelType: result.model_type,
    storageState: Object.keys(currentResultByModel).reduce((acc, key) => {
      acc[key] = currentResultByModel[key] ? currentResultByModel[key].scenario_id : null;
      return acc;
    }, {})
  });

  // Only render if this result belongs to the active model
  if (modelType !== activeModelType) {
    console.log(`⏭️ Skipping render: modelType (${modelType}) !== activeModelType (${activeModelType})`);
    return;
  }

  // Clear any prior UI before rendering to avoid bleed-through
  hideScenarioResults();

  currentResult = result;
  console.log(`✅ Rendering results for ${modelType} model, scenario: ${result.scenario_id}`);
  const resultContainer = document.getElementById('result-container-models');
  if (resultContainer) resultContainer.style.display = 'block';

  // Debug logging
  console.log('📊 Displaying results:', {
    scenario: result.scenario_id,
    baseline_revenue: result.baseline.revenue,
    forecasted_revenue: result.forecasted.revenue,
    delta_revenue: result.delta.revenue,
    baseline_subs: result.baseline.customers,
    forecasted_subs: result.forecasted.activeCustomers || result.forecasted.customers
  });

  // Store in all simulation results for chatbot access
  if (!allSimulationResultsByModel[modelType].find(r => r.scenario_id === result.scenario_id)) {
    allSimulationResultsByModel[modelType].push(result);
  }

  // Display warning for new tier scenarios
  const warningContainer = document.getElementById('new-tier-warning');
  if (result.is_new_tier && warningContainer) {
    warningContainer.innerHTML = `
      <div class="alert alert-info border-info mb-3">
        <i class="bi bi-info-circle me-2"></i>
        <strong>New Portfolio Segment Simulation:</strong> This scenario introduces a hypothetical "${result.scenario_config.tier}" segment that doesn't exist in historical data.
        Results use "${result.scenario_config.baseline_tier}" as baseline proxy for modeling.
      </div>
    `;
    warningContainer.style.display = 'block';
  } else if (warningContainer) {
    warningContainer.style.display = 'none';
  }

  // Display KPI cards
  const container = document.getElementById('result-cards-models');
  const customers = result.forecasted.activeCustomers || result.forecasted.customers;
  const deltaCustomers = result.delta.customers;
  const deltaCustomersPct = result.delta.customers_pct;

  // Calculate Payback Metrics (RFP Slide 15-16)
  const acquisitionPayback = calculateAcquisitionPayback(result);
  const churnPayback = calculateChurnPayback(result);
  const volumeLabel = modelType === 'acquisition'
    ? 'Demand Volume (Proxy)'
    : modelType === 'churn'
      ? 'Repeat Volume (Proxy)'
      : 'Route Volume (Proxy)';
  const revenueLabel = modelType === 'migration' ? 'Route Revenue (Monthly)' : 'Projected Revenue (Monthly)';
  const priceLabel = modelType === 'migration' ? 'Avg Selling Price' : 'AOV';
  const riskLabel = modelType === 'churn' ? 'Repeat-Risk Rate' : 'Repeat-Risk Guardrail';
  const primaryPaybackLabel = modelType === 'acquisition' ? 'Acquisition Payback' : 'Promo Payback';
  const secondaryPaybackLabel = modelType === 'churn' ? 'Risk Stabilization' : 'Repeat-Risk Payback';

  console.log(`💳 Rendering KPI cards for ${modelType}:`, {
    scenario_id: result.scenario_id,
    model_type: result.model_type,
    forecasted_revenue: result.forecasted.revenue,
    delta_revenue: result.delta.revenue,
    customers: customers,
    container_exists: !!container,
    delta_new_customers: result.delta?.new_customers,
    delta_new_customers_pct: result.delta?.new_customers_pct,
    forecasted_new_customers: result.forecasted?.new_customers
  });

  container.innerHTML = `
    <div class="col-md-3">
      <div class="card">
        <div class="card-body text-center">
          <div class="text-muted small">${volumeLabel}</div>
          <div class="h4 mb-1">${formatNumber(customers)}</div>
          <div class="small ${deltaCustomers >= 0 ? 'text-success' : 'text-danger'}">
            ${deltaCustomers >= 0 ? '+' : ''}${formatNumber(deltaCustomers)}
            (${formatPercent(deltaCustomersPct, 1)})
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card">
        <div class="card-body text-center">
          <div class="text-muted small">${revenueLabel}</div>
          <div class="h4 mb-1">${formatCurrency(result.forecasted.revenue)}</div>
          <div class="small ${result.delta.revenue >= 0 ? 'text-success' : 'text-danger'}">
            ${result.delta.revenue >= 0 ? '+' : ''}${formatCurrency(result.delta.revenue)}
            (${formatPercent(result.delta.revenue_pct, 1)})
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card">
        <div class="card-body text-center">
          <div class="text-muted small">${priceLabel}</div>
          <div class="h4 mb-1">${formatCurrency(result.forecasted.aov)}</div>
          <div class="small ${result.delta.aov >= 0 ? 'text-success' : 'text-danger'}">
            ${result.delta.aov >= 0 ? '+' : ''}${formatCurrency(result.delta.aov)}
            (${formatPercent(result.delta.aov_pct, 1)})
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card">
        <div class="card-body text-center">
          <div class="text-muted small">${riskLabel}</div>
          <div class="h4 mb-1">${formatPercent((result.forecasted.repeatLossRate || result.forecasted.repeat_loss_rate || 0), 2)}</div>
          <div class="small ${result.delta.repeat_loss_rate <= 0 ? 'text-success' : 'text-danger'}">
            ${result.delta.repeat_loss_rate >= 0 ? '+' : ''}${formatPercent(result.delta.repeat_loss_rate, 2)}
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card border-primary">
        <div class="card-body text-center">
          <div class="text-muted small">
            <i class="bi bi-calendar-check me-1"></i>${primaryPaybackLabel}
          </div>
          <div class="h4 mb-1 text-primary">${acquisitionPayback.value}</div>
          <div class="small text-muted">${acquisitionPayback.label}</div>
        </div>
      </div>
    </div>
    <div class="col-md-2">
      <div class="card border-info">
        <div class="card-body text-center">
          <div class="text-muted small">
            <i class="bi bi-hourglass-split me-1"></i>${secondaryPaybackLabel}
          </div>
          <div class="h4 mb-1 text-info">${churnPayback.value}</div>
          <div class="small text-muted">${churnPayback.label}</div>
        </div>
      </div>
    </div>
  `;

  // Render charts
  renderRevenueChartInTabs(result);
  renderCustomerChartInTabs(result);

  // Render dynamic cohort tables
  renderAcquisitionCohortTable(result);
  renderChurnHeatmap(result);
  renderMigrationMatrix(result);

  // Show/hide appropriate detail table based on model type
  const acquisitionDetail = document.getElementById('acquisition-results-detail');
  const churnDetail = document.getElementById('churn-results-detail');
  const migrationDetail = document.getElementById('migration-results-detail');

  if (acquisitionDetail) acquisitionDetail.style.display = (modelType === 'acquisition') ? 'block' : 'none';
  if (churnDetail) churnDetail.style.display = (modelType === 'churn') ? 'block' : 'none';
  if (migrationDetail) migrationDetail.style.display = (modelType === 'migration') ? 'block' : 'none';

  console.log(`👁️ Detail sections visibility:`, {
    modelType: modelType,
    acquisition: acquisitionDetail?.style.display,
    churn: churnDetail?.style.display,
    migration: migrationDetail?.style.display
  });
  renderCommercialScenarioBoard(result);
  updateAdvancedScenarioStatePanels();
}

/**
 * Render revenue chart in tabs
 */
function renderRevenueChartInTabs(result) {
  const ctx = document.getElementById('revenue-chart-models');

  console.log(`📊 Rendering revenue chart:`, {
    scenario_id: result.scenario_id,
    model_type: result.model_type,
    baseline_revenue: result.baseline.revenue,
    forecasted_revenue: result.forecasted.revenue,
    chart_exists: !!window.revenueChartModels
  });

  if (window.revenueChartModels) {
    window.revenueChartModels.destroy();
  }

  window.revenueChartModels = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Baseline', 'Scenario'],
      datasets: [{
        label: 'Monthly Revenue',
        data: [result.baseline.revenue, result.forecasted.revenue],
        backgroundColor: ['rgba(108, 117, 125, 0.8)', 'rgba(13, 110, 253, 0.8)']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatCurrency(value)
          }
        }
      }
    }
  });
}

/**
 * Render customer chart in tabs
 */
function renderCustomerChartInTabs(result) {
  const ctx = document.getElementById('customer-chart-models');

  if (window.customerChartModels) {
    window.customerChartModels.destroy();
  }

  window.customerChartModels = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Baseline', 'Scenario'],
      datasets: [{
        label: 'Customers',
        data: [
          result.baseline.activeCustomers || result.baseline.customers,
          result.forecasted.activeCustomers || result.forecasted.customers
        ],
        backgroundColor: ['rgba(108, 117, 125, 0.8)', 'rgba(13, 110, 253, 0.8)']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatNumber(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatNumber(value)
          }
        }
      }
    }
  });
}

/**
 * Navigation Functions for Contextual Links
 */

// Navigate to segmentation section and optionally filter by model type
window.navigateToSegments = function(modelType) {
  const segmentSection = document.getElementById('segmentation-section');
  const analyticsSection = document.getElementById('analytics-section');
  const comparisonSection = document.getElementById('segment-analysis-section');

  if (segmentSection) {
    // Show the deep dive sections
    segmentSection.style.display = 'block';
    if (analyticsSection) analyticsSection.style.display = 'block';
    if (comparisonSection) comparisonSection.style.display = 'block';

    // Scroll to segmentation section
    segmentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Optional: Auto-filter segments based on model type
    // This could be enhanced to actually filter the segments
    console.log(`Navigating to segments with focus on: ${modelType}`);
  }
};

// Scroll back to scenario engine
window.scrollToScenarioEngine = function() {
  const scenarioEngine = document.getElementById('elasticity-models-section');
  if (scenarioEngine) {
    scenarioEngine.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Scroll to scenario engine and switch to specific tab
window.scrollToTab = function(tabName) {
  const scenarioEngine = document.getElementById('elasticity-models-section');
  if (scenarioEngine) {
    scenarioEngine.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Switch to the specified tab after scrolling
    setTimeout(() => {
      const tabButton = document.getElementById(`${tabName}-tab`);
      if (tabButton) {
        tabButton.click();
      }
    }, 500);
  }
};

/**
 * Render Acquisition Cohort Table dynamically
 */
async function renderAcquisitionCohortTable(result) {
  const tableBody = document.querySelector('#acquisition-cohort-table tbody');
  if (!tableBody) return;

  try {
    // Get tier from scenario
    const tier = result.scenario_config?.tier || 'ad_supported';

    // Get cohorts
    const cohorts = await getAcquisitionCohorts(tier);

    if (!cohorts || cohorts.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No cohort data available</td></tr>';
      return;
    }

    // Get Python model predictions if available
    let predictions = [];
    if (isPyodideAvailable() && result.python_models) {
      const scenario = {
        new_price: result.scenario_config.new_price,
        current_price: result.scenario_config.current_price,
        promotion: result.scenario_config.promotion
      };

      predictions = await pyodideBridge.predictAcquisitionBySegment(scenario, cohorts);
    }

    // Render table rows
    tableBody.innerHTML = cohorts.map((cohort, index) => {
      const prediction = predictions[index] || {};
      // Correct elasticity formula: elasticity × price_change
      // -5% price change: elasticity × (-5) = lift
      // +5% price change: elasticity × (+5) = lift
      const addsLiftMinus5 = prediction.lift_at_minus_5pct || (cohort.elasticity * (-5));
      const addsLiftPlus5 = prediction.lift_at_plus_5pct || (cohort.elasticity * 5);
      const confidence = prediction.confidence || 2.5;

      // Badge color based on elasticity
      const elasticityBadge = Math.abs(cohort.elasticity) > 2.5 ? 'bg-danger' :
                              Math.abs(cohort.elasticity) > 1.5 ? 'bg-warning' : 'bg-success';

      return `
        <tr>
          <td><strong>${cohort.name}</strong></td>
          <td>${formatNumber(cohort.size)}</td>
          <td><span class="badge ${elasticityBadge}">${cohort.elasticity.toFixed(2)}</span></td>
          <td class="text-success">${addsLiftMinus5 > 0 ? '+' : ''}${addsLiftMinus5.toFixed(1)}%</td>
          <td class="text-danger">${addsLiftPlus5 > 0 ? '+' : ''}${addsLiftPlus5.toFixed(1)}%</td>
          <td><span class="text-muted">±${confidence.toFixed(1)}%</span></td>
        </tr>
      `;
    }).join('');

    console.log(`✅ Rendered ${cohorts.length} acquisition cohorts`);
  } catch (error) {
    console.error('Error rendering acquisition cohort table:', error);
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading cohort data</td></tr>';
  }
}

/**
 * Render Churn Heatmap dynamically
 */
async function renderChurnHeatmap(result) {
  const tableBody = document.querySelector('#churn-heatmap-table tbody');
  if (!tableBody) return;

  try {
    const tier = result.scenario_config?.tier || 'ad_supported';
    const cohorts = await getChurnCohorts(tier);

    if (!cohorts || cohorts.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No cohort data available</td></tr>';
      return;
    }

    // Get Python model predictions by time horizon
    let predictions = [];
    if (isPyodideAvailable() && result.python_models) {
      const scenario = {
        new_price: result.scenario_config.new_price,
        current_price: result.scenario_config.current_price,
        price_change_pct: ((result.scenario_config.new_price - result.scenario_config.current_price) / result.scenario_config.current_price) * 100,
        baseline_repeat_loss: result.baseline.repeatLossRate || 0.05,
        promotion: result.scenario_config.promotion
      };

      predictions = await pyodideBridge.predictChurnBySegment(scenario, cohorts);
    }

    // Render heatmap rows
    tableBody.innerHTML = cohorts.map((cohort, index) => {
      const prediction = predictions[index] || {};

      // Extract churn uplift by horizon (in percentage points)
      const repeat_loss_0_4 = prediction.repeat_loss_0_4_weeks || (cohort.elasticity * 0.015 * 100);
      const repeat_loss_4_8 = prediction.repeat_loss_4_8_weeks || (cohort.elasticity * 0.035 * 100);
      const repeat_loss_8_12 = prediction.repeat_loss_8_12_weeks || (cohort.elasticity * 0.045 * 100);
      const repeat_loss_12plus = prediction.repeat_loss_12plus_weeks || (cohort.elasticity * 0.020 * 100);

      // Simple color coding - green for decreases (good), red for increases (bad)
      const getColorClass = (value) => {
        if (value < 0) return 'text-success';  // Negative = churn decrease = GOOD
        if (value > 0) return 'text-danger';   // Positive = churn increase = BAD
        return 'text-muted';                    // Zero = no change
      };

      const formatChurn = (val) => `${val > 0 ? '+' : ''}${val.toFixed(1)} pp`;

      return `
        <tr>
          <td><strong>${cohort.name}</strong></td>
          <td class="${getColorClass(repeat_loss_0_4)}">${formatChurn(repeat_loss_0_4)}</td>
          <td class="${getColorClass(repeat_loss_4_8)}">${formatChurn(repeat_loss_4_8)}</td>
          <td class="${getColorClass(repeat_loss_8_12)}">${formatChurn(repeat_loss_8_12)}</td>
          <td class="${getColorClass(repeat_loss_12plus)}">${formatChurn(repeat_loss_12plus)}</td>
        </tr>
      `;
    }).join('');

    console.log(`✅ Rendered ${cohorts.length} churn cohorts`);
  } catch (error) {
    console.error('Error rendering churn heatmap:', error);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading cohort data</td></tr>';
  }
}

/**
 * Render Migration Matrix dynamically
 */
async function renderMigrationMatrix(result) {
  const tableBody = document.querySelector('#migration-matrix-table tbody');
  const tableCard = tableBody?.closest('.card');
  const tableHeader = document.querySelector('#migration-matrix-table thead');

  if (!tableBody) return;

  // Show the card
  if (tableCard) {
    tableCard.style.display = 'block';
  }

  try {
    // Use Python model migration predictions
    if (!result.python_models || !result.python_models.migration) {
      console.log('⚠️ No migration predictions available');
      return;
    }

    const migration = result.python_models.migration;
    const tierConfig = migration.tier_config || '2-tier';

    console.log('📊 Rendering migration matrix - Tier config:', tierConfig);

    // Render based on tier configuration
    if (tierConfig === '3-tier-bundle') {
      renderBundleMigrationMatrix(tableHeader, tableBody, migration);
    } else if (tierConfig === '3-tier-basic') {
      renderBasicMigrationMatrix(tableHeader, tableBody, migration);
    } else {
      render2TierMigrationMatrix(tableHeader, tableBody, migration);
    }

    console.log(`✅ Rendered migration matrix (${tierConfig})`);
  } catch (error) {
    console.error('Error rendering migration matrix:', error);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading migration data</td></tr>';
  }
}

/**
 * Render 2-tier migration matrix (original)
 */
function render2TierMigrationMatrix(tableHeader, tableBody, migration) {
  // Simple single-row header
  tableHeader.innerHTML = `
    <tr>
      <th>Current Channel</th>
      <th>→ Prestige Channel</th>
      <th>→ Mass Channel</th>
      <th>Repeat Loss</th>
      <th>Net Change</th>
    </tr>
  `;

  // Mass Channel row
  const adSuppUpgrade = (migration.from_ad_supported?.to_ad_free || 0) * 100;
  const adSuppCancel = (migration.from_ad_supported?.cancel || 0) * 100;
  const adSuppNetMix = adSuppUpgrade - adSuppCancel;

  // Prestige Channel row
  const adFreeDowngrade = (migration.from_ad_free?.to_ad_supported || 0) * 100;
  const adFreeCancel = (migration.from_ad_free?.cancel || 0) * 100;
  const adFreeNetMix = -adFreeDowngrade - adFreeCancel;

  tableBody.innerHTML = `
    <tr>
      <td><strong>Mass Channel</strong></td>
      <td class="text-success">${adSuppUpgrade > 0 ? '+' : ''}${adSuppUpgrade.toFixed(1)}%</td>
      <td class="text-muted">—</td>
      <td class="text-danger">${adSuppCancel > 0 ? '+' : ''}${adSuppCancel.toFixed(1)}%</td>
      <td class="${adSuppNetMix >= 0 ? 'text-success' : 'text-danger'}"><strong>${adSuppNetMix > 0 ? '+' : ''}${adSuppNetMix.toFixed(1)}%</strong></td>
    </tr>
    <tr>
      <td><strong>Prestige Channel</strong></td>
      <td class="text-muted">—</td>
      <td class="text-warning">${adFreeDowngrade > 0 ? '+' : ''}${adFreeDowngrade.toFixed(1)}%</td>
      <td class="text-danger">${adFreeCancel > 0 ? '+' : ''}${adFreeCancel.toFixed(1)}%</td>
      <td class="${adFreeNetMix >= 0 ? 'text-success' : 'text-danger'}"><strong>${adFreeNetMix > 0 ? '+' : ''}${adFreeNetMix.toFixed(1)}%</strong></td>
    </tr>
  `;
}

/**
 * Render 3-tier Bundle migration matrix
 */
function renderBundleMigrationMatrix(tableHeader, tableBody, migration) {
  // Simple single-row header
  tableHeader.innerHTML = `
    <tr>
      <th>Current Channel</th>
      <th>→ Prestige Channel</th>
      <th>→ Value Set</th>
      <th>→ Mass Channel</th>
      <th>Repeat Loss</th>
      <th>Net Change</th>
    </tr>
  `;

  // FROM Mass Channel
  const as_to_af = (migration.from_ad_supported?.to_ad_free || 0) * 100;
  const as_to_bundle = (migration.from_ad_supported?.to_bundle || 0) * 100;
  const as_cancel = (migration.from_ad_supported?.cancel || 0) * 100;
  const as_net = as_to_af + as_to_bundle - as_cancel;

  // FROM Prestige Channel
  const af_to_bundle = (migration.from_ad_free?.to_bundle || 0) * 100;
  const af_to_as = (migration.from_ad_free?.to_ad_supported || 0) * 100;
  const af_cancel = (migration.from_ad_free?.cancel || 0) * 100;
  const af_net = af_to_bundle - af_to_as - af_cancel;

  // FROM Value Set
  const bundle_to_af = (migration.from_bundle?.to_ad_free || 0) * 100;
  const bundle_to_as = (migration.from_bundle?.to_ad_supported || 0) * 100;
  const bundle_cancel = (migration.from_bundle?.cancel || 0) * 100;
  const bundle_net = -bundle_to_af - bundle_to_as - bundle_cancel;

  tableBody.innerHTML = `
    <tr>
      <td><strong>Mass Channel</strong></td>
      <td class="text-success">${as_to_af > 0 ? '+' : ''}${as_to_af.toFixed(1)}%</td>
      <td class="text-primary">${as_to_bundle > 0 ? '+' : ''}${as_to_bundle.toFixed(1)}%</td>
      <td class="text-muted">—</td>
      <td class="text-danger">${as_cancel > 0 ? '+' : ''}${as_cancel.toFixed(1)}%</td>
      <td class="${as_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${as_net > 0 ? '+' : ''}${as_net.toFixed(1)}%</strong></td>
    </tr>
    <tr>
      <td><strong>Prestige Channel</strong></td>
      <td class="text-muted">—</td>
      <td class="text-primary">${af_to_bundle > 0 ? '+' : ''}${af_to_bundle.toFixed(1)}%</td>
      <td class="text-warning">${af_to_as > 0 ? '+' : ''}${af_to_as.toFixed(1)}%</td>
      <td class="text-danger">${af_cancel > 0 ? '+' : ''}${af_cancel.toFixed(1)}%</td>
      <td class="${af_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${af_net > 0 ? '+' : ''}${af_net.toFixed(1)}%</strong></td>
    </tr>
    <tr>
      <td><strong>Value Set</strong></td>
      <td class="text-warning">${bundle_to_af > 0 ? '+' : ''}${bundle_to_af.toFixed(1)}%</td>
      <td class="text-muted">—</td>
      <td class="text-warning">${bundle_to_as > 0 ? '+' : ''}${bundle_to_as.toFixed(1)}%</td>
      <td class="text-danger">${bundle_cancel > 0 ? '+' : ''}${bundle_cancel.toFixed(1)}%</td>
      <td class="${bundle_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${bundle_net > 0 ? '+' : ''}${bundle_net.toFixed(1)}%</strong></td>
    </tr>
  `;
}

/**
 * Render 3-tier Basic migration matrix
 */
function renderBasicMigrationMatrix(tableHeader, tableBody, migration) {
  // Simple single-row header
  tableHeader.innerHTML = `
    <tr>
      <th>Current Channel</th>
      <th>→ Mass Channel</th>
      <th>→ Prestige Channel</th>
      <th>→ Entry Pack</th>
      <th>Repeat Loss</th>
      <th>Net Change</th>
    </tr>
  `;

  // FROM BASIC
  const basic_to_as = (migration.from_basic?.to_ad_supported || 0) * 100;
  const basic_to_af = (migration.from_basic?.to_ad_free || 0) * 100;
  const basic_cancel = (migration.from_basic?.cancel || 0) * 100;
  const basic_net = basic_to_as + basic_to_af - basic_cancel;

  // FROM Mass Channel
  const as_to_af = (migration.from_ad_supported?.to_ad_free || 0) * 100;
  const as_to_basic = (migration.from_ad_supported?.to_basic || 0) * 100;
  const as_cancel = (migration.from_ad_supported?.cancel || 0) * 100;
  const as_net = as_to_af - as_to_basic - as_cancel;

  // FROM AD-FREE
  const af_to_as = (migration.from_ad_free?.to_ad_supported || 0) * 100;
  const af_to_basic = (migration.from_ad_free?.to_basic || 0) * 100;
  const af_cancel = (migration.from_ad_free?.cancel || 0) * 100;
  const af_net = -af_to_as - af_to_basic - af_cancel;

  tableBody.innerHTML = `
    <tr>
      <td><strong>Entry Pack</strong></td>
      <td class="text-success">${basic_to_as > 0 ? '+' : ''}${basic_to_as.toFixed(1)}%</td>
      <td class="text-primary">${basic_to_af > 0 ? '+' : ''}${basic_to_af.toFixed(1)}%</td>
      <td class="text-muted">—</td>
      <td class="text-danger">${basic_cancel > 0 ? '+' : ''}${basic_cancel.toFixed(1)}%</td>
      <td class="${basic_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${basic_net > 0 ? '+' : ''}${basic_net.toFixed(1)}%</strong></td>
    </tr>
    <tr>
      <td><strong>Mass Channel</strong></td>
      <td class="text-muted">—</td>
      <td class="text-success">${as_to_af > 0 ? '+' : ''}${as_to_af.toFixed(1)}%</td>
      <td class="text-warning">${as_to_basic > 0 ? '+' : ''}${as_to_basic.toFixed(1)}%</td>
      <td class="text-danger">${as_cancel > 0 ? '+' : ''}${as_cancel.toFixed(1)}%</td>
      <td class="${as_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${as_net > 0 ? '+' : ''}${as_net.toFixed(1)}%</strong></td>
    </tr>
    <tr>
      <td><strong>Prestige Channel</strong></td>
      <td class="text-warning">${af_to_as > 0 ? '+' : ''}${af_to_as.toFixed(1)}%</td>
      <td class="text-muted">—</td>
      <td class="text-warning">${af_to_basic > 0 ? '+' : ''}${af_to_basic.toFixed(1)}%</td>
      <td class="text-danger">${af_cancel > 0 ? '+' : ''}${af_cancel.toFixed(1)}%</td>
      <td class="${af_net >= 0 ? 'text-success' : 'text-danger'}"><strong>${af_net > 0 ? '+' : ''}${af_net.toFixed(1)}%</strong></td>
    </tr>
  `;
}

/**
 * One-click recommendation based on currently saved scenarios for active model
 */
async function recommendBestScenario() {
  const objective = document.getElementById('objective-lens-select')?.value || 'revenue-max';
  const activeSaved = savedScenariosByModel[activeModelType] || [];
  const activeResult = currentResultByModel[activeModelType];
  const candidates = activeSaved.length > 0 ? activeSaved : (activeResult ? [activeResult] : []);

  if (candidates.length === 0) {
    updateRecommendationBrief('Run and save at least one scenario in this step before requesting recommendation.');
    return;
  }

  await Promise.all(candidates.map(candidate => enrichScenarioWithCommercialContext(candidate)));
  const ranked = rankScenarios(candidates, objective, {});
  if (!ranked || ranked.length === 0) {
    updateRecommendationBrief('No valid recommendation under current objective/constraints. Try another objective lens.');
    return;
  }

  const best = ranked[0];
  displayTop3Scenarios(ranked);
  if (best) {
    // Render recommended scenario results immediately for pitch flow continuity
    displayResultsInTabs(best, true);
  }

  const scenarioLabel = best.scenario_name || best.id || best.scenario_id || 'Top scenario';
  const rev = Number(best?.delta?.revenue_pct) || 0;
  const vol = Number(best?.delta?.customers_pct) || 0;
  const risk = Number(best?.delta?.repeat_loss_rate) || 0;
  const rationaleText = String(best.rationale || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  updateRecommendationBrief(`
    <strong>Recommended:</strong> ${scenarioLabel}<br>
    Revenue ${rev >= 0 ? '+' : ''}${formatPercent(rev, 1)} | Volume proxy ${vol >= 0 ? '+' : ''}${formatPercent(vol, 1)} | Repeat-risk ${risk >= 0 ? '+' : ''}${formatPercent(risk, 2)} pp<br>
    <span class="text-muted">${rationaleText || 'Best score under selected objective.'}</span>
  `);
}

/**
 * Rank and display scenarios using decision engine (RFP Slide 18)
 */
async function rankAndDisplayScenarios() {
  if (savedScenarios.length === 0) {
    alert('No saved scenarios to rank. Please simulate and save scenarios first.');
    return;
  }

  try {
    await Promise.all(savedScenarios.map(scenario => enrichScenarioWithCommercialContext(scenario)));
    // Get selected objective and constraints
    const objective = document.getElementById('objective-lens-select').value;

    // Rank scenarios
    const rankedScenarios = rankScenarios(savedScenarios, objective, {});

    if (rankedScenarios.length === 0) {
      alert('No scenarios available to rank. Try saving more scenarios.');
      return;
    }

    // Display top 3
    displayTop3Scenarios(rankedScenarios);
    const top = rankedScenarios[0];
    if (top) {
      const topLabel = top.scenario_name || top.id || top.scenario_id || 'Top scenario';
      updateRecommendationBrief(`Top ranked under current objective: <strong>${topLabel}</strong>. Click "Recommend Best Scenario" to load it instantly.`);
    }

  } catch (error) {
    console.error('Error ranking scenarios:', error);
    alert('Error ranking scenarios. See console for details.');
  }
}

/**
 * Display top 3 ranked scenarios
 */
function displayTop3Scenarios(top3) {
  const container = document.getElementById('top-scenarios-container');
  const list = document.getElementById('top-scenarios-list');

  if (!container || !list) return;

  if (!window.currentTop3ScenariosByModel) {
    window.currentTop3ScenariosByModel = {};
  }
  window.currentTop3ScenariosByModel[activeModelType] = top3;

  let html = '';
  top3.forEach((scenario, index) => {
    const rankBadge = index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : 'text-dark';
    const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    const riskBadge = scenario.risk_level === 'Low' ? 'bg-success' :
                      scenario.risk_level === 'Med' ? 'bg-warning' :
                      'bg-danger';
    const commercialContext = scenario.commercial_context || null;
    const outlookMarkup = commercialContext ? `
            <div class="border rounded-3 p-2 bg-body-tertiary small mb-2">
              <div><strong>Week-${commercialContext.checkpoint.week} sell-through:</strong> ${formatSignedPercentFromRatio(commercialContext.checkpoint.sellThroughPct, 1).replace('+', '')}</div>
              <div><strong>Rest-of-season revenue:</strong> ${formatCurrency(commercialContext.projection.scenarioRemainingRevenueSocial)}</div>
              <div><strong>Social headroom:</strong> ${formatSignedPercentFromRatio(commercialContext.socialPricingPower.headroomPct, 1)}</div>
            </div>
          ` : '';

    html += `
      <div class="col-md-4">
        <div class="card h-100 ${index === 0 ? 'border-warning border-2' : ''}">
          <div class="card-header ${index === 0 ? 'bg-warning-subtle' : ''}">
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge ${rankBadge}">${rankIcon} Rank #${scenario.rank}</span>
              <span class="badge ${riskBadge}">${scenario.risk_level} Risk</span>
            </div>
          </div>
          <div class="card-body">
            <h6 class="card-title">${scenario.scenario_name || scenario.id}</h6>
            <p class="card-text small text-muted mb-2">
              ${scenario.description || ''}
            </p>

            <!-- KPIs -->
            <div class="mb-2">
              <div class="row g-1 small">
                <div class="col-6">
                  <strong>Revenue:</strong>
                  <span class="${scenario.delta.revenue >= 0 ? 'text-success' : 'text-danger'}">
                    ${scenario.delta.revenue >= 0 ? '+' : ''}${formatPercent(scenario.delta.revenue_pct, 1)}
                  </span>
                </div>
                <div class="col-6">
                  <strong>Customers:</strong>
                  <span class="${scenario.delta.customers >= 0 ? 'text-success' : 'text-danger'}">
                    ${scenario.delta.customers >= 0 ? '+' : ''}${formatPercent(scenario.delta.customers_pct, 1)}
                  </span>
                </div>
                <div class="col-6">
                  <strong>Repeat Risk:</strong>
                  <span class="${scenario.delta.repeat_loss_rate <= 0 ? 'text-success' : 'text-danger'}">
                    ${scenario.delta.repeat_loss_rate >= 0 ? '+' : ''}${formatPercent(scenario.delta.repeat_loss_rate, 2)}pp
                  </span>
                </div>
                <div class="col-6">
                  <strong>Score:</strong>
                  <span class="text-primary fw-bold">${scenario.decision_score.toFixed(1)}</span>
                </div>
              </div>
            </div>

            ${outlookMarkup}

            <!-- Rationale -->
            <div class="alert alert-light mb-0 small">
              <strong>Why it wins:</strong><br>
              ${scenario.rationale}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
  container.style.display = 'block';

  // Enable export buttons
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');
  if (exportPdfBtn) exportPdfBtn.disabled = false;
  if (exportXlsxBtn) exportXlsxBtn.disabled = false;

  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

