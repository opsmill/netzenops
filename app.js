// NetZenOps: affirmations for the network automation engineer.
// Quotes come from quotes.md, voice-overs from audio/<slug>.mp3, and the
// background is a generated network topology that re-converges on every quote,
// with the floating words taken from terms.md.

const QUOTES_FILE = "quotes.md";
const TERMS_FILE = "terms.md";
const AUDIO_DIR = "audio";
const AMBIENT_FILE = `${AUDIO_DIR}/ambient.mp3`;
const GAP_AFTER_QUOTE_MS = 2000;
const MIN_SILENT_QUOTE_MS = 6000;
const MS_PER_WORD = 450;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseListItems(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*+]\s+(.+?)\s*$/))
    .filter(Boolean)
    .map((item) => item[1]);
}

function parseQuotes(markdown) {
  const quotes = [];
  for (let text of parseListItems(markdown)) {
    let audio = null;
    const override = text.match(/<!--\s*audio:\s*([^\s>]+?)\s*-->/i);
    if (override) {
      audio = override[1].replace(/\.mp3$/i, "");
      text = text.replace(override[0], "").trim();
    }
    if (!text) continue;
    quotes.push({ text, audio: `${AUDIO_DIR}/${audio ?? slugify(text)}.mp3` });
  }
  return quotes;
}

async function loadQuotes() {
  const response = await fetch(QUOTES_FILE, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${QUOTES_FILE}: ${response.status}`);
  const quotes = parseQuotes(await response.text());
  if (quotes.length === 0) throw new Error(`No list items found in ${QUOTES_FILE}`);
  return quotes;
}

// Background terms are decoration, so a missing or empty terms.md just means
// no floating words rather than an error.
async function loadTerms() {
  try {
    const response = await fetch(TERMS_FILE, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${response.status}`);
    return parseListItems(await response.text());
  } catch (error) {
    console.info(`Could not load ${TERMS_FILE}, background words disabled`, error);
    return [];
  }
}

// Shuffle bag: every quote plays once before any repeats, and the first quote
// of a new round is never the one that just played.
function createShuffleBag(items) {
  let bag = [];
  let last = null;
  return () => {
    if (bag.length === 0) {
      bag = items.map((_, index) => index);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    last = bag.pop();
    return items[last];
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Mute: one switch for every sound source, remembered between visits.
// ---------------------------------------------------------------------------

const MUTE_KEY = "netzenops-muted";
const PAD_VOLUME = 0.06;

const sound = {
  muted: readMutePreference(),
  media: new Set(),
  padGain: null,
};

function readMutePreference() {
  try {
    return localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

function setMuted(muted) {
  sound.muted = muted;
  for (const element of sound.media) element.muted = muted;
  if (sound.padGain) {
    const { gain, context } = sound.padGain;
    gain.cancelScheduledValues(context.currentTime);
    gain.setTargetAtTime(muted ? 0 : PAD_VOLUME, context.currentTime, 0.15);
  }
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // Private windows can refuse storage; muting still works for this visit.
  }
}

function trackMedia(element) {
  element.muted = sound.muted;
  sound.media.add(element);
  return element;
}

function playVoice(src) {
  return new Promise((resolve) => {
    const audio = trackMedia(new Audio(src));
    const finish = (played) => {
      sound.media.delete(audio);
      resolve(played);
    };
    audio.addEventListener("ended", () => finish(true), { once: true });
    audio.addEventListener("error", () => finish(false), { once: true });
    audio.play().catch(() => finish(false));
  });
}

// ---------------------------------------------------------------------------
// Ambient sound: audio/ambient.mp3 if present, otherwise a soft synth pad.
// ---------------------------------------------------------------------------

async function startAmbient() {
  try {
    const head = await fetch(AMBIENT_FILE, { method: "HEAD", cache: "no-cache" });
    if (head.ok) {
      const track = trackMedia(new Audio(AMBIENT_FILE));
      track.loop = true;
      track.volume = 0.5;
      await track.play();
      return;
    }
  } catch (error) {
    console.info("No ambient track, using synth pad", error);
  }
  startSynthPad();
}

function startSynthPad() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();

  const master = context.createGain();
  master.gain.setValueAtTime(0, context.currentTime);
  master.gain.linearRampToValueAtTime(sound.muted ? 0 : PAD_VOLUME, context.currentTime + 6);
  sound.padGain = { gain: master.gain, context };

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  filter.connect(master);
  master.connect(context.destination);

  // A major 9: calm, unresolved, vaguely spa-like.
  const chord = [110, 164.81, 246.94, 277.18, 415.3];
  chord.forEach((frequency, index) => {
    const voice = context.createGain();
    voice.gain.value = 0.18;
    voice.connect(filter);

    const swell = context.createOscillator();
    const swellDepth = context.createGain();
    swell.frequency.value = 0.05 + index * 0.017;
    swellDepth.gain.value = 0.12;
    swell.connect(swellDepth).connect(voice.gain);
    swell.start();

    for (const detune of [-7, 7]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      oscillator.connect(voice);
      oscillator.start();
    }
  });
}

// ---------------------------------------------------------------------------
// Topology background
// ---------------------------------------------------------------------------

function createScene(width, height) {
  const hue = Math.random() * 360;
  const count = Math.round(Math.min(70, Math.max(18, (width * height) / 26000)));
  const nodes = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    phase: Math.random() * Math.PI * 2,
    drift: 6 + Math.random() * 18,
    size: 1.5 + Math.random() * 2.5,
  }));

  // Link each node to its two or three nearest neighbours, deduplicated.
  const seen = new Set();
  const links = [];
  nodes.forEach((node, a) => {
    const nearest = nodes
      .map((other, b) => ({ b, d: (other.x - node.x) ** 2 + (other.y - node.y) ** 2 }))
      .filter(({ b }) => b !== a)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2 + Math.round(Math.random()));
    for (const { b } of nearest) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push([a, b]);
      }
    }
  });

  return { hue, nodes, links, packets: [], born: performance.now() };
}

