import { useEffect,useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"

import TeamTypeAnalysis from "../components/TeamTypeAnalysis"
import TeamPokemonStats from "../components/TeamPokemonStats"

export default function TeamDetail(){

const { teamId } = useParams()

const [team,setTeam]=useState(null)
const [roster,setRoster]=useState([])
const [matches,setMatches]=useState([])
const [reports,setReports]=useState([])
const [loading,setLoading]=useState(true)
const [rosterSize,setRosterSize]=useState(10)
const [favoriteData, setFavoriteData] = useState(null)

useEffect(()=>{
fetchTeam()
},[teamId])

async function fetchTeam(){

setLoading(true)

const {data:teamData}=await supabase
.from("teams")
.select("*")
.eq("id",teamId)
.maybeSingle()

if(!teamData){
setLoading(false)
return
}

setTeam(teamData)

if (teamData.favorite_pokemon) {

  const { data: fav } = await supabase
    .from("pokedex")
    .select("name, sprite")
    .eq("name", teamData.favorite_pokemon)
    .maybeSingle()

  setFavoriteData(fav)
}

// season actual
const { data: seasonState } = await supabase
.from("draft_state")
.select("season_id")
.single()

const seasonId = seasonState?.season_id

// 🔥 obtener roster_size dinámico
const { data: settings } = await supabase
.from("league_settings")
.select("roster_size")
.eq("season_id",seasonId)
.single()

if(settings?.roster_size){
setRosterSize(settings.roster_size)
}

// roster
const {data:rosterData}=await supabase
.from("rosters")
.select(`pokemon_id,
pokedex(
name,
sprite,
type1,
type2,
type1image,
type2image,
ability1,
ability2,
hiddenability
)`)
.eq("team_id",teamId)
.eq("season_id",seasonId)

// puntos
const {data:pointsData}=await supabase
.from("season_pokemon")
.select("pokemon_id,points")
.eq("season_id",seasonId)

const pointsMap={}
pointsData?.forEach(p=>{
pointsMap[p.pokemon_id]=p.points
})

// formatear roster
const formatted=(rosterData||[]).map(r=>({
name:r.pokedex?.name,
sprite:r.pokedex?.sprite,
type1:r.pokedex?.type1,
type2:r.pokedex?.type2,
type1image:r.pokedex?.type1image,
type2image:r.pokedex?.type2image,
ability1:r.pokedex?.ability1,
ability2:r.pokedex?.ability2,
hidden:r.pokedex?.hiddenability,
points:pointsMap[r.pokemon_id] || 0,
obtained:"Draft"
}))

setRoster(formatted)

// matches
const {data:matchData}=await supabase
.from("matches")
.select(`*,
teamA:team_a(name),
teamB:team_b(name)`)
.or(`team_a.eq.${teamId},team_b.eq.${teamId}`)
.order("week",{ascending:true})

setMatches(matchData||[])

// reports
const {data:reportData}=await supabase
.from("reports")
.select("*")

setReports(reportData||[])

setLoading(false)
}

if(loading){
return <div className="text-center mt-20">Loading team...</div>
}

// 🔥 limitar roster
const limitedRoster = roster.slice(0, rosterSize)

// 🔥 slots dinámicos
const rosterSlots=[...limitedRoster]
while(rosterSlots.length < rosterSize){
rosterSlots.push(null)
}

// 🔥 altura dinámica
const rowHeight = Math.max(40, Math.floor(420 / rosterSize))

return(

<div className="px-12 pb-16">

{/* TOP */}

<div className="grid grid-cols-12 gap-8 mb-10 items-stretch">

{/* TEAM INFO */}

<div className="col-span-2 bg-white border rounded-xl p-6 flex flex-col">

<div className="flex flex-col items-center mb-6">

<img src={team.logo} className="w-36 mb-4"/>

<div className="text-lg font-semibold">{team.name}</div>
<div className="text-sm text-slate-500">{team.conference}</div>

</div>

<div className="grid grid-cols-2 gap-y-2 text-sm mt-auto">

<div>Coach</div><div>{team.coach_name||"-"}</div>
<div>Title</div><div>{team.coach_title||"-"}</div>
<div>Wins</div><div>{team.wins||0}</div>
<div>Losses</div><div>{team.losses||0}</div>
<div>Points</div><div>{roster.reduce((s,p)=>s+(p?.points||0),0)}/65</div>
<div>FA Moves</div><div>{team.fa_moves||0}</div>
<div>Favorite</div>

<div className="flex items-center gap-2">
  {favoriteData ? (
    <>
      <img src={favoriteData.sprite} className="w-8" />
      {favoriteData.name}
    </>
  ) : (
    "-"
  )}
</div>

</div>

</div>

{/* ROSTER */}

<div className="col-span-8 bg-white border rounded-xl p-6">

<h3 className="font-semibold mb-4">Roster</h3>

<table className="w-full text-sm">

<thead>
<tr className="border-b text-xs text-center">
<th className="w-48 text-left">Pokemon</th>
<th className="w-12 text-center">Pts</th>
<th className="w-16 text-center">Types</th>
<th className="text-center">Abilities</th>
<th className="w-16 text-center">Obtained</th>
</tr>
</thead>

<tbody>

{rosterSlots.map((p,i)=>{

if(!p){
return(

<tr key={i} className="border-b text-slate-300" style={{height:`${rowHeight}px`}}>
<td>Empty</td><td></td><td></td><td></td><td></td>
</tr>
)
}

const abilities=[p.ability1,p.ability2,p.hidden]
.filter(a=>a && a!=="None")
.join(" / ")

return(

<tr key={i} className="border-b text-center align-middle" style={{height:`${rowHeight}px`}}>

<td>
<div className="flex items-center gap-2 h-full">
<img src={p.sprite} className="w-10 shrink-0"/>
<span className="text-left">{p.name}</span>
</div>
</td>

<td>{p.points}</td>

<td>
<div className="flex items-center justify-center gap-1 h-full">
<img src={p.type1image} className="h-5"/>
{p.type2image ? <img src={p.type2image} className="h-5"/> : <div className="h-5 w-5"></div>}
</div>
</td>

<td className="text-xs text-slate-600">{abilities}</td>
<td>{p.obtained}</td>

</tr>
)

})}

</tbody>

</table>

</div>

{/* PERFORMANCE */}

<div className="col-span-2 flex">
<TeamPokemonStats roster={rosterSlots} reports={reports} rowHeight={rowHeight}/>
</div>

</div>

{/* BOTTOM */}

<div className="grid grid-cols-12 gap-8">

<div className="col-span-8">
<TeamTypeAnalysis roster={rosterSlots} rowHeight={rowHeight}/>
</div>

{/* MATCH HISTORY */}

<div className="col-span-4 bg-white border rounded-xl p-6 flex flex-col h-full">

<h3 className="font-semibold mb-4">Match History</h3>

<table className="w-full text-sm">

<thead>
<tr className="border-b text-gray-500 text-xs uppercase tracking-wide">
<th className="text-left py-2 w-16">Week</th>
<th className="text-left">Opponent</th>
<th className="text-center w-20">Status</th>
<th className="text-center w-12">Result</th>
</tr>
</thead>

<tbody>

{Array.from({ length: rosterSize }).map((_, i) => {

const match = matches[i]

if (!match) {
return (

<tr key={i} className="border-b h-10 text-gray-300">
<td>—</td><td>—</td><td className="text-center">—</td><td className="text-center">—</td>
</tr>
)
}

const opponent =
match.teamA?.name === team.name
? match.teamB?.name
: match.teamA?.name

let result = "—"

if (match.status === "completed") {

const wins = match.games?.filter(g => g.winner === team.name).length || 0
const losses = match.games?.filter(g => g.winner === opponent).length || 0

result = wins > losses ? "W" : "L"
}

return (

<tr key={match.id} className="border-b h-10 hover:bg-slate-50 transition">

<td className="text-gray-500">{match.week}</td>
<td className="font-medium">{opponent}</td>
<td className="text-center text-gray-500">{match.status}</td>

<td className="text-center">
{result === "W" && <span className="text-green-600 font-semibold">W</span>}
{result === "L" && <span className="text-red-600 font-semibold">L</span>}
{result === "—" && <span className="text-gray-300">—</span>}
</td>

</tr>
)

})}

</tbody>

</table>

</div>

</div>

</div>

)

}

