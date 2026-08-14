"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { GameEngine } from "./game-engine";
import type { EnemyKind, MachineLoadout, MissionDefinition, MissionHud, MissionMapId, MissionResult, PartId, PartInventory, PartSlot, SkinId, TouchInput } from "./game-types";
import { MiniMap } from "./mini-map";
import { MISSION_MAPS } from "./map-content";
import {
  DEFAULT_LOADOUT,
  DEFAULT_PART_INVENTORY,
  EXTRACTION_POSITIONS,
  MACHINE_PARTS,
  MISSION_SECONDS,
  PLAYER_MAX_HEALTH,
  PLAYER_START_POSITION,
  REQUIRED_KILLS,
  TOUCH_STICK_RADIUS_PX,
  TOUCH_STICK_THRESHOLD_PX,
  WEAPONS,
} from "./game-config";
import { EarthGlobe } from "./earth-globe";
import { MachinePartPicker } from "./machine-loadout";

type Screen = "command" | "mission" | "debrief";

const MISSIONS: MissionDefinition[] = [
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

const SKINS: Array<{ id: SkinId; name: string; note: string; swatch: string }> = [
  { id: "carbon", name: "CARBON SHELL", note: "ISSUED", swatch: "skin-carbon" },
  { id: "salvage", name: "SALVAGE WHITE", note: "EARNABLE", swatch: "skin-salvage" },
  { id: "signal", name: "SIGNAL RED", note: "COSMETIC · R$ 18", swatch: "skin-signal" },
];

const PARTS_STORAGE_KEY = "earthfall-parts";
const LOADOUT_STORAGE_KEY = "earthfall-machine-loadout";

const EMPTY_HUD: MissionHud = {
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  ammo: WEAPONS.arc.magazine,
  magazine: WEAPONS.arc.magazine,
  kills: 0,
  requiredKills: REQUIRED_KILLS,
  salvage: 0,
  parts: [],
  timeLeft: MISSION_SECONDS,
  extractionUnlocked: true,
  extractionProgress: 0,
  reloading: false,
  tacticalMap: {
    player: { x: PLAYER_START_POSITION[0], z: PLAYER_START_POSITION[1], heading: 0 },
    enemies: [],
    pickups: [],
    extractions: EXTRACTION_POSITIONS.map(([x, z]) => ({ x, z })),
  },
};

function capturePointer(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Some browsers can invalidate a touch pointer before React handles it.
  }
}

