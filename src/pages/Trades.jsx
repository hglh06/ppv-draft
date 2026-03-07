import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

export default function Trades() {

  const { team, isAdmin } = useAuth()

  const [teams, setTeams] = useState([])
  const [transactions, setTransactions] = useState([])
  const [waivers, setWaivers] = useState([])
  const [freeAgents, setFreeAgents] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedGiveFA, setSelectedGiveFA] = useState("")
  const [selectedReceiveFA, setSelectedReceiveFA] = useState("")

  const [tradePartner, setTradePartner] = useState("")
  const [tradeGive, setTradeGive] = useState([""])
  const [tradeReceive, setTradeReceive] = useState([""])

  const [myRoster, setMyRoster] = useState([])
const [pointsRemaining, setPointsRemaining] = useState(130)

  const myWaiver = waivers.find(w => w.team?.name === team?.name)
  const faRemaining = 10 - (myWaiver?.fa_used || 0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {

    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")

    const { data: tx } = await supabase
      .from("transactions")
      .select(`
        *,
        teamA:team_a ( name ),
        teamB:team_b ( name )
      `)
      .order("created_at", { ascending: false })

    const { data: seasonData } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single()

    const { data: waiverData } = await supabase
      .from("waiver_order")
      .select(`
        position,
        fa_used,
        team:team_id ( name )
      `)
      .eq("season_id", seasonData.id)
      .order("position")

    const { data: seasonPokemon } = await supabase

    
      .from("season_pokemon")
      .select(`
        pokemon:pokemon_id ( name )
      `)
      .eq("season_id", seasonData.id)
      .eq("available", true)

      /* =========================
   CARGAR MI ROSTER
========================= */

const { data: rosterData } = await supabase
  .from("rosters")
  .select(`
    pokemon_id,
    pokedex(name),
    season_pokemon(points)
  `)
  .eq("team_id", team?.id)
  .eq("season_id", seasonData.id)

const rosterNames = rosterData?.map(r => r.pokedex?.name) || []

setMyRoster(rosterNames)

const usedPoints =
rosterData?.reduce((sum,r)=>sum+(r.season_pokemon?.points||0),0) || 0

setPointsRemaining(130 - usedPoints)

    const taken = new Set()

    const { data: allRosters } = await supabase
.from("rosters")
.select(`
  pokedex(name)
`)
.eq("season_id", seasonData.id)

allRosters?.forEach(r=>{
taken.add(r.pokedex?.name)
})

    const free = seasonPokemon
      ?.map(p => p.pokemon.name)
      .filter(name => !taken.has(name)) || []

    setTeams(teamsData || [])
    setTransactions(tx || [])
    setWaivers(waiverData || [])
    setFreeAgents(free)
    setLoading(false)
  }

  async function sendFreeAgent() {

    if (!team) return

    await supabase.rpc("request_free_agent", {
      p_team_id: team.id,
      p_give: selectedGiveFA ? [selectedGiveFA] : [],
      p_receive: selectedReceiveFA ? [selectedReceiveFA] : []
    })

    setSelectedGiveFA("")
    setSelectedReceiveFA("")
    fetchData()
  }

  async function sendTrade() {

    if (!team || !tradePartner) return

    await supabase.rpc("request_trade", {
      p_team_a: team.id,
      p_team_b: tradePartner,
      p_give: tradeGive.filter(Boolean),
      p_receive: tradeReceive.filter(Boolean)
    })

    setTradePartner("")
    setTradeGive([""])
    setTradeReceive([""])
    fetchData()
  }

  async function acceptTrade(id) {

    await supabase.rpc("accept_trade", {
      p_transaction_id: id
    })

    fetchData()
  }

  async function rejectTrade(id) {

    await supabase.rpc("reject_transaction", {
      p_transaction_id: id
    })

    fetchData()
  }

  if (loading) return <div className="p-6">Cargando...</div>

  const history = transactions.filter(tx => tx.status === "approved")

  const pending = transactions.filter(tx =>
    tx.status === "pending_player" ||
    tx.status === "pending_admin"
  )

  return (

    <div className="grid grid-cols-[2fr_3fr_2fr] gap-6 min-h-[80vh] bg-slate-50 p-6 rounded-xl">

      {/* =====================================
          COLUMNA IZQUIERDA
      ===================================== */}

      <div className="flex flex-col gap-6 h-full">

        {/* INFO EQUIPO */}

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">

          <h3 className="text-lg font-semibold text-slate-700 mb-3">
            Tu equipo
          </h3>

          <div className="text-sm text-slate-600 space-y-1">

            <div>
              <span className="font-medium">Equipo:</span> {team?.name}
            </div>

            <div>
              <span className="font-medium">Roster:</span> {myRoster.length} / 10
            </div>

            <div>
              <span className="font-medium">Puntos restantes:</span> {pointsRemaining}
            </div>

            <div>
              <span className="font-medium">FA restantes:</span> {faRemaining}
            </div>

          </div>

        </div>

        {/* HISTORIAL */}

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col h-full">

          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Historial
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">

            {history.length === 0 && (
              <div className="text-sm text-gray-500">
                No hay movimientos aún
              </div>
            )}

            {history.map(tx => (

              <div key={tx.id} className="bg-slate-50 rounded-lg p-3 text-sm">

                <div className="font-semibold">
                  {tx.type.toUpperCase()}
                </div>

                <div>
                  {tx.teamA?.name}
                  {tx.teamB && ` ↔ ${tx.teamB?.name}`}
                </div>

                <div className="text-xs mt-1">

                  <span className="text-red-600">
                    {tx.give?.join(", ")}
                  </span>

                  {" → "}

                  <span className="text-green-600">
                    {tx.receive?.join(", ")}
                  </span>

                </div>

              </div>

            ))}

          </div>

        </div>

      </div>

      {/* =====================================
          COLUMNA CENTRO
      ===================================== */}

      <div className="flex flex-col gap-6">

        {/* PENDIENTES */}

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">

          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Pendientes
          </h3>

          {pending.length === 0 && (
            <div className="text-sm text-gray-500">
              No hay pendientes
            </div>
          )}

          {pending.map(tx => {

            const isReceiver = team?.id === tx.team_b
            const isAdminPending = tx.status === "pending_admin"

            return (

              <div key={tx.id} className="border-b py-3 text-sm">

                <div className="font-semibold">
                  {tx.type.toUpperCase()}
                </div>

                <div>
                  {tx.teamA?.name}
                  {tx.teamB && ` ↔ ${tx.teamB?.name}`}
                </div>

                <div className="text-gray-500 mb-2">
                  {tx.give?.join(", ")} → {tx.receive?.join(", ")}
                </div>

                {isReceiver && tx.status === "pending_player" && (

                  <div className="flex gap-2">

                    <button
                      onClick={() => acceptTrade(tx.id)}
                      className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                    >
                      Aceptar
                    </button>

                    <button
                      onClick={() => rejectTrade(tx.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                    >
                      Rechazar
                    </button>

                  </div>

                )}

                {isAdmin && isAdminPending && (
                  <div className="text-xs text-purple-600">
                    Esperando aprobación admin
                  </div>
                )}

              </div>

            )

          })}

        </div>

        {/* FREE AGENCY */}

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">

          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Free Agency
          </h3>

          <select
            value={selectedGiveFA}
            onChange={e => setSelectedGiveFA(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          >
            <option value="">Soltar (opcional)</option>
            {myRoster.map(p => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <select
            value={selectedReceiveFA}
            onChange={e => setSelectedReceiveFA(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          >
            <option value="">Recoger</option>
            {freeAgents.map(p => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <button
            onClick={sendFreeAgent}
            className="bg-blue-600 text-white px-4 py-2 rounded w-full"
          >
            Enviar FA
          </button>

        </div>

        {/* TRADE */}

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">

          <h3 className="text-lg font-semibold text-slate-700 mb-4">
            Trade con Jugador
          </h3>

          <select
            value={tradePartner}
            onChange={e => setTradePartner(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          >
            <option value="">Seleccionar jugador</option>
            {teams
              .filter(t => t.id !== team?.id)
              .map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>

          {tradeGive.map((value, i) => (

            <select
              key={i}
              value={value}
              onChange={e => {
                const updated = [...tradeGive]
                updated[i] = e.target.value
                setTradeGive(updated)
              }}
              className="w-full border p-2 rounded mb-2"
            >

              <option value="">Dar</option>

              {myRoster.map(p => (
                <option key={p}>{p}</option>
              ))}

            </select>

          ))}

          <button
            onClick={() => setTradeGive([...tradeGive, ""])}
            className="text-sm text-blue-600 mb-4"
          >
            + Agregar otro
          </button>

          {tradeReceive.map((value, i) => (

            <select
              key={i}
              value={value}
              onChange={e => {
                const updated = [...tradeReceive]
                updated[i] = e.target.value
                setTradeReceive(updated)
              }}
              className="w-full border p-2 rounded mb-2"
            >

              <option value="">Recibir</option>

              {teams
                .find(t => t.id === tradePartner)
                ?.roster?.map(p => (
                  <option key={p}>{p}</option>
                ))}

            </select>

          ))}

          <button
            onClick={() => setTradeReceive([...tradeReceive, ""])}
            className="text-sm text-blue-600 mb-4"
          >
            + Agregar otro
          </button>

          <button
            onClick={sendTrade}
            className="bg-purple-600 text-white px-4 py-2 rounded w-full"
          >
            Enviar Trade
          </button>

        </div>

      </div>

      {/* =====================================
          COLUMNA DERECHA
      ===================================== */}

      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">

        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Waiver Order
        </h3>

        <table className="w-full text-sm">

          <thead className="bg-slate-50 text-slate-600">

            <tr>
              <th className="p-2">#</th>
              <th>Team</th>
              <th>FA</th>
            </tr>

          </thead>

          <tbody>

            {Array.from({ length: 16 }).map((_, i) => {

              const w = waivers.find(x => x.position === i + 1)

              return (

                <tr key={i} className="border-b border-slate-100">

                  <td className="p-2">{i + 1}</td>

                  <td>{w?.team?.name || "-"}</td>

                  <td>{w ? `${w.fa_used}/10` : "-"}</td>

                </tr>

              )

            })}

          </tbody>

        </table>

      </div>

    </div>
  )
}