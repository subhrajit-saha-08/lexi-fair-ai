/* ═══════════════════════════════════════════════════════════
   LEXI-FAIR AI — script.js
   Phase 6: Dynamic DOM, Quarantine & Export
   ─────────────────────────────────────────────────────────
   Responsibilities:
     • Handle file selection via <input type="file">
     • Handle drag-and-drop onto the drop zone
     • Parse the .csv file with PapaParse
     • Read the Target Variable dropdown value
     • POST parsed data to Flask /api/v1/analyze
     • Render AI analysis results to the Results Dashboard
     • Display fairness score with colour-coded meter
     • Show flagged columns as warning badges
     • Quarantine & Clean: strip flagged columns from CSV data
     • Export cleaned dataset as a downloadable .csv file
════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Module-level state ─────────────────────────────────── */
/** @type {File|null} The currently selected CSV file */
let selectedFile = null;

/** @type {Object[]|null} Parsed JSON rows from the last parse */
let parsedData = null;

/** @type {string[]|null} Column header names from the last parse */
let parsedHeaders = null;

/** @type {string[]|null} Flagged columns returned by the AI */
let lastFlaggedColumns = null;

/** @type {Object|null} Last API response for re-rendering on language change */
let lastApiResponse = null;

/** @type {string} Current selected language for translations */
let currentLang = 'en';

/* ─── DOM References ─────────────────────────────────────── */
const dropzone               = document.getElementById('dropzone');
const fileInput              = document.getElementById('file-input');
const browseLink             = document.getElementById('browse-link');
const fileLabel              = document.getElementById('file-label');
const scanBtn                = document.getElementById('scan-btn');
const targetVariableDropdown = document.getElementById('target-variable-dropdown');
const languageDropdown       = document.getElementById('language-dropdown');

if (languageDropdown) {
  languageDropdown.addEventListener('change', function (e) {
    currentLang = e.target.value;
    if (lastApiResponse) {
      renderResults(lastApiResponse);
    }
  });
}

/* Results dashboard elements */
const resultsStatus    = document.getElementById('results-status');
const statRows         = document.getElementById('stat-rows');
const statCols         = document.getElementById('stat-cols');
const statBias         = document.getElementById('stat-bias');
const statFlags        = document.getElementById('stat-flags');
const tableWrapper     = document.getElementById('table-wrapper');
const tableEmptyState  = document.getElementById('table-empty-state');
const resultsTable     = document.getElementById('results-table');
const tableHead        = document.getElementById('table-head');
const tableBody        = document.getElementById('table-body');

/* ══════════════════════════════════════════════════════════
   1. UTILITY — validate that a given File is a CSV
══════════════════════════════════════════════════════════ */
/**
 * Returns true if the file has a .csv extension or the CSV mime type.
 * @param {File} file
 * @returns {boolean}
 */
function isCSVFile(file) {
  if (!file) return false;
  const nameOk = file.name.toLowerCase().endsWith('.csv');
  const typeOk = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';
  return nameOk || typeOk;
}

/* ══════════════════════════════════════════════════════════
   2. FILE SELECTION — update UI state when a file is chosen
══════════════════════════════════════════════════════════ */
/**
 * Accepts a File object, validates it, updates the label text,
 * and enables/disables the Scan button accordingly.
 * @param {File} file
 */
function handleFileSelection(file) {
  if (!file) return;

  if (!isCSVFile(file)) {
    setUIError('⚠️  Only .csv files are accepted.');
    selectedFile = null;
    scanBtn.disabled = true;
    return;
  }

  selectedFile = file;
  fileLabel.textContent = `✅  ${file.name}  (${formatBytes(file.size)})`;
  fileLabel.style.color = '#10b981';
  scanBtn.disabled = false;
  /* Advance the step wizard */
  advanceStep(2);
}

/**
 * Formats raw bytes into a human-readable string (KB / MB).
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/* ══════════════════════════════════════════════════════════
   3. PAPAPARSE — parse the selected CSV file
══════════════════════════════════════════════════════════ */
/**
 * Runs PapaParse on the given File object.
 * On completion, updates the stat cards and POSTs to the API.
 * @param {File} file
 */
