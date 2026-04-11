import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import React from "react"

export default function ReportMatch({ match, onClose }) {

const [winner,setWinner] = useState("")
const [submitting,setSubmitting] = useState(false)
const [success,setSuccess] = useState(false)

const [teamARoster,setTeamARoster] = useState([])
const [teamBRoster,setTeamBRoster] = useState([])

const [replays,setReplays] = useState(["","",""])

const [teamASelected,setTeamASelected] = useState(Array(6).fill(""))
const [teamBSelected,setTeamBSelected] = useState(Array(6).fill(""))

const [winners,setWinners] = useState(["","",""])

const [stats,setStats] = useState({
teamA:createEmptyStats(),
teamB:createEmptyStats()
})

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

if(!winner){
  alert("You must select the match winner")
  return
}

if(uniqueA.size!==6 || teamASelected.includes("")){
  alert("Team A must select 6 different Pokémon")
  return
}

if(uniqueB.size!==6 || teamBSelected.includes("")){
  alert("Team B must select 6 different Pokémon")
  return
}

const validReplays = replays.filter(r=>r.trim()!=="")
if(validReplays.length < 2){
  alert("At least 2 replays are required")
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
.from("reports")
.insert([{
  match_id:match.id,
  winner:winner,
  replays:validReplays,
  team_a_data:formatSide(teamASelected,stats.teamA),
  team_b_data:formatSide(teamBSelected,stats.teamB),
  status:"pending"
}])

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

  <div className="mb-6">

    <h4 className="font-semibold text-slate-700 mb-2">
      Match Winner
    </h4>

    <select
      value={winner}
      onChange={e=>setWinner(e.target.value)}
      className="border border-slate-200 p-2 rounded w-full"
    >
      <option value="">Select Winner</option>
      <option value={match.teamA?.name}>{match.teamA?.name}</option>
      <option value={match.teamB?.name}>{match.teamB?.name}</option>
    </select>

  </div>

  <div className="mb-6 space-y-2">

    <h4 className="font-semibold text-slate-700">
      Replay Links
    </h4>

    {replays.map((link,index)=>(
      <input
        key={index}
        type="text"
        placeholder={`Replay ${index+1}`}
        value={link}
        onChange={e=>{
          const updated=[...replays]
          updated[index]=e.target.value
          setReplays(updated)
        }}
        className="border border-slate-200 p-2 rounded w-full"
      />
    ))}

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
