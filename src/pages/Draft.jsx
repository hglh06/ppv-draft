import { useEffect,useState,useRef } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

export default function Draft(){

const { isAdmin,user } = useAuth()

const [draftState,setDraftState]=useState(null)
const [pokemon,setPokemon]=useState([])
const [picks,setPicks]=useState([])
const [teams,setTeams]=useState([])

const [loading,setLoading]=useState(true)
const [timeLeft,setTimeLeft]=useState(30)

const [search,setSearch]=useState("")
const [typeFilter,setTypeFilter]=useState([])
const [sortPoints,setSortPoints]=useState("desc")

const [showPanel,setShowPanel]=useState(false)

const previousPickCount=useRef(0)
const [pointsMap,setPointsMap]=useState({})

/* FETCH */

async function fetchDraft(){

const {data:state}=await supabase
.from("draft_state")
.select(`
*,
currentTeam:current_team_id ( id,name,user_id )
`)
.single()

setDraftState(state)

const { data: orderData } = await supabase
  .from("draft_order")
  .select(`
    draft_position,
    team:team_id (
  id,
  name,
  logo,
  user_id
)
  `)
  .order("draft_position", { ascending: true })

  if(orderData){

  const teamList = orderData.map(row => row.team)

  setTeams(teamList)

}

const {data:draftPicks}=await supabase
.from("draft_picks")
.select(`
*,
team:team_id ( name ),
pokedex:pokemon_id (
name,
sprite,
type1,
type2
)
`)
.order("pick_number",{ascending:true})

if(draftPicks?.length > previousPickCount.current){

const audio=new Audio("/sounds/pick.mp3")
audio.volume=0.5
audio.play()

}

previousPickCount.current=draftPicks?.length || 0

setPicks(draftPicks || [])

if(!state?.season_id){
setLoading(false)
return
}

const {data:seasonPokemon}=await supabase
.from("season_pokemon")
.select(`
pokemon_id,
points,
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
)
`)
.eq("season_id",state.season_id)
.eq("available",true)

const map={}

seasonPokemon?.forEach(p=>{
map[p.pokemon_id]=p.points
})

setPointsMap(map)

const pickedIds=draftPicks?.map(p=>p.pokemon_id) || []

const availablePokemon=
seasonPokemon
?.filter(p=>!pickedIds.includes(p.pokemon_id)) || []

setPokemon(availablePokemon)

setLoading(false)
}

/* REALTIME */

useEffect(()=>{

fetchDraft()

const channel=supabase
.channel("draft-live")
.on(
"postgres_changes",
{event:"*",schema:"public",table:"draft_state"},
()=>fetchDraft()
)
.on(
"postgres_changes",
{event:"*",schema:"public",table:"draft_picks"},
()=>fetchDraft()
)
.subscribe()

return ()=>supabase.removeChannel(channel)

},[])

/* TIMER */

useEffect(() => {

  if (!draftState?.turn_started_at) {
    setTimeLeft(30)
    return
  }

  const interval = setInterval(async () => {

    const elapsed = Math.floor(
      (Date.now() - new Date(draftState.turn_started_at).getTime()) / 1000
    )

    const remaining = Math.max(30 - elapsed, 0)

    setTimeLeft(remaining)

    if (remaining === 0) {
      try {
        await supabase.rpc("force_auto_pick")
      } catch (err) {
        console.error("Autopick error:", err)
      }
    }

  }, 1000)

  return () => clearInterval(interval)

}, [draftState?.turn_started_at])

/* UTIL */

function toggleType(type){

if(typeFilter.includes(type)){
setTypeFilter(typeFilter.filter(t=>t!==type))
}else{
setTypeFilter([...typeFilter,type])
}

}

function getTeamIndex(round,index){

const teamCount=teams.length

if(round%2===1) return index

return teamCount-1-index

}

function findPick(round,teamId){

return picks.find(p=>p.round===round && p.team_id===teamId)

}

/* ACTION */

const [picking,setPicking] = useState(false)

async function makePick(pokemonId){

if(picking) return

setPicking(true)

const poke=pokemon.find(p=>p.pokemon_id===pokemonId)

const confirmPick=confirm(`Confirmar elección de ${poke.pokedex.name}?`)

if(!confirmPick){
setPicking(false)
return
}

await supabase.rpc("make_draft_pick",{
p_team_id:draftState.current_team_id,
p_pokemon_id:pokemonId
})

setPicking(false)
}

/* FILTER */

let filtered=[...pokemon]

if(search){

filtered=filtered.filter(p=>
p.pokedex.name.toLowerCase().includes(search.toLowerCase())
)

}

if(typeFilter.length){

filtered=filtered.filter(p=>
typeFilter.includes(p.pokedex.type1) ||
typeFilter.includes(p.pokedex.type2)
)

}

filtered.sort((a,b)=> sortPoints==="desc"
? b.points-a.points
: a.points-b.points
)

/* RENDER */

if(loading) return <div className="p-10">Cargando Draft...</div>

const teamCount = teams.length || 16
const rounds = 10

const uniqueTypes = [
...new Map(
pokemon.map(p => [
p.pokedex.type1,
{
name: p.pokedex.type1,
image: p.pokedex.type1image
}
])
).values()
]

const myTeamId = teams.find(t => t.user_id === user?.id)?.id

const typeColors = {
Normal:"#A8A77A",
Fire:"#EE8130",
Water:"#6390F0",
Electric:"#F7D02C",
Grass:"#7AC74C",
Ice:"#96D9D6",
Fighting:"#C22E28",
Poison:"#A33EA1",
Ground:"#E2BF65",
Flying:"#A98FF3",
Psychic:"#F95587",
Bug:"#A6B91A",
Rock:"#B6A136",
Ghost:"#735797",
Dragon:"#6F35FC",
Dark:"#705746",
Steel:"#B7B7CE",
Fairy:"#D685AD"
}

const teamPicks =
myTeamId
? picks.filter(p=>p.team_id===myTeamId)
: []

const pointsUsed = teamPicks.reduce((sum,p)=>{
return sum + (pointsMap[p.pokemon_id] || 0)
},0)

const pointsRemaining = 130 - pointsUsed

return(

<div className="h-screen flex flex-col">

{/* ADMIN FLOATING CONTROLS */}

{isAdmin && (

<div className="fixed bottom-6 right-20 flex gap-2 z-50">

{/* DRAFT NO INICIADO */}

{!draftState?.is_active && !draftState?.is_finished && (

<>
<button
onClick={async ()=>{
await supabase.rpc("start_draft")
fetchDraft()
}}
className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-green-700 transition"
>
Iniciar
</button>

<button
onClick={async ()=>{
await supabase.rpc("reset_draft")
fetchDraft()
}}
className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-red-700 transition"
>
Reset
</button>
</>

)}

{/* DRAFT EN PROCESO */}

{draftState?.is_active && !draftState?.is_paused && (

<>
<button
onClick={async ()=>{
await supabase.rpc("pause_draft")
fetchDraft()
}}
className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-yellow-600 transition"
>
Pausar
</button>

<button
onClick={async ()=>{
await supabase.rpc("finish_draft")
fetchDraft()
}}
className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-purple-700 transition"
>
Finalizar
</button>

<button
onClick={async ()=>{
await supabase.rpc("reset_draft")
fetchDraft()
}}
className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-red-700 transition"
>
Reset
</button>
</>

)}

{/* DRAFT PAUSADO */}

{draftState?.is_active && draftState?.is_paused && (

<>
<button
onClick={async ()=>{
await supabase.rpc("resume_draft")
fetchDraft()
}}
className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-blue-700 transition"
>
Reanudar
</button>

<button
onClick={async ()=>{
await supabase.rpc("finish_draft")
fetchDraft()
}}
className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-purple-700 transition"
>
Finalizar
</button>

<button
onClick={async ()=>{
await supabase.rpc("reset_draft")
fetchDraft()
}}
className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-red-700 transition"
>
Reset
</button>
</>

)}

{/* DRAFT FINALIZADO */}

{draftState?.is_finished && (

<>
<button
onClick={async ()=>{
await supabase.rpc("export_draft_to_rosters")
alert("Rosters exportados correctamente")
}}
className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-blue-700 transition"
>
Exportar
</button>

<button
onClick={async ()=>{
await supabase.rpc("reset_draft")
fetchDraft()
}}
className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm shadow hover:bg-red-700 transition"
>
Reset
</button>
</>

)}

</div>

)}



<div
className="flex-1 overflow-y-auto px-6"
style={{
paddingBottom: showPanel ? "55vh" : "40px"
}}
>

{/* TEAM HEADERS */}

<div
className="grid mb-3"
style={{
gridTemplateColumns:`repeat(${teamCount},1fr)`
}}
>

{Array.from({length:teamCount}).map((_,i)=>{

const team=teams[i]

if(!team){
return(
<div key={i} className="text-center text-xs opacity-40">
Team {i+1}
</div>
)
}

const isCurrent = draftState?.current_team_id === team.id

return(

<div
key={team.id}
className={`flex flex-col items-center rounded-md px-1 py-1 transition-all duration-300
${isCurrent ? "bg-yellow-100 shadow-md scale-105" : ""}`}
>

<img
src={team.logo}
className={`mb-1 object-contain transition-all duration-300
${isCurrent ? "w-16 h-16" : "w-12 h-12"}`}
/>

<div
className={`text-[12px] font-semibold text-center leading-tight
${isCurrent ? "text-yellow-700" : ""}`}
>
{team.name}
</div>

</div>

)

})}

</div>


{/* PICKS GRID */}

<div
className="grid gap-[3px]"
style={{
gridTemplateColumns:`repeat(${teamCount},1fr)`
}}
>

{Array.from({length:rounds}).map((_,r)=>{

const round=r+1

return Array.from({length:teamCount}).map((_,c)=>{

const teamIndex=
round%2===1
? c
: teamCount-1-c

const team=teams[teamIndex]

const pick=picks.find(
p=>p.round===round && p.team_id===team?.id
)

const pickPosition =
round % 2 === 1
? c + 1
: teamCount - c

const label = `${round}.${pickPosition}`

return(

<div
key={`${round}-${c}`}
className={`relative h-[64px] border border-slate-200 rounded-lg
flex flex-col items-center justify-center text-[10px]
transition
${pick ? "" : "bg-white hover:bg-slate-50"}`}
style={{

background: (() => {

if(!pick) return "white"

const t1 = pick.pokedex?.type1
const t2 = pick.pokedex?.type2 === "None" ? null : pick.pokedex?.type2

if(t1 && t2){

return `linear-gradient(135deg,
${typeColors[t1]} 50%,
${typeColors[t2]} 50%)`

}

if(t1){
return typeColors[t1]
}

return "white"

})()

}}
>

{/* PICK NUMBER */}

<div className="absolute top-[2px] right-[4px] text-[9px] opacity-60">
{label}
</div>

{/* POKEMON */}

{pick && (

<>
<img
src={pick.pokedex?.sprite}
className="w-7"
/>

<div className="text-[10px] font-semibold text-center leading-tight text-white drop-shadow">
{pick.pokedex?.name}
</div>

</>

)}

</div>

)

})

})}

</div>

</div>

{/* PANEL BUTTON */}

<button
  onClick={() => setShowPanel(!showPanel)}
  className="
  fixed right-6 z-50
  w-11 h-11
  rounded-full
  flex items-center justify-center
  bg-red-600/80
  backdrop-blur-md
  text-white
  shadow-lg
  hover:bg-red-600
  transition-all duration-300
  "
  style={{
    bottom: showPanel ? "calc(50vh + 16px)" : "24px"
  }}
>

{showPanel ? (

/* ICONO CERRAR (flecha abajo) */

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2.5"
  className="w-5 h-5"
>
  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
</svg>

) : (

/* ICONO ABRIR (flecha arriba) */

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2.5"
  className="w-5 h-5"
>
  <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
</svg>

)}

</button>

{/* SLIDE PANEL */}

<div
className={`fixed bottom-0 left-0 w-full h-1/2 bg-white border-t shadow-2xl transition-transform duration-500
${showPanel?"translate-y-0":"translate-y-full"}`}
>

<div className="grid grid-cols-4 h-full">

{/* LIST */}

<div className="col-span-2 overflow-y-auto p-4">

{/* SEARCH + FILTER */}

<div className="flex items-center gap-3 mb-3">

<input
type="text"
placeholder="Buscar Pokémon..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="border rounded px-2 py-1 text-sm w-48"
/>

{/* TYPE FILTERS */}

<div className="flex gap-1 flex-wrap">

{uniqueTypes.map(type=>(

<img
key={type.name}
src={type.image}
onClick={()=>toggleType(type.name)}
className={`h-5 cursor-pointer
${typeFilter.includes(type.name)
? "ring-2 ring-red-500"
: "opacity-70 hover:opacity-100"}
`}
/>

))}

</div>

</div>


{/* TABLE */}

<table className="w-full text-sm">

<thead className="border-b text-xs text-slate-500">

<tr>

<th></th>

<th className="text-left">Pokemon</th>

<th
className="cursor-pointer"
onClick={()=>
setSortPoints(sortPoints==="desc" ? "asc" : "desc")
}
>
Pts
</th>

<th>Types</th>

<th className="text-left">Abilities</th>

</tr>

</thead>

<tbody>

{filtered.map(p=>{

const abilities=[
p.pokedex.ability1,
p.pokedex.ability2,
p.pokedex.hiddenability
]
.filter(a=>a && a!=="None")
.join(" / ")

return(

<tr
key={p.pokemon_id}
onClick={()=>{
if(draftState?.currentTeam?.user_id===user?.id){
makePick(p.pokemon_id)
}
}}
className="border-b hover:bg-slate-50 cursor-pointer"
>

<td>
<img src={p.pokedex.sprite} className="w-8"/>
</td>

<td className="font-medium">
{p.pokedex.name}
</td>

<td>{p.points}</td>

<td className="flex gap-1 items-center">

<img
src={p.pokedex.type1image}
className="h-4"
/>

{p.pokedex.type2image && (
<img
src={p.pokedex.type2image}
className="h-4"
/>
)}

</td>

<td className="text-xs text-slate-500">
{abilities}
</td>

</tr>

)

})}

</tbody>

</table>

</div>

{/* TEAM PICKS */}

<div className="col-span-1 border-l p-6">

<h3 className="font-semibold mb-4 text-center">
Picks del Equipo
</h3>

<div className="text-center text-sm text-slate-600 mb-3">
Puntos restantes: 
<span className="font-bold text-red-600 ml-1">
{pointsRemaining}
</span>
</div>

{/* GRID 5x2 */}

<div className="grid grid-cols-5 gap-2 mb-6">

{Array.from({length:10}).map((_,i)=>{

const teamPicks =
myTeamId
? picks.filter(p=>p.team_id===myTeamId)
: []

const pick = teamPicks[i]

return(

<div
key={i}
className="h-16 border rounded flex flex-col items-center justify-center bg-white"
>

{pick && (

<>
<img
src={pick.pokedex?.sprite}
className="w-10"
/>

<div className="text-[10px] text-center leading-tight">
{pick.pokedex?.name}
</div>
</>

)}

</div>

)

})}

</div>

{/* TYPE COUNTER */}

{(() => {

const typeCount = {}

teamPicks.forEach(p => {

const t1 = p.pokedex?.type1
const t2 = p.pokedex?.type2

if(t1) typeCount[t1] = (typeCount[t1] || 0) + 1
if(t2) typeCount[t2] = (typeCount[t2] || 0) + 1

})

const allTypes = [
"Normal","Fire","Water","Electric","Grass","Ice",
"Fighting","Poison","Ground","Flying","Psychic",
"Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
]

return(

<div className="grid grid-cols-3 gap-2">

{allTypes.map(type=>{

const count = typeCount[type] || 0

const typeImage =
pokemon.find(p=>p.pokedex.type1===type)?.pokedex.type1image

return(

<div
key={type}
className={`flex items-center gap-1 border rounded px-2 py-1
${count>0 ? "bg-green-50" : "bg-slate-50 opacity-60"}
`}
>

{typeImage && (
<img
src={typeImage}
className="h-4"
/>
)}

<span className="text-xs font-semibold">
{count}
</span>

</div>

)

})}

</div>

)

})()}

</div>

<div className="col-span-1 border-l p-6 flex flex-col items-center justify-center">

<div className="text-lg font-semibold mb-4 text-slate-600 text-center">

{!draftState?.is_active
? "DRAFT NO COMENZADO"
: draftState?.currentTeam?.user_id===user?.id
? "TOCA ELEGIR"
: "EN ESPERA DE TURNO"}

</div>

<div className="text-7xl font-bold text-red-600 leading-none">
{timeLeft}
</div>

<div className="text-xs text-slate-400 mt-2">
segundos
</div>

</div>

</div>

</div>

</div>

)

}