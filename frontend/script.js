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

/* ─── DOM References ─────────────────────────────────────── */
const dropzone               = document.getElementById('dropzone');
const fileInput              = document.getElementById('file-input');
const browseLink             = document.getElementById('browse-link');
const fileLabel              = document.getElementById('file-label');
const scanBtn                = document.getElementById('scan-btn');
const targetVariableDropdown = document.getElementById('target-variable-dropdown');

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

  const payload = {
    data: dataArray,
    target_variable: targetVariable
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errText}`);
    }

    const json = await response.json();
    console.info('[Lexi-Fair AI] ✅ Backend API Response:', json);

    /* Hand off to DOM renderer */
    renderResults(json);

  } catch (error) {
    setUIError(`❌  API call failed — ${error.message}`);
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
  /* ── Destructure safely ── */
  const targetVar      = json.target_variable  || '—';
  const schemaHeaders  = json.schema_headers   || [];
  const analysis       = json.analysis         || {};
  const fairnessScore  = typeof analysis.fairness_score  === 'number' ? analysis.fairness_score  : null;
  const flaggedColumns = Array.isArray(analysis.flagged_columns) ? analysis.flagged_columns : [];

  /* Store for quarantine step */
  lastFlaggedColumns = flaggedColumns;

  /* ── Update status indicator ── */
  setResultsStatus('complete');

  /* ── Stat cards ── */
  renderFairnessScore(fairnessScore);
  setStatValue(statFlags, flaggedColumns.length.toString());

  /* ── Hide empty state, show analysis panel ── */
  tableEmptyState.style.display = 'none';

  /* Replace table wrapper content with the analysis panel */
  renderAnalysisPanel(targetVar, schemaHeaders, fairnessScore, flaggedColumns);

  /* ── Show quarantine section ── */
  if (flaggedColumns.length > 0) {
    renderQuarantinePanel(flaggedColumns);
  }
}

/**
 * Colour-codes and populates the Bias Score stat card.
 * @param {number|null} score
 */
function renderFairnessScore(score) {
  const valueEl = statBias.querySelector('.stat-value');
  const labelEl = statBias.querySelector('.stat-label');

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
  } else if (score < 80) {
    valueEl.style.color       = 'var(--clr-warning)';
    statBias.style.borderColor = 'rgba(245,158,11,0.45)';
    statBias.style.background  = 'rgba(245,158,11,0.05)';
    labelEl.style.color       = 'var(--clr-warning)';
  } else {
    valueEl.style.color       = 'var(--clr-success)';
    statBias.style.borderColor = 'rgba(16,185,129,0.45)';
    statBias.style.background  = 'rgba(16,185,129,0.05)';
    labelEl.style.color       = 'var(--clr-success)';
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
          ? flaggedColumns.map(col => `<span class="flag-badge" title="Potential bias source">${col}</span>`).join('')
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
  const flaggedSet = new Set(flaggedColumns.map(c => c.toLowerCase()));

  const section = document.createElement('div');
  section.className = 'schema-table-section';

  const heading = document.createElement('div');
  heading.className = 'schema-heading';
  heading.innerHTML = `<span class="schema-heading-icon">📋</span><span>Column Schema — ${schemaHeaders.length} columns detected</span>`;
  section.appendChild(heading);

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
    const isFlagged = flaggedSet.has(col.toLowerCase());
    const tr = document.createElement('tr');
    if (isFlagged) tr.classList.add('row-flagged');

    tr.innerHTML = `
      <td class="col-index">${idx + 1}</td>
      <td class="col-name">${escapeHTML(col)}</td>
      <td class="col-status">
        ${isFlagged
          ? `<span class="status-badge badge-flagged">⚠️ Flagged</span>`
          : `<span class="status-badge badge-clean">✅ Clean</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  section.appendChild(table);
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

  panel.innerHTML = `
    <div class="quarantine-header">
      <div class="quarantine-title-group">
        <span class="quarantine-icon">🧹</span>
        <div>
          <h2 class="quarantine-title">Quarantine &amp; Clean</h2>
          <p class="quarantine-desc">Remove all <strong>${flaggedColumns.length}</strong> flagged column(s) from your dataset and export a clean, bias-reduced CSV file.</p>
        </div>
      </div>
    </div>

    <div class="quarantine-columns-preview">
      <span class="qcol-label">Columns to remove:</span>
      <div class="qcol-tags">
        ${flaggedColumns.map(col => `<span class="qcol-tag">✂️ ${escapeHTML(col)}</span>`).join('')}
      </div>
    </div>

    <div class="quarantine-actions">
      <button id="quarantine-btn" class="btn-quarantine" type="button">
        <span class="btn-icon">🛡️</span>
        <span>Quarantine &amp; Export Clean CSV</span>
      </button>
      <span class="quarantine-hint">The original file is never modified — this creates a new download.</span>
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
      lastFlaggedColumns.forEach(col => {
        delete newRow[col];
      });
      return newRow;
    });

    /* Hand off to export */
    exportCleanCSV(cleanedData, lastFlaggedColumns.length);

  } catch (err) {
    showQuarantineResult('error', `❌ Quarantine failed — ${err.message}`);
    quarantineBtn.disabled = false;
    quarantineBtn.innerHTML = '<span class="btn-icon">🛡️</span><span>Quarantine &amp; Export Clean CSV</span>';
  }
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
  /* Reset stat cards */
  ['stat-bias', 'stat-flags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.querySelector('.stat-value').textContent = '—';
      el.querySelector('.stat-value').style.color = '';
      el.querySelector('.stat-label').style.color = '';
      el.style.borderColor = '';
      el.style.background  = '';
    }
  });
  /* Show loading state in table wrapper */
  tableEmptyState.style.display = 'flex';
  tableEmptyState.innerHTML = `
    <div class="empty-icon scan-spinner">⚡</div>
    <p class="empty-title">Scanning dataset…</p>
    <p class="empty-desc">The AI is analysing your data for hidden bias patterns.</p>
  `;
  tableWrapper.innerHTML = '';
  tableWrapper.appendChild(tableEmptyState);
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
  tableEmptyState.style.display = 'flex';
  tableEmptyState.innerHTML = `
    <div class="empty-icon">❌</div>
    <p class="empty-title">Something went wrong</p>
    <p class="empty-desc">${escapeHTML(message)}</p>
  `;
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
   11. INITIALISATION LOG
══════════════════════════════════════════════════════════ */
console.info(
  '%c⚖️  Lexi-Fair AI — Phase 6 Loaded',
  'color:#4f7ef8; font-weight:700; font-size:13px;'
);
console.info('PapaParse version:', typeof Papa !== 'undefined' ? Papa.PAPA_VERSION : '⚠️  NOT LOADED');
console.info('API endpoint     :', API_URL);
