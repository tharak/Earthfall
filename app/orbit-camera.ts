import * as THREE from "three";

const ORBIT_DISTANCE_METERS = 24;
const DRAG_RADIANS_PER_PIXEL = 0.006;
const MIN_PITCH = 0.34;
const MAX_PITCH = 1.08;
const FOCUS_HEIGHT_METERS = 0.9;

export class OrbitCameraController {
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private yaw = 0;
  private pitch = 0.68;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    camera.position.set(0, 16, 118);
    camera.lookAt(0, FOCUS_HEIGHT_METERS, 97.5);
  }

  handlePointerMove(event: PointerEvent) {
    if (!this.dragging) return false;
    const deltaX = event.clientX - this.dragX;
    const deltaY = event.clientY - this.dragY;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
    this.yaw -= deltaX * DRAG_RADIANS_PER_PIXEL;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + deltaY * DRAG_RADIANS_PER_PIXEL,
      MIN_PITCH,
      MAX_PITCH,
    );
    return true;
  }

  handlePointerDown(event: PointerEvent) {
    if (event.button !== 2) return false;
    this.dragging = true;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
    this.canvas.setPointerCapture?.(event.pointerId);
    return true;
  }

  handlePointerUp(event: PointerEvent) {
    if (event.button !== 2) return false;
    this.dragging = false;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    return true;
  }

  update(dt: number, focus: THREE.Vector3, shake: number) {
    const horizontalDistance = Math.cos(this.pitch) * ORBIT_DISTANCE_METERS;
    const cameraHeight = Math.sin(this.pitch) * ORBIT_DISTANCE_METERS;
    const directionX = Math.sin(this.yaw);
    const directionZ = Math.cos(this.yaw);
    const target = new THREE.Vector3(
      focus.x + directionX * horizontalDistance,
      FOCUS_HEIGHT_METERS + cameraHeight,
      focus.z + directionZ * horizontalDistance,
    );
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 7));
    if (shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.5;
    }
    this.camera.lookAt(
      focus.x - directionX * 2.5,
      FOCUS_HEIGHT_METERS,
      focus.z - directionZ * 2.5,
    );
  }
}
