"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";

export type GlobeLocation = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  status: "PLAYABLE" | "SCANNING";
};

type ProjectedLocation = GlobeLocation & {
  x: number;
  y: number;
  visible: boolean;
};

const LAND_MASSES: Array<Array<[number, number]>> = [
  [[-168, 69], [-145, 72], [-124, 55], [-105, 50], [-82, 25], [-97, 16], [-116, 31], [-130, 48], [-168, 58]],
  [[-82, 12], [-68, 10], [-50, 2], [-35, -9], [-48, -53], [-69, -56], [-78, -20]],
  [[-53, 60], [-27, 70], [-20, 82], [-47, 84], [-64, 73]],
  [[-12, 36], [-4, 58], [14, 71], [41, 68], [46, 48], [28, 36], [8, 42]],
  [[-18, 35], [8, 38], [34, 31], [51, 11], [42, -14], [24, -35], [4, -30], [-11, 4]],
  [[31, 69], [74, 76], [123, 72], [178, 60], [158, 39], [143, 20], [109, 3], [78, 9], [54, 25], [39, 43]],
  [[112, -11], [154, -12], [153, -39], [132, -44], [114, -31]],
  [[129, 32], [146, 44], [143, 28]],
  [[47, -13], [51, -26], [44, -24]],
];

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const ocean = context.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#153a4a");
  ocean.addColorStop(0.5, "#0b2938");
  ocean.addColorStop(1, "#061923");
  context.fillStyle = ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(106, 214, 225, 0.13)";
  context.lineWidth = 2;
  for (let longitude = -150; longitude <= 150; longitude += 30) {
    const x = ((longitude + 180) / 360) * canvas.width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = ((90 - latitude) / 180) * canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  for (const landMass of LAND_MASSES) {
    context.beginPath();
    landMass.forEach(([longitude, latitude], index) => {
      const x = ((longitude + 180) / 360) * canvas.width;
      const y = ((90 - latitude) / 180) * canvas.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = "#315d58";
    context.fill();
    context.strokeStyle = "rgba(145, 238, 218, 0.5)";
    context.lineWidth = 4;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function globePoint(latitude: number, longitude: number) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  );
}

export function EarthGlobe({
  locations,
  selectedId,
  onSelect,
}: {
  locations: GlobeLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const animationFrameRef = useRef(0);
  const rotationRef = useRef({ x: THREE.MathUtils.degToRad(-10), y: THREE.MathUtils.degToRad(47) });
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0 });
  const [projected, setProjected] = useState<ProjectedLocation[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.z = 3.45;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "earth-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.prepend(renderer.domElement);

    const texture = createEarthTexture();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xb9f1ee,
        roughness: 0.78,
        metalness: 0.04,
      }),
    );
    globe.rotation.order = "YXZ";
    globeRef.current = globe;
    scene.add(globe);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.035, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x6eeaff, transparent: true, opacity: 0.07, side: THREE.BackSide }),
    );
    scene.add(atmosphere);
    scene.add(new THREE.HemisphereLight(0xb8f6ff, 0x02080b, 2.2));
    const sun = new THREE.DirectionalLight(0xe7ffff, 3.7);
    sun.position.set(-2.8, 2.6, 4.2);
    scene.add(sun);

    let resizeFrame = 0;
    let renderedWidth = 0;
    let renderedHeight = 0;
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const nextWidth = Math.round(width);
      const nextHeight = Math.round(height);
      if (nextWidth === renderedWidth && nextHeight === renderedHeight) return;
      renderedWidth = nextWidth;
      renderedHeight = nextHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      drawRef.current();
    };
    const draw = () => {
      const rotation = rotationRef.current;
      globe.rotation.x = rotation.x;
      globe.rotation.y = rotation.y;
      atmosphere.rotation.copy(globe.rotation);
      renderer.render(scene, camera);
      const { width, height } = mount.getBoundingClientRect();
      const globeRotation = new THREE.Euler(rotation.x, rotation.y, 0, "YXZ");
      setProjected(locations.map((location) => {
        const point = globePoint(location.latitude, location.longitude).applyEuler(globeRotation);
        const visible = point.z > 0.08;
        const screenPoint = point.clone().multiplyScalar(1.02).project(camera);
        return {
          ...location,
          visible,
          x: (screenPoint.x * 0.5 + 0.5) * width,
          y: (-screenPoint.y * 0.5 + 0.5) * height,
        };
      }));
    };
    drawRef.current = draw;
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resize);
    });
    resizeObserver.observe(mount);
    resize();

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      texture?.dispose();
      globe.geometry.dispose();
      (globe.material as THREE.Material).dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      globeRef.current = null;
      drawRef.current = () => undefined;
    };
  }, [locations]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.moved = true;
    rotationRef.current.y += deltaX * 0.007;
    rotationRef.current.x = THREE.MathUtils.clamp(rotationRef.current.x + deltaY * 0.005, -0.75, 0.75);
    drag.x = event.clientX;
    drag.y = event.clientY;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = window.requestAnimationFrame(drawRef.current);
  };

  const stopDragging = () => {
    dragRef.current.active = false;
  };

  return (
    <div
      className="earth-interactive"
      ref={mountRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      aria-label="Rotatable Earth drop zone map. Drag to rotate, then select a location."
    >
      <div className="earth-halo" />
      {projected.map((location) => (
        <button
          key={location.id}
          className={`world-node ${selectedId === location.id ? "active" : ""} ${location.status === "SCANNING" ? "scanning" : ""}`}
          style={{ left: location.x, top: location.y, opacity: location.visible ? 1 : 0, pointerEvents: location.visible ? "auto" : "none" }}
          aria-label={`Select ${location.city} drop zone${location.status === "SCANNING" ? ", scanning" : ""}`}
          onClick={() => onSelect(location.id)}
        >
          <i />
          <span>{location.city}</span>
        </button>
      ))}
      <div className="rotate-hint"><i>↔</i><span>DRAG TO ROTATE EARTH</span></div>
    </div>
  );
}
