/* ═══════════════════════════════════════════════════════════
   LEXI-FAIR AI — script.js
   Phase 4: Client-Server Handshake
   ─────────────────────────────────────────────────────────
   Responsibilities:
     • Handle file selection via <input type="file">
     • Handle drag-and-drop onto the drop zone
     • Parse the .csv file with PapaParse
     • Read the Target Variable dropdown value
     • POST parsed data to Flask /api/v1/analyze
     • Log backend response to console (no DOM rendering)
   ─────────────────────────────────────────────────────────
   NOTE: API response is console-only. No UI updates.
════════════════════════════════════════════════════════════ */

'use strict';

/* ─── Module-level state ─────────────────────────────────── */
/** @type {File|null} The currently selected CSV file */
let selectedFile = null;

/** @type {Object[]|null} Parsed JSON rows from the last parse */
let parsedData = null;

/** @type {string[]|null} Column header names from the last parse */
let parsedHeaders = null;

/* ─── DOM References ─────────────────────────────────────── */
const dropzone              = document.getElementById('dropzone');
const fileInput             = document.getElementById('file-input');
const browseLink            = document.getElementById('browse-link');
const fileLabel             = document.getElementById('file-label');
const scanBtn               = document.getElementById('scan-btn');
const targetVariableDropdown = document.getElementById('target-variable-dropdown');

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
    fileLabel.textContent = '⚠️  Only .csv files are accepted.';
    fileLabel.style.color = '#ef4444';
    selectedFile = null;
    scanBtn.disabled = true;
    console.warn('[Lexi-Fair AI] Rejected file — not a CSV:', file.name);
    return;
  }

  selectedFile = file;
  fileLabel.textContent = `✅  ${file.name}  (${formatBytes(file.size)})`;
  fileLabel.style.color = '#10b981';
  scanBtn.disabled = false;
  console.info('[Lexi-Fair AI] File selected:', file.name, `(${formatBytes(file.size)})`);
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
 * On completion, logs the parsed data structure to the console.
 * Does NOT modify the DOM table (reserved for Phase 3).
 * @param {File} file
 */
function parseCSV(file) {
  console.group('[Lexi-Fair AI] 🔄  Parsing CSV:', file.name);
  console.time('parse-duration');

  Papa.parse(file, {
    header: true,          // Output array-of-objects keyed by column header
    skipEmptyLines: true,  // Ignore blank rows

    /**
     * Called once parsing is complete.
     * @param {Papa.ParseResult} results
     */
    complete: function (results) {
      console.timeEnd('parse-duration');

      /* ── Extract data & headers ── */
      const dataArray = results.data;
      const headers   = results.meta.fields;   // Array of column name strings

      /* ── Store module-level references (Phase 3 will consume these) ── */
      parsedData    = dataArray;
      parsedHeaders = headers;

      /* ── Parse output ── */
      console.log('Parsed JSON Array:', dataArray);
      console.log('Extracted Headers:', headers);

      /* ── Supplementary diagnostic output ── */
      console.info(`  ↳ Total rows    : ${dataArray.length}`);
      console.info(`  ↳ Total columns : ${headers.length}`);
      if (results.errors.length > 0) {
        console.warn('  ↳ Parse warnings:', results.errors);
      }

      console.groupEnd();

      /* ══════════════════════════════════════════════════════
         Phase 4 — POST to Flask API
      ══════════════════════════════════════════════════════ */
      sendToAPI(dataArray);
    },

    /**
     * Called if a fatal parse error occurs before completion.
     * @param {Papa.ParseError} error
     */
    error: function (error) {
      console.timeEnd('parse-duration');
      console.error('[Lexi-Fair AI] ❌  PapaParse error:', error.message);
      console.groupEnd();

      fileLabel.textContent = `❌  Parse failed — ${error.message}`;
      fileLabel.style.color = '#ef4444';
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

  /* Prevent browser default (open file) on drag-over */
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('drag-over');
  });

  /* Remove highlight when drag leaves the zone */
  dropzone.addEventListener('dragleave', function (e) {
    /* Only remove class if the pointer truly left the dropzone boundary */
    if (!dropzone.contains(e.relatedTarget)) {
      dropzone.classList.remove('drag-over');
    }
  });

  /* Handle the actual drop */
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0] || null;
    if (file) {
      handleFileSelection(file);
    }
  });
}

/* ── 4d. "Scan Dataset" button click → trigger PapaParse ── */
if (scanBtn) {
  scanBtn.addEventListener('click', function () {
    if (!selectedFile) {
      console.warn('[Lexi-Fair AI] Scan clicked but no file is selected.');
      return;
    }
    parseCSV(selectedFile);
  });
}

/* ══════════════════════════════════════════════════════════
   5. PHASE 4 — API CALL
══════════════════════════════════════════════════════════ */

const API_URL = 'http://localhost:5000/api/v1/analyze';

/**
 * Reads the Target Variable dropdown, builds the request payload,
 * POSTs it to the Flask backend, and logs the response.
 * No DOM manipulation is performed here.
 * @param {Object[]} dataArray - The parsed CSV rows from PapaParse
 */
async function sendToAPI(dataArray) {
  /* ── Step 1: Read the selected target variable ── */
  const targetVariable = targetVariableDropdown ? targetVariableDropdown.value : '';

  /* ── Step 2: Structure the payload ── */
  const payload = {
    data: dataArray,
    target_variable: targetVariable
  };

  console.group('[Lexi-Fair AI] 🚀  Sending payload to Flask API');
  console.log('  ↳ Endpoint      :', API_URL);
  console.log('  ↳ target_variable:', targetVariable);
  console.log('  ↳ data rows     :', dataArray.length);

  /* ── Step 3: fetch() POST ── */
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    /* ── Mandatory Phase 4 log ── */
    console.log('Backend API Response:', json);
    console.groupEnd();

  } catch (error) {
    /* ── Step 4: Network / parse error handling ── */
    console.error('[Lexi-Fair AI] ❌  API call failed:', error);
    console.groupEnd();
  }
}

/* ══════════════════════════════════════════════════════════
   6. INITIALISATION LOG
══════════════════════════════════════════════════════════ */
console.info(
  '%c⚖️  Lexi-Fair AI — Phase 4 Loaded',
  'color:#4f7ef8; font-weight:700; font-size:13px;'
);
console.info('PapaParse version:', typeof Papa !== 'undefined' ? Papa.PAPA_VERSION : '⚠️  NOT LOADED');
console.info('API endpoint     :', API_URL);