function nodePosition(node, time) {
  const t = time / 1000;
  return {
    x: node.x + Math.sin(t * 0.21 + node.phase) * node.drift,
    y: node.y + Math.cos(t * 0.17 + node.phase) * node.drift,
  };
}

function drawScene(ctx, scene, time, alpha) {
  const { hue, nodes, links, packets } = scene;
  const positions = nodes.map((node) => nodePosition(node, time));

  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.strokeStyle = `hsla(${hue}, 80%, 70%, 0.18)`;
  ctx.beginPath();
  for (const [a, b] of links) {
    ctx.moveTo(positions[a].x, positions[a].y);
    ctx.lineTo(positions[b].x, positions[b].y);
  }
  ctx.stroke();

  if (!reducedMotion && links.length && Math.random() < 0.25) {
    const [a, b] = links[Math.floor(Math.random() * links.length)];
    const forward = Math.random() < 0.5;
    packets.push({ from: forward ? a : b, to: forward ? b : a, progress: 0, speed: 0.004 + Math.random() * 0.01 });
  }

  for (let i = packets.length - 1; i >= 0; i--) {
    const packet = packets[i];
    packet.progress += packet.speed;
    if (packet.progress >= 1) {
      packets.splice(i, 1);
      continue;
    }
    const from = positions[packet.from];
    const to = positions[packet.to];
    const x = from.x + (to.x - from.x) * packet.progress;
    const y = from.y + (to.y - from.y) * packet.progress;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
    glow.addColorStop(0, `hsla(${(hue + 40) % 360}, 100%, 85%, 0.9)`);
    glow.addColorStop(1, `hsla(${(hue + 40) % 360}, 100%, 60%, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 10, 20, 20);
  }

  for (let i = 0; i < nodes.length; i++) {
    const { x, y } = positions[i];
    const size = nodes[i].size;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
    halo.addColorStop(0, `hsla(${hue}, 90%, 80%, 0.55)`);
    halo.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(x - size * 6, y - size * 6, size * 12, size * 12);
    ctx.fillStyle = `hsla(${hue}, 100%, 92%, 0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function createBackground(canvas) {
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let current = null;
  let previous = null;
  const tokens = [];
  let terms = [];
  const fadeMs = reducedMotion ? 1500 : 5000;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    current = createScene(width, height);
    previous = null;
  }

  function spawnToken() {
    tokens.push({
      text: terms[Math.floor(Math.random() * terms.length)],
      x: Math.random() * width,
      y: height + 20,
      speed: 0.15 + Math.random() * 0.35,
      size: 11 + Math.random() * 6,
    });
  }

  function frame(time) {
    const hue = current.hue;
    const background = ctx.createRadialGradient(
      width / 2, height * 0.45, 0, width / 2, height * 0.45, Math.max(width, height) * 0.8,
    );
    background.addColorStop(0, `hsl(${(hue + 200) % 360}, 45%, 12%)`);
    background.addColorStop(1, "hsl(240, 40%, 3%)");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const fade = Math.min(1, (time - current.born) / fadeMs);
    if (previous && fade >= 1) previous = null;
    if (previous) drawScene(ctx, previous, time, 1 - fade);
    drawScene(ctx, current, time, previous ? fade : 1);

    if (!reducedMotion) {
      if (terms.length && Math.random() < 0.02 && tokens.length < 14) spawnToken();
      for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        token.y -= token.speed;
        if (token.y < -20) {
          tokens.splice(i, 1);
          continue;
        }
        ctx.font = `${token.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = `hsla(${hue}, 60%, 80%, ${0.12 * Math.min(1, token.y / (height * 0.3))})`;
        ctx.fillText(token.text, token.x, token.y);
      }
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setTerms(newTerms) {
      terms = newTerms;
    },
    // Fade to a freshly converged topology in a new colour.
    reconverge() {
      previous = current;
      current = createScene(width, height);
    },
  };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function showQuote(element, quote) {
  element.textContent = quote.text;
  element.classList.remove("leave", "reveal");
  void element.offsetWidth; // restart the CSS animation
  element.classList.add("reveal");

  const played = await playVoice(quote.audio);
  if (!played) {
    console.info(`No audio at ${quote.audio}, showing on a timer`);
    const words = quote.text.split(/\s+/).length;
    await sleep(Math.max(MIN_SILENT_QUOTE_MS, words * MS_PER_WORD));
  }
  await sleep(GAP_AFTER_QUOTE_MS);
  element.classList.remove("reveal");
  element.classList.add("leave");
  await sleep(1200);
}

async function runAffirmations(quotes, background, element) {
  const next = createShuffleBag(quotes);
  for (;;) {
    background.reconverge();
    await showQuote(element, next());
  }
}

async function main() {
  const background = createBackground(document.getElementById("topology"));
  const stage = document.getElementById("stage");
  const enter = document.getElementById("enter");
  const quoteElement = document.getElementById("quote");

  loadTerms().then((terms) => background.setTerms(terms));

  let quotes;
  try {
    quotes = await loadQuotes();
  } catch (error) {
    console.error(error);
    enter.textContent = "NO QUOTES FOUND";
    enter.disabled = true;
    return;
  }

  enter.addEventListener(
    "click",
    () => {
      enter.remove();
      stage.classList.add("playing");
      quoteElement.hidden = false;
      setupMuteButton(document.getElementById("mute"));
      startAmbient();
      runAffirmations(quotes, background, quoteElement);
    },
    { once: true },
  );
}

function setupMuteButton(button) {
  const render = () => {
    button.setAttribute("aria-pressed", String(sound.muted));
    button.setAttribute("aria-label", sound.muted ? "Unmute" : "Mute");
    button.title = sound.muted ? "Unmute (M)" : "Mute (M)";
  };
  const toggle = () => {
    setMuted(!sound.muted);
    render();
  };
  button.addEventListener("click", toggle);
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      toggle();
    }
  });
  render();
  button.hidden = false;
}

main();
