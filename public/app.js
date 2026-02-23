const urlDescribeInput = document.getElementById('urlDescribeInput');
const runUrlDescribeBtn = document.getElementById('runUrlDescribeBtn');
const previewUrlPromptBtn = document.getElementById('previewUrlPromptBtn');
runUrlDescribeBtn.addEventListener('click', runUrlDescribe);
previewUrlPromptBtn.addEventListener('click', previewUrlPrompt);

async function runUrlDescribe() {
  if (isBusy) return;
  const url = urlDescribeInput.value.trim();
  if (!url) {
    alert('Please enter a valid URL.');
    return;
  }
  setBusy(true, 'Summarizing webpage...');
  setRequestStatus('Summarizing webpage...', 'running');
  try {
    const modelId = modelSelectUrl.value;
    // Collect customization options from URL panel UI
    const outputLanguage = document.getElementById('outputLanguageUrl').value;
    const promptStyle = document.getElementById('promptStyleUrl').value;
    const outputVerbosity = document.getElementById('outputVerbosityUrl').value;
    const outputFormat = document.getElementById('outputFormatUrl').value;
    const includeDetails = document.getElementById('includeDetailsUrl').value;
    const excludeDetails = document.getElementById('excludeDetailsUrl').value;

    const response = await fetch('/api/url-describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        modelId,
        outputLanguage,
        promptStyle,
        outputVerbosity,
        outputFormat,
        includeDetails,
        excludeDetails,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    // Render in results area, as a single result
    renderResults([data.result]);
    setRequestStatus('Webpage summarized successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
}

function renderPromptPreview(title, preview) {
  const text = JSON.stringify(preview, null, 2);
  resultsEl.innerHTML = `
    <article class="result-card">
      <div class="result-meta">${escapeHtml(title)} | Prompt Preview (no model call)</div>
      <div class="result-text" dir="ltr" style="text-align:left">${escapeHtml(text)}</div>
    </article>
  `;
}

async function previewUrlPrompt() {
  if (isBusy) return;
  const url = urlDescribeInput.value.trim();
  if (!url) {
    alert('Please enter a valid URL.');
    return;
  }
  setBusy(true, 'Building URL prompt preview...');
  setRequestStatus('Building URL prompt preview...', 'running');
  try {
    const outputLanguage = document.getElementById('outputLanguageUrl').value;
    const promptStyle = document.getElementById('promptStyleUrl').value;
    const outputVerbosity = document.getElementById('outputVerbosityUrl').value;
    const outputFormat = document.getElementById('outputFormatUrl').value;
    const includeDetails = document.getElementById('includeDetailsUrl').value;
    const excludeDetails = document.getElementById('excludeDetailsUrl').value;

    const response = await fetch('/api/url-describe-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        outputLanguage,
        promptStyle,
        outputVerbosity,
        outputFormat,
        includeDetails,
        excludeDetails,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Preview request failed');
    renderPromptPreview('URL mode', data.preview);
    setRequestStatus('URL prompt preview generated.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
}

const modelSelect = document.getElementById('modelSelect');
const audioInput = document.getElementById('audioFile');
const runOneBtn = document.getElementById('runOneBtn');
const runAllBtn = document.getElementById('runAllBtn');
const previewAudioPromptBtn = document.getElementById('previewAudioPromptBtn');
const refreshTelemetryBtn = document.getElementById('refreshTelemetryBtn');
const resultsEl = document.getElementById('results');
const telemetryEl = document.getElementById('telemetry');
const telemetryDashboardEl = document.getElementById('telemetryDashboard');
const toggleRawTelemetryBtn = document.getElementById('toggleRawTelemetryBtn');
const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');
const requestStatus = document.getElementById('requestStatus');
const resultsLoading = document.getElementById('resultsLoading');
const resultsLoadingText = document.getElementById('resultsLoadingText');
const graphsTab = document.getElementById('graphsTab');
const costGraph = document.getElementById('costGraph');
const latencyGraph = document.getElementById('latencyGraph');
const metricsGraph = document.getElementById('metricsGraph');
const audioPlayback = document.getElementById('audioPlayback');
const savedAudioSelect = document.getElementById('savedAudioSelect');
const loadSavedAudioBtn = document.getElementById('loadSavedAudioBtn');
const saveAudioName = document.getElementById('saveAudioName');
const saveAudioBtn = document.getElementById('saveAudioBtn');

let models = [];
let recordedBlob = null;
let mediaRecorder = null;
let chunks = [];
let isBusy = false;
let showRawTelemetry = false;
let activeRunButton = null;
let currentTelemetryData = null;
let loadedSavedAudio = null;

const defaultRunOneLabel = runOneBtn.textContent;
const defaultRunAllLabel = runAllBtn.textContent;

const interactiveControls = [
  runOneBtn,
  runAllBtn,
  previewAudioPromptBtn,
  previewUrlPromptBtn,
  refreshTelemetryBtn,
  recordBtn,
  toggleRawTelemetryBtn,
];

async function loadModels() {
  const response = await fetch('/api/models');
  const data = await response.json();
  models = data.models || [];
  syncModelSelects();
}

async function refreshTelemetry() {
  const response = await fetch('/api/telemetry');
  const data = await response.json();
  currentTelemetryData = data;
  renderTelemetryDashboard(data);
  renderGraphs(data);
  renderHistory(data);
  telemetryEl.textContent = JSON.stringify(data, null, 2);
}

function renderTelemetryDashboard(data) {
  if (!data) {
    telemetryDashboardEl.innerHTML = '<p>No telemetry yet.</p>';
    return;
  }

  const totals = data.totals || {};
  const byModel = Array.isArray(data.byModel) ? data.byModel : [];
  const byInputType = Array.isArray(data.byInputType) ? data.byInputType : [];
  const recent = Array.isArray(data.recent) ? data.recent : [];

  const summaryCards = [
    { label: 'Requests', value: data.totalRequests || 0 },
    { label: 'Success', value: data.successfulRequests || 0 },
    { label: 'Failed', value: data.failedRequests || 0 },
    { label: 'Total Tokens', value: formatInteger(totals.totalTokens || 0) },
    { label: 'Estimated Cost', value: `$${formatUsd(totals.estimatedCostUsd || 0)}` },
  ];

  const byModelRows = byModel.length
    ? byModel
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.modelLabel || item.modelId || 'Unknown')}</td>
              <td>${escapeHtml(item.modelType || '-')}</td>
              <td>${formatInteger(item.count || 0)}</td>
              <td>${formatInteger(item.totalTokens || 0)}</td>
              <td>$${formatUsd(item.estimatedCostUsd || 0)}</td>
              <td>${formatInteger(item.averageLatencyMs || 0)} ms</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="6">No model runs yet.</td></tr>';

  const byInputTypeRows = byInputType.length
    ? byInputType
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.inputTypeLabel || item.inputType || 'Unknown')}</td>
              <td>${formatInteger(item.count || 0)}</td>
              <td>${formatInteger(item.successCount || 0)}</td>
              <td>${formatInteger(item.totalTokens || 0)}</td>
              <td>$${formatUsd(item.estimatedCostUsd || 0)}</td>
              <td>${formatInteger(item.averageLatencyMs || 0)} ms</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="6">No runs yet.</td></tr>';

  const recentRows = recent.length
    ? recent
        .slice(0, 5)
        .map((item) => {
          const result = item.result || {};
          const usage = result.usage || {};
          const inputType = item.input?.type || (item.audio ? 'audio' : 'audio');
          const inputTypeLabel = { audio: '🎤 Audio', ocr: '🖼️ OCR', url: '🔗 URL' }[inputType] || inputType;
          return `<tr>
            <td>${new Date(item.timestamp).toLocaleString()}</td>
            <td>${inputTypeLabel}</td>
            <td>${escapeHtml(result.modelLabel || result.modelId || 'Unknown')}</td>
            <td>${result.success ? '✅' : '❌'}</td>
            <td>${formatInteger(result.latencyMs || 0)} ms</td>
            <td>${formatInteger(usage.totalTokens || 0)}</td>
            <td>$${formatUsd(usage.estimatedCostUsd || 0)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="7">No recent runs yet.</td></tr>';

  telemetryDashboardEl.innerHTML = `
    <div class="dashboard-grid">
      ${summaryCards
        .map(
          (card) => `
            <article class="metric-card">
              <p class="metric-label">${card.label}</p>
              <p class="metric-value">${card.value}</p>
            </article>
          `,
        )
        .join('')}
    </div>

    <h3 class="dashboard-title">By Model</h3>
    <div class="table-wrap">
      <table class="telemetry-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Type</th>
            <th>Runs</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Avg Latency</th>
          </tr>
        </thead>
        <tbody>${byModelRows}</tbody>
      </table>
    </div>

    <h3 class="dashboard-title">By Input Type</h3>
    <div class="table-wrap">
      <table class="telemetry-table">
        <thead>
          <tr>
            <th>Input Type</th>
            <th>Runs</th>
            <th>Success</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Avg Latency</th>
          </tr>
        </thead>
        <tbody>${byInputTypeRows}</tbody>
      </table>
    </div>

    <h3 class="dashboard-title">Recent Runs</h3>
    <div class="table-wrap">
      <table class="telemetry-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Input</th>
            <th>Model</th>
            <th>Success</th>
            <th>Latency</th>
            <th>Tokens</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>${recentRows}</tbody>
      </table>
    </div>
  `;
}

function formatInteger(value) {
  return Number(value || 0).toLocaleString();
}

function formatUsd(value) {
  return Number(value || 0).toFixed(6);
}

function setBusy(nextBusy, message = '') {
  isBusy = nextBusy;
  interactiveControls.forEach((control) => {
    if (control) {
      control.disabled = nextBusy;
    }
  });

  resultsLoading.classList.toggle('hidden', !nextBusy);
  resultsLoadingText.textContent = message || 'Processing...';

  if (nextBusy) {
    requestStatus.textContent = message || 'Processing...';
    requestStatus.className = 'request-status request-status-running';

    if (activeRunButton === runOneBtn) {
      runOneBtn.textContent = 'Running selected...';
    }

    if (activeRunButton === runAllBtn) {
      runAllBtn.textContent = 'Running all...';
    }
  } else {
    requestStatus.className = 'request-status';
    runOneBtn.textContent = defaultRunOneLabel;
    runAllBtn.textContent = defaultRunAllLabel;
    activeRunButton = null;
  }
}

function setRequestStatus(message, kind = 'idle') {
  requestStatus.textContent = message;
  requestStatus.className =
    kind === 'success'
      ? 'request-status request-status-success'
      : kind === 'error'
        ? 'request-status request-status-error'
        : kind === 'running'
          ? 'request-status request-status-running'
          : 'request-status';
}

function getCurrentAudio() {
  const file = audioInput.files?.[0];
  if (file) {
    loadedSavedAudio = null; // Clear saved audio when new file is uploaded
    return file;
  }

  if (recordedBlob) {
    loadedSavedAudio = null; // Clear saved audio when new recording is made
    return new File([recordedBlob], 'recording.webm', { type: recordedBlob.type || 'audio/webm' });
  }

  if (loadedSavedAudio) {
    // Convert saved audio base64 back to File
    const byteCharacters = atob(loadedSavedAudio.audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: loadedSavedAudio.mimeType });
    return new File([blob], 'saved-audio', { type: loadedSavedAudio.mimeType });
  }

  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderResults(results) {
  if (!results || results.length === 0) {
    resultsEl.innerHTML = '<p>No results.</p>';
    return;
  }

  resultsEl.innerHTML = results
    .map((item) => {
      const meta = [
        `Model: ${item.modelLabel}`,
        `Type: ${item.modelType}`,
        `Success: ${item.success}`,
        `Latency: ${item.latencyMs} ms`,
        `Tokens (in/out/total): ${item.usage.inputTokens}/${item.usage.outputTokens}/${item.usage.totalTokens}`,
        `Estimated Cost: $${item.usage.estimatedCostUsd.toFixed(6)}`,
      ].join(' | ');

      const text = item.success ? item.text : `Error: ${item.error || 'Unknown error'}`;

      // Direction detection: RTL if contains Arabic, else LTR
      const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
      const dir = isArabic ? 'rtl' : 'ltr';
      const align = isArabic ? 'right' : 'left';

      return `<article class="result-card"><div class="result-meta">${meta}</div><div class="result-text" dir="${dir}" style="text-align:${align}">${escapeHtml(text)}</div></article>`;
    })
    .join('');
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function runDescribe(runAll) {
  if (isBusy) {
    return;
  }

  const file = getCurrentAudio();
  if (!file) {
    alert('Please upload or record audio first.');
    return;
  }

  activeRunButton = runAll ? runAllBtn : runOneBtn;
  setBusy(true, runAll ? 'Running all models...' : 'Running selected model...');
  setRequestStatus(runAll ? 'Running all models...' : 'Running selected model...', 'running');


  const outputLanguage = document.getElementById('outputLanguage').value;
  const promptStyle = document.getElementById('promptStyle').value;
  const outputVerbosity = document.getElementById('outputVerbosity').value;
  const outputFormat = document.getElementById('outputFormat').value;
  const includeDetails = document.getElementById('includeDetails').value;
  const excludeDetails = document.getElementById('excludeDetails').value;
  const productUrl = document.getElementById('productUrl')?.value || '';

  try {
    const audioBase64 = await fileToBase64(file);

    const payloadBase = {
      audioBase64,
      mimeType: file.type || 'audio/webm',
      outputLanguage,
      promptStyle,
      outputVerbosity,
      outputFormat,
      includeDetails,
      excludeDetails,
      productUrl,
    };

    const payload = runAll
      ? { runAll: true, ...payloadBase }
      : { modelId: modelSelect.value, ...payloadBase };

    const response = await fetch('/api/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    renderResults(data.results || []);
    await refreshTelemetry();
    setRequestStatus('Completed successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
}

async function previewAudioPrompt() {
  if (isBusy) return;

  const file = getCurrentAudio();
  if (!file) {
    alert('Please upload or record audio first.');
    return;
  }

  setBusy(true, 'Building audio prompt preview...');
  setRequestStatus('Building audio prompt preview...', 'running');

  const outputLanguage = document.getElementById('outputLanguage').value;
  const promptStyle = document.getElementById('promptStyle').value;
  const outputVerbosity = document.getElementById('outputVerbosity').value;
  const outputFormat = document.getElementById('outputFormat').value;
  const includeDetails = document.getElementById('includeDetails').value;
  const excludeDetails = document.getElementById('excludeDetails').value;

  try {
    const response = await fetch('/api/describe-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mimeType: file.type || 'audio/webm',
        outputLanguage,
        promptStyle,
        outputVerbosity,
        outputFormat,
        includeDetails,
        excludeDetails,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Preview request failed');
    }

    renderPromptPreview('Audio mode', data.preview);
    setRequestStatus('Audio prompt preview generated.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(chunks, { type: 'audio/webm' });
      loadedSavedAudio = null;
      audioInput.value = '';
      recordStatus.textContent = `Recorded ${Math.round(recordedBlob.size / 1024)} KB audio`;
      recordBtn.textContent = 'Start recording';
      stream.getTracks().forEach((track) => track.stop());
      
      // Update audio playback for recorded audio
      const audioURL = URL.createObjectURL(recordedBlob);
      audioPlayback.src = audioURL;
      audioPlayback.classList.remove('hidden');
    };

    mediaRecorder.start();
    recordStatus.textContent = 'Recording... click again to stop';
    recordBtn.textContent = 'Stop recording';
  } catch (error) {
    alert(`Recorder error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

runOneBtn.addEventListener('click', () => runDescribe(false));
runAllBtn.addEventListener('click', () => runDescribe(true));
previewAudioPromptBtn.addEventListener('click', previewAudioPrompt);
refreshTelemetryBtn.addEventListener('click', refreshTelemetry);
recordBtn.addEventListener('click', toggleRecording);
toggleRawTelemetryBtn.addEventListener('click', () => {
  showRawTelemetry = !showRawTelemetry;
  telemetryEl.classList.toggle('hidden', !showRawTelemetry);
  toggleRawTelemetryBtn.textContent = showRawTelemetry ? 'Hide raw JSON' : 'Show raw JSON';
});

// Saved audio functions
async function loadSavedAudioList() {
  try {
    const response = await fetch('/api/saved-audio');
    const data = await response.json();
    savedAudioSelect.innerHTML = '<option value="">-- Select saved audio --</option>' +
      (data.savedAudio || []).map(audio => 
        `<option value="${audio.id}">${escapeHtml(audio.name)} (${new Date(audio.createdAt).toLocaleDateString()})</option>`
      ).join('');
  } catch (error) {
    console.error('Failed to load saved audio list:', error);
  }
}

loadSavedAudioBtn.addEventListener('click', async () => {
  const selectedId = savedAudioSelect.value;
  if (!selectedId) {
    alert('Please select a saved audio file.');
    return;
  }
  try {
    const response = await fetch(`/api/saved-audio/${selectedId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load audio');
    }
    loadedSavedAudio = data;
    recordedBlob = null;
    audioInput.value = '';
    
    // Convert base64 to blob for playback
    const byteCharacters = atob(data.audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: data.mimeType });
    const audioURL = URL.createObjectURL(blob);
    audioPlayback.src = audioURL;
    audioPlayback.classList.remove('hidden');
    recordStatus.textContent = `Loaded: ${data.name}`;
  } catch (error) {
    alert(`Failed to load audio: ${error.message}`);
  }
});

saveAudioBtn.addEventListener('click', async () => {
  const name = saveAudioName.value.trim();
  if (!name) {
    alert('Please enter a name for this audio.');
    return;
  }
  
  const file = getCurrentAudio();
  if (!file) {
    alert('No audio to save. Please upload or record audio first.');
    return;
  }
  
  try {
    const audioBase64 = await fileToBase64(file);
    const response = await fetch('/api/saved-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        audioBase64,
        mimeType: file.type || 'audio/webm',
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save audio');
    }
    alert(`Audio saved as "${name}"`);
    saveAudioName.value = '';
    await loadSavedAudioList();
  } catch (error) {
    alert(`Failed to save audio: ${error.message}`);
  }
});

loadModels().then(refreshTelemetry).then(loadSavedAudioList).catch((err) => {
  setRequestStatus('Initialization failed.', 'error');
  telemetryEl.textContent = `Initialization failed: ${err instanceof Error ? err.message : String(err)}`;
});

let costChartInstance = null;
let latencyChartInstance = null;
let metricsChartInstance = null;

function renderGraphs(data) {
  const byModel = Array.isArray(data.byModel) ? data.byModel : [];

  const labels = byModel.map((item) => item.modelLabel || item.modelId || 'Unknown');
  const successRates = byModel.map((item) => item.count > 0 ? ((item.successCount || 0) / item.count) * 100 : 0);
  const avgCosts = byModel.map((item) => item.count > 0 ? item.estimatedCostUsd / item.count : 0);
  const avgTokens = byModel.map((item) => item.count > 0 ? item.totalTokens / item.count : 0);

  // Destroy existing charts before creating new ones
  if (costChartInstance) costChartInstance.destroy();
  if (latencyChartInstance) latencyChartInstance.destroy();
  if (metricsChartInstance) metricsChartInstance.destroy();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  costChartInstance = new Chart(costGraph, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Avg Cost per Request (USD)', data: avgCosts, backgroundColor: 'rgba(75, 192, 192, 0.6)' }],
    },
    options: chartOptions,
  });

  latencyChartInstance = new Chart(latencyGraph, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Success Rate (%)', data: successRates, backgroundColor: 'rgba(54, 162, 235, 0.6)' }],
    },
    options: chartOptions,
  });

  metricsChartInstance = new Chart(metricsGraph, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Avg Tokens per Request', data: avgTokens, backgroundColor: 'rgba(255, 206, 86, 0.6)' }],
    },
    options: chartOptions,
  });
}

// Graph tab switching
const graphTabs = document.querySelectorAll('.graph-tab');
const graphContainers = {
  cost: document.getElementById('graphCostContainer'),
  success: document.getElementById('graphSuccessContainer'),
  tokens: document.getElementById('graphTokensContainer'),
  history: document.getElementById('graphHistoryContainer'),
};

const historyModelFilter = document.getElementById('historyModelFilter');
const historyContent = document.getElementById('historyContent');

graphTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    // Update active tab styling
    graphTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show/hide graph containers
    Object.entries(graphContainers).forEach(([key, container]) => {
      container.classList.toggle('hidden', key !== targetTab);
    });
    
    // Render history if switching to history tab
    if (targetTab === 'history' && currentTelemetryData) {
      renderHistory(currentTelemetryData);
    }
  });
});

function renderHistory(data) {
  currentTelemetryData = data;
  const recent = Array.isArray(data.recent) ? data.recent : [];
  const byModel = Array.isArray(data.byModel) ? data.byModel : [];
  
  // Update filter dropdown
  const currentFilter = historyModelFilter.value;
  historyModelFilter.innerHTML = '<option value="">All models</option>' +
    byModel.map(m => `<option value="${escapeHtml(m.modelId)}">${escapeHtml(m.modelLabel || m.modelId)}</option>`).join('');
  historyModelFilter.value = currentFilter;
  
  // Filter records
  const filterModel = historyModelFilter.value;
  const filteredRecords = filterModel 
    ? recent.filter(r => r.result?.modelId === filterModel)
    : recent;
  
  if (filteredRecords.length === 0) {
    historyContent.innerHTML = '<p>No response history available.</p>';
    return;
  }
  
  historyContent.innerHTML = filteredRecords.map(item => {
    const result = item.result || {};
    const text = result.text || '(No response text)';
    const timestamp = new Date(item.timestamp).toLocaleString();
    const success = result.success ? '✅' : '❌';
    const inputType = item.input?.type || (item.audio ? 'audio' : 'audio');
    const inputTypeLabel = { audio: '🎤 Audio', ocr: '🖼️ OCR', url: '🔗 URL' }[inputType] || inputType;
    
    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-model">${inputTypeLabel} · ${escapeHtml(result.modelLabel || result.modelId || 'Unknown')} ${success}</span>
          <span>${timestamp}</span>
        </div>
        <div class="history-item-text">${escapeHtml(text)}</div>
      </div>
    `;
  }).join('');
}

historyModelFilter.addEventListener('change', () => {
  if (currentTelemetryData) {
    renderHistory(currentTelemetryData);
  }
});

audioInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    loadedSavedAudio = null;
    recordedBlob = null;
    const audioURL = URL.createObjectURL(file);
    audioPlayback.src = audioURL;
    audioPlayback.classList.remove('hidden');
    recordStatus.textContent = `Uploaded: ${file.name}`;
  } else {
    audioPlayback.src = '';
    audioPlayback.classList.add('hidden');
    recordStatus.textContent = 'Recorder idle';
  }
});

const audioTab = document.getElementById('audioTab');
const urlTab = document.getElementById('urlTab');
const ocrTab = document.getElementById('ocrTab');
const audioInputPanel = document.getElementById('audioInputPanel');
const urlInputPanel = document.getElementById('urlInputPanel');
const ocrInputPanel = document.getElementById('ocrInputPanel');
const modelSelectUrl = document.getElementById('modelSelectUrl');
const ocrModelSelect = document.getElementById('ocrModelSelect');
const ocrImageFile = document.getElementById('ocrImageFile');
const runOcrBtn = document.getElementById('runOcrBtn');
const previewOcrPromptBtn = document.getElementById('previewOcrPromptBtn');
const ocrOutputLanguage = document.getElementById('ocrOutputLanguage');
const ocrPromptStyle = document.getElementById('ocrPromptStyle');
const ocrOutputVerbosity = document.getElementById('ocrOutputVerbosity');
const ocrOutputFormat = document.getElementById('ocrOutputFormat');
const ocrIncludeDetails = document.getElementById('ocrIncludeDetails');
const ocrExcludeDetails = document.getElementById('ocrExcludeDetails');

interactiveControls.push(previewOcrPromptBtn);

audioTab.addEventListener('click', () => {
  audioTab.classList.add('active');
  urlTab.classList.remove('active');
  ocrTab.classList.remove('active');
  audioInputPanel.classList.remove('hidden');
  urlInputPanel.classList.add('hidden');
  ocrInputPanel.classList.add('hidden');
});
urlTab.addEventListener('click', () => {
  urlTab.classList.add('active');
  audioTab.classList.remove('active');
  ocrTab.classList.remove('active');
  urlInputPanel.classList.remove('hidden');
  audioInputPanel.classList.add('hidden');
  ocrInputPanel.classList.add('hidden');
});
ocrTab.addEventListener('click', () => {
  ocrTab.classList.add('active');
  audioTab.classList.remove('active');
  urlTab.classList.remove('active');
  ocrInputPanel.classList.remove('hidden');
  audioInputPanel.classList.add('hidden');
  urlInputPanel.classList.add('hidden');
});

// Keep both model selects in sync
function syncModelSelects() {
  if (!models.length) return;
  const opts = models
    .map(
      (model) =>
        `<option value="${model.id}">${model.label} | ${model.type} | in: $${model.inputCostPer1MTokens}/1M out: $${model.outputCostPer1MTokens}/1M</option>`,
    )
    .join('');
  modelSelect.innerHTML = opts;
  modelSelectUrl.innerHTML = opts;
  ocrModelSelect.innerHTML = opts;
  // Keep selection in sync
  modelSelectUrl.value = modelSelect.value;
  ocrModelSelect.value = modelSelect.value;
}
runOcrBtn.addEventListener('click', async () => {
  if (isBusy) return;
  const file = ocrImageFile.files[0];
  if (!file) {
    alert('Please upload an image file.');
    return;
  }
  setBusy(true, 'Running OCR...');
  setRequestStatus('Running OCR...', 'running');
  try {
    // Convert file to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const modelId = ocrModelSelect.value;
    const outputLanguage = ocrOutputLanguage.value;
    const promptStyle = ocrPromptStyle.value;
    const outputVerbosity = ocrOutputVerbosity.value;
    const outputFormat = ocrOutputFormat.value;
    const includeDetails = ocrIncludeDetails.value;
    const excludeDetails = ocrExcludeDetails.value;
    const response = await fetch('/api/ocr-describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        modelId,
        outputLanguage,
        promptStyle,
        outputVerbosity,
        outputFormat,
        includeDetails,
        excludeDetails,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OCR request failed');
    renderResults([data.result]);
    setRequestStatus('OCR completed successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
});

previewOcrPromptBtn.addEventListener('click', async () => {
  if (isBusy) return;
  const file = ocrImageFile.files[0];
  if (!file) {
    alert('Please upload an image file.');
    return;
  }

  setBusy(true, 'Building OCR prompt preview...');
  setRequestStatus('Building OCR prompt preview...', 'running');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/ocr-describe-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        outputLanguage: ocrOutputLanguage.value,
        promptStyle: ocrPromptStyle.value,
        outputVerbosity: ocrOutputVerbosity.value,
        outputFormat: ocrOutputFormat.value,
        includeDetails: ocrIncludeDetails.value,
        excludeDetails: ocrExcludeDetails.value,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OCR preview request failed');

    renderPromptPreview('OCR mode', data.preview);
    setRequestStatus('OCR prompt preview generated.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setRequestStatus(`Failed: ${message}`, 'error');
    alert(message);
  } finally {
    setBusy(false);
  }
});

modelSelect.addEventListener('change', () => {
  modelSelectUrl.value = modelSelect.value;
});
modelSelectUrl.addEventListener('change', () => {
  modelSelect.value = modelSelectUrl.value;
});
