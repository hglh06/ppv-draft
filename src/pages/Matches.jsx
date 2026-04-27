import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import ReportMatch from "./ReportMatch"

export default function Matches() {

  const { team } = useAuth()
  const [schedule, setSchedule] = useState([])
  const [teams, setTeams] = useState([])
  const [pokedex, setPokedex] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [reportingMatch, setReportingMatch] = useState(null)

  useEffect(() => {
    fetchMatches()
  }, [])

  async function fetchMatches() {

    /* TEAMS */

const { data: teamsData } = await supabase
  .from("teams")
  .select("id,name,conference")

setTeams(teamsData || [])

    const { data, error } = await supabase
      .from("matches")
      .select(`
  *,
  teamA:team_a ( id, name ),
  teamB:team_b ( id, name ),
  reports (
    team_a_data,
    team_b_data
  )
`)
      .eq("stage", "regular")
      .order("week", { ascending: true })

    if (!error) setSchedule(data || [])

      const { data: pokedexData } = await supabase
  .from("pokedex")
  .select("name, sprite")

if (pokedexData) {
  const map = {}
  pokedexData.forEach(p => {
    map[p.name] = p.sprite
  })
  setPokedex(map)
}

    setLoading(false)
  }

  if (loading) return <div className="text-center mt-20">Cargando calendario...</div>

  const groupedByWeek = schedule.reduce((acc, match) => {
    if (!acc[match.week]) acc[match.week] = []
    acc[match.week].push(match)
    return acc
  }, {})

  const sortedWeeks = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => a - b)

    function getByeTeam(matches, conference){

  const confTeams = teams.filter(t => t.conference === conference)

  const playingTeams = new Set()

  matches.forEach(m=>{
    if(m.teamA) playingTeams.add(m.teamA.name)
    if(m.teamB) playingTeams.add(m.teamB.name)
  })

  const bye = confTeams.find(t => !playingTeams.has(t.name))

  return bye?.name
}

  return (
  <div
    className="min-h-screen -mt-24 pt-32 px-12 pb-16"
    style={{
      backgroundImage: "url('/hex-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}
  >

      <div className="grid grid-cols-2 mb-10 relative">

        <div className="text-center text-2xl font-bold text-slate-800">
          Kanto Conference
        </div>

        <div className="text-center text-2xl font-bold text-slate-800">
          Johto Conference
        </div>

        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-300"></div>

      </div>

      {sortedWeeks.map(week => {

        const weekMatches = groupedByWeek[week]

        const kantoMatches = weekMatches.filter(m => m.conference === "Kanto")
        const johtoMatches = weekMatches.filter(m => m.conference === "Johto")

        const kantoBye = getByeTeam(kantoMatches,"Kanto")
        const johtoBye = getByeTeam(johtoMatches,"Johto")

        return (
          <div key={week} className="mb-12">

            <div className="text-center text-lg font-semibold mb-5 text-slate-600">
              Week {week}
            </div>

            <div className="grid grid-cols-2 gap-8 items-start relative">

              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-200"></div>

              <div className="flex flex-wrap gap-4 justify-center pr-6">
                {kantoMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onClick={() => setSelectedMatch(match)}
                  />
                ))}

                {kantoBye && (

<div className="w-full text-center mt-3">

<div className="text-xs text-slate-500 tracking-wide">
Bye Week
</div>

<div className="font-semibold text-slate-800">
{kantoBye}
</div>

</div>

)}
              </div>

              <div className="flex flex-wrap gap-4 justify-center pl-6">
                {johtoMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onClick={() => setSelectedMatch(match)}
                  />
                ))}

                {johtoBye && (

<div className="w-full text-center mt-3">

<div className="text-xs text-slate-500 tracking-wide">
Bye Week
</div>

<div className="font-semibold text-slate-800">
{johtoBye}
</div>

</div>

)}
              </div>

            </div>

          </div>
        )
      })}

      {selectedMatch && (
      <MatchModal
      match={selectedMatch}
      team={team}
      pokedex={pokedex}
          onClose={() => setSelectedMatch(null)}
          onReport={(match) => {
            setSelectedMatch(null)
            setReportingMatch(match)
          }}
        />
      )}

      {reportingMatch && (
        <ReportModal
          match={reportingMatch}
          onClose={() => setReportingMatch(null)}
        />
      )}

    </div>
  )
}

