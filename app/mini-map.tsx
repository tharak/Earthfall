import { memo } from "react";
import type { TacticalMapState } from "./game-types";
import type { RealMapData } from "./map-content";

const VIEW_RADIUS_METERS = 200;
const VIEW_SIZE = 200;

function mapPoint(xMeters: number, zMeters: number) {
  const scale = VIEW_SIZE / (VIEW_RADIUS_METERS * 2);
  return [VIEW_SIZE / 2 + xMeters * scale, VIEW_SIZE / 2 - zMeters * scale] as const;
}

function worldPoint(x: number, z: number) {
  return mapPoint(x, z);
}

function intersectsView(points: Array<[number, number]>) {
  return points.some(([x, z]) => Math.abs(x) <= VIEW_RADIUS_METERS && Math.abs(z) <= VIEW_RADIUS_METERS);
}

const MiniMapBase = memo(function MiniMapBase({ mapData }: { mapData: RealMapData }) {
  const buildings = mapData.buildings.filter((building) => intersectsView(building.footprint));
  const roads = mapData.roads.filter((road) => intersectsView(road.path));
  return (
    <>
      <g className="mini-map-grid">
        <path d="M100 0V200M0 100H200" />
        <circle cx="100" cy="100" r="50" />
      </g>
      <g className="mini-map-roads">
        {roads.map((road) => (
          <polyline
            key={road.id}
            points={road.path.map(([x, z]) => mapPoint(x, z).join(",")).join(" ")}
            style={{ strokeWidth: Math.max(0.55, road.width * 0.2) }}
          />
        ))}
      </g>
      <g className="mini-map-buildings">
        {buildings.map((building) => (
          <polygon
            key={building.id}
            className={building.name === mapData.metadata.centerLandmark ? "landmark" : undefined}
            points={building.footprint.map(([x, z]) => mapPoint(x, z).join(",")).join(" ")}
          />
        ))}
      </g>
      <g className="mini-map-landmark-area">
        {mapData.landmarks.map((landmark) => (
          <polygon
            key={landmark.id}
            points={landmark.footprint.map(([x, z]) => mapPoint(x, z).join(",")).join(" ")}
          />
        ))}
      </g>
      <g className="mini-map-landmark" transform="translate(100 100)">
        <circle r="5.5" />
        <path d="M0-7 4 0 0 7-4 0Z" />
      </g>
    </>
  );
});

export function MiniMap({ state, mapData }: { state: TacticalMapState; mapData: RealMapData }) {
  const [playerX, playerY] = worldPoint(state.player.x, state.player.z);
  const [extractX, extractY] = worldPoint(state.extraction.x, state.extraction.z);

  return (
    <aside className="mini-map" aria-label="Tactical minimap">
      <header><span>TACTICAL MAP</span><b>400 M</b></header>
      <svg viewBox="0 0 200 200" role="img" aria-label="Nearby streets, buildings, enemies, and objectives">
        <rect className="mini-map-background" width="200" height="200" />
        <MiniMapBase mapData={mapData} />
        <g className="mini-map-contacts">
          {state.pickups.map((pickup, index) => {
            const [x, y] = worldPoint(pickup.x, pickup.z);
            return <circle key={`${pickup.x}-${pickup.z}-${index}`} className="pickup" cx={x} cy={y} r="2.2" />;
          })}
          {state.enemies.map((enemy) => {
            const [x, y] = worldPoint(enemy.x, enemy.z);
            return enemy.kind === "sentry"
              ? <rect key={enemy.id} className="enemy sentry" x={x - 2.2} y={y - 2.2} width="4.4" height="4.4" />
              : <circle key={enemy.id} className="enemy hunter" cx={x} cy={y} r="2.3" />;
          })}
          <circle className={state.extraction.unlocked ? "extraction active" : "extraction"} cx={extractX} cy={extractY} r="4.2" />
          <path
            className="player"
            d="M0-6 4.5 5 0 3-4.5 5Z"
            transform={`translate(${playerX} ${playerY}) rotate(${180 + state.player.heading * (180 / Math.PI)})`}
          />
        </g>
      </svg>
      <footer><span>▲ N</span><span>● HOSTILE</span></footer>
    </aside>
  );
}
