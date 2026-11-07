import "./styles.css"
import { supabase } from "./supabase.js"
import { loadSeasons, pickSeason, loadSeason } from "./data.js"
import { installHooks, afterApp } from "./actions.js"

const STATUS = { setup: "Pretemporada", draft: "Draft", regular: "Fase regular", playoffs: "Playoffs", finished: "Finalizada" }

const boot = document.createElement("div")
boot.className = "boot"
boot.innerHTML = "<div><b>PPV Draft League</b>Cargando temporada…</div>"
document.body.prepend(boot)

function applyTheme(P) {
  const r = document.documentElement.style
  r.setProperty("--rojo", P.THEME.rojo)
  r.setProperty("--verde", P.THEME.verde)
  r.setProperty("--volt", P.THEME.volt)
  if (P.THEME.azul) r.setProperty("--azul", P.THEME.azul)
}

function setText(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt }

function applyChrome(P) {
  const S = P.SEASON, st = STATUS[S.status] || ""
  const label = `Temporada ${S.number}${S.subtitle ? " · " + S.subtitle : ""}`
  document.title = `PPV Draft League · Temporada ${S.number}`
  setText("#brandSeason", label)
  document.querySelectorAll(".sl").forEach(e => { e.textContent = label })
  document.querySelectorAll(".cn-r").forEach(e => { e.textContent = P.CONF.rojo.name })
  document.querySelectorAll(".cn-a").forEach(e => { e.textContent = P.CONF.azul.name })
  document.querySelectorAll(".sl-n").forEach(e => { e.textContent = `Temporada ${S.number}` })
  setText(".hero .season .a i", `Temporada ${S.number}`)
  setText(".hero .season .b i", st)
  const n = P.TEAMS.length
  const lede = document.querySelector(".hero .lede")
  if (lede) lede.textContent = `${n || "Los"} entrenadores, dos conferencias y un solo campeon. Cada draft construye historias, cada trade redefine destinos y cada batalla acerca al titulo.`
  const stats = document.querySelectorAll("#page-home .strip .stat b")
  const vals = [n, P.CONFS.length || 2, P.WEEKS || P.RULES.regular_weeks || "—", P.RULES.playoff_teams || 8]
  stats.forEach((b, i) => { if (vals[i] != null) b.textContent = vals[i] })
  // fase actual en "Del draft al titulo"
  const phase = { setup: 0, draft: 0, regular: 1, playoffs: 3, finished: 3 }[S.status] ?? 0
  document.querySelectorAll("#page-home .format .step").forEach((s, i) => {
    s.classList.toggle("now", i === phase)
    const lab = s.querySelector(".label"); if (lab) lab.textContent = i === phase ? (S.status === "finished" ? "Terminado" : "En curso") : `Fase ${i + 1}`
  })
  const cta = document.querySelector(".hero .cta .btn")
  if (cta && !["playoffs", "finished"].includes(S.status)) { cta.textContent = S.status === "regular" ? "Ver matches" : "Ver el draft"; cta.href = S.status === "regular" ? "#matches" : "#draft" }
  // MVP de la temporada (antes estaba fijo en el HTML)
  const top = P.MONS_FULL[0], mvp = document.querySelector("#page-home .mvp")
  if (mvp) {
    if (!top) {
      mvp.innerHTML = `<div><div class="label">Lider en KOs · ${label}</div><h3>Por definir</h3><p style="color:var(--mute)">Cuando se juegue la primera semana aqui aparece el Pokemon con mas KOs.</p></div>`
    } else {
      const [name, g, k, d] = top
      mvp.querySelector(".label").textContent = `Lider en KOs · Temporada ${S.number}`
      mvp.querySelector("h3").textContent = name
      const img = mvp.querySelector(".mvp-art"), id = window.__POKE_IDS?.[name]
      if (img) { if (id) img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`; else if (P.SPRITE[name]) img.src = P.SPRITE[name]; else img.remove() }
      const b = mvp.querySelectorAll(".kd b")
      ;[k, d, g, (k / (d || 1)).toFixed(2)].forEach((v, i) => { if (b[i]) b[i].textContent = v })
    }
  }
  setText("#page-home .legend span:nth-child(2)", `Victoria = ${P.RULES.points_win} pts`)
  // barra de archivo y selector de temporada
  const bar = document.getElementById("seasonBar")
  const active = P.SEASONS.find(s => s.is_active)
  if (P.IS_ARCHIVE) {
    bar.hidden = false
    bar.innerHTML = `Archivo · estas viendo la Temporada ${S.number}${active ? `<a href="/#home">Ir a la Temporada ${active.number}</a>` : ""}`
  }
  const dms = document.getElementById("drMineSec")
  if (dms) { if (P.ME < 0 || !P.DRAFT_ORDER.includes(P.ME)) dms.hidden = true; else setText("#drMineTeam", P.TEAMS[P.ME].n) }
  const has = x => P.PERMS.includes("all") || P.PERMS.includes(x)
  if (["admin.access","season.manage","pool.manage","draft.manage","results.approve","market.approve","roles.manage","content.manage"].some(has)) document.getElementById("navAdmin").hidden = false
}

async function start() {
  const isRecovery = /type=recovery/.test(location.hash)
  try {
    let P
    if (window.__PPV_FIXTURE__) P = window.__PPV_FIXTURE__ // solo pruebas locales sin red
    else {
      const { data: { session } } = await supabase.auth.getSession()
      const seasons = await loadSeasons()
      if (!seasons.length) throw new Error("No hay temporadas")
      const season = pickSeason(seasons)
      P = await loadSeason(season, session)
      P.SEASONS = seasons
    }
    const { POKE_IDS } = await import("./pokeids.js")
    window.__POKE_IDS = POKE_IDS
    window.PPV = P
    applyTheme(P)
    installHooks(P)
    await import("./app.js")
    applyChrome(P)
    afterApp(P)
    if (isRecovery) { history.replaceState(null, "", "/#login"); window.PPV_ROUTE?.(); P.hooks.recovery() }
    document.body.classList.add("ready")
  } catch (e) {
    console.error(e)
    boot.classList.add("err")
    boot.innerHTML = `<div><b>No se pudo cargar</b>${String(e.message || e)}<br><br><a class="btn" href="/">Reintentar</a></div>`
  }
  supabase.auth.onAuthStateChange((ev, session) => {
    const before = window.PPV?.USER?.id || null, now = session?.user?.id || null
    if (ev === "PASSWORD_RECOVERY") { location.hash = "#login"; setTimeout(() => window.PPV?.hooks?.recovery?.(), 0); return }
    if ((ev === "SIGNED_IN" || ev === "SIGNED_OUT") && window.PPV && before !== now) location.reload()
  })
}
start()