function EnemyTypeIcon({ type }: { type: EnemyKind }): ReactElement {
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
  loadout,
  skin,
  onEnd,
  onAbort,
}: {
  mission: MissionDefinition & { mapId: MissionMapId };
  loadout: MachineLoadout;
  skin: SkinId;
  onEnd: (result: MissionResult) => void;
  onAbort: () => void;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchRef = useRef<TouchInput>({
    up: false,
    down: false,
    left: false,
    right: false,
    aimX: 0,
    aimZ: 0,
    aimWithStick: false,
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
      engine = new GameEngine(canvasRef.current, mission.mapId, loadout, skin, touchRef.current, setHud, onEnd);
    } catch {
      errorFrame = window.requestAnimationFrame(() => setWebglUnavailable(true));
    }
    return () => {
      if (errorFrame) window.cancelAnimationFrame(errorFrame);
      engine?.destroy();
    };
  }, [loadout, mission.mapId, onEnd, skin]);

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

  const setTouch = (key: keyof TouchInput, value: boolean): void => {
    touchRef.current[key] = value;
  };

  const updateStick = (clientX: number, clientY: number): void => {
    const origin = stickPointerRef.current;
    const rawX = clientX - origin.x;
    const rawY = clientY - origin.y;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > TOUCH_STICK_RADIUS_PX ? TOUCH_STICK_RADIUS_PX / distance : 1;
    const dx = rawX * scale;
    const dy = rawY * scale;
    const threshold = TOUCH_STICK_THRESHOLD_PX;
    touchRef.current.left = dx < -threshold;
    touchRef.current.right = dx > threshold;
    touchRef.current.up = dy < -threshold;
    touchRef.current.down = dy > threshold;
    touchRef.current.aimX = dx;
    touchRef.current.aimZ = dy;
    setStick({ active: true, x: origin.x, y: origin.y, dx, dy });
  };

  const releaseStick = (pointerId: number): void => {
    if (stickPointerRef.current.id !== pointerId) return;
    stickPointerRef.current.id = null;
    touchRef.current.up = false;
    touchRef.current.down = false;
    touchRef.current.left = false;
    touchRef.current.right = false;
    setStick((current) => ({ ...current, active: false, dx: 0, dy: 0 }));
  };

  const onTouchStart = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button, a")) return;
    if (stickPointerRef.current.id !== null) return;
    touchRef.current.aimWithStick = true;
    stickPointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    capturePointer(event.currentTarget, event.pointerId);
    setStick({ active: true, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
  };

  const onTouchMove = (event: ReactPointerEvent<HTMLElement>): void => {
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

      <div className="bottom-hud">
        <aside className="health-panel">
          <div className="health-copy"><span>VITALS</span><strong>{hud.health}</strong></div>
          <div className="health-track"><i style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }} /></div>
        </aside>

        <aside className="ammo-panel">
          <span>{MACHINE_PARTS[loadout.arms].name}</span>
          <strong>{hud.reloading ? "--" : hud.ammo}<small> / {hud.magazine}</small></strong>
          <em>{hud.reloading ? "RELOADING" : "R · RELOAD"}</em>
        </aside>

        {hud.extractionUnlocked && (
          <button
            className="desktop-extract"
            onPointerDown={(event) => {
              event.stopPropagation();
              capturePointer(event.currentTarget, event.pointerId);
              setTouch("extract", true);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              setTouch("extract", false);
            }}
            onPointerCancel={() => setTouch("extract", false)}
          >
            EXTRACT {hud.salvage}
          </button>
        )}

        <div className="touch-controls" aria-label="Touch controls">
          <div className="touch-actions">
            <button onPointerDown={(event) => { event.stopPropagation(); capturePointer(event.currentTarget, event.pointerId); setTouch("reload", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("reload", false); }} onPointerCancel={() => setTouch("reload", false)}>RELOAD</button>
            {hud.extractionUnlocked && <button className="extract" onPointerDown={(event) => { event.stopPropagation(); capturePointer(event.currentTarget, event.pointerId); setTouch("extract", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("extract", false); }} onPointerCancel={() => setTouch("extract", false)}>EXTRACT {hud.salvage}</button>}
            <button className="fire" onPointerDown={(event) => { event.stopPropagation(); capturePointer(event.currentTarget, event.pointerId); setTouch("fire", true); }} onPointerUp={(event) => { event.stopPropagation(); setTouch("fire", false); }} onPointerCancel={() => setTouch("fire", false)}>FIRE</button>
          </div>
        </div>
      </div>

      <MiniMap state={hud.tacticalMap} mapData={MISSION_MAPS[mission.mapId]} locationName={mission.zone} />

      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODBL
      </a>

      <div className="controls-hint"><kbd>WASD</kbd> MOVE <kbd>MOUSE</kbd> AIM <kbd>LMB</kbd> FIRE <kbd>RMB</kbd> CAMERA <kbd>R</kbd> RELOAD</div>

      <div className="touch-stick" data-active={stick.active} style={{ left: stick.x, top: stick.y }} aria-hidden="true">
        <i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
      </div>

    </main>
  );
}

function summarizeParts(parts: PartId[]): Array<{ id: PartId; count: number }> {
  const counts = new Map<PartId, number>();
  parts.forEach((partId) => counts.set(partId, (counts.get(partId) ?? 0) + 1));
  return [...counts].map(([id, count]) => ({ id, count }));
}

