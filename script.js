/* TinyBot AI — production interaction layer (vanilla JavaScript)
   Replace only these two URLs after exporting your own Teachable Machine image model. */
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/JJOC-3YBW/model.json";
const METADATA_URL = "https://teachablemachine.withgoogle.com/models/JJOC-3YBW/metadata.json";

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const MOVES = {
    rock: { label: "ROCK", icon: "✊", serial: "R" },
    paper: { label: "PAPER", icon: "✋", serial: "P" },
    scissors: { label: "SCISSORS", icon: "✌️", serial: "S" },
  };
  const dialogue = {
    idle: ["Awaiting challenger...", "My neural circuits are ready.", "Show me what humans can do."],
    thinking: ["Interesting...", "Predicting your strategy...", "Calculating all outcomes...", "Reading your pattern..."],
    win: ["I calculated that.", "Nice try.", "Victory is inevitable.", "Your strategy needs an update."],
    lose: ["You surprised me.", "Impossible...", "You got lucky.", "Recalibrating my assumptions..."],
    draw: ["A perfect equilibrium.", "We think alike.", "A statistical deadlock."],
    boss: ["Boss protocol engaged.", "No more mercy, human.", "Maximum cognition activated."],
  };
  const state = {
    model: null,
    stream: null,
    predicting: false,
    playing: false,
    muted: true,
    port: null,
    writer: null,
    latest: { move: null, confidence: 0 },
    confidenceTotal: 0,
    stats: { player: 0, robot: 0, draws: 0, streak: 0, games: 0 },
    boss: false,
    audio: null,
  };

  function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function normalizeClass(name) {
    const value = String(name).toLowerCase().trim();
    if (value.includes("rock")) return "rock";
    if (value.includes("paper")) return "paper";
    if (value.includes("scissor")) return "scissors";
    return null;
  }
  function say(group) { $("speech").innerHTML = `<i></i>${randomItem(dialogue[group])}`; }
  function setRobotMode(mode = "") {
    $("robotPanel").classList.remove("thinking", "win-mode", "lose-mode", "boss-mode");
    if (state.boss) $("robotPanel").classList.add("boss-mode");
    if (mode) $("robotPanel").classList.add(mode);
  }
  function toast(message) {
    const node = $("toast"); node.textContent = message; node.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function loadStats() {
    try {
      const saved = JSON.parse(localStorage.getItem("tinybot-stats") || "null");
      if (saved && ["player", "robot", "draws", "streak", "games"].every((key) => Number.isFinite(saved[key]))) state.stats = saved;
      state.confidenceTotal = Number(localStorage.getItem("tinybot-confidence")) || 0;
    } catch { /* Corrupt local data should never stop the exhibition. */ }
    renderStats();
  }
  function saveStats() {
    localStorage.setItem("tinybot-stats", JSON.stringify(state.stats));
    localStorage.setItem("tinybot-confidence", String(state.confidenceTotal));
  }
  function renderStats() {
    const s = state.stats;
    $("playerScore").textContent = s.player; $("robotScore").textContent = s.robot;
    $("winsStat").textContent = s.player; $("lossesStat").textContent = s.robot; $("drawsStat").textContent = s.draws;
    $("streakStat").textContent = s.streak; $("gamesStat").textContent = s.games;
    $("playerRate").textContent = s.games ? `${Math.round(s.player / s.games * 100)}%` : "0%";
    $("robotRate").textContent = s.games ? `${Math.round(s.robot / s.games * 100)}%` : "0%";
    $("averageConfidence").textContent = s.games ? `${Math.round(state.confidenceTotal / s.games)}%` : "0%";
  }

  async function loadModel() {
    $("modelStatus").textContent = "LOADING 0%"; $("stageStatus").textContent = "LOADING NEURAL ENGINE · 0%";
    try {
      if (!window.tmImage) throw new Error("Teachable Machine library did not load");
      await sleep(220); $("modelStatus").textContent = "LOADING 35%"; $("stageStatus").textContent = "LOADING NEURAL ENGINE · 35%";
      state.model = await window.tmImage.load(MODEL_URL, METADATA_URL);
      $("modelStatus").textContent = "READY"; $("modelStatus").style.color = "var(--green)";
      $("stageStatus").textContent = "NEURAL ENGINE READY";
      toast("AI model online");
    } catch (error) {
      console.error("TinyBot model load failed:", error);
      $("modelStatus").textContent = "MODEL OFFLINE"; $("modelStatus").style.color = "var(--red)";
      $("stageStatus").textContent = "MODEL OFFLINE · CHECK WI-FI";
      toast("AI model could not load — check Wi‑Fi");
    }
  }

  async function listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const select = $("cameraSelect");
    select.innerHTML = '<option value="">Default camera</option>' + devices.map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`).join("");
  }
  async function startCamera(deviceId = "") {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      const video = $("webcam"); video.srcObject = state.stream; await video.play();
      $("cameraEmpty").classList.add("hidden");
      $("cameraButton").textContent = "◉ CAMERA ACTIVE";
      $("resolutionLabel").textContent = `${video.videoWidth || 1280} × ${video.videoHeight || 720}`;
      $("stageStatus").textContent = state.model ? "SYSTEM READY · MAKE YOUR MOVE" : "CAMERA READY · AI LOADING";
      await listCameras();
      if (!state.predicting) { state.predicting = true; requestAnimationFrame(predictionLoop); }
      playSound("click"); toast("Camera connected");
    } catch (error) {
      console.error("Camera error:", error); toast(error.name === "NotAllowedError" ? "Camera permission was denied" : "Could not start the camera");
      $("stageStatus").textContent = "CAMERA ACCESS REQUIRED";
    }
  }
  async function predictionLoop() {
    if (!state.predicting) return;
    const video = $("webcam");
    if (state.model && video.readyState >= 2) {
      try {
        const results = await state.model.predict(video, false);
        const top = results.slice().sort((a, b) => b.probability - a.probability)[0];
        const move = top ? normalizeClass(top.className) : null;
        state.latest = { move, confidence: top ? top.probability : 0 };
        if (!state.playing && move) renderPrediction(move, top.probability);
        if (!state.playing && !move) {
          $("predictionText").textContent = "BACKGROUND";
          $("playerMoveIcon").textContent = "—";
          $("confidenceValue").textContent = `${Math.round((top?.probability || 0) * 100)}%`;
          $("confidenceBar").style.width = "0%";
        }
      } catch (error) { console.warn("Prediction frame skipped:", error); }
    }
    requestAnimationFrame(predictionLoop);
  }
  function renderPrediction(move, confidence) {
    const item = MOVES[move]; if (!item) return;
    const percent = Math.round(confidence * 100);
    $("predictionText").textContent = item.label; $("playerMoveIcon").textContent = item.icon;
    $("confidenceValue").textContent = `${percent}%`; $("confidenceBar").style.width = `${percent}%`;
  }

  function ensureAudio() { if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)(); return state.audio; }
  function tone(frequency, duration, type = "sine", volume = .045, delay = 0) {
    if (state.muted) return;
    const audio = ensureAudio(), oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = volume;
    oscillator.connect(gain); gain.connect(audio.destination); const start = audio.currentTime + delay;
    gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.start(start); oscillator.stop(start + duration);
  }
  function playSound(kind) {
    if (kind === "click") tone(520, .07, "sine", .03);
    if (kind === "beep") tone(720, .12, "square", .028);
    if (kind === "go") tone(980, .24, "sine", .05);
    if (kind === "think") { tone(170, .55, "sawtooth", .02); tone(240, .55, "sine", .025, .1); }
    if (kind === "win") [523,659,784,1047].forEach((n,i) => tone(n,.35,"sine",.045,i*.1));
    if (kind === "lose") [330,277,220].forEach((n,i) => tone(n,.42,"sawtooth",.03,i*.12));
  }

  async function showCountdown() {
    const node = $("countdown");
    for (const value of ["3", "2", "1", "SHOW YOUR MOVE!"]) {
      node.textContent = value; node.className = `countdown show${value.length > 2 ? " word" : ""}`;
      playSound(value.length > 2 ? "go" : "beep"); await sleep(value.length > 2 ? 900 : 760); node.className = "countdown"; await sleep(70);
    }
  }
  function outcome(player, robot) {
    if (player === robot) return "draw";
    return (player === "rock" && robot === "scissors") || (player === "paper" && robot === "rock") || (player === "scissors" && robot === "paper") ? "player" : "robot";
  }
  async function sendSerial(move) {
    if (!state.writer) return;
    try {
      const suffix = $("newlineSetting").checked ? "\n" : "";
      await state.writer.write(new TextEncoder().encode(MOVES[move].serial + suffix));
    } catch (error) { console.error("Serial write failed:", error); toast("Arduino connection was interrupted"); await disconnectSerial(); }
  }
  async function playRound() {
    if (state.playing) return;
    if (!state.stream) { toast("Enable the camera first"); await startCamera(); return; }
    if (!state.model) { toast("The AI model is still offline"); loadModel(); return; }
    state.playing = true; $("startButton").disabled = true; $("stageStatus").textContent = "BATTLE IN PROGRESS"; setRobotMode();
    await showCountdown();
    const player = state.latest.move, confidence = state.latest.confidence;
    if (!player || confidence < .35) {
      $("resultFlash").textContent = "HAND NOT CLEAR · TRY AGAIN"; $("resultFlash").classList.add("show");
      toast("Keep your hand inside the frame"); await sleep(2050); $("resultFlash").classList.remove("show"); finishRound(); return;
    }
    renderPrediction(player, confidence);
    setRobotMode("thinking"); say(state.boss ? "boss" : "thinking"); $("stageStatus").textContent = "TINYBOT IS ANALYZING";
    $("robotMoveIcon").textContent = "◌"; $("robotMoveText").textContent = "ANALYZING"; playSound("think");
    await sleep(2000);
    const robot = randomItem(Object.keys(MOVES));
    $("robotMoveIcon").textContent = MOVES[robot].icon; $("robotMoveText").textContent = MOVES[robot].label;
    await sendSerial(robot);
    const result = outcome(player, robot), s = state.stats; s.games += 1; state.confidenceTotal += Math.round(confidence * 100);
    const flash = $("resultFlash");
    if (result === "player") {
      s.player += 1; s.streak += 1; setRobotMode("win-mode"); say("lose"); flash.textContent = "YOU WIN"; flash.style.color = "var(--green)"; playSound("win"); makeConfetti();
    } else if (result === "robot") {
      s.robot += 1; s.streak = 0; setRobotMode("lose-mode"); say("win"); flash.textContent = "TINYBOT WINS"; flash.style.color = "var(--red)"; playSound("lose"); document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 550);
    } else {
      s.draws += 1; s.streak = 0; setRobotMode(); say("draw"); flash.textContent = "DRAW"; flash.style.color = "var(--yellow)"; playSound("beep");
    }
    if (s.streak >= 5 && !state.boss) activateBossMode();
    saveStats(); renderStats(); flash.classList.add("show"); await sleep(2100); flash.classList.remove("show"); finishRound();
  }
  function finishRound() { state.playing = false; $("startButton").disabled = false; $("stageStatus").textContent = "SYSTEM READY · NEXT ROUND"; if (!state.boss) setRobotMode(); }
  function makeConfetti() {
    const box = $("confetti"), colors = ["#00e5ff", "#55ffb2", "#ffffff", "#2877ff", "#ffd34d"];
    for (let i=0;i<75;i++) { const bit = document.createElement("i"); bit.style.left = `${Math.random()*100}%`; bit.style.background = randomItem(colors); bit.style.setProperty("--drift", `${Math.random()*220-110}px`); bit.style.animationDelay = `${Math.random()*.45}s`; box.appendChild(bit); setTimeout(() => bit.remove(), 3100); }
  }
  function activateBossMode() { state.boss = true; setRobotMode("boss-mode"); $("bossAlert").classList.add("show"); say("boss"); setTimeout(() => $("bossAlert").classList.remove("show"), 4700); }

  async function connectSerial() {
    if (!("serial" in navigator)) { toast("Web Serial needs Chrome or Edge on desktop"); return; }
    if (state.port) { await disconnectSerial(); return; }
    try {
      state.port = await navigator.serial.requestPort(); await state.port.open({ baudRate: 115200 });
      state.writer = state.port.writable.getWriter(); updateSerialUI(true); playSound("click"); toast("Arduino connected at 115200 baud");
    } catch (error) { if (error.name !== "NotFoundError") { console.error("Serial error:", error); toast("Could not connect to Arduino"); } }
  }
  async function disconnectSerial() {
    try { if (state.writer) { state.writer.releaseLock(); state.writer = null; } if (state.port) await state.port.close(); } catch {} state.port = null; updateSerialUI(false);
  }
  function updateSerialUI(connected) {
    $("serialDot").classList.toggle("connected", connected); document.querySelector(".status-setting .serial-dot").classList.toggle("connected", connected);
    $("serialStatus").textContent = connected ? "ARDUINO CONNECTED" : "ARDUINO OFFLINE"; $("settingsSerialText").textContent = connected ? "Connected at 115200 baud" : "Not connected"; $("serialButton").textContent = connected ? "DISCONNECT" : "CONNECT";
  }

  function openSettings(open) { $("settings").classList.toggle("open", open); $("settingsBackdrop").classList.toggle("show", open); $("settings").setAttribute("aria-hidden", String(!open)); }
  function toggleSound(force) {
    state.muted = typeof force === "boolean" ? force : !state.muted;
    $("muteSetting").checked = !state.muted; $("soundIcon").textContent = state.muted ? "⌁" : "♪";
    if (!state.muted) { ensureAudio().resume(); playSound("click"); }
    toast(state.muted ? "Sound muted" : "Sound on");
  }
  function resetScores() {
    state.stats = { player: 0, robot: 0, draws: 0, streak: 0, games: 0 }; state.confidenceTotal = 0; state.boss = false; setRobotMode(); saveStats(); renderStats(); toast("Scores reset");
  }
  function createParticles() {
    const box = $("particles"); for (let i=0;i<34;i++) { const p=document.createElement("i"); p.style.left=`${Math.random()*100}%`; p.style.bottom=`${Math.random()*20-20}%`; p.style.animationDuration=`${8+Math.random()*12}s`; p.style.animationDelay=`${-Math.random()*16}s`; box.appendChild(p); }
  }
  function bind() {
    $("cameraButton").addEventListener("click", () => startCamera($("cameraSelect").value));
    $("cameraSelect").addEventListener("change", (e) => startCamera(e.target.value));
    $("startButton").addEventListener("click", playRound); $("serialButton").addEventListener("click", connectSerial);
    $("soundToggle").addEventListener("click", () => toggleSound()); $("muteSetting").addEventListener("change", (e) => toggleSound(!e.target.checked));
    $("settingsOpen").addEventListener("click", () => openSettings(true)); $("settingsClose").addEventListener("click", () => openSettings(false)); $("settingsBackdrop").addEventListener("click", () => openSettings(false));
    $("qualitySetting").addEventListener("change", (e) => $("app").dataset.quality = e.target.value);
    $("darkSetting").addEventListener("change", (e) => $("app").classList.toggle("light-mode", !e.target.checked));
    $("resetScores").addEventListener("click", resetScores);
    document.addEventListener("keydown", (e) => { if (e.code === "Space" && !/INPUT|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); playRound(); } if (e.key === "Escape") openSettings(false); });
    window.addEventListener("beforeunload", () => { if (state.stream) state.stream.getTracks().forEach((t) => t.stop()); });
    navigator.serial?.addEventListener("disconnect", () => { state.writer = null; state.port = null; updateSerialUI(false); toast("Arduino disconnected"); });
  }
  function init() {
    createParticles(); loadStats(); bind(); say("idle"); listCameras(); loadModel();
    let frame = 0;
    window.addEventListener("pointermove", (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
        document.documentElement.style.setProperty("--my", `${event.clientY}px`);
      });
    }, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