function parseCSV(file) {
  setUIScanning();

  /* Hide any stale raw preview */
  const rawPrev = document.getElementById('raw-data-preview');
  if (rawPrev) rawPrev.hidden = true;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,

    complete: function (results) {
      const dataArray = results.data;
      const headers   = results.meta.fields;

      parsedData    = dataArray;
      parsedHeaders = headers;

      /* Update the stat cards with dataset dimensions */
      setStatValue(statRows, dataArray.length.toLocaleString());
      setStatValue(statCols, headers.length.toLocaleString());

      /* Inject raw data preview (first 3 rows) */
      renderRawPreview(headers, dataArray.slice(0, 3));

      if (results.errors.length > 0) {
        console.warn('[Lexi-Fair AI] Parse warnings:', results.errors);
      }

      /* Hand off to the API */
      sendToAPI(dataArray);
    },

    error: function (error) {
      setUIError(`❌  Parse failed — ${error.message}`);
    }
  });
}

/**
 * Renders a compact 3-row raw data preview above the Scan button.
 * @param {string[]} headers
 * @param {Object[]} rows  - First 3 rows only
 */
function renderRawPreview(headers, rows) {
  const container = document.getElementById('raw-data-preview');
  if (!container) return;

  container.hidden = false;
  container.innerHTML = `
    <div class="raw-preview-label">Raw Data Preview <span class="raw-preview-tag">First 3 Rows</span></div>
    <div class="raw-preview-scroll">
      <table class="raw-preview-table">
        <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row =>
            `<tr>${headers.map(h => `<td>${escapeHTML(String(row[h] ?? ''))}</td>`).join('')}</tr>`
          ).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   4. EVENT LISTENERS
══════════════════════════════════════════════════════════ */

/* ── 4a. Click on "browse to upload" link → trigger hidden input ── */
if (browseLink) {
  browseLink.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });
}

/* ── 4b. Hidden <input type="file"> change ── */
if (fileInput) {
  fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0] || null;
    handleFileSelection(file);
  });
}

/* ── 4c. Drag events on the dropzone ── */
if (dropzone) {
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', function (e) {
    if (!dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('drag-over');
    }
  });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0] || null;
    if (file) handleFileSelection(file);
  });
}

/* ── 4d. "Scan Dataset" button click → trigger PapaParse ── */
if (scanBtn) {
  scanBtn.addEventListener('click', function () {
    if (!selectedFile) return;
    /* Remove any previous quarantine panel before a new scan */
    removeQuarantinePanel();
    parseCSV(selectedFile);
  });
}

/* ── 4e. Trap Dataset Cards ── */
const TRAP_DATASETS = {
  'card-banking': { file: 'datasets/banking.csv',      label: 'banking.csv',      targetValue: 'loan-approval'    },
  'card-tech':    { file: 'datasets/tech_hiring.csv',  label: 'tech_hiring.csv',  targetValue: 'tech-hiring'      },
  'card-safe':    { file: 'datasets/safe_dataset.csv', label: 'safe_dataset.csv', targetValue: 'default-outcome'  }
};

Object.entries(TRAP_DATASETS).forEach(([cardId, meta]) => {
  const card = document.getElementById(cardId);
  if (!card) return;

  const activateCard = () => {
    /* Highlight the selected card */
    document.querySelectorAll('.dataset-card').forEach(c => c.classList.remove('card-active'));
    card.classList.add('card-active');

    /* Auto-select the matching target variable */
    if (targetVariableDropdown) targetVariableDropdown.value = meta.targetValue;

    /* Fetch CSV → convert to File → pass through normal file handler */
    fetch(meta.file)
      .then(r => { if (!r.ok) throw new Error('Dataset file not found. Check frontend/datasets/ folder.'); return r.blob(); })
      .then(blob => {
        const file = new File([blob], meta.label, { type: 'text/csv' });
        handleFileSelection(file);
        document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      })
      .catch(err => setUIError(`❌ Could not load preset dataset — ${err.message}`));
  };

  card.addEventListener('click', activateCard);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateCard(); } });
});

/* ══════════════════════════════════════════════════════════
   5. API CALL
══════════════════════════════════════════════════════════ */

const API_URL = 'http://localhost:5000/api/v1/analyze';

/**
 * Reads the Target Variable dropdown, builds the request payload,
 * POSTs it to the Flask backend, then renders the results.
 * @param {Object[]} dataArray - The parsed CSV rows from PapaParse
 */
async function sendToAPI(dataArray) {
  const targetVariable = targetVariableDropdown ? targetVariableDropdown.value : '';

  /* Validate target variable selection */
  if (!targetVariable) {
    setUIError('⚠️  Please select a Target Variable from the left panel before scanning.');
    return;
  }

  const payload = {
    data: dataArray,
    target_variable: targetVariable
  };

  try {
    const startTime = Date.now();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned ${response.status}`);
    }

    const json = await response.json();
    console.info('[Lexi-Fair AI] ✅ Backend API Response:', json);

    /* Enforce minimum 3s for the Hacker Theatre animation */
    const elapsed = Date.now() - startTime;
    if (elapsed < 3000) {
      await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));
    }

    /* Hand off to DOM renderer */
    renderResults(json);

  } catch (error) {
    setUIError(`❌  API call failed — ${error.message}. Make sure the backend server is running on port 5000.`);
  }
}

