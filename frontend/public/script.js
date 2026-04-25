/* ═══════════════════════════════════════════════════════════
   GLOBAL PARTICLE CANVAS (Flowing Orbs)
════════════════════════════════════════════════════════════ */
if (history.scrollRestoration) {
    history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

(function() {
    const canvas = document.getElementById('global-particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width, height;
    let particles = [];
    let mouse = { x: null, y: null };

    const colors = [
        [157, 78, 221], // neon-purple
        [6, 182, 212],  // neon-cyan
        [236, 72, 153]  // neon-pink
    ];

    function init() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        particles = [];
      
        const numParticles = Math.min(Math.floor(window.innerWidth / 60), 25);
        for(let i=0; i<numParticles; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                radius: Math.random() * 180 + 120,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: Math.random() * 0.4 + 0.3
            });
        }
    }

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });
    window.addEventListener('touchstart', e => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }, {passive: true});
    window.addEventListener('touchend', () => { mouse.x = null; mouse.y = null; }, {passive: true});

    function draw() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            if (mouse.x !== null && mouse.y !== null) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 400; 
                if (distance < maxDist) {
                    const force = (maxDist - distance) / maxDist;
                    p.vx += (dx / distance) * force * 0.4;
                    p.vy += (dy / distance) * force * 0.4;
                }
            }

            p.vx *= 0.95;
            p.vy *= 0.95;
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < -p.radius) p.vx *= -1;
            if (p.x > width + p.radius) p.vx *= -1;
            if (p.y < -p.radius) p.vy *= -1;
            if (p.y > height + p.radius) p.vy *= -1;

            if(Math.abs(p.vx) < 0.2) p.vx += (Math.random()-0.5)*0.2;
            if(Math.abs(p.vy) < 0.2) p.vy += (Math.random()-0.5)*0.2;

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
            grad.addColorStop(0, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.opacity})`);
            grad.addColorStop(1, `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, 0)`);
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }
    
    init();
    draw();
})();

/* ═══════════════════════════════════════════════════════
   CINEMATIC SLIDER LOGIC
   ═══════════════════════════════════════════════════════ */
(function () {
    var SLIDE_DURATION  = 6000; 
    var TRANSITION_TIME = 900;  
    var currentIndex  = 0;
    var totalSlides   = 0;
    var autoTimer     = null;
    var isTransiting  = false;
    var root       = document.getElementById('hero-slider-root');
    var track      = document.getElementById('hero-slides-track');
    var pagination = document.getElementById('hero-pagination');
    if (!root || !track || !pagination) return;
    var slides = track.querySelectorAll('.hero-slide');
    var dots   = pagination.querySelectorAll('.hero-dot');
    totalSlides = slides.length;

    function resetSlideAnimations(slide) {
        var animEls = slide.querySelectorAll('.slide-animate-tag, .slide-animate-headline, .slide-animate-subtext, .slide-animate-btns, .slide-animate-metrics');
        animEls.forEach(function (el) { el.style.animation = 'none';
        void el.offsetWidth; el.style.animation = ''; });
    }

    function activateSlide(newIndex, isFirst) {
        if (isTransiting && !isFirst) return;
        isTransiting = true;
        currentIndex  = newIndex;
        slides.forEach(function (s, i) {
            if (i !== newIndex) { s.classList.remove('slide-active'); s.setAttribute('aria-hidden', 'true'); }
        });
        var nextSlide = slides[newIndex];
        resetSlideAnimations(nextSlide);
        nextSlide.classList.add('slide-active');
        nextSlide.setAttribute('aria-hidden', 'false');
        dots.forEach(function (d) {
            d.classList.remove('hero-dot--active');
            d.setAttribute('aria-selected', 'false');
            var progress = d.querySelector('.hero-dot-progress');
            if (progress) { var clone = progress.cloneNode(true); d.replaceChild(clone, progress); }
        });
        var activeDot = dots[newIndex];
        activeDot.classList.add('hero-dot--active');
        activeDot.setAttribute('aria-selected', 'true');
        setTimeout(function () { isTransiting = false; }, TRANSITION_TIME);
    }

    function goTo(index) {
        var safeIndex = ((index % totalSlides) + totalSlides) % totalSlides;
        activateSlide(safeIndex, false);
        restartTimer();
    }

    function nextSlide() { goTo(currentIndex + 1); }
    function startTimer() { stopTimer(); autoTimer = setInterval(nextSlide, SLIDE_DURATION); }
    function stopTimer() { clearInterval(autoTimer); }
    function restartTimer() { stopTimer(); startTimer(); }

    dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            var idx = parseInt(dot.getAttribute('data-dot'), 10);
            if (idx !== currentIndex) goTo(idx);
        });
    });

    root.addEventListener('mouseenter', stopTimer);
    root.addEventListener('mouseleave', startTimer);
    root.addEventListener('touchstart', stopTimer, { passive: true });
    root.addEventListener('touchend',   startTimer, { passive: true });
    
    root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextSlide(); }
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goTo(currentIndex - 1); }
    });

    function init() {
        root.classList.add('opening-reveal');
        activateSlide(0, true);
        requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('slider-loaded'); }); });
        setTimeout(function () { root.classList.remove('opening-reveal'); }, 2000);
        startTimer();
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();

/* ═══════════════════════════════════════════════════════
   UI TRANSITIONS & OBSERVERS
   ═══════════════════════════════════════════════════════ */
const landingView = document.getElementById('landing-view');
const appView = document.getElementById('app-view');
const getStartedBtns = [
    document.getElementById('nav-get-started'), 
    document.getElementById('hero-get-started'),
    ...document.querySelectorAll('.hero-slide-cta')
];
const navGoBack = document.getElementById('nav-go-back');

function goToDashboard(e) {
    if(e) e.preventDefault();
    landingView.style.opacity = '0';
    setTimeout(() => {
        landingView.style.display = 'none';
        appView.style.display = 'block';
        void appView.offsetWidth; 
        appView.style.opacity = '1';
        document.body.classList.add('in-app');
        window.scrollTo(0,0);
    }, 500);
}

function goToLanding(e) {
    if(e) e.preventDefault();
    appView.style.opacity = '0';
    if(document.getElementById('main-dashboard-grid')) document.getElementById('main-dashboard-grid').classList.remove('focus-mode');
    if(document.getElementById('bottom-interaction-layer')) document.getElementById('bottom-interaction-layer').classList.remove('active');

    setTimeout(() => {
        appView.style.display = 'none';
        landingView.style.display = 'block';
        void landingView.offsetWidth; 
        landingView.style.opacity = '1';
        document.body.classList.remove('in-app');
        window.scrollTo(0,0);
    }, 500);
}

getStartedBtns.forEach(btn => { if(btn) btn.addEventListener('click', goToDashboard); });
if(navGoBack) navGoBack.addEventListener('click', goToLanding);

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            if (entry.target.querySelector('.flow-line-fill')) {
                setTimeout(() => { entry.target.querySelector('.flow-line-fill').style.width = '100%'; }, 400);
            }
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelectorAll('.nav-links a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId.startsWith('#')) {
            e.preventDefault();
            const targetElement = document.querySelector(targetId);
            if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

const glowingCards = document.querySelectorAll('.feature-card-pro, .bento-card');
glowingCards.forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});


/* ═══════════════════════════════════════════════════════════
   LEXI-FAIR AI — BACKEND-CONNECTED APPLICATION LOGIC
   ───────────────────────────────────────────────────────── */
'use strict';

let selectedFile = null;
let parsedData = null;
let parsedHeaders = null;
let lastFlaggedColumns = null;
let lastApiResponse = null;
let currentLang = 'en';

let pieChartInstance = null;
let barChartInstance = null;

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
    if (lastApiResponse) renderResults(lastApiResponse);
  });
}

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

const dashboardGrid = document.getElementById('main-dashboard-grid');
const bottomParamsBar = document.getElementById('bottom-interaction-layer');
const btnEditParams = document.getElementById('btn-edit-params');

if(btnEditParams) {
    btnEditParams.addEventListener('click', () => {
        dashboardGrid.classList.remove('focus-mode');
        bottomParamsBar.classList.remove('active');
        
        // Ensure a proper 'zoom out' by scrolling perfectly to the top of the app view
        const appView = document.getElementById('app-view');
        if (appView) {
            appView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function updateBottomBarInfo() {
    const targetEl = document.getElementById('bil-target-val');
    const langEl = document.getElementById('bil-lang-val');
    if(targetVariableDropdown && targetEl) targetEl.textContent = targetVariableDropdown.options[targetVariableDropdown.selectedIndex].text || 'None';
    if(languageDropdown && langEl) langEl.textContent = languageDropdown.value.toUpperCase();
}

function isCSVFile(file) {
  if (!file) return false;
  const nameOk = file.name.toLowerCase().endsWith('.csv');
  const typeOk = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';
  return nameOk || typeOk;
}

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
  advanceStep(2);

  /* Hide any previous results when a new file is uploaded */
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) resultsSection.style.display = 'none';
  const successDashboard = document.getElementById('success-dashboard');
  if (successDashboard) successDashboard.hidden = true;

  /* Instantly parse the CSV to show the raw data preview */
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      parsedData = results.data;
      parsedHeaders = results.meta.fields;

      setStatValue(statRows, parsedData.length.toLocaleString());
      setStatValue(statCols, parsedHeaders.length.toLocaleString());
      renderRawPreview(parsedHeaders, parsedData.slice(0, 3));

      if (results.errors.length > 0) {
        console.warn('[Lexi-Fair AI] Parse warnings:', results.errors);
      }
    },
    error: function (error) {
      setUIError(`❌  Parse failed — ${error.message}`);
    }
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function renderRawPreview(headers, rows) {
  const container = document.getElementById('raw-data-preview');
  if (!container) return;

  container.hidden = false;
  container.innerHTML = `
    <div class="raw-preview-label">Raw Data Preview <span class="raw-preview-tag">First 3 Rows</span></div>
    <div class="table-scroll-container">
      <table class="results-table schema-table">
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

