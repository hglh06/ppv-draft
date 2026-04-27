import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Playoffs() {

  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {

    const { data } = await supabase
      .from("matches")
      .select(`
        *,
        teamA:team_a ( name ),
        teamB:team_b ( name )
      `)

    setMatches(data || [])

    const calculate = (conference) => {

      const teams = {}

      data
        .filter(m => m.conference === conference && m.status === "completed")
        .forEach(match => {

          const teamA = match.teamA.name
          const teamB = match.teamB.name

          if (!teams[teamA]) teams[teamA] = { name: teamA, wins: 0 }
          if (!teams[teamB]) teams[teamB] = { name: teamB, wins: 0 }

          const winsA = match.games?.filter(g => g.winner === teamA).length || 0
          const winsB = match.games?.filter(g => g.winner === teamB).length || 0

          if (winsA > winsB) teams[teamA].wins++
          if (winsB > winsA) teams[teamB].wins++
        })

      return Object.values(teams)
        .sort((a,b)=> b.wins - a.wins)
        .slice(0,4)
    }

    setStandings({
      kanto: calculate("Kanto"),
      johto: calculate("Johto")
    })
  }

  if (!standings) return null

  const getPlayoffMatch = (round) =>
    matches.find(m => m.stage === "playoff" && m.round === round)

  const k1 = standings.kanto[0]?.name || "Kanto #1"
  const k2 = standings.kanto[1]?.name || "Kanto #2"
  const k3 = standings.kanto[2]?.name || "Kanto #3"
  const k4 = standings.kanto[3]?.name || "Kanto #4"

  const j1 = standings.johto[0]?.name || "Johto #1"
  const j2 = standings.johto[1]?.name || "Johto #2"
  const j3 = standings.johto[2]?.name || "Johto #3"
  const j4 = standings.johto[3]?.name || "Johto #4"

  return (
    <div className="relative h-[calc(100vh-96px)] overflow-hidden">

      {/* BACKGROUND STRIPES */}
      <div className="absolute inset-0 grid grid-cols-5">
        <BackgroundColumn image="/posters/wc1.jpg" />
        <BackgroundColumn image="/posters/wc2.jpg" />
        <BackgroundColumn image="/posters/sf1.jpg" />
        <BackgroundColumn image="/posters/sf2.jpg" />
        <BackgroundColumn image="/posters/final.jpg" />
      </div>

      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      {/* BRACKET */}
      <div className="relative z-10 flex items-center justify-center h-full">

        <div className="grid grid-cols-3 gap-24 items-center">

          <div className="space-y-24">

            <BracketMatch
  title="Wild Card 1"
  teamA={k1}
  teamB={j4}
  matchData={getPlayoffMatch("WC1")}
  onClick={setSelectedMatch}
/>

<BracketMatch
  title="Wild Card 2"
  teamA={k2}
  teamB={j3}
  matchData={getPlayoffMatch("WC2")}
  onClick={setSelectedMatch}
/>

<BracketMatch
  title="Semifinal 1"
  teamA="Winner WC1"
  teamB="Winner WC2"
  matchData={getPlayoffMatch("SF1")}
  onClick={setSelectedMatch}
/>

          </div>

          <div className="flex justify-center">
            <BracketMatch
              title="Grand Final"
              teamA="Winner S1"
              teamB="Winner S2"
              matchData={getPlayoffMatch("FINAL")}
              onClick={setSelectedMatch}
              highlight
            />
          </div>

          <div className="space-y-24">

            <BracketMatch
  title="Wild Card 3"
  teamA={j1}
  teamB={k4}
  matchData={getPlayoffMatch("WC3")}
  onClick={setSelectedMatch}
/>

<BracketMatch
  title="Wild Card 4"
  teamA={j2}
  teamB={k3}
  matchData={getPlayoffMatch("WC4")}
  onClick={setSelectedMatch}
/>

<BracketMatch
  title="Semifinal 2"
  teamA="Winner WC3"
  teamB="Winner WC4"
  matchData={getPlayoffMatch("SF2")}
  onClick={setSelectedMatch}
/>

          </div>

        </div>

      </div>

      {selectedMatch && (
        <PlayoffModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}

    </div>
  )
}

/* =============================== */

function BackgroundColumn({ image }) {
  return (
    <div
      className="bg-cover bg-center"
      style={{ backgroundImage: `url(${image})` }}
    />
  )
}

/* =============================== */

function BracketMatch({ title, teamA, teamB, matchData, onClick, highlight }) {

  let scoreDisplay = ""

  if (matchData?.status === "completed") {
    const teamAName = matchData.teamA?.name
    const teamBName = matchData.teamB?.name

    const winsA = matchData.games?.filter(g => g.winner === teamAName).length || 0
    const winsB = matchData.games?.filter(g => g.winner === teamBName).length || 0

    scoreDisplay = `${winsA} - ${winsB}`
  }

  return (
    <div className="relative flex flex-col items-center">

      {/* 🏆 TROPHY SOLO PARA FINAL */}
      {highlight && (
        <div className="mb-4 text-4xl animate-pulse">
          🏆
        </div>
      )}

      <div
        onClick={() => matchData && onClick(matchData)}
        className={`rounded-xl border p-8 w-72 text-center backdrop-blur-md
        transition hover:scale-105 cursor-pointer
        ${
          highlight
            ? "bg-white/20 border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.25)]"
            : "bg-white/10 border-white/20"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-white/60 mb-4">
          {title}
        </div>

        <div className="text-xl font-semibold text-white">
          {teamA}
        </div>

        <div className="my-4 text-white/60 font-medium">
          {scoreDisplay || "VS"}
        </div>

        <div className="text-xl font-semibold text-white">
          {teamB}
        </div>

        {matchData?.status === "completed" && (
          <div className="mt-4 text-green-400 text-xs">
            Completed
          </div>
        )}
      </div>

    </div>
  )
}