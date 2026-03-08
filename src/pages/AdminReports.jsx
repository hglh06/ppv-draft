import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

export default function AdminReports() {

  const { isAdmin } = useAuth()

  const [reports, setReports] = useState([])
  const [transactions, setTransactions] = useState([])
  const [groupedFA, setGroupedFA] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    if (!isAdmin) return

    fetchData()

  }, [isAdmin])

  async function fetchData() {

    /* ===============================
       MATCH REPORTS
    ============================== */

    const { data: reportsData } = await supabase
      .from("reports")
      .select(`
        *,
        match:match_id (
          id,
          week,
          conference,
          teamA:team_a ( name ),
          teamB:team_b ( name )
        )
      `)
      .eq("status", "pending")

    /* ===============================
       TRANSACTIONS
    ============================== */

    const { data: txData } = await supabase
      .from("transactions")
      .select(`
        *,
        teamA:team_a ( name ),
        teamB:team_b ( name )
      `)
      .eq("status", "pending_admin")
      .order("created_at", { ascending: true })

      console.log("TRANSACTIONS:", txData)

    /* ===============================
       WAIVER ORDER
    ============================== */

    const { data: seasonData } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .single()

    const { data: waiverData } = await supabase
      .from("waiver_order")
      .select("*")
      .eq("season_id", seasonData.id)

    const waiverMap = {}

    waiverData?.forEach(w=>{
      waiverMap[w.team_id] = w.position
    })

    const enrichedTx = txData?.map(tx => ({
      ...tx,
      waiverPosition: waiverMap[tx.team_a] || null
    }))

    /* ===============================
       GROUP FREE AGENTS
    ============================== */

    const faRequests = enrichedTx?.filter(tx => tx.type === "free_agent") || []

    const grouped = {}

    faRequests.forEach(tx => {

      const pokemon = tx.receive?.[0]

      if (!grouped[pokemon]) grouped[pokemon] = []

      grouped[pokemon].push(tx)

    })

    Object.keys(grouped).forEach(pokemon => {

      grouped[pokemon].sort((a,b)=>
        (a.waiverPosition || 999) - (b.waiverPosition || 999)
      )

    })

    setGroupedFA(grouped)

    setReports(reportsData || [])
    setTransactions(enrichedTx || [])
    setLoading(false)
  }

  /* ===============================
     MATCH APPROVAL
  ============================== */

  async function approveReport(report) {

    const games = []

    const buildGames = (teamData, teamName) => {
      teamData?.forEach(pokemon => {
        pokemon.games.forEach(g => {
          if (g.kills > g.deaths) {
            games.push({
              game: g.game,
              winner: teamName
            })
          }
        })
      })
    }

    buildGames(report.team_a_data, report.match.teamA.name)
    buildGames(report.team_b_data, report.match.teamB.name)

    await supabase
      .from("matches")
      .update({
        games,
        replays: report.replays,
        status: "completed"
      })
      .eq("id", report.match_id)

    await supabase
      .from("reports")
      .update({ status: "approved" })
      .eq("id", report.id)

    fetchData()
  }

  /* ===============================
     TRANSACTION APPROVAL
  ============================== */

  async function approveTransaction(id) {
    await supabase.rpc("approve_transaction", {
      p_transaction_id: id
    })
    fetchData()
  }

  async function rejectTransaction(id) {
    await supabase.rpc("reject_transaction", {
      p_transaction_id: id
    })
    fetchData()
  }

  if (!isAdmin) return <div>No autorizado</div>
  if (loading) return <div>Cargando panel admin...</div>

  const trades = transactions.filter(tx => tx.type === "trade")

  return (
    <div className="space-y-12">

      <h2 className="text-3xl font-bold">
        Panel de Administración
      </h2>

      {/* =========================================
          MATCH REPORTS
      ========================================= */}

      <div>

        <h3 className="text-2xl font-bold mb-6">
          Reportes de Partidas
        </h3>

        {reports.length === 0 && (
          <div>No hay reportes pendientes</div>
        )}

        {reports.map(report => (
          <div
            key={report.id}
            className="bg-white p-6 rounded-xl shadow-md mb-6"
          >

            <h4 className="text-xl font-bold mb-2">
              Week {report.match.week} — {report.match.teamA.name} vs {report.match.teamB.name}
            </h4>

            <button
              onClick={() => approveReport(report)}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg"
            >
              Aprobar
            </button>

          </div>
        ))}

      </div>

      {/* =========================================
          FREE AGENCY
      ========================================= */}

      <div>

        <h3 className="text-2xl font-bold mb-6">
          Free Agency Claims
        </h3>

        {Object.keys(groupedFA).length === 0 && (
          <div>No hay solicitudes de FA</div>
        )}

        {Object.entries(groupedFA).map(([pokemon, requests]) => (

          <div key={pokemon} className="mb-8">

            <h4 className="text-xl font-bold mb-3">
              {pokemon} ({requests.length} solicitudes)
            </h4>

            {requests.map((tx, i) => (

              <div
                key={tx.id}
                className={`p-4 rounded-lg mb-2 ${
                  i === 0
                    ? "bg-green-50 border border-green-300"
                    : "bg-white border"
                }`}
              >

                <div className="font-semibold">
                  {tx.teamA?.name}
                  <span className="ml-2 text-sm text-slate-500">
                    (Waiver #{tx.waiverPosition})
                  </span>
                </div>

                <div className="text-sm mb-2">
                  Drop: {tx.give?.join(", ") || "None"}
                </div>

                <div className="flex gap-3">

                  <button
                    onClick={() => approveTransaction(tx.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Aprobar
                  </button>

                  <button
                    onClick={() => rejectTransaction(tx.id)}
                    className="bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Rechazar
                  </button>

                </div>

              </div>

            ))}

          </div>

        ))}

      </div>

      {/* =========================================
          TRADES
      ========================================= */}

      <div>

        <h3 className="text-2xl font-bold mb-6">
          Trades Pendientes
        </h3>

        {trades.length === 0 && (
          <div>No hay trades pendientes</div>
        )}

        {trades.map(tx => (

          <div
            key={tx.id}
            className="bg-white p-6 rounded-xl shadow-md mb-6"
          >

            <div className="font-bold text-lg mb-2">
              TRADE
            </div>

            <div className="mb-2">
              <strong>{tx.teamA?.name}</strong> ↔ <strong>{tx.teamB?.name}</strong>
            </div>

            <div className="mb-2">
              <strong>Da:</strong> {tx.give?.join(", ")}
            </div>

            <div className="mb-4">
              <strong>Recibe:</strong> {tx.receive?.join(", ")}
            </div>

            <div className="flex gap-4">

              <button
                onClick={() => approveTransaction(tx.id)}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Aprobar
              </button>

              <button
                onClick={() => rejectTransaction(tx.id)}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Rechazar
              </button>

            </div>

          </div>

        ))}

      </div>

    </div>
  )
}