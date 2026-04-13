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

  const [selectedGiveFA, setSelectedGiveFA] = useState([""])
  const [selectedReceiveFA, setSelectedReceiveFA] = useState([""])

  const [tradePartner, setTradePartner] = useState("")
  const [tradeGive, setTradeGive] = useState([""])
  const [tradeReceive, setTradeReceive] = useState([""])
  const [partnerRoster, setPartnerRoster] = useState([])

  const [myRoster, setMyRoster] = useState([])
  const [pointsRemaining, setPointsRemaining] = useState(60)

  const myWaiver = waivers.find(w => w.team?.name === team?.name)
  const faRemaining = 10 - (myWaiver?.fa_used || 0)
  const [pointsMap, setPointsMap] = useState({})

  useEffect(() => {

  if(!team) return

  fetchData()

}, [team])

  useEffect(() => {

  async function loadPartnerRoster() {

    if (!tradePartner) {
      setPartnerRoster([])
      return
    }

    const { data: seasonData } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single()

    const { data: rosterData } = await supabase
      .from("rosters")
      .select(`
        pokedex(name)
      `)
      .eq("team_id", tradePartner)
      .eq("season_id", seasonData.id)

    const names = rosterData?.map(r => r.pokedex?.name) || []

    setPartnerRoster(names)

  }

  loadPartnerRoster()

}, [tradePartner])

  async function fetchData() {

    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")

    const { data: tx } = await supabase
  .from("transactions")
  .select("*")
  .order("created_at", { ascending: false })


    const { data: seasonData } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single()

    const { data: waiverRaw } = await supabase
  .from("waiver_order")
  .select("*")
  .eq("season_id", seasonData.id)
  .order("position")

const teamMap = {}

teamsData?.forEach(t => {
  teamMap[t.id] = t.name
})

const waiverData = waiverRaw?.map(w => ({
  ...w,
  team: { name: teamMap[w.team_id] }
}))

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

/* =========================
   CARGAR MI ROSTER
========================= */

const { data: rosterData } = await supabase
.from("rosters")
.select(`
  pokemon_id,
  pokedex(name)
`)
.eq("team_id", team?.id)
.eq("season_id", seasonData.id)

const rosterNames = rosterData?.map(r => r.pokedex?.name) || []

setMyRoster(rosterNames)

/* =========================
   OBTENER PUNTOS
========================= */

const { data: pointsData } = await supabase
.from("season_pokemon")
.select(`
  points,
  pokedex(name)
`)
.eq("season_id", seasonData.id)

const map = {}

pointsData?.forEach(p=>{
  map[p.pokedex.name] = p.points
})

setPointsMap(map)

const usedPoints =
rosterData?.reduce((sum,r)=>sum+(map[r.pokedex?.name] || 0),0) || 0

setPointsRemaining(60 - usedPoints)

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

/* =========================
   MAPEAR TRANSACTIONS
========================= */

const txMapped = (tx || []).map(t=>({
  ...t,
  teamA: { name: teamMap[t.team_a] },
  teamB: { name: teamMap[t.team_b] }
}))

setTransactions(txMapped)

setWaivers(waiverData || [])
setFreeAgents(free)
setLoading(false)
  }



  async function sendFreeAgent() {

  if (!team) return

  const confirmFA = window.confirm(
    `Confirm Free Agency move?\n\nDrop: ${selectedGiveFA || "None"}\nPick up: ${selectedReceiveFA || "None"}`
  )

  if (!confirmFA) return

  await supabase.rpc("request_free_agent", {
    p_team_id: team.id,
    p_give: selectedGiveFA.filter(Boolean),
    p_receive: selectedReceiveFA.filter(Boolean)
  })

  setSelectedGiveFA([""])
  setSelectedReceiveFA([""])
  fetchData()
}

 async function sendTrade() {

  if (!team || !tradePartner) return

  /* =========================
   VALIDAR DIFERENCIA DE PUNTOS
========================= */

const givePoints =
tradeGive
.filter(Boolean)
.reduce((sum,p)=>sum+(pointsMap[p] || 0),0)

const receivePoints =
tradeReceive
.filter(Boolean)
.reduce((sum,p)=>sum+(pointsMap[p] || 0),0)

const diff = Math.abs(givePoints - receivePoints)

if(diff > 3){

alert(
`Trade inválido.

La diferencia de puntos es ${diff}.
El máximo permitido es 3 puntos.`
)

return
}

  const partnerName =
    teams.find(t => t.id === tradePartner)?.name || "Unknown"

  const confirmTrade = window.confirm(
`Send this trade?

Partner: ${partnerName}

You give:
${tradeGive.filter(Boolean).join(", ") || "Nothing"}

You receive:
${tradeReceive.filter(Boolean).join(", ") || "Nothing"}
`
  )

  if (!confirmTrade) return

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

function removeGiveSlot(index) {
  const updated = [...tradeGive]
  updated.splice(index, 1)
  setTradeGive(updated)
}

function removeReceiveSlot(index) {
  const updated = [...tradeReceive]
  updated.splice(index, 1)
  setTradeReceive(updated)
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

  async function cancelTrade(id) {

  const confirmCancel = window.confirm(
    "Cancel this trade request?"
  )

  if(!confirmCancel) return

  await supabase.rpc("cancel_trade", {
    p_transaction_id: id
  })

  fetchData()
}

  if (loading) return <div className="p-6">Cargando...</div>

  const history = transactions.filter(tx => tx.status === "approved")

  const pending = transactions.filter(tx =>
  (tx.team_a === team?.id || tx.team_b === team?.id) &&
  (tx.status === "pending_player" || tx.status === "pending_admin")
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
              <span className="font-medium">Roster:</span> {myRoster.length} / 8
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

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col max-h-[500px]">

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
  {tx.type === "free_agent" ? "FREE AGENT" : "TRADE"}
</div>

                <div>
  {tx.type === "free_agent"
    ? `${tx.teamA?.name} → Free Agency`
    : `${tx.teamA?.name} ↔ ${tx.teamB?.name}`
  }
</div>

                <div className="text-xs mt-1">

                  <span className="text-red-600">
  {tx.give?.map(p => `${p} (${pointsMap[p] || 0})`).join(", ")}
</span>

{" ↔ "}

<span className="text-green-600">
  {tx.receive?.map(p => `${p} (${pointsMap[p] || 0})`).join(", ")}
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

<div className="text-xs text-gray-500">
  {tx.status === "pending_player" && "Esperando respuesta del otro jugador"}
  {tx.status === "pending_admin" && "Esperando aprobación del admin"}
</div>

                <div>
  {tx.type === "free_agent"
    ? `${tx.teamA?.name} → Free Agency`
    : `${tx.teamA?.name} ↔ ${tx.teamB?.name}`
  }
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

                {team?.id === tx.team_a && tx.status === "pending_player" && (

  <button
    onClick={() => cancelTrade(tx.id)}
    className="bg-gray-500 text-white px-2 py-1 rounded text-xs"
  >
    Cancel
  </button>

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

          {selectedGiveFA.map((value, i) => (

  <div key={i} className="flex gap-2 mb-2">

    <select
      value={value}
      onChange={e => {
        const updated = [...selectedGiveFA]
        updated[i] = e.target.value
        setSelectedGiveFA(updated)
      }}
      className="w-full border p-2 rounded"
    >

      <option value="">Soltar (opcional)</option>

      {myRoster
        .filter(p => !selectedGiveFA.includes(p) || p === value)
        .map(p => (
          <option key={p} value={p}>
            {p} ({pointsMap[p] || 0})
          </option>
        ))}

    </select>

    {selectedGiveFA.length > 1 && (
      <button
        onClick={() => {
          const updated = [...selectedGiveFA]
          updated.splice(i,1)
          setSelectedGiveFA(updated)
        }}
        className="px-2 text-red-600"
      >
        ❌
      </button>
    )}

  </div>

))}

<button
  onClick={() => setSelectedGiveFA([...selectedGiveFA, ""])}
  className="text-sm text-blue-600 mb-4"
>
  + Agregar otro
</button>

          {selectedReceiveFA.map((value, i) => (

  <div key={i} className="flex gap-2 mb-2">

    <select
      value={value}
      onChange={e => {
        const updated = [...selectedReceiveFA]
        updated[i] = e.target.value
        setSelectedReceiveFA(updated)
      }}
      className="w-full border p-2 rounded"
    >

      <option value="">Recoger</option>

      {freeAgents
        .filter(p => !selectedReceiveFA.includes(p) || p === value)
        .map(p => (
          <option key={p} value={p}>
            {p} ({pointsMap[p] || 0})
          </option>
        ))}

    </select>

    {selectedReceiveFA.length > 1 && (
      <button
        onClick={() => {
          const updated = [...selectedReceiveFA]
          updated.splice(i,1)
          setSelectedReceiveFA(updated)
        }}
        className="px-2 text-red-600"
      >
        ❌
      </button>
    )}

  </div>

))}

<button
  onClick={() => setSelectedReceiveFA([...selectedReceiveFA, ""])}
  className="text-sm text-blue-600 mb-4"
>
  + Agregar otro
</button>

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

          
          {tradeReceive.map((value, i) => (

  <div key={i} className="flex gap-2 mb-2">

    <select
      value={value}
      onChange={e => {
        const updated = [...tradeReceive]
        updated[i] = e.target.value
        setTradeReceive(updated)
      }}
      className="w-full border p-2 rounded"
    >

      <option value="">Recibir</option>

      {partnerRoster
  .filter(p => !tradeReceive.includes(p) || p === value)
  .map(p => (
  <option key={p} value={p}>
    {p} ({pointsMap[p] || 0})
  </option>
))}

    </select>

    {tradeReceive.length > 1 && (
      <button
        onClick={() => removeReceiveSlot(i)}
        className="px-2 text-red-600 hover:text-red-800"
      >
        ❌
      </button>
    )}

  </div>

))}

          <button
            onClick={() => setTradeReceive([...tradeReceive, ""])}
            className="text-sm text-blue-600 mb-4"
          >
            + Agregar otro
          </button>

          {tradeGive.map((value, i) => (

  <div key={i} className="flex gap-2 mb-2">

    <select
      value={value}
      onChange={e => {
        const updated = [...tradeGive]
        updated[i] = e.target.value
        setTradeGive(updated)
      }}
      className="w-full border p-2 rounded"
    >

      <option value="">Dar</option>

      {myRoster
  .filter(p => !tradeGive.includes(p) || p === value)
  .map(p => (
  <option key={p} value={p}>
    {p} ({pointsMap[p] || 0})
  </option>
))}

    </select>

    {tradeGive.length > 1 && (
      <button
        onClick={() => removeGiveSlot(i)}
        className="px-2 text-red-600 hover:text-red-800"
      >
        ❌
      </button>
    )}

  </div>

))}

          <button
            onClick={() => setTradeGive([...tradeGive, ""])}
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

            {Array.from({ length: 18 }).map((_, i) => {

              const w = waivers.find(x => x.position === i + 1)

              return (

                <tr
  key={i}
  className={`border-b border-slate-100 ${
    w?.team?.name === team?.name ? "bg-blue-50 font-semibold" : ""
  }`}
>

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