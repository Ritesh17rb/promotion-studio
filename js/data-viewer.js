/**
 * Data Viewer Module - Accordion-based CSV Data Explorer
 * Handles loading, displaying, and exporting CSV datasets only
 */

// Dataset configuration - CSV files only
// Default date range matches generated data: 2024-03-04 to 2026-02-23 (generate_promo_data.py)
const DEFAULT_DATE_RANGE = '2024-03-04 to 2026-02-23';

const DATASETS = {
  customers: {
    title: 'Customers',
    description: 'Customer-level records with channel group, region, and purchase behavior',
    file: './data/customers.csv',
    recordCount: 500000,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'first_purchase_date',
    category: 'Core Data',
    icon: 'bi-people'
  },
  channel_weekly: {
    title: 'Channel Weekly KPIs',
    description: 'Weekly KPIs by channel group (mass vs prestige)',
    file: './data/channel_weekly.csv',
    recordCount: 360,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Core Data',
    icon: 'bi-graph-up'
  },
  season_calendar: {
    title: 'Season Calendar',
    description: 'Season phases, demand index, and inventory position',
    file: './data/season_calendar.csv',
    recordCount: 180,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Content Data',
    icon: 'bi-play-circle'
  },
  price_calendar: {
    title: 'Price Calendar',
    description: 'Promo cadence and effective price by channel group',
    file: './data/price_calendar.csv',
    recordCount: 360,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Pricing Data',
    icon: 'bi-tag'
  },
  market_signals: {
    title: 'Market Signals',
    description: 'Competitor and macro signals aligned to season',
    file: './data/market_signals.csv',
    recordCount: 180,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'External Data',
    icon: 'bi-globe'
  },
  social_signals: {
    title: 'Social Signals',
    description: 'Social listening proxy signals (mentions, sentiment, spend)',
    file: './data/social_signals.csv',
    recordCount: 180,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Marketing Data',
    icon: 'bi-megaphone'
  },
  retail_events: {
    title: 'Retail Events',
    description: 'Retail events and competitive price moves by channel',
    file: './data/retail_events.csv',
    recordCount: 52,
    dateRange: DEFAULT_DATE_RANGE,
    dateColumn: 'week_start',
    category: 'Event Data',
    icon: 'bi-calendar-event'
  },
  segments: {
    title: 'Segments',
    description: 'Behavioral segments mapped to channel group',
    file: './data/segments.csv',
    recordCount: 15000,
    dateRange: 'N/A',
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
  'Core Data': ['customers', 'channel_weekly'],
  'Pricing Data': ['price_calendar'],
  'Event Data': ['retail_events'],
  'Segmentation Data': ['segments', 'segment_kpis'],
  'Marketing Data': ['social_signals'],
  'Content Data': ['season_calendar'],
  'External Data': ['market_signals']
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

/**
 * Render a small, dataset-specific chart above the table
 * Uses Chart.js (already loaded globally)
 */
function renderDatasetChart() {
  const container = document.getElementById('dataset-chart-container');
  const captionEl = document.getElementById('dataset-chart-caption');
  const canvas = document.getElementById('dataset-chart');

  if (!container || !canvas || typeof Chart === 'undefined') {
    return;
  }

  if (!currentDataset || !currentData || currentData.length === 0) {
    container.style.display = 'none';
    if (datasetChart) {
      datasetChart.destroy();
      datasetChart = null;
    }
    return;
  }

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
            label: 'Mass Channel revenue',
            data: massSeries,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 2,
            tension: 0.3
          },
          {
            label: 'Prestige Channel revenue',
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
