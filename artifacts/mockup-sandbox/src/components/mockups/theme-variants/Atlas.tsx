// Atlas — Navy/indigo + gold, board game cartographer aesthetic
export function Atlas() {
  const tabs = ["Overview","Research","Ontology","Players","Rules","Notes","Design Chat","Storyboard"];
  const active = "Notes";
  const rules = [
    { cat: "Core Loop", title: "Action Economy", body: "Each player takes 3 actions per turn from a hand of 6 action cards.", tag: "Essential" },
    { cat: "Combat", title: "Attack Resolution", body: "Roll 2d6 + attack modifier vs defender's shield value.", tag: "Tactical" },
    { cat: "Economy", title: "Resource Decay", body: "All resources decay by 10% at end of each round.", tag: "Critical" },
  ];
  const notes = [
    { title: "Turn flow feels slow", body: "Consider letting players pre-commit actions before the round starts.", topic: "Mechanics", icon: "⚙" },
    { title: "Faction asymmetry", body: "Each faction needs a unique starting ability that sets the tone for their playstyle.", topic: "Player Experience", icon: "🎮" },
    { title: "Economy spiral", body: "Early resource advantage snowballs too hard — need a redistribution mechanic.", topic: "Balance", icon: "⚖" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d1117", fontFamily: "'Libre Baskerville', Georgia, serif", color: "#c9b896" }}>
      {/* Gold top accent */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #92400e, #f59e0b, #92400e)" }} />

      {/* Navbar */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2a3a" }} className="flex items-center gap-4 px-5 py-3">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 6, border: "2px solid #f59e0b", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e2a3a" }}>
            <span style={{ fontSize: 16 }}>⬡</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", letterSpacing: "0.02em" }}>AI Board Game Factory</div>
            <div style={{ fontSize: 10, color: "#4b6080", letterSpacing: "0.12em", textTransform: "uppercase" }}>Design Studio</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ border: "1px solid #1e2a3a", borderRadius: 5, padding: "4px 12px", fontSize: 12, color: "#4b6080", fontFamily: "monospace" }}>⌘ K — search</div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e2a3a", border: "2px solid #f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>M</div>
        </div>
      </div>

      {/* Project bar */}
      <div style={{ background: "#0b0f18", borderBottom: "1px solid #1e2a3a", padding: "8px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "#2e4158", textTransform: "uppercase", letterSpacing: "0.1em" }}>Library</span>
        <span style={{ color: "#2e4158" }}>›</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>Ironveil Chronicles</span>
        <div style={{ width: 1, height: 14, background: "#1e2a3a", margin: "0 6px" }} />
        <span style={{ fontSize: 11, color: "#4b6080", fontStyle: "italic" }}>Strategy · 3–5 Players · 90–120 min</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["📊 8 rules","👥 4 players","📝 3 notes"].map((t) => (
            <span key={t} style={{ fontSize: 11, border: "1px solid #1e2a3a", borderRadius: 4, padding: "2px 8px", color: "#4b6080" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#0b0f18", borderBottom: "1px solid #1e2a3a", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} style={{
            padding: "10px 16px", fontSize: 12,
            fontWeight: t === active ? 600 : 400,
            color: t === active ? "#f59e0b" : "#4b6080",
            borderBottom: t === active ? "2px solid #f59e0b" : "2px solid transparent",
            background: t === active ? "#f59e0b0a" : "transparent",
            whiteSpace: "nowrap", letterSpacing: "0.02em"
          }}>{t}</button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: "20px", display: "flex", gap: 20 }}>
        {/* Left */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#d4b483", letterSpacing: "0.01em" }}>Design Notes</div>
              <div style={{ fontSize: 11, color: "#4b6080", marginTop: 1 }}>Capture ideas · organize by topic · send to storyboard</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button style={{ fontSize: 12, border: "1px solid #1e2a3a", borderRadius: 5, padding: "5px 12px", color: "#4b6080", background: "transparent" }}>✦ Brainstorm</button>
              <button style={{ fontSize: 12, background: "linear-gradient(135deg, #92400e, #b45309)", borderRadius: 5, padding: "5px 12px", color: "#fef3c7", fontWeight: 600 }}>⬡ Global Changes</button>
            </div>
          </div>

          {/* Topic pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[{l:"All",active:true},{l:"⚙ Mechanics",active:false},{l:"🎮 Player Exp",active:false},{l:"⚖ Balance",active:false},{l:"📖 Theme",active:false}].map(({l, active}, i) => (
              <span key={l} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${active ? "#f59e0b80" : "#1e2a3a"}`, background: active ? "#f59e0b12" : "transparent", color: active ? "#f59e0b" : "#4b6080", cursor: "pointer", fontStyle: active ? "normal" : "italic" }}>{l}</span>
            ))}
          </div>

          {/* Notes grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {notes.map((n, i) => (
              <div key={i} style={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 12, padding: 14, position: "relative", borderLeft: "3px solid #f59e0b40" }}>
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 16, opacity: 0.3 }}>{n.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#d4b483", marginBottom: 5 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "#6b7e94", lineHeight: 1.6, marginBottom: 12 }}>{n.body}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1e2a3a", paddingTop: 8 }}>
                  <span style={{ fontSize: 10, background: "#f59e0b14", border: "1px solid #f59e0b30", borderRadius: 4, padding: "2px 7px", color: "#f59e0b", fontStyle: "italic" }}>{n.topic}</span>
                  <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#2e4158" }}>
                    <span style={{ cursor: "pointer" }} title="Look at later">🕐</span>
                    <span style={{ cursor: "pointer" }} title="Send to storyboard">⬡</span>
                    <span style={{ cursor: "pointer" }} title="Suggest rule changes">⇝</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ border: "1px dashed #1e2a3a", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 8, color: "#2e4158", fontSize: 13, fontStyle: "italic", cursor: "pointer" }}>
              + New note…
            </div>
          </div>
        </div>

        {/* Right — rules sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4b6080", letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>Active Rulebook</div>
          {rules.map((r, i) => (
            <div key={i} style={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 10, padding: 12, marginBottom: 10, borderLeft: "2px solid #f59e0b60" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#f59e0b80", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>{r.cat}</span>
                <span style={{ fontSize: 9, border: "1px solid #1e2a3a", borderRadius: 3, padding: "1px 5px", color: "#4b6080" }}>{r.tag}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c9b896", marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "#4b6080", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>{r.body}</div>
            </div>
          ))}
          {/* Design chat preview */}
          <div style={{ marginTop: 4, background: "#0f1923", border: "1px solid #f59e0b30", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>✦ Design Chat</div>
            <div style={{ fontSize: 11, color: "#4b6080", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>Ask your AI design partner anything about this game. It knows your full rulebook and notes.</div>
            <div style={{ marginTop: 8, border: "1px solid #1e2a3a", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#2e4158", fontStyle: "italic" }}>What's missing from my economy rules?…</div>
          </div>
        </div>
      </div>
    </div>
  );
}
