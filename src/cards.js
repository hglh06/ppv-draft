// Tarjetas de bono de la T5: catalogo, eleccion de 1 de 3, tablero boca abajo y carta en el perfil.
import { rpc } from "./supabase.js"

export const CATS = {
  info: { name: "Información", short: "Info", color: "#3D8BFF",
    icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>' },
  limit: { name: "Limitar al rival", short: "Limitar", color: "#FF4B4B",
    icon: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>' },
  own: { name: "Ventaja propia", short: "Ventaja", color: "#FFC93C",
    icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
  market: { name: "Mercado", short: "Mercado", color: "#35D07F",
    icon: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>' },
  table: { name: "Tabla y pronósticos", short: "Tabla", color: "#A774FF",
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  special: { name: "Especiales", short: "Especial", color: "#FF6FB5",
    icon: '<path d="M12 2l2.2 6.6L21 9l-5.4 4.1L17.6 20 12 16l-5.6 4 2-6.9L3 9l6.8-.4z"/>' }
}
const ORDER = ["info", "limit", "own", "market", "table", "special"]
// dibujo propio de cada carta (trazos de 24x24)
const ART = {
  "vistazo": '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M11 15h2M4.5 12L7 5h3l1 6M19.5 12L17 5h-3l-1 6"/>',
  "hoja-abierta": '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 13h7M9 17h5"/>',
  "set-descubierto": '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21M8 10h4M10 8v4"/>',
  "spread-revelado": '<path d="M3 6h11M18 6h3M3 12h4M11 12h10M3 18h13M20 18h1"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  "veto": '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  "objeto-vetado": '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M10 12.5l4 4M14 12.5l-4 4"/>',
  "movimiento-vetado": '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/><path d="M3 3l18 18"/>',
  "ajuste-objeto": '<path d="M7 9h10l-1 12H8z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M2 5l2.5-2.5L7 5M22 19l-2.5 2.5L17 19M4.5 2.5V9M19.5 21.5V15"/>',
  "cambio-caliente": '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z"/><path d="M12 22a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1.5-2.5 2.5-4 1 1.5 2.5 2.5 2.5 4A2.5 2.5 0 0 1 12 22z"/>',
  "ajuste-movimiento": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  "fichaje-tardio": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  "primero-fila": '<path d="M5 22V3M5 4h13l-2.5 4.5L18 13H5"/>',
  "rebaja": '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/><path d="M10 15l5-5"/>',
  "prestamo": '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 3v4h4M12 8v4l2.5 2.5"/>',
  "pronostico-doble": '<circle cx="12" cy="10" r="7"/><path d="M7.5 21h9M9 17l-1 4M15 17l1 4M9.5 8.5a3 3 0 0 1 3-2"/>',
  "bono-remontada": '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  "seguro": '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  "antimagia": '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M3 21L21 3"/>',
  "espejo": '<path d="M12 2v20"/><path d="M9 7l-5 5 5 5zM15 7l5 5-5 5z"/>',
  "mulligan": '<path d="M3 7h4l10 10h4M18 4l3 3-3 3M3 17h4l3-3M14 10l3-3M18 14l3 3-3 3"/>'
}
const artSvg = (d, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[d.id] || CATS[d.category]?.icon || ""}</svg>`
const svg = (cat, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CATS[cat]?.icon || ""}</svg>`

let P, ui
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))
const def = id => P.CARD_DEFS.find(d => d.id === id)
const num = d => String(d.sort || 0).padStart(2, "0")

export function cardFace(d, extra = "") {
  if (!d) return ""
  const c = CATS[d.category] || CATS.special
  return `<article class="pcard" style="--cc:${c.color}" data-card="${esc(d.id)}" ${extra}>
    <header><span class="pc-cat">${svg(d.category, 16)}${esc(c.short)}</span><span class="pc-n num">${num(d)}</span></header>
    <div class="pc-art">${artSvg(d, 58)}</div>
    <h4>${esc(d.name)}</h4>
    <p class="pc-eff">${esc(d.effect)}</p>
    ${d.rule ? `<p class="pc-rule">${esc(d.rule)}</p>` : ""}
    <footer><span>Vale 1 jornada</span><span>PPV · T${P.SEASON.number}</span></footer>
  </article>`
}
export function cardBack(cat, label = "") {
  const c = CATS[cat] || { name: "Tarjeta", color: "#55555e" }
  return `<article class="pcard back" style="--cc:${c.color}"><div class="pc-back">
    <span class="pc-back-ico">${cat ? svg(cat, 40) : "?"}</span><b>${esc(c.name)}</b>${label ? `<small>${esc(label)}</small>` : ""}<span class="pc-back-brand">PPV Draft League</span></div></article>`
}

// carta "en juego" de un equipo: la mas reciente cuya jornada aun no termina (o la ultima usada)
function activeFor(teamId) {
  const list = P.CARD_BOARD.filter(c => c.team_id === teamId && c.status === "chosen").sort((a, b) => b.for_week - a.for_week)
  return list[0] || null
}
const openOffer = () => P.MY_CARDS.find(g => g.status === "offered")

export function cardSlot(ti) {
  const t = P.TEAMS[ti]; if (!t || !P.RULES.cards_enabled) return ""
  const c = activeFor(t.id), mine = ti === P.ME, offer = mine ? openOffer() : null
  if (!c && !offer) return ""
  const d = c?.card_id ? def(c.card_id) : null
  const head = c ? `Tarjeta · Jornada ${c.for_week}` : "Tarjeta por elegir"
  return `<div class="p-card"><span class="label">${head}</span>
    ${c ? `<div class="p-card-mini">${d ? cardFace(d) : cardBack(c.category, mine ? "" : "Boca abajo")}</div>` : ""}
    ${offer ? `<button type="button" class="btn sm" data-card-offer>Elegir tu tarjeta</button>` : ""}
    ${c && !d ? `<small>Todos ven el tipo; la carta se revela al terminar su serie.</small>` : ""}</div>`
}

function rulesLine() {
  const R = P.RULES
  if (!R.cards_enabled) return "Las tarjetas estan apagadas en esta temporada."
  const where = R.cards_cutoff ? `y vas del lugar ${R.cards_cutoff} hacia abajo ${R.cards_scope === "overall" || (P.CKEYS || [0, 0]).length === 1 ? "en la tabla general" : "de tu conferencia"}` : ""
  return `Si pierdes tu serie ${where}, al entrar a la pagina te salen 3 tarjetas al azar y eliges 1 para la siguiente jornada.${R.cards_block_after_use ? " Si usaste tarjeta y vuelves a perder, esa semana no recibes." : ""}`
}

export function renderCardsPage() {
  const el = document.getElementById("page-tarjetas"); if (!el) return
  const offer = openOffer()
  const lastWeek = Math.max(0, ...P.CARD_BOARD.map(c => c.for_week))
  const inPlay = P.CARD_BOARD.filter(c => c.for_week === lastWeek && c.status === "chosen")
  const team = id => P.TEAMS.find(t => t.id === id)
  el.innerHTML = `<section class="t-hero"><div class="wrap"><div class="label">Temporada ${P.SEASON.number} · Bonos para los de abajo</div>
      <h1 class="cards-h1">Tarjetas</h1><p class="cards-lede">${esc(rulesLine())}</p>
      <div class="cards-legend">${ORDER.map(k => `<span style="--cc:${CATS[k].color}">${svg(k, 16)}${CATS[k].name}</span>`).join("")}</div></div></section>
    <div class="wrap s-body">
      ${offer ? `<section class="cards-offer-cta"><div><span class="label">Tienes tarjeta</span><h3>Elige 1 de 3 para la jornada ${offer.for_week}</h3></div><button type="button" class="btn" data-card-offer>Ver mis opciones</button></section>` : ""}
      ${inPlay.length ? `<section><div class="sec-head"><div><div class="label">Jornada ${lastWeek}</div><h2>Tarjetas en <em>juego</em></h2></div></div>
        <div class="cards-board">${inPlay.map(c => { const t = team(c.team_id), d = c.card_id ? def(c.card_id) : null
          return `<div class="cb-item">${d ? cardFace(d) : cardBack(c.category, "Boca abajo")}<a href="#team-${t ? t.n.toLowerCase().replace(/\s+/g, "-") : ""}">${t ? window.__crest(t) : ""}<span>${esc(t?.n || "?")}</span></a></div>` }).join("")}</div></section>` : ""}
      ${ORDER.map(k => { const list = P.CARD_DEFS.filter(d => d.category === k && d.active); if (!list.length) return ""
        return `<section class="cards-cat" style="--cc:${CATS[k].color}"><div class="conf-title"><h2>${svg(k, 26)} ${CATS[k].name}</h2><span class="label">${list.length} tarjetas</span><span class="rule"></span></div>
          <div class="cards-grid">${list.map(d => cardFace(d)).join("")}<div class="cards-back-sample">${cardBack(k, "Asi la ven los demas")}</div></div></section>` }).join("")}
    </div>`
}

export function openOfferModal() {
  const g = openOffer(); if (!g) return
  const draw = grant => {
    const m = ui.modal(`<div class="offer"><div class="label">Perdiste la jornada ${grant.week} · Tarjeta para la jornada ${grant.for_week}</div>
      <h2>Elige 1 tarjeta</h2><p class="hint">Solo una. Las otras dos se descartan.${grant.offered.includes("mulligan") && !grant.mulligan_used ? " Mulligan cambia las 3 por otras 3 (una vez)." : ""}</p>
      <div class="offer-row">${grant.offered.map(id => def(id)).filter(Boolean).map(d => `<div class="offer-c">${cardFace(d)}<button type="button" class="btn sm" data-pick="${esc(d.id)}">${d.id === "mulligan" ? "Usar Mulligan" : "Elegir esta"}</button></div>`).join("")}</div>
      <p class="hint" style="margin-top:14px">Si no eliges antes de jugar tu serie de la jornada ${grant.for_week}, la tarjeta vence.</p></div>`, "var(--volt)")
    m.el.classList.add("offer-panel")
    m.el.onclick = async e => {
      const b = e.target.closest("[data-pick]"); if (!b) return
      const d = def(b.dataset.pick)
      if (d.id !== "mulligan" && !confirm(`¿Quedarte con "${d.name}" para la jornada ${grant.for_week}?`)) return
      b.disabled = true
      try {
        const r = await rpc("choose_card", { p_grant: grant.id, p_card: d.id })
        if (r?.offered) { grant.offered = r.offered; grant.mulligan_used = true; m.close(); draw(grant); return }
        grant.status = "chosen"; grant.chosen = d.id
        const row = P.CARD_BOARD.find(c => c.grant_id === grant.id)
        if (row) Object.assign(row, { status: "chosen", card_id: d.id, category: d.category })
        else P.CARD_BOARD.push({ grant_id: grant.id, team_id: grant.team_id, week: grant.week, for_week: grant.for_week, status: "chosen", category: d.category, card_id: d.id })
        m.close(); ui.toast(`Elegiste ${d.name}. Los demas solo veran que es de ${CATS[d.category].name}.`)
        if (location.hash === "#tarjetas") renderCardsPage(); else window.PPV_ROUTE?.()
      } catch (err) { b.disabled = false; ui.toast(err.message || String(err)) }
    }
  }
  draw(g)
}

export function setupCards(ppv, tools) {
  P = ppv; ui = tools
  P.CARD_DEFS = P.CARD_DEFS || []; P.CARD_BOARD = P.CARD_BOARD || []; P.MY_CARDS = P.MY_CARDS || []
  window.__cardSlot = ti => { try { return cardSlot(ti) } catch (e) { return "" } }
  document.addEventListener("click", e => { if (e.target.closest("[data-card-offer]")) openOfferModal() })
}

// al entrar: si hay tarjeta por elegir, se muestra sola (una vez por sesion del navegador)
export function autoOffer() {
  const g = openOffer(); if (!g || P.IS_ARCHIVE) return
  let seen = null; try { seen = sessionStorage.getItem("ppvOffer") } catch (e) { }
  if (seen === g.id + ":" + g.offered.join(",")) return
  try { sessionStorage.setItem("ppvOffer", g.id + ":" + g.offered.join(",")) } catch (e) { }
  setTimeout(openOfferModal, 600)
}
