"use client";

import { useState, type ReactElement } from "react";
import { MACHINE_PARTS, PART_SLOTS, PLAYER_MOVE_SPEED, getMachineStats, type MachinePartConfig } from "./game-config";
import type { MachineLoadout, PartId, PartInventory, PartSlot } from "./game-types";

const SLOT_LABELS: Record<PartSlot, string> = {
  head: "HEAD",
  arms: "ARMS",
  core: "CORE",
  legs: "LEGS",
};

const PART_OPTIONS = Object.entries(MACHINE_PARTS) as Array<[PartId, MachinePartConfig]>;

type MachinePartPickerProps = {
  loadout: MachineLoadout;
  inventory: PartInventory;
  onPartChange: (slot: PartSlot, partId: PartId) => void;
  compact?: boolean;
};

function sourceLabel(source: MachinePartConfig["source"]): string {
  return source === "issued" ? "ISSUED" : `RECOVER FROM ${source.toUpperCase()}`;
}

export function MachinePartPicker({ loadout, inventory, onPartChange, compact = false }: MachinePartPickerProps): ReactElement {
  const [activeSlot, setActiveSlot] = useState<PartSlot>("arms");
  const options = PART_OPTIONS.filter(([, part]) => part.slot === activeSlot);
  const stats = getMachineStats(loadout);

  return (
    <div className={`machine-picker ${compact ? "compact" : ""}`}>
      <div className="part-slot-tabs" role="tablist" aria-label="Machine part slots">
        {PART_SLOTS.map((slot) => (
          <button
            key={slot}
            className={activeSlot === slot ? "active" : ""}
            role="tab"
            aria-selected={activeSlot === slot}
            onClick={() => setActiveSlot(slot)}
          >
            <small>{SLOT_LABELS[slot]}</small>
            <strong>{MACHINE_PARTS[loadout[slot]].name}</strong>
          </button>
        ))}
      </div>

      <div className="part-options" role="tabpanel" aria-label={`${SLOT_LABELS[activeSlot]} parts`}>
        {options.map(([partId, part]) => {
          const owned = (inventory[partId] ?? 0) > 0;
          const selected = loadout[activeSlot] === partId;
          return (
            <button
              key={partId}
              className={`part-card ${selected ? "selected" : ""}`}
              disabled={!owned}
              aria-pressed={selected}
              onClick={() => onPartChange(activeSlot, partId)}
            >
              <i className={`part-icon ${part.slot} ${part.source}`} aria-hidden="true" />
              <span>
                <small>{owned ? `${sourceLabel(part.source)} · OWNED ${inventory[partId] ?? 0}` : sourceLabel(part.source)}</small>
                <strong>{part.name}</strong>
                <em>{part.stat}</em>
                {!compact && <p>{part.description}</p>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="assembly-stats" aria-label="Equipped machine stats">
        <span>INTEGRITY<strong>{stats.maxHealth}</strong></span>
        <span>SPEED<strong>{Math.round((stats.moveSpeed / PLAYER_MOVE_SPEED) * 100)}%</strong></span>
        <span>DAMAGE<strong>{Math.round(stats.damageMultiplier * 100)}%</strong></span>
        <span>RANGE<strong>{Math.round(stats.rangeMultiplier * 100)}%</strong></span>
      </div>
    </div>
  );
}
