// NetZenOps: affirmations for the network automation engineer.
// Quotes come from quotes.md, voice-overs from audio/<slug>.mp3, and the
// background is a generated network topology that re-converges on every quote,
// with the floating words taken from terms.md and the background sound menu
// from ambience.md.

const QUOTES_FILE = "quotes.md";
const TERMS_FILE = "terms.md";
const AUDIO_DIR = "audio";
const AMBIENCE_FILE = "ambience.md";
const AMBIENCE_DIR = `${AUDIO_DIR}/ambience`;
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

// An optional <!-- audio: name --> comment picks the filename instead of the slug.
function extractAudioOverride(item) {
  const override = item.match(/<!--\s*audio:\s*([^\s>]+?)\s*-->/i);
  if (!override) return { text: item, stem: null };
  return {
    text: item.replace(override[0], "").trim(),
    stem: override[1].replace(/\.mp3$/i, ""),
  };
}

function parseQuotes(markdown) {
  const quotes = [];
  for (const item of parseListItems(markdown)) {
    const { text, stem } = extractAudioOverride(item);
    if (!text) continue;
    quotes.push({ text, audio: `${AUDIO_DIR}/${stem ?? slugify(text)}.mp3` });
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
// Sound: one reused element for the voice-overs, and every ambience (looped
// recordings and the synth pad) mixed through a single Web Audio bus.
// ---------------------------------------------------------------------------

const MUTE_KEY = "netzenops-muted";
const AMBIENCE_KEY = "netzenops-ambience";
const PAD_VOLUME = 0.06;
const AMBIENCE_FADE_S = 1.5;

const sound = {
  muted: readPreference(MUTE_KEY) === "true",
  voice: null,
  context: null,
  bus: null,
  ambience: null,
  buffers: new Map(),
  switchToken: 0,
};

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the setting still applies this visit.
  }
}

function setMuted(muted) {
  sound.muted = muted;
  if (sound.voice) sound.voice.muted = muted;
  if (sound.bus) sound.bus.gain.setTargetAtTime(muted ? 0 : 1, sound.context.currentTime, 0.15);
  writePreference(MUTE_KEY, String(muted));
}

// Mobile browsers, iOS Safari above all, only let a media element or an
// AudioContext make sound if it was first started inside a user gesture, and
// that permission belongs to the element, not the page. So the voice element
// and the audio context are created once, in the click handler, and reused.
// A fresh new Audio() per quote plays once on a phone, then silently fails.
// Ambience goes through Web Audio, which also loops without the gap an MP3 in
// an <audio> element leaves at the loop point.
function unlockAudio() {
  sound.voice = new Audio();
  sound.voice.preload = "auto";
  sound.voice.muted = sound.muted;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  sound.context = new AudioContextClass();
  sound.context.resume();
  sound.bus = sound.context.createGain();
  sound.bus.gain.value = sound.muted ? 0 : 1;
  sound.bus.connect(sound.context.destination);
  // iOS suspends the context when the page is backgrounded.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && sound.context.state !== "running") sound.context.resume();
  });
}

// Must be called synchronously from the click handler for the first quote, so
// the shared voice element's first play() happens inside the gesture.
function playVoice(src) {
  return new Promise((resolve) => {
    const audio = sound.voice;
    const finish = (played) => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      resolve(played);
    };
    const onEnded = () => finish(true);
    const onError = () => finish(false);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.src = src;
    audio.play().catch(() => finish(false));
  });
}

// ---------------------------------------------------------------------------
// Ambience: the menu comes from ambience.md, files from audio/ambience/.
// ---------------------------------------------------------------------------

const BUILT_INS = new Set(["synth", "off"]);

// Options live under the "## Ambiences" heading as `- Name: tagline`, with
// indented `- prompt:`, `- audio:` and `- builtin:` settings underneath.
function parseAmbiences(markdown) {
  const ambiences = [];
  let inSection = false;
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) {
      inSection = /^##\s+Ambiences\s*$/i.test(line);
      current = null;
      continue;
    }
    if (!inSection) continue;
    const option = line.match(/^[-*+]\s+([^:]+?)\s*(?::\s*(.*?))?\s*$/);
    const setting = line.match(/^\s+[-*+]\s+(prompt|audio|builtin):\s*(.+?)\s*$/i);
    if (option) {
      current = { name: option[1], tagline: option[2] ?? "", settings: {} };
      ambiences.push(current);
    } else if (setting && current) {
      current.settings[setting[1].toLowerCase()] = setting[2];
    }
  }
  return ambiences.flatMap(({ name, tagline, settings }) => {
    const builtIn = settings.builtin?.toLowerCase() ?? null;
    if (builtIn && !BUILT_INS.has(builtIn)) {
      console.warn(`Unknown builtin "${builtIn}" for ${name} in ${AMBIENCE_FILE}`);
      return [];
    }
    const id = settings.audio?.replace(/\.mp3$/i, "") ?? slugify(name);
    return [{ id, name, tagline, builtIn, src: builtIn ? null : `${AMBIENCE_DIR}/${id}.mp3` }];
  });
}

