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


// obtener season actual
const { data: seasonState } = await supabase
.from("draft_state")
.select("season_id")
.single()

const seasonId = seasonState?.season_id


// obtener roster
const {data:rosterData}=await supabase
.from("rosters")
.select(`
pokemon_id,
pokedex(
name,
sprite,
type1,
type2,
ability1,
ability2,
hiddenability
)
`)
.eq("team_id",teamId)
.eq("season_id",seasonId)


// obtener puntos
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
.select(`
*,
teamA:team_a(name),
teamB:team_b(name)
`)
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

const rosterSlots=[...roster]

while(rosterSlots.length<10){
rosterSlots.push(null)
}

return(

<div className="px-12 pb-16">

{/* TOP */}

<div className="grid grid-cols-12 gap-8 mb-10 items-stretch">


{/* TEAM INFO */}

<div className="col-span-2 bg-white border rounded-xl p-6 flex flex-col">

<div className="flex flex-col items-center mb-6">

<img
src={team.logo}
className="w-36 mb-4"
/>

<div className="text-lg font-semibold">
{team.name}
</div>

<div className="text-sm text-slate-500">
{team.conference}
</div>

</div>

<div className="grid grid-cols-2 gap-y-2 text-sm mt-auto">

<div>Coach</div>
<div>{team.coach||"-"}</div>

<div>Title</div>
<div>{team.title||"-"}</div>

<div>Wins</div>
<div>{team.wins||0}</div>

<div>Losses</div>
<div>{team.losses||0}</div>

<div>Points</div>
<div>{roster.reduce((s,p)=>s+(p?.points||0),0)}/130</div>

<div>FA Moves</div>
<div>{team.fa_moves||0}</div>

<div>Favorite</div>
<div>{team.favorite||"-"}</div>

</div>

</div>


{/* ROSTER */}

<div className="col-span-8 bg-white border rounded-xl p-6">

<h3 className="font-semibold mb-4">
Roster
</h3>

<table className="w-full text-sm">

<thead>

<tr className="border-b text-xs">

<th className="w-48">Pokemon</th>
<th className="w-12">Pts</th>
<th className="w-24">Types</th>
<th>Abilities</th>
<th className="w-16">Obtained</th>

</tr>

</thead>

<tbody>

{rosterSlots.map((p,i)=>{

if(!p){

return(
<tr key={i} className="border-b h-10 text-slate-300">
<td>Empty</td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
)

}

const abilities=[p.ability1,p.ability2,p.hidden]
.filter(a=>a && a!=="None")
.join(" / ")

return(

<tr key={i} className="border-b h-10">

<td className="flex items-center gap-2">

<img src={p.sprite} className="w-7"/>

{p.name}

</td>

<td>{p.points}</td>

<td className="flex gap-1">

<img src={`/types/${p.type1}.png`} className="h-5"/>

{p.type2 &&
<img src={`/types/${p.type2}.png`} className="h-5"/>
}

</td>

<td className="text-xs text-slate-600">
{abilities}
</td>

<td>{p.obtained}</td>

</tr>

)

})}

</tbody>

</table>

</div>


{/* PERFORMANCE */}

<div className="col-span-2">

<TeamPokemonStats
roster={rosterSlots}
reports={reports}
/>

</div>


</div>


{/* BOTTOM */}

<div className="grid grid-cols-12 gap-8">

<div className="col-span-8">

<TeamTypeAnalysis roster={rosterSlots}/>

</div>


{/* MATCH HISTORY */}

<div className="col-span-4 bg-white border rounded-xl p-6 flex flex-col h-full">

<h3 className="font-semibold mb-4">
Match History
</h3>

<table className="w-full text-sm">

<thead>
<tr className="border-b text-gray-500 text-xs uppercase tracking-wide">

<th className="text-left py-2 w-16">
Week
</th>

<th className="text-left">
Opponent
</th>

<th className="text-center w-20">
Status
</th>

<th className="text-center w-12">
Result
</th>

</tr>
</thead>

<tbody>

{Array.from({ length: 10 }).map((_, i) => {

const match = matches[i]

if (!match) {

return (
<tr key={i} className="border-b h-10 text-gray-300">

<td>—</td>
<td>—</td>
<td className="text-center">—</td>
<td className="text-center">—</td>

</tr>
)

}

const opponent =
match.teamA?.name === team.name
? match.teamB?.name
: match.teamA?.name

let result = "—"

if (match.status === "completed") {

const wins =
match.games?.filter(g => g.winner === team.name).length || 0

const losses =
match.games?.filter(g => g.winner === opponent).length || 0

result = wins > losses ? "W" : "L"

}

return (

<tr
key={match.id}
className="border-b h-10 hover:bg-slate-50 transition"
>

<td className="text-gray-500">
{match.week}
</td>

<td className="font-medium">
{opponent}
</td>

<td className="text-center text-gray-500">
{match.status}
</td>

<td className="text-center">

{result === "W" && (
<span className="text-green-600 font-semibold">
W
</span>
)}

{result === "L" && (
<span className="text-red-600 font-semibold">
L
</span>
)}

{result === "—" && (
<span className="text-gray-300">
—
</span>
)}

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