/**
 * Data Viewer Module - Accordion-based CSV Data Explorer
 * Handles loading, displaying, and exporting CSV datasets only
 */

// Dataset configuration - CSV files only
// Default date range matches promotion optimization season data.
const DEFAULT_DATE_RANGE = '2026-02-02 to 2026-05-25';

const DATASETS = {
  customers: {
    title: 'Customers',
    description: 'Customer master with channel mix, order behavior, basket value, promo affinity, and repeat-loss status',
    file: './data/customers.csv',
    recordCount: 70626,
    dateRange: 'Historical master through 2026-03-19',
    dateColumn: 'first_purchase_date',
    category: 'Core Data',
    icon: 'bi-people'
  },
  channel_weekly: {
    title: 'Channel Weekly KPIs',
    description: 'Weekly KPIs by channel group (mass vs prestige)',
    file: './data/channel_weekly.csv',
    recordCount: 34,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Core Data',
    icon: 'bi-graph-up'
  },
  product_channel_history: {
    title: '52-Week Product History',
    description: 'Rolling 52-week product x channel history with revenue, own price, competitor price gap, and social buzz',
    file: './data/product_channel_history.csv',
    recordCount: 1248,
    dateRange: '2025-03-24 to 2026-03-16',
    dateColumn: 'week_start',
    category: 'Core Data',
    icon: 'bi-activity'
  },
  season_calendar: {
    title: 'Season Calendar',
    description: 'Season phases, demand index, and inventory position',
    file: './data/season_calendar.csv',
    recordCount: 17,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Content Data',
    icon: 'bi-play-circle'
  },
  price_calendar: {
    title: 'Price Calendar',
    description: 'Promo cadence and effective price by channel group',
    file: './data/price_calendar.csv',
    recordCount: 34,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Pricing Data',
    icon: 'bi-tag'
  },
  market_signals: {
    title: 'Market Signals',
    description: 'Competitor and macro signals aligned to season',
    file: './data/market_signals.csv',
    recordCount: 17,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'External Data',
    icon: 'bi-globe'
  },
  competitor_price_feed: {
    title: 'Competitor Price Feed',
    description: 'Website-scraped competitor prices by retailer with SKU matching, promo flags, reviews, and availability',
    file: './data/competitor_price_feed.csv',
    recordCount: 408,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'captured_at',
    category: 'External Data',
    icon: 'bi-radar'
  },
  social_signals: {
    title: 'Social Signals',
    description: 'Platform-level social listening signals with mentions, sentiment, engagement, spend, and audience growth',
    file: './data/social_signals.csv',
    recordCount: 17,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Marketing Data',
    icon: 'bi-megaphone'
  },
  retail_events: {
    title: 'Retail Events',
    description: 'Retail events and competitive price moves by channel',
    file: './data/retail_events.csv',
    recordCount: 26,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Event Data',
    icon: 'bi-calendar-event'
  },
  sku_channel_weekly: {
    title: 'SKU Channel Weekly',
    description: 'Core optimization table by week, SKU, and channel with inventory and competitor fields',
    file: './data/sku_channel_weekly.csv',
    recordCount: 408,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Core Data',
    icon: 'bi-grid-3x3-gap'
  },
  segments: {
    title: 'Segments',
    description: '15,000 sampled customers tagged to acquisition, engagement, and monetization cohorts',
    file: './data/segments.csv',
    recordCount: 15000,
    dateRange: 'Current snapshot sample',
    category: 'Segmentation Data',
    icon: 'bi-diagram-3'
  },
  segment_kpis: {
    title: 'Segment KPIs',
    description: 'Segment KPIs (AOV, repeat loss, CAC, promo redemption)',
    file: './data/segment_kpis.csv',
    recordCount: 250,
    dateRange: 'Current snapshot',
    category: 'Segmentation Data',
    icon: 'bi-graph-up-arrow'
  }
};

// Group datasets by category
const CATEGORIES = {
  'Core Data': ['customers', 'channel_weekly', 'product_channel_history', 'sku_channel_weekly'],
  'Pricing Data': ['price_calendar'],
  'Event Data': ['retail_events'],
  'Segmentation Data': ['segments', 'segment_kpis'],
  'Marketing Data': ['social_signals'],
  'Content Data': ['season_calendar'],
  'External Data': ['market_signals', 'competitor_price_feed']
};

// State
let currentDataset = null;
let currentData = [];
let filteredData = [];
let currentPage = 1;
let rowsPerPage = 25;
let sortColumn = null;
let sortDirection = 'asc';
let datasetChart = null;
let datasetChartFilterValue = 'all';

/**
 * Initialize the data viewer
 */
export function initializeDataViewer() {
  console.log('Initializing Data Viewer...');

  // Build accordion
  buildAccordion();

  // Search
  document.getElementById('data-search').addEventListener('input', handleSearch);

  // Rows per page
  document.getElementById('rows-per-page').addEventListener('change', handleRowsPerPageChange);

  // Refresh
  document.getElementById('refresh-data-btn').addEventListener('click', refreshCurrentDataset);

  // Export button
  document.getElementById('export-csv-btn').addEventListener('click', () => exportData('csv'));
}

/**
 * Build the accordion structure
 */
