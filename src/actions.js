// Acciones reales del sitio (antes simuladas en el prototipo): sesion, reportes, FA, trades,
// sala del draft, archivo de temporadas y mecanica de escape.
import { supabase, rpc } from "./supabase.js"
import { renderAdmin } from "./admin.js"

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))
export const toast = m => { const t = document.getElementById("toast"); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3600) }
const STATUS = { setup: "Pretemporada", draft: "Draft", regular: "Fase regular", playoffs: "Playoffs", finished: "Finalizada" }

let P
export const can = perm => !!P && (P.PERMS.includes("all") || P.PERMS.includes(perm))
const team = i => P.TEAMS[i]
const myTeam = () => P.ME >= 0 ? P.TEAMS[P.ME] : null
const roster = i => (P.PROFILES[i] || [])[5] || []

export function modal(html, cc) {
  const d = document.getElementById("drawer")
  d.innerHTML = `<div class="panel" role="dialog" aria-modal="true" style="--cc:${cc || "var(--volt)"}"><button type="button" class="close" data-x>Cerrar</button>${html}</div>`
  d.hidden = false
  d.onclick = e => { if (e.target === d || e.target.closest("[data-x]")) close() }
  const close = () => { d.hidden = true; d.innerHTML = ""; d.onclick = null }
  return { el: d.querySelector(".panel"), close }
}

// ---------------- sesion ----------------
function renderLogin(mode = "in") {
  const el = document.getElementById("page-login")
  if (P.USER && mode !== "recovery") {
    el.innerHTML = `<section class="block"><div class="wrap login-box card-a"><h3>Sesion iniciada</h3><p>${esc(P.USER.email)}</p>
      <p class="hint">${P.ME >= 0 ? `Tu equipo: <b>${esc(myTeam().n)}</b>` : "Tu cuenta aun no esta ligada a un equipo en esta temporada. Pidele al admin que te asigne."}</p>
      <div class="acts"><a class="btn" href="#${P.ME >= 0 ? "mi-equipo" : "home"}">Continuar</a><button class="btn ghost" id="lgOut">Salir</button></div></div></section>`
    el.querySelector("#lgOut").onclick = logout
    return
  }
  const titles = { in: "Entrar", up: "Crear cuenta", reset: "Recuperar contrasena", recovery: "Nueva contrasena" }
  el.innerHTML = `<section class="block"><div class="wrap login-box card-a">
    <h3>${titles[mode]}</h3>
    <form id="lgForm" class="fgrid" style="grid-template-columns:1fr">
      ${mode !== "recovery" ? `<label class="fld"><span>Correo</span><input type="email" name="email" required autocomplete="email"></label>` : ""}
      ${mode !== "reset" ? `<label class="fld"><span>Contrasena</span><input type="password" name="pw" required minlength="6" autocomplete="${mode === "in" ? "current-password" : "new-password"}"></label>` : ""}
      <div class="acts"><button class="btn" type="submit">${titles[mode]}</button></div>
      <p id="lgMsg"></p>
    </form>
    <div class="acts">
      ${mode !== "in" ? `<button class="btn ghost sm" data-m="in">Ya tengo cuenta</button>` : `<button class="btn ghost sm" data-m="up">Crear cuenta</button><button class="btn ghost sm" data-m="reset">Olvide mi contrasena</button>`}
    </div></div></section>`
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => renderLogin(b.dataset.m))
  const msg = el.querySelector("#lgMsg")
  el.querySelector("#lgForm").onsubmit = async e => {
    e.preventDefault()
    const f = new FormData(e.target), email = f.get("email"), pw = f.get("pw")
    msg.className = ""; msg.textContent = "Un momento…"
    let r
    if (mode === "in") r = await supabase.auth.signInWithPassword({ email, password: pw })
    if (mode === "up") r = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } })
    if (mode === "reset") r = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/#login" })
    if (mode === "recovery") r = await supabase.auth.updateUser({ password: pw })
    if (r.error) { msg.className = "msg-err"; msg.textContent = r.error.message; return }
    msg.className = "msg-ok"
    if (mode === "in") { msg.textContent = "Listo, entrando…"; location.hash = "#home"; location.reload() }
    if (mode === "up") msg.textContent = "Cuenta creada. Revisa tu correo para confirmarla y avisale al admin para que te ligue a tu equipo."
    if (mode === "reset") msg.textContent = "Te mandamos un correo con el enlace para cambiar tu contrasena."
    if (mode === "recovery") { msg.textContent = "Contrasena actualizada."; setTimeout(() => location.replace("/"), 900) }
  }
}
async function logout() { await supabase.auth.signOut(); location.hash = "#home"; location.reload() }

