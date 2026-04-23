// Obsidian — True black, minimal, electric cyan accent
export function Obsidian() {
  const tabs = ["Overview","Research","Ontology","Players","Rules","Notes","Design Chat","Storyboard"];
  const active = "Notes";
  const rules = [
    { cat: "CORE LOOP", title: "Action Economy", body: "Each player takes 3 actions per turn from a hand of 6 action cards.", high: true },
    { cat: "COMBAT", title: "Attack Resolution", body: "Roll 2d6 + attack modifier vs defender's shield value.", high: false },
    { cat: "ECONOMY", title: "Resource Decay", body: "All resources decay by 10% at end of each round unless stored.", high: true },
  ];
  const notes = [
    { title: "Turn flow feels slow", body: "Consider letting players pre-commit actions before the round starts.", topic: "Mechanics" },
    { title: "Faction asymmetry", body: "Each faction needs a unique starting ability that sets the tone for their playstyle.", topic: "Player Exp" },
    { title: "Economy spiral", body: "Early resource advantage snowballs too hard — need a redistribution mechanic.", topic: "Balance" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000000", fontFamily: "'Inter', sans-serif", color: "#e2e8f0" }}>
      {/* Navbar */}
      <div style={{ background: "#0a0a0a", borderBottom: "1px solid #18181b" }} className="flex items-center gap-4 px-5 py-3">
        <div style={{ background: "#06b6d4", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14 }}>◈</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#fff", letterSpacing: "-0.01em" }}>Board Game Factory</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ border: "1px solid #27272a", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#52525b", fontFamily: "monospace" }}>⌘K</div>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000", fontWeight: 700 }}>M</div>
        </div>
      </div>

      {/* Project bar */}
      <div style={{ background: "#050505", borderBottom: "1px solid #18181b", padding: "7px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "#3f3f46", fontFamily: "monospace" }}>projects / </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", fontFamily: "monospace" }}>ironveil-chronicles</span>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#06b6d4", marginLeft: 4 }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <span style={{ fontSize: 11, border: "1px solid #06b6d430", borderRadius: 4, padding: "2px 8px", color: "#06b6d4", fontFamily: "monospace" }}>strategy</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#050505", borderBottom: "1px solid #18181b", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t} style={{
            padding: "9px 14px", fontSize: 12, fontWeight: t === active ? 500 : 400,
            color: t === active ? "#06b6d4" : "#52525b",
            borderBottom: t === active ? "1px solid #06b6d4" : "1px solid transparent",
            background: "transparent", whiteSpace: "nowrap", fontFamily: "monospace"
          }}>{t}</button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: "20px", display: "flex", gap: 20 }}>
        {/* Left — notes grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7", fontFamily: "monospace" }}>notes</span>
            <span style={{ fontSize: 10, border: "1px solid #27272a", borderRadius: 4, padding: "2px 6px", color: "#52525b", fontFamily: "monospace" }}>3</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button style={{ fontSize: 11, border: "1px solid #27272a", borderRadius: 5, padding: "4px 10px", color: "#71717a", fontFamily: "monospace", background: "transparent" }}>brainstorm</button>
              <button style={{ fontSize: 11, background: "#06b6d4", borderRadius: 5, padding: "4px 10px", color: "#000", fontWeight: 600, fontFamily: "monospace" }}>suggest changes</button>
            </div>
          </div>

          {/* Topic filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {["all","mechanics","player_exp","balance","theme"].map((t, i) => (
              <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, border: `1px solid ${i === 0 ? "#06b6d4" : "#27272a"}`, color: i === 0 ? "#06b6d4" : "#52525b", fontFamily: "monospace", cursor: "pointer" }}>{t}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {notes.map((n, i) => (
              <div key={i} style={{ background: "#0a0a0a", border: "1px solid #18181b", borderRadius: 8, padding: 12, position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#06b6d4", borderRadius: "8px 8px 0 0", opacity: 0.6 }} />
                <div style={{ fontWeight: 500, fontSize: 12, color: "#e4e4e7", marginBottom: 4, fontFamily: "monospace", marginTop: 4 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "#52525b", lineHeight: 1.5, marginBottom: 10 }}>{n.body}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #18181b", paddingTop: 8 }}>
                  <span style={{ fontSize: 9, border: "1px solid #27272a", borderRadius: 3, padding: "1px 5px", color: "#3f3f46", fontFamily: "monospace" }}>{n.topic}</span>
                  <div style={{ display: "flex", gap: 8, color: "#3f3f46", fontSize: 10 }}>
                    <span style={{ cursor: "pointer", fontFamily: "monospace" }}>~later</span>
                    <span style={{ cursor: "pointer", fontFamily: "monospace" }}>→board</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ border: "1px dashed #27272a", borderRadius: 8, padding: 12, display: "flex", alignItems: "center", gap: 6, color: "#3f3f46", fontSize: 11, fontFamily: "monospace" }}>
              + new_note
            </div>
          </div>
        </div>

        {/* Right — rules sidebar */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: "#52525b", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase", fontFamily: "monospace" }}>Rules</div>
          {rules.map((r, i) => (
            <div key={i} style={{ background: "#0a0a0a", border: "1px solid #18181b", borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: r.high ? "#06b6d4" : "#52525b", marginBottom: 3, fontFamily: "monospace" }}>{r.cat}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#d4d4d8", marginBottom: 3 }}>{r.title}</div>
              <div style={{ fontSize: 10, color: "#52525b", lineHeight: 1.4 }}>{r.body}</div>
            </div>
          ))}
          <div style={{ marginTop: 16, border: "1px solid #18181b", borderRadius: 6, padding: 10, background: "#06b6d408" }}>
            <div style={{ fontSize: 10, color: "#06b6d4", fontFamily: "monospace", marginBottom: 4 }}>// design_chat</div>
            <div style={{ fontSize: 11, color: "#52525b" }}>Ask the AI about your game design. It knows your rules, notes & entities.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