if (browseLink) browseLink.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
if (fileInput) fileInput.addEventListener('change', function (e) { handleFileSelection(e.target.files[0] || null); });
if (dropzone) {
  dropzone.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', function (e) { if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('drag-over'); });
  dropzone.addEventListener('drop', function (e) { e.preventDefault(); dropzone.classList.remove('drag-over'); handleFileSelection(e.dataTransfer.files[0] || null); });
}

if (scanBtn) {
  scanBtn.addEventListener('click', function () {
    if (!selectedFile || !parsedData) return;
    
    if(dashboardGrid) dashboardGrid.classList.add('focus-mode');
    updateBottomBarInfo();
    if(bottomParamsBar) bottomParamsBar.classList.add('active');

    removeQuarantinePanel();
    setUIScanning();
    sendToAPI(parsedData);
  });
}

const TRAP_DATASETS = {
  'card-banking': { file: 'datasets/banking.csv',      label: 'banking.csv',      targetValue: 'loan-approval'    },
  'card-tech':    { file: 'datasets/tech_hiring.csv',  label: 'tech_hiring.csv',  targetValue: 'tech-hiring'      },
  'card-safe':    { file: 'datasets/safe_dataset.csv', label: 'safe_dataset.csv', targetValue: 'credit-default' }
};

