// Carga una temporada desde Supabase y la convierte a las mismas formas de datos
// que usaba el prototipo del rediseno (TEAMS, RAW_MATCHES, PROFILES, POOL, etc.).
import { supabase, fetchAll } from "./supabase.js"
import { POKE_IDS } from "./pokeids.js"

const LOCAL_LOGOS = {
  "inter-di-lorenzo": "inter-di-lorenzo.webp", "canolovers": "canolovers.webp", "chaewons": "chaewons.webp",
  "clangourous-chromes": "clangourous-chromes.webp", "vampotros": "vampotros.webp", "blue-cock": "blue-cock.webp",
  "mamitas-la-paz": "mamitas-la-paz.webp", "los-diggers": "diggers.webp", "canolo-haters": "canolo-haters.webp",
  "los-griyos": "los-griyos.webp", "mega-avinites": "mega-avinites.webp", "los-pats": "los-pats.webp",
  "richampions-vgc": "richampions-vgc.png", "golden-tapus": "golden-tapus.webp", "brandogerpons": "brandogerpons.webp",
  "pokevmon": "pokevmon.webp", "winstoni": "winstoni.webp", "browtlans": "browtlans.webp"
}
// Campeones de temporadas anteriores a la base de datos
const HOF_PAST = [[1, "Inter Di Lorenzo", "Season 1 y 3 Champ"], [2, "Mega Avinites", "Season 2 Champ"], [3, "Inter Di Lorenzo", "Season 1 y 3 Champ"]]

const slug = n => n.toLowerCase().replace(/\s+/g, "-")
const hue = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
const ytId = u => {
  if (!u) return null
  const m = String(u).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{6,})/)
  return m ? m[1] : null
}
const lc = s => (s || "").toLowerCase()

export async function loadSeasons() {
  const { data, error } = await supabase.from("seasons").select("*").order("number", { ascending: false })
  if (error) throw error
  return data || []
}

export function pickSeason(seasons) {
  const q = new URLSearchParams(location.search).get("t")
  const byNum = q && seasons.find(s => String(s.number) === q)
  return byNum || seasons.find(s => s.is_active) || seasons[0]
}