const FALLBACK_AMBIENCES = [
  { id: "synth-pad", name: "Synth pad", tagline: "", builtIn: "synth", src: null },
  { id: "off", name: "Off", tagline: "", builtIn: "off", src: null },
];

// Options whose file has not been generated yet are left out of the menu.
async function loadAmbiences() {
  let listed = [];
  try {
    const response = await fetch(AMBIENCE_FILE, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${response.status}`);
    listed = parseAmbiences(await response.text());
  } catch (error) {
    console.info(`Could not load ${AMBIENCE_FILE}, offering built-in ambience only`, error);
  }
  const checks = await Promise.all(
    listed.map((ambience) =>
      ambience.builtIn
        ? true
        : fetch(ambience.src, { method: "HEAD", cache: "no-cache" })
            .then((response) => response.ok)
            .catch(() => false),
    ),
  );
  const missing = listed.filter((_, index) => !checks[index]).map((ambience) => ambience.src);
  if (missing.length) console.info("Ambience files not found, hidden from the menu:", missing);
  const available = listed.filter((_, index) => checks[index]);
  return available.length ? available : FALLBACK_AMBIENCES;
}

function fadeIn(gainNode, target) {
  const now = sound.context.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(target, now + AMBIENCE_FADE_S);
}

function fadeOutAndStop(gainNode, sources) {
  const now = sound.context.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(0, now + AMBIENCE_FADE_S);
  for (const source of sources) source.stop(now + AMBIENCE_FADE_S + 0.05);
  setTimeout(() => gainNode.disconnect(), (AMBIENCE_FADE_S + 0.2) * 1000);
}

// Generated loops vary wildly in level (a data hall roars, a NOC at night
// barely registers) and not every one wraps cleanly. So each loop is prepared
// once after decoding: its last LOOP_BLEND_S seconds are blended into its
// start, which makes the wrap point continuous whatever the file does, and its
// level is matched to a common target with caps so a near-silent clip's hiss
// is not blown up and nothing clips.
const LOOP_BLEND_S = 1.5;
const AMBIENCE_TARGET_RMS = 0.05; // about -26 dBFS, well under the voice-overs
const AMBIENCE_PEAK_CEILING = 0.5;
const AMBIENCE_MAX_GAIN = 40; // +32 dB

function prepareLoop(decoded) {
  const blend = Math.min(Math.floor(LOOP_BLEND_S * decoded.sampleRate), Math.floor(decoded.length / 3));
  const length = decoded.length - blend;
  const channels = decoded.numberOfChannels;
  const loop = sound.context.createBuffer(channels, length, decoded.sampleRate);
  let sumSquares = 0;
  let peak = 0;
  for (let channel = 0; channel < channels; channel++) {
    const input = decoded.getChannelData(channel);
    const output = loop.getChannelData(channel);
    output.set(input.subarray(0, length));
    for (let i = 0; i < blend; i++) {
      const angle = (i / blend) * (Math.PI / 2);
      output[i] = input[i] * Math.sin(angle) + input[length + i] * Math.cos(angle);
    }
    for (let i = 0; i < length; i++) {
      sumSquares += output[i] * output[i];
      peak = Math.max(peak, Math.abs(output[i]));
    }
  }
  const rms = Math.sqrt(sumSquares / (length * channels));
  const gain = Math.min(
    AMBIENCE_TARGET_RMS / Math.max(rms, 1e-6),
    AMBIENCE_PEAK_CEILING / Math.max(peak, 1e-6),
    AMBIENCE_MAX_GAIN,
  );
  return { buffer: loop, gain };
}

function loadLoop(src) {
  if (!sound.buffers.has(src)) {
    const pending = fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${src}: ${response.status}`);
        return response.arrayBuffer();
      })
      // Callback form, because older Safari has no promise-returning version.
      .then((data) => new Promise((resolve, reject) => sound.context.decodeAudioData(data, resolve, reject)))
      .then(prepareLoop);
    pending.catch(() => sound.buffers.delete(src));
    sound.buffers.set(src, pending);
  }
  return sound.buffers.get(src);
}