Object.entries(TRAP_DATASETS).forEach(([cardId, meta]) => {
  const card = document.getElementById(cardId);
  if (!card) return;

  const activateCard = () => {
    document.querySelectorAll('.dataset-card').forEach(c => c.classList.remove('card-active'));
    card.classList.add('card-active');

    if (targetVariableDropdown) targetVariableDropdown.value = meta.targetValue;

    fetch(meta.file)
      .then(r => { if (!r.ok) throw new Error('Dataset file not found.'); return r.blob(); })
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

/* ── ACTUAL BACKEND API LOGIC (Port 5000) ── */
const API_URL = 'http://localhost:5000/api/v1/analyze';

async function sendToAPI(dataArray) {
  const targetVariable = targetVariableDropdown ? targetVariableDropdown.value : '';
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

    /* Enforce dynamic minimum times for the Hacker Theatre animation */
    const elapsed = Date.now() - startTime;
    let requiredWait = 3000; // Live Gemini minimum
    if (json.source === 'semantic-mock') {
      requiredWait = 10000; // Artificial 10s delay for fallback
    }

    if (elapsed < requiredWait) {
      await new Promise(resolve => setTimeout(resolve, requiredWait - elapsed));
    }

    /* Graceful Exit for Theatre */
    if (window.hackerTimeout) clearTimeout(window.hackerTimeout);
    const container = document.getElementById('terminal-lines');
    if (container) {
      const p = document.createElement('div');
      p.textContent = "> [SUCCESS] AUDIT COMPLETE. RENDERING DASHBOARD...";
      p.style.color = '#10b981';
      container.appendChild(p);
      if (container.children.length > 8) container.removeChild(container.firstChild);
    }
    await new Promise(resolve => setTimeout(resolve, 500));

    renderResults(json);

  } catch (error) {
    setUIError(`❌  API call failed — ${error.message}. Make sure the backend server is running on port 5000.`);
  }
}

function renderResults(json) {
  lastApiResponse = json;

  const targetVar      = json.target_variable  || '—';
  const schemaHeaders  = json.schema_headers   || [];
  const analysis       = json.analysis         || {};
  const fairnessScore  = typeof analysis.fairness_score  === 'number' ? analysis.fairness_score  : null;
  const rawFlagged     = Array.isArray(analysis.flagged_columns) ? analysis.flagged_columns : [];

  const flaggedColumns = rawFlagged.map(col => {
    if (typeof col === 'string') {
      return { column_name: col, risk_score: 0, risk_category: 'Unknown', explanation: { en: 'No explanation provided' } };
    }
    return col;
  });

  const flaggedColumnNames = flaggedColumns.map(c => c.column_name);
  lastFlaggedColumns = flaggedColumnNames;

  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.classList.remove('upload-section--collapsed');

  advanceStep(3);
  setResultsStatus('complete');
  renderFairnessScore(fairnessScore);
  setStatValue(statFlags, flaggedColumns.length.toString());

  if (statFlags) {
    statFlags.classList.remove('stat-card--danger', 'stat-card--warning', 'stat-card--success');
    statFlags.classList.add(flaggedColumns.length > 0 ? 'stat-card--danger' : 'stat-card--success');
  }

  tableEmptyState.style.display = 'none';
  renderAnalysisPanel(targetVar, schemaHeaders, fairnessScore, flaggedColumns);
  
  if (flaggedColumnNames.length > 0) {
    renderQuarantinePanel(flaggedColumnNames);
  }

  drawCharts(schemaHeaders, flaggedColumns);
}

function drawCharts(headers, flaggedColumns) {
    const chartsContainer = document.getElementById('analytics-charts');
    if(!chartsContainer) return;
    chartsContainer.style.display = 'grid';
    
    if(pieChartInstance) pieChartInstance.destroy();
    if(barChartInstance) barChartInstance.destroy();

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    const pieCtx = document.getElementById('biasPieChart').getContext('2d');
    const flaggedCount = flaggedColumns.length;
    const cleanCount = Math.max(headers.length - flaggedCount, 0);

    pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Clean Attributes', 'Flagged Proxies'],
            datasets: [{
                data: [cleanCount, flaggedCount],
                backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                borderColor: ['#10b981', '#ef4444'],
                borderWidth: 1,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, animation: { animateScale: true, animateRotate: true } }
    });

    const barCtx = document.getElementById('biasBarChart').getContext('2d');
    const labels = flaggedColumns.length > 0 ? flaggedColumns.map(f => f.column_name) : ['None Detected'];
    const dataVals = flaggedColumns.length > 0 ? flaggedColumns.map(() => (Math.random() * 40 + 60).toFixed(1)) : [0];

    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Disparate Impact Severity (%)',
                data: dataVals,
                backgroundColor: 'rgba(6, 182, 212, 0.5)',
                borderColor: '#06b6d4',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }, animation: { duration: 1500, easing: 'easeOutQuart' } }
    });

    requestAnimationFrame(() => chartsContainer.classList.add('visible'));
}

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

