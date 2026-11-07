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
let tab = "pend"

export async function renderAdmin(P, ui) {
  const { esc, toast, modal } = ui
  const el = document.getElementById("page-admin")
  if (P.ROLE !== "admin") { el.innerHTML = `<section class="block"><div class="wrap login-box card-a"><h3>Solo admin</h3><p>Entra con la cuenta de administrador.</p><a class="btn" href="#login">Entrar</a></div></section>`; return }
  const S = P.SEASON, sid = S.id
  el.innerHTML = `<section class="t-hero"><div class="wrap"><div class="label">Administrador</div><h1 style="font-family:var(--f-display);font-weight:900;text-transform:uppercase;font-size:clamp(2.4rem,6vw,4.4rem);line-height:.9;margin:.2em 0">Temporada ${S.number}</h1>
    <div class="acts"><span style="color:var(--mute)">Estas editando:</span><select class="inp" id="admSeason" style="max-width:260px">${(P.SEASONS || []).map(s => `<option value="${s.number}" ${s.id === S.id ? "selected" : ""}>Temporada ${s.number}${s.is_active ? " · activa" : ""}</option>`).join("")}</select></div></div></section>
    <div class="wrap s-body"><div class="adm"><div class="adm-tabs" id="admTabs"></div><div id="admBody"><p>Cargando…</p></div></div></div>`

  el.querySelector("#admSeason").onchange = e => { const s = (P.SEASONS || []).find(x => String(x.number) === e.target.value); location.href = (s?.is_active ? "/" : "/?t=" + e.target.value) + "#admin" }
  const [settingsQ, confsQ, teamsQ, stQ, profQ, orderQ, repQ, txQ, wQ, dsQ, seasonsQ] = await Promise.all([
    supabase.from("league_settings").select("*").eq("season_id", sid).maybeSingle(),
    supabase.from("conferences").select("*").eq("season_id", sid).order("sort"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("season_teams").select("*").eq("season_id", sid),
    supabase.from("profiles").select("id,email,role").order("email"),
    supabase.from("draft_order").select("*").eq("season_id", sid).order("draft_position"),
    supabase.from("reports").select("*, match:match_id(id,week,stage,round,team_a,team_b,season_id)").eq("status", "pending").order("created_at"),
    supabase.from("transactions").select("*").eq("status", "pending_admin").order("created_at"),
    supabase.from("waiver_order").select("*").eq("season_id", sid),
    supabase.from("draft_state").select("*").eq("season_id", sid).maybeSingle(),
    supabase.from("seasons").select("*").order("number")
  ])
  const settings = settingsQ.data || {}, confs = confsQ.data || [], teams = teamsQ.data || [], st = stQ.data || []
  const profiles = profQ.data || [], seasons = seasonsQ.data || []
  const reports = (repQ.data || []).filter(r => (r.match?.season_id || r.season_id) === sid)
  const txs = (txQ.data || []).filter(t => (t.season_id || sid) === sid)
  const wpos = Object.fromEntries((wQ.data || []).map(w => [w.team_id, w.position]))
  const tname = id => st.find(x => x.team_id === id)?.display_name || teams.find(t => t.id === id)?.name || "?"
  const fail = e => toast(e.message || String(e))
  const reload = () => renderAdmin(P, ui)

  const TABS = [["pend", "Pendientes", reports.length + txs.length], ["season", "Temporada"], ["rules", "Reglas y puntos"], ["teams", "Conferencias y equipos"], ["pool", "Pool y precios"], ["draft", "Draft y calendario"]]
  const tabs = el.querySelector("#admTabs")
  tabs.innerHTML = TABS.map(([k, l, n]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${l}${n ? `<span class="bdg">${n}</span>` : ""}</button>`).join("")
  tabs.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; tabs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw() }
  const body = el.querySelector("#admBody")

  function draw() {
    ({ pend, season, rules, teams: teamsTab, pool, draft })[tab]()
  }

  // ---------- pendientes ----------
  function pend() {
    const fa = txs.filter(t => t.type === "free_agent"), tr = txs.filter(t => t.type === "trade")
    const byMon = {}; fa.forEach(t => { const k = (t.receive || [])[0] || "—"; (byMon[k] = byMon[k] || []).push(t) })
    Object.values(byMon).forEach(l => l.sort((a, b) => (wpos[a.team_a] ?? 99) - (wpos[b.team_a] ?? 99)))
    const side = (arr) => (arr || []).map(m => `${esc(m.name)} (${m.games.map(g => `J${g.game}: ${g.kills}K/${g.deaths}D`).join(", ")})`).join(" · ") || "—"
    body.innerHTML = `<div class="adm">
      <div class="card-a"><h3>Reportes de series (${reports.length})</h3>${reports.map(r => {
        const m = r.match || {}, games = (r.games || []).map((g, i) => `J${i + 1}: ${g.winner === "teamA" ? esc(tname(m.team_a)) : esc(tname(m.team_b))}${g.replay ? ` <a href="${esc(g.replay)}" target="_blank" rel="noopener">replay</a>` : ""}`).join(" · ")
        return `<div class="q-item"><header><span class="pill">${m.stage === "playoff" ? esc(m.round) : "Semana " + m.week}</span><b>${esc(tname(m.team_a))} vs ${esc(tname(m.team_b))}</b><span class="pill ok">Gana ${esc(r.winner === "teamA" ? tname(m.team_a) : tname(m.team_b))}</span></header>
          <div>${games}</div><div class="mons"><b>${esc(tname(m.team_a))}:</b> ${side(r.team_a_data)}</div><div class="mons"><b>${esc(tname(m.team_b))}:</b> ${side(r.team_b_data)}</div>
          <div class="acts"><button class="btn sm" data-ar="${r.id}">Aprobar</button><button class="btn ghost sm" data-rr="${r.id}">Rechazar</button></div></div>`
      }).join("") || "<p>No hay reportes pendientes.</p>"}</div>
      <div class="card-a"><h3>Free agency (${fa.length})</h3><p class="hint">Agrupado por Pokemon y ordenado por prioridad de waivers.</p>${Object.entries(byMon).map(([mon, l]) => `<div class="q-item"><header><b>${esc(mon)}</b><span class="pill">${l.length} solicitud(es)</span></header>
        ${l.map(t => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="pill warn">Waiver #${wpos[t.team_a] ?? "?"}</span><b>${esc(tname(t.team_a))}</b><span class="mons">suelta: ${esc((t.give || []).join(", ") || "nadie")}</span>
          <button class="btn sm" data-at="${t.id}">Aprobar</button><button class="btn ghost sm" data-rt="${t.id}">Rechazar</button></div>`).join("")}</div>`).join("") || "<p>No hay solicitudes.</p>"}</div>
      <div class="card-a"><h3>Trades (${tr.length})</h3>${tr.map(t => `<div class="q-item"><header><b>${esc(tname(t.team_a))} ⇄ ${esc(tname(t.team_b))}</b></header>
        <div class="mons">${esc(tname(t.team_a))} da: ${esc((t.give || []).join(", "))}</div><div class="mons">${esc(tname(t.team_b))} da: ${esc((t.receive || []).join(", "))}</div>
        <div class="acts"><button class="btn sm" data-at="${t.id}">Aprobar</button><button class="btn ghost sm" data-rt="${t.id}">Rechazar</button></div></div>`).join("") || "<p>No hay trades por aprobar.</p>"}</div></div>`
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
        if (b.dataset.at) { await rpc("approve_transaction", { p_transaction_id: b.dataset.at }); toast("Movimiento aprobado.") }
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
      <div class="acts"><button class="btn" id="rSave">Guardar reglas</button></div></div>`
    body.querySelector("#rSave").onclick = async () => {
      const row = { season_id: sid }
      RULE_FIELDS.forEach(([k, , t]) => { const v = body.querySelector(`[name="${k}"]`).value; row[k] = v === "" ? null : t === "number" ? +v : v })
      const fl = body.querySelector('[name="faint_limit"]').value
      row.faint_limit = fl === "" ? null : +fl
      row.faint_reset_on_transfer = body.querySelector('[name="faint_reset_on_transfer"]').checked
      row.faint_in_playoffs = body.querySelector('[name="faint_in_playoffs"]').checked
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
    const rows = await fetchAll(() => supabase.from("season_pokemon").select("id,points,available,pokemon:pokemon_id(name,type1,type2)").eq("season_id", sid).order("id"))
    rows.sort((a, b) => (b.available - a.available) || (b.points ?? 0) - (a.points ?? 0) || (a.pokemon?.name || "").localeCompare(b.pokemon?.name || ""))
    const dirty = new Map()
    const avail = rows.filter(r => r.available).length
    body.innerHTML = `<div class="adm"><div class="card-a"><h3>Pool de la temporada</h3>
      <p class="hint">${avail} disponibles de ${rows.length} en la Pokedex. Solo los marcados como disponibles entran al draft y a waivers.</p>
      <div class="acts" style="margin-top:0"><input class="inp" id="plQ" placeholder="Buscar…" style="max-width:260px">
        <select class="inp" id="plF" style="max-width:200px"><option value="">Todos</option><option value="on">Disponibles</option><option value="off">No disponibles</option></select>
        <button class="btn" id="plSave" disabled>Guardar cambios</button></div>
      <div class="atbl-w" style="margin-top:12px"><table class="atbl"><thead><tr><th>Disp.</th><th>Pokemon</th><th>Tipos</th><th>Puntos</th></tr></thead><tbody id="plBody"></tbody></table></div></div>
      <div class="card-a"><h3>Carga masiva</h3><p class="hint">Una linea por Pokemon: <code>Nombre,puntos</code> (opcional <code>,no</code> para quitarlo del pool). Ej. <code>Garchomp,18</code></p>
        <label class="fld"><textarea id="plBulk" placeholder="Garchomp,18&#10;Rotom-Wash,12&#10;Ditto,5,no"></textarea></label>
        <div class="acts"><button class="btn" id="plBulkGo">Aplicar lista</button><label class="fld chk"><input type="checkbox" id="plOnly"><span>Quitar del pool todo lo que no este en la lista</span></label></div></div>
      <div class="card-a"><h3>Copiar precios</h3><div class="acts"><select class="inp" id="plFrom" style="max-width:240px">${seasons.filter(s => s.id !== sid).map(s => `<option value="${s.id}">De la Temporada ${s.number}</option>`).join("")}</select><button class="btn ghost" id="plCopy">Reemplazar pool con esa temporada</button></div></div></div>`
    const tb = body.querySelector("#plBody"), q = body.querySelector("#plQ"), fsel = body.querySelector("#plF"), save = body.querySelector("#plSave")
    const paint = () => {
      const t = q.value.trim().toLowerCase(), f = fsel.value
      tb.innerHTML = rows.filter(r => (!t || (r.pokemon?.name || "").toLowerCase().includes(t)) && (!f || (f === "on" ? r.available : !r.available))).slice(0, 400).map(r => {
        const d = dirty.get(r.id) || r
        return `<tr data-id="${r.id}" class="${d.available ? "" : "off"}"><td><input type="checkbox" data-a ${d.available ? "checked" : ""}></td><td>${esc(r.pokemon?.name)}</td><td style="color:var(--mute)">${esc([r.pokemon?.type1, r.pokemon?.type2].filter(Boolean).join(" / "))}</td><td><input class="inp" data-p type="number" min="0" value="${d.points ?? ""}" style="width:80px"></td></tr>`
      }).join("")
    }
    paint(); q.oninput = paint; fsel.onchange = paint
    tb.onchange = e => {
      const tr = e.target.closest("tr"); if (!tr) return
      const id = tr.dataset.id, base = rows.find(r => r.id === id)
      const v = { id, available: tr.querySelector("[data-a]").checked, points: tr.querySelector("[data-p]").value === "" ? null : +tr.querySelector("[data-p]").value }
      dirty.set(id, v); Object.assign(base, v); tr.classList.toggle("off", !v.available); save.disabled = false; save.textContent = `Guardar ${dirty.size} cambio(s)`
    }
    save.onclick = async () => {
      save.disabled = true
      try {
        for (const v of dirty.values()) { const { error } = await supabase.from("season_pokemon").update({ available: v.available, points: v.points }).eq("id", v.id); if (error) throw error }
        toast(`${dirty.size} Pokemon actualizados.`); dirty.clear(); save.textContent = "Guardar cambios"
      } catch (err) { save.disabled = false; fail(err) }
    }
    body.querySelector("#plBulkGo").onclick = async () => {
      const lines = body.querySelector("#plBulk").value.split(/\n+/).map(l => l.split(/[,;\t]/).map(x => x.trim())).filter(l => l[0])
      const payload = lines.map(([name, pts, flag]) => ({ name, points: pts === "" || pts == null ? null : +pts, available: !/^(no|0|false)$/i.test(flag || "") }))
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
          <button class="btn ghost" data-rpc="force_auto_pick">Forzar autopick</button><button class="btn ghost" data-rpc="finish_draft">Terminar</button>
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
          await rpc(b.dataset.rpc, {}); toast("Listo."); reload()
        }
        if (b.id === "gSched" || b.id === "gRe") {
          if (b.id === "gRe" && !confirm("Se borran las series sin jugar y se vuelve a sortear. ¿Seguir?")) return
          const n = await rpc("generate_schedule", { p_season_id: sid, p_replace: b.id === "gRe" }); toast(`${n} series creadas.`)
        }
      } catch (err) { fail(err) }
    }
    void nMatches
  }

  draw()
}