/* ══════════════════════════════════════════════════════════
   6. DOM RENDERING — inject AI results into the dashboard
══════════════════════════════════════════════════════════ */

/**
 * Master render function — parses the API JSON and populates
 * all result components: score meter, flagged columns, schema table.
 * @param {Object} json - Raw API response object
 */
function renderResults(json) {
  /* Store response for language toggling */
  lastApiResponse = json;

  /* ── Destructure safely ── */
  const targetVar      = json.target_variable  || '—';
  const schemaHeaders  = json.schema_headers   || [];
  const analysis       = json.analysis         || {};
  const fairnessScore  = typeof analysis.fairness_score  === 'number' ? analysis.fairness_score  : null;
  const rawFlagged     = Array.isArray(analysis.flagged_columns) ? analysis.flagged_columns : [];

  /* Normalize flagged columns to support the rich schema */
  const flaggedColumns = rawFlagged.map(col => {
    if (typeof col === 'string') {
      return { column_name: col, risk_score: 0, risk_category: 'Unknown', explanation: { en: 'No explanation provided' } };
    }
    return col;
  });

  const flaggedColumnNames = flaggedColumns.map(c => c.column_name);

  /* Store for quarantine step (requires strings) */
  lastFlaggedColumns = flaggedColumnNames;

  /* ── Restore upload section from collapsed state ── */
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.classList.remove('upload-section--collapsed');

  /* ── Advance step indicators ── */
  advanceStep(3);

  /* ── Update status indicator ── */
  setResultsStatus('complete');

  /* ── Stat cards with glow ── */
  renderFairnessScore(fairnessScore);
  setStatValue(statFlags, flaggedColumns.length.toString());

  /* Add glow class to flags stat card */
  if (statFlags) {
    statFlags.classList.remove('stat-card--danger', 'stat-card--warning', 'stat-card--success');
    statFlags.classList.add(flaggedColumns.length > 0 ? 'stat-card--danger' : 'stat-card--success');
  }

  /* ── Hide empty state, show analysis panel ── */
  tableEmptyState.style.display = 'none';

  /* Replace table wrapper content with the analysis panel */
  renderAnalysisPanel(targetVar, schemaHeaders, fairnessScore, flaggedColumns);

  /* ── Show quarantine section ── */
  if (flaggedColumnNames.length > 0) {
    renderQuarantinePanel(flaggedColumnNames);
  }
}

/**
 * Colour-codes and populates the Bias Score stat card.
 * @param {number|null} score
 */
function renderFairnessScore(score) {
  const valueEl = statBias.querySelector('.stat-value');
  const labelEl = statBias.querySelector('.stat-label');

  statBias.classList.remove('stat-card--danger', 'stat-card--warning', 'stat-card--success');

  if (score === null) {
    valueEl.textContent = '—';
    valueEl.style.color = '';
    statBias.style.borderColor = '';
    return;
  }

  valueEl.textContent = `${score}`;

  if (score < 50) {
    valueEl.style.color       = 'var(--clr-danger)';
    statBias.style.borderColor = 'rgba(239,68,68,0.45)';
    statBias.style.background  = 'rgba(239,68,68,0.05)';
    labelEl.style.color       = 'var(--clr-danger)';
    statBias.classList.add('stat-card--danger');
  } else if (score < 80) {
    valueEl.style.color       = 'var(--clr-warning)';
    statBias.style.borderColor = 'rgba(245,158,11,0.45)';
    statBias.style.background  = 'rgba(245,158,11,0.05)';
    labelEl.style.color       = 'var(--clr-warning)';
    statBias.classList.add('stat-card--warning');
  } else {
    valueEl.style.color       = 'var(--clr-success)';
    statBias.style.borderColor = 'rgba(16,185,129,0.45)';
    statBias.style.background  = 'rgba(16,185,129,0.05)';
    labelEl.style.color       = 'var(--clr-success)';
    statBias.classList.add('stat-card--success');
  }
}

