/* Darkroom frontend: plain JavaScript, no libraries, talks only to this server's /api. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const PREFS_KEY = 'darkroom.prefs.v1';      // localStorage: non-sensitive settings per preset (sizes, steps, model...)
  const SESSION_KEY = 'darkroom.session.v1';  // sessionStorage: prompt text + seed, gone when the browser closes
  const VALUE_FIELDS = ['prompt', 'negative', 'steps', 'cfg', 'width', 'height', 'frames', 'fps', 'sampler', 'scheduler', 'model', 'style'];
  const SETTING_FIELDS = ['steps', 'cfg', 'width', 'height', 'frames', 'fps', 'sampler', 'scheduler', 'model', 'style'];

  const el = {
    conn: $('#conn'), connText: $('#conn-text'), offline: $('#offline-banner'), offlineDetail: $('#offline-detail'), templateProblems: $('#template-problems'),
    tabs: $$('.tab'), form: $('#gen-form'), workflow: $('#workflow'), wfDesc: $('#wf-desc'),
    fieldModel: $('#field-model'), model: $('#model'), modelHint: $('#model-hint'), refreshModels: $('#refresh-models'),
    fieldSource: $('#field-source'), dropzone: $('#dropzone'), sourcePreview: $('#source-preview'), image: $('#image'), sourceName: $('#source-name'), clearSource: $('#clear-source'),
    fieldPrompt: $('#field-prompt'), prompt: $('#prompt'), promptLabel: $('#prompt-label'), noPromptNote: $('#no-prompt-note'),
    fieldNegative: $('#field-negative'), negative: $('#negative'), style: $('#style'),
    steps: $('#steps'), cfg: $('#cfg'), seed: $('#seed'), seedDice: $('#seed-dice'), seedLock: $('#seed-lock'), width: $('#width'), height: $('#height'), frames: $('#frames'), fps: $('#fps'),
    fields: { steps: $('#field-steps'), cfg: $('#field-cfg'), seed: $('#field-seed'), width: $('#field-width'), height: $('#field-height'), frames: $('#field-frames'), fps: $('#field-fps') },
    sizePresets: $('#size-presets'), sizeHelp: $('#size-help'), advanced: $('#advanced'), sampler: $('#sampler'), scheduler: $('#scheduler'),
    generate: $('#generate'), cancel: $('#cancel'), status: $('#status'), barFill: $('#bar-fill'), statusLabel: $('#status-label'), statusDetail: $('#status-detail'),
    viewer: $('#viewer'), viewerEmpty: $('#viewer-empty'), livePreview: $('#live-preview'), resultImg: $('#result-img'), resultVideo: $('#result-video'),
    resultMeta: $('#result-meta'), resultPrompt: $('#result-prompt'), resultChips: $('#result-chips'),
    btnDownload: $('#btn-download'), btnOpen: $('#btn-open'), btnToVideo: $('#btn-to-video'), btnReuse: $('#btn-reuse'), btnCopy: $('#btn-copy'), btnDelete: $('#btn-delete'),
    galleryGrid: $('#gallery-grid'), galleryEmpty: $('#gallery-empty'), galleryMore: $('#gallery-more'), galleryCount: $('#gallery-count'), galleryRefresh: $('#gallery-refresh'), segBtns: $$('.seg-btn'), outputsDir: $('#outputs-dir'),
    historyList: $('#history-list'), historyEmpty: $('#history-empty'), historyClear: $('#history-clear'),
    toasts: $('#toasts'), toastTpl: $('#toast-tpl'),
  };
  el.bar = $('.bar', el.status);

  const state = {
    options: null,
    mode: 'txt2img',
    workflowId: { txt2img: null, img2vid: null },
    job: null,
    pollTimer: null,
    statusTimer: null,
    online: null,
    gallery: { items: [], total: 0, kind: '', offset: 0, limit: 60, loading: false },
    source: { file: null, galleryName: null, url: null },
    current: null,
    prefs: loadPrefs(),
    session: loadSession(),
    applying: false,
    submitting: false,
  };

  // ---- small helpers ----------------------------------------------------------
  class ApiError extends Error {
    constructor(message, hint, status, details) { super(message); this.hint = hint; this.status = status; this.details = details; }
  }

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { cache: 'no-store', ...opts });
    } catch (e) {
      throw new ApiError('Darkroom server is not reachable. Is app.py still running?', null, 0);
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      const err = (data && data.error) || {};
      throw new ApiError(err.message || `HTTP ${res.status}`, err.hint || null, res.status, err.details);
    }
    return data;
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); } catch (e) { /* fine */ }
  }
  let saveTimer = null;
  function savePrefs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch (e) { /* private mode: fine */ } }, 150);
  }

  const show = (node, on) => node && node.classList.toggle('hidden', !on);
  const basename = (p) => String(p || '').split(/[\\/]/).pop();
  const fmtDate = (ts) => ts ? new Date(ts * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const fmtBytes = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const snap = (v, step) => Math.round(v / step) * step;

  function fillSelect(select, values, selected, { labels } = {}) {
    select.textContent = '';
    for (const v of values) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = labels ? labels(v) : v;
      select.appendChild(opt);
    }
    if (selected != null && values.includes(selected)) select.value = selected;
  }

  function toast(title, { msg = '', hint = '', kind = 'info', timeout = kind === 'error' ? 20000 : 6000 } = {}) {
    const node = el.toastTpl.content.firstElementChild.cloneNode(true);
    node.classList.add(`toast--${kind}`);
    $('.toast-title', node).textContent = title;
    $('.toast-msg', node).textContent = msg;
    $('.toast-hint', node).textContent = hint;
    show($('.toast-msg', node), !!msg);
    show($('.toast-hint', node), !!hint);
    const close = () => node.remove();
    $('.toast-close', node).addEventListener('click', close);
    el.toasts.appendChild(node);
    if (timeout) setTimeout(close, timeout);
    while (el.toasts.children.length > 4) el.toasts.firstElementChild.remove();
  }
  const toastError = (e, title = 'Something went wrong') => toast(title, { msg: e.message || String(e), hint: e.hint || '', kind: 'error' });

  // ---- options / workflow presets ------------------------------------------
  function currentTemplate() {
    if (!state.options) return null;
    return state.options.workflows.find((w) => w.id === state.workflowId[state.mode]) || null;
  }

  async function loadOptions({ fresh = false, quiet = false } = {}) {
    try {
      state.options = await api(`/api/options${fresh ? '?fresh=1' : ''}`);
    } catch (e) {
      if (!quiet) toastError(e, 'Could not load presets');
      return;
    }
    const styles = state.options.styles || [];
    fillSelect(el.style, styles.map((s) => s.id), el.style.value || (state.prefs.style || 'none'), { labels: (id) => (styles.find((s) => s.id === id) || {}).name || id });
    const problems = state.options.template_problems || [];
    el.templateProblems.textContent = problems.length ? 'Some workflow files were skipped:\n' + problems.join('\n') : '';
    show(el.templateProblems, problems.length > 0);
    populateWorkflows();
  }

  function populateWorkflows() {
    const list = (state.options ? state.options.workflows : []).filter((w) => w.mode === state.mode);
    const saved = (state.prefs.workflow || {})[state.mode];
    const chosen = list.find((w) => w.id === (state.workflowId[state.mode] || saved)) || list[0] || null;
    fillSelect(el.workflow, list.map((w) => w.id), chosen ? chosen.id : null, { labels: (id) => list.find((w) => w.id === id).name });
    state.workflowId[state.mode] = chosen ? chosen.id : null;
    el.workflow.disabled = list.length === 0;
    if (!chosen) {
      el.wfDesc.textContent = `No ${state.mode === 'txt2img' ? 'text-to-image' : 'image-to-video'} workflow found in darkroom/workflows/.`;
      el.generate.disabled = true;
      return;
    }
    el.generate.disabled = false;
    applyWorkflow();
  }

  function applyWorkflow() {
    const t = currentTemplate();
    if (!t) return;
    state.applying = true;
    const c = t.controls;
    const cons = t.constraints || {};
    const d = t.defaults || {};
    const saved = { ...(((state.prefs.values || {})[t.id]) || {}), ...(((state.session.texts || {})[t.id]) || {}) };

    el.wfDesc.textContent = t.description || '';
    show(el.fieldPrompt, c.prompt);
    show(el.noPromptNote, !c.prompt);
    show(el.fieldNegative, c.negative);
    show(el.fields.steps, c.steps);
    show(el.fields.cfg, c.cfg);
    show(el.fields.seed, c.seed);
    show(el.fields.width, c.size);
    show(el.fields.height, c.size);
    show(el.fields.frames, c.frames);
    show(el.fields.fps, c.fps);
    show(el.advanced, c.sampler);
    show(el.fieldModel, c.model && !!t.model);

    el.promptLabel.textContent = state.mode === 'img2vid' ? 'Motion prompt' : 'Prompt';
    el.prompt.placeholder = state.mode === 'img2vid' ? 'Describe the motion: camera, movement, mood…' : 'Describe the image you want…';

    const step = cons.size_step || 8;
    el.width.step = el.height.step = step;
    el.width.min = el.height.min = cons.size_min || 16;
    el.width.max = el.height.max = cons.size_max || 16384;
    el.frames.min = cons.frames_min || 1;
    el.frames.max = cons.frames_max || 4096;
    const sizeNotes = [];
    if (c.size) sizeNotes.push(`Width/height snap to multiples of ${step}.`);
    if (c.frames && cons.frames_rule) sizeNotes.push(`Frames snap to ${cons.frames_rule}.`);
    el.sizeHelp.textContent = sizeNotes.join(' ');
    show(el.sizeHelp, sizeNotes.length > 0);

    // Values: what you used last time with this preset, else the preset's defaults.
    const pick = (k) => (saved[k] !== undefined && saved[k] !== null && saved[k] !== '' ? saved[k] : d[k]);
    el.prompt.value = saved.prompt !== undefined ? saved.prompt : (d.prompt || '');
    el.negative.value = saved.negative !== undefined ? saved.negative : (d.negative || '');
    el.steps.value = pick('steps') ?? 25;
    el.cfg.value = pick('cfg') ?? 6;
    el.width.value = pick('width') ?? 1024;
    el.height.value = pick('height') ?? 1024;
    el.frames.value = pick('frames') ?? 81;
    el.fps.value = pick('fps') ?? 16;
    if (saved.seed !== undefined) el.seed.value = saved.seed;
    el.seedLock.checked = !!saved.seedLock;
    if (saved.style && Array.from(el.style.options).some((o) => o.value === saved.style)) el.style.value = saved.style;

    // Model dropdown: live list from ComfyUI for the node this preset loads its model with.
    if (t.model) {
      const key = `${t.model.node_class}.${t.model.input}`;
      const files = (state.options.models || {})[key] || [];
      const want = saved.model || t.model.default || '';
      if (files.length) {
        fillSelect(el.model, files, files.includes(want) ? want : files[0], { labels: basename });
        el.model.disabled = false;
        const missingDefault = t.model.default && !files.includes(t.model.default) && !saved.model;
        el.modelHint.textContent = missingDefault ? `The preset's default file (${t.model.default}) is not installed; using the first file ComfyUI lists instead.` : '';
        show(el.modelHint, !!missingDefault);
      } else {
        fillSelect(el.model, want ? [want] : [], want);
        el.model.disabled = true;
        el.modelHint.textContent = state.online === false
          ? 'ComfyUI is offline, so the installed models cannot be listed yet.'
          : `ComfyUI lists no files for ${t.model.node_class}. Put a model in the folder named under "requires" in the workflow file, then press ↻.`;
        show(el.modelHint, true);
      }
    } else {
      fillSelect(el.model, [], null);  // no dropdown for this preset: never send a stale model name
    }

    // Sampler / scheduler (Advanced).
    const samplers = state.options.samplers && state.options.samplers.length ? state.options.samplers : [pick('sampler') || 'euler'];
    const schedulers = state.options.schedulers && state.options.schedulers.length ? state.options.schedulers : [pick('scheduler') || 'normal'];
    fillSelect(el.sampler, samplers, samplers.includes(pick('sampler')) ? pick('sampler') : samplers[0]);
    fillSelect(el.scheduler, schedulers, schedulers.includes(pick('scheduler')) ? pick('scheduler') : schedulers[0]);

    renderSizePresets(t);
    state.applying = false;
  }

  function renderSizePresets(t) {
    el.sizePresets.textContent = '';
    const sizes = t.sizes || [];
    show(el.sizePresets, t.controls.size && (sizes.length > 0 || state.mode === 'img2vid'));
    for (const [w, h] of sizes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = `${w}×${h}`;
      b.addEventListener('click', () => { el.width.value = w; el.height.value = h; markActiveSize(); saveValues(); });
      el.sizePresets.appendChild(b);
    }
    if (state.mode === 'img2vid') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.id = 'match-aspect';
      b.textContent = '⟷ match source';
      b.title = 'Pick a size with the same aspect ratio as the source image';
      b.addEventListener('click', matchSourceAspect);
      el.sizePresets.appendChild(b);
    }
    markActiveSize();
  }

  function markActiveSize() {
    const w = Number(el.width.value), h = Number(el.height.value);
    $$('.chip', el.sizePresets).forEach((chip) => chip.classList.toggle('is-active', chip.textContent === `${w}×${h}`));
  }

  function matchSourceAspect() {
    const t = currentTemplate();
    const iw = el.sourcePreview.naturalWidth, ih = el.sourcePreview.naturalHeight;
    if (!t || !iw || !ih) { toast('Choose a source image first'); return; }
    const cons = t.constraints || {}, step = cons.size_step || 8;
    const area = (t.defaults.width || 832) * (t.defaults.height || 480);
    const aspect = iw / ih;
    let w = snap(Math.sqrt(area * aspect), step), h = snap(Math.sqrt(area / aspect), step);
    w = clamp(w, cons.size_min || 16, cons.size_max || 4096);
    h = clamp(h, cons.size_min || 16, cons.size_max || 4096);
    el.width.value = w; el.height.value = h;
    markActiveSize();
    saveValues();
  }

  function saveValues() {
    if (state.applying) return;
    const t = currentTemplate();
    if (!t) return;
    const values = {};
    for (const k of SETTING_FIELDS) values[k] = el[k].value;
    state.prefs.values = state.prefs.values || {};
    state.prefs.values[t.id] = values;
    state.prefs.workflow = { ...(state.prefs.workflow || {}), [state.mode]: t.id };
    state.prefs.mode = state.mode;
    state.prefs.style = el.style.value;
    savePrefs();
    state.session.texts = state.session.texts || {};
    state.session.texts[t.id] = { prompt: el.prompt.value, negative: el.negative.value, seed: el.seed.value, seedLock: el.seedLock.checked };
    saveSession();
  }

  function setMode(mode) {
    if (!['txt2img', 'img2vid'].includes(mode)) return;
    state.mode = mode;
    el.tabs.forEach((tab) => {
      const on = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    show(el.fieldSource, mode === 'img2vid');
    state.prefs.mode = mode;
    savePrefs();
    populateWorkflows();
  }

  // ---- source image (image -> video) --------------------------------------
  function setSourceFile(file) {
    if (!file || !file.type.startsWith('image/')) { toast('That is not an image file'); return; }
    if (state.source.url && state.source.file) URL.revokeObjectURL(state.source.url);
    state.source = { file, galleryName: null, url: URL.createObjectURL(file) };
    renderSource(file.name);
  }
  function setSourceGallery(record) {
    if (state.source.url && state.source.file) URL.revokeObjectURL(state.source.url);
    state.source = { file: null, galleryName: record.file, url: record.url };
    renderSource(record.file);
    if (state.mode !== 'img2vid') setMode('img2vid');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Source image set', { msg: 'Add a motion prompt and press Generate.', kind: 'ok', timeout: 3500 });
  }
  function renderSource(name) {
    el.sourcePreview.src = state.source.url;
    show(el.sourcePreview, true);
    el.dropzone.classList.add('has-image');
    el.sourceName.textContent = name;
    show(el.clearSource, true);
  }
  function clearSource() {
    if (state.source.url && state.source.file) URL.revokeObjectURL(state.source.url);
    state.source = { file: null, galleryName: null, url: null };
    el.sourcePreview.removeAttribute('src');
    show(el.sourcePreview, false);
    el.dropzone.classList.remove('has-image');
    el.sourceName.textContent = '';
    show(el.clearSource, false);
    el.image.value = '';
  }

  // ---- generation ------------------------------------------------------------
  function setBusy(busy) {
    el.generate.disabled = busy;
    el.generate.textContent = busy ? 'Generating…' : 'Generate';
    show(el.cancel, busy);
    el.viewer.classList.toggle('is-busy', busy);
  }

  async function generate() {
    const t = currentTemplate();
    if (!t) { toast('No workflow preset selected'); return; }
    if (state.submitting || (state.job && state.job.active)) return;
    if (state.online === false) {
      toast('ComfyUI is not running', { msg: el.offlineDetail.textContent, kind: 'error' });
      return;
    }
    if (t.controls.prompt && !el.prompt.value.trim()) { toast('Write a prompt first'); el.prompt.focus(); return; }
    if (state.mode === 'img2vid' && !state.source.file && !state.source.galleryName) {
      toast('Choose a source image', { msg: 'Drop one on the box above, paste it, or press “→ Video” on a gallery image.' });
      return;
    }
    const fd = new FormData();
    fd.append('mode', state.mode);
    fd.append('workflow', t.id);
    for (const k of VALUE_FIELDS) fd.append(k, k === 'model' ? (t.model ? el.model.value : '') : el[k].value);
    fd.append('seed', el.seedLock.checked ? el.seed.value : '');
    if (state.source.file) fd.append('image', state.source.file, state.source.file.name);
    else if (state.source.galleryName) fd.append('source', state.source.galleryName);

    state.submitting = true;
    setBusy(true);
    el.status.classList.remove('is-error', 'is-done');
    show(el.status, true);
    setProgress({ label: 'Sending to ComfyUI…', value: 0, max: 0 });
    try {
      const job = await api('/api/generate', { method: 'POST', body: fd });
      startJob(job);
    } catch (e) {
      setBusy(false);
      el.status.classList.add('is-error');
      setProgress({ label: 'Not started', value: 0, max: 0 }, e.message);
      toastError(e, e.status === 503 ? 'ComfyUI is not running' : 'Could not start the job');
    } finally {
      state.submitting = false;
    }
  }

  function startJob(job) {
    state.job = job;
    if (job.params && job.params.seed != null) { el.seed.value = job.params.seed; saveValues(); }
    setBusy(true);
    show(el.status, true);
    el.status.classList.remove('is-error', 'is-done');
    renderJob(job);
    clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(pollJob, 500);
  }

  async function pollJob() {
    if (!state.job) return;
    let job;
    try {
      job = await api(`/api/jobs/${state.job.id}`);
    } catch (e) {
      if (e.status === 404) { finishJob({ ...state.job, status: 'error', active: false, error: { message: e.message } }); return; }
      state.pollTimer = setTimeout(pollJob, 1500);  // server hiccup: keep trying
      return;
    }
    state.job = job;
    renderJob(job);
    if (job.active) state.pollTimer = setTimeout(pollJob, 700);
    else finishJob(job);
  }

  function setProgress({ label, value, max }, detail = '') {
    el.statusLabel.textContent = label || '';
    el.statusDetail.textContent = detail;
    if (max > 0) {
      el.bar.classList.remove('is-indeterminate');
      el.barFill.style.width = `${Math.round((value / max) * 100)}%`;
    } else {
      el.bar.classList.add('is-indeterminate');
      el.barFill.style.width = '35%';
    }
  }

  function renderJob(job) {
    const p = job.progress || {};
    const bits = [];
    if (p.max > 0) bits.push(`${p.value}/${p.max}`);
    if (job.elapsed != null) bits.push(`${Math.round(job.elapsed)}s`);
    setProgress(p, bits.join(' · '));
    if (job.preview && job.active) {
      el.livePreview.src = job.preview;
      show(el.livePreview, true);
      show(el.viewerEmpty, false);
      show(el.resultImg, false);
      stopVideo();
    }
  }

  function finishJob(job) {
    setBusy(false);
    show(el.livePreview, false);
    if (job.status === 'done') {
      el.status.classList.add('is-done');
      setProgress({ label: 'Done', value: 1, max: 1 }, `${Math.round(job.elapsed || 0)}s · seed ${job.params.seed}`);
      const results = job.results || [];
      if (results.length) {
        showResult(results[0]);
        for (const r of results.slice().reverse()) prependGalleryItem(r);
        toast('Saved to gallery', { msg: results.map((r) => r.file).join('\n'), kind: 'ok' });
        setTimeout(() => el.viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
      if (job.warnings && job.warnings.length) {
        toast('Finished with warnings', { msg: job.warnings.join('\n'), hint: 'Part of the workflow was skipped by ComfyUI; check the template and the installed files.', kind: 'error', timeout: 0 });
      }
      loadHistory();
    } else if (job.status === 'cancelled') {
      setProgress({ label: 'Cancelled', value: 0, max: 1 });
      el.bar.classList.remove('is-indeterminate');
      restoreViewer();
    } else {
      el.status.classList.add('is-error');
      const err = job.error || { message: 'Unknown error' };
      setProgress({ label: 'Failed', value: 0, max: 1 }, '');
      el.bar.classList.remove('is-indeterminate');
      toast('Generation failed', { msg: err.message, hint: err.hint || '', kind: 'error', timeout: 0 });
      restoreViewer();
    }
    state.job = null;
  }

  // After a live preview was shown for a job that did not finish, put the previous result (or the empty state) back.
  function restoreViewer() {
    show(el.livePreview, false);
    if (state.current) {
      showResult(state.current);
    } else {
      stopVideo();
      show(el.resultImg, false);
      show(el.resultMeta, false);
      show(el.viewerEmpty, true);
    }
  }

  async function cancelJob() {
    if (!state.job) return;
    el.cancel.disabled = true;
    try { await api(`/api/jobs/${state.job.id}/cancel`, { method: 'POST' }); } catch (e) { toastError(e, 'Could not cancel'); }
    el.cancel.disabled = false;
  }

  async function resumeActiveJob() {
    try {
      const data = await api('/api/jobs?limit=5');
      const active = (data.jobs || []).find((j) => j.active);
      if (active) startJob(active);
    } catch (e) { /* nothing to resume */ }
  }

  // ---- result viewer ---------------------------------------------------------
  function stopVideo() {
    try { el.resultVideo.pause(); } catch (e) { /* ignore */ }
    el.resultVideo.removeAttribute('src');
    el.resultVideo.load();
    show(el.resultVideo, false);
  }

  function chip(label, value) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.append(`${label} `);
    const b = document.createElement('b');
    b.textContent = value;
    c.appendChild(b);
    return c;
  }

  function showResult(record) {
    state.current = record;
    show(el.viewerEmpty, false);
    show(el.livePreview, false);
    if (record.kind === 'video') {
      show(el.resultImg, false);
      el.resultVideo.src = record.url;
      show(el.resultVideo, true);
      el.resultVideo.muted = true;
      el.resultVideo.play().catch(() => { /* autoplay blocked: user presses play */ });
    } else {
      stopVideo();
      el.resultImg.src = record.url;
      show(el.resultImg, true);
    }
    el.resultPrompt.textContent = record.prompt || record.label || record.file;
    el.resultChips.textContent = '';
    const chips = [];
    if (record.seed != null) chips.push(chip('seed', record.seed));
    if (record.width && record.height) chips.push(chip('size', `${record.width}×${record.height}`));
    if (record.steps) chips.push(chip('steps', record.steps));
    if (record.cfg != null) chips.push(chip('cfg', record.cfg));
    if (record.kind !== 'image' && record.frames) chips.push(chip('frames', `${record.frames} @ ${record.fps || '?'}fps`));
    if (record.model) chips.push(chip('model', basename(record.model)));
    if (record.sampler && record.mode === 'txt2img') chips.push(chip('sampler', `${record.sampler}/${record.scheduler || ''}`));
    if (record.workflow_name) chips.push(chip('workflow', record.workflow_name));
    if (record.style && record.style !== 'none') chips.push(chip('style', record.style));
    if (record.bytes) chips.push(chip('file', fmtBytes(record.bytes)));
    if (record.created) chips.push(chip('', fmtDate(record.created)));
    chips.forEach((c) => el.resultChips.appendChild(c));
    el.btnDownload.href = record.download_url || record.url;
    el.btnDownload.setAttribute('download', record.file);
    el.btnOpen.href = record.url;
    show(el.btnToVideo, record.kind === 'image' && state.options && state.options.workflows.some((w) => w.mode === 'img2vid'));
    show(el.btnCopy, !!record.prompt);
    show(el.resultMeta, true);
    $$('.thumb', el.galleryGrid).forEach((t) => t.classList.toggle('is-active', t.dataset.file === record.file));
  }

  function reuseSettings(record) {
    const wf = state.options && state.options.workflows.find((w) => w.id === record.workflow);
    const mode = record.mode || (wf ? wf.mode : state.mode);
    if (mode !== state.mode) { state.workflowId[mode] = wf ? wf.id : state.workflowId[mode]; setMode(mode); }
    else if (wf && wf.id !== state.workflowId[mode]) { state.workflowId[mode] = wf.id; populateWorkflows(); }
    state.applying = true;
    const setIf = (input, v) => { if (v !== undefined && v !== null && v !== '') input.value = v; };
    setIf(el.prompt, record.prompt); setIf(el.negative, record.negative);
    setIf(el.steps, record.steps); setIf(el.cfg, record.cfg); setIf(el.width, record.width); setIf(el.height, record.height);
    setIf(el.frames, record.frames); setIf(el.fps, record.fps);
    if (record.sampler && Array.from(el.sampler.options).some((o) => o.value === record.sampler)) el.sampler.value = record.sampler;
    if (record.scheduler && Array.from(el.scheduler.options).some((o) => o.value === record.scheduler)) el.scheduler.value = record.scheduler;
    if (record.model && Array.from(el.model.options).some((o) => o.value === record.model)) el.model.value = record.model;
    if (record.style && Array.from(el.style.options).some((o) => o.value === record.style)) el.style.value = record.style;
    if (record.seed != null) { el.seed.value = record.seed; el.seedLock.checked = true; }
    state.applying = false;
    markActiveSize();
    saveValues();
    if (mode === 'img2vid' && record.source_image) {
      api(`/api/gallery/${encodeURIComponent(record.source_image)}/meta`)
        .then((src) => setSourceGallery(src))
        .catch(() => toast('Source image not in the gallery', { msg: 'It was an uploaded file; pick it again.' }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Settings restored', { msg: 'Seed is now fixed; untick “Fixed” for a new random one.', kind: 'ok', timeout: 4000 });
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete ${record.file} from the gallery folder? This removes the file from your disk.`)) return;
    try {
      await api(`/api/gallery/${encodeURIComponent(record.file)}`, { method: 'DELETE' });
    } catch (e) { toastError(e, 'Could not delete'); return; }
    state.gallery.items = state.gallery.items.filter((r) => r.file !== record.file);
    state.gallery.total = Math.max(0, state.gallery.total - 1);
    state.gallery.offset = Math.max(0, state.gallery.offset - 1);  // keep "Load more" aligned with the server
    renderGallery();
    if (state.current && state.current.file === record.file) {
      state.current = null;
      stopVideo();
      show(el.resultImg, false);
      show(el.resultMeta, false);
      show(el.viewerEmpty, true);
    }
    if (state.source.galleryName === record.file) clearSource();
  }

  // ---- gallery -----------------------------------------------------------------
  async function loadGallery({ reset = true } = {}) {
    const g = state.gallery;
    if (!reset && g.loading) return;  // one "Load more" at a time; a reset (filter change, refresh) always wins
    const seq = (g.seq = (g.seq || 0) + 1);
    g.loading = true;
    el.galleryMore.disabled = true;
    const offset = reset ? 0 : g.offset;
    try {
      const q = new URLSearchParams({ limit: g.limit, offset });
      if (g.kind) q.set('kind', g.kind);
      const data = await api(`/api/gallery?${q}`);
      if (seq !== g.seq) return;  // superseded by a newer request
      if (reset) {
        g.items = data.items;
      } else {
        const seen = new Set(g.items.map((r) => r.file));
        g.items = g.items.concat(data.items.filter((r) => !seen.has(r.file)));
      }
      g.total = data.total;
      g.offset = offset + data.items.length;
    } catch (e) {
      if (seq === g.seq) toastError(e, 'Could not load the gallery');
    } finally {
      if (seq === g.seq) { g.loading = false; el.galleryMore.disabled = false; }
    }
    if (seq === g.seq) renderGallery();
  }

  const kindMatches = (kind, record) => !kind || record.kind === kind || (kind === 'video' && record.kind === 'animation');

  function prependGalleryItem(record) {
    const g = state.gallery;
    if (!kindMatches(g.kind, record)) return;
    if (g.items.some((r) => r.file === record.file)) return;
    g.items.unshift(record);
    g.total += 1;
    g.offset += 1;
    renderGallery();
  }

  function thumbNode(record) {
    const card = document.createElement('div');
    card.className = 'thumb' + (state.current && state.current.file === record.file ? ' is-active' : '');
    card.dataset.file = record.file;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.title = record.prompt || record.file;
    if (record.thumb_url) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = record.thumb_url;
      img.addEventListener('error', () => { img.replaceWith(fallbackNode(record)); }, { once: true });
      card.appendChild(img);
    } else if (record.kind === 'video') {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      v.src = `${record.url}#t=0.1`;
      card.appendChild(v);
    } else {
      card.appendChild(fallbackNode(record));
    }
    if (record.kind !== 'image') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = record.kind === 'video' ? '▶ video' : '▶ anim';
      card.appendChild(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    const dl = document.createElement('a');
    dl.href = record.download_url || record.url; dl.setAttribute('download', record.file); dl.title = 'Download'; dl.textContent = '⤓';
    dl.addEventListener('click', (e) => e.stopPropagation());
    actions.appendChild(dl);
    if (record.kind === 'image') {
      const tv = document.createElement('button');
      tv.type = 'button'; tv.title = 'Use as video source'; tv.textContent = '→🎞';
      tv.addEventListener('click', (e) => { e.stopPropagation(); setSourceGallery(record); });
      actions.appendChild(tv);
    }
    const del = document.createElement('button');
    del.type = 'button'; del.title = 'Delete'; del.textContent = '🗑';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteRecord(record); });
    actions.appendChild(del);
    card.appendChild(actions);
    const open = () => { showResult(record); el.viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    return card;
  }

  function fallbackNode(record) {
    const f = document.createElement('div');
    f.className = 'thumb-fallback';
    f.textContent = record.kind === 'video' ? '🎞' : '🖼';
    return f;
  }

  function renderGallery() {
    const g = state.gallery;
    el.galleryGrid.textContent = '';
    for (const r of g.items) el.galleryGrid.appendChild(thumbNode(r));
    show(el.galleryEmpty, g.items.length === 0);
    show(el.galleryMore, g.items.length < g.total);
    el.galleryCount.textContent = g.total ? `${g.total}` : '';
  }

  // ---- prompt history ----------------------------------------------------------
  async function loadHistory() {
    let items = [];
    try { items = (await api('/api/history')).items || []; } catch (e) { return; }
    el.historyList.textContent = '';
    show(el.historyEmpty, items.length === 0);
    for (const h of items) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'history-item';
      const mode = document.createElement('span'); mode.className = 'h-mode'; mode.textContent = h.mode === 'img2vid' ? 'VID' : 'IMG';
      const text = document.createElement('span'); text.className = 'h-text'; text.textContent = h.prompt || `(no prompt) ${h.file || ''}`;
      const meta = document.createElement('span'); meta.className = 'h-meta'; meta.textContent = [h.width && h.height ? `${h.width}×${h.height}` : '', h.seed != null ? `#${h.seed}` : ''].filter(Boolean).join(' ');
      b.append(mode, text, meta);
      b.title = (h.negative ? `Negative: ${h.negative}\n` : '') + `Workflow: ${h.workflow || ''}`;
      b.addEventListener('click', () => applyHistory(h));
      li.appendChild(b);
      el.historyList.appendChild(li);
    }
  }

  function applyHistory(h) {
    const wf = state.options && state.options.workflows.find((w) => w.id === h.workflow);
    const mode = h.mode || (wf ? wf.mode : state.mode);
    if (mode !== state.mode) { if (wf) state.workflowId[mode] = wf.id; setMode(mode); }
    else if (wf && wf.id !== state.workflowId[mode]) { state.workflowId[mode] = wf.id; populateWorkflows(); }
    state.applying = true;
    el.prompt.value = h.prompt || '';
    if (h.negative !== undefined) el.negative.value = h.negative || '';
    if (h.style && Array.from(el.style.options).some((o) => o.value === h.style)) el.style.value = h.style;
    const setIf = (input, v) => { if (v !== undefined && v !== null && v !== '') input.value = v; };
    setIf(el.steps, h.steps); setIf(el.cfg, h.cfg); setIf(el.width, h.width); setIf(el.height, h.height); setIf(el.frames, h.frames); setIf(el.fps, h.fps);
    if (h.sampler && Array.from(el.sampler.options).some((o) => o.value === h.sampler)) el.sampler.value = h.sampler;
    if (h.scheduler && Array.from(el.scheduler.options).some((o) => o.value === h.scheduler)) el.scheduler.value = h.scheduler;
    if (h.model && Array.from(el.model.options).some((o) => o.value === h.model)) el.model.value = h.model;
    state.applying = false;
    markActiveSize();
    saveValues();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    el.prompt.focus();
  }

  // ---- connection status -------------------------------------------------------
  async function pollStatus() {
    let s;
    try { s = await api('/api/status'); } catch (e) { s = { online: false, serverDown: true, error: { message: e.message } }; }
    updateConn(s);
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(pollStatus, s.online ? 6000 : 3000);
  }

  function updateConn(s) {
    const was = state.online;
    state.online = !!s.online;
    el.conn.classList.remove('conn--checking');
    el.conn.classList.toggle('conn--online', state.online);
    el.conn.classList.toggle('conn--offline', !state.online);
    if (s.serverDown) {
      el.connText.textContent = 'Darkroom server unreachable';
      show(el.offline, false);
    } else if (state.online) {
      const bits = ['ComfyUI online'];
      if (s.device && s.device.name) bits.push(String(s.device.name).replace(/^cuda:\d+\s*/i, '').split(':')[0].trim().slice(0, 28));
      const q = s.queue ? (s.queue.running + s.queue.pending) : 0;
      if (q) bits.push(`${q} in queue`);
      el.connText.textContent = bits.join(' · ');
      el.conn.title = `ComfyUI ${s.comfy_version || ''} at ${s.comfy_url}`;
      show(el.offline, false);
    } else {
      el.connText.textContent = 'ComfyUI offline';
      el.conn.title = `No answer from ${s.comfy_url || 'ComfyUI'}`;
      el.offlineDetail.textContent = (s.error && s.error.hint) || `No answer from ${s.comfy_url}.`;
      show(el.offline, true);
    }
    if (s.outputs_dir) el.outputsDir.textContent = s.outputs_dir;
    if (state.online && was === false) loadOptions({ quiet: true });  // back online: refresh the model lists
  }

  // ---- wiring ------------------------------------------------------------------
  el.tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  el.workflow.addEventListener('change', () => { state.workflowId[state.mode] = el.workflow.value; state.prefs.workflow = { ...(state.prefs.workflow || {}), [state.mode]: el.workflow.value }; savePrefs(); applyWorkflow(); });
  el.refreshModels.addEventListener('click', async () => { el.refreshModels.disabled = true; await loadOptions({ fresh: true }); el.refreshModels.disabled = false; toast('Model list refreshed', { kind: 'ok', timeout: 2500 }); });
  el.form.addEventListener('submit', (e) => { e.preventDefault(); generate(); });
  el.form.addEventListener('input', saveValues);
  el.form.addEventListener('change', (e) => { saveValues(); if (e.target === el.width || e.target === el.height) markActiveSize(); });
  el.cancel.addEventListener('click', cancelJob);
  el.seedDice.addEventListener('click', () => { el.seed.value = String(Math.floor(Math.random() * 4294967296)); el.seedLock.checked = true; saveValues(); });
  el.seed.addEventListener('input', () => { el.seedLock.checked = el.seed.value.trim() !== ''; });  // typing a seed means "use this seed"
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !el.generate.disabled) { e.preventDefault(); generate(); } });
  // A file dropped anywhere else would make the browser navigate away from the app: catch it and use it as the source.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) { setSourceFile(f); if (state.mode !== 'img2vid') setMode('img2vid'); }
  });

  el.dropzone.addEventListener('click', () => el.image.click());
  el.dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.image.click(); } });
  el.image.addEventListener('change', () => { if (el.image.files[0]) setSourceFile(el.image.files[0]); });
  ['dragenter', 'dragover'].forEach((ev) => el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.remove('is-over'); }));
  el.dropzone.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setSourceFile(f); });
  document.addEventListener('paste', (e) => {
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    setSourceFile(new File([file], file.name || 'pasted.png', { type: file.type }));
    if (state.mode !== 'img2vid') setMode('img2vid');
  });
  el.clearSource.addEventListener('click', clearSource);

  el.btnToVideo.addEventListener('click', () => state.current && setSourceGallery(state.current));
  el.btnReuse.addEventListener('click', () => state.current && reuseSettings(state.current));
  el.btnCopy.addEventListener('click', async () => {
    if (!state.current) return;
    try { await navigator.clipboard.writeText(state.current.prompt || ''); toast('Prompt copied', { kind: 'ok', timeout: 2000 }); } catch (e) { toast('Clipboard not available', { msg: 'Select the prompt text and copy it manually.' }); }
  });
  el.btnDelete.addEventListener('click', () => state.current && deleteRecord(state.current));

  el.segBtns.forEach((b) => b.addEventListener('click', () => {
    el.segBtns.forEach((x) => x.classList.toggle('is-active', x === b));
    state.gallery.kind = b.dataset.kind;
    state.prefs.galleryKind = b.dataset.kind;
    savePrefs();
    loadGallery();
  }));
  el.galleryRefresh.addEventListener('click', () => loadGallery());
  el.galleryMore.addEventListener('click', () => loadGallery({ reset: false }));
  el.historyClear.addEventListener('click', async () => {
    if (!window.confirm('Clear the prompt history and the prompt text this browser remembers? Gallery files are not touched.')) return;
    try { await api('/api/history', { method: 'DELETE' }); loadHistory(); } catch (e) { toastError(e); }
    state.session = {};
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* fine */ }
    state.applying = true;
    el.prompt.value = '';
    el.negative.value = (currentTemplate() && currentTemplate().defaults.negative) || '';
    el.seed.value = '';
    el.seedLock.checked = false;
    state.applying = false;
  });

  // ---- start -------------------------------------------------------------------
  (async function init() {
    if (state.prefs.galleryKind) {
      state.gallery.kind = state.prefs.galleryKind;
      el.segBtns.forEach((x) => x.classList.toggle('is-active', x.dataset.kind === state.gallery.kind));
    }
    const mode = state.prefs.mode === 'img2vid' ? 'img2vid' : 'txt2img';
    state.mode = mode;
    el.tabs.forEach((tab) => { const on = tab.dataset.mode === mode; tab.classList.toggle('is-active', on); tab.setAttribute('aria-selected', on ? 'true' : 'false'); });
    show(el.fieldSource, mode === 'img2vid');
    await pollStatus();
    await loadOptions({ quiet: true });
    loadGallery();
    loadHistory();
    resumeActiveJob();
  })();
})();
