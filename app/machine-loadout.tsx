"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from "react";
import { MACHINE_PARTS, PLAYER_MOVE_SPEED, getMachineStats, type MachinePartConfig } from "./game-config";
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

type MachineSchematicProps = {
  activeSlot: PartSlot;
  loadout: MachineLoadout;
  onSlotChange: (slot: PartSlot) => void;
};

function MachineSchematic({ activeSlot, loadout, onSlotChange }: MachineSchematicProps): ReactElement {
  const selectWithKeyboard = (event: ReactKeyboardEvent<SVGGElement>, slot: PartSlot): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSlotChange(slot);
  };

  const regionProps = (slot: PartSlot) => ({
    className: `mech-region ${slot} ${activeSlot === slot ? "active" : ""}`,
    role: "tab" as const,
    tabIndex: 0,
    "aria-selected": activeSlot === slot,
    "aria-label": `${SLOT_LABELS[slot]}: ${MACHINE_PARTS[loadout[slot]].name}`,
    onClick: () => onSlotChange(slot),
    onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => selectWithKeyboard(event, slot),
  });

  return (
    <div className="machine-schematic">
      <div className="schematic-heading"><span>EF-MK01</span><b>ASSEMBLY FRAME</b></div>
      <svg viewBox="0 0 260 350" role="tablist" aria-label="Select a part directly on the machine">
        <g className="schematic-axis" aria-hidden="true">
          <path d="M130 18V332M36 174H224" />
          <circle cx="130" cy="174" r="112" />
          <circle cx="130" cy="174" r="75" />
        </g>

        <g {...regionProps("legs")}>
          <rect className="mech-hit-area" x="62" y="188" width="136" height="145" />
          <path className="mech-armor" d="M91 190 124 198l-4 61-18 56H70l18-61Z" />
          <path className="mech-armor" d="m136 198 33-8 3 64 18 61h-32l-18-56Z" />
          <path className="mech-panel" d="m89 218 28 5-5 31-26-4Zm54 5 28-5 3 32-26 4Z" />
          <path className="mech-foot" d="m70 315 32-1 14 17H64Zm88-1 32 1 6 16h-52Z" />
          <path className="mech-callout-line" d="M82 267H25" />
          <text className="mech-callout" x="21" y="263" textAnchor="end">04 LEGS</text>
        </g>

        <g {...regionProps("arms")}>
          <rect className="mech-hit-area" x="16" y="88" width="228" height="140" />
          <path className="mech-armor" d="m79 92-42 12-18 36 24 14 27-28 18-4Z" />
          <path className="mech-armor" d="m181 92 42 12 18 36-24 14-27-28-18-4Z" />
          <path className="mech-panel" d="m43 151 25-22 11 18-18 48-24-7Zm174 0-25-22-11 18 18 48 24-7Z" />
          <path className="mech-hand" d="m37 188 24 7-3 26-18 5-11-18Zm186 0-24 7 3 26 18 5 11-18Z" />
          <path className="mech-callout-line" d="M198 112h43" />
          <text className="mech-callout" x="245" y="108">02 ARMS</text>
        </g>

        <g {...regionProps("core")}>
          <rect className="mech-hit-area" x="82" y="75" width="96" height="143" />
          <path className="mech-armor" d="M86 94 106 78h48l20 16-10 91-34 22-34-22Z" />
          <path className="mech-panel" d="m96 106 34 14 34-14-6 40-28 19-28-19Z" />
          <path className="mech-reactor" d="m130 122 13 11-5 18h-16l-5-18Z" />
          <path className="mech-waist" d="m101 180 29 14 29-14-5 35h-48Z" />
          <path className="mech-callout-line" d="M100 145H25" />
          <text className="mech-callout" x="21" y="141" textAnchor="end">03 CORE</text>
        </g>

        <g {...regionProps("head")}>
          <rect className="mech-hit-area" x="102" y="7" width="56" height="90" />
          <path className="mech-neck" d="M116 77h28v18h-28Z" />
          <path className="mech-armor" d="m106 42 24-14 24 14-5 39-19 11-19-11Z" />
          <path className="mech-crest" d="m130 28 5-20 8 21-8 13Z" />
          <path className="mech-sensor" d="m113 53 17 5 17-5-3 12-14 5-14-5Z" />
          <path className="mech-callout-line" d="M150 52h91" />
          <text className="mech-callout" x="245" y="48">01 HEAD</text>
        </g>
      </svg>
      <div className="schematic-footer"><span>SELECT ARMOR REGION</span><b>{SLOT_LABELS[activeSlot]}</b></div>
    </div>
  );
}

export function MachinePartPicker({ loadout, inventory, onPartChange, compact = false }: MachinePartPickerProps): ReactElement {
  const [activeSlot, setActiveSlot] = useState<PartSlot>("arms");
  const options = PART_OPTIONS.filter(([, part]) => part.slot === activeSlot);
  const stats = getMachineStats(loadout);

  return (
    <div className={`machine-picker ${compact ? "compact" : ""}`}>
      <div className="assembly-workbench">
        <MachineSchematic activeSlot={activeSlot} loadout={loadout} onSlotChange={setActiveSlot} />
        <div className="part-browser">
          <header><span>{SLOT_LABELS[activeSlot]} COMPONENTS</span><strong>{MACHINE_PARTS[loadout[activeSlot]].name}</strong></header>
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
        </div>
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
