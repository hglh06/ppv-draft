import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import React from "react"

export default function ReportMatch({ match, onClose }) {

const [submitting,setSubmitting] = useState(false)
const [success,setSuccess] = useState(false)

const [teamARoster,setTeamARoster] = useState([])
const [teamBRoster,setTeamBRoster] = useState([])

const [replays,setReplays] = useState(["","",""])

const [teamASelected,setTeamASelected] = useState(Array(6).fill(""))
const [teamBSelected,setTeamBSelected] = useState(Array(6).fill(""))

const [stats,setStats] = useState({
teamA:createEmptyStats(),
teamB:createEmptyStats()
})

const [games, setGames] = useState([
  { winner: "" },
  { winner: "" },
  { winner: "" }
])

function createEmptyStats(){
return Array(6).fill().map(()=>({
games:[
{entered:false,kills:0,deaths:0},
{entered:false,kills:0,deaths:0},
{entered:false,kills:0,deaths:0}
]
}))
}

useEffect(()=>{


async function fetchRosters(){

  if(!match) return

  const { data:seasonState } = await supabase
  .from("draft_state")
  .select("season_id")
  .single()

  const seasonId = seasonState?.season_id

  const { data:teamARosterData } = await supabase
  .from("rosters")
  .select(`
    pokedex(name, sprite)
  `)
  .eq("team_id",match.teamA.id)
  .eq("season_id",seasonId)

  const { data:teamBRosterData } = await supabase
  .from("rosters")
  .select(`
    pokedex(name, sprite)
  `)
  .eq("team_id",match.teamB.id)
  .eq("season_id",seasonId)

  setTeamARoster(
    teamARosterData?.map(r=>({
      name: r.pokedex?.name,
      sprite: r.pokedex?.sprite
    })) || []
  )

  setTeamBRoster(
    teamBRosterData?.map(r=>({
      name: r.pokedex?.name,
      sprite: r.pokedex?.sprite
    })) || []
  )

}

fetchRosters()


},[match])

function updateStat(side,rowIndex,gameIndex,field,value){


const updated = {...stats}

if(field==="entered"){

  updated[side][rowIndex].games[gameIndex].entered=value

  if(!value){
    updated[side][rowIndex].games[gameIndex].kills=0
    updated[side][rowIndex].games[gameIndex].deaths=0
  }

}else{

  updated[side][rowIndex].games[gameIndex][field]=Math.max(0,Number(value))

}

setStats(updated)


}

async function submitReport(){


const uniqueA = new Set(teamASelected)
const uniqueB = new Set(teamBSelected)


if(uniqueA.size!==6 || teamASelected.includes("")){
  alert("Team A must select 6 different Pokémon")
  return
}

if(uniqueB.size!==6 || teamBSelected.includes("")){
  alert("Team B must select 6 different Pokémon")
  return
}

const validGames = games.filter(g => g.winner !== "")

if (validGames.length < 2) {
  alert("Debes seleccionar al menos 2 juegos")
  return
}

const winsA = validGames.filter(g => g.winner === "teamA").length
const winsB = validGames.filter(g => g.winner === "teamB").length

let matchWinner = null

if (winsA === 2) matchWinner = "teamA"
if (winsB === 2) matchWinner = "teamB"

if (!matchWinner) {
  alert("El match no está completo")
  return
}

const finalGames = validGames.map(g => ({
  winner: g.winner,
  replay: g.replay || null
}))

const validGames = games.filter(g => g.winner !== "")

if (validGames.length < 2) {
  alert("Debes seleccionar al menos 2 juegos")
  return
}

const winsA = validGames.filter(g => g.winner === "teamA").length
const winsB = validGames.filter(g => g.winner === "teamB").length

let matchWinner = null

if (winsA === 2) matchWinner = "teamA"
if (winsB === 2) matchWinner = "teamB"

if (!matchWinner) {
  alert("El match no está completo")
  return
}

const formatSide=(selected,sideStats)=>
  selected.map((name,rowIndex)=>{

    const gamesData = sideStats[rowIndex].games
    .map((g,index)=>
      g.entered
      ? {
          game:index+1,
          kills:g.kills,
          deaths:g.deaths
        }
      : null
    )
    .filter(Boolean)

    return gamesData.length>0
    ? {name,games:gamesData}
    : null

  }).filter(Boolean)

setSubmitting(true)

const { error } = await supabase
  .from("matches")
  .update({
    games: finalGames,
    winner: matchWinner,
    replays: finalGames.map(g => g.replay),
    status: "completed"
  })
  .eq("id", match.id)

if(error){
  console.error(error)
  alert("Error submitting report")
  setSubmitting(false)
  return
}

setSubmitting(false)
setSuccess(true)

setTimeout(()=>{
  setSuccess(false)
  onClose()
},1500)


}

if(!match) return null

return(


<div className="max-h-[75vh] overflow-y-auto pr-2">

  <h3 className="text-2xl font-bold mb-6">
    Report: {match.teamA?.name} vs {match.teamB?.name}
  </h3>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

  {/* IZQUIERDA - GAMES */}
  <div className="space-y-3">
    <div className="font-semibold">Resultados por juego</div>

    {[0,1,2].map((i) => (
      <div key={i} className="flex items-center gap-2">

        <span className="w-16">Game {i + 1}</span>

        <select
          value={games[i].winner}
          onChange={(e) => {
            const newGames = [...games]
            newGames[i].winner = e.target.value

            // 🔥 limpiar replay si quitan winner
            if (!e.target.value) {
              newGames[i].replay = ""
            }

            setGames(newGames)
          }}
          className="border rounded px-2 py-1 w-full"
        >
          <option value="">Seleccionar</option>
          <option value="teamA">Team A</option>
          <option value="teamB">Team B</option>
        </select>

      </div>
    ))}
  </div>

  {/* DERECHA - REPLAYS */}
  <div className="space-y-3">
    <div className="font-semibold">Replays</div>

    {[0,1,2].map((i) => (
      <div key={i} className="flex items-center gap-2">

        <span className="w-16">Game {i + 1}</span>

        <input
          type="text"
          value={games[i].replay || ""}
          onChange={(e) => {
            const newGames = [...games]
            newGames[i].replay = e.target.value
            setGames(newGames)
          }}
          placeholder="Link replay"
          disabled={!games[i].winner} // 🔥 CLAVE
          className={`border rounded px-2 py-1 w-full ${
            !games[i].winner ? "bg-gray-100 opacity-50" : ""
          }`}
        />

      </div>
    ))}
  </div>

</div>

  <div className="grid grid-cols-2 gap-10">

    <TeamExcelTable
      title={match.teamA?.name}
      roster={teamARoster}
      selected={teamASelected}
      setSelected={setTeamASelected}
      stats={stats.teamA}
      updateStat={(row,game,field,value)=>
        updateStat("teamA",row,game,field,value)
      }
    />

    <TeamExcelTable
      title={match.teamB?.name}
      roster={teamBRoster}
      selected={teamBSelected}
      setSelected={setTeamBSelected}
      stats={stats.teamB}
      updateStat={(row,game,field,value)=>
        updateStat("teamB",row,game,field,value)
      }
    />

  </div>

  <div className="flex justify-between mt-8">

    <button
      onClick={onClose}
      className="px-6 py-3 bg-slate-700 text-white rounded-lg"
    >
      Cancel
    </button>

    <button
      onClick={submitReport}
      disabled={submitting}
      className="px-6 py-3 rounded-lg text-white bg-green-600"
    >
      {submitting ? "Submitting..." : "Submit Report"}
    </button>

  </div>

  {success &&(
    <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg shadow">
      ✅ Report submitted
    </div>
  )}

</div>


)

}

