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
let tab = null
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

export async function renderAdmin(P, ui) {
  const { esc, toast, modal } = ui
  const el = document.getElementById("page-admin")
  const can = x => P.PERMS.includes("all") || P.PERMS.includes(x)
  const TAB_PERM = { pend: ["results.approve", "market.approve"], season: ["season.manage"], rules: ["season.manage"], teams: ["season.manage"], pool: ["pool.manage"], draft: ["draft.manage"], roles: ["roles.manage"], content: ["content.manage"] }
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

  const TABS = [["pend", "Pendientes", reports.length + txs.length], ["season", "Temporada"], ["rules", "Reglas y puntos"], ["teams", "Conferencias y equipos"], ["pool", "Pool y precios"], ["draft", "Draft y calendario"], ["roles", "Roles y usuarios"], ["content", "Contenido"]].filter(([k]) => allowed.includes(k))
  const tabs = el.querySelector("#admTabs")
  tabs.innerHTML = TABS.map(([k, l, n]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${l}${n ? `<span class="bdg">${n}</span>` : ""}</button>`).join("")
  tabs.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw() }
  const body = el.querySelector("#admBody")

  function draw() {
    ({ pend, season, rules, teams: teamsTab, pool, draft, roles: rolesTab, content })[tab]()
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
          toast("Temporada guardada. Recarga para ver los cambios en el sitio.")
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
      ;["roster_size", "max_points", "points_win", "points_loss", "best_of", "playoff_teams", "max_fa", "trade_max_diff", "draft_pick_seconds"].forEach(k => { if (row[k] == null) delete row[k] })
      const { error } = settings.id ? await supabase.from("league_settings").update(row).eq("id", settings.id) : await supabase.from("league_settings").insert(row)
      if (error) return fail(error)
      toast("Reglas guardadas."); reload()
    }
  }

  // ---------- conferencias y equipos ----------
  function teamsTab() {
    const inSeason = Object.fromEntries(st.map(x => [x.team_id, x]))
    const cnt = Object.fromEntries(confs.map(c => [c.id, st.filter(x => x.conference_id === c.id).length]))
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Conferencias</h3><div class="fgrid">${confs.map(c => `
        <label class="fld"><span>Conferencia ${c.sort} · nombre</span><input data-cn="${c.id}" value="${esc(c.name)}"></label>
        <label class="fld"><span>Color</span><input data-cc="${c.id}" type="color" value="${c.color}"></label>`).join("")}</div>
        <div class="acts"><button class="btn" id="cSave">Guardar conferencias</button></div></div>
      <div class="card-a"><h3>Equipos de la temporada</h3>
        <p class="hint">${st.length} equipos inscritos · ${confs.map(c => `${esc(c.name)}: ${cnt[c.id] || 0}`).join(" · ")}${settings.max_teams ? ` · cupo ${esc(settings.max_teams)}` : ""}. El trainer se liga por su cuenta (correo).</p>
        <div class="atbl-w"><table class="atbl"><thead><tr><th>Juega</th><th>Equipo (nombre en la temporada)</th><th>Abrev.</th><th>Conferencia</th><th>Trainer</th><th>Cuenta</th><th>Logo (URL)</th></tr></thead><tbody>
        ${teams.map(t => { const x = inSeason[t.id]; return `<tr data-tid="${t.id}" class="${x ? "" : "off"}">
          <td><input type="checkbox" data-f="on" ${x ? "checked" : ""}></td>
          <td><input class="inp" data-f="display_name" value="${esc(x?.display_name || t.name)}"></td>
          <td><input class="inp" data-f="abbr" value="${esc(x?.abbr || "")}" maxlength="4" style="width:70px"></td>
          <td><select class="inp" data-f="conference_id"><option value="">Sin asignar</option>${confs.map(c => `<option value="${c.id}" ${x?.conference_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></td>
          <td><input class="inp" data-f="coach_name" value="${esc(x?.coach_name || t.coach_name || "")}"></td>
          <td><select class="inp" data-f="user_id"><option value="">—</option>${profiles.map(p => `<option value="${p.id}" ${t.user_id === p.id ? "selected" : ""}>${esc(p.email)}</option>`).join("")}</select></td>
          <td><input class="inp" data-f="logo" value="${esc(x?.logo || t.logo || "")}"></td></tr>` }).join("")}
        </tbody></table></div>
        <div class="acts"><button class="btn" id="tSave">Guardar equipos</button><button class="btn ghost" id="tRand">Repartir al azar en conferencias</button></div></div>
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
          toast("Conferencias guardadas.")
        }
        if (b.id === "tRand") {
          const rows = [...body.querySelectorAll("tr[data-tid]")].filter(r => r.querySelector('[data-f="on"]').checked).sort(() => Math.random() - .5)
          rows.forEach((r, i) => { r.querySelector('[data-f="conference_id"]').value = confs[i % confs.length]?.id || "" })
          toast("Repartidos. Revisa y dale Guardar.")
        }
        if (b.id === "tSave") {
          const ups = [], dels = [], userUps = []
          body.querySelectorAll("tr[data-tid]").forEach(r => {
            const id = r.dataset.tid, v = f => r.querySelector(`[data-f="${f}"]`)
            const t = teams.find(x => x.id === id)
            if (v("user_id").value !== (t.user_id || "")) userUps.push({ id, user_id: v("user_id").value || null })
            if (v("on").checked) ups.push({ season_id: sid, team_id: id, display_name: v("display_name").value, abbr: v("abbr").value.toUpperCase() || null, conference_id: v("conference_id").value || null, coach_name: v("coach_name").value || null, logo: v("logo").value || null })
            else if (inSeason[id]) dels.push(id)
          })
          const used = userUps.map(u => u.user_id).filter(Boolean)
          if (new Set(used).size !== used.length) throw new Error("Una cuenta no puede tener dos equipos")
          for (const u of userUps) { const { error } = await supabase.from("teams").update({ user_id: u.user_id }).eq("id", u.id); if (error) throw error }
          if (ups.length) { const { error } = await supabase.from("season_teams").upsert(ups, { onConflict: "season_id,team_id" }); if (error) throw error }
          if (dels.length) { const { error } = await supabase.from("season_teams").delete().eq("season_id", sid).in("team_id", dels); if (error) throw error }
          toast("Equipos guardados."); reload()
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
    const inS = st.filter(x => x.conference_id).map(x => x.team_id)
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
      <div class="card-a"><h3>Calendario</h3><p class="hint">Genera un round robin dentro de cada conferencia con los equipos asignados. Si un equipo queda impar, descansa por semana.</p>
        <div class="acts"><button class="btn" id="gSched">Generar calendario</button><button class="btn ghost" id="gRe">Regenerar (borra series sin jugar)</button></div></div></div>`
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
        if (b.id === "gSched" || b.id === "gRe") {
          if (b.id === "gRe" && !confirm("Se borran las series sin jugar y se vuelve a sortear. ¿Seguir?")) return
          const n = await rpc("generate_schedule", { p_season_id: sid, p_replace: b.id === "gRe" }); toast(`${n} series creadas.`)
        }
      } catch (err) { fail(err) }
    }
    void nMatches
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