/**
 * Renders the full analysis panel (score gauge + schema table).
 */
function renderAnalysisPanel(targetVar, schemaHeaders, fairnessScore, flaggedColumns) {
  /* Clear previous content */
  tableWrapper.innerHTML = '';

  /* ── Score Gauge Block ── */
  const scoreBlock = buildScoreBlock(fairnessScore, targetVar, flaggedColumns);
  tableWrapper.appendChild(scoreBlock);

  /* ── Schema Table ── */
  if (schemaHeaders.length > 0) {
    const tableSection = buildSchemaTable(schemaHeaders, flaggedColumns);
    tableWrapper.appendChild(tableSection);
  }
}

/**
 * Builds the visual fairness score gauge and flagged-columns list.
 */
function buildScoreBlock(score, targetVar, flaggedColumns) {
  const wrapper = document.createElement('div');
  wrapper.className = 'score-block';
  wrapper.id = 'score-block';

  /* Determine tier */
  let tierLabel, tierClass, gaugeColor, scoreIcon;
  if (score === null) {
    tierLabel = 'Unknown'; tierClass = 'tier-unknown'; gaugeColor = '#475569'; scoreIcon = '❓';
  } else if (score < 50) {
    tierLabel = 'High Risk'; tierClass = 'tier-danger'; gaugeColor = '#ef4444'; scoreIcon = '🔴';
  } else if (score < 80) {
    tierLabel = 'Moderate Risk'; tierClass = 'tier-warning'; gaugeColor = '#f59e0b'; scoreIcon = '🟡';
  } else {
    tierLabel = 'Fair'; tierClass = 'tier-success'; gaugeColor = '#10b981'; scoreIcon = '🟢';
  }

  const pct = score !== null ? Math.min(Math.max(score, 0), 100) : 0;

  wrapper.innerHTML = `
    <div class="score-gauge-area">
      <div class="gauge-label">
        <span class="gauge-title">Fairness Score</span>
        <span class="gauge-badge ${tierClass}">${scoreIcon} ${tierLabel}</span>
      </div>
      <div class="gauge-bar-track" aria-label="Fairness score: ${score ?? '—'} out of 100">
        <div class="gauge-bar-fill" style="width: ${pct}%; background: ${gaugeColor};"></div>
      </div>
      <div class="gauge-meta">
        <span class="gauge-score-text" style="color: ${gaugeColor};">${score !== null ? score + ' / 100' : '—'}</span>
        <span class="gauge-target">Target: <strong>${targetVar}</strong></span>
      </div>
    </div>

    <div class="flagged-area" id="flagged-area">
      <div class="flagged-heading">
        <span class="flagged-icon">⚠️</span>
        <span>Flagged Columns <span class="flagged-count">${flaggedColumns.length}</span></span>
      </div>
      <div class="flagged-badges" id="flagged-badges">
        ${flaggedColumns.length > 0
          ? flaggedColumns.map(col => {
              const explanationText = (col.explanation && col.explanation[currentLang]) ? col.explanation[currentLang] : (col.explanation?.en || 'Potential bias source');
              return `<span class="flag-badge" title="${escapeHTML(explanationText)}">${escapeHTML(col.column_name)}</span>`;
            }).join('')
          : '<span class="no-flags-text">✅ No columns flagged — dataset appears balanced.</span>'
        }
      </div>
    </div>
  `;

  return wrapper;
}

/**
 * Builds a table listing every schema column with a flag status.
 */
