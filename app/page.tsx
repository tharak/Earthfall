"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GameEngine } from "./game-engine";
import type { MissionHud, MissionResult, SkinId, TouchInput, WeaponId } from "./game-types";
import { MiniMap } from "./mini-map";
import { MISSION_MAPS, type MissionMapId } from "./map-content";
import { EXTRACTION_POSITIONS } from "./game-config";
import { EarthGlobe } from "./earth-globe";

type Screen = "command" | "mission" | "debrief";

type Mission = {
  id: string;
  mapId: MissionMapId | null;
  city: string;
  country: string;
  zone: string;
  coordinates: string;
  threat: string;
  status: "PLAYABLE" | "SCANNING";
  reward: string;
  enemies: string;
  enemyTypes: Array<"hunter" | "sentry">;
  latitude: number;
  longitude: number;
};

const MISSIONS: Mission[] = [
  {
    id: "sao-paulo",
    mapId: "sao-paulo",
    city: "SÃO PAULO",
    country: "BRAZIL",
    zone: "PRAÇA DA SÉ",
    coordinates: "23.5513° S / 46.6344° W",
    threat: "LEVEL 03",
    status: "PLAYABLE",
    reward: "280–440 CR",
    enemies: "HUNTERS / SENTRIES",
    enemyTypes: ["hunter", "sentry"],
    latitude: -23.5513,
    longitude: -46.6344,
  },
  {
    id: "tokyo",
    mapId: "tokyo",
    city: "TOKYO",
    country: "JAPAN",
    zone: "SHIBUYA CROSSING",
    coordinates: "35.6595° N / 139.7005° E",
    threat: "LEVEL 05",
    status: "PLAYABLE",
    reward: "420–620 CR",
    enemies: "HUNTERS / SENTRIES",
    enemyTypes: ["hunter", "sentry"],
    latitude: 35.6595,
    longitude: 139.7005,
  },
  {
    id: "cairo",
    mapId: null,
    city: "CAIRO",
    country: "EGYPT",
    zone: "TAHRIR SQUARE",
    coordinates: "30.0444° N / 31.2357° E",
    threat: "LEVEL 04",
    status: "SCANNING",
    reward: "CLASSIFIED",
    enemies: "SIGNAL LOST",
    enemyTypes: ["hunter", "sentry"],
    latitude: 30.0444,
    longitude: 31.2357,
  },
  {
    id: "paris",
    mapId: null,
    city: "PARIS",
    country: "FRANCE",
    zone: "RÉPUBLIQUE",
    coordinates: "48.8674° N / 2.3639° E",
    threat: "LEVEL 06",
    status: "SCANNING",
    reward: "CLASSIFIED",
    enemies: "SIGNAL LOST",
    enemyTypes: ["hunter", "sentry"],
    latitude: 48.8674,
    longitude: 2.3639,
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
  extractionUnlocked: true,
  extractionProgress: 0,
  reloading: false,
  message: "",
  tacticalMap: {
    player: { x: 0, z: 100, heading: 0 },
    enemies: [],
    pickups: [],
    extractions: EXTRACTION_POSITIONS.map(([x, z]) => ({ x, z })),
  },
};

function EnemyTypeIcon({ type }: { type: "hunter" | "sentry" }) {
  return type === "hunter" ? (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M7 10 20 4l13 6-4 21-9 5-9-5L7 10Z" />
      <path d="m12 15 8 5 8-5M20 20v10M13 27l7 3 7-3" />
    </svg>
  ) : (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 9h22v22H9z" />
      <circle cx="20" cy="20" r="7" />
      <path d="M20 4v5M20 31v5M4 20h5M31 20h5" />
    </svg>
  );
}

function MissionStage({
  mission,
  weapon,
  skin,
  onEnd,
  onAbort,
}: {
  mission: Mission & { mapId: MissionMapId };
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
  const stickPointerRef = useRef<{ id: number | null; x: number; y: number }>({ id: null, x: 0, y: 0 });
  const [stick, setStick] = useState({ active: false, x: 0, y: 0, dx: 0, dy: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    let engine: GameEngine | null = null;
    let errorFrame = 0;
    try {
      engine = new GameEngine(canvasRef.current, mission.mapId, weapon, skin, touchRef.current, setHud, onEnd);
    } catch {
      errorFrame = window.requestAnimationFrame(() => setWebglUnavailable(true));
    }
    return () => {
      if (errorFrame) window.cancelAnimationFrame(errorFrame);
      engine?.destroy();
    };
  }, [mission.mapId, onEnd, skin, weapon]);

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

  const updateStick = (clientX: number, clientY: number) => {
    const origin = stickPointerRef.current;
    const rawX = clientX - origin.x;
    const rawY = clientY - origin.y;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > 42 ? 42 / distance : 1;
    const dx = rawX * scale;
    const dy = rawY * scale;
    const threshold = 11;
    touchRef.current.left = dx < -threshold;
    touchRef.current.right = dx > threshold;
    touchRef.current.up = dy < -threshold;
    touchRef.current.down = dy > threshold;
    setStick({ active: true, x: origin.x, y: origin.y, dx, dy });
  };

  const releaseStick = (pointerId: number) => {
    if (stickPointerRef.current.id !== pointerId) return;
    stickPointerRef.current.id = null;
    touchRef.current.up = false;
    touchRef.current.down = false;
    touchRef.current.left = false;
    touchRef.current.right = false;
    setStick((current) => ({ ...current, active: false, dx: 0, dy: 0 }));
  };

  const onTouchStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button, a")) return;
    if (stickPointerRef.current.id !== null) return;
    stickPointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setStick({ active: true, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
  };

  const onTouchMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (stickPointerRef.current.id !== event.pointerId) return;
    updateStick(event.clientX, event.clientY);
  };

  return (
    <main
      className="mission-shell"
      onPointerDown={onTouchStart}
      onPointerMove={onTouchMove}
      onPointerUp={(event) => releaseStick(event.pointerId)}
      onPointerCancel={(event) => releaseStick(event.pointerId)}
    >
      <canvas ref={canvasRef} className="mission-canvas" aria-label={`Playable ${mission.city} extraction mission`} />
      <div className="mission-vignette" />

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

      <MiniMap state={hud.tacticalMap} mapData={MISSION_MAPS[mission.mapId]} locationName={mission.zone} />

      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODBL
      </a>

      <div className="controls-hint"><kbd>WASD</kbd> MOVE <kbd>MOUSE</kbd> AIM <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> CAMERA <kbd>R</kbd> RELOAD</div>

      <div className="touch-stick" data-active={stick.active} style={{ left: stick.x, top: stick.y }} aria-hidden="true">
        <i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
      </div>

      <div className="touch-controls" aria-label="Touch controls">
        <div className="touch-actions">
          <button onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setTouch("reload", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("reload", false); }} onPointerCancel={() => setTouch("reload", false)}>RELOAD</button>
          {hud.extractionUnlocked && <button className="extract" onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setTouch("extract", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("extract", false); }} onPointerCancel={() => setTouch("extract", false)}>EXTRACT</button>}
          <button className="fire" onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setTouch("fire", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("fire", false); }} onPointerCancel={() => setTouch("fire", false)}>FIRE</button>
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

  if (screen === "mission" && mission.mapId) {
    return <MissionStage mission={{ ...mission, mapId: mission.mapId }} weapon={weapon} skin={skin} onEnd={finishMission} onAbort={() => setScreen("command")} />;
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
        <div className="earth-display">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="map-heading"><span className="section-tag">GLOBAL OCCUPATION MAP</span><h1>SELECT DROP ZONE</h1></div>
          <EarthGlobe locations={MISSIONS} selectedId={selectedMission} onSelect={setSelectedMission} />
          <div className="earth-caption"><span>INVASION DAY</span><strong>017</strong></div>
        </div>

        <aside className="zone-selection" aria-live="polite">
          <div className="zone-title"><i data-status={mission.status} /><h2>{mission.zone}</h2></div>
          <div className="zone-meta"><span>{mission.city} · {mission.country}</span><small>{mission.coordinates}</small></div>
          <div className="enemy-types">
            <div>
              {mission.enemyTypes.map((type) => (
                <span className={`enemy-type ${type}`} key={type} title={type === "hunter" ? "Hunter" : "Sentry"}>
                  <EnemyTypeIcon type={type} />
                  <b>{type.toUpperCase()}</b>
                </span>
              ))}
            </div>
          </div>
          <button className="primary-action" disabled={mission.status !== "PLAYABLE"} onClick={() => setBriefing(true)}>
            {mission.status === "PLAYABLE" ? "SELECT THIS ZONE" : "ZONE UNAVAILABLE"}<span>→</span>
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
            <div className="deployment-number">0{MISSIONS.findIndex((item) => item.id === mission.id) + 1}</div>
            <span className="section-tag">MISSION LOADOUT</span>
            <h2 id="deploy-title">CHOOSE YOUR EQUIPMENT</h2>
            <p>Select your weapon and suit before entering the occupation zone.</p>
            <div className="deploy-zone-summary">
              <span>DROP ZONE<strong>{mission.zone} · {mission.city}</strong></span>
              <span>OBJECTIVE<strong>DISMANTLE 8 MACHINES</strong></span>
            </div>
            <div className="deployment-picker">
              <section>
                <span className="eyebrow">PRIMARY WEAPON</span>
                <div className="deploy-weapon-options">
                  {WEAPONS.map((item) => (
                    <button key={item.id} className={`deploy-weapon ${weapon === item.id ? "selected" : ""}`} aria-pressed={weapon === item.id} onClick={() => setWeapon(item.id)}>
                      <i className={`weapon-shape ${item.id}`} />
                      <span><small>{item.type}</small><strong>{item.name}</strong><em>{item.stat}</em></span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <span className="eyebrow">SUIT FINISH</span>
                <div className="deploy-skin-options">
                  {SKINS.map((item) => (
                    <button key={item.id} className={`deploy-skin ${skin === item.id ? "selected" : ""}`} aria-pressed={skin === item.id} onClick={() => setSkin(item.id)}>
                      <i className={item.swatch} />
                      <span><strong>{item.name}</strong><small>{item.note}</small></span>
                    </button>
                  ))}
                </div>
              </section>
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