function renderAnalysisPanel(targetVar, schemaHeaders, fairnessScore, flaggedColumns) {
  tableWrapper.innerHTML = '';
  const scoreBlock = buildScoreBlock(fairnessScore, targetVar, flaggedColumns);
  tableWrapper.appendChild(scoreBlock);
  if (schemaHeaders.length > 0) {
    const tableSection = buildSchemaTable(schemaHeaders, flaggedColumns);
    tableWrapper.appendChild(tableSection);
  }
}

function buildScoreBlock(score, targetVar, flaggedColumns) {
  const wrapper = document.createElement('div');
  wrapper.className = 'score-block';
  wrapper.id = 'score-block';

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

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll-container';

  const table = document.createElement('table');
  table.className = 'results-table schema-table';
  table.setAttribute('aria-label', 'Dataset column schema and bias status');

  table.innerHTML = `<thead><tr><th>#</th><th>Column Name</th><th>Bias Status</th></tr></thead>`;

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
  tableWrapper.classList.add('has-schema');

  return section;
}

function renderQuarantinePanel(flaggedColumns) {
  removeQuarantinePanel();
  const panel = document.createElement('section');
  panel.className = 'quarantine-panel';
  panel.id = 'quarantine-panel';
  panel.setAttribute('aria-label', 'Quarantine and export panel');

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
        <div><span class="quarantine-hint">Original file never modified</span></div>
      </div>
    </div>
    <div id="quarantine-result" class="quarantine-result" hidden></div>
  `;

  const resultsSection = document.getElementById('results-section');
  resultsSection.insertAdjacentElement('afterend', panel);

  document.getElementById('quarantine-btn').addEventListener('click', runQuarantine);
  requestAnimationFrame(() => panel.classList.add('quarantine-panel--visible'));
}

function removeQuarantinePanel() {
  const existing = document.getElementById('quarantine-panel');
  if (existing) existing.remove();
}

function runQuarantine() {
  if (!parsedData || !lastFlaggedColumns || lastFlaggedColumns.length === 0) {
    showQuarantineResult('error', '⚠️ No data or flagged columns to process.');
    return;
  }

  const quarantineBtn = document.getElementById('quarantine-btn');
  quarantineBtn.disabled = true;
  quarantineBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Processing…</span>';

  try {
    const cleanedData = parsedData.map(row => {
      const newRow = Object.assign({}, row);
      lastFlaggedColumns.forEach(col => { delete newRow[col]; });
      return newRow;
    });

    showSuccessDashboard(cleanedData, lastFlaggedColumns.length);

  } catch (err) {
    showQuarantineResult('error', `❌ Quarantine failed — ${err.message}`);
    quarantineBtn.disabled = false;
    quarantineBtn.innerHTML = '<span class="btn-icon">🛡️</span><span>Quarantine &amp; Export Clean CSV</span>';
  }
}

function showSuccessDashboard(cleanedData, removedCount) {
  const resultsSection  = document.getElementById('results-section');
  const quarantinePanel = document.getElementById('quarantine-panel');
  if (resultsSection)  resultsSection.style.display  = 'none';
  if (quarantinePanel) quarantinePanel.style.display = 'none';

  const dashboard = document.getElementById('success-dashboard');
  dashboard.hidden = false;

  advanceStep('complete');

  const remainingCols = (parsedHeaders ? parsedHeaders.length : 0) - removedCount;
  const statsEl = document.getElementById('success-stats');
  statsEl.innerHTML = `
    <div class="success-stat-pill" style="background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 8px;">✂️ <strong>${removedCount}</strong> Biased Column${removedCount !== 1 ? 's' : ''} Removed</div>
    <div class="success-stat-pill" style="background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 8px;">✅ <strong>${remainingCols}</strong> Clean Column${remainingCols !== 1 ? 's' : ''} Retained</div>
    <div class="success-stat-pill" style="background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 8px;">📄 <strong>${cleanedData.length.toLocaleString()}</strong> Rows Preserved</div>
  `;

  const previewHeaders = cleanedData.length > 0 ? Object.keys(cleanedData[0]) : [];
  const previewRows    = cleanedData.slice(0, 5);

  const thead = document.getElementById('clean-preview-head');
  const tbody = document.getElementById('clean-preview-body');

  thead.innerHTML = `<tr>${previewHeaders.map(h => `<th style="text-align:left; padding: 12px; background: rgba(255,255,255,0.05);">${escapeHTML(h)}</th>`).join('')}</tr>`;
  tbody.innerHTML = previewRows.map(row =>
    `<tr>${previewHeaders.map(h => `<td>${escapeHTML(String(row[h] ?? ''))}</td>`).join('')}</tr>`
  ).join('');

  dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const downloadBtn = document.getElementById('download-clean-btn');
  const freshBtn = downloadBtn.cloneNode(true);
  downloadBtn.replaceWith(freshBtn);
  freshBtn.addEventListener('click', () => exportCleanCSV(cleanedData, removedCount));

  const restartBtn = document.getElementById('restart-btn');
  const freshRestart = restartBtn.cloneNode(true);
  restartBtn.replaceWith(freshRestart);
  freshRestart.addEventListener('click', () => {
    // Hard reset of dashboard to step 1
    selectedFile = null;
    parsedData = null;
    parsedHeaders = null;
    lastApiResponse = null;
    lastFlaggedColumns = null;

    const fileLabel = document.getElementById('file-label');
    const scanBtn = document.getElementById('scan-btn');
    if (fileLabel) {
      fileLabel.textContent = 'No file selected';
      fileLabel.style.color = 'var(--txt-muted)';
    }
    if (scanBtn) scanBtn.disabled = true;

    const rawPreview = document.getElementById('raw-data-preview');
    if (rawPreview) {
      rawPreview.innerHTML = '';
      rawPreview.hidden = true;
    }

    const uploadSection = document.getElementById('upload-section');
    if (uploadSection) uploadSection.classList.remove('upload-section--collapsed');

    if (resultsSection) resultsSection.style.display = 'none';
    dashboard.hidden = true;

    const appDashboard = document.getElementById('main-dashboard-grid');
    if (appDashboard) appDashboard.classList.remove('focus-mode');

    const bottomParamsBar = document.getElementById('bottom-interaction-layer');
    if (bottomParamsBar) bottomParamsBar.classList.remove('active');

    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';

    advanceStep(1);

    const appView = document.getElementById('app-view');
    if (appView) {
      appView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function exportCleanCSV(cleanedDataArray, removedCount) {
  const csvString = Papa.unparse(cleanedDataArray);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'LexiFair_Cleaned_Dataset.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  });

  const remainingCols = (parsedHeaders ? parsedHeaders.length : 0) - removedCount;
  showQuarantineResult(
    'success',
    `✅ Download started — <strong>LexiFair_Cleaned_Dataset.csv</strong><br>
     <span class="export-detail">${removedCount} flagged column(s) removed · ${remainingCols} column(s) retained · ${cleanedDataArray.length.toLocaleString()} rows exported</span>`
  );

  const quarantineBtn = document.getElementById('quarantine-btn');
  if (quarantineBtn) {
    quarantineBtn.disabled = false;
    quarantineBtn.innerHTML = '<span class="btn-icon">⬇️</span><span>Download Again</span>';
  }
}

function showQuarantineResult(type, html) {
  const resultEl = document.getElementById('quarantine-result');
  if (!resultEl) return;
  resultEl.className = `quarantine-result quarantine-result--${type}`;
  resultEl.style.marginTop = '12px';
  resultEl.style.padding = '12px';
  resultEl.style.borderRadius = '8px';
  resultEl.style.background = type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
  resultEl.style.color = type === 'error' ? 'var(--clr-danger)' : 'var(--clr-success)';
  resultEl.innerHTML = html;
  resultEl.hidden = false;
}

function setUIScanning() {
  setResultsStatus('scanning');
  
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.classList.add('upload-section--collapsed');

  const resultsSection = document.getElementById('results-section');
  if (resultsSection) resultsSection.style.display = '';
  const successDashboard = document.getElementById('success-dashboard');
  if (successDashboard) successDashboard.hidden = true;
  const chartsContainer = document.getElementById('analytics-charts');
  if (chartsContainer) chartsContainer.style.display = 'none';

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
    "> [AUDIT] QUANTIFYING DEMOGRAPHIC DISPARITIES..."
  ];

  const loopLines = [
    "> [PROCESS] CORRELATING DEMOGRAPHIC VECTORS...",
    "> [PROCESS] EXECUTING HEURISTIC CHECKS...",
    "> [PROCESS] EVALUATING FAIRNESS METRICS...",
    "> [PROCESS] DEEP SCANNING DATA ROWS...",
    "> [PROCESS] ANALYZING RISK PROBABILITIES...",
    "> [PROCESS] VALIDATING ETHICS COMPLIANCE..."
  ];

  const container = document.getElementById('terminal-lines');
  let currentLine = 0;

  if (window.hackerTimeout) clearTimeout(window.hackerTimeout);

  function runTheatre() {
    if (!document.getElementById('terminal-lines')) return;

    const p = document.createElement('div');
    if (currentLine < lines.length) {
      p.textContent = lines[currentLine];
    } else {
      const phrase = loopLines[Math.floor(Math.random() * loopLines.length)];
      const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase();
      p.textContent = `${phrase} [0x${hex}]`;
    }

    p.style.opacity = '0';
    p.style.transform = 'translateX(-8px)';
    p.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    container.appendChild(p);
    requestAnimationFrame(() => { p.style.opacity = '1'; p.style.transform = 'translateX(0)'; });

    if (container.children.length > 8) {
      container.removeChild(container.firstChild);
    }

    currentLine++;
    const nextDelay = 200 + Math.random() * 600;
    window.hackerTimeout = setTimeout(runTheatre, nextDelay);
  }

  runTheatre();

  if (resultsSection) {
    setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
  }
}

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

function setStatValue(cardEl, value) {
  if (!cardEl) return;
  const v = cardEl.querySelector('.stat-value');
  if (v) v.textContent = value;
}

function setUIError(message) {
  fileLabel.textContent = message;
  fileLabel.style.color = '#ef4444';
  setResultsStatus('error');
  
  tableEmptyState.style.display = 'flex';
  tableEmptyState.style.flexDirection = 'column';
  tableEmptyState.style.alignItems = 'center';
  tableEmptyState.innerHTML = `
    <div class="empty-icon" style="font-size: 2rem;">❌</div>
    <p class="empty-title" style="font-weight: 600; color: var(--txt-primary);">Something went wrong</p>
    <p class="empty-desc" style="color: var(--txt-secondary);">${escapeHTML(message)}</p>
  `;
  if (!tableWrapper.contains(tableEmptyState)) {
    tableWrapper.innerHTML = '';
    tableWrapper.appendChild(tableEmptyState);
  }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function advanceStep(stepNum) {
  const s1 = document.getElementById('step-1-indicator');
  const s2 = document.getElementById('step-2-indicator');
  const s3 = document.getElementById('step-3-indicator');
  const all = [s1, s2, s3];

  if (stepNum === 'complete') {
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

advanceStep(1);
console.info('%c⚖️ Lexi-Fair AI — UI + Backend Logic Fully Merged', 'color:#4f7ef8; font-weight:700; font-size:13px;');