function buildSchemaTable(schemaHeaders, flaggedColumns) {
  const flaggedMap = new Map();
  flaggedColumns.forEach(c => {
    if (c && c.column_name) {
       flaggedMap.set(c.column_name.toLowerCase(), c);
    }
  });

  const section = document.createElement('div');
  section.className = 'schema-table-section';

  const heading = document.createElement('div');
  heading.className = 'schema-heading';
  heading.innerHTML = `<span class="schema-heading-icon">📋</span><span>Column Schema — ${schemaHeaders.length} columns detected</span>`;
  section.appendChild(heading);

  /* Scroll container for sticky headers */
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll-container';

  const table = document.createElement('table');
  table.className = 'results-table schema-table';
  table.setAttribute('aria-label', 'Dataset column schema and bias status');

  /* thead */
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Column Name</th>
        <th>Bias Status</th>
      </tr>
    </thead>
  `;

  /* tbody */
  const tbody = document.createElement('tbody');
  schemaHeaders.forEach((col, idx) => {
    const isFlagged = flaggedMap.has(col.toLowerCase());
    const flagData = flaggedMap.get(col.toLowerCase());

    const tr = document.createElement('tr');
    if (isFlagged) tr.classList.add('row-flagged');

    let statusContent = `<span class="status-badge badge-clean">✅ Clean</span>`;

    if (isFlagged && flagData) {
      const expText = (flagData.explanation && flagData.explanation[currentLang]) ? flagData.explanation[currentLang] : (flagData.explanation?.en || '');
      const catText = flagData.risk_category || 'Unknown Proxy';
      statusContent = `
        <div class="bias-status-cell">
          <div class="bias-badges">
            <span class="status-badge badge-flagged">⚠️ Flagged</span>
            <span class="bias-category-tag">${escapeHTML(catText)}</span>
          </div>
          <div class="bias-callout">${escapeHTML(expText)}</div>
        </div>
      `;
    }

    tr.innerHTML = `
      <td class="col-index">${idx + 1}</td>
      <td class="col-name">${escapeHTML(col)}</td>
      <td class="col-status">${statusContent}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scrollWrap.appendChild(table);
  section.appendChild(scrollWrap);

  /* Mark the outer wrapper so CSS knows to not clip */
  tableWrapper.classList.add('has-schema');

  return section;
}

/* ══════════════════════════════════════════════════════════
   7. QUARANTINE PANEL
══════════════════════════════════════════════════════════ */

/**
 * Injects the "Quarantine & Clean" action panel below the results section.
 * @param {string[]} flaggedColumns
 */
