"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GameEngine,
  type MissionHud,
  type MissionResult,
  type SkinId,
  type TouchInput,
  type WeaponId,
} from "./game-engine";
import { MiniMap } from "./mini-map";

type Screen = "command" | "mission" | "debrief";

type Mission = {
  id: string;
  city: string;
  country: string;
  zone: string;
  coordinates: string;
  threat: string;
  status: "PLAYABLE" | "SCANNING";
  reward: string;
  enemies: string;
};

const MISSIONS: Mission[] = [
  {
    id: "sao-paulo",
    city: "SÃO PAULO",
    country: "BRAZIL",
    zone: "PRAÇA DA SÉ",
    coordinates: "23.5513° S / 46.6344° W",
    threat: "LEVEL 03",
    status: "PLAYABLE",
    reward: "280–440 CR",
    enemies: "HUNTERS / SENTRIES",
  },
  {
    id: "tokyo",
    city: "TOKYO",
    country: "JAPAN",
    zone: "SHIBUYA",
    coordinates: "35.6595° N / 139.7005° E",
    threat: "LEVEL 05",
    status: "SCANNING",
    reward: "CLASSIFIED",
    enemies: "SIGNAL LOST",
  },
  {
    id: "cairo",
    city: "CAIRO",
    country: "EGYPT",
    zone: "TAHRIR SQUARE",
    coordinates: "30.0444° N / 31.2357° E",
    threat: "LEVEL 04",
    status: "SCANNING",
    reward: "CLASSIFIED",
    enemies: "SIGNAL LOST",
  },
  {
    id: "paris",
    city: "PARIS",
    country: "FRANCE",
    zone: "RÉPUBLIQUE",
    coordinates: "48.8674° N / 2.3639° E",
    threat: "LEVEL 06",
    status: "SCANNING",
    reward: "CLASSIFIED",
    enemies: "SIGNAL LOST",
  },
];

const WEAPONS: Array<{ id: WeaponId; name: string; type: string; stat: string; detail: string }> = [
  { id: "arc", name: "AR-7 ARC RIFLE", type: "PRECISION", stat: "42 DMG · 12 MAG", detail: "Measured shots. Heavy machine disruption." },
  { id: "pulse", name: "PC-3 PULSE CARBINE", type: "SUPPRESSION", stat: "24 DMG · 24 MAG", detail: "Fast cadence. Built for close pressure." },
];

const SKINS: Array<{ id: SkinId; name: string; note: string; swatch: string }> = [
  { id: "carbon", name: "CARBON SHELL", note: "ISSUED", swatch: "skin-carbon" },
  { id: "salvage", name: "SALVAGE WHITE", note: "EARNABLE", swatch: "skin-salvage" },
  { id: "signal", name: "SIGNAL RED", note: "COSMETIC · R$ 18", swatch: "skin-signal" },
];

