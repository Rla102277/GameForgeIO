// Forge — Warm Amber Craft: deep zinc-950 bg, amber/copper accents, heavier type
export function Forge() {
  const tabs = ["Overview","Research","Ontology","Players","Rules","Notes","Design Chat","Storyboard"];
  const active = "Notes";
  const rules = [
    { cat: "CORE LOOP", title: "Action Economy", body: "Each player takes 3 actions per turn from a hand of 6 action cards.", priority: "High" },
    { cat: "COMBAT", title: "Attack Resolution", body: "Roll 2d6 + attack modifier vs defender's shield value.", priority: "Medium" },
    { cat: "ECONOMY", title: "Resource Decay", body: "All resources decay by 10% at end of each round unless stored.", priority: "High" },
  ];
  const notes = [
    { color: "#78350f", label: "Core Loop", title: "Turn flow feels slow", body: "Consider letting players pre-commit actions before the round starts.", topic: "⚙️ Mechanics" },
    { color: "#1c1917", label: "Theme", title: "Faction asymmetry", body: "Each faction needs a unique starting ability that sets the tone for their playstyle.", topic: "🎮 Player Experience" },
    { color: "#431407", label: "Balance", title: "Economy spiral", body: "Early resource advantage snowballs too hard — need a redistribution mechanic.", topic: "⚖️ Balance" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f0e0c", fontFamily: "'Inter', sans-serif", color: "#e5e0d8" }}>
      {/* Navbar */}
      <div style={{ background: "#151210", borderBottom: "1px solid #3d2e1a" }} className="flex items-center gap-4 px-5 py-3">
        <div style={{ background: "#d97706", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16 }}>🎲</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#fbbf24", letterSpacing: "0.01em" }}>AI Board Game Factory</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#1f1a13", border: "1px solid #3d2e1a", borderRadius: 6, padding: "4px 12px", fontSize: 13, color: "#a8956d" }}>⌘K Search</div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#78350f", border: "2px solid #d97706", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>MK</div>
        </div>
      </div>

      {/* Project bar */}
      <div style={{ background: "#110f0c", borderBottom: "1px solid #2d2015", padding: "8px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "#6b5a3e" }}>Projects /</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24" }}>Ironveil Chronicles</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <span style={{ fontSize: 11, background: "#78350f30", border: "1px solid #92400e", borderRadius: 4, padding: "2px 8px", color: "#fcd34d" }}>strategy</span>
          <span style={{ fontSize: 11, background: "#1f2937", border: "1px solid #374151", borderRadius: 4, padding: "2px 8px", color: "#9ca3af" }}>3–5 players</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#110f0c", borderBottom: "1px solid #2d2015", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: t === active ? 600 : 400,
            color: t === active ? "#fbbf24" : "#7d6a4a",
            borderBottom: t === active ? "2px solid #d97706" : "2px solid transparent",
            background: "transparent", whiteSpace: "nowrap"
          }}>{t}</button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: "20px", display: "flex", gap: 20 }}>
        {/* Left — notes grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e5d5b0" }}>Design Notes</span>
            <span style={{ fontSize: 11, background: "#78350f30", border: "1px solid #92400e", borderRadius: 4, padding: "2px 6px", color: "#fcd34d" }}>3 notes</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button style={{ fontSize: 12, background: "#1f1a13", border: "1px solid #3d2e1a", borderRadius: 6, padding: "5px 12px", color: "#a8956d" }}>⚡ AI Brainstorm</button>
              <button style={{ fontSize: 12, background: "#d97706", borderRadius: 6, padding: "5px 12px", color: "#0f0e0c", fontWeight: 600 }}>✦ Suggest global changes</button>
            </div>
          </div>

          {/* Topic filter pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["All","⚙️ Mechanics","🎮 Player Exp","⚖️ Balance","📖 Theme"].map((t, i) => (
              <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${i === 0 ? "#d97706" : "#3d2e1a"}`, background: i === 0 ? "#78350f40" : "transparent", color: i === 0 ? "#fbbf24" : "#7d6a4a", cursor: "pointer" }}>{t}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {notes.map((n, i) => (
              <div key={i} style={{ background: n.color + "30", border: `1px solid ${n.color}60`, borderRadius: 12, padding: 14, position: "relative" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#e5d5b0", marginBottom: 4 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "#a8956d", lineHeight: 1.5, marginBottom: 10 }}>{n.body}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${n.color}40`, paddingTop: 8 }}>
                  <span style={{ fontSize: 10, background: n.color + "40", borderRadius: 4, padding: "2px 6px", color: "#fcd34d", border: `1px solid ${n.color}50` }}>{n.topic}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#6b5a3e", cursor: "pointer" }}>🕐</span>
                    <span style={{ fontSize: 10, color: "#6b5a3e", cursor: "pointer" }}>⬡</span>
                    <span style={{ fontSize: 10, color: "#6b5a3e", cursor: "pointer" }}>⇝</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Add note */}
            <div style={{ border: "1px dashed #3d2e1a", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 8, color: "#6b5a3e", fontSize: 13 }}>
              + New note
            </div>
          </div>
        </div>

        {/* Right — rules sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#a8956d", letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase" }}>Active Rules</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rules.map((r, i) => (
              <div key={i} style={{ background: "#1a1510", border: "1px solid #2d2015", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, color: r.priority === "High" ? "#f59e0b" : "#78716c", marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em" }}>{r.cat}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e5d5b0", marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#78614a", lineHeight: 1.5 }}>{r.body}</div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 10, background: r.priority === "High" ? "#78350f30" : "#1f2937", border: `1px solid ${r.priority === "High" ? "#92400e" : "#374151"}`, borderRadius: 4, padding: "2px 6px", color: r.priority === "High" ? "#fcd34d" : "#9ca3af" }}>{r.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
