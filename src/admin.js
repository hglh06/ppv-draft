// Panel de administrador: temporadas, reglas, conferencias, equipos, pool, draft, calendario y aprobaciones.
// Edita la temporada que se esta viendo (cambia de temporada con el selector de la barra).
import { supabase, fetchAll, rpc } from "./supabase.js"

const STATUS = [["setup", "Pretemporada"], ["draft", "Draft"], ["regular", "Fase regular"], ["playoffs", "Playoffs"], ["finished", "Finalizada"]]
const RULE_FIELDS = [
  ["max_teams", "Equipos (cupo)", "text"], ["roster_size", "Pokemon por roster", "number"], ["max_points", "Presupuesto de puntos", "number"],
  ["points_win", "Puntos por serie ganada", "number"], ["points_loss", "Puntos por serie perdida", "number"], ["best_of", "Serie al mejor de", "number"],
  ["playoff_teams", "Equipos a playoffs", "number"], ["max_fa", "Movimientos de FA por equipo", "number"], ["trade_max_diff", "Diferencia max. en trades (pts)", "number"],
  ["draft_pick_seconds", "Segundos por pick", "number"], ["regular_weeks", "Semanas de fase regular", "number"]
]
let tab = (() => { try { return sessionStorage.getItem("ppvAdmTab") } catch (e) { return null } })()
// catalogo de permisos (lo que puede ver y editar cada rol)
export const PERMS = [
  ["all", "Acceso total", "Todo lo de abajo, incluso roles"],
  ["admin.access", "Entrar al panel", "Ver el panel de administrador"],
  ["season.manage", "Temporadas y equipos", "Crear y activar temporadas, reglas, conferencias, equipos y cuentas"],
  ["pool.manage", "Pool y precios", "Que Pokemon estan disponibles, cuanto valen y sus copias"],
  ["draft.manage", "Draft y calendario", "Orden, iniciar, pausar, deshacer, autopick, exportar y calendario"],
  ["results.approve", "Resultados", "Aprobar o rechazar reportes de series"],
  ["market.approve", "Mercado", "Aprobar fichajes y trades; asignar starters fuera de tiempo"],
  ["roles.manage", "Roles y usuarios", "Crear roles, elegir sus permisos y asignarlos a cada cuenta"],
  ["content.manage", "Contenido", "Publicar noticias e imagenes en el inicio"],
  ["media.access", "Kit de redes", "Pagina Media con las imagenes de la semana"],
  ["team.play", "Jugar con su equipo", "Draft, reportar series, fichajes, trades, starters y apodos"],
  ["predictions.play", "Pronosticos", "Hacer pronosticos de cada serie"]
]

// ---------- calendario: generadores por formato ----------
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
// round robin (metodo del circulo); con "weeks" mayor a n-1 se repite con local y visita invertidos
function roundRobin(ids, weeks) {
  let t = shuffle(ids); if (t.length % 2) t.push(null)
  const n = t.length, rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]) }
    rounds.push(pairs); t = [t[0], t[n - 1], ...t.slice(1, n - 1)]
  }
  const W = weeks || rounds.length, out = []
  for (let w = 0; w < W; w++) { const base = rounds[w % rounds.length], flip = Math.floor(w / rounds.length) % 2; out.push(base.map(([a, b]) => flip ? [b, a] : [a, b])) }
  return out
}
// bombos: cada jornada es un emparejamiento completo; nadie repite rival y cada equipo
// juega mas o menos lo mismo contra cada bombo (exacto si las jornadas se dividen entre los bombos)
function potsSchedule(teams, pots, weeks) {
  const ids = teams.map(t => t.team_id), potOf = Object.fromEntries(teams.map(t => [t.team_id, t.pot]))
  if (ids.some(id => !potOf[id])) throw new Error("Hay equipos sin bombo asignado (Conferencias y equipos)")
  const cap = Math.ceil(weeks / pots), BYE = "__bye__"
  const list = ids.length % 2 ? [...ids, BYE] : ids
  for (let attempt = 0; attempt < 400; attempt++) {
    const played = new Set(), cnt = {}; ids.forEach(id => { cnt[id] = {} })
    const key = (a, b) => a < b ? a + "|" + b : b + "|" + a
    const ok = (a, b) => {
      if (played.has(key(a, b))) return false
      if (a === BYE || b === BYE) return true
      return (cnt[a][potOf[b]] || 0) < cap && (cnt[b][potOf[a]] || 0) < cap
    }
    const out = []; let failed = false
    for (let w = 0; w < weeks && !failed; w++) {
      let steps = 0
      const solve = (left, acc) => {
        if (++steps > 20000) return null
        if (!left.length) return acc
        const [a, ...rest] = left
        for (const b of shuffle(rest)) {
          if (!ok(a, b)) continue
          const r = solve(rest.filter(x => x !== b), [...acc, [a, b]]); if (r) return r
        }
        return null
      }
      const pairs = solve(shuffle(list), [])
      if (!pairs) { failed = true; break }
      pairs.forEach(([a, b]) => { played.add(key(a, b)); if (a !== BYE && b !== BYE) { cnt[a][potOf[b]] = (cnt[a][potOf[b]] || 0) + 1; cnt[b][potOf[a]] = (cnt[b][potOf[a]] || 0) + 1 } })
      out.push(pairs.filter(([a, b]) => a !== BYE && b !== BYE))
    }
    if (!failed) return out
  }
  throw new Error("No se encontro un calendario valido con esos bombos y jornadas. Prueba con otro numero de jornadas o revisa los bombos.")
}
function buildSchedule(fmt, st, settings) {
  const plan = [], push = (rounds, conf) => rounds.forEach((pairs, w) => pairs.forEach(([a, b]) => plan.push({ week: w + 1, a, b, conference_id: conf || null })))
  const W = settings.regular_weeks || null
  if (fmt === "conferences") {
    const byC = {}; st.filter(x => x.conference_id).forEach(x => { (byC[x.conference_id] = byC[x.conference_id] || []).push(x.team_id) })
    if (!Object.keys(byC).length) throw new Error("No hay equipos asignados a conferencias")
    Object.entries(byC).forEach(([c, ids]) => { if (ids.length > 1) push(roundRobin(ids, W || ids.length - (ids.length % 2 ? 0 : 1)), c) })
  } else if (fmt === "table") {
    const ids = st.map(x => x.team_id); if (ids.length < 2) throw new Error("Faltan equipos")
    push(roundRobin(ids, W || ids.length - (ids.length % 2 ? 0 : 1)))
  } else {
    if (!W) throw new Error('Define las jornadas en "Semanas de fase regular"')
    push(potsSchedule(st, settings.pots_count || 3, W))
  }
  return plan
}

