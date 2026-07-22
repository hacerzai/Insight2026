import ScriptLoader from "./script-loader";
import SciencePlatform from "./science-platform";

export default function Home() {
  return (
    <main id="app" className="app" data-quality="high">
      <div className="ambient" aria-hidden="true"><div className="grid-floor"/><div id="particles" className="particles"/></div>

      <SciencePlatform />

      <section id="beat-robot" className="robot-experience" aria-label="Beat the Robot experience">

      <header className="topbar">
        <a className="brand" href="#science-lab" aria-label="Return to Vision AI Science Lab">
          <span className="brand-mark"><i/><i/></span>
          <span><b>TINYBOT</b><em>AI</em></span>
        </a>
        <div className="headline">
          <span>ROCK · PAPER · SCISSORS</span>
          <h1>Can You Beat the Robot?</h1>
        </div>
        <div className="header-actions">
          <span className="online"><i/> AI ONLINE</span>
          <button className="icon-button" id="soundToggle" aria-label="Toggle sound" title="Sound"><span id="soundIcon">⌁</span></button>
          <button className="icon-button" id="settingsOpen" aria-label="Open settings" title="Settings">⚙</button>
        </div>
      </header>

      <section className="arena" aria-label="Rock paper scissors arena">
        <aside className="score-panel glass-panel">
          <div className="panel-label"><span>LIVE SCORE</span><i/></div>
          <div className="score-row player-score"><span>YOU</span><strong id="playerScore">0</strong></div>
          <div className="versus"><span/><b>VS</b><span/></div>
          <div className="score-row bot-score"><span>TINYBOT</span><strong id="robotScore">0</strong></div>
          <div className="record-grid">
            <div><b id="winsStat">0</b><span>WINS</span></div>
            <div><b id="drawsStat">0</b><span>DRAWS</span></div>
            <div><b id="lossesStat">0</b><span>LOSSES</span></div>
          </div>
          <div className="streak-row"><span>WIN STREAK</span><b>🔥 <i id="streakStat">0</i></b></div>
        </aside>

        <div className="game-stage">
          <div className="stage-status"><i/><span id="stageStatus">SYSTEM READY</span><i/></div>
          <div className="camera-shell" id="cameraShell">
            <div className="corner tl"/><div className="corner tr"/><div className="corner bl"/><div className="corner br"/>
            <video id="webcam" autoPlay muted playsInline aria-label="Live camera feed"/>
            <canvas id="captureCanvas" width="640" height="480" aria-hidden="true"/>
            <div className="camera-empty" id="cameraEmpty">
              <div className="hand-scan"><span>✊</span><i/><i/></div>
              <h2>CAMERA STANDBY</h2>
              <p>Allow camera access to enter the arena</p>
            </div>
            <div className="scan-line"/>
            <div className="hud hud-top"><span>GESTURE FEED</span><b><i/> LIVE</b></div>
            <div className="hud hud-bottom"><span id="resolutionLabel">—</span><b id="fpsLabel">AI VISION</b></div>
            <div className="countdown" id="countdown" aria-live="assertive"></div>
            <div className="result-flash" id="resultFlash"/>
          </div>

          <div className="prediction-card glass-panel">
            <div className="move-symbol" id="playerMoveIcon">—</div>
            <div className="prediction-main">
              <span>YOUR MOVE</span>
              <strong id="predictionText">WAITING</strong>
              <div className="confidence-track"><i id="confidenceBar"/></div>
            </div>
            <div className="confidence-value"><strong id="confidenceValue">0%</strong><span>CONFIDENCE</span></div>
          </div>

          <div className="controls">
            <button id="startButton" className="start-button"><span className="play">▶</span><span><b>START BATTLE</b><small>Press space</small></span></button>
            <button id="cameraButton" className="secondary-button">◉ ENABLE CAMERA</button>
          </div>
          <p className="hint"><span>TIP</span> Hold your hand clearly inside the frame during the countdown.</p>
        </div>

        <aside className="robot-panel glass-panel" id="robotPanel">
          <div className="panel-label"><span>TINYBOT // V1.0</span><i/></div>
          <div className="robot-wrap">
            <div className="orbit-ring"><i/><i/><i/></div>
            <div className="antenna"><i/></div>
            <div className="robot-head">
              <div className="robot-ear left"/><div className="robot-ear right"/>
              <div className="robot-face"><span className="eye left"/><span className="eye right"/><i className="mouth"/></div>
            </div>
            <div className="robot-neck"/>
            <div className="robot-body"><i/><b>TB</b></div>
          </div>
          <div className="speech" id="speech" aria-live="polite"><i/>Awaiting challenger...</div>
          <div className="bot-move">
            <span>ROBOT MOVE</span>
            <div><b id="robotMoveIcon">?</b><strong id="robotMoveText">HIDDEN</strong></div>
          </div>
          <div className="serial-card">
            <div><span className="serial-dot" id="serialDot"/><span><b id="serialStatus">ARDUINO OFFLINE</b><small>115200 baud · Web Serial</small></span></div>
            <button id="serialButton">CONNECT</button>
          </div>
        </aside>
      </section>

      <section className="telemetry glass-panel" aria-label="Game statistics">
        <div><span>GAMES PLAYED</span><strong id="gamesStat">0</strong><i/></div>
        <div><span>PLAYER WIN RATE</span><strong id="playerRate">0%</strong><i/></div>
        <div><span>ROBOT WIN RATE</span><strong id="robotRate">0%</strong><i/></div>
        <div><span>AVG. CONFIDENCE</span><strong id="averageConfidence">0%</strong><i/></div>
        <p><span className="pulse-dot"/> NEURAL ENGINE ACTIVE</p>
      </section>

      <div className="boss-alert" id="bossAlert" role="alert"><span>⚠</span><div><b>WARNING</b><p>Human Intelligence Increasing...<br/>Activating Boss Mode...</p></div></div>
      <div id="confetti" className="confetti" aria-hidden="true"/>

      <div className="settings-backdrop" id="settingsBackdrop"/>
      <aside className="settings" id="settings" aria-label="Settings panel" aria-hidden="true">
        <div className="settings-head"><div><span>CONTROL CENTER</span><h2>Settings</h2></div><button id="settingsClose" aria-label="Close settings">×</button></div>
        <div className="setting-row"><span><b>Sound effects</b><small>Countdown and battle sounds</small></span><label className="switch"><input id="muteSetting" type="checkbox"/><i/></label></div>
        <div className="setting-row"><span><b>Deep black mode</b><small>Maximum contrast for the arena</small></span><label className="switch"><input id="darkSetting" type="checkbox" defaultChecked/><i/></label></div>
        <label className="select-setting"><span><b>Animation quality</b><small>Adjust effects for this computer</small></span><select id="qualitySetting" defaultValue="high"><option value="high">High · 60 FPS</option><option value="medium">Balanced</option><option value="low">Low power</option></select></label>
        <label className="select-setting"><span><b>Camera</b><small>Select the gesture camera</small></span><select id="cameraSelect"><option value="">Default camera</option></select></label>
        <div className="setting-row status-setting"><span><b>Arduino link</b><small id="settingsSerialText">Not connected</small></span><i className="serial-dot"/></div>
        <div className="setting-row"><span><b>Serial newline</b><small>Append line break after R, P or S</small></span><label className="switch"><input id="newlineSetting" type="checkbox"/><i/></label></div>
        <button className="reset-button" id="resetScores">RESET ALL SCORES</button>
        <p className="settings-note">MediaPipe hand model status: <b id="modelStatus">INITIALIZING</b></p>
      </aside>

      <div className="toast" id="toast" role="status" aria-live="polite"/>
      </section>
      <ScriptLoader />
    </main>
  );
}
