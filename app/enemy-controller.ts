import type { EnemyController, EnemyIntent, EnemyObservation } from "./game-types";

export class RuleBasedEnemyController implements EnemyController {
  decide(observation: EnemyObservation): EnemyIntent {
    const shouldAttack = observation.lineOfSight && observation.distance <= observation.attackRange;
    if (shouldAttack) return { moveX: 0, moveZ: 0, attack: true };

    const inverseDistance = observation.distance > 0 ? 1 / observation.distance : 0;
    let moveX = observation.toPlayerX * inverseDistance;
    let moveZ = observation.toPlayerZ * inverseDistance;
    if (observation.kind === "sentry") {
      const strafe = Math.sin(observation.elapsedMs * 0.0008 + observation.phase) * 0.45;
      const originalX = moveX;
      moveX = moveX * Math.cos(strafe) - moveZ * Math.sin(strafe);
      moveZ = originalX * Math.sin(strafe) + moveZ * Math.cos(strafe);
    }
    return { moveX, moveZ, attack: false };
  }
}