/* =========================
   MATCH CARD
========================= */

function MatchCard({ match, onClick }) {

  let scoreDisplay = "vs"

  if (match.status === "completed" && match.games?.length > 0) {

    const winsA = match.games.filter(
      g => g.winner === match.teamA?.name
    ).length

    const winsB = match.games.filter(
      g => g.winner === match.teamB?.name
    ).length

    if (match.status === "completed") {
  scoreDisplay =
    winsA > winsB
      ? "Winner: " + match.teamA?.name
      : "Winner: " + match.teamB?.name
}
  }

  return (
    <div
      onClick={onClick}
      className="w-44 bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center cursor-pointer hover:shadow-md transition"
    >
      <div className="font-medium text-slate-700 text-sm">{match.teamA?.name}</div>
      <div className="font-bold text-base my-2 text-slate-900">{scoreDisplay}</div>
      <div className="font-medium text-slate-700 text-sm">{match.teamB?.name}</div>

      {match.status === "completed" && (
        <div className="text-green-600 text-xs mt-2">
          Completed
        </div>
      )}
    </div>
  )
}

/* =========================
   MATCH MODAL
========================= */

function MatchModal({ match, team, onClose, onReport, pokedex }) {

  const canReport =
team &&
(match.teamA?.id === team.id || match.teamB?.id === team.id)

const getPokesByGame = (teamData, gameNumber) => {
  if (!teamData) return []

  return teamData.filter(p =>
    p.games?.some(g => g.game === gameNumber)
  )
}

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl p-8 w-[650px] max-w-[95%]">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-xl font-semibold">
            {match.teamA?.name} vs {match.teamB?.name}
          </h2>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-black"
          >
            ✕
          </button>

        </div>

        {match.games?.length > 0 ? (

          <div className="space-y-3 mb-6">

            {match.games.map((game, i) => (

              <div key={i} className="flex justify-between items-center border rounded-lg px-4 py-2">

                <div className="font-medium text-slate-700">
                  Game {i + 1}
                </div>

                <div className="text-slate-800 font-semibold">
                  {game.winner}
                </div>

                {match.replays?.[i] && (
                  <a
                    href={match.replays[i]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Replay
                  </a>
                  
                )}
                <div className="flex items-center justify-between mt-2">

  {/* TEAM A */}
  <div className="flex gap-1">
    {getPokesByGame(match.reports?.[0]?.team_a_data, i + 1).map((p, idx) => {
      const sprite = pokedex?.[p.name]
      if (!sprite) return null

      return (
        <img
          key={`a-${idx}`}
          src={sprite}
          alt={p.name}
          className="w-6 h-6"
        />
      )
    })}
  </div>

  {/* VS */}
  <div className="text-xs font-bold text-slate-500 mx-2">
    VS
  </div>

  {/* TEAM B */}
  <div className="flex gap-1">
    {getPokesByGame(match.reports?.[0]?.team_b_data, i + 1).map((p, idx) => {
      const sprite = pokedex?.[p.name]
      if (!sprite) return null

      return (
        <img
          key={`b-${idx}`}
          src={sprite}
          alt={p.name}
          className="w-6 h-6"
        />
      )
    })}
  </div>

</div>

              </div>

            ))}

          </div>

        ) : (

          <div className="text-center text-slate-500 mb-6">
            No games reported yet
          </div>

        )}

        <div className="flex justify-center gap-4">

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300"
          >
            Close
          </button>

          {canReport && match.status !== "completed" && (

<button
  onClick={() => onReport(match)}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  Report Result
</button>

)}

        </div>

      </div>

    </div>
  )
}

/* =========================
   REPORT MODAL
========================= */

function ReportModal({ match, onClose }) {

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl p-8 w-[1000px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-xl">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-xl font-semibold">
            Report Match
          </h2>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-black"
          >
            ✕
          </button>

        </div>

        <ReportMatch match={match} onClose={onClose} />

      </div>

    </div>
  )
}