function buildAccordion() {
  const accordion = document.getElementById('datasets-accordion');
  accordion.innerHTML = '';

  let categoryIndex = 0;
  for (const [category, datasetKeys] of Object.entries(CATEGORIES)) {
    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';

    const headerId = `heading-${categoryIndex}`;
    const collapseId = `collapse-${categoryIndex}`;

    accordionItem.innerHTML = `
      <h2 class="accordion-header" id="${headerId}">
        <button class="accordion-button ${categoryIndex === 0 ? '' : 'collapsed'}" type="button"
                data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                aria-expanded="${categoryIndex === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
          ${category}
        </button>
      </h2>
      <div id="${collapseId}" class="accordion-collapse collapse ${categoryIndex === 0 ? 'show' : ''}"
           aria-labelledby="${headerId}" data-bs-parent="#datasets-accordion">
        <div class="accordion-body">
          ${datasetKeys.map(key => {
            const dataset = DATASETS[key];
            return `
              <div class="dataset-item" data-dataset="${key}">
                <i class="bi ${dataset.icon} me-2"></i>
                <span>${dataset.title}</span>
                <small class="text-muted d-block ms-4" style="font-size: 0.75rem;">
                  ${dataset.recordCount.toLocaleString()} rows
                </small>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    accordion.appendChild(accordionItem);
    categoryIndex++;
  }

  // Add click handlers to dataset items
  document.querySelectorAll('.dataset-item').forEach(item => {
    item.addEventListener('click', () => {
      const datasetKey = item.dataset.dataset;
      handleDatasetSelection(datasetKey);
    });
  });
}

/**
 * Handle dataset selection
 */
async function handleDatasetSelection(datasetKey) {
  // Update active state
  document.querySelectorAll('.dataset-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-dataset="${datasetKey}"]`).classList.add('active');

  // Load dataset
  await loadDataset(datasetKey);
}

/**
 * Load and display a dataset
 */
async function loadDataset(datasetKey) {
  const dataset = DATASETS[datasetKey];

  if (!dataset) {
    console.error('Dataset not found:', datasetKey);
    return;
  }

  currentDataset = { key: datasetKey, ...dataset };
  datasetChartFilterValue = 'all';

  // Show loading state
  showLoading();

  try {
    // Load CSV data
    currentData = await loadCSV(dataset.file);
    displayCSVData();

    // Update dataset info
    updateDatasetInfo();

    // Render quick visual overview chart
    renderDatasetChart();

    // Render dataset-specific business guidance
    renderDatasetStoryPanel();

    // Enable export button
    document.getElementById('export-csv-btn').disabled = false;

  } catch (error) {
    console.error('Error loading dataset:', error);
    showError('Failed to load dataset: ' + error.message);
  }
}

/**
 * Load CSV file
 */
async function loadCSV(filePath) {
  const response = await fetch(filePath);
  const text = await response.text();

  // Parse CSV
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return data;
}

/**
 * Parse CSV line (handles quoted values with commas)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Display CSV data in table
 */
function displayCSVData() {
  filteredData = [...currentData];
  currentPage = 1;

  // Hide other views
  document.getElementById('data-empty').style.display = 'none';
  document.getElementById('data-loading').style.display = 'none';

  // Show table controls and container
  document.getElementById('data-controls').style.display = 'flex';
  document.getElementById('data-table-container').style.display = 'block';
  document.getElementById('pagination-container').style.display = 'flex';

  // Render table
  renderTable();
}

/**
 * Render table with pagination
 */
function renderTable() {
  const table = document.getElementById('data-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // Clear existing content
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (filteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100" class="text-center text-muted py-4">No data found</td></tr>';
    return;
  }

  // Get headers
  const headers = Object.keys(filteredData[0]);

  // Create header row
  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.style.whiteSpace = 'nowrap';

    // Add sort indicator
    if (sortColumn === header) {
      th.innerHTML += sortDirection === 'asc' ? ' ▲' : ' ▼';
    }

    // Add click handler for sorting
    th.addEventListener('click', () => handleSort(header));

    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Calculate pagination
  const totalRows = filteredData.length;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = rowsPerPage === 'all' ? totalRows : Math.min(startIndex + rowsPerPage, totalRows);
  const pageData = filteredData.slice(startIndex, endIndex);

  // Create data rows
  pageData.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header] || '';
      td.style.whiteSpace = 'nowrap';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  // Update pagination
  updatePagination(totalRows, startIndex, endIndex);
}

/**
 * Handle sorting
 */
function handleSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }

  filteredData.sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    // Try to parse as numbers
    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // String comparison
    aVal = String(aVal || '');
    bVal = String(bVal || '');

    if (sortDirection === 'asc') {
      return aVal.localeCompare(bVal);
    } else {
      return bVal.localeCompare(aVal);
    }
  });

  renderTable();
}

/**
 * Update pagination UI
 */
