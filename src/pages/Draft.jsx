import { useEffect,useState,useRef } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

export default function Draft(){

const { isAdmin,user } = useAuth()

const [draftState,setDraftState]=useState(null)
const [pokemon,setPokemon]=useState([])
const [picks,setPicks]=useState([])
const [teams,setTeams]=useState([])

const [pointsMap,setPointsMap] = useState({})

const [loading,setLoading]=useState(true)
const [timeLeft,setTimeLeft]=useState(30)

const [search,setSearch]=useState("")
const [typeFilter,setTypeFilter]=useState([])
const [sortPoints,setSortPoints]=useState("desc")

const [showPanel,setShowPanel]=useState(false)

const previousPickCount=useRef(0)

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
.order("draft_position",{ascending:true})

if(orderData){
setTeams(orderData.map(r=>r.team))
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
.eq("season_id",state.season_id)
.order("pick_number",{ascending:true})

if(draftPicks?.length > previousPickCount.current){
const audio=new Audio("/sounds/pick.mp3")
audio.volume=0.5
audio.play()
}

previousPickCount.current=draftPicks?.length || 0

setPicks(draftPicks || [])

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

useEffect(()=>{

if(!draftState?.turn_started_at){
setTimeLeft(30)
return
}

const interval=setInterval(async()=>{

const elapsed=Math.floor(
(Date.now()-new Date(draftState.turn_started_at).getTime())/1000
)

const remaining=Math.max(30-elapsed,0)

setTimeLeft(remaining)

if(remaining===0){
await supabase.rpc("force_auto_pick")
}

},1000)

return()=>clearInterval(interval)

},[draftState?.turn_started_at])

function toggleType(type){

if(typeFilter.includes(type)){
setTypeFilter(typeFilter.filter(t=>t!==type))
}else{
setTypeFilter([...typeFilter,type])
}

}

const [picking,setPicking]=useState(false)

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

filtered.sort((a,b)=>
sortPoints==="desc"
? b.points-a.points
: a.points-b.points
)

if(loading) return <div className="p-10">Cargando Draft...</div>

const teamCount=teams.length || 16
const rounds=10

const myTeamId=teams.find(t=>t.user_id===user?.id)?.id

const teamPicks=
myTeamId
? picks.filter(p=>p.team_id===myTeamId)
:[]

const pointsUsed=teamPicks.reduce((sum,p)=>{
return sum+(pointsMap[p.pokemon_id]||0)
},0)

const MAX_POINTS=130
const pointsRemaining=MAX_POINTS-pointsUsed

const typeColors={
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

return(

<div className="h-screen flex flex-col">

<div className="flex-1 overflow-y-auto px-6">

<div
className="grid mb-3"
style={{gridTemplateColumns:`repeat(${teamCount},1fr)`}}
>

{teams.map(team=>{

const isCurrent=draftState?.current_team_id===team.id

return(

<div
key={team.id}
className={`flex flex-col items-center
${isCurrent?"bg-yellow-100":""}`}
>

<img src={team.logo} className="w-12 h-12"/>

<div className="text-xs text-center">
{team.name}
</div>

</div>

)

})}

</div>

<div
className="grid gap-[3px]"
style={{gridTemplateColumns:`repeat(${teamCount},1fr)`}}
>

{Array.from({length:rounds}).map((_,r)=>{

const round=r+1

return Array.from({length:teamCount}).map((_,c)=>{

const teamIndex=
round%2===1
?c
:teamCount-1-c

const team=teams[teamIndex]

const pick=picks.find(
p=>p.round===round && p.team_id===team?.id
)

return(

<div
key={`${round}-${c}`}
className="h-[64px] border rounded flex flex-col items-center justify-center"
>

{pick &&(
<>
<img src={pick.pokedex?.sprite} className="w-7"/>
<div className="text-[10px]">
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

<div className="fixed bottom-0 w-full bg-white border-t p-4">

<div className="text-center">

Puntos restantes:

<span className="ml-2 font-bold text-red-600">
{pointsRemaining}
</span>

</div>

</div>

</div>

)

}