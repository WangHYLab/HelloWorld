(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const elements = {
    globe: $('#globe'),
    walker: $('#walker'),
    walkerJump: $('#walker-jump'),
    speech: $('#speech'),
    speechId: $('#speech-id'),
    counter: $('#counter'),
    mobileCount: $('#mobile-count'),
    counterBlock: $('#counter-block'),
    recentList: $('#recent-list'),
    lastSignal: $('#last-signal'),
    onlineCount: $('#online-count'),
    signalStatus: $('#signal-status'),
    utcClock: $('#utc-clock'),
    hint: $('#hint'),
    shockwaves: $('#shockwaves'),
    toast: $('#toast'),
    toastLabel: $('.toast-label'),
    liveStatus: $('#live-status'),
  };

  const state = {
    visitorId: getVisitorId(),
    total: 0,
    displayed: 0,
    pending: 0,
    greetSerial: 0,
    initialized: false,
    hasGreeted: false,
    countFrame: null,
    jumpTimer: null,
    speechTimer: null,
    toastTimer: null,
    flashTimer: null,
    walkStart: performance.now(),
    walkerX: 0,
    walkerY: 0,
  };

  const countFormatter = new Intl.NumberFormat('en-US', {
    minimumIntegerDigits: 6,
    useGrouping: true,
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function getVisitorId() {
    try {
      const stored = localStorage.getItem('hello-world-visitor-id');
      if (stored) return stored;
      const id =
        window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `v-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      localStorage.setItem('hello-world-visitor-id', id);
      return id;
    } catch {
      return `v-${Math.random().toString(36).slice(2)}`;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pad(value, length = 6) {
    return String(value).padStart(length, '0');
  }

  function formatCount(value) {
    return countFormatter.format(Math.max(0, Math.floor(Number(value) || 0)));
  }

  function formatUtcTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--:--:--';
    return `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(
      date.getUTCSeconds(),
      2
    )} UTC`;
  }

  function updateClock() {
    const now = new Date();
    elements.utcClock.textContent = `${pad(now.getUTCHours(), 2)}:${pad(
      now.getUTCMinutes(),
      2
    )}:${pad(now.getUTCSeconds(), 2)}`;
  }

  function renderCount(value) {
    const text = formatCount(value);
    elements.counter.textContent = text;
    elements.mobileCount.textContent = text;

    const digits = text.length;
    elements.counter.dataset.size =
      digits >= 12 ? 'xxl' : digits >= 10 ? 'xl' : digits >= 9 ? 'lg' : 'md';
  }

  function announceCount(value) {
    elements.liveStatus.textContent = `全球累计问候 ${formatCount(value)} 次`;
  }

  function animateCount(target) {
    target = Math.max(0, Math.floor(Number(target) || 0));
    if (state.countFrame) {
      cancelAnimationFrame(state.countFrame);
      state.countFrame = null;
    }

    const from = state.displayed;
    if (target <= from) {
      state.displayed = target;
      renderCount(target);
      return;
    }

    const startedAt = performance.now();
    const duration = clamp(260 + Math.sqrt(target - from) * 90, 340, 1000);

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(from + (target - from) * eased);
      state.displayed = current;
      renderCount(current);

      if (progress < 1) {
        state.countFrame = requestAnimationFrame(step);
      } else {
        state.displayed = target;
        state.countFrame = null;
        renderCount(target);
        announceCount(target);
      }
    };

    state.countFrame = requestAnimationFrame(step);
  }

  function flashCounter() {
    elements.counterBlock.classList.remove('is-flashing');
    void elements.counterBlock.offsetWidth;
    elements.counterBlock.classList.add('is-flashing');
    clearTimeout(state.flashTimer);
    state.flashTimer = setTimeout(() => {
      elements.counterBlock.classList.remove('is-flashing');
    }, 420);
  }

  function renderRecent(items) {
    if (!Array.isArray(items)) return;

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'recent-empty';
      empty.textContent = '— NO SIGNAL YET —';
      elements.recentList.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    items.slice(0, 7).forEach((item, index) => {
      const li = document.createElement('li');
      li.style.animationDelay = `${Math.min(index * 35, 180)}ms`;

      const id = document.createElement('span');
      id.className = 'recent-id';
      id.textContent = `#${pad(item.id)}`;

      const time = document.createElement('span');
      time.className = 'recent-time';
      time.textContent = formatUtcTime(item.created_at).replace(' UTC', 'Z');

      li.append(id, time);
      fragment.append(li);
    });

    elements.recentList.replaceChildren(fragment);
  }

  function updateLastSignal(items) {
    if (!Array.isArray(items) || items.length === 0) {
      elements.lastSignal.textContent = 'AWAITING FIRST SIGNAL';
      return;
    }
    elements.lastSignal.textContent = `LAST SIGNAL ${formatUtcTime(items[0].created_at)}`;
  }

  function updateOnline(value) {
    const online = Math.max(0, Math.floor(Number(value) || 0));
    elements.onlineCount.textContent = pad(online, 2);
  }

  function setSignal(live) {
    elements.signalStatus.classList.toggle('is-offline', !live);
    elements.signalStatus.innerHTML = `<i></i>${live ? 'LIVE' : 'LINK LOST'}`;
  }

  function showToast(label, message) {
    elements.toastLabel.textContent = label;
    elements.toast.lastElementChild.textContent = message;
    elements.toast.classList.remove('is-visible');
    void elements.toast.offsetWidth;
    elements.toast.classList.add('is-visible');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      elements.toast.classList.remove('is-visible');
    }, 2600);
  }

  function setSpeechId(id) {
    const numeric = Math.max(0, Number(id) || 0);
    elements.speechId.textContent = `TX/${pad(numeric)}`;
  }

  function showSpeech() {
    elements.speech.classList.remove('is-visible');
    void elements.speech.offsetWidth;
    elements.speech.classList.add('is-visible');

    clearTimeout(state.speechTimer);
    state.speechTimer = setTimeout(() => {
      elements.speech.classList.remove('is-visible');
    }, 1650);
  }

  function triggerJump() {
    elements.walkerJump.classList.remove('is-jumping');
    void elements.walkerJump.offsetWidth;
    elements.walkerJump.classList.add('is-jumping');

    clearTimeout(state.jumpTimer);
    state.jumpTimer = setTimeout(() => {
      elements.walkerJump.classList.remove('is-jumping');
    }, 720);
  }

  function spawnShockwaves(x, y) {
    for (let index = 0; index < 2; index += 1) {
      const wave = document.createElement('span');
      wave.className = `shockwave${index === 1 ? ' is-second' : ''}`;
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
      elements.shockwaves.append(wave);
    }
  }

  function markHintUsed() {
    if (state.hasGreeted) return;
    state.hasGreeted = true;
    elements.hint.classList.add('is-used');
  }

  function applyPayload(payload, source) {
    if (!payload || typeof payload !== 'object') return;

    const previousTotal = state.total;
    const total = Number(payload.total);

    if (Number.isFinite(total)) {
      if (total > state.total) {
        state.total = total;
        animateCount(total);
        flashCounter();
      } else if (!state.initialized) {
        state.total = total;
        state.displayed = total;
        renderCount(total);
      }
    }

    if (Array.isArray(payload.recent)) {
      renderRecent(payload.recent);
      updateLastSignal(payload.recent);
    }

    if (typeof payload.online === 'number') {
      updateOnline(payload.online);
    }

    const isIncoming =
      source === 'stream-greeting' &&
      Number.isFinite(total) &&
      total > previousTotal &&
      payload.visitorId &&
      payload.visitorId !== state.visitorId;

    if (isIncoming) {
      showToast('INCOMING', '另一个存在向地球说了「你好世界」');
    }

    state.initialized = true;
  }

  async function fetchStats() {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      applyPayload(await response.json(), 'initial');
    } catch (error) {
      console.error('[hello/world] stats unavailable', error);
    }
  }

  async function sendGreeting(source, clientX, clientY) {
    const globeRect = elements.globe.getBoundingClientRect();
    const x = Number.isFinite(clientX)
      ? clientX
      : globeRect.left + globeRect.width / 2;
    const y = Number.isFinite(clientY)
      ? clientY
      : globeRect.top + globeRect.height * 0.68;

    triggerJump();
    showSpeech();
    spawnShockwaves(x, y);
    markHintUsed();
    elements.liveStatus.textContent = '你好世界！问候已发送。';

    state.pending += 1;
    const serial = ++state.greetSerial;
    setSpeechId(state.total + state.pending);

    try {
      const response = await fetch('/api/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: source,
          visitorId: state.visitorId,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      state.pending = Math.max(0, state.pending - 1);

      if (serial === state.greetSerial && payload.lastId) {
        setSpeechId(payload.lastId);
      }

      applyPayload(payload, 'response');
      setSignal(true);
    } catch (error) {
      state.pending = Math.max(0, state.pending - 1);
      setSignal(false);
      showToast('OFFLINE', '信号未送达 — 请确认服务端已启动');
      console.error('[hello/world] greeting failed', error);
    }
  }

  function connectStream() {
    if (!('EventSource' in window)) {
      setSignal(true);
      setInterval(fetchStats, 5000);
      return;
    }

    const stream = new EventSource('/api/stream');

    stream.addEventListener('open', () => setSignal(true));

    stream.addEventListener('error', () => {
      setSignal(false);
    });

    stream.addEventListener('stats', (event) => {
      try {
        applyPayload(JSON.parse(event.data), 'stream-stats');
        setSignal(true);
      } catch (error) {
        console.error('[hello/world] invalid stream stats', error);
      }
    });

    stream.addEventListener('greeting', (event) => {
      try {
        applyPayload(JSON.parse(event.data), 'stream-greeting');
        setSignal(true);
      } catch (error) {
        console.error('[hello/world] invalid stream greeting', error);
      }
    });

    stream.addEventListener('presence', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof payload.online === 'number') updateOnline(payload.online);
      } catch (error) {
        console.error('[hello/world] invalid presence event', error);
      }
    });

    window.addEventListener('beforeunload', () => stream.close(), { once: true });
  }

  function positionWalker(now) {
    const size = elements.globe.clientWidth;
    if (!size) return;

    const center = size / 2;
    const radius = size * (175 / 640);
    const elapsed = (now - state.walkStart) / 1000;
    const swing = reducedMotion.matches ? 0 : Math.sin(elapsed * 0.55) * 0.34;
    const theta = Math.PI / 2 + swing;
    const x = center + Math.cos(theta) * radius;
    const y = center + Math.sin(theta) * radius;
    const tilt = -swing * 10.5;

    elements.walker.style.transform = `translate3d(${x.toFixed(
      2
    )}px, ${y.toFixed(2)}px, 0) translate(-50%, -100%) rotate(${tilt.toFixed(
      2
    )}deg)`;

    if (!elements.walker.classList.contains('is-positioned')) {
      elements.walker.classList.add('is-positioned');
    }

    const characterHeight = elements.walker.offsetHeight || 98;
    const bubbleWidth = elements.speech.offsetWidth || 240;
    const bubbleX = clamp(x, bubbleWidth / 2 + 8, size - bubbleWidth / 2 - 8);
    const bubbleTop = y - characterHeight - 14;
    const tailX = clamp(50 + ((x - bubbleX) / bubbleWidth) * 100, 12, 88);

    elements.speech.style.left = `${bubbleX.toFixed(2)}px`;
    elements.speech.style.top = `${bubbleTop.toFixed(2)}px`;
    elements.speech.style.setProperty('--tail-x', `${tailX.toFixed(1)}%`);

    state.walkerX = x;
    state.walkerY = y;
  }

  function walkFrame(now) {
    positionWalker(now);
    requestAnimationFrame(walkFrame);
  }

  function handleClick(event) {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('a, button, input, textarea, select, label')
    ) {
      return;
    }
    sendGreeting('click', event.clientX, event.clientY);
  }

  function handleKeydown(event) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('a, input, textarea, select, [contenteditable="true"]')
    ) {
      return;
    }

    const isCharacter = event.key.length === 1;
    const isEnter = event.key === 'Enter';
    if (!isCharacter && !isEnter) return;

    if (event.key === ' ') event.preventDefault();
    sendGreeting('key');
  }

  renderCount(0);
  updateClock();
  setInterval(updateClock, 1000);

  if (window.matchMedia('(pointer: coarse)').matches) {
    const firstHint = elements.hint.querySelector('.hint-box');
    if (firstHint) firstHint.textContent = 'TAP';
  }

  positionWalker(performance.now());
  requestAnimationFrame(walkFrame);

  document.addEventListener('click', handleClick);
  window.addEventListener('keydown', handleKeydown);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchStats();
  });

  fetchStats();
  connectStream();
})();