function updatePagination(totalRows, startIndex, endIndex) {
  const paginationInfo = document.getElementById('pagination-info');
  const pagination = document.getElementById('pagination');

  // Update info
  paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRows.toLocaleString()} rows`;

  // Calculate total pages
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(totalRows / rowsPerPage);

  // Clear pagination
  pagination.innerHTML = '';

  if (totalPages <= 1) {
    return;
  }

  // Previous button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
  prevLi.innerHTML = '<a class="page-link" href="#">Previous</a>';
  prevLi.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
  pagination.appendChild(prevLi);

  // Page numbers (show max 5 pages)
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener('click', (e) => {
      e.preventDefault();
      currentPage = i;
      renderTable();
    });
    pagination.appendChild(li);
  }

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
  nextLi.innerHTML = '<a class="page-link" href="#">Next</a>';
  nextLi.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
  pagination.appendChild(nextLi);
}

/**
 * Handle search
 */
function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase();

  if (!searchTerm) {
    filteredData = [...currentData];
  } else {
    filteredData = currentData.filter(row => {
      return Object.values(row).some(value => {
        return String(value).toLowerCase().includes(searchTerm);
      });
    });
  }

  currentPage = 1;
  renderTable();
}

/**
 * Handle rows per page change
 */
function handleRowsPerPageChange(event) {
  const value = event.target.value;
  rowsPerPage = value === 'all' ? 'all' : parseInt(value);
  currentPage = 1;
  renderTable();
}

/**
 * Compute actual date range from loaded data using a date column (YYYY-MM-DD).
 * Tries currentDataset.dateColumn, then common names: week_start, date, first_purchase_date.
 * @param {Array<Object>} data - Loaded rows
 * @returns {string|null} e.g. "2024-03-04 to 2026-02-23" or null
 */
function getDateRangeFromData(data) {
  if (!data || data.length === 0) return null;

  const dateColumn =
    currentDataset.dateColumn ||
    ['week_start', 'date', 'first_purchase_date', 'event_date'].find(
      (col) => data[0].hasOwnProperty(col)
    );
  if (!dateColumn) return null;

  const re = /^\d{4}-\d{2}-\d{2}$/;
  const values = data
    .map((row) => String(row[dateColumn] || '').trim())
    .filter((v) => re.test(v));

  if (values.length === 0) return null;

  const sorted = values.slice().sort();
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return min === max ? min : `${min} to ${max}`;
}

/**
 * Update dataset info panel
 */
function updateDatasetInfo() {
  const info = document.getElementById('dataset-info');
  document.getElementById('dataset-title').textContent = currentDataset.title;
  document.getElementById('dataset-description').textContent = currentDataset.description;

  const recordsText = `${currentData.length.toLocaleString()} records`;
  const columns = Object.keys(currentData[0] || {}).length;

  document.getElementById('dataset-records').textContent = recordsText;
  document.getElementById('dataset-columns').textContent = `${columns} columns`;

  const displayDateRange =
    getDateRangeFromData(currentData) ||
    currentDataset.dateRange ||
    'N/A';
  document.getElementById('dataset-date-range').textContent = displayDateRange;

  info.style.display = 'block';
}

function formatCompactValue(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

function formatSignedNumber(value, digits = 1, suffix = '') {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return `${num >= 0 ? '+' : ''}${num.toFixed(digits)}${suffix}`;
}

function getSentimentScore(row = {}) {
  const direct = Number(row.sentiment_score);
  if (Number.isFinite(direct)) return direct;

  const socialSentiment = Number(row.social_sentiment);
  if (Number.isFinite(socialSentiment)) {
    if (socialSentiment >= 0 && socialSentiment <= 1) return (socialSentiment - 0.5) * 200;
    if (socialSentiment >= -1 && socialSentiment <= 1) return socialSentiment * 100;
  }

  const brandIndex = Number(row.brand_social_index);
  if (Number.isFinite(brandIndex)) {
    return (brandIndex - 50) * 2;
  }

  return null;
}

function getSkuOptions(rows = [], idField = 'sku_id', nameField = 'sku_name') {
  const options = new Map();
  rows.forEach(row => {
    const id = String(row[idField] || '').trim();
    if (!id) return;
    const name = String(row[nameField] || id).trim();
    options.set(id, name === id ? id : `${id} - ${name}`);
  });
  return [...options.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

function renderDatasetChartToolbar() {
  const toolbar = document.getElementById('dataset-chart-toolbar');
  if (!toolbar) return;

  toolbar.innerHTML = '';
  if (!currentDataset) return;

  let options = [];
  let label = '';

  if (currentDataset.key === 'competitor_price_feed') {
    options = getSkuOptions(currentData, 'matched_sku_id', 'matched_sku_id');
    label = 'Product';
  } else if (currentDataset.key === 'product_channel_history' || currentDataset.key === 'sku_channel_weekly') {
    options = getSkuOptions(currentData, 'sku_id', 'sku_name');
    label = 'Product';
  }

  if (!options.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'd-flex align-items-center gap-2';
  wrapper.innerHTML = `
    <label for="dataset-chart-filter" class="small text-muted mb-0">${label}</label>
    <select id="dataset-chart-filter" class="form-select form-select-sm" style="min-width: 180px;">
      <option value="all">All Products</option>
      ${options.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
    </select>
  `;
  toolbar.appendChild(wrapper);

  const select = document.getElementById('dataset-chart-filter');
  if (!select) return;
  select.value = datasetChartFilterValue;
  select.addEventListener('change', (event) => {
    datasetChartFilterValue = event.target.value || 'all';
    renderDatasetChart();
    renderDatasetStoryPanel();
  });
}

function renderDatasetStoryPanel() {
  const panel = document.getElementById('dataset-story-panel');
  if (!panel || !currentDataset || !currentData.length) {
    if (panel) panel.style.display = 'none';
    return;
  }

  const key = currentDataset.key;
  let title = 'Why This Dataset Matters';
  let summary = '';
  let bullets = [];
  let cards = [];

  if (key === 'product_channel_history') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.sku_id) === String(datasetChartFilterValue));
    const latestWeek = [...new Set(scopedRows.map(row => row.week_start).filter(Boolean))].sort().pop();
    const latestRows = scopedRows.filter(row => row.week_start === latestWeek);
    const totalRevenue = scopedRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const channelRevenue = latestRows.reduce((acc, row) => {
      const channel = String(row.sales_channel || 'unknown').toLowerCase();
      acc[channel] = (acc[channel] || 0) + Number(row.revenue || 0);
      return acc;
    }, {});
    const topChannel = Object.entries(channelRevenue).sort((a, b) => b[1] - a[1])[0];
    const opportunityRows = [...latestRows]
      .filter(row => Number(row.sentiment_score || 0) > 20 && Number(row.price_gap_vs_competitor || 0) < 0)
      .sort((a, b) => Number(b.sentiment_score || 0) - Number(a.sentiment_score || 0));
    const opportunity = opportunityRows[0];

    title = 'Why This File Matters For The Story';
    summary = 'This is the proof behind the current-state view. It ties revenue to own price, competitor gap, and social support before any promotion simulation starts.';
    bullets = [
      'Use this file to explain where demand improved because sentiment rose, where competitor gaps widened, and where pricing opportunities were missed.',
      'If a client asks whether the dashboard is trend-based or just a point estimate, this is the historical evidence file.',
      datasetChartFilterValue === 'all'
        ? 'Filter to a single SKU when you want the same story at product level.'
        : 'You are already scoped to one SKU, so the chart and table now read as product-specific evidence.'
    ];
    cards = [
      { label: 'Rows In Scope', value: formatCompactValue(scopedRows.length, 0), detail: datasetChartFilterValue === 'all' ? 'All products across the rolling 52-week history' : 'Selected product across all channels' },
      { label: 'Revenue In Scope', value: `$${formatCompactValue(totalRevenue, 0)}`, detail: 'Historical revenue available for the current-state storyline' },
      { label: 'Latest Strongest Channel', value: topChannel ? String(topChannel[0]).toUpperCase() : 'N/A', detail: topChannel ? `$${formatCompactValue(topChannel[1], 0)} in the latest observed week` : 'No latest-week channel available' },
      { label: 'Missed Pricing Cue', value: opportunity ? `${opportunity.sku_name}` : 'No clear case', detail: opportunity ? `Sentiment ${formatSignedNumber(getSentimentScore(opportunity), 1, ' pts')} while priced ${formatSignedNumber(Number(opportunity.price_gap_vs_competitor || 0) * 100, 1, '%')} vs competitor` : 'No latest-week case with high sentiment and below-competitor pricing' }
    ];
  } else if (key === 'competitor_price_feed') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.matched_sku_id) === String(datasetChartFilterValue));
    const latestCapture = [...new Set(scopedRows.map(row => String(row.captured_at || '').slice(0, 10)).filter(Boolean))].sort().pop();
    const latestRows = scopedRows.filter(row => String(row.captured_at || '').slice(0, 10) === latestCapture);
    const promoFlags = scopedRows.filter(row => String(row.promo_flag).toLowerCase() === 'true').length;
    const lowestLatest = [...latestRows].sort((a, b) => Number(a.observed_price || 0) - Number(b.observed_price || 0))[0];

    title = 'Competitor Evidence';
    summary = 'This is the proof that competitor pricing is observed, not assumed. It is the source for the competitor-defense story in the current-state and event views.';
    bullets = [
      'Use the product filter to isolate one SKU and show how retailer pricing differs by channel.',
      'Promo flags show whether the competitor price was likely part of a discounting event or a steady-state price move.',
      'This is the dataset to reference when Ritesh wants a concrete competitor undercut example.'
    ];
    cards = [
      { label: 'Observed Captures', value: formatCompactValue(scopedRows.length, 0), detail: datasetChartFilterValue === 'all' ? 'All scraped competitor observations in scope' : 'Competitor captures for the selected product' },
      { label: 'Promo-Flagged Rows', value: formatCompactValue(promoFlags, 0), detail: `${formatCompactValue(scopedRows.length ? (promoFlags / scopedRows.length) * 100 : 0, 1)}% of captures flagged as competitor promo activity` },
      { label: 'Latest Capture Date', value: latestCapture || 'N/A', detail: 'Most recent competitor snapshot available in the explorer' },
      { label: 'Latest Lowest Price', value: lowestLatest ? `$${formatCompactValue(lowestLatest.observed_price, 2)}` : 'N/A', detail: lowestLatest ? `${String(lowestLatest.channel || '').toUpperCase()} for ${lowestLatest.matched_sku_id}` : 'No latest observation available' }
    ];
  } else if (key === 'social_signals') {
    const rows = [...currentData].sort((a, b) => String(a.week_start || '').localeCompare(String(b.week_start || '')));
    const sortedBySentiment = [...rows]
      .map(row => ({ ...row, score: getSentimentScore(row) }))
      .filter(row => Number.isFinite(row.score))
      .sort((a, b) => b.score - a.score);
    const peak = sortedBySentiment[0];
    const trough = sortedBySentiment[sortedBySentiment.length - 1];
    const latest = rows[rows.length - 1];
    const latestScore = getSentimentScore(latest);

    title = 'Sentiment Evidence';
    summary = 'This is where positive versus negative buzz comes from. Mentions alone are not enough; the sign and direction of sentiment is what matters for demand.';
    bullets = [
      'Use the sentiment score, not raw mention volume alone, when explaining why buzz should raise or reduce expected demand.',
      'This is the portfolio-level listening signal. Channel- and product-level social response then shows up downstream in the SKU history files.',
      'When the score is positive and still rising, that is the hold-price or lighter-promo story Ritesh wants to tell.'
    ];
    cards = [
      { label: 'Latest Sentiment', value: Number.isFinite(latestScore) ? formatSignedNumber(latestScore, 1, ' pts') : 'N/A', detail: latest?.week_start ? `Week of ${latest.week_start}` : 'Latest available social reading' },
      { label: 'Peak Positive Week', value: peak?.week_start || 'N/A', detail: peak ? `${formatSignedNumber(peak.score, 1, ' pts')} sentiment at the strongest week` : 'No sentiment series available' },
      { label: 'Weakest Week', value: trough?.week_start || 'N/A', detail: trough ? `${formatSignedNumber(trough.score, 1, ' pts')} sentiment at the lowest week` : 'No weak week identified' },
      { label: 'Peak Mention Volume', value: latest ? formatCompactValue(Math.max(...rows.map(row => Number(row.total_social_mentions || 0))), 0) : 'N/A', detail: 'Use with sentiment to separate loud negative buzz from positive momentum' }
    ];
  } else if (key === 'sku_channel_weekly') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.sku_id) === String(datasetChartFilterValue));
    const byChannel = scopedRows.reduce((acc, row) => {
      const channel = String(row.sales_channel || 'unknown').toLowerCase();
      if (!acc[channel]) {
        acc[channel] = { revenue: 0, units: 0, sentimentWeighted: 0, gapWeighted: 0 };
      }
      const units = Number(row.net_units_sold || row.own_units_sold || 0);
      const weight = units > 0 ? units : 1;
      acc[channel].revenue += Number(row.revenue || 0);
      acc[channel].units += units;
      acc[channel].sentimentWeighted += (Number(row.sentiment_score) || 0) * weight;
      acc[channel].gapWeighted += (Number(row.price_gap_vs_competitor) || 0) * weight;
      return acc;
    }, {});
    const rankedChannels = Object.entries(byChannel).sort((a, b) => b[1].revenue - a[1].revenue);
    const bestChannel = rankedChannels[0];
    const weakestSentiment = Object.entries(byChannel)
      .map(([channel, metrics]) => ({ channel, sentiment: metrics.units ? metrics.sentimentWeighted / metrics.units : 0 }))
      .sort((a, b) => a.sentiment - b.sentiment)[0];

    title = 'Weekly SKU x Channel Operating Evidence';
    summary = 'This is the operating table behind the in-season story. It combines inventory, effective price, competitor price, elasticity, units, revenue, and sentiment at SKU x channel level.';
    bullets = [
      'Use this file when Ritesh asks to show channel-specific social or competitor response for a product.',
      'It is the closest dataset to the weekly operating decisions the client would review in season.',
      'Selected-product mode is the best way to explain why one SKU should be promoted in one channel but held in another.'
    ];
    cards = [
      { label: 'Rows In Scope', value: formatCompactValue(scopedRows.length, 0), detail: datasetChartFilterValue === 'all' ? 'Season rows across all SKU x channel combinations' : 'Season rows for the selected product' },
      { label: 'Top Revenue Channel', value: bestChannel ? String(bestChannel[0]).toUpperCase() : 'N/A', detail: bestChannel ? `$${formatCompactValue(bestChannel[1].revenue, 0)} season revenue` : 'No channel revenue found' },
      { label: 'Weakest Sentiment Channel', value: weakestSentiment ? String(weakestSentiment.channel).toUpperCase() : 'N/A', detail: weakestSentiment ? `${formatSignedNumber(weakestSentiment.sentiment, 1, ' pts')} average sentiment` : 'No sentiment view found' },
      { label: 'Inventory-Decision Use', value: 'SKU x Channel', detail: 'This is the file later used for inventory, elasticity, and promo decision logic' }
    ];
  } else if (key === 'retail_events') {
    const eventCounts = currentData.reduce((acc, row) => {
      const type = String(row.event_type || 'Unknown');
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const topType = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0];
    const datedRows = [...currentData].filter(row => row.event_start_date || row.week_start).sort((a, b) => String(a.event_start_date || a.week_start).localeCompare(String(b.event_start_date || b.week_start)));
    const nextWindow = datedRows[0];

    title = 'Event Calendar Source Data';
    summary = 'This is the event list the Event Calendar uses later. Seasonal tentpoles, promotions, competitor shocks, and social spikes should all be visible here in raw form.';
    bullets = [
      'If an event appears later in the Event Calendar, the client should be able to see it here first in the source data.',
      'Promotion type, event window, and affected SKU fields were added so event detail panels read like business records, not placeholders.',
      'This is the file to inspect when you want to prove an event really belongs in the story.'
    ];
    cards = [
      { label: 'Event Rows', value: formatCompactValue(currentData.length, 0), detail: 'Raw events available in the current explorer dataset' },
      { label: 'Most Common Event Type', value: topType ? topType[0] : 'N/A', detail: topType ? `${formatCompactValue(topType[1], 0)} rows` : 'No event mix found' },
      { label: 'Earliest Window', value: nextWindow ? String(nextWindow.event_start_date || nextWindow.week_start) : 'N/A', detail: nextWindow ? `${nextWindow.event_type} entry available in source data` : 'No dated event found' },
      { label: 'Storyline Use', value: 'Promos + Competitor + Social + Tentpoles', detail: 'This is the raw proof behind the four-event story Ritesh asked to simplify to' }
    ];
  } else {
    title = 'Why This Dataset Matters';
    summary = 'This dataset contributes to the broader promotion optimization story and can be exported or searched directly from the explorer.';
    bullets = [
      'Use the quick visual plus the raw table to inspect what the file contains before it feeds a later screen.',
      'The goal of Step 1 is evidence and traceability, not simulation.'
    ];
    cards = [
      { label: 'Rows', value: formatCompactValue(currentData.length, 0), detail: 'Current dataset size' },
      { label: 'Columns', value: formatCompactValue(Object.keys(currentData[0] || {}).length, 0), detail: 'Available fields in the file' },
      { label: 'Date Coverage', value: getDateRangeFromData(currentData) || 'N/A', detail: 'Observed date window in the loaded rows' }
    ];
  }

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="card border-0 bg-body-tertiary">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h6 class="small text-uppercase text-muted mb-1"><i class="bi bi-journal-text me-1"></i>${title}</h6>
            <div class="small">${summary}</div>
          </div>
        </div>
        <div class="row g-3 mb-3">
          ${cards.map(card => `
            <div class="col-lg-3 col-md-6">
              <div class="border rounded h-100 p-3 bg-body">
                <div class="small text-muted text-uppercase mb-1">${card.label}</div>
                <div class="fw-semibold mb-1">${card.value}</div>
                <div class="small text-muted">${card.detail}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <ul class="small mb-0">
          ${bullets.map(bullet => `<li>${bullet}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

/**
 * Render a small, dataset-specific chart above the table
 * Uses Chart.js (already loaded globally)
 */
function renderDatasetChart() {
  const container = document.getElementById('dataset-chart-container');
  const captionEl = document.getElementById('dataset-chart-caption');
  const canvas = document.getElementById('dataset-chart');
  const toolbar = document.getElementById('dataset-chart-toolbar');

  if (!container || !canvas || typeof Chart === 'undefined') {
    return;
  }

  if (!currentDataset || !currentData || currentData.length === 0) {
    container.style.display = 'none';
    if (toolbar) toolbar.innerHTML = '';
    if (datasetChart) {
      datasetChart.destroy();
      datasetChart = null;
    }
    return;
  }

  renderDatasetChartToolbar();

  const ctx = canvas.getContext('2d');

  // Helper to safely parse numbers
  const toNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const key = currentDataset.key;
  let config = null;
  let caption = '';

  if (key === 'channel_weekly') {
    // Line chart: weekly revenue by channel group (mass vs prestige)
    const massByDate = {};
    const prestigeByDate = {};

    currentData.forEach(row => {
      const date = row.week_start;
      const group = row.channel_group;
      const revenue = toNumber(row.revenue);
      if (!date) return;
      if (group === 'mass') {
        massByDate[date] = (massByDate[date] || 0) + revenue;
      } else if (group === 'prestige') {
        prestigeByDate[date] = (prestigeByDate[date] || 0) + revenue;
      }
    });

    const labels = Array.from(
      new Set([...Object.keys(massByDate), ...Object.keys(prestigeByDate)])
    ).sort();

    const massSeries = labels.map(d => massByDate[d] || 0);
    const prestigeSeries = labels.map(d => prestigeByDate[d] || 0);

    config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Target & Amazon revenue',
            data: massSeries,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 2,
            tension: 0.3
          },
          {
            label: 'Sephora & Ulta revenue',
            data: prestigeSeries,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            borderWidth: 2,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          }
        }
      }
    };
    caption = 'Weekly revenue by channel group';
  } else if (key === 'price_calendar') {
    // Line chart: effective price by channel group
    const massByDate = {};
    const prestigeByDate = {};

    currentData.forEach(row => {
      const date = row.week_start;
      const group = row.channel_group;
      const price = toNumber(row.effective_price);
      if (!date) return;
      if (group === 'mass') {
        massByDate[date] = price;
      } else if (group === 'prestige') {
        prestigeByDate[date] = price;
      }
    });

    const labels = Array.from(
      new Set([...Object.keys(massByDate), ...Object.keys(prestigeByDate)])
    ).sort();

    const massSeries = labels.map(d => massByDate[d] || null);
    const prestigeSeries = labels.map(d => prestigeByDate[d] || null);

    config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Mass effective price',
            data: massSeries,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Prestige effective price',
            data: prestigeSeries,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderWidth: 2,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${value}`
            }
          }
        }
      }
    };
    caption = 'Effective price by channel group';
  } else if (key === 'market_signals') {
    // Line chart: category demand index over time
    const byDate = {};

    currentData.forEach(row => {
      const date = row.week_start;
      const demand = toNumber(row.category_demand_index);
      if (!date) return;
      byDate[date] = demand;
    });

    const labels = Object.keys(byDate).sort();
    const series = labels.map(d => byDate[d]);

    config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Category demand index',
            data: series,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderWidth: 2,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        }
      }
    };
    caption = 'Seasonal demand signal over time';
  } else if (key === 'product_channel_history') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.sku_id) === String(datasetChartFilterValue));
    const byDate = {};

    scopedRows.forEach(row => {
      const date = row.week_start;
      if (!date) return;
      if (!byDate[date]) {
        byDate[date] = { revenue: 0, gapWeighted: 0, socialWeighted: 0, ownPriceWeighted: 0, units: 0 };
      }
      const revenue = toNumber(row.revenue);
      const units = toNumber(row.units_sold) || 1;
      byDate[date].revenue += revenue;
      byDate[date].gapWeighted += toNumber(row.price_gap_vs_competitor) * units;
      byDate[date].socialWeighted += toNumber(row.social_buzz_score) * units;
      byDate[date].ownPriceWeighted += toNumber(row.own_price) * units;
      byDate[date].units += units;
    });

    const labels = Object.keys(byDate).sort();
    const revenueSeries = labels.map(label => byDate[label].revenue);
    const socialSeries = labels.map(label => byDate[label].units > 0 ? byDate[label].socialWeighted / byDate[label].units : null);
    const priceSeries = labels.map(label => byDate[label].units > 0 ? byDate[label].ownPriceWeighted / byDate[label].units : null);
    const gapSeries = labels.map(label => byDate[label].units > 0 ? (byDate[label].gapWeighted / byDate[label].units) * 100 : null);

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Portfolio revenue',
            data: revenueSeries,
            backgroundColor: 'rgba(59, 130, 246, 0.35)',
            borderColor: 'rgba(59, 130, 246, 0.65)',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Avg own price',
            data: priceSeries,
            borderColor: '#111827',
            backgroundColor: 'rgba(17, 24, 39, 0.12)',
            borderWidth: 2,
            pointRadius: 1.5,
            tension: 0.25,
            yAxisID: 'y1'
          },
          {
            type: 'line',
            label: 'Avg social buzz',
            data: socialSeries,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            borderWidth: 2,
            pointRadius: 1.5,
            tension: 0.25,
            yAxisID: 'y2'
          },
          {
            type: 'line',
            label: 'Avg competitor gap %',
            data: gapSeries,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 1.5,
            tension: 0.25,
            yAxisID: 'y3'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            position: 'left'
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false }
          },
          y2: {
            position: 'right',
            display: false,
            grid: { drawOnChartArea: false }
          },
          y3: {
            position: 'right',
            display: false,
            grid: { drawOnChartArea: false }
          }
        }
      }
    };
    caption = datasetChartFilterValue === 'all'
      ? '52-week portfolio revenue, own price, social buzz, and competitor gap'
      : '52-week selected-product revenue, own price, social buzz, and competitor gap';
  } else if (key === 'competitor_price_feed') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.matched_sku_id) === String(datasetChartFilterValue));
    const byDateChannel = {
      target: {},
      amazon: {},
      sephora: {},
      ulta: {}
    };

    scopedRows.forEach(row => {
      const date = String(row.captured_at || '').slice(0, 10);
      const channel = String(row.channel || '').toLowerCase();
      const price = toNumber(row.observed_price);
      if (!date || !byDateChannel[channel]) return;
      if (!byDateChannel[channel][date]) {
        byDateChannel[channel][date] = [];
      }
      byDateChannel[channel][date].push(price);
    });

    const labels = Array.from(new Set(
      Object.values(byDateChannel).flatMap(channelMap => Object.keys(channelMap))
    )).sort();

    const averageSeries = (channel) => labels.map(label => {
      const values = byDateChannel[channel][label] || [];
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });

    config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Target competitor price',
            data: averageSeries('target'),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            borderWidth: 2,
            tension: 0.25
          },
          {
            label: 'Amazon competitor price',
            data: averageSeries('amazon'),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            borderWidth: 2,
            tension: 0.25
          },
          {
            label: 'Sephora competitor price',
            data: averageSeries('sephora'),
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.12)',
            borderWidth: 2,
            tension: 0.25
          },
          {
            label: 'Ulta competitor price',
            data: averageSeries('ulta'),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderWidth: 2,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${Number(value).toFixed(0)}`
            }
          }
        }
      }
    };
    caption = datasetChartFilterValue === 'all'
      ? 'Observed competitor prices by retailer over time'
      : 'Observed competitor prices for the selected product by retailer';
  } else if (key === 'social_signals') {
    const labels = currentData
      .map(row => row.week_start)
      .filter(Boolean)
      .sort();

    const rowsByDate = Object.fromEntries(currentData.map(row => [row.week_start, row]));
    const mentionsSeries = labels.map(label => toNumber(rowsByDate[label]?.total_social_mentions));
    const sentimentSeries = labels.map(label => getSentimentScore(rowsByDate[label]));

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Total social mentions',
            data: mentionsSeries,
            backgroundColor: 'rgba(14, 165, 233, 0.35)',
            borderColor: 'rgba(14, 165, 233, 0.6)',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Sentiment score (-100 to +100)',
            data: sentimentSeries,
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.15)',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.25,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            position: 'left',
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            min: -100,
            max: 100,
            ticks: {
              callback: (value) => Number(value).toFixed(0)
            }
          }
        }
      }
    };
    caption = 'Weekly social buzz volume with positive vs negative sentiment';
  } else if (key === 'sku_channel_weekly') {
    const scopedRows = datasetChartFilterValue === 'all'
      ? currentData
      : currentData.filter(row => String(row.sku_id) === String(datasetChartFilterValue));
    const byChannel = {};
    scopedRows.forEach(row => {
      const channel = String(row.sales_channel || '').toLowerCase();
      if (!channel) return;
      if (!byChannel[channel]) {
        byChannel[channel] = { revenue: 0, units: 0, gapWeighted: 0, sentimentWeighted: 0 };
      }
      const units = toNumber(row.net_units_sold) || toNumber(row.own_units_sold) || 1;
      byChannel[channel].revenue += toNumber(row.revenue);
      byChannel[channel].units += units;
      byChannel[channel].gapWeighted += toNumber(row.price_gap_vs_competitor) * units;
      byChannel[channel].sentimentWeighted += (getSentimentScore(row) ?? 0) * units;
    });

    const labels = Object.keys(byChannel).sort();
    const revenueSeries = labels.map(label => byChannel[label].revenue);
    const gapSeries = labels.map(label => byChannel[label].units > 0 ? (byChannel[label].gapWeighted / byChannel[label].units) * 100 : null);
    const sentimentSeries = labels.map(label => byChannel[label].units > 0 ? (byChannel[label].sentimentWeighted / byChannel[label].units) : null);

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Revenue',
            data: revenueSeries,
            backgroundColor: 'rgba(59, 130, 246, 0.35)',
            borderColor: 'rgba(59, 130, 246, 0.65)',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Avg sentiment score',
            data: sentimentSeries,
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.2,
            yAxisID: 'y1'
          },
          {
            type: 'line',
            label: 'Avg competitor gap %',
            data: gapSeries,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.2,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            position: 'left',
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          },
          y1: {
            position: 'right',
            min: -100,
            max: 100,
            grid: { drawOnChartArea: false }
          },
          y2: {
            position: 'right',
            display: false,
            grid: { drawOnChartArea: false }
          }
        }
      }
    };
    caption = datasetChartFilterValue === 'all'
      ? 'Channel-level operating view: revenue, sentiment, and competitor gap'
      : 'Selected-product channel view: revenue, sentiment, and competitor gap';
  } else if (key === 'retail_events') {
    const byType = {};
    currentData.forEach(row => {
      const type = String(row.event_type || 'Unknown');
      byType[type] = (byType[type] || 0) + 1;
    });

    const labels = Object.keys(byType);
    const counts = labels.map(label => byType[label]);

    config = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: [
              'rgba(14, 165, 233, 0.82)',
              'rgba(239, 68, 68, 0.82)',
              'rgba(139, 92, 246, 0.82)',
              'rgba(245, 158, 11, 0.82)'
            ],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' }
        }
      }
    };
    caption = 'Event mix used later in the Event Calendar story';
  } else if (key === 'segment_kpis') {
    // Bar chart: top segments by customer count
    const sorted = [...currentData].sort((a, b) => {
      return toNumber(b.customer_count) - toNumber(a.customer_count);
    });

    const top = sorted.slice(0, 8);
    const labels = top.map(row => row.segment_key || row.segment || 'Segment');
    const counts = top.map(row => toNumber(row.customer_count));

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Customers',
            data: counts,
            backgroundColor: 'rgba(59, 130, 246, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, minRotation: 0 }
          },
          y: {
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          }
        }
      }
    };
    caption = 'Top segments by customer count';
  } else if (key === 'customers') {
    // Bar chart: customers by channel_group
    const byGroup = {};
    currentData.forEach(row => {
      const group = row.channel_group || 'Other';
      byGroup[group] = (byGroup[group] || 0) + 1;
    });

    const labels = Object.keys(byGroup);
    const counts = labels.map(g => byGroup[g]);

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Customers',
            data: counts,
            backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f97316']
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          }
        }
      }
    };
    caption = 'Customer count by channel group';
  }

  if (!config) {
    container.style.display = 'none';
    if (toolbar) toolbar.innerHTML = '';
    if (datasetChart) {
      datasetChart.destroy();
      datasetChart = null;
    }
    return;
  }

  if (datasetChart) {
    datasetChart.destroy();
  }

  datasetChart = new Chart(ctx, config);
  if (captionEl) {
    captionEl.textContent = caption;
  }
  container.style.display = 'block';
}

/**
 * Export data as CSV
 */
function exportData(format) {
  if (!currentData || currentData.length === 0) {
    alert('No data to export');
    return;
  }

  const csvContent = dataToCSV(currentData);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const filename = `${currentDataset.key}_export.csv`;

  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert data to CSV string
 */
function dataToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (String(value).includes(',') || String(value).includes('"')) {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Refresh current dataset
 */
async function refreshCurrentDataset() {
  if (currentDataset) {
    await loadDataset(currentDataset.key);
  }
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('dataset-info').style.display = 'none';
  const chartContainer = document.getElementById('dataset-chart-container');
  if (chartContainer) chartContainer.style.display = 'none';
  document.getElementById('data-controls').style.display = 'none';
  document.getElementById('data-table-container').style.display = 'none';
  document.getElementById('pagination-container').style.display = 'none';
  document.getElementById('data-empty').style.display = 'none';
  document.getElementById('data-loading').style.display = 'block';
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('data-loading').style.display = 'none';
  document.getElementById('data-empty').style.display = 'block';
  document.getElementById('data-empty').innerHTML = `
    <i class="bi bi-exclamation-triangle-fill text-danger display-4 mb-3"></i>
    <p class="text-danger">${message}</p>
  `;
}
