export function renderMarkdown(text: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inlineFormat = (s: string): string =>
    s
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, m) => `<strong><em>${escapeHtml(m)}</em></strong>`)
      .replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${escapeHtml(m)}</strong>`)
      .replace(/\*(.+?)\*/g, (_, m) => `<em>${escapeHtml(m)}</em>`)
      .replace(/_(.+?)_/g, (_, m) => `<em>${escapeHtml(m)}</em>`)
      .replace(/`([^`]+)`/g, (_, m) => `<code class="bg-white/10 px-1 py-0.5 rounded text-[11px] font-mono text-cyan-300">${escapeHtml(m)}</code>`);

  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      const label = lang ? `<span class="text-[10px] text-slate-400 font-mono float-right">${escapeHtml(lang)}</span>` : "";
      out.push(`<pre class="bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 my-2 overflow-x-auto text-[11px] font-mono text-slate-200 leading-relaxed">${label}<code>${codeLines.join("\n")}</code></pre>`);
      continue;
    }

    if (/^# /.test(line)) {
      out.push(`<h1 class="text-base font-bold text-white mt-3 mb-1">${inlineFormat(line.slice(2).trim())}</h1>`);
      i++; continue;
    }
    if (/^## /.test(line)) {
      out.push(`<h2 class="text-sm font-semibold text-cyan-300 mt-3 mb-1">${inlineFormat(line.slice(3).trim())}</h2>`);
      i++; continue;
    }
    if (/^### /.test(line)) {
      out.push(`<h3 class="text-[13px] font-semibold text-slate-100 mt-2 mb-0.5">${inlineFormat(line.slice(4).trim())}</h3>`);
      i++; continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push(`<hr class="border-white/10 my-2" />`);
      i++; continue;
    }

    if (/^(\s*[-*+] )/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-*+] )/.test(lines[i])) {
        items.push(`<li class="ml-1">${inlineFormat(lines[i].replace(/^\s*[-*+] /, "").trim())}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc pl-4 space-y-0.5 my-1 text-slate-200">${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li class="ml-1">${inlineFormat(lines[i].replace(/^\d+\. /, "").trim())}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal pl-4 space-y-0.5 my-1 text-slate-200">${items.join("")}</ol>`);
      continue;
    }

    if (/^> /.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^> /.test(lines[i])) {
        inner.push(inlineFormat(lines[i].slice(2).trim()));
        i++;
      }
      out.push(`<blockquote class="border-l-2 border-cyan-500/50 pl-3 my-1 text-slate-300 italic">${inner.join(" ")}</blockquote>`);
      continue;
    }

    if (line.trim() === "") {
      i++; continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3} |```|[-*+] |\d+\. |> )/.test(lines[i])
    ) {
      paraLines.push(inlineFormat(lines[i]));
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p class="text-slate-200 leading-relaxed my-0.5">${paraLines.join(" ")}</p>`);
    }
  }

  return out.join("\n");
}