const EMPTY_HUD: MissionHud = {
  health: 100,
  ammo: 12,
  magazine: 12,
  kills: 0,
  requiredKills: 8,
  salvage: 0,
  timeLeft: 180,
  extractionUnlocked: false,
  extractionProgress: 0,
  reloading: false,
  message: "",
  tacticalMap: {
    player: { x: 0, z: 10, heading: 0 },
    enemies: [],
    pickups: [],
    extraction: { x: -12, z: 9, unlocked: false },
  },
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function MissionStage({
  weapon,
  skin,
  onEnd,
  onAbort,
}: {
  weapon: WeaponId;
  skin: SkinId;
  onEnd: (result: MissionResult) => void;
  onAbort: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchRef = useRef<TouchInput>({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    reload: false,
    extract: false,
  });
  const [hud, setHud] = useState<MissionHud>(EMPTY_HUD);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    let engine: GameEngine | null = null;
    let errorFrame = 0;
    try {
      engine = new GameEngine(canvasRef.current, weapon, skin, touchRef.current, setHud, onEnd);
    } catch {
      errorFrame = window.requestAnimationFrame(() => setWebglUnavailable(true));
    }
    return () => {
      if (errorFrame) window.cancelAnimationFrame(errorFrame);
      engine?.destroy();
    };
  }, [onEnd, skin, weapon]);

  if (webglUnavailable) {
    return (
      <main className="mission-unavailable">
        <section>
          <span className="section-tag">RENDERER CHECK FAILED</span>
          <h1>WEBGL IS UNAVAILABLE</h1>
          <p>This browser has 3D graphics disabled. Enable hardware acceleration or open the prototype in a current desktop or mobile browser.</p>
          <button className="primary-action" onClick={onAbort}>RETURN TO COMMAND <span>←</span></button>
        </section>
      </main>
    );
  }

  const setTouch = (key: keyof TouchInput, value: boolean) => {
    touchRef.current[key] = value;
  };

  return (
    <main className="mission-shell">
      <canvas ref={canvasRef} className="mission-canvas" aria-label="Playable São Paulo extraction mission" />
      <div className="mission-vignette" />

      <header className="mission-topbar">
        <div className="wordmark compact"><span>EARTHFALL</span><strong>PROTOCOL</strong></div>
        <div className="mission-location"><span>ZONE 01</span><strong>PRAÇA DA SÉ · SÃO PAULO</strong></div>
        <div className="mission-clock"><span>WINDOW</span><strong>{formatTime(hud.timeLeft)}</strong></div>
      </header>

      <aside className="objective-card">
        <span className="eyebrow">PRIMARY DIRECTIVE</span>
        <strong>{hud.extractionUnlocked ? "REACH EXTRACTION" : "DISMANTLE MACHINES"}</strong>
        <div className="objective-progress">
          <i style={{ width: `${hud.extractionUnlocked ? 100 : (hud.kills / hud.requiredKills) * 100}%` }} />
        </div>
        <small>{hud.extractionUnlocked ? "GREEN BEACON · SOUTHWEST" : `${hud.kills} / ${hud.requiredKills} TARGETS`}</small>
      </aside>

      <div className="combat-message" data-visible={Boolean(hud.message)}>{hud.message || "SYSTEM NOMINAL"}</div>

      <aside className="health-panel">
        <div className="health-copy"><span>VITALS</span><strong>{hud.health}</strong></div>
        <div className="health-track"><i style={{ width: `${hud.health}%` }} /></div>
      </aside>

      <aside className="ammo-panel">
        <span>{WEAPONS.find((item) => item.id === weapon)?.name}</span>
        <strong>{hud.reloading ? "--" : hud.ammo}<small> / {hud.magazine}</small></strong>
        <em>{hud.reloading ? "RELOADING" : "R · RELOAD"}</em>
      </aside>

      <aside className="salvage-panel">
        <span>UNSECURED</span>
        <strong>◈ {hud.salvage}</strong>
        <small>LOST ON FAILURE</small>
      </aside>

      <MiniMap state={hud.tacticalMap} />

      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODBL
      </a>

      {hud.extractionUnlocked && (
        <div className="extract-meter" data-active={hud.extractionProgress > 0}>
          <span>HOLD E TO TRANSFER</span>
          <div><i style={{ width: `${hud.extractionProgress * 100}%` }} /></div>
        </div>
      )}

      <div className="controls-hint"><kbd>WASD</kbd> MOVE <kbd>MOUSE</kbd> AIM <kbd>LMB</kbd> FIRE <kbd>R</kbd> RELOAD</div>

      <div className="touch-controls" aria-label="Touch controls">
        <div className="touch-dpad">
          <button aria-label="Move up" onPointerDown={() => setTouch("up", true)} onPointerUp={() => setTouch("up", false)}>▲</button>
          <button aria-label="Move left" onPointerDown={() => setTouch("left", true)} onPointerUp={() => setTouch("left", false)}>◀</button>
          <button aria-label="Move right" onPointerDown={() => setTouch("right", true)} onPointerUp={() => setTouch("right", false)}>▶</button>
          <button aria-label="Move down" onPointerDown={() => setTouch("down", true)} onPointerUp={() => setTouch("down", false)}>▼</button>
        </div>
        <div className="touch-actions">
          <button onPointerDown={() => setTouch("reload", true)} onPointerUp={() => setTouch("reload", false)}>RELOAD</button>
          {hud.extractionUnlocked && <button className="extract" onPointerDown={() => setTouch("extract", true)} onPointerUp={() => setTouch("extract", false)}>EXTRACT</button>}
          <button className="fire" onPointerDown={() => setTouch("fire", true)} onPointerUp={() => setTouch("fire", false)}>FIRE</button>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("command");
  const [selectedMission, setSelectedMission] = useState(MISSIONS[0].id);
  const [weapon, setWeapon] = useState<WeaponId>("arc");
  const [skin, setSkin] = useState<SkinId>("carbon");
  const [credits, setCredits] = useState(600);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [loadoutOpen, setLoadoutOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("earthfall-credits");
    if (!saved) return;
    const frame = window.requestAnimationFrame(() => setCredits(Number(saved) || 600));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const mission = useMemo(
    () => MISSIONS.find((item) => item.id === selectedMission) ?? MISSIONS[0],
    [selectedMission],
  );

  const finishMission = (missionResult: MissionResult) => {
    setResult(missionResult);
    if (missionResult.success) {
      setCredits((current) => {
        const next = current + missionResult.salvage;
        window.localStorage.setItem("earthfall-credits", String(next));
        return next;
      });
    }
    setScreen("debrief");
  };

  if (screen === "mission") {
    return <MissionStage weapon={weapon} skin={skin} onEnd={finishMission} onAbort={() => setScreen("command")} />;
  }

  if (screen === "debrief" && result) {
    return (
      <main className={`debrief-shell ${result.success ? "success" : "failure"}`}>
        <div className="debrief-scan" />
        <section className="debrief-card">
          <span className="eyebrow">OPERATION 001 · CLOSED</span>
          <div className="debrief-mark">{result.success ? "✓" : "×"}</div>
          <h1>{result.success ? "EXTRACTION CONFIRMED" : "OPERATIVE SIGNAL LOST"}</h1>
          <p>{result.success ? "Your salvage crossed the transfer field and has been banked." : result.reason === "timeout" ? "The carrier reinforced the zone before extraction." : "Unsecured salvage was abandoned inside the occupation zone."}</p>
          <div className="debrief-stats">
            <div><span>MACHINES</span><strong>{result.kills}</strong></div>
            <div><span>RECOVERED</span><strong>{result.success ? result.salvage : 0} CR</strong></div>
            <div><span>LOST</span><strong>{result.success ? 0 : result.salvage} CR</strong></div>
          </div>
          <button className="primary-action" onClick={() => { setScreen("command"); setResult(null); }}>RETURN TO COMMAND <span>→</span></button>
        </section>
      </main>
    );
  }

  return (
    <main className="command-shell">
      <div className="command-grid" />
      <header className="command-header">
        <div className="wordmark"><span>EARTHFALL</span><strong>PROTOCOL</strong></div>
        <nav aria-label="Primary navigation">
          <button className="active">COMMAND</button>
          <button onClick={() => setLoadoutOpen(true)}>LOADOUT</button>
          <button disabled>ARCHIVE</button>
        </nav>
        <div className="account-status"><span>BANKED CREDITS</span><strong>◈ {credits.toLocaleString("en-US")}</strong></div>
      </header>

      <section className="command-content">
        <div className="mission-index">
          <span className="section-tag">GLOBAL OCCUPATION MAP</span>
          <h1>CHOOSE A<br /><em>DROP ZONE</em></h1>
          <p>Alien carrier signals are active in four population centers. One corridor is open for deployment.</p>

          <div className="mission-list" role="list">
            {MISSIONS.map((item, index) => (
              <button
                key={item.id}
                className={selectedMission === item.id ? "selected" : ""}
                onClick={() => setSelectedMission(item.id)}
                role="listitem"
              >
                <span>0{index + 1}</span>
                <div><strong>{item.city}</strong><small>{item.zone}</small></div>
                <em data-status={item.status}>{item.status}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="earth-display" aria-label="Stylized globe showing occupied cities">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="earth">
            <div className="earth-grid" />
            <div className="continent c-one" />
            <div className="continent c-two" />
            <div className="continent c-three" />
            <button className="world-node node-one active" aria-label="São Paulo active mission"><i /><span>SÃO PAULO</span></button>
            <button className="world-node node-two" aria-label="Tokyo scanning"><i /><span>TOKYO</span></button>
            <button className="world-node node-three" aria-label="Cairo scanning"><i /><span>CAIRO</span></button>
          </div>
          <div className="earth-caption"><span>INVASION DAY</span><strong>017</strong></div>
        </div>

        <aside className="mission-brief">
          <div className="brief-heading"><span>{mission.status}</span><small>{mission.coordinates}</small></div>
          <span className="section-tag">SELECTED OPERATION</span>
          <h2>{mission.zone}</h2>
          <p className="city-label">{mission.city} · {mission.country}</p>

          <div className="district-preview">
            <div className="preview-sky"><i className="carrier" /></div>
            <div className="preview-building p-one" />
            <div className="preview-building p-two" />
            <div className="preview-building p-three" />
            <div className="preview-road" />
            <span>LIVE GEOMETRY FEED</span>
          </div>

          <div className="brief-data">
            <div><span>THREAT</span><strong>{mission.threat}</strong></div>
            <div><span>HOSTILES</span><strong>{mission.enemies}</strong></div>
            <div><span>OBJECTIVE</span><strong>DISMANTLE 8 UNITS</strong></div>
            <div><span>REWARD</span><strong>{mission.reward}</strong></div>
          </div>

          <button className="loadout-strip" onClick={() => setLoadoutOpen(true)}>
            <span>ACTIVE LOADOUT</span>
            <strong>{WEAPONS.find((item) => item.id === weapon)?.name}</strong>
            <em>{SKINS.find((item) => item.id === skin)?.name} · EDIT</em>
          </button>
          <button className="primary-action" disabled={mission.status !== "PLAYABLE"} onClick={() => setBriefing(true)}>
            {mission.status === "PLAYABLE" ? "PREPARE DEPLOYMENT" : "ZONE UNAVAILABLE"}<span>→</span>
          </button>
        </aside>
      </section>

      <footer className="command-footer">
        <span>NETWORK: <b>STABLE</b></span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODBL</a>
        <span>BUILD 0.1.0</span>
      </footer>

      {loadoutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoadoutOpen(false); }}>
          <section className="loadout-modal" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
            <button className="modal-close" onClick={() => setLoadoutOpen(false)} aria-label="Close loadout">×</button>
            <span className="section-tag">OPERATIVE CONFIGURATION</span>
            <h2 id="loadout-title">LOADOUT</h2>
            <p>Combat equipment changes how you fight. Suit finishes are presentation only.</p>
            <div className="loadout-columns">
              <div>
                <span className="eyebrow">PRIMARY WEAPON</span>
                {WEAPONS.map((item) => (
                  <button key={item.id} className={`gear-card ${weapon === item.id ? "selected" : ""}`} onClick={() => setWeapon(item.id)}>
                    <i className={`weapon-shape ${item.id}`} />
                    <span><small>{item.type}</small><strong>{item.name}</strong><em>{item.stat}</em><p>{item.detail}</p></span>
                  </button>
                ))}
              </div>
              <div>
                <span className="eyebrow">SUIT FINISH · COSMETIC ONLY</span>
                {SKINS.map((item) => (
                  <button key={item.id} className={`skin-card ${skin === item.id ? "selected" : ""}`} onClick={() => setSkin(item.id)}>
                    <i className={item.swatch} /><span><strong>{item.name}</strong><small>{item.note}</small></span>
                  </button>
                ))}
                <div className="commerce-note"><strong>DIRECT PURCHASES ONLY</strong><span>No random rewards. No gameplay advantage.</span></div>
              </div>
            </div>
            <button className="primary-action" onClick={() => setLoadoutOpen(false)}>CONFIRM LOADOUT <span>✓</span></button>
          </section>
        </div>
      )}

      {briefing && (
        <div className="modal-backdrop briefing-backdrop">
          <section className="deployment-modal" role="dialog" aria-modal="true" aria-labelledby="deploy-title">
            <div className="deployment-number">01</div>
            <span className="section-tag">DEPLOYMENT AUTHORIZATION</span>
            <h2 id="deploy-title">ENTER THE OCCUPATION ZONE?</h2>
            <p>Salvage collected in the zone remains unsecured until extraction. Failure leaves it behind.</p>
            <div className="deploy-summary">
              <span>{mission.zone}<b>{mission.city}</b></span>
              <span>PRIMARY<b>8 MACHINES</b></span>
              <span>LOADOUT<b>{WEAPONS.find((item) => item.id === weapon)?.name}</b></span>
            </div>
            <div className="deployment-actions">
              <button onClick={() => setBriefing(false)}>CANCEL</button>
              <button className="primary-action" onClick={() => { setBriefing(false); setScreen("mission"); }}>DEPLOY NOW <span>→</span></button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