function DebriefScreen({ result, onReturn }: { result: MissionResult; onReturn: () => void }): ReactElement {
  const parts = summarizeParts(result.parts);
  return (
    <main className={`debrief-shell ${result.success ? "success" : "failure"}`}>
      <div className="debrief-scan" />
      <section className="debrief-card">
        <span className="eyebrow">OPERATION 001 · CLOSED</span>
        <div className="debrief-mark">{result.success ? "✓" : "×"}</div>
        <h1>{result.success ? "EXTRACTION CONFIRMED" : "OPERATIVE SIGNAL LOST"}</h1>
        <p>{result.success ? "Your salvage and recovered parts crossed the transfer field and have been banked." : result.reason === "timeout" ? "The carrier reinforced the zone before extraction." : "Unsecured salvage and parts were abandoned inside the occupation zone."}</p>
        <div className="debrief-stats">
          <div><span>MACHINES</span><strong>{result.kills}</strong></div>
          <div><span>RECOVERED</span><strong>{result.success ? result.salvage : 0} CR</strong></div>
          <div><span>LOST</span><strong>{result.success ? 0 : result.salvage} CR</strong></div>
        </div>
        {parts.length > 0 && (
          <div className={`recovered-parts ${result.success ? "secured" : "lost"}`}>
            <span>{result.success ? "PARTS SECURED" : "PARTS LOST"}</span>
            <div>
              {parts.map(({ id, count }) => (
                <strong key={id}>{MACHINE_PARTS[id].name}{count > 1 ? ` ×${count}` : ""}</strong>
              ))}
            </div>
          </div>
        )}
        <button className="primary-action" onClick={onReturn}>RETURN TO COMMAND <span>→</span></button>
      </section>
    </main>
  );
}

type LoadoutProps = {
  loadout: MachineLoadout;
  inventory: PartInventory;
  skin: SkinId;
  onPartChange: (slot: PartSlot, partId: PartId) => void;
  onSkinChange: (skin: SkinId) => void;
};