function TeamExcelTable({title,roster,selected,setSelected,stats,updateStat}){

return(


<div>

  <h3 className="text-lg font-semibold mb-3">{title}</h3>

  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">

    <thead className="bg-slate-100">

      <tr>
        <th className="border px-2 py-2 text-left">Pokemon</th>
        <th className="border px-2 py-2 text-center">Game 1</th>
        <th className="border px-2 py-2 text-center">Game 2</th>
        <th className="border px-2 py-2 text-center">Game 3</th>
      </tr>

    </thead>

    <tbody>

      {selected.map((poke,rowIndex)=>{

        const selectedPokemon = roster.find(p => p.name === poke)

        return(
          <tr key={rowIndex} className="border">

            <td className="p-1">

              <div className="flex items-center gap-2">

                {selectedPokemon?.sprite && (
                  <img
                    src={selectedPokemon.sprite}
                    alt={poke}
                    className="w-6 h-6"
                  />
                )}

                <select
                  value={poke}
                  onChange={e=>{
                    const updated=[...selected]
                    updated[rowIndex]=e.target.value
                    setSelected(updated)
                  }}
                  className="w-full border border-slate-200 rounded p-1 text-xs"
                >

                  <option value="">Select</option>

                  {roster
                    .filter(p=>!selected.includes(p.name)||p.name===poke)
                    .map((pokemon,index)=>(
                      <option key={index} value={pokemon.name}>
                        {pokemon.name}
                      </option>
                  ))}

                </select>

              </div>

            </td>

            {stats[rowIndex].games.map((g,gameIndex)=>(

              <td key={gameIndex} className="border text-center p-2">

                <div className="flex flex-col items-center gap-1">

                  <input
                    type="checkbox"
                    checked={g.entered}
                    onChange={e=>
                      updateStat(rowIndex,gameIndex,"entered",e.target.checked)
                    }
                  />

                  {g.entered &&(

                    <div className="flex items-center gap-1 text-xs">

                      <span>K</span>

                      <input
                        type="number"
                        value={g.kills}
                        onChange={e=>
                          updateStat(rowIndex,gameIndex,"kills",e.target.value)
                        }
                        className="w-10 border text-xs text-center"
                      />

                      <span>/</span>

                      <span>D</span>

                      <input
                        type="number"
                        value={g.deaths}
                        onChange={e=>
                          updateStat(rowIndex,gameIndex,"deaths",e.target.value)
                        }
                        className="w-10 border text-xs text-center"
                      />

                    </div>

                  )}

                </div>

              </td>

            ))}

          </tr>
        )

      })}

    </tbody>

  </table>

</div>


)

}