function startLoop({ buffer, gain }) {
  const output = sound.context.createGain();
  fadeIn(output, gain);
  output.connect(sound.bus);
  const source = sound.context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(output);
  source.start();
  return { stop: () => fadeOutAndStop(output, [source]) };
}

async function setAmbience(choice) {
  const token = ++sound.switchToken;
  sound.ambience?.stop();
  sound.ambience = null;
  if (!sound.context || choice.builtIn === "off") return;
  if (choice.builtIn === "synth") {
    sound.ambience = startSynthPad();
    return;
  }
  try {
    const loop = await loadLoop(choice.src);
    // Ignore a slow download if the listener has already picked something else.
    if (token === sound.switchToken) sound.ambience = startLoop(loop);
  } catch (error) {
    console.warn(`Could not play ${choice.src}, using the synth pad instead`, error);
    if (token === sound.switchToken) sound.ambience = startSynthPad();
  }
}

function startSynthPad() {
  const context = sound.context;
  const output = context.createGain();
  fadeIn(output, PAD_VOLUME);
  output.connect(sound.bus);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  filter.connect(output);

  // A major 9: calm, unresolved, vaguely spa-like.
  const sources = [];
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
    sources.push(swell);

    for (const detune of [-7, 7]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      oscillator.connect(voice);
      oscillator.start();
      sources.push(oscillator);
    }
  });
  return { stop: () => fadeOutAndStop(output, sources) };
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
  const ambiences = loadAmbiences();

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
      // Everything audible starts synchronously inside this click; see unlockAudio().
      unlockAudio();
      setupMuteButton(document.getElementById("mute"));
      ambiences.then((list) => setupAmbienceMenu(document.getElementById("ambience"), list));
      document.getElementById("controls").hidden = false;
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
    const typing = event.target instanceof Element && event.target.closest(".ambience-menu");
    const modified = event.metaKey || event.ctrlKey || event.altKey;
    if (event.key.toLowerCase() === "m" && !typing && !modified) toggle();
  });
  render();
}

// A listbox popup rather than a <select>, so each option can show its tagline.
function setupAmbienceMenu(root, ambiences) {
  const button = root.querySelector(".ambience-button");
  const current = root.querySelector(".ambience-current");
  const menu = root.querySelector(".ambience-menu");
  const list = root.querySelector('[role="listbox"]');
  const savedIndex = ambiences.findIndex((ambience) => ambience.id === readPreference(AMBIENCE_KEY));
  let selected = Math.max(0, savedIndex);
  let active = selected;

  const options = ambiences.map((ambience, index) => {
    const option = document.createElement("li");
    option.id = `ambience-option-${ambience.id}`;
    option.setAttribute("role", "option");
    const name = document.createElement("span");
    name.className = "ambience-name";
    name.textContent = ambience.name;
    option.append(name);
    if (ambience.tagline) {
      const tagline = document.createElement("span");
      tagline.className = "ambience-tagline";
      tagline.textContent = ambience.tagline;
      option.append(tagline);
    }
    option.addEventListener("click", () => {
      choose(index);
      writePreference(AMBIENCE_KEY, ambience.id);
      close(true);
    });
    option.addEventListener("pointermove", () => setActive(index));
    return option;
  });
  list.replaceChildren(...options);

  function setActive(index) {
    active = (index + options.length) % options.length;
    options.forEach((option, i) => option.classList.toggle("active", i === active));
    list.setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }

  function choose(index) {
    selected = index;
    options.forEach((option, i) => option.setAttribute("aria-selected", String(i === selected)));
    const ambience = ambiences[selected];
    current.textContent = ambience.name;
    button.title = ambience.tagline || ambience.name;
    setAmbience(ambience);
  }

  function onOutsidePointer(event) {
    if (!root.contains(event.target)) close(false);
  }

  function open() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    setActive(selected);
    list.focus();
    document.addEventListener("pointerdown", onOutsidePointer);
  }

  function close(refocus) {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutsidePointer);
    if (refocus) button.focus();
  }

  button.addEventListener("click", () => (menu.hidden ? open() : close(true)));
  list.addEventListener("keydown", (event) => {
    const moves = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
    if (event.key in moves) {
      setActive(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      choose(active);
      writePreference(AMBIENCE_KEY, ambiences[active].id);
      close(true);
    } else if (event.key === "Escape") {
      close(true);
    } else if (event.key === "Tab") {
      close(false);
      return;
    } else {
      return;
    }
    event.preventDefault();
  });
  choose(selected);
  button.disabled = false;
}

main();