// ---------------- Matches: series por jugar + reporte ----------------
function pendingCard(p) {
  const A = team(p.a), B = team(p.b)
  const ok = !P.IS_ARCHIVE && (can("results.approve") || ((p.a === P.ME || p.b === P.ME) && can("team.play")))
  const when = p.at ? new Date(p.at).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Por jugar"
  return `<article class="mc pend ${p.a === P.ME || p.b === P.ME ? "mine" : ""}" style="--c:${P.CONF[p.c].v}">
    <div class="side">${window.__crest(A)}<a class="nm" href="#team-${slugT(A)}"><span class="full">${esc(A.n)}</span><span class="short">#${esc(A.ab)}</span></a></div>
    <div class="side">${window.__crest(B)}<a class="nm" href="#team-${slugT(B)}"><span class="full">${esc(B.n)}</span><span class="short">#${esc(B.ab)}</span></a></div>
    <div class="pend-row"><span class="label">${esc(when)}</span>${p.reported ? `<span class="pill warn">Reporte en revision</span>` : ok ? `<button type="button" class="btn sm" data-report="${p.id}">Reportar resultado</button>` : ""}</div></article>`
}
const slugT = t => t.n.toLowerCase().replace(/\s+/g, "-")

function openReport(matchId) {
  const p = P.PENDING.find(x => x.id === matchId); if (!p) return
  const A = team(p.a), B = team(p.b), BO = P.RULES.best_of || 3
  const sideTbl = (ti, key) => {
    const mons = roster(ti).map(r => r[0])
    return `<div class="rp-side" style="--c:${P.CONF[team(ti).c].v}"><h4>${esc(team(ti).n)}</h4>
      <table class="rp-tbl"><thead><tr><th>Pokemon</th>${Array.from({ length: BO }, (_, g) => `<th colspan="3">Juego ${g + 1}</th>`).join("")}</tr>
      <tr><th></th>${Array.from({ length: BO }, () => `<th title="Jugo">✓</th><th title="KOs">K</th><th title="Faints">D</th>`).join("")}</tr></thead>
      <tbody>${mons.map(n => `<tr><td>${esc(n)}</td>${Array.from({ length: BO }, (_, g) =>
        `<td><input type="checkbox" data-s="${key}" data-n="${esc(n)}" data-g="${g}" data-f="in"></td><td><input type="number" min="0" max="6" value="0" data-s="${key}" data-n="${esc(n)}" data-g="${g}" data-f="k"></td><td><input type="number" min="0" max="1" value="0" data-s="${key}" data-n="${esc(n)}" data-g="${g}" data-f="d"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`
  }
  const m = modal(`<div class="label">Semana ${p.w} · Reportar serie</div><h2>${esc(A.n)} vs ${esc(B.n)}</h2>
    <div class="rp-grid">
      <div class="card-a"><h3>Juegos</h3><div class="fgrid">${Array.from({ length: BO }, (_, g) => `
        <label class="fld"><span>Ganador juego ${g + 1}</span><select data-gw="${g}"><option value="">${g < 2 ? "Elige" : "No se jugo"}</option><option value="teamA">${esc(A.n)}</option><option value="teamB">${esc(B.n)}</option></select></label>
        <label class="fld"><span>Replay juego ${g + 1}</span><input type="url" data-gr="${g}" placeholder="https://youtu.be/..."></label>`).join("")}</div></div>
      ${sideTbl(p.a, "a")}${sideTbl(p.b, "b")}
      <p class="hint" style="color:var(--mute)">Marca ✓ en cada juego en que salio el Pokemon y anota sus KOs (K) y si cayo (D). Los faints cuentan para la regla de escape${P.RULES.faint_limit ? ` (limite: ${P.RULES.faint_limit})` : ""}.</p>
      <div class="acts"><button class="btn" id="rpSend">Enviar reporte</button><span id="rpMsg"></span></div>
    </div>`, P.CONF[A.c].v)
  const el = m.el
  el.querySelectorAll('input[data-f="k"],input[data-f="d"]').forEach(i => i.addEventListener("input", () => {
    const c = el.querySelector(`input[data-f="in"][data-s="${i.dataset.s}"][data-n="${CSS.escape(i.dataset.n)}"][data-g="${i.dataset.g}"]`)
    if (c && +i.value > 0) c.checked = true
  }))
  el.querySelector("#rpSend").onclick = async () => {
    const msg = el.querySelector("#rpMsg")
    const games = []
    for (let g = 0; g < BO; g++) {
      const w = el.querySelector(`[data-gw="${g}"]`).value, r = el.querySelector(`[data-gr="${g}"]`).value.trim()
      if (w) { if (!r) { msg.className = "msg-err"; msg.textContent = `Falta el replay del juego ${g + 1}`; return } games.push({ winner: w, replay: r }) }
    }
    const need = Math.ceil(BO / 2), wa = games.filter(x => x.winner === "teamA").length, wb = games.filter(x => x.winner === "teamB").length
    if (wa !== need && wb !== need) { msg.className = "msg-err"; msg.textContent = `Un equipo debe ganar ${need} juegos`; return }
    const side = key => {
      const by = {}
      el.querySelectorAll(`input[data-f="in"][data-s="${key}"]`).forEach(c => {
        if (!c.checked) return
        const n = c.dataset.n, g = +c.dataset.g
        if (g >= games.length) return
        const k = +el.querySelector(`input[data-f="k"][data-s="${key}"][data-n="${CSS.escape(n)}"][data-g="${g}"]`).value || 0
        const d = +el.querySelector(`input[data-f="d"][data-s="${key}"][data-n="${CSS.escape(n)}"][data-g="${g}"]`).value || 0
        ;(by[n] = by[n] || []).push({ game: g + 1, kills: k, deaths: Math.min(1, d) })
      })
      return Object.entries(by).map(([name, gs]) => ({ name, games: gs }))
    }
    try {
      msg.className = ""; msg.textContent = "Enviando…"
      await rpc("submit_report", { p_match_id: p.id, p_games: games, p_team_a_data: side("a"), p_team_b_data: side("b"), p_winner: wa === need ? "teamA" : "teamB" })
      m.close(); toast("Reporte enviado. El admin lo revisa y lo aprueba.")
    } catch (e) { msg.className = "msg-err"; msg.textContent = e.message }
  }
}

// ---------------- Free agency ----------------
function requestFA(name) {
  if (P.IS_ARCHIVE) return toast("Esta temporada ya termino.")
  if (P.ME < 0) { location.hash = "#login"; return toast("Inicia sesion con tu cuenta de trainer.") }
  const mine = roster(P.ME), cost = P.COPIES[name]?.next ?? P.POINTS[name] ?? 0
  const used = mine.reduce((s, r) => s + r[1], 0)
  const m = modal(`<div class="label">Free agency · waivers</div><h2>Fichar a ${esc(name)}</h2>
    <p>Cuesta <b>${cost} pts</b>${(P.COPIES[name]?.taken || 0) > 0 ? ` (copia ${P.COPIES[name].taken + 1} de ${P.COPIES[name].max}, con sobrecosto)` : ""}. Usas ${used}/${P.RULES.max_points} pts y tienes ${mine.length}/${P.RULES.roster_size} Pokemon.</p>
    <div class="card-a"><h3>¿A quien sueltas?</h3><p class="hint">Opcional si tienes lugar y puntos.</p>
    <div class="fgrid">${mine.map(r => `<label class="fld chk"><input type="checkbox" value="${esc(r[0])}"><span>${esc(r[0])} · ${r[1]} pts</span></label>`).join("") || "<p>Roster vacio</p>"}</div></div>
    <div class="acts"><button class="btn" id="faGo">Enviar solicitud</button><span id="faMsg"></span></div>`)
  m.el.querySelector("#faGo").onclick = async () => {
    const give = [...m.el.querySelectorAll("input[type=checkbox]:checked")].map(c => c.value)
    const msg = m.el.querySelector("#faMsg")
    try { await rpc("request_free_agent", { p_team_id: myTeam().id, p_give: give, p_receive: [name] }); m.close(); toast("Solicitud enviada. Se resuelve por orden de waivers.") }
    catch (e) { msg.className = "msg-err"; msg.textContent = e.message }
  }
}

// ---------------- Mi equipo: trades, faints, escapes ----------------
async function mineExtras() {
  const host = document.querySelector("#page-mi-equipo .s-body"); if (!host || P.ME < 0) return
  const me = myTeam()
  const sec = document.createElement("section")
  sec.id = "mineLive"
  host.prepend(sec)
  const [faintsQ] = await Promise.all([supabase.rpc("roster_faints", { p_season: P.SEASON.id })])
  const faints = (faintsQ.data || []).filter(f => f.team_id === me.id).sort((a, b) => b.faints - a.faints)
  const lim = P.RULES.faint_limit
  const tx = P.TX.filter(t => t.status === "pending_player" && t.team_b === me.id)
  const minePend = P.TX.filter(t => ["pending_player", "pending_admin"].includes(t.status) && t.team_a === me.id)
  const tn = id => P.TEAMS.find(t => t.id === id)?.n || "?"
  const myEsc = P.ESCAPES.filter(e => e.team_id === me.id)
  const hist = P.TX.filter(t => (t.team_a === me.id || t.team_b === me.id) && ["approved", "rejected", "cancelled"].includes(t.status)).slice(0, 6)
  sec.innerHTML = `<div class="sec-head"><div><div class="label">${esc(STATUS[P.SEASON.status] || "")}</div><h2>Tu <em>mercado</em></h2></div>
      ${P.IS_ARCHIVE ? "" : `<button class="btn" id="tdNew">⇄ Proponer trade</button>`}</div>
    <div class="m-cards">
      <div class="m-card"><span class="label">Trades que te ofrecen</span>${tx.length ? tx.map(t => `<div class="q-item"><header><b>${esc(tn(t.team_a))}</b><span class="pill warn">Pendiente</span></header>
        <div class="mons">Te da: ${esc((t.give || []).join(", "))}</div><div class="mons">Pide: ${esc((t.receive || []).join(", "))}</div>
        <div class="acts"><button class="btn sm" data-acc="${t.id}">Aceptar</button><button class="btn ghost sm" data-dec="${t.id}">Rechazar</button></div></div>`).join("") : "<p>Nada por ahora.</p>"}</div>
      <div class="m-card"><span class="label">Tus solicitudes</span>${minePend.length ? minePend.map(t => `<div class="q-item"><header><b>${t.type === "trade" ? "Trade con " + esc(tn(t.team_b)) : "Free agency"}</b><span class="pill">${t.status === "pending_player" ? "Espera al otro trainer" : "Espera al admin"}</span></header>
        <div class="mons">Das: ${esc((t.give || []).join(", ") || "—")} · Recibes: ${esc((t.receive || []).join(", ") || "—")}</div>
        ${(t.type === "trade" && t.status === "pending_player") || (t.type === "free_agent" && t.status === "pending_admin") ? `<div class="acts"><button class="btn ghost sm" data-can="${t.id}">Retirar</button></div>` : ""}</div>`).join("") : "<p>No tienes solicitudes abiertas.</p>"}
        ${hist.length ? `<div class="label" style="margin-top:14px">Ultimos movimientos</div>${hist.map(t => `<div class="mons" style="margin-top:6px"><span class="pill ${t.status === "approved" ? "ok" : t.status === "rejected" ? "bad" : ""}">${{ approved: "Aprobado", rejected: "Rechazado", cancelled: "Retirado" }[t.status] || t.status}</span>
          ${t.type === "escape" ? "Escape" : t.type === "trade" ? "Trade" : "FA"}: ${esc((t.receive || []).join(", ") || "—")}${(t.give || []).length ? " por " + esc(t.give.join(", ")) : ""}${t.note ? ` · <i>${esc(t.note)}</i>` : ""}</div>`).join("")}` : ""}</div>
      <div class="m-card" style="--c:var(--rojo)"><span class="label">Faints · regla de escape</span>
        ${lim ? `<p>Con <b>${lim} faints</b> un Pokemon se escapa y vuelve a waivers.${P.RULES.starters_per_team ? " Los starters no se escapan." : ""}</p><div class="risk">${faints.map(f => `<div class="r ${!f.is_starter && f.faints >= lim - 1 ? "hot" : ""}"><span style="min-width:120px">${esc(f.pokemon_name)}${f.is_starter ? ' <span class="pill ok">Starter</span>' : ""}</span><span class="bar"><i style="width:${f.is_starter ? 0 : Math.min(100, f.faints / lim * 100)}%"></i></span><b class="num">${f.is_starter ? "—" : f.faints + "/" + lim}</b></div>`).join("") || "<p>Sin faints todavia.</p>"}</div>`
        : "<p>La regla de escape no esta activa en esta temporada.</p>"}
        ${myEsc.length ? `<p class="hint" style="margin-top:10px">Se escaparon: ${myEsc.map(e => esc(e.pokemon?.name)).join(", ")}</p>` : ""}</div>
      ${P.RULES.starters_per_team ? `<div class="m-card" style="--c:var(--volt)"><span class="label">Starters · ${P.RULES.starters_per_team} por equipo</span>
        <p>Tu starter no se escapa aunque junte faints.${["setup", "draft"].includes(P.SEASON.status) ? " Puedes cambiarlo hasta que empiece la fase regular." : " Ya no se puede cambiar (solo el admin)."}</p>
        <div class="risk">${roster(P.ME).map(r => `<div class="r"><span style="min-width:140px">${esc(r[0])}</span>${r[9] ? '<span class="pill ok">Starter</span>' : ""}
          ${["setup", "draft"].includes(P.SEASON.status) || can("market.approve") ? `<button class="btn ${r[9] ? "ghost" : ""} sm" data-st="${r[8]}" data-on="${r[9] ? 0 : 1}" style="margin-left:auto">${r[9] ? "Quitar" : "Hacer starter"}</button>` : ""}</div>`).join("") || "<p>Tu roster esta vacio.</p>"}</div></div>` : ""}
    </div>`
  sec.onclick = async e => {
    const b = e.target.closest("button"); if (!b) return
    try {
      if (b.dataset.acc) { await rpc("accept_trade", { p_transaction_id: b.dataset.acc }); toast("Trade aceptado: ahora lo revisa el admin."); location.reload() }
      if (b.dataset.dec) { await rpc("decline_trade", { p_transaction_id: b.dataset.dec }); toast("Trade rechazado."); location.reload() }
      if (b.dataset.can) { await rpc("cancel_trade", { p_transaction_id: b.dataset.can }); toast("Solicitud retirada."); location.reload() }
      if (b.id === "tdNew") openTrade()
      if (b.dataset.st) { await rpc("set_starter", { p_roster_id: b.dataset.st, p_on: b.dataset.on === "1" }); toast("Starter actualizado."); location.reload() }
    } catch (err) { toast(err.message) }
  }
}

function openTrade() {
  const opts = P.TEAMS.map((t, i) => [t, i]).filter(([, i]) => i !== P.ME)
  const m = modal(`<div class="label">Trade · diferencia maxima ${P.RULES.trade_max_diff} pts</div><h2>Proponer trade</h2>
    <label class="fld"><span>Con</span><select id="tdTeam">${opts.map(([t, i]) => `<option value="${i}">${esc(t.n)}</option>`).join("")}</select></label>
    <div class="fgrid" style="margin-top:14px;grid-template-columns:1fr 1fr">
      <div class="card-a"><h3>Das</h3><div id="tdGive">${roster(P.ME).map(r => `<label class="fld chk"><input type="checkbox" value="${esc(r[0])}" data-p="${r[1]}"><span>${esc(r[0])} · ${r[1]}</span></label>`).join("")}</div></div>
      <div class="card-a"><h3>Recibes</h3><div id="tdRecv"></div></div></div>
    <div class="acts"><b id="tdBal"></b><button class="btn" id="tdGo">Enviar propuesta</button><span id="tdMsg"></span></div>`)
  const el = m.el, sel = el.querySelector("#tdTeam")
  const fill = () => { el.querySelector("#tdRecv").innerHTML = roster(+sel.value).map(r => `<label class="fld chk"><input type="checkbox" value="${esc(r[0])}" data-p="${r[1]}"><span>${esc(r[0])} · ${r[1]}</span></label>`).join(""); bal() }
  const sum = id => [...el.querySelectorAll(`#${id} input:checked`)].reduce((s, c) => s + +c.dataset.p, 0)
  const bal = () => { const d = sum("tdGive") - sum("tdRecv"); el.querySelector("#tdBal").textContent = `Diferencia: ${d > 0 ? "+" : ""}${d} pts` }
  sel.onchange = fill; el.addEventListener("change", e => { if (e.target.type === "checkbox") bal() }); fill()
  el.querySelector("#tdGo").onclick = async () => {
    const give = [...el.querySelectorAll("#tdGive input:checked")].map(c => c.value), recv = [...el.querySelectorAll("#tdRecv input:checked")].map(c => c.value)
    const msg = el.querySelector("#tdMsg")
    if (!give.length || !recv.length) { msg.className = "msg-err"; msg.textContent = "Elige al menos un Pokemon de cada lado"; return }
    try { await rpc("request_trade", { p_team_a: myTeam().id, p_team_b: team(+sel.value).id, p_give: give, p_receive: recv }); m.close(); toast("Propuesta enviada."); location.reload() }
    catch (e) { msg.className = "msg-err"; msg.textContent = e.message }
  }
}

function minePage() {
  document.getElementById("page-mi-equipo").innerHTML = `<section class="block"><div class="wrap login-box card-a">
    <h3>Mi equipo</h3><p>${P.USER ? "Tu cuenta aun no esta ligada a un equipo en esta temporada. Pidele al admin que te asigne." : "Entra con tu cuenta de trainer para ver tu panel, reportar series y pedir fichajes."}</p>
    <div class="acts">${P.USER ? "" : `<a class="btn" href="#login">Entrar</a>`}</div></div></section>`
}

// ---------------- Temporadas (archivo) ----------------
async function seasonsPage() {
  const el = document.getElementById("page-temporadas")
  const ids = P.SEASONS.map(s => s.champion_team_id).filter(Boolean)
  const { data: champs } = ids.length ? await supabase.from("teams").select("id,name,logo").in("id", ids) : { data: [] }
  const list = P.SEASONS.filter(s => s.status !== "setup" || s.is_active || can("season.manage"))
  el.innerHTML = `<section class="t-hero"><div class="wrap"><div class="label">Historia de la liga</div><h1 style="font-family:var(--f-display);font-weight:900;text-transform:uppercase;font-size:clamp(2.6rem,7vw,5rem);line-height:.9;margin:.2em 0">Temporadas</h1>
    <p style="color:var(--mute);max-width:620px">Cada temporada guarda sus standings, series, rosters, draft y playoffs. Elige una para verla tal como quedo.</p></div></section>
    <div class="wrap s-body"><div class="ss-grid">${list.map(s => {
      const ch = champs?.find(c => c.id === s.champion_team_id)
      return `<a class="ss-card ${s.id === P.SEASON.id ? "cur" : ""}" href="${s.is_active ? "/" : "/?t=" + s.number}#home">
        <span class="label">${esc(STATUS[s.status] || "")}${s.is_active ? " · actual" : ""}</span>
        <span class="num">T${s.number}</span><strong>${esc(s.subtitle || s.name || "")}</strong>
        <span style="color:var(--mute)">${ch ? "🏆 " + esc(ch.name) : s.is_active ? "En juego" : "Sin campeon registrado"}</span></a>`
    }).join("")}
    <div class="ss-card" style="--c:#555"><span class="label">Antes de la web</span><span class="num">T1–T3</span><strong>Temporadas 1 a 3</strong><span style="color:var(--mute)">Campeones en el H.O.F.</span></div>
    </div></div>`
}

// ---------------- Sala del draft ----------------
async function draftRoom() {
  const page = document.getElementById("page-draft"); if (!page || P.IS_ARCHIVE) return
  const host = page.querySelector(".s-body") || page
  let box = document.getElementById("drRoom")
  if (!box) { box = document.createElement("section"); box.id = "drRoom"; host.prepend(box) }
  const { data: ds } = await supabase.from("draft_state").select("*").eq("season_id", P.SEASON.id).maybeSingle()
  if (!ds || (!ds.is_active && !ds.is_finished)) { box.innerHTML = P.DRAFT_ORDER.length ? "" : `<div class="dr-room"><div class="label">Draft</div><h3 style="margin:.2em 0">El draft aun no empieza</h3><p style="color:var(--mute)">${esc(P.NEXT_EVENT?.label || "")}</p></div>`; return }
  if (ds.is_finished) { box.innerHTML = ""; return }
  const { data: picks } = await supabase.from("draft_picks").select("pokemon_id,team_id,points_paid,pokemon:pokemon_id(name)").eq("season_id", P.SEASON.id)
  const takenN = {}; (picks || []).forEach(p => { const n = p.pokemon?.name; takenN[n] = (takenN[n] || 0) + 1 })
  const cur = P.TEAMS.find(t => t.id === ds.current_team_id)
  const myTurn = cur && ((cur.id === myTeam()?.id && can("team.play")) || can("draft.manage"))
  const curPicks = (picks || []).filter(p => p.team_id === ds.current_team_id)
  const myPicks = curPicks.map(p => p.pokemon?.name)
  const used = curPicks.reduce((s, p) => s + (p.points_paid ?? P.POINTS[p.pokemon?.name] ?? 0), 0), left = P.RULES.max_points - used
  const costOf = n => (P.POINTS[n] ?? 0) + (P.COPIES[n]?.surcharge || 0) * (takenN[n] || 0)
  const free = P.POOL.filter(p => (takenN[p[0]] || 0) < (P.COPIES[p[0]]?.max || 1) && !myPicks.includes(p[0]))
  box.innerHTML = `<div class="dr-room"><div class="now">${cur ? window.__crest(cur) : ""}<div><div class="label">Ronda ${ds.current_round} · Pick #${ds.current_pick}${ds.is_paused ? " · PAUSADO" : ""}</div>
      <h3 style="margin:.1em 0;font-family:var(--f-display);text-transform:uppercase;font-size:1.8rem">Turno de ${esc(cur?.n || "?")}</h3>
      <span style="color:var(--mute)">${used}/${P.RULES.max_points} pts usados · ${myPicks.length}/${P.RULES.roster_size} Pokemon</span></div>
      <div class="timer" id="drTimer">--</div></div>
    ${myTurn && !ds.is_paused ? `<input class="inp" id="drQ" placeholder="Buscar Pokemon libre…" style="margin-top:12px">
      <div class="pick-list" id="drList">${free.map(p => `<button type="button" data-pk="${esc(p[0])}" ${costOf(p[0]) > left ? "disabled" : ""}>${p[3] ? `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/${p[3]}.png" alt="">` : P.SPRITE[p[0]] ? `<img src="${P.SPRITE[p[0]]}" alt="">` : ""}<span>${esc(p[0])}<br><small>${costOf(p[0])} pts${(P.COPIES[p[0]]?.max || 1) > 1 ? ` · copia ${(takenN[p[0]] || 0) + 1}/${P.COPIES[p[0]].max}` : ""}</small></span></button>`).join("")}</div>
      ${cur.id === myTeam()?.id ? `<div class="acts"><button class="btn ghost sm" id="drPass">Pasar turno</button></div>` : ""}` : ""}
  </div>`
  const q = box.querySelector("#drQ")
  if (q) q.oninput = () => box.querySelectorAll("#drList button").forEach(b => { b.hidden = !b.dataset.pk.toLowerCase().includes(q.value.toLowerCase()) })
  box.onclick = async e => {
    const b = e.target.closest("[data-pk]"), pass = e.target.closest("#drPass")
    try {
      if (b) {
        if (!confirm(`¿Elegir a ${b.dataset.pk}?`)) return
        await rpc("make_draft_pick", { p_team_id: cur.id, p_pokemon_id: P.MON_ID[b.dataset.pk] }); location.reload()
      }
      if (pass) { await rpc("pass_draft_pick", { p_team_id: cur.id }); location.reload() }
    } catch (err) { toast(err.message) }
  }
  const secs = P.RULES.draft_pick_seconds || 30
  clearInterval(draftRoom.t)
  draftRoom.t = setInterval(async () => {
    const el = document.getElementById("drTimer"); if (!el) return
    const left = Math.max(0, secs - Math.floor((Date.now() - new Date(ds.turn_started_at)) / 1000))
    el.textContent = ds.is_paused ? "II" : left + "s"
    if (left === 0 && !ds.is_paused && !draftRoom.fired) { draftRoom.fired = true; try { await rpc("force_auto_pick", {}) } catch (e) { } location.reload() }
  }, 1000)
  // tiempo real: si alguien elige, se recarga
  if (!draftRoom.ch) draftRoom.ch = supabase.channel("draft-s" + P.SEASON.number)
    .on("postgres_changes", { event: "*", schema: "public", table: "draft_state", filter: `season_id=eq.${P.SEASON.id}` }, () => location.reload()).subscribe()
}

// ---------------- Mi equipo: tarjetas de la semana ----------------
function nextSeries() {
  const mine = P.PENDING.filter(p => p.a === P.ME || p.b === P.ME).sort((x, y) => x.w - y.w)[0]
  if (!mine) return P.PENDING.length || P.RAW_MATCHES.length
    ? `<h3>Sin series pendientes</h3><p>Ya jugaste todas tus series programadas.</p>`
    : `<h3>Calendario por publicar</h3><p>Cuando el admin publique el calendario, aqui aparecen tu rival y la semana.</p>`
  const o = team(mine.a === P.ME ? mine.b : mine.a)
  return `<h3>Semana ${mine.w} vs ${esc(o.n)}</h3><p>${mine.reported ? `<span class="pill warn">Reporte en revision del admin</span>` : `<button type="button" class="btn sm" data-report="${mine.id}">Reportar resultado</button>`} <a class="btn ghost sm" href="#h2h-${P.ME}-${P.TEAMS.indexOf(o)}">Scouting</a></p>`
}
function pendingSummary() {
  const me = myTeam(); if (!me) return "<h3>—</h3>"
  const open = P.TX.filter(t => (t.team_a === me.id || t.team_b === me.id) && ["pending_player", "pending_admin"].includes(t.status)).length
  const inbox = P.TX.filter(t => t.team_b === me.id && t.status === "pending_player").length
  return open ? `<h3>${open} movimiento(s) abiertos</h3><p>${inbox ? `${inbox} trade(s) esperan tu respuesta. ` : ""}Revisalos en "Tu mercado".</p>` : `<h3>Nada por ahora</h3><p>No tienes trades ni fichajes pendientes.</p>`
}

// ---------------- pronosticos y apodos (Supabase) ----------------
async function savePick(matchId, pick) {
  if (!P.USER) { location.hash = "#login"; throw new Error("Inicia sesion para hacer pronosticos.") }
  await rpc("save_prediction", { p_match: matchId, p_pick: pick })
}
async function saveNick(name, nick) {
  const me = myTeam(); if (!me) return
  const q = nick
    ? supabase.from("pokemon_nicknames").upsert({ season_id: P.SEASON.id, team_id: me.id, pokemon_name: name, nickname: nick, updated_at: new Date().toISOString() }, { onConflict: "season_id,team_id,pokemon_name" })
    : supabase.from("pokemon_nicknames").delete().eq("season_id", P.SEASON.id).eq("team_id", me.id).eq("pokemon_name", name)
  const { error } = await q
  if (error) toast("No se pudo guardar el apodo: " + error.message)
}

// ---------------- noticias del CM en el inicio ----------------
function renderPosts() {
  if (!P.POSTS.length) return
  const home = document.getElementById("page-home"); if (!home) return
  const anchor = home.querySelector("section.block"); if (!anchor) return
  const sec = document.createElement("section")
  sec.className = "block"; sec.id = "homeNews"
  sec.innerHTML = `<div class="wrap"><div class="sec-head"><div><div class="label">De la liga</div><h2>Ultimas <em>noticias</em></h2></div></div>
    <div class="news-g">${P.POSTS.slice(0, 6).map(p => `<article class="news ${p.pinned ? "pin" : ""}">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : ""}
      <div class="nb"><span class="label">${p.pinned ? "Fijado · " : ""}${new Date(p.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span><h3>${esc(p.title)}</h3>${p.body ? `<p>${esc(p.body)}</p>` : ""}${p.link_url ? `<a class="link" href="${esc(p.link_url)}" target="_blank" rel="noopener">Ver mas</a>` : ""}</div></article>`).join("")}</div></div>`
  anchor.before(sec)
}

// ---------------- instalacion ----------------
export function installHooks(ppv) {
  P = ppv
  P.hooks = {
    logout, requestFA, pendingCard, nextSeries, pendingSummary, savePick, saveNick, recovery: () => renderLogin("recovery"),
    pages: {
      login: () => renderLogin(), mine: minePage, temporadas: seasonsPage,
      admin: () => renderAdmin(P, { modal, toast, esc })
    }
  }
}

export function afterApp(ppv) {
  P = ppv
  document.addEventListener("click", e => { const b = e.target.closest("[data-report]"); if (b) openReport(b.dataset.report) })
  safeRun(mineExtras); safeRun(draftRoom); safeRun(renderPosts)
  if (location.hash === "#login" || location.hash === "#admin" || location.hash === "#temporadas") window.PPV_ROUTE?.()
}
function safeRun(f) { Promise.resolve().then(f).catch(e => console.warn("[PPV]", e)) }