export async function renderAdmin(P, ui) {
  const { esc, toast, modal } = ui
  const el = document.getElementById("page-admin")
  const can = x => P.PERMS.includes("all") || P.PERMS.includes(x)
  const TAB_PERM = { pend: ["results.approve", "market.approve"], season: ["season.manage"], rules: ["season.manage"], teams: ["season.manage"], pool: ["pool.manage"], draft: ["draft.manage"], roles: ["roles.manage"], content: ["content.manage"], cards: ["season.manage"] }
  const allowed = Object.keys(TAB_PERM).filter(k => TAB_PERM[k].some(can))
  if (!allowed.length) { el.innerHTML = `<section class="block"><div class="wrap login-box card-a"><h3>Sin acceso</h3><p>${P.USER ? "Tu rol no tiene permisos de administracion." : "Entra con tu cuenta."}</p>${P.USER ? "" : '<a class="btn" href="#login">Entrar</a>'}</div></section>`; return }
  if (!tab || !allowed.includes(tab)) tab = allowed[0]
  const S = P.SEASON, sid = S.id
  el.innerHTML = `<section class="t-hero"><div class="wrap"><div class="label">Administrador</div><h1 style="font-family:var(--f-display);font-weight:900;text-transform:uppercase;font-size:clamp(2.4rem,6vw,4.4rem);line-height:.9;margin:.2em 0">Temporada ${S.number}</h1>
    <div class="acts"><span style="color:var(--mute)">Estas editando:</span><select class="inp" id="admSeason" style="max-width:260px">${(P.SEASONS || []).map(s => `<option value="${s.number}" ${s.id === S.id ? "selected" : ""}>Temporada ${s.number}${s.is_active ? " · activa" : ""}</option>`).join("")}</select></div></div></section>
    <div class="wrap s-body"><div class="adm"><div class="adm-tabs" id="admTabs"></div><div id="admBody"><p>Cargando…</p></div></div></div>`

  el.querySelector("#admSeason").onchange = e => { const s = (P.SEASONS || []).find(x => String(x.number) === e.target.value); location.href = (s?.is_active ? "/" : "/?t=" + e.target.value) + "#admin" }
  const [settingsQ, confsQ, teamsQ, stQ, profQ, orderQ, repQ, txQ, wQ, dsQ, seasonsQ, rolesQ, rosQ, waitQ, postsQ] = await Promise.all([
    supabase.from("league_settings").select("*").eq("season_id", sid).maybeSingle(),
    supabase.from("conferences").select("*").eq("season_id", sid).order("sort"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("season_teams").select("*").eq("season_id", sid),
    supabase.from("profiles").select("id,email,role,role_id,display_name").order("email"),
    supabase.from("draft_order").select("*").eq("season_id", sid).order("draft_position"),
    supabase.from("reports").select("*, match:match_id(id,week,stage,round,team_a,team_b,season_id)").eq("status", "pending").order("created_at"),
    supabase.from("transactions").select("*").eq("status", "pending_admin").order("created_at"),
    supabase.from("waiver_order").select("*").eq("season_id", sid),
    supabase.from("draft_state").select("*").eq("season_id", sid).maybeSingle(),
    supabase.from("seasons").select("*").order("number"),
    supabase.from("roles").select("*").order("created_at"),
    supabase.from("rosters").select("team_id,points_paid").eq("season_id", sid),
    supabase.from("transactions").select("*").eq("status", "pending_player").eq("season_id", sid).order("created_at"),
    supabase.from("posts").select("*").order("created_at", { ascending: false })
  ])
  // los datos de la temporada se leen frescos de la BD (no de la copia cargada al abrir el sitio)
  Object.assign(S, (seasonsQ.data || []).find(x => x.id === sid) || {})
  // tras guardar algo que se ve en todo el sitio, se recarga la pagina para aplicarlo de inmediato
  const refreshSite = msg => { toast(msg + " Aplicando…"); try { sessionStorage.setItem("ppvAdmTab", tab) } catch (e) { } setTimeout(() => location.reload(), 600) }
  const settings = settingsQ.data || {}, confs = confsQ.data || [], teams = teamsQ.data || [], st = stQ.data || []
  const profiles = profQ.data || [], seasons = seasonsQ.data || [], roles = rolesQ.data || [], posts = postsQ.data || []
  const reports = (repQ.data || []).filter(r => (r.match?.season_id || r.season_id) === sid)
  const txs = (txQ.data || []).filter(t => (t.season_id || sid) === sid)
  const wpos = Object.fromEntries((wQ.data || []).map(w => [w.team_id, w.position]))
  const faUsed = Object.fromEntries((wQ.data || []).map(w => [w.team_id, w.fa_used || 0]))
  const tPts = {}, tCnt = {}; (rosQ.data || []).forEach(r => { tPts[r.team_id] = (tPts[r.team_id] || 0) + (r.points_paid || 0); tCnt[r.team_id] = (tCnt[r.team_id] || 0) + 1 })
  const waiting = waitQ.data || []
  const teamState = id => `${tPts[id] || 0}/${settings.max_points ?? "?"} pts · ${tCnt[id] || 0}/${settings.roster_size ?? "?"} Pokemon · FA ${faUsed[id] ?? 0}/${settings.max_fa ?? "?"}`
  const tname = id => st.find(x => x.team_id === id)?.display_name || teams.find(t => t.id === id)?.name || "?"
  const fail = e => toast(e.message || String(e))
  const reload = () => renderAdmin(P, ui)

  const TABS = [["pend", "Pendientes", reports.length + txs.length], ["season", "Temporada"], ["rules", "Reglas y puntos"], ["teams", "Conferencias y equipos"], ["pool", "Pool y precios"], ["draft", "Draft y calendario"], ["cards", "Tarjetas"], ["roles", "Roles y usuarios"], ["content", "Contenido"]].filter(([k]) => allowed.includes(k))
  const tabs = el.querySelector("#admTabs")
  tabs.innerHTML = TABS.map(([k, l, n]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${l}${n ? `<span class="bdg">${n}</span>` : ""}</button>`).join("")
  tabs.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; try { sessionStorage.setItem("ppvAdmTab", tab) } catch (e) { } tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw() }
  const body = el.querySelector("#admBody")

  function draw() {
    ({ pend, season, rules, teams: teamsTab, pool, draft, roles: rolesTab, content, cards: cardsTab })[tab]()
  }

  // ---------- pendientes ----------
  function pend() {
    const fa = txs.filter(t => t.type === "free_agent"), tr = txs.filter(t => t.type === "trade")
    const byMon = {}; fa.forEach(t => { const k = (t.receive || [])[0] || "—"; (byMon[k] = byMon[k] || []).push(t) })
    Object.values(byMon).forEach(l => l.sort((a, b) => (wpos[a.team_a] ?? 99) - (wpos[b.team_a] ?? 99) || new Date(a.created_at) - new Date(b.created_at)))
    // los Pokemon se resuelven en el orden de la mejor prioridad de waivers que los pide
    const groups = Object.entries(byMon).sort((a, b) => (wpos[a[1][0].team_a] ?? 99) - (wpos[b[1][0].team_a] ?? 99))
    const side = (arr) => (arr || []).map(m => `${esc(m.name)} (${m.games.map(g => `J${g.game}: ${g.kills}K/${g.deaths}D`).join(", ")})`).join(" · ") || "—"
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Reportes de series (${reports.length})</h3>${reports.map(r => {
        const m = r.match || {}, games = (r.games || []).map((g, i) => `J${i + 1}: ${g.winner === "teamA" ? esc(tname(m.team_a)) : esc(tname(m.team_b))}${g.replay ? ` <a href="${esc(g.replay)}" target="_blank" rel="noopener">replay</a>` : ""}`).join(" · ")
        return `<div class="q-item"><header><span class="pill">${m.stage === "playoff" ? esc(m.round) : "Semana " + m.week}</span><b>${esc(tname(m.team_a))} vs ${esc(tname(m.team_b))}</b><span class="pill ok">Gana ${esc(r.winner === "teamA" ? tname(m.team_a) : tname(m.team_b))}</span></header>
          <div>${games}</div><div class="mons"><b>${esc(tname(m.team_a))}:</b> ${side(r.team_a_data)}</div><div class="mons"><b>${esc(tname(m.team_b))}:</b> ${side(r.team_b_data)}</div>
          <div class="acts"><button class="btn sm" data-ar="${r.id}">Aprobar</button><button class="btn ghost sm" data-rr="${r.id}">Rechazar</button></div></div>`
      }).join("") || "<p>No hay reportes pendientes.</p>"}</div>
      <div class="card-a"><h3>Waivers · free agency (${fa.length})</h3>
        <p class="hint">Resuelve de arriba hacia abajo. En cada Pokemon, la primera solicitud es la de mayor prioridad: al aprobarla, el equipo pasa al final del orden y las solicitudes que ya no se puedan cumplir se rechazan solas. Al aprobar se revisan otra vez puntos, roster y FA.</p>
        <div class="acts" style="margin:0 0 12px"><span class="label">Orden actual:</span>${Object.entries(wpos).sort((a, b) => a[1] - b[1]).map(([id, p]) => `<span class="pill">#${p} ${esc(tname(id))}</span>`).join(" ") || '<span class="pill">Sin orden (se crea al exportar el draft)</span>'}</div>
        ${groups.map(([mon, l], gi) => `<div class="q-item"><header><span class="pill warn">${gi + 1}</span><b>${esc(mon)}</b><span class="pill">${l.length} solicitud(es)</span></header>
        ${l.map((t, k) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;${k ? "opacity:.75" : ""}"><span class="pill ${k ? "" : "ok"}">Waiver #${wpos[t.team_a] ?? "?"}</span><b>${esc(tname(t.team_a))}</b>
          <span class="mons">suelta: ${esc((t.give || []).join(", ") || "nadie")} · ${teamState(t.team_a)}</span>
          <button class="btn sm" data-at="${t.id}">Aprobar</button><button class="btn ghost sm" data-rt="${t.id}">Rechazar</button></div>`).join("")}</div>`).join("") || "<p>No hay solicitudes.</p>"}</div>
      <div class="card-a"><h3>Trades (${tr.length})</h3>${tr.map(t => `<div class="q-item"><header><b>${esc(tname(t.team_a))} ⇄ ${esc(tname(t.team_b))}</b></header>
        <div class="mons">${esc(tname(t.team_a))} da: ${esc((t.give || []).join(", "))}</div><div class="mons">${esc(tname(t.team_b))} da: ${esc((t.receive || []).join(", "))}</div>
        <div class="mons">${esc(tname(t.team_a))}: ${teamState(t.team_a)} · ${esc(tname(t.team_b))}: ${teamState(t.team_b)}</div>
        <div class="acts"><button class="btn sm" data-at="${t.id}">Aprobar</button><button class="btn ghost sm" data-rt="${t.id}">Rechazar</button></div></div>`).join("") || "<p>No hay trades por aprobar.</p>"}
        ${waiting.length ? `<p class="hint" style="margin-top:14px">Esperando respuesta del otro trainer: ${waiting.map(t => `${esc(tname(t.team_a))} → ${esc(tname(t.team_b))} (${esc((t.give || []).join(", "))} por ${esc((t.receive || []).join(", "))})`).join(" · ")}</p>` : ""}</div></div>`
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      b.disabled = true
      try {
        if (b.dataset.ar) {
          const r = await rpc("approve_report", { p_report_id: b.dataset.ar })
          const esc_ = r?.escapes || []
          toast(esc_.length ? `Aprobado. Se escaparon: ${esc_.map(x => x.pokemon + " (" + x.faints + " faints)").join(", ")}` : "Reporte aprobado.")
        }
        if (b.dataset.rr) { await rpc("reject_report", { p_report_id: b.dataset.rr }); toast("Reporte rechazado.") }
        if (b.dataset.at) {
          const r = await rpc("approve_transaction", { p_transaction_id: b.dataset.at })
          const n = (r?.auto_rejected || []).length
          toast(n ? `Aprobado. ${n} solicitud(es) que ya no se podian cumplir se rechazaron solas.` : "Movimiento aprobado.")
        }
        if (b.dataset.rt) { await rpc("reject_transaction", { p_transaction_id: b.dataset.rt }); toast("Movimiento rechazado.") }
        reload()
      } catch (err) { b.disabled = false; fail(err) }
    }
  }

  // ---------- temporada ----------
  function season() {
    const ne = S.next_event || {}, th = S.theme || {}
    const atLocal = ne.at ? new Date(ne.at).toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).slice(0, 16).replace(" ", "T") : ""
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Datos de la temporada</h3><div class="fgrid">
        <label class="fld"><span>Numero</span><input name="number" type="number" value="${S.number ?? ""}"></label>
        <label class="fld"><span>Nombre interno</span><input name="name" value="${esc(S.name || "")}"></label>
        <label class="fld"><span>Subtitulo (se ve en el sitio)</span><input name="subtitle" value="${esc(S.subtitle || "")}" placeholder="HeartGold · SoulSilver"></label>
        <label class="fld"><span>Fase</span><select name="status">${STATUS.map(([k, l]) => `<option value="${k}" ${S.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld"><span>Color de acento</span><input name="accent" type="color" value="${th.accent || "#FFB62E"}"></label>
        <label class="fld"><span>Color "Inmune" (tabla de tipos)</span><input name="immune" type="color" value="${th.immune || "#4FA3FF"}"></label>
        <label class="fld"><span>Proximo evento</span><input name="ev_label" value="${esc(ne.label || "")}" placeholder="Draft de la Temporada 5"></label>
        <label class="fld"><span>Fecha (hora CDMX)</span><input name="ev_at" type="datetime-local" value="${atLocal}"></label>
        <label class="fld"><span>Campeon</span><select name="champion"><option value="">—</option>${st.map(x => `<option value="${x.team_id}" ${S.champion_team_id === x.team_id ? "selected" : ""}>${esc(x.display_name || tname(x.team_id))}</option>`).join("")}</select></label>
      </div><div class="acts"><button class="btn" id="sSave">Guardar</button>
        ${S.is_active ? `<span class="pill ok">Temporada activa</span>` : `<button class="btn ghost" id="sAct">Hacer activa</button>`}</div></div>
      <div class="card-a"><h3>Nueva temporada</h3><p class="hint">Copia reglas, conferencias, equipos y pool de otra temporada; despues ajustas lo que cambie.</p><div class="fgrid">
        <label class="fld"><span>Numero</span><input id="nsNum" type="number" value="${Math.max(...seasons.map(s => s.number || 0)) + 1}"></label>
        <label class="fld"><span>Nombre</span><input id="nsName" value="Season ${Math.max(...seasons.map(s => s.number || 0)) + 1}"></label>
        <label class="fld"><span>Copiar de</span><select id="nsFrom"><option value="">Empezar en blanco</option>${seasons.map(s => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>Temporada ${s.number}</option>`).join("")}</select></label>
      </div><div class="acts"><button class="btn" id="nsGo">Crear temporada</button></div></div></div>`
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      try {
        if (b.id === "sSave") {
          const f = n => body.querySelector(`[name="${n}"]`).value
          const at = f("ev_at") ? new Date(f("ev_at") + ":00-06:00").toISOString() : null
          const { error } = await supabase.from("seasons").update({
            number: +f("number"), slug: "s" + f("number"), name: f("name"), subtitle: f("subtitle") || null, status: f("status"),
            theme: { ...th, accent: f("accent"), immune: f("immune") }, next_event: f("ev_label") ? { label: f("ev_label"), at } : null,
            champion_team_id: f("champion") || null
          }).eq("id", sid)
          if (error) throw error
          refreshSite("Temporada guardada.")
        }
        if (b.id === "sAct") { if (!confirm(`¿Hacer activa la Temporada ${S.number}? Las demas pasan a archivo.`)) return; await rpc("activate_season", { p_season_id: sid }); toast("Temporada activada."); location.href = "/#admin" }
        if (b.id === "nsGo") {
          const id = await rpc("create_season", { p_number: +body.querySelector("#nsNum").value, p_name: body.querySelector("#nsName").value, p_copy_from: body.querySelector("#nsFrom").value || null })
          toast("Temporada creada."); location.href = `/?t=${body.querySelector("#nsNum").value}#admin`; return id
        }
      } catch (err) { fail(err) }
    }
  }

  // ---------- reglas ----------
  function rules() {
    body.innerHTML = `<div class="adm"><div class="card-a"><h3>Reglas y sistema de puntos</h3><div class="fgrid">
      ${RULE_FIELDS.map(([k, l, t]) => `<label class="fld"><span>${l}</span><input name="${k}" type="${t}" value="${settings[k] ?? ""}"></label>`).join("")}</div></div>
      <div class="card-a" style="border-color:var(--rojo)"><h3>Regla de escape por faints</h3>
      <p class="hint">Cuando un Pokemon junta este numero de faints (sumando todas las semanas) se escapa: sale del roster, el equipo recupera sus puntos y queda libre en waivers para todos. Se revisa al aprobar cada reporte.</p>
      <div class="fgrid">
        <label class="fld"><span>Limite de faints (vacio = apagada)</span><input name="faint_limit" type="number" min="1" value="${settings.faint_limit ?? ""}"></label>
        <label class="fld chk"><input name="faint_reset_on_transfer" type="checkbox" ${settings.faint_reset_on_transfer !== false ? "checked" : ""}><span>Reiniciar el contador si cambia de equipo</span></label>
        <label class="fld chk"><input name="faint_in_playoffs" type="checkbox" ${settings.faint_in_playoffs ? "checked" : ""}><span>Contar tambien en playoffs</span></label>
      </div></div>
      <div class="card-a" style="border-color:var(--volt)"><h3>Pokemon repetidos y starters</h3>
      <p class="hint">Repetidos: un Pokemon puede estar en varios equipos; cada copia extra cuesta su precio mas un sobrecosto (copias y sobrecosto se definen por Pokemon en "Pool y precios"). Starter: cada equipo marca sus starters antes de la fase regular y esos no se escapan.</p>
      <div class="fgrid">
        <label class="fld chk"><input name="allow_duplicates" type="checkbox" ${settings.allow_duplicates ? "checked" : ""}><span>Permitir Pokemon repetidos</span></label>
        <label class="fld"><span>Starters por equipo (0 = no hay)</span><input name="starters_per_team" type="number" min="0" max="6" value="${settings.starters_per_team ?? 0}"></label>
        <label class="fld"><span>Repetidos maximo por equipo (vacio = sin tope)</span><input name="max_copies_per_team" type="number" min="0" value="${settings.max_copies_per_team ?? ""}"></label>
      </div><p class="hint" style="margin-top:10px">La segunda copia de un Pokemon (la que cuesta mas) aparece <b>shiny</b> en el draft y en los rosters.</p></div>
      <div class="card-a" style="border-color:var(--verde)"><h3>Formato de la temporada</h3>
      <p class="hint">Conferencias: cada conferencia con su tabla y su round robin. Tabla general: todos en una tabla. Bombos (estilo Champions): todos en una tabla y cada equipo juega contra rivales de cada bombo; los bombos se asignan en "Conferencias y equipos". Las jornadas son "Semanas de fase regular" y los que pasan son "Equipos a playoffs".</p>
      <div class="fgrid">
        <label class="fld"><span>Formato</span><select name="season_format">${[["conferences", "Conferencias"], ["table", "Tabla general"], ["pots", "Bombos (estilo Champions)"]].map(([k, l]) => `<option value="${k}" ${(settings.season_format || "conferences") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="fld"><span>Numero de bombos</span><input name="pots_count" type="number" min="2" max="8" value="${settings.pots_count ?? 3}"></label>
      </div></div>
      <div class="card-a"><h3>Calendario con revelado semanal</h3>
      <p class="hint">El calendario se genera completo desde el inicio, pero los jugadores solo ven el enfrentamiento de cada jornada a partir de su fecha de revelado (una semana despues de la anterior). Tu siempre ves todo.</p>
      <div class="fgrid">
        <label class="fld chk"><input name="reveal_weekly" type="checkbox" ${settings.reveal_weekly ? "checked" : ""}><span>Revelar un enfrentamiento por semana</span></label>
        <label class="fld"><span>Se revela la jornada 1 (hora CDMX; las demas cada 7 dias)</span><input name="schedule_start" type="datetime-local" value="${settings.schedule_start ? new Date(settings.schedule_start).toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).slice(0, 16).replace(" ", "T") : ""}"></label>
      </div></div>
      <div class="acts"><button class="btn" id="rSave">Guardar reglas</button></div></div>`
    body.querySelector("#rSave").onclick = async () => {
      const row = { season_id: sid }
      RULE_FIELDS.forEach(([k, , t]) => { const v = body.querySelector(`[name="${k}"]`).value; row[k] = v === "" ? null : t === "number" ? +v : v })
      const fl = body.querySelector('[name="faint_limit"]').value
      row.faint_limit = fl === "" ? null : +fl
      row.faint_reset_on_transfer = body.querySelector('[name="faint_reset_on_transfer"]').checked
      row.faint_in_playoffs = body.querySelector('[name="faint_in_playoffs"]').checked
      row.allow_duplicates = body.querySelector('[name="allow_duplicates"]').checked
      row.starters_per_team = +body.querySelector('[name="starters_per_team"]').value || 0
      const mc = body.querySelector('[name="max_copies_per_team"]').value
      row.max_copies_per_team = mc === "" ? null : +mc
      row.season_format = body.querySelector('[name="season_format"]').value
      row.pots_count = Math.max(2, +body.querySelector('[name="pots_count"]').value || 3)
      row.reveal_weekly = body.querySelector('[name="reveal_weekly"]').checked
      const ss = body.querySelector('[name="schedule_start"]').value
      row.schedule_start = ss ? new Date(ss + ":00-06:00").toISOString() : null
      ;["roster_size", "max_points", "points_win", "points_loss", "best_of", "playoff_teams", "max_fa", "trade_max_diff", "draft_pick_seconds"].forEach(k => { if (row[k] == null) delete row[k] })
      const { error } = settings.id ? await supabase.from("league_settings").update(row).eq("id", settings.id) : await supabase.from("league_settings").insert(row)
      if (error) return fail(error)
      refreshSite("Reglas guardadas.")
    }
  }

  // ---------- conferencias y equipos ----------
  function teamsTab() {
    const fmt = settings.season_format || "conferences", nPots = settings.pots_count || 3
    const inSeason = Object.fromEntries(st.map(x => [x.team_id, x]))
    const cnt = Object.fromEntries(confs.map(c => [c.id, st.filter(x => x.conference_id === c.id).length]))
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Conferencias</h3><div class="fgrid">${confs.map(c => `
        <label class="fld"><span>Conferencia ${c.sort} · nombre</span><input data-cn="${c.id}" value="${esc(c.name)}"></label>
        <label class="fld"><span>Color</span><input data-cc="${c.id}" type="color" value="${c.color}"></label>`).join("")}</div>
        <div class="acts"><button class="btn" id="cSave">Guardar conferencias</button></div></div>
      <div class="card-a"><h3>Equipos de la temporada</h3>
        <p class="hint">${st.length} equipos inscritos · ${confs.map(c => `${esc(c.name)}: ${cnt[c.id] || 0}`).join(" · ")}${settings.max_teams ? ` · cupo ${esc(settings.max_teams)}` : ""}. El trainer se liga por su cuenta (correo).</p>
        <div class="atbl-w"><table class="atbl"><thead><tr><th>Juega</th><th>Equipo (nombre en la temporada)</th><th>Abrev.</th>${fmt === "conferences" ? "<th>Conferencia</th>" : ""}${fmt === "pots" ? "<th>Bombo</th>" : ""}<th>Trainer</th><th>Cuenta</th><th>Logo (URL)</th></tr></thead><tbody>
        ${teams.map(t => { const x = inSeason[t.id]; return `<tr data-tid="${t.id}" class="${x ? "" : "off"}">
          <td><input type="checkbox" data-f="on" ${x ? "checked" : ""}></td>
          <td><input class="inp" data-f="display_name" value="${esc(x?.display_name || t.name)}"></td>
          <td><input class="inp" data-f="abbr" value="${esc(x?.abbr || "")}" maxlength="4" style="width:70px"></td>
          ${fmt === "conferences" ? `<td><select class="inp" data-f="conference_id"><option value="">Sin asignar</option>${confs.map(c => `<option value="${c.id}" ${x?.conference_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></td>` : ""}
          ${fmt === "pots" ? `<td><select class="inp" data-f="pot"><option value="">—</option>${Array.from({ length: nPots }, (_, i) => `<option value="${i + 1}" ${x?.pot === i + 1 ? "selected" : ""}>Bombo ${i + 1}</option>`).join("")}</select></td>` : ""}
          <td><input class="inp" data-f="coach_name" value="${esc(x?.coach_name || t.coach_name || "")}"></td>
          <td><select class="inp" data-f="user_id"><option value="">—</option>${profiles.map(p => `<option value="${p.id}" ${t.user_id === p.id ? "selected" : ""}>${esc(p.email)}</option>`).join("")}</select></td>
          <td><input class="inp" data-f="logo" value="${esc(x?.logo || t.logo || "")}"></td></tr>` }).join("")}
        </tbody></table></div>
        <div class="acts"><button class="btn" id="tSave">Guardar equipos</button>${fmt === "conferences" ? '<button class="btn ghost" id="tRand">Repartir al azar en conferencias</button>' : ""}${fmt === "pots" ? '<button class="btn ghost" id="tPots">Repartir al azar en bombos</button>' : ""}</div></div>
      <div class="card-a"><h3>Equipo nuevo</h3><div class="fgrid">
        <label class="fld"><span>Nombre</span><input id="ntName"></label><label class="fld"><span>Trainer</span><input id="ntCoach"></label>
        <label class="fld"><span>Cuenta</span><select id="ntUser"><option value="">—</option>${profiles.filter(p => !teams.some(t => t.user_id === p.id)).map(p => `<option value="${p.id}">${esc(p.email)}</option>`).join("")}</select></label>
      </div><div class="acts"><button class="btn" id="ntGo">Agregar equipo</button></div></div></div>`
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      try {
        if (b.id === "cSave") {
          for (const c of confs) {
            const { error } = await supabase.from("conferences").update({ name: body.querySelector(`[data-cn="${c.id}"]`).value, color: body.querySelector(`[data-cc="${c.id}"]`).value }).eq("id", c.id)
            if (error) throw error
          }
          refreshSite("Conferencias guardadas.")
        }
        if (b.id === "tRand") {
          const rows = [...body.querySelectorAll("tr[data-tid]")].filter(r => r.querySelector('[data-f="on"]').checked).sort(() => Math.random() - .5)
          rows.forEach((r, i) => { r.querySelector('[data-f="conference_id"]').value = confs[i % confs.length]?.id || "" })
          toast("Repartidos. Revisa y dale Guardar.")
        }
        if (b.id === "tPots") {
          const rows = [...body.querySelectorAll("tr[data-tid]")].filter(r => r.querySelector('[data-f="on"]').checked).sort(() => Math.random() - .5)
          const per = Math.ceil(rows.length / nPots)
          rows.forEach((r, i) => { r.querySelector('[data-f="pot"]').value = String(Math.floor(i / per) + 1) })
          toast("Repartidos. Revisa y dale Guardar.")
        }
        if (b.id === "tSave") {
          const ups = [], dels = [], userUps = []
          body.querySelectorAll("tr[data-tid]").forEach(r => {
            const id = r.dataset.tid, v = f => r.querySelector(`[data-f="${f}"]`)
            const t = teams.find(x => x.id === id)
            if (v("user_id").value !== (t.user_id || "")) userUps.push({ id, user_id: v("user_id").value || null })
            if (v("on").checked) ups.push({ season_id: sid, team_id: id, display_name: v("display_name").value, abbr: v("abbr").value.toUpperCase() || null, conference_id: v("conference_id") ? v("conference_id").value || null : inSeason[id]?.conference_id || null, pot: v("pot") ? (+v("pot").value || null) : inSeason[id]?.pot ?? null, coach_name: v("coach_name").value || null, logo: v("logo").value || null })
            else if (inSeason[id]) dels.push(id)
          })
          const used = userUps.map(u => u.user_id).filter(Boolean)
          if (new Set(used).size !== used.length) throw new Error("Una cuenta no puede tener dos equipos")
          for (const u of userUps) { const { error } = await supabase.from("teams").update({ user_id: u.user_id }).eq("id", u.id); if (error) throw error }
          if (ups.length) { const { error } = await supabase.from("season_teams").upsert(ups, { onConflict: "season_id,team_id" }); if (error) throw error }
          if (dels.length) { const { error } = await supabase.from("season_teams").delete().eq("season_id", sid).in("team_id", dels); if (error) throw error }
          refreshSite("Equipos guardados.")
        }
        if (b.id === "ntGo") {
          const name = body.querySelector("#ntName").value.trim(); if (!name) throw new Error("Falta el nombre")
          const { data, error } = await supabase.from("teams").insert({ name, conference: confs[0]?.code || confs[0]?.name || "-", coach_name: body.querySelector("#ntCoach").value || null, user_id: body.querySelector("#ntUser").value || null }).select().single()
          if (error) throw error
          await supabase.from("season_teams").insert({ season_id: sid, team_id: data.id, display_name: name, coach_name: body.querySelector("#ntCoach").value || null })
          toast("Equipo agregado."); reload()
        }
      } catch (err) { fail(err) }
    }
  }

  // ---------- pool ----------
  async function pool() {
    body.innerHTML = "<p>Cargando pool…</p>"
    const rows = await fetchAll(() => supabase.from("season_pokemon").select("id,points,available,max_copies,copy_surcharge,pokemon:pokemon_id(name,type1,type2)").eq("season_id", sid).order("id"))
    rows.sort((a, b) => (b.available - a.available) || (b.points ?? 0) - (a.points ?? 0) || (a.pokemon?.name || "").localeCompare(b.pokemon?.name || ""))
    const dirty = new Map()
    const avail = rows.filter(r => r.available).length
    body.innerHTML = `<div class="adm"><div class="card-a"><h3>Pool de la temporada</h3>
      <p class="hint">${avail} disponibles de ${rows.length} en la Pokedex. Solo los marcados como disponibles entran al draft y a waivers.</p>
      <div class="acts" style="margin-top:0"><input class="inp" id="plQ" placeholder="Buscar…" style="max-width:260px">
        <select class="inp" id="plF" style="max-width:200px"><option value="">Todos</option><option value="on">Disponibles</option><option value="off">No disponibles</option></select>
        <button class="btn" id="plSave" disabled>Guardar cambios</button></div>
      <div class="atbl-w" style="margin-top:12px"><table class="atbl"><thead><tr><th>Disp.</th><th>Pokemon</th><th>Tipos</th><th>Puntos</th><th title="Cuantos equipos lo pueden tener (si la temporada permite repetidos)">Copias</th><th title="Puntos extra por cada copia ya tomada">Sobrecosto</th></tr></thead><tbody id="plBody"></tbody></table></div>
      ${settings.allow_duplicates ? "" : `<p class="hint" style="margin-top:10px">Los repetidos estan apagados en esta temporada: "Copias" no aplica hasta que los actives en Reglas.</p>`}</div>
      <div class="card-a"><h3>Carga masiva</h3><p class="hint">Una linea por Pokemon: <code>Nombre,puntos,copias,sobrecosto</code> (copias y sobrecosto opcionales; agrega <code>,no</code> para quitarlo del pool). Ej. <code>Garchomp,18,2,5</code></p>
        <label class="fld"><textarea id="plBulk" placeholder="Garchomp,18&#10;Rotom-Wash,12&#10;Ditto,5,no"></textarea></label>
        <div class="acts"><button class="btn" id="plBulkGo">Aplicar lista</button><label class="fld chk"><input type="checkbox" id="plOnly"><span>Quitar del pool todo lo que no este en la lista</span></label></div></div>
      <div class="card-a"><h3>Copiar precios</h3><div class="acts"><select class="inp" id="plFrom" style="max-width:240px">${seasons.filter(s => s.id !== sid).map(s => `<option value="${s.id}">De la Temporada ${s.number}</option>`).join("")}</select><button class="btn ghost" id="plCopy">Reemplazar pool con esa temporada</button></div></div></div>`
    const tb = body.querySelector("#plBody"), q = body.querySelector("#plQ"), fsel = body.querySelector("#plF"), save = body.querySelector("#plSave")
    const paint = () => {
      const t = q.value.trim().toLowerCase(), f = fsel.value
      tb.innerHTML = rows.filter(r => (!t || (r.pokemon?.name || "").toLowerCase().includes(t)) && (!f || (f === "on" ? r.available : !r.available))).slice(0, 400).map(r => {
        const d = dirty.get(r.id) || r
        return `<tr data-id="${r.id}" class="${d.available ? "" : "off"}"><td><input type="checkbox" data-a ${d.available ? "checked" : ""}></td><td>${esc(r.pokemon?.name)}</td><td style="color:var(--mute)">${esc([r.pokemon?.type1, r.pokemon?.type2].filter(Boolean).join(" / "))}</td><td><input class="inp" data-p type="number" min="0" value="${d.points ?? ""}" style="width:80px"></td><td><input class="inp" data-c type="number" min="1" max="18" value="${d.max_copies ?? 1}" style="width:70px"></td><td><input class="inp" data-s type="number" min="0" value="${d.copy_surcharge ?? 0}" style="width:70px"></td></tr>`
      }).join("")
    }
    paint(); q.oninput = paint; fsel.onchange = paint
    tb.onchange = e => {
      const tr = e.target.closest("tr"); if (!tr) return
      const id = tr.dataset.id, base = rows.find(r => r.id === id)
      const v = { id, available: tr.querySelector("[data-a]").checked, points: tr.querySelector("[data-p]").value === "" ? null : +tr.querySelector("[data-p]").value,
        max_copies: Math.max(1, +tr.querySelector("[data-c]").value || 1), copy_surcharge: Math.max(0, +tr.querySelector("[data-s]").value || 0) }
      dirty.set(id, v); Object.assign(base, v); tr.classList.toggle("off", !v.available); save.disabled = false; save.textContent = `Guardar ${dirty.size} cambio(s)`
    }
    save.onclick = async () => {
      save.disabled = true
      try {
        for (const v of dirty.values()) { const { error } = await supabase.from("season_pokemon").update({ available: v.available, points: v.points, max_copies: v.max_copies, copy_surcharge: v.copy_surcharge }).eq("id", v.id); if (error) throw error }
        toast(`${dirty.size} Pokemon actualizados.`); dirty.clear(); save.textContent = "Guardar cambios"
      } catch (err) { save.disabled = false; fail(err) }
    }
    body.querySelector("#plBulkGo").onclick = async () => {
      const lines = body.querySelector("#plBulk").value.split(/\n+/).map(l => l.split(/[,;\t]/).map(x => x.trim())).filter(l => l[0])
      const payload = lines.map(([name, pts, ...rest]) => {
        const off = rest.some(x => /^(no|false)$/i.test(x)), nums = rest.filter(x => /^\d+$/.test(x)).map(Number)
        return { name, points: pts === "" || pts == null ? null : +pts, available: !off, copies: nums[0] ?? null, surcharge: nums[1] ?? null }
      })
      try {
        if (body.querySelector("#plOnly").checked) {
          if (!confirm("Esto quita del pool todo lo que no este en la lista. ¿Seguir?")) return
          const { error } = await supabase.from("season_pokemon").update({ available: false }).eq("season_id", sid); if (error) throw error
        }
        const r = await rpc("upsert_pool", { p_season_id: sid, p_rows: payload })
        toast(`${r.updated} actualizados${r.missing.length ? `. No encontre: ${r.missing.join(", ")}` : ""}`); pool()
      } catch (err) { fail(err) }
    }
    body.querySelector("#plCopy").onclick = async () => {
      if (!confirm("Esto reemplaza todo el pool de esta temporada. ¿Seguir?")) return
      try { const n = await rpc("copy_pool", { p_from: body.querySelector("#plFrom").value, p_to: sid }); toast(`${n} Pokemon copiados.`); pool() } catch (err) { fail(err) }
    }
  }

  // ---------- draft y calendario ----------
  function draft() {
    const ds = dsQ.data, ord = (orderQ.data || []).map(o => o.team_id)
    const fmt = settings.season_format || "conferences"
    const inS = st.filter(x => fmt !== "conferences" || x.conference_id).map(x => x.team_id)
    const list = ord.length ? ord.filter(id => inS.includes(id)).concat(inS.filter(id => !ord.includes(id))) : inS.slice()
    const nMatches = 0
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Orden del draft (snake)</h3><p class="hint">Ronda impar de arriba hacia abajo, ronda par al reves. El orden de waivers sale invertido al exportar el draft.</p>
        <ol class="ord-list" id="dOrd">${list.map(id => `<li data-id="${id}"><span class="grow">${esc(tname(id))}</span><button data-up>↑</button><button data-dn>↓</button></li>`).join("")}</ol>
        <div class="acts"><button class="btn ghost" id="dRand">Sortear</button><button class="btn" id="dSave">Guardar orden</button></div></div>
      <div class="card-a"><h3>Control del draft</h3>
        <p>Estado: <b>${ds ? (ds.is_finished ? "Terminado" : ds.is_active ? (ds.is_paused ? "En pausa" : `En curso · pick #${ds.current_pick}`) : "Sin empezar") : "Sin empezar"}</b>${S.is_active ? "" : " · <span class='msg-err'>La temporada debe estar activa para correr el draft</span>"}</p>
        <div class="acts">
          <button class="btn" data-rpc="start_draft">Iniciar</button><button class="btn ghost" data-rpc="pause_draft">Pausar</button><button class="btn ghost" data-rpc="resume_draft">Reanudar</button>
          <button class="btn ghost" data-rpc="force_auto_pick">Forzar autopick</button><button class="btn ghost" data-rpc="undo_last_pick">Deshacer ultimo pick</button><button class="btn ghost" data-rpc="finish_draft">Terminar</button>
          <button class="btn" data-rpc="export_draft_to_rosters">Pasar picks a rosters</button><button class="btn danger" data-rpc="reset_draft">Reiniciar draft</button></div></div>
      <div class="card-a"><h3>Calendario</h3><p class="hint">Formato: <b>${{ conferences: "Conferencias (round robin en cada una)", table: "Tabla general (todos contra todos)", pots: `Bombos (${settings.pots_count || 3} bombos)` }[fmt]}</b> · ${settings.regular_weeks || "?"} jornadas. Se cambia en "Reglas y puntos". Primero se genera una vista previa; nada se guarda hasta que le das Guardar. Si un equipo queda impar, descansa esa jornada.${settings.reveal_weekly ? " Los jugadores veran cada jornada hasta su fecha de revelado." : ""}</p>
        <div class="acts"><button class="btn" id="gPrev">Generar vista previa</button><button class="btn ghost" id="gSave" disabled>Guardar calendario</button></div><div id="gOut"></div></div></div>`
    const ol = body.querySelector("#dOrd")
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      const li = b.closest("li")
      if (b.hasAttribute("data-up") && li.previousElementSibling) return li.parentNode.insertBefore(li, li.previousElementSibling)
      if (b.hasAttribute("data-dn") && li.nextElementSibling) return li.parentNode.insertBefore(li.nextElementSibling, li)
      try {
        if (b.id === "dRand") { [...ol.children].sort(() => Math.random() - .5).forEach(x => ol.appendChild(x)); return }
        if (b.id === "dSave") { await rpc("set_draft_order", { p_season_id: sid, p_team_ids: [...ol.children].map(x => x.dataset.id) }); toast("Orden guardado.") }
        if (b.dataset.rpc) {
          if (["reset_draft", "export_draft_to_rosters"].includes(b.dataset.rpc) && !confirm(b.dataset.rpc === "reset_draft" ? "Esto borra todos los picks. ¿Seguir?" : "Esto reemplaza los rosters de la temporada con los picks. ¿Seguir?")) return
          const r = await rpc(b.dataset.rpc, {}); toast(b.dataset.rpc === "undo_last_pick" ? `Se deshizo el pick de ${r}. El draft quedo en pausa: reanudalo cuando quieras.` : "Listo."); reload()
        }
        if (b.id === "gPrev") {
          draft.plan = buildSchedule(fmt, st, settings)
          const byW = {}; draft.plan.forEach(m => { (byW[m.week] = byW[m.week] || []).push(m) })
          body.querySelector("#gOut").innerHTML = `<p class="hint" style="margin-top:12px">${draft.plan.length} series en ${Object.keys(byW).length} jornadas.</p><div class="sched-prev">${Object.entries(byW).map(([w, l]) => `<div><b>Jornada ${w}</b>${l.map(m => `<span>${esc(tname(m.a))} <i>vs</i> ${esc(tname(m.b))}</span>`).join("")}</div>`).join("")}</div>`
          body.querySelector("#gSave").disabled = false
        }
        if (b.id === "gSave" && draft.plan) {
          const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("season_id", sid).eq("stage", "regular")
          if (count && !confirm(`Ya hay ${count} series de fase regular. Se borran (si ninguna se ha jugado) y se reemplazan. ¿Seguir?`)) return
          const n = await rpc("save_schedule", { p_season_id: sid, p_matches: draft.plan.map(m => ({ week: m.week, a: m.a, b: m.b, conference_id: m.conference_id || null })), p_replace: !!count })
          toast(`${n} series guardadas.`); draft.plan = null; reload()
        }
      } catch (err) { fail(err) }
    }
    void nMatches
  }

  // ---------- tarjetas ----------
  async function cardsTab() {
    body.innerHTML = "<p>Cargando tarjetas…</p>"
    const [defsQ, grQ] = await Promise.all([
      supabase.from("card_defs").select("*").order("sort"),
      supabase.from("card_grants").select("*").eq("season_id", sid).order("week", { ascending: false })
    ])
    const defs = defsQ.data || [], grants = grQ.data || []
    const CATN = { info: "Informacion", limit: "Limitar al rival", own: "Ventaja propia", market: "Mercado", table: "Tabla y pronosticos", special: "Especiales" }
    const dn = id => defs.find(d => d.id === id)?.name || id
    const ST = { offered: ["Por elegir", ""], chosen: ["Elegida", "ok"], void: ["Anulada", "bad"] }
    const fmt = settings.season_format || "conferences"
    body.innerHTML = `<div class="adm">
      <div class="card-a" style="border-color:var(--volt)"><h3>Reglas de las tarjetas</h3>
        <p class="hint">Al aprobar el resultado de una serie de fase regular, el que pierde recibe 3 tarjetas al azar (si cumple la regla de abajo) y elige 1 para la siguiente jornada. Bono de remontada, Seguro y Pronostico doble se aplican solos en la tabla y en pronosticos; las demas las aplicas tu o los jugadores al jugar.</p>
        <div class="fgrid">
          <label class="fld chk"><input name="cards_enabled" type="checkbox" ${settings.cards_enabled ? "checked" : ""}><span>Tarjetas activas en esta temporada</span></label>
          <label class="fld"><span>Reciben del lugar N hacia abajo (vacio = todo el que pierda)</span><input name="cards_cutoff" type="number" min="1" value="${settings.cards_cutoff ?? ""}"></label>
          <label class="fld"><span>El lugar se cuenta en</span><select name="cards_scope" ${fmt !== "conferences" ? "disabled" : ""}><option value="conference" ${settings.cards_scope !== "overall" ? "selected" : ""}>Su conferencia</option><option value="overall" ${settings.cards_scope === "overall" ? "selected" : ""}>La tabla general</option></select></label>
          <label class="fld chk"><input name="cards_block_after_use" type="checkbox" ${settings.cards_block_after_use !== false ? "checked" : ""}><span>Si uso tarjeta y perdio, esa semana no recibe</span></label>
        </div>${fmt !== "conferences" ? '<p class="hint">Con tabla general o bombos el lugar siempre se cuenta en la tabla general.</p>' : ""}
        <div class="acts"><button class="btn" id="kSave">Guardar reglas</button></div></div>
      <div class="card-a"><h3>Tarjetas de la temporada (${grants.length})</h3>
        ${grants.length ? `<div class="atbl-w"><table class="atbl"><thead><tr><th>Equipo</th><th>Perdio</th><th>Para</th><th>Estado</th><th>Tarjeta</th><th>Opciones</th><th></th></tr></thead><tbody>
        ${grants.map(g => `<tr><td>${esc(tname(g.team_id))}${g.manual ? ' <span class="pill">Manual</span>' : ""}</td><td>J${g.week}</td><td>J${g.for_week}</td><td><span class="pill ${ST[g.status][1]}">${ST[g.status][0]}</span></td>
          <td>${g.chosen ? esc(dn(g.chosen)) : "—"}</td><td style="color:var(--mute)">${g.offered.map(dn).map(esc).join(" · ")}${g.mulligan_used ? " (tras Mulligan)" : ""}</td>
          <td>${g.status !== "void" ? `<button class="btn ghost sm" data-kvoid="${g.id}">Anular</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : "<p>Todavia no se ha repartido ninguna tarjeta.</p>"}
        <h3 style="margin-top:18px">Dar tarjeta a mano</h3><p class="hint">Le salen 3 al azar para elegir, sin revisar la regla. Si ya tenia una de esa jornada, se reemplaza.</p>
        <div class="fgrid"><label class="fld"><span>Equipo</span><select id="kTeam">${st.map(x => `<option value="${x.team_id}">${esc(x.display_name || tname(x.team_id))}</option>`).join("")}</select></label>
          <label class="fld"><span>Jornada que perdio</span><input id="kWeek" type="number" min="0" value="1"></label></div>
        <div class="acts"><button class="btn ghost" id="kGrant">Dar tarjeta</button></div></div>
      <div class="card-a"><h3>Catalogo (${defs.filter(d => d.active).length} activas de ${defs.length})</h3>
        <p class="hint">Edita el nombre, el efecto y la letra chica. Las inactivas no salen en los sorteos.</p>
        <div class="atbl-w"><table class="atbl"><thead><tr><th>Activa</th><th>#</th><th>Tipo</th><th>Nombre</th><th>Efecto</th><th>Letra chica</th></tr></thead><tbody>
        ${defs.map(d => `<tr data-kd="${esc(d.id)}"><td><input type="checkbox" data-k="active" ${d.active ? "checked" : ""}></td><td>${d.sort}</td><td>${CATN[d.category] || d.category}</td>
          <td><input class="inp" data-k="name" value="${esc(d.name)}"></td><td><textarea class="inp" data-k="effect" rows="2" style="min-width:260px">${esc(d.effect)}</textarea></td><td><textarea class="inp" data-k="rule" rows="2" style="min-width:220px">${esc(d.rule || "")}</textarea></td></tr>`).join("")}
        </tbody></table></div><div class="acts"><button class="btn" id="kDefs">Guardar catalogo</button></div></div></div>`
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      try {
        if (b.id === "kSave") {
          const f = n => body.querySelector(`[name="${n}"]`)
          const row = { cards_enabled: f("cards_enabled").checked, cards_cutoff: f("cards_cutoff").value === "" ? null : +f("cards_cutoff").value, cards_scope: f("cards_scope").value, cards_block_after_use: f("cards_block_after_use").checked }
          const { error } = settings.id ? await supabase.from("league_settings").update(row).eq("id", settings.id) : await supabase.from("league_settings").insert({ ...row, season_id: sid })
          if (error) throw error
          refreshSite("Reglas de tarjetas guardadas.")
        }
        if (b.dataset.kvoid) {
          if (!confirm("¿Anular esta tarjeta? Deja de contar y desaparece del perfil.")) return
          const { error } = await supabase.from("card_grants").update({ status: "void" }).eq("id", b.dataset.kvoid); if (error) throw error
          toast("Tarjeta anulada."); cardsTab()
        }
        if (b.id === "kGrant") {
          await rpc("admin_grant_card", { p_season: sid, p_team: body.querySelector("#kTeam").value, p_week: +body.querySelector("#kWeek").value || 0 })
          toast("Tarjeta dada: le saldran 3 opciones al entrar."); cardsTab()
        }
        if (b.id === "kDefs") {
          b.disabled = true
          for (const tr of body.querySelectorAll("tr[data-kd]")) {
            const id = tr.dataset.kd, d = defs.find(x => x.id === id), v = k => tr.querySelector(`[data-k="${k}"]`)
            const row = { active: v("active").checked, name: v("name").value.trim(), effect: v("effect").value.trim(), rule: v("rule").value.trim() || null }
            if (row.active === d.active && row.name === d.name && row.effect === d.effect && row.rule === (d.rule || null)) continue
            const { error } = await supabase.from("card_defs").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id); if (error) throw error
          }
          toast("Catalogo guardado."); cardsTab()
        }
      } catch (err) { b.disabled = false; fail(err) }
    }
  }

  // ---------- roles y usuarios ----------
  function rolesTab() {
    const team = id => teams.find(t => t.user_id === id)
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Usuarios</h3><p class="hint">Cada cuenta tiene un rol. Las cuentas nuevas entran como Jugador. Debe quedar al menos un administrador.</p>
        <div class="atbl-w"><table class="atbl"><thead><tr><th>Cuenta</th><th>Equipo</th><th>Rol</th></tr></thead><tbody>
        ${profiles.map(p => `<tr><td>${esc(p.email || p.id)}</td><td>${esc(team(p.id)?.name || "—")}</td>
          <td><select class="inp" data-ur="${p.id}">${roles.map(r => `<option value="${esc(r.key)}" ${r.id === p.role_id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></td></tr>`).join("")}
        </tbody></table></div></div>
      ${roles.map(r => `<div class="card-a" data-role="${r.id}"><h3>${esc(r.name)} ${r.is_system ? '<span class="pill">Base</span>' : ""}</h3>
        <div class="fgrid" style="margin-bottom:14px"><label class="fld"><span>Nombre</span><input data-rn value="${esc(r.name)}"></label><label class="fld"><span>Descripcion</span><input data-rd value="${esc(r.description || "")}"></label></div>
        <div class="perm-g">${PERMS.map(([k, l, d]) => `<label><input type="checkbox" data-pm="${k}" ${r.permissions.includes(k) ? "checked" : ""} ${r.key === "admin" && k === "all" ? "disabled" : ""}><span>${l}<small>${d}</small></span></label>`).join("")}</div>
        <div class="acts"><button class="btn sm" data-rsave="${r.id}">Guardar rol</button>${r.is_system ? "" : `<button class="btn danger sm" data-rdel="${r.id}">Borrar rol</button>`}</div></div>`).join("")}
      <div class="card-a"><h3>Rol nuevo</h3><div class="fgrid"><label class="fld"><span>Nombre</span><input id="nrName" placeholder="Ej. Arbitro"></label><label class="fld"><span>Descripcion</span><input id="nrDesc"></label></div>
        <div class="acts"><button class="btn" id="nrGo">Crear rol</button></div><p class="hint">Despues de crearlo eliges sus permisos.</p></div></div>`
    body.onchange = async e => {
      const s = e.target.closest("[data-ur]"); if (!s) return
      try { await rpc("set_user_role", { p_user: s.dataset.ur, p_role_key: s.value }); toast("Rol actualizado.") } catch (err) { fail(err); reload() }
    }
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      try {
        if (b.dataset.rsave) {
          const card = body.querySelector(`[data-role="${b.dataset.rsave}"]`)
          const perms = [...card.querySelectorAll("[data-pm]:checked")].map(c => c.dataset.pm)
          const { error } = await supabase.from("roles").update({ name: card.querySelector("[data-rn]").value, description: card.querySelector("[data-rd]").value, permissions: perms }).eq("id", b.dataset.rsave)
          if (error) throw error
          toast("Rol guardado.")
        }
        if (b.dataset.rdel) {
          if (!confirm("Las cuentas con este rol pasan a Jugador. ¿Borrar?")) return
          const { error } = await supabase.from("roles").delete().eq("id", b.dataset.rdel); if (error) throw error
          toast("Rol borrado."); reload()
        }
        if (b.id === "nrGo") {
          const name = body.querySelector("#nrName").value.trim(); if (!name) throw new Error("Falta el nombre")
          const key = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4)
          const { error } = await supabase.from("roles").insert({ key, name, description: body.querySelector("#nrDesc").value || null, permissions: [] }); if (error) throw error
          toast("Rol creado. Elige sus permisos."); reload()
        }
      } catch (err) { fail(err) }
    }
  }

  // ---------- contenido (CM) ----------
  function content() {
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Nueva publicacion</h3><p class="hint">Aparece en "Ultimas noticias" del inicio.</p>
        <div class="fgrid">
          <label class="fld"><span>Titulo</span><input id="poT" maxlength="120"></label>
          <label class="fld"><span>Link (opcional)</span><input id="poL" type="url" placeholder="https://"></label>
          <label class="fld"><span>Imagen</span><input id="poF" type="file" accept="image/*"></label>
          <label class="fld"><span>Temporada</span><select id="poS"><option value="${sid}">Temporada ${S.number}</option><option value="">Todas</option></select></label>
          <label class="fld chk"><input id="poP" type="checkbox"><span>Fijar arriba</span></label>
          <label class="fld chk"><input id="poV" type="checkbox" checked><span>Publicada</span></label>
        </div>
        <label class="fld" style="margin-top:12px"><span>Texto</span><textarea id="poB" style="font-family:inherit;font-size:.95rem"></textarea></label>
        <div class="acts"><button class="btn" id="poGo">Publicar</button><span id="poMsg"></span></div></div>
      <div class="card-a"><h3>Publicaciones (${posts.length})</h3>${posts.map(p => `<div class="q-item"><header>${p.pinned ? '<span class="pill bad">Fijada</span>' : ""}${p.published ? '<span class="pill ok">Publicada</span>' : '<span class="pill">Borrador</span>'}<b>${esc(p.title)}</b><span style="color:var(--mute)">${new Date(p.created_at).toLocaleDateString("es-MX")}</span></header>
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="max-width:240px;border-radius:8px">` : ""}${p.body ? `<p style="margin:0;color:var(--mute)">${esc(p.body).slice(0, 220)}</p>` : ""}
        <div class="acts"><button class="btn ghost sm" data-pt="${p.id}" data-k="published" data-v="${!p.published}">${p.published ? "Ocultar" : "Publicar"}</button><button class="btn ghost sm" data-pt="${p.id}" data-k="pinned" data-v="${!p.pinned}">${p.pinned ? "Desfijar" : "Fijar"}</button><button class="btn danger sm" data-pdel="${p.id}">Borrar</button></div></div>`).join("") || "<p>Aun no hay publicaciones.</p>"}</div></div>`
    body.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return
      try {
        if (b.id === "poGo") {
          const msg = body.querySelector("#poMsg"), title = body.querySelector("#poT").value.trim()
          if (!title) throw new Error("Falta el titulo")
          b.disabled = true; msg.textContent = "Subiendo…"
          let image_url = null
          const f = body.querySelector("#poF").files[0]
          if (f) {
            const path = `posts/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`
            const up = await supabase.storage.from("media").upload(path, f, { contentType: f.type, upsert: false })
            if (up.error) throw up.error
            image_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl
          }
          const { error } = await supabase.from("posts").insert({ title, body: body.querySelector("#poB").value || null, link_url: body.querySelector("#poL").value || null, image_url,
            season_id: body.querySelector("#poS").value || null, pinned: body.querySelector("#poP").checked, published: body.querySelector("#poV").checked })
          if (error) throw error
          toast("Publicado."); reload()
        }
        if (b.dataset.pt) { const { error } = await supabase.from("posts").update({ [b.dataset.k]: b.dataset.v === "true" }).eq("id", b.dataset.pt); if (error) throw error; reload() }
        if (b.dataset.pdel) { if (!confirm("¿Borrar la publicacion?")) return; const { error } = await supabase.from("posts").delete().eq("id", b.dataset.pdel); if (error) throw error; reload() }
      } catch (err) { b.disabled = false; fail(err) }
    }
  }

  draw()
}