function renderQuarantinePanel(flaggedColumns) {
  /* Remove any existing quarantine panel first */
  removeQuarantinePanel();

  const panel = document.createElement('section');
  panel.className = 'quarantine-panel';
  panel.id = 'quarantine-panel';
  panel.setAttribute('aria-label', 'Quarantine and export panel');

  /* Compact horizontal layout */
  panel.innerHTML = `
    <div class="quarantine-row">
      <div class="quarantine-left">
        <span class="quarantine-icon">&#x1F6E1;&#xFE0F;</span>
        <div class="quarantine-meta">
          <span class="quarantine-title">Quarantine &amp; Clean</span>
          <div class="qcol-tags">
            ${flaggedColumns.map(col => `<span class="qcol-tag">✂️ ${escapeHTML(col)}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="quarantine-right">
        <button id="quarantine-btn" class="btn-quarantine" type="button">
          <span class="btn-icon">🛡️</span>
          <span>Quarantine &amp; Export</span>
        </button>
        <span class="quarantine-hint">Original file never modified</span>
      </div>
    </div>
    <div id="quarantine-result" class="quarantine-result" hidden></div>
  `;

  /* Insert after the results section */
  const resultsSection = document.getElementById('results-section');
  resultsSection.insertAdjacentElement('afterend', panel);

  /* Attach click handler */
  document.getElementById('quarantine-btn').addEventListener('click', runQuarantine);

  /* Animate in */
  requestAnimationFrame(() => panel.classList.add('quarantine-panel--visible'));
}


/** Removes the quarantine panel if it exists. */
function removeQuarantinePanel() {
  const existing = document.getElementById('quarantine-panel');
  if (existing) existing.remove();
}

/* ══════════════════════════════════════════════════════════
   8. QUARANTINE LOGIC — strip flagged columns
══════════════════════════════════════════════════════════ */

/**
 * Deletes every flagged column key from each row of parsedData,
 * then triggers the CSV export.
 */
function runQuarantine() {
  if (!parsedData || !lastFlaggedColumns || lastFlaggedColumns.length === 0) {
    showQuarantineResult('error', '⚠️ No data or flagged columns to process.');
    return;
  }

  const quarantineBtn = document.getElementById('quarantine-btn');
  quarantineBtn.disabled = true;
  quarantineBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Processing…</span>';

  try {
    /* Deep-clone the parsed data to avoid mutating the original */
    const cleanedData = parsedData.map(row => {
      const newRow = Object.assign({}, row);
      lastFlaggedColumns.forEach(col => { delete newRow[col]; });
      return newRow;
    });

    /* Show the success dashboard instead of instantly downloading */
    showSuccessDashboard(cleanedData, lastFlaggedColumns.length);

  } catch (err) {
    showQuarantineResult('error', `❌ Quarantine failed — ${err.message}`);
    quarantineBtn.disabled = false;
    quarantineBtn.innerHTML = '<span class="btn-icon">🛡️</span><span>Quarantine &amp; Export Clean CSV</span>';
  }
}

/**
 * Reveals the success dashboard with a clean data preview and download button.
 * @param {Object[]} cleanedData
 * @param {number}   removedCount
 */
function showSuccessDashboard(cleanedData, removedCount) {
  /* Hide analysis + quarantine panels */
  const resultsSection  = document.getElementById('results-section');
  const quarantinePanel = document.getElementById('quarantine-panel');
  if (resultsSection)  resultsSection.style.display  = 'none';
  if (quarantinePanel) quarantinePanel.style.display = 'none';

  /* Reveal the success dashboard */
  const dashboard = document.getElementById('success-dashboard');
  dashboard.hidden = false;

  /* Advance step 3 to complete */
  advanceStep('complete');

  /* Stat pills */
  const remainingCols = (parsedHeaders ? parsedHeaders.length : 0) - removedCount;
  const statsEl = document.getElementById('success-stats');
  statsEl.innerHTML = `
    <div class="success-stat-pill">✂️ <strong>${removedCount}</strong> Biased Column${removedCount !== 1 ? 's' : ''} Removed</div>
    <div class="success-stat-pill">✅ <strong>${remainingCols}</strong> Clean Column${remainingCols !== 1 ? 's' : ''} Retained</div>
    <div class="success-stat-pill">📄 <strong>${cleanedData.length.toLocaleString()}</strong> Rows Preserved</div>
  `;

  /* Build clean data preview table (first 5 rows) */
  const previewHeaders = cleanedData.length > 0 ? Object.keys(cleanedData[0]) : [];
  const previewRows    = cleanedData.slice(0, 5);

  const thead = document.getElementById('clean-preview-head');
  const tbody = document.getElementById('clean-preview-body');

  thead.innerHTML = `<tr>${previewHeaders.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr>`;
  tbody.innerHTML = previewRows.map(row =>
    `<tr>${previewHeaders.map(h => `<td>${escapeHTML(String(row[h] ?? ''))}</td>`).join('')}</tr>`
  ).join('');

  /* Scroll dashboard into view */
  dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* Wire the download button */
  const downloadBtn = document.getElementById('download-clean-btn');
  /* Remove any prior listener by cloning */
  const freshBtn = downloadBtn.cloneNode(true);
  downloadBtn.replaceWith(freshBtn);
  freshBtn.addEventListener('click', () => exportCleanCSV(cleanedData, removedCount));

  /* Wire the restart button */
  const restartBtn = document.getElementById('restart-btn');
  const freshRestart = restartBtn.cloneNode(true);
  restartBtn.replaceWith(freshRestart);
  freshRestart.addEventListener('click', () => {
    /* Show everything again and hide the success panel */
    if (resultsSection)  resultsSection.style.display  = '';
    dashboard.hidden = true;
    /* Re-render quarantine panel if we still have flagged columns */
    if (lastFlaggedColumns && lastFlaggedColumns.length > 0) {
      renderQuarantinePanel(lastFlaggedColumns);
    }
    advanceStep(3);
  });
}

/* ══════════════════════════════════════════════════════════
   9. CSV EXPORT LOGIC
══════════════════════════════════════════════════════════ */

/**
 * Converts the cleaned JSON array back to CSV via PapaParse,
 * creates a Blob, and programmatically triggers a download.
 * @param {Object[]} cleanedDataArray
 * @param {number}   removedCount
 */
function exportCleanCSV(cleanedDataArray, removedCount) {
  /* Step 1: Unparse JSON → CSV string */
  const csvString = Papa.unparse(cleanedDataArray);

  /* Step 2: Create a Blob */
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  /* Step 3: Create an object URL */
  const url = URL.createObjectURL(blob);

  /* Step 4: Build a hidden <a> tag and programmatically click it */
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'LexiFair_Cleaned_Dataset.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  /* Step 5: Clean up */
  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  });

  /* Step 6: Show success feedback in the quarantine panel */
  const remainingCols = (parsedHeaders ? parsedHeaders.length : 0) - removedCount;
  showQuarantineResult(
    'success',
    `✅ Download started — <strong>LexiFair_Cleaned_Dataset.csv</strong><br>
     <span class="export-detail">${removedCount} flagged column(s) removed · ${remainingCols} column(s) retained · ${cleanedDataArray.length.toLocaleString()} rows exported</span>`
  );

  /* Re-enable button for a second export if needed */
  const quarantineBtn = document.getElementById('quarantine-btn');
  if (quarantineBtn) {
    quarantineBtn.disabled = false;
    quarantineBtn.innerHTML = '<span class="btn-icon">⬇️</span><span>Download Again</span>';
  }
}

/**
 * Shows a success or error message inside the quarantine panel.
 * @param {'success'|'error'} type
 * @param {string} html
 */
function showQuarantineResult(type, html) {
  const resultEl = document.getElementById('quarantine-result');
  if (!resultEl) return;
  resultEl.className = `quarantine-result quarantine-result--${type}`;
  resultEl.innerHTML = html;
  resultEl.hidden = false;
}

/* ══════════════════════════════════════════════════════════
   10. UI STATE HELPERS
══════════════════════════════════════════════════════════ */

/** Shows the scanning spinner state in the results header. */
function setUIScanning() {
  setResultsStatus('scanning');

  /* Collapse the upload section to push results above the fold */
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.classList.add('upload-section--collapsed');

  /* Reset stat cards */
  ['stat-bias', 'stat-flags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.querySelector('.stat-value').textContent = '—';
      el.querySelector('.stat-value').style.color = '';
      el.querySelector('.stat-label').style.color = '';
      el.style.borderColor = '';
      el.style.background  = '';
      el.classList.remove('stat-card--danger', 'stat-card--warning', 'stat-card--success');
    }
  });

  /* Show Hacker Theatre loading state in table wrapper */
  tableEmptyState.style.display = 'flex';
  tableEmptyState.style.flexDirection = 'column';
  tableEmptyState.style.alignItems = 'stretch';
  tableEmptyState.innerHTML = `
    <div class="hacker-terminal" style="background: linear-gradient(145deg, #0a0e1a 0%, #0d1117 100%); color: #10b981; font-family: 'Courier New', monospace; padding: 20px; border-radius: 10px; text-align: left; width: 100%; min-height: 180px; box-shadow: inset 0 0 20px rgba(16,185,129,0.05), 0 0 30px rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.15);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(16,185,129,0.12);">
        <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
        <span style="font-size:0.7rem;color:rgba(16,185,129,0.4);margin-left:8px;font-weight:600;">AEGIS-AI // ETHICS AUDIT ENGINE v1.0</span>
      </div>
      <div id="terminal-lines" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;"></div>
      <div style="margin-top: 8px;"><span class="terminal-cursor" style="display: inline-block; width: 9px; height: 1.1em; background-color: #10b981; animation: blink 1s step-end infinite;"></span></div>
    </div>
  `;
  tableWrapper.innerHTML = '';
  tableWrapper.appendChild(tableEmptyState);

  if (!document.getElementById('terminal-blink-style')) {
    const style = document.createElement('style');
    style.id = 'terminal-blink-style';
    style.innerHTML = '@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }';
    document.head.appendChild(style);
  }

  const lines = [
    "> [SYSTEM] INITIATING SECURE UPLINK TO GEMINI AI...",
    "> [SYSTEM] BYPASSING STANDARD HEURISTICS...",
    "> [AUDIT] PARSING DATASET SCHEMA HEADERS...",
    "> [AUDIT] ANALYZING FOR HIDDEN SOCIOECONOMIC PROXIES...",
    "> [AUDIT] QUANTIFYING DEMOGRAPHIC DISPARITIES...",
    "> [SUCCESS] COMPILING ENTERPRISE ETHICS REPORT..."
  ];

  const container = document.getElementById('terminal-lines');
  let currentLine = 0;

  const interval = setInterval(() => {
    if (currentLine < lines.length) {
      const p = document.createElement('div');
      p.textContent = lines[currentLine];
      p.style.opacity = '0';
      p.style.transform = 'translateX(-8px)';
      p.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      container.appendChild(p);
      requestAnimationFrame(() => { p.style.opacity = '1'; p.style.transform = 'translateX(0)'; });
      currentLine++;
    } else {
      clearInterval(interval);
    }
  }, 450);

  /* Auto-scroll to make the Hacker Theatre fully visible */
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
}

/**
 * Updates the results status badge.
 * @param {'idle'|'scanning'|'complete'|'error'} state
 */
function setResultsStatus(state) {
  if (!resultsStatus) return;
  const dot  = resultsStatus.querySelector('.status-dot-sm');
  const text = resultsStatus.querySelector('span:last-child');

  const map = {
    idle:     { color: 'var(--txt-muted)',    label: 'Awaiting scan…' },
    scanning: { color: 'var(--clr-warning)',  label: 'Scanning…' },
    complete: { color: 'var(--clr-success)',  label: 'Scan complete' },
    error:    { color: 'var(--clr-danger)',   label: 'Scan failed' },
  };

  const cfg = map[state] || map.idle;
  if (dot)  dot.style.background = cfg.color;
  if (text) text.textContent = cfg.label;
}

/**
 * Sets the text in a stat card's value slot.
 * @param {HTMLElement} cardEl
 * @param {string} value
 */
function setStatValue(cardEl, value) {
  if (!cardEl) return;
  const v = cardEl.querySelector('.stat-value');
  if (v) v.textContent = value;
}

/**
 * Shows an error in the file label and sets the results status to error.
 * @param {string} message
 */
function setUIError(message) {
  fileLabel.textContent = message;
  fileLabel.style.color = '#ef4444';
  setResultsStatus('error');
  /* Restore the empty state element into the wrapper (it may have been replaced) */
  tableEmptyState.style.display = 'flex';
  tableEmptyState.style.flexDirection = 'column';
  tableEmptyState.style.alignItems = 'center';
  tableEmptyState.innerHTML = `
    <div class="empty-icon">❌</div>
    <p class="empty-title">Something went wrong</p>
    <p class="empty-desc">${escapeHTML(message)}</p>
  `;
  if (!tableWrapper.contains(tableEmptyState)) {
    tableWrapper.innerHTML = '';
    tableWrapper.appendChild(tableEmptyState);
  }
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ══════════════════════════════════════════════════════════
   11. STEP WIZARD HELPERS
══════════════════════════════════════════════════════════ */

/**
 * Advances the step wizard state.
 * @param {number|'complete'} stepNum - Pass a step number (1–3) to activate it,
 *                                       or 'complete' to mark step 3 as done.
 */
function advanceStep(stepNum) {
  const s1 = document.getElementById('step-1-indicator');
  const s2 = document.getElementById('step-2-indicator');
  const s3 = document.getElementById('step-3-indicator');
  const all = [s1, s2, s3];

  if (stepNum === 'complete') {
    /* Mark all steps complete */
    all.forEach(el => { if (el) { el.classList.remove('step-indicator--active'); el.classList.add('step-indicator--complete'); } });
    return;
  }

  all.forEach((el, idx) => {
    if (!el) return;
    el.classList.remove('step-indicator--active', 'step-indicator--complete');
    const thisStep = idx + 1;
    if (thisStep < stepNum) {
      el.classList.add('step-indicator--complete');
    } else if (thisStep === stepNum) {
      el.classList.add('step-indicator--active');
    }
  });
}

/* ══════════════════════════════════════════════════════════
   12. INITIALISATION
══════════════════════════════════════════════════════════ */
/* Start wizard at step 1 */
advanceStep(1);

console.info(
  '%c⚖️  Lexi-Fair AI — Phase 7 Loaded',
  'color:#4f7ef8; font-weight:700; font-size:13px;'
);
console.info('PapaParse version:', typeof Papa !== 'undefined' ? Papa.PAPA_VERSION : '⚠️  NOT LOADED');
console.info('API endpoint     :', API_URL);
