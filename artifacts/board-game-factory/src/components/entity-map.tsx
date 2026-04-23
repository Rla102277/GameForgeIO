import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

type Entity = { id: number; name: string; type: string | null; description?: string | null };

const TYPE_COLOR: Record<string, { stroke: string; fill: string; text: string; label: string }> = {
  Item:     { stroke: "#3b82f6", fill: "#1e3a5f", text: "#93c5fd", label: "Items" },
  Faction:  { stroke: "#a855f7", fill: "#3b1f5e", text: "#d8b4fe", label: "Factions" },
  Location: { stroke: "#22c55e", fill: "#14391f", text: "#86efac", label: "Locations" },
  Event:    { stroke: "#f59e0b", fill: "#3d2a00", text: "#fcd34d", label: "Events" },
};

const DEFAULT_COLOR = { stroke: "#6b7280", fill: "#1f2937", text: "#9ca3af", label: "Other" };

// Detect connections: entity A mentions entity B by name in its description
function findConnections(entities: Entity[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < entities.length; i++) {
    const desc = entities[i].description?.toLowerCase() ?? "";
    for (let j = 0; j < entities.length; j++) {
      if (i === j) continue;
      if (desc.includes(entities[j].name.toLowerCase())) {
        pairs.push([entities[i].id, entities[j].id]);
      }
    }
  }
  return pairs;
}

// Layout: group by type in quadrants, position nodes
function computeLayout(entities: Entity[], width: number, height: number) {
  const types = ["Item", "Faction", "Location", "Event"];
  const groups: Record<string, Entity[]> = {};
  for (const e of entities) { const t = e.type ?? "Item"; (groups[t] = groups[t] ?? []).push(e); }

  const quadrants = [
    { x: width * 0.25, y: height * 0.28 },
    { x: width * 0.75, y: height * 0.28 },
    { x: width * 0.25, y: height * 0.72 },
    { x: width * 0.75, y: height * 0.72 },
  ];

  const positions: Record<number, { x: number; y: number }> = {};

  types.forEach((type, qi) => {
    const group = groups[type] ?? [];
    const { x: cx, y: cy } = quadrants[qi];
    const r = Math.min(Math.max(group.length * 14, 30), 100);
    group.forEach((e, i) => {
      const angle = (i / Math.max(group.length, 1)) * 2 * Math.PI - Math.PI / 2;
      positions[e.id] = {
        x: group.length === 1 ? cx : cx + Math.cos(angle) * r,
        y: group.length === 1 ? cy : cy + Math.sin(angle) * r,
      };
    });
  });

  return positions;
}

export default function EntityMap({ entities }: { entities: Entity[] }) {
  const W = 720, H = 420;

  const positions = useMemo(() => computeLayout(entities, W, H), [entities]);
  const connections = useMemo(() => findConnections(entities), [entities]);

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No entities yet. Add entities in the Ontology tab to see the relationship map.
      </div>
    );
  }

  const idMap: Record<number, Entity> = {};
  for (const e of entities) idMap[e.id] = e;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_COLOR).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.stroke }} />
            {c.label}
          </div>
        ))}
        {connections.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
            <div className="w-4 h-px border-t border-dashed border-muted-foreground/50" />
            Name referenced in description
          </div>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-background/50">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none">
          {/* Quadrant labels */}
          {[
            { x: W * 0.25, y: 16, type: "Item" },
            { x: W * 0.75, y: 16, type: "Faction" },
            { x: W * 0.25, y: H - 8, type: "Location" },
            { x: W * 0.75, y: H - 8, type: "Event" },
          ].map(q => (
            <text key={q.type} x={q.x} y={q.y} textAnchor="middle" fontSize="10"
              fill={TYPE_COLOR[q.type]?.stroke ?? "#6b7280"} fontFamily="monospace" opacity={0.6}>
              {q.type.toUpperCase()}S
            </text>
          ))}

          {/* Divider lines */}
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#1f2937" strokeWidth="1" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#1f2937" strokeWidth="1" />

          {/* Connections */}
          {connections.map(([fromId, toId], i) => {
            const from = positions[fromId];
            const to = positions[toId];
            if (!from || !to) return null;
            return (
              <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#4b5563" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            );
          })}

          {/* Nodes */}
          {entities.map(e => {
            const pos = positions[e.id];
            if (!pos) return null;
            const c = TYPE_COLOR[e.type ?? ""] ?? DEFAULT_COLOR;
            const r = 18;
            const shortName = e.name.length > 10 ? e.name.slice(0, 9) + "…" : e.name;
            return (
              <g key={e.id}>
                <circle cx={pos.x} cy={pos.y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="7.5" fill={c.text} fontFamily="sans-serif" fontWeight="600">
                  {shortName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {connections.length === 0 && entities.length > 1 && (
        <p className="text-xs text-muted-foreground/60 text-center">
          No connections detected. Mention other entity names in descriptions to show relationships.
        </p>
      )}
    </div>
  );
}
