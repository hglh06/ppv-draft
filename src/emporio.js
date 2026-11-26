// Emporio de la T5: monedas por perder, compra a ciegas por tipo y tier, mano de cartas,
// 1 carta por jornada y cartas boca abajo en el perfil de cada equipo.
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
  chaos: { name: "Caos", short: "Caos", color: "#FF6FB5",
    icon: '<path d="M21 4c-6 0-9 2-9 5s4 3 4 6-3 5-9 5"/><path d="M3 9c3 0 5 1 5 3s-2 3-5 3"/>' }
}
export const ORDER = ["info", "limit", "own", "market", "chaos"]
const ROMAN = ["", "I", "II", "III"]
const TIER_NAME = ["", "Básica", "Intermedia", "Dura"]

// dibujo propio de cada carta (trazos de 24x24)
const ART = {
  "pista-objeto": '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M12 13v3"/>',
  "naturaleza": '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l8-8"/>',
  "vistazo": '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M11 15h2M4.5 12L7 5h3l1 6M19.5 12L17 5h-3l-1 6"/>',
  "set-descubierto": '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21M8 10h4M10 8v4"/>',
  "spread-revelado": '<path d="M3 6h11M18 6h3M3 12h4M11 12h10M3 18h13M20 18h1"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  "velocimetro": '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6M8 17h8"/>',
  "lista-completa": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  "los-4-elegidos": '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  "movimiento-vetado": '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/><path d="M3 3l18 18"/>',
  "sin-danzas-clima": '<path d="M7 18a4 4 0 0 1 0-8 6 6 0 0 1 11.3 2A3.5 3.5 0 0 1 17.5 18z"/><path d="M3 3l18 18"/>',
  "veto": '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  "sin-fake-out": '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2.5-3.5a1.4 1.4 0 0 1 2.2-1.8L8 14"/><path d="M3 3l18 18"/>',
  "sin-tailwind": '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/><path d="M3 3l18 18"/>',
  "veto-total": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M5.6 5.6l12.8 12.8"/>',
  "juega-con-5": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M15 7h-5l-.5 4.5a3.5 3.5 0 1 1 0 4"/>',
  "ajuste-objeto": '<path d="M7 9h10l-1 12H8z"/><path d="M10 9V7a2 2 0 0 1 4 0v2M2 5l2.5-2.5L7 5M22 19l-2.5 2.5L17 19M4.5 2.5V9M19.5 21.5V15"/>',
  "ajuste-movimiento": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  "cambio-caliente": '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z"/>',
  "set-doble": '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  "revancha-preparada": '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  "borron-cuenta-nueva": '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 3v4h4"/>',
  "plan-maestro": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h4"/>',
  "rebaja": '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  "fichaje-tardio": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  "primero-fila": '<path d="M5 22V3M5 4h13l-2.5 4.5L18 13H5"/>',
  "rebaja-doble": '<path d="M2 12V4h8l8 8-8 8z"/><path d="M13 4h1l8 8-8 8"/><circle cx="6" cy="8" r="1.3"/>',
  "fichaje-sin-castigo": '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  "presupuesto-5": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6"/>',
  "repetido-extra": '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  "semana-sin-banda": '<path d="M4 8c4-3 12-3 16 0M4 8l3 12M20 8l-3 12"/><path d="M3 3l18 18"/>',
  "semana-sin-bayas": '<circle cx="9" cy="14" r="5"/><circle cx="16" cy="12" r="4"/><path d="M12 5c1-2 3-3 5-3"/><path d="M3 3l18 18"/>',
  "semana-sin-velocidad": '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/><path d="M3 3l18 18"/>',
  "cts-para-todos": '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  "todos-con-5": '<circle cx="6" cy="8" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="6" r="2.5"/><circle cx="8" cy="16" r="2.5"/><circle cx="16" cy="16" r="2.5"/>',
  "semana-singles": '<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M11 12h2"/>',
  "terremoto-mercado": '<path d="M2 12h4l2-6 3 12 3-9 2 5 2-2h4"/>'
}

