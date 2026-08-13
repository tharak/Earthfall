import * as THREE from "three";
import type { OrbitCameraController } from "./orbit-camera";

const PREVENT_DEFAULT_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
]);

export class GameInput {
  readonly pointer = new THREE.Vector2(0.2, 0);
  private readonly keys = new Set<string>();
  private firing = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cameraController: OrbitCameraController,
    private readonly onReload: () => void,
  ) {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
  }

  isPressed(code: string) {
    return this.keys.has(code);
  }

  isFiring() {
    return this.firing || this.keys.has("Space");
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
    if (PREVENT_DEFAULT_KEYS.has(event.code)) event.preventDefault();
    if (event.code === "KeyR") this.onReload();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (this.cameraController.handlePointerMove(event)) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (event.button === 0) this.firing = true;
    this.cameraController.handlePointerDown(event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.firing = false;
    this.cameraController.handlePointerUp(event);
  };

  private handleContextMenu = (event: MouseEvent) => event.preventDefault();
}