export async function loadSeason(season, session) {
  const sid = season.id
  const [settingsQ, confsQ, stQ, matchesQ, stats, rosters, pool, orderQ, picksQ, txQ, waiversQ, escQ, seasonsAll] = await Promise.all([
    supabase.from("league_settings").select("*").eq("season_id", sid).maybeSingle(),
    supabase.from("conferences").select("*").eq("season_id", sid).order("sort"),
    supabase.from("season_teams").select("*, team:team_id(id,name,user_id,coach_title,favorite_pokemon,logo,champions_id)").eq("season_id", sid),
    supabase.from("matches").select("*").eq("season_id", sid).order("week", { ascending: true }),
    fetchAll(() => supabase.from("pokemon_stats").select("match_id,team_id,pokemon_name,game,kills,deaths,stage,week").eq("season_id", sid).order("id")),
    fetchAll(() => supabase.from("rosters").select("id,team_id,obtained_method,obtained_week,created_at,pokemon:pokemon_id(name,type1,type2,ability1,ability2,hiddenability,sprite)").eq("season_id", sid).order("id")),
    fetchAll(() => supabase.from("season_pokemon").select("points,available,pokemon:pokemon_id(id,name,type1,type2,sprite)").eq("season_id", sid).order("id")),
    supabase.from("draft_order").select("team_id,draft_position").eq("season_id", sid).order("draft_position"),
    supabase.from("draft_picks").select("team_id,round,pick_number,pokemon:pokemon_id(name)").eq("season_id", sid).order("pick_number"),
    supabase.from("transactions").select("*").eq("season_id", sid).order("created_at", { ascending: false }),
    supabase.from("waiver_order").select("*").eq("season_id", sid).order("position"),
    supabase.from("pokemon_escapes").select("*, pokemon:pokemon_id(name)").eq("season_id", sid).order("created_at", { ascending: false }),
    supabase.from("seasons").select("id,number,champion_team_id,status").order("number")
  ])
  const RULES = Object.assign({ roster_size: 8, max_points: 60, points_win: 3, points_loss: 0, playoff_teams: 8, max_fa: 10, faint_limit: null, trade_max_diff: 3, best_of: 3 }, settingsQ.data || {})
  const confs = confsQ.data || []
  const KEYS = ["rojo", "azul"]
  const confKey = {}; confs.slice(0, 2).forEach((c, i) => { confKey[c.id] = KEYS[i] })
  const CONF = {
    rojo: { name: confs[0]?.name || "Conferencia 1", v: "var(--rojo)", hex: confs[0]?.color || "#FF4B2B", id: confs[0]?.id },
    azul: { name: confs[1]?.name || "Conferencia 2", v: "var(--verde)", hex: confs[1]?.color || "#7ED13A", id: confs[1]?.id }
  }

  // ---------- equipos y standings ----------
  const st = (stQ.data || []).filter(x => confKey[x.conference_id])
  const unassigned = (stQ.data || []).filter(x => !confKey[x.conference_id])
  const regular = (matchesQ.data || []).filter(m => (m.stage || "regular") === "regular")
  const done = regular.filter(m => m.status === "completed")
  const tally = {}
  st.forEach(x => { tally[x.team_id] = { w: 0, l: 0, d: 0 } })
  const gamesOf = m => {
    const g = Array.isArray(m.games) ? m.games : []
    return g.map(x => x?.winner === "teamA" ? "a" : x?.winner === "teamB" ? "b" : "").filter(Boolean).join("")
  }
  done.forEach(m => {
    const seq = gamesOf(m), ga = [...seq].filter(x => x === "a").length, gb = seq.length - ga
    const A = tally[m.team_a], B = tally[m.team_b]
    if (!A || !B) return
    const aWon = m.winner ? m.winner === "teamA" : ga > gb
    if (aWon) { A.w++; B.l++ } else { B.w++; A.l++ }
    A.d += ga - gb; B.d += gb - ga
  })
  const pts = t => t.w * RULES.points_win + t.l * RULES.points_loss
  const TEAMS = []
  KEYS.forEach(k => {
    st.filter(x => confKey[x.conference_id] === k).map(x => {
      const name = x.display_name || x.team?.name || "Equipo"
      const s = slug(name), h = hue(name)
      return {
        id: x.team_id, n: name, c: k, ...tally[x.team_id], h: [h, (h + 30) % 360],
        abbr: x.abbr || name.replace(/^(Los|Las|La|El)\s+/i, "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(),
        logoLocal: LOCAL_LOGOS[s] || null, logo: x.logo || x.team?.logo || null,
        coach: x.coach_name || "", title: x.team?.coach_title || "", fav: x.team?.favorite_pokemon || "",
        user_id: x.team?.user_id || null, champions_id: x.team?.champions_id || null
      }
    }).sort((a, b) => pts(b) - pts(a) || b.d - a.d || a.n.localeCompare(b.n)).forEach(t => TEAMS.push(t))
  })
  const IDX = {}; TEAMS.forEach((t, i) => { IDX[t.id] = i })
  const ABBR = TEAMS.map(t => t.abbr)

  // ---------- partidos ----------
  const RAW_MATCHES = [], MATCH_IDS = [], GAMES = []
  const statsBy = {}
  stats.forEach(s => { (statsBy[s.match_id] = statsBy[s.match_id] || []).push(s) })
  done.filter(m => IDX[m.team_a] != null && IDX[m.team_b] != null).sort((x, y) => x.week - y.week).forEach(m => {
    const seq = gamesOf(m)
    if (!seq) return
    const ids = (Array.isArray(m.replays) ? m.replays : []).map(ytId).filter(Boolean)
    RAW_MATCHES.push([m.week, IDX[m.team_a], IDX[m.team_b], seq, ids])
    MATCH_IDS.push(m.id)
    const rows = statsBy[m.id] || []
    GAMES.push([...seq].map((_, gi) => [
      rows.filter(r => r.game === gi + 1 && r.team_id === m.team_a).map(r => r.pokemon_name),
      rows.filter(r => r.game === gi + 1 && r.team_id === m.team_b).map(r => r.pokemon_name)
    ]))
  })
  const PENDING = regular.filter(m => m.status !== "completed" && IDX[m.team_a] != null && IDX[m.team_b] != null)
    .map(m => ({ id: m.id, w: m.week, a: IDX[m.team_a], b: IDX[m.team_b], c: TEAMS[IDX[m.team_a]].c, at: m.scheduled_at }))
  const WEEKS = Math.max(0, ...regular.map(m => m.week || 0))

  // ---------- pool y sprites ----------
  const SPRITE = {}, POINTS = {}, TYPES = {}
  const POOL = []
  pool.forEach(p => {
    const n = p.pokemon?.name; if (!n) return
    SPRITE[n] = p.pokemon.sprite; POINTS[n] = p.points; TYPES[n] = [lc(p.pokemon.type1), lc(p.pokemon.type2)].filter(Boolean).join("/")
    if (p.available) POOL.push([n, p.points ?? 0, TYPES[n], POKE_IDS[n] || 0])
  })
  POOL.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // ---------- perfiles y rosters ----------
  const byTeamMon = {}
  stats.forEach(s => {
    const k = s.team_id + "|" + s.pokemon_name
    const o = byTeamMon[k] = byTeamMon[k] || { g: 0, k: 0, d: 0 }
    o.g++; o.k += s.kills; o.d += s.deaths
  })
  const OBT = { draft: "Draft", free_agent: "Free agent", trade: "Trade" }
  const waiverBy = {}; (waiversQ.data || []).forEach(w => { waiverBy[w.team_id] = w })
  const PROFILES = TEAMS.map(t => {
    const roster = rosters.filter(r => r.team_id === t.id && r.pokemon).map(r => {
      const p = r.pokemon, n = p.name
      SPRITE[n] = SPRITE[n] || p.sprite
      const ab = [p.ability1, p.ability2, p.hiddenability].filter(a => a && a !== "None").join(" / ")
      const s = byTeamMon[t.id + "|" + n] || { g: 0, k: 0, d: 0 }
      return [n, POINTS[n] ?? 0, [lc(p.type1), lc(p.type2)].filter(Boolean).join("/") || "normal", ab, OBT[r.obtained_method] || "Draft", s.g, s.k, s.d]
    })
    const used = roster.reduce((s, r) => s + r[1], 0)
    const fa = waiverBy[t.id]?.fa_used ?? (txQ.data || []).filter(x => x.type === "free_agent" && x.status === "approved" && x.team_a === t.id).length
    return [t.coach || "Por definir", t.title || "-", `${used}/${RULES.max_points}`, fa, t.fav || "-", roster]
  })
  const CHAMPIONS_ID = {}; TEAMS.forEach((t, i) => { if (t.champions_id) CHAMPIONS_ID[i] = t.champions_id })

  // ---------- leaderboard ----------
  const agg = {}
  stats.forEach(s => {
    const o = agg[s.pokemon_name] = agg[s.pokemon_name] || { n: s.pokemon_name, g: 0, k: 0, d: 0 }
    o.g++; o.k += s.kills; o.d += s.deaths
  })
  const lead = Object.values(agg).sort((a, b) => b.k - a.k || a.d - b.d || a.n.localeCompare(b.n))
  const MONS_FULL = lead.slice(0, 20).map(m => [m.n, m.g, m.k, m.d])
  const MONS = lead.slice(0, 8).map(m => [m.n, m.k, +(m.k / (m.d || 1)).toFixed(2)])

  // ---------- draft ----------
  const order = (orderQ.data || []).filter(o => IDX[o.team_id] != null)
  const DRAFT_ORDER = order.map(o => IDX[o.team_id])
  const picks = picksQ.data || []
  const rounds = Math.max(RULES.roster_size || 0, ...picks.map(p => p.round || 0))
  const DRAFT_ROUNDS = Array.from({ length: DRAFT_ORDER.length ? rounds : 0 }, (_, ri) =>
    DRAFT_ORDER.map(ti => picks.find(p => p.round === ri + 1 && IDX[p.team_id] === ti)?.pokemon?.name || null))

  // ---------- playoffs ----------
  const po = (matchesQ.data || []).filter(m => m.stage === "playoff")
  const slot = code => {
    const m = po.find(x => x.round === code)
    if (!m) return { a: null, b: null }
    const o = { a: IDX[m.team_a] ?? null, b: IDX[m.team_b] ?? null, id: m.id }
    const seq = gamesOf(m)
    if (m.status === "completed" && m.winner) o.w = m.winner === "teamA" ? "a" : "b"
    else if (seq) o.seq = seq
    return o
  }
  const PLAYOFFS = {
    A: { wc: slot("A_WC"), qf: slot("A_QF"), sf: slot("A_SF") },
    B: { wc: slot("B_WC"), qf: slot("B_QF"), sf: slot("B_SF") },
    final: slot("FINAL")
  }
  let SEEDS = [...new Set(po.flatMap(m => [IDX[m.team_a], IDX[m.team_b]]).filter(x => x != null))]
  if (!SEEDS.length && TEAMS.length) SEEDS = KEYS.flatMap(k => TEAMS.map((t, i) => [t, i]).filter(([t]) => t.c === k).slice(0, 4).map(([, i]) => i))

  // ---------- salon de la fama ----------
  const byName = n => TEAMS.findIndex(t => t.n === n)
  const HOF = HOF_PAST.map(([s, n, lab]) => [s, byName(n), lab])
  ;(seasonsAll.data || []).filter(s => s.number && s.number > 3 && s.number < season.number && s.champion_team_id).forEach(s => {
    HOF.push([s.number, IDX[s.champion_team_id] ?? -1, "Campeon de los playoffs"])
  })

  // ---------- sesion ----------
  let ME = -1, ROLES = {}, role = null
  if (session?.user) {
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    role = prof?.role || "player"
    const mine = TEAMS.findIndex(t => t.user_id === session.user.id)
    ME = mine
    const r = ["trainer"]; if (role === "admin" || role === "cm") r.push("cm"); if (role === "admin") r.push("admin")
    ROLES[mine] = r
  }

  const theme = season.theme || {}
  return {
    SEASON: season, RULES, CONF, CONFS: confs, TEAMS, ABBR, UNASSIGNED: unassigned,
    RAW_MATCHES, MATCH_IDS, GAMES, PENDING, WEEKS, PROFILES, CHAMPIONS_ID,
    MONS, MONS_FULL, POOL, SPRITE, POINTS, TYPES, DRAFT_ORDER, DRAFT_ROUNDS, PLAYOFFS, SEEDS, HOF,
    TX: txQ.data || [], WAIVERS: waiversQ.data || [], ESCAPES: escQ.data || [],
    NEXT_EVENT: season.next_event || null, ME, ROLES, ROLE: role, USER: session?.user || null,
    THEME: { rojo: CONF.rojo.hex, verde: CONF.azul.hex, volt: theme.accent || "#FFB62E", azul: theme.immune || null },
    IS_ARCHIVE: !season.is_active, HAS_GAMES: RAW_MATCHES.length > 0
  }
}