let P, ui
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))
const svg = (inner, size, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
const catIcon = (cat, size = 16) => svg(CATS[cat]?.icon || "", size)
const def = id => P.CARD_DEFS.find(d => d.id === id)
const price = t => P.RULES["card_price_t" + t]
const teamOf = id => P.TEAMS.find(t => t.id === id)
const slug = t => t ? t.n.toLowerCase().replace(/\s+/g, "-") : ""
const myTeamId = () => P.TEAMS[P.ME]?.id
const myHand = () => P.CARD_TABLE.filter(c => c.team_id === myTeamId() && c.status === "held")
const myUsed = () => P.CARD_TABLE.filter(c => c.team_id === myTeamId() && c.status === "used")
const open = () => !!P.RULES.cards_enabled && !P.IS_ARCHIVE

export function cardFace(d, extra = "") {
  if (!d) return ""
  const c = CATS[d.category] || CATS.chaos
  return `<article class="pcard" style="--cc:${c.color}" data-card="${esc(d.id)}" ${extra}>
    <header><span class="pc-cat">${catIcon(d.category)}${esc(c.short)}</span><span class="pc-tier" title="Tier ${d.tier}">${ROMAN[d.tier] || ""}</span></header>
    <div class="pc-art">${svg(ART[d.id] || c.icon, 58, 1.7)}</div>
    <h4>${esc(d.name)}</h4>
    <p class="pc-eff">${esc(d.effect)}</p>
    ${d.rule ? `<p class="pc-rule">${esc(d.rule)}</p>` : ""}
    <footer><span>Tier ${d.tier} · ${TIER_NAME[d.tier] || ""}</span><span>PPV · T${P.SEASON.number}</span></footer>
  </article>`
}
export function cardBack(cat, tier, label = "") {
  const c = CATS[cat] || { name: "Carta", color: "#55555e" }
  return `<article class="pcard back" style="--cc:${c.color}"><div class="pc-back">
    <span class="pc-back-ico">${cat ? catIcon(cat, 40) : "?"}</span><b>${esc(c.name)}</b>${tier ? `<span class="pc-back-tier">Tier ${ROMAN[tier]}</span>` : ""}${label ? `<small>${esc(label)}</small>` : ""}<span class="pc-back-brand">Emporio · PPV</span></div></article>`
}

// jornada en la que se usaria una carta hoy: la de mi siguiente serie por jugar
function nextWeek() {
  const mine = P.PENDING.filter(p => p.a === P.ME || p.b === P.ME).map(p => p.w).filter(Boolean)
  if (mine.length) return Math.min(...mine)
  const done = (P.RAW_MATCHES || []).map(m => m.w || m[0]).filter(n => typeof n === "number")
  return Math.max(1, ...(done.length ? [Math.max(...done) + 1] : [1]))
}
function weekInPlay() {
  const ws = P.PENDING.map(p => p.w).filter(Boolean)
  return ws.length ? Math.min(...ws) : Math.max(0, ...P.CARD_TABLE.map(c => c.used_week || 0))
}

// ---------- perfil de equipo: su mano boca abajo y la carta usada ----------
export function cardSlot(ti) {
  const t = P.TEAMS[ti]; if (!t || !P.RULES.cards_enabled) return ""
  const mine = ti === P.ME
  const held = P.CARD_TABLE.filter(c => c.team_id === t.id && c.status === "held")
  const used = P.CARD_TABLE.filter(c => c.team_id === t.id && c.status === "used").sort((a, b) => (b.used_week || 0) - (a.used_week || 0))[0]
  if (!held.length && !used) return ""
  const max = P.RULES.cards_max_hand || 3
  return `<div class="p-cards"><span class="label">Emporio · ${held.length}/${max} cartas${mine ? ` · ${P.MY_COINS} monedas` : ""}</span>
    <div class="p-cards-row">${held.map(c => { const d = c.card_id ? def(c.card_id) : null; return `<div class="p-card-mini">${d ? cardFace(d) : cardBack(c.category, c.tier)}</div>` }).join("")}
    ${used ? `<div class="p-card-mini used"><span class="label">Jugó en J${used.used_week}</span>${cardFace(def(used.card_id))}</div>` : ""}</div>
    ${mine ? `<a class="btn sm" href="#emporio">Ir al Emporio</a>` : `<small>Todos ven el tipo y el tier; la carta se revela cuando la juega.</small>`}</div>`
}

function rulesLine() {
  const R = P.RULES
  const bits = [`Ganas <b>${R.coins_per_series_loss}</b> moneda${R.coins_per_series_loss === 1 ? "" : "s"} por serie perdida`]
  if (R.coins_per_game_loss) bits.push(`<b>${R.coins_per_game_loss}</b> por cada game perdido`)
  return `${bits.join(" y ")}${R.coins_in_playoffs ? " (también en playoffs)" : ""}. Compras a ciegas por tipo y tier: te toca una carta al azar de las que hay. Máximo <b>${R.cards_max_hand}</b> cartas en la mano y <b>1</b> por jornada.${R.cards_starting ? ` Cada equipo empieza con ${R.cards_starting} cartas básicas.` : ""}`
}

export function renderEmporio() {
  const el = document.getElementById("page-emporio"); if (!el) return
  const R = P.RULES, me = P.TEAMS[P.ME], hand = myHand(), max = R.cards_max_hand || 3
  const inPlayWeek = weekInPlay()
  const inPlay = P.CARD_TABLE.filter(c => c.status === "used" && c.used_week === inPlayWeek)
  const shop = open() && me ? `<section class="emp-shop"><div class="sec-head"><div><div class="label">Tienda</div><h2>Compra a <em>ciegas</em></h2></div>
      <div class="emp-wallet"><span class="label">Tus monedas</span><b class="num">${P.MY_COINS}</b><span>${hand.length}/${max} cartas</span></div></div>
      <div class="emp-grid">${ORDER.map(k => `<div class="emp-col" style="--cc:${CATS[k].color}"><h3>${catIcon(k, 20)} ${CATS[k].name}</h3>
        ${[1, 2, 3].map(t => { const n = P.CARD_DEFS.filter(d => d.active && d.category === k && d.tier === t).length, p = price(t)
          const why = !n ? "Sin cartas" : hand.length >= max ? "Mano llena" : P.MY_COINS < p ? "No te alcanza" : ""
          return `<button type="button" class="emp-buy" data-buy="${k}|${t}" ${why ? "disabled" : ""} title="${why}"><span class="emp-t">Tier ${ROMAN[t]}<small>${TIER_NAME[t]}</small></span><span class="emp-p num">${p}<small>monedas</small></span><span class="emp-n">${n} posible${n === 1 ? "" : "s"}</span></button>` }).join("")}</div>`).join("")}</div></section>` : ""
  el.innerHTML = `<section class="t-hero"><div class="wrap"><div class="label">Temporada ${P.SEASON.number} · Cartas de la liga</div>
      <h1 class="cards-h1">Emporio</h1><p class="cards-lede">${R.cards_enabled ? rulesLine() : "El Emporio está cerrado en esta temporada."}</p>
      <div class="cards-legend">${ORDER.map(k => `<span style="--cc:${CATS[k].color}">${catIcon(k)}${CATS[k].name}</span>`).join("")}</div></div></section>
    <div class="wrap s-body">
      ${open() && !me && P.USER ? `<p class="hint">Tu cuenta no tiene equipo en esta temporada, así que no puedes comprar.</p>` : ""}
      ${open() && !P.USER ? `<p class="hint"><a href="#login">Inicia sesión</a> para ver tus monedas y comprar.</p>` : ""}
      ${shop}
      ${me && (hand.length || myUsed().length) ? `<section><div class="sec-head"><div><div class="label">Tu mano</div><h2>Mis <em>cartas</em></h2></div></div>
        <div class="cards-grid">${hand.map(c => `<div class="hand-c">${cardFace(def(c.card_id))}<button type="button" class="btn sm" data-use="${c.hand_id}">Usar en J${nextWeek()}</button></div>`).join("")}
        ${myUsed().sort((a, b) => b.used_week - a.used_week).map(c => `<div class="hand-c used">${cardFace(def(c.card_id))}<span class="label">Usada en J${c.used_week}</span></div>`).join("")}</div></section>` : ""}
      ${inPlay.length ? `<section><div class="sec-head"><div><div class="label">Jornada ${inPlayWeek}</div><h2>Cartas en <em>juego</em></h2></div></div>
        <div class="cards-board">${inPlay.map(c => { const t = teamOf(c.team_id), d = def(c.card_id)
          return `<div class="cb-item">${cardFace(d)}<a href="#team-${slug(t)}">${t ? window.__crest(t) : ""}<span>${esc(t?.n || "?")}</span></a></div>` }).join("")}</div></section>` : ""}
      <section class="emp-cat"><div class="sec-head"><div><div class="label">${P.CARD_DEFS.filter(d => d.active).length} cartas en el mazo</div><h2>Lo que te puede <em>tocar</em></h2></div></div>
      ${ORDER.map(k => { const list = P.CARD_DEFS.filter(d => d.category === k && d.active); if (!list.length) return ""
        return `<div class="cards-cat" style="--cc:${CATS[k].color}"><div class="conf-title"><h2>${catIcon(k, 26)} ${CATS[k].name}</h2><span class="label">${list.length} cartas</span><span class="rule"></span></div>
          ${[1, 2, 3].map(t => { const tl = list.filter(d => d.tier === t); return tl.length ? `<div class="emp-tier"><span class="label">Tier ${ROMAN[t]} · ${TIER_NAME[t]} · ${price(t)} monedas</span><div class="cards-grid">${tl.map(d => cardFace(d)).join("")}</div></div>` : "" }).join("")}</div>` }).join("")}</section>
    </div>`
}

async function buy(cat, tier) {
  const c = CATS[cat], p = price(tier)
  if (!confirm(`¿Comprar una carta de ${c.name} tier ${ROMAN[tier]} por ${p} monedas? Te toca una al azar.`)) return
  try {
    const r = await rpc("buy_card", { p_category: cat, p_tier: tier })
    const d = def(r.card_id)
    P.CARD_TABLE.push({ hand_id: r.hand_id, team_id: myTeamId(), status: "held", category: cat, tier, card_id: r.card_id })
    P.MY_COINS = r.balance
    const m = ui.modal(`<div class="offer"><div class="label">${esc(c.name)} · Tier ${ROMAN[tier]}</div><h2>Te tocó</h2>
      <div class="reveal-wrap"><div class="flip"><div class="flip-in">${cardBack(cat, tier)}${cardFace(d)}</div></div></div>
      <p class="hint" style="margin-top:14px">Te queda${r.balance === 1 ? "" : "n"} ${r.balance} moneda${r.balance === 1 ? "" : "s"}. Úsala desde tu mano cuando quieras (1 por jornada).</p></div>`, c.color)
    m.el.classList.add("offer-panel")
    requestAnimationFrame(() => setTimeout(() => m.el.querySelector(".flip")?.classList.add("on"), 250))
    renderEmporio()
  } catch (err) { ui.toast(err.message || String(err)) }
}

async function useCard(handId) {
  const c = P.CARD_TABLE.find(x => x.hand_id === handId); const d = c && def(c.card_id); if (!d) return
  const w = nextWeek()
  const raw = prompt(`¿En qué jornada usas "${d.name}"? Solo puedes usar 1 carta por jornada y todos la verán.`, String(w))
  if (raw === null) return
  const wk = parseInt(raw, 10); if (!wk) return ui.toast("Escribe el número de jornada.")
  try {
    await rpc("use_card", { p_hand: handId, p_week: wk })
    Object.assign(c, { status: "used", used_week: wk, used_at: new Date().toISOString() })
    ui.toast(`Usaste ${d.name} en la jornada ${wk}. Avísale a tu rival${d.category === "chaos" ? " y a la liga" : ""}.`)
    renderEmporio()
  } catch (err) { ui.toast(err.message || String(err)) }
}

export function setupCards(ppv, tools) {
  P = ppv; ui = tools
  P.CARD_DEFS = P.CARD_DEFS || []; P.CARD_TABLE = P.CARD_TABLE || []; P.MY_COINS = P.MY_COINS || 0
  window.__cardSlot = ti => { try { return cardSlot(ti) } catch (e) { return "" } }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-buy]"); if (b && !b.disabled) { const [k, t] = b.dataset.buy.split("|"); buy(k, +t); return }
    const u = e.target.closest("[data-use]"); if (u) useCard(u.dataset.use)
  })
  if (location.hash === "#tarjetas") location.hash = "#emporio"
}

// aviso en Home cuando hay cartas de Caos en juego (afectan a todos)
export function emporioNotice() {
  if (!P.RULES.cards_enabled || P.IS_ARCHIVE) return
  const w = weekInPlay(), chaos = P.CARD_TABLE.filter(c => c.status === "used" && c.used_week === w && c.category === "chaos")
  if (!chaos.length) return
  const host = document.querySelector("#page-home .s-body") || document.getElementById("page-home"); if (!host || host.querySelector(".chaos-note")) return
  const n = document.createElement("a"); n.className = "chaos-note"; n.href = "#emporio"
  n.innerHTML = `<span class="label">Caos · Jornada ${w}</span>${chaos.map(c => { const d = def(c.card_id), t = teamOf(c.team_id); return `<b>${esc(d?.name)}</b><span>${esc(d?.effect)} <i>— la jugó ${esc(t?.n || "?")}</i></span>` }).join("")}`
  host.prepend(n)
}
