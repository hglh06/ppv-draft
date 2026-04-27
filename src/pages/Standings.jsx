import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Standings() {

  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [reports, setReports] = useState([])
  const [pokedex, setPokedex] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {

    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")

    const { data: matchesData } = await supabase
      .from("matches")
      .select(`
        *,
        teamA:team_a ( name ),
        teamB:team_b ( name )
      `)
      .eq("status", "completed")

    const { data: reportsData } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "approved")

    const { data: pokedexData } = await supabase
      .from("pokedex")
      .select("name, sprite")

    setTeams(teamsData || [])
    setMatches(matchesData || [])
    setReports(reportsData || [])
    setPokedex(pokedexData || [])

    setLoading(false)
  }

  if (loading) return <div className="text-center mt-20">Cargando standings...</div>

  const kantoStandings = calculateStandings(matches, teams, "Kanto")
  const johtoStandings = calculateStandings(matches, teams, "Johto")

  const pokemonStandings = calculatePokemonStandings(reports, teams, pokedex)

  return (
    <div
      className="min-h-screen -mt-24 pt-32 px-4 md:px-12 pb-20"
      style={{
        backgroundImage: "url('/hex-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >

      {/* CONFERENCES */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-16">

        <ConferenceTable title="Kanto Conference" teams={kantoStandings} />
        <ConferenceTable title="Johto Conference" teams={johtoStandings} />

      </div>

      {/* POKEMON STANDINGS */}

      <PokemonTable data={fillPokemonTable(pokemonStandings,10)} />

    </div>
  )
}

/* ============================= */

function calculateStandings(matches, allTeams, conference) {

  const stats = {}

  allTeams
    .filter(t => t.conference === conference)
    .forEach(team => {
      stats[team.name] = {
        name: team.name,
        wins: 0,
        losses: 0,
        diff: 0,
        points: 0
      }
    })

  matches
    .filter(m => m.conference === conference)
    .forEach(match => {

      const teamA = match.teamA.name
      const teamB = match.teamB.name

      const winsA = match.games?.filter(g => 
  g.winner === "teamA" || g.winner === match.teamA?.name
).length || 0

const winsB = match.games?.filter(g => 
  g.winner === "teamB" || g.winner === match.teamB?.name
).length || 0

      stats[teamA].diff += (winsA - winsB)
      stats[teamB].diff += (winsB - winsA)

      if (winsA > winsB) {
        stats[teamA].wins++
        stats[teamB].losses++
      } else if (winsB > winsA) {
        stats[teamB].wins++
        stats[teamA].losses++
      }
    })

  return Object.values(stats)
    .map(t => ({ ...t, points: t.wins * 3 }))
    .sort((a,b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.diff !== a.diff) return b.diff - a.diff
      return b.wins - a.wins
    })
}

/* ============================= */

function calculatePokemonStandings(reports, teams, pokedex) {

  const stats = {}

  reports.forEach(report => {

    const sides = [
  ...(report.team_a_data || []).map(p => ({ ...p, side: "A" })),
  ...(report.team_b_data || []).map(p => ({ ...p, side: "B" }))
]

    sides.forEach(pokemon => {

      if (!stats[pokemon.name]) {
        stats[pokemon.name] = {
          name: pokemon.name,
          games: 0,
          kills: 0,
          deaths: 0
        }
      }

      pokemon.games.forEach(g => {

        stats[pokemon.name].games++
        stats[pokemon.name].kills += g.kills
        stats[pokemon.name].deaths += g.deaths

      })

    })

  })

  const rows = Object.values(stats).map(p => {

    const team = teams.find(t =>
      t.roster?.includes(p.name)
    )

    const poke = pokedex.find(pk => pk.name === p.name)

    const ratio = p.deaths === 0
      ? p.kills
      : (p.kills / p.deaths).toFixed(2)

    return {
      ...p,
      team: team?.name || "-",
      coach: team?.coach_name || "-",
      sprite: poke?.sprite || "",
      ratio
    }

  })

 return rows.sort((a,b) => {
  if (b.kills !== a.kills) return b.kills - a.kills
  if (b.ratio !== a.ratio) return b.ratio - a.ratio
  return b.games - a.games
})
}

function fillPokemonTable(data, totalRows){

  const rows = [...data]

  while(rows.length < totalRows){

    rows.push({
      name: "-",
      team: "-",
      coach: "-",
      games: "-",
      kills: "-",
      deaths: "-",
      ratio: "-",
      sprite: ""
    })

  }

  return rows.slice(0,totalRows)

}

/* ============================= */

function ConferenceTable({ title, teams }) {

  const medalColors = [
    "border-l-yellow-400",
    "border-l-slate-400",
    "border-l-orange-500"
  ]

  const medals = ["🥇", "🥈", "🥉"]

  return (

    <div>

      <div className="text-2xl font-bold mb-6 text-slate-800 tracking-wide">
        {title}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">

        <table className="w-full min-w-[500px] text-sm">

          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="p-4 text-left">Team</th>
              <th className="p-4 text-center">W</th>
              <th className="p-4 text-center">L</th>
              <th className="p-4 text-center">Diff</th>
              <th className="p-4 text-center">Pts</th>
            </tr>
          </thead>

          <tbody>

            {teams.map((team, index) => {

              const isTop3 = index < 3

              return (

                <tr
                  key={team.name}
                  className={`border-t border-slate-100 hover:bg-slate-50
                  ${isTop3 ? `border-l-4 ${medalColors[index]}` : ""}`}
                >

                  <td className="p-4 font-medium flex items-center gap-2">

                    {team.name}

                    {isTop3 && <span>{medals[index]}</span>}

                  </td>

                  <td className="p-4 text-center">{team.wins}</td>
                  <td className="p-4 text-center">{team.losses}</td>
                  <td className="p-4 text-center">{team.diff}</td>
                  <td className="p-4 text-center font-semibold">
                    {team.points}
                  </td>

                </tr>

              )
            })}

          </tbody>

        </table>

      </div>

    </div>

  )
}

/* ============================= */

function PokemonTable({ data }) {

  const medalColors = [
    "border-l-yellow-400",
    "border-l-slate-400",
    "border-l-orange-500"
  ]

  const medals = ["🥇","🥈","🥉"]

  return (

    <div>

      <div className="text-2xl font-bold mb-6 text-slate-800 tracking-wide text-center">
        Pokémon Leaderboard
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">

        <table className="w-full min-w-[700px] text-sm">

          <thead className="border-b border-slate-200 bg-slate-50">

            <tr>

              <th className="p-4 text-left">Pokémon</th>
              <th className="p-4 text-left">Team</th>
              <th className="p-4 text-left">Coach</th>
              <th className="p-4 text-center">Games</th>
              <th className="p-4 text-center">Kills</th>
              <th className="p-4 text-center">Deaths</th>
              <th className="p-4 text-center">K/D</th>

            </tr>

          </thead>

          <tbody>

            {data.map((p,index) => {

              const isTop3 = index < 3

              return (

                <tr
                  key={p.name}
                  className={`border-t border-slate-100 hover:bg-slate-50
                  ${isTop3 ? `border-l-4 ${medalColors[index]}` : ""}`}
                >

                  <td className="p-4 flex items-center gap-3">

                    {p.sprite && (
  <img
    src={p.sprite}
    className="w-8 h-8"
  />
)}

                    {p.name}

                    {isTop3 && <span>{medals[index]}</span>}

                  </td>

                  <td className="p-4">{p.team}</td>

                  <td className="p-4">{p.coach}</td>

                  <td className="p-4 text-center">{p.games}</td>

                  <td className="p-4 text-center">{p.kills}</td>

                  <td className="p-4 text-center">{p.deaths}</td>

                  <td className="p-4 text-center font-semibold">
                    {p.ratio}
                  </td>

                </tr>

              )
            })}

          </tbody>

        </table>

      </div>

    </div>

  )
}