function SkinPicker({ skin, onSkinChange, compact = false }: Pick<LoadoutProps, "skin" | "onSkinChange"> & { compact?: boolean }): ReactElement {
  return (
    <div className={`skin-picker ${compact ? "compact" : ""}`}>
      <span className="eyebrow">FRAME FINISH · COSMETIC ONLY</span>
      <div className="deploy-skin-options">
        {SKINS.map((item) => (
          <button key={item.id} className={`deploy-skin ${skin === item.id ? "selected" : ""}`} aria-pressed={skin === item.id} onClick={() => onSkinChange(item.id)}>
            <i className={item.swatch} />
            <span><strong>{item.name}</strong><small>{item.note}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadoutModal({ loadout, inventory, skin, onPartChange, onSkinChange, onClose }: LoadoutProps & { onClose: () => void }): ReactElement {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="loadout-modal" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
        <button className="modal-close" onClick={onClose} aria-label="Close loadout">×</button>
        <span className="section-tag">MACHINE CONFIGURATION</span>
        <h2 id="loadout-title">PARTS LOADOUT</h2>
        <p>Equip one part in every machine slot. Destroy hostile machines, collect their parts, and extract to make those parts available here.</p>
        <MachinePartPicker loadout={loadout} inventory={inventory} onPartChange={onPartChange} />
        <SkinPicker skin={skin} onSkinChange={onSkinChange} compact />
        <button className="primary-action" onClick={onClose}>CONFIRM LOADOUT <span>✓</span></button>
      </section>
    </div>
  );
}

function DeploymentModal({ mission, loadout, inventory, skin, onPartChange, onSkinChange, onCancel, onDeploy }: LoadoutProps & {
  mission: MissionDefinition;
  onCancel: () => void;
  onDeploy: () => void;
}): ReactElement {
  return (
    <div className="modal-backdrop briefing-backdrop">
      <section className="deployment-modal" role="dialog" aria-modal="true" aria-labelledby="deploy-title">
        <div className="deployment-number">0{MISSIONS.findIndex((item) => item.id === mission.id) + 1}</div>
        <span className="section-tag">MISSION ASSEMBLY</span>
        <h2 id="deploy-title">BUILD YOUR MACHINE</h2>
        <p>Select the head, arms, core, and legs you want to deploy. Recovered enemy parts remain unsecured until extraction.</p>
        <div className="deploy-zone-summary">
          <span>DROP ZONE<strong>{mission.zone} · {mission.city}</strong></span>
          <span>OBJECTIVE<strong>DISMANTLE {REQUIRED_KILLS} MACHINES</strong></span>
        </div>
        <div className="deployment-picker">
          <MachinePartPicker loadout={loadout} inventory={inventory} onPartChange={onPartChange} compact />
          <SkinPicker skin={skin} onSkinChange={onSkinChange} compact />
        </div>
        <div className="deployment-actions">
          <button onClick={onCancel}>CANCEL</button>
          <button className="primary-action" onClick={onDeploy}>DEPLOY NOW <span>→</span></button>
        </div>
      </section>
    </div>
  );
}

function CommandScreen({
  mission,
  selectedMission,
  credits,
  loadout,
  inventory,
  skin,
  loadoutOpen,
  briefingOpen,
  onMissionSelect,
  onLoadoutOpen,
  onLoadoutClose,
  onBriefingOpen,
  onBriefingClose,
  onPartChange,
  onSkinChange,
  onDeploy,
}: LoadoutProps & {
  mission: MissionDefinition;
  selectedMission: string;
  credits: number;
  loadoutOpen: boolean;
  briefingOpen: boolean;
  onMissionSelect: (missionId: string) => void;
  onLoadoutOpen: () => void;
  onLoadoutClose: () => void;
  onBriefingOpen: () => void;
  onBriefingClose: () => void;
  onDeploy: () => void;
}): ReactElement {
  return (
    <main className="command-shell">
      <div className="command-grid" />
      <header className="command-header">
        <div className="wordmark"><span>EARTHFALL</span><strong>PROTOCOL</strong></div>
        <nav aria-label="Primary navigation">
          <button className="active">COMMAND</button>
          <button onClick={onLoadoutOpen}>LOADOUT</button>
          <button disabled>ARCHIVE</button>
        </nav>
        <div className="account-status"><span>BANKED CREDITS</span><strong>◈ {credits.toLocaleString("en-US")}</strong></div>
      </header>

      <section className="command-content">
        <div className="earth-display">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="map-heading"><span className="section-tag">GLOBAL OCCUPATION MAP</span><h1>SELECT DROP ZONE</h1></div>
          <EarthGlobe locations={MISSIONS} selectedId={selectedMission} onSelect={onMissionSelect} />
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
          <button className="primary-action" disabled={mission.status !== "PLAYABLE"} onClick={onBriefingOpen}>
            {mission.status === "PLAYABLE" ? "SELECT THIS ZONE" : "ZONE UNAVAILABLE"}<span>→</span>
          </button>
        </aside>
      </section>

      <footer className="command-footer">
        <span>NETWORK: <b>STABLE</b></span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODBL</a>
        <span>BUILD 0.1.0</span>
      </footer>

      {loadoutOpen && <LoadoutModal loadout={loadout} inventory={inventory} skin={skin} onPartChange={onPartChange} onSkinChange={onSkinChange} onClose={onLoadoutClose} />}
      {briefingOpen && <DeploymentModal mission={mission} loadout={loadout} inventory={inventory} skin={skin} onPartChange={onPartChange} onSkinChange={onSkinChange} onCancel={onBriefingClose} onDeploy={onDeploy} />}
    </main>
  );
}

function isPartId(value: unknown): value is PartId {
  return typeof value === "string" && value in MACHINE_PARTS;
}

function restoreInventory(value: string | null): PartInventory {
  if (!value) return DEFAULT_PART_INVENTORY;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PART_INVENTORY;
    const inventory: PartInventory = { ...DEFAULT_PART_INVENTORY };
    Object.entries(parsed).forEach(([partId, count]) => {
      if (isPartId(partId) && typeof count === "number" && Number.isFinite(count) && count > 0) {
        inventory[partId] = Math.floor(count);
      }
    });
    return inventory;
  } catch {
    return DEFAULT_PART_INVENTORY;
  }
}

function restoreLoadout(value: string | null, inventory: PartInventory): MachineLoadout {
  if (!value) return DEFAULT_LOADOUT;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return DEFAULT_LOADOUT;
    const saved = parsed as Record<string, unknown>;
    const loadout: MachineLoadout = { ...DEFAULT_LOADOUT };
    Object.keys(loadout).forEach((slotName) => {
      const slot = slotName as PartSlot;
      const partId = saved[slot];
      if (isPartId(partId) && MACHINE_PARTS[partId].slot === slot && (inventory[partId] ?? 0) > 0) loadout[slot] = partId;
    });
    return loadout;
  } catch {
    return DEFAULT_LOADOUT;
  }
}

export default function Home(): ReactElement {
  const [screen, setScreen] = useState<Screen>("command");
  const [selectedMission, setSelectedMission] = useState(MISSIONS[0].id);
  const [loadout, setLoadout] = useState<MachineLoadout>({ ...DEFAULT_LOADOUT });
  const [inventory, setInventory] = useState<PartInventory>({ ...DEFAULT_PART_INVENTORY });
  const [skin, setSkin] = useState<SkinId>("carbon");
  const [credits, setCredits] = useState(600);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [loadoutOpen, setLoadoutOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("earthfall-credits");
    const restoredInventory = restoreInventory(window.localStorage.getItem(PARTS_STORAGE_KEY));
    const restoredLoadout = restoreLoadout(window.localStorage.getItem(LOADOUT_STORAGE_KEY), restoredInventory);
    const frame = window.requestAnimationFrame(() => {
      if (saved) setCredits(Number(saved) || 600);
      setInventory(restoredInventory);
      setLoadout(restoredLoadout);
    });
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
      setInventory((current) => {
        const next = { ...current };
        missionResult.parts.forEach((partId) => {
          next[partId] = (next[partId] ?? 0) + 1;
        });
        window.localStorage.setItem(PARTS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
    setScreen("debrief");
  };

  const changePart = (slot: PartSlot, partId: PartId): void => {
    if (MACHINE_PARTS[partId].slot !== slot || (inventory[partId] ?? 0) <= 0) return;
    setLoadout((current) => {
      const next = { ...current, [slot]: partId };
      window.localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  if (screen === "mission" && mission.mapId) {
    return <MissionStage mission={{ ...mission, mapId: mission.mapId }} loadout={loadout} skin={skin} onEnd={finishMission} onAbort={() => setScreen("command")} />;
  }

  if (screen === "debrief" && result) {
    return <DebriefScreen result={result} onReturn={() => { setScreen("command"); setResult(null); }} />;
  }

  return (
    <CommandScreen
      mission={mission}
      selectedMission={selectedMission}
      credits={credits}
      loadout={loadout}
      inventory={inventory}
      skin={skin}
      loadoutOpen={loadoutOpen}
      briefingOpen={briefing}
      onMissionSelect={setSelectedMission}
      onLoadoutOpen={() => setLoadoutOpen(true)}
      onLoadoutClose={() => setLoadoutOpen(false)}
      onBriefingOpen={() => setBriefing(true)}
      onBriefingClose={() => setBriefing(false)}
      onPartChange={changePart}
      onSkinChange={setSkin}
      onDeploy={() => { setBriefing(false); setScreen("mission"); }}
    />
  );
}
