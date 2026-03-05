import { useMemo } from "react"

const types = [
"Normal","Fire","Water","Electric","Grass","Ice",
"Fighting","Poison","Ground","Flying","Psychic",
"Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
]

const typeColors = {
Normal:"border-gray-400",
Fire:"border-red-500",
Water:"border-blue-500",
Electric:"border-yellow-400",
Grass:"border-green-500",
Ice:"border-cyan-400",
Fighting:"border-red-700",
Poison:"border-purple-500",
Ground:"border-yellow-700",
Flying:"border-indigo-400",
Psychic:"border-pink-500",
Bug:"border-lime-500",
Rock:"border-yellow-800",
Ghost:"border-violet-600",
Dragon:"border-indigo-700",
Dark:"border-gray-700",
Steel:"border-slate-500",
Fairy:"border-pink-400"
}

export default function TeamTypeAnalysis({ roster }) {

const rows = useMemo(()=>{

return roster.map(pokemon=>{

if(!pokemon){
const empty={}
types.forEach(t=>empty[t]="")
return empty
}

const row={}

types.forEach(type=>{

const mult=getMultiplier(type,pokemon.type1,pokemon.type2)

if(mult===4) row[type]="4×"
else if(mult===2) row[type]="2×"
else if(mult===0.5) row[type]="½"
else if(mult===0.25) row[type]="¼"
else if(mult===0) row[type]="IMM"
else row[type]=""

})

return row

})

},[roster])


const totals = useMemo(()=>{

const weak={}
const resist={}

types.forEach(t=>{
weak[t]=0
resist[t]=0
})

rows.forEach(row=>{

types.forEach(type=>{

const v=row[type]

if(v==="2×") weak[type]+=1
if(v==="4×") weak[type]+=2

if(v==="½") resist[type]+=1
if(v==="¼") resist[type]+=2
if(v==="IMM") resist[type]+=2

})

})

return {weak,resist}

},[rows])


return(

<div className="bg-white border rounded-xl p-6">

<h3 className="font-semibold mb-4">
Type Resistance Analysis
</h3>

<table className="w-full text-[11px] table-fixed">

<thead>

<tr>

<th className="w-28 text-left pb-2">
Pokemon
</th>

{types.map(type=>(
<th
key={type}
className={`pb-2 text-center border-b-4 ${typeColors[type]} font-medium`}
>
{type}
</th>
))}

</tr>

</thead>

<tbody>

{roster.map((pokemon,i)=>{

const row=rows[i]

return(

<tr key={i} className="border-b h-9">

<td className="flex items-center gap-2">

{pokemon && (
<img src={pokemon.sprite} className="w-6"/>
)}

</td>

{types.map(type=>{

const value=row[type]

return(

<td key={type} className="text-center">

{value==="2×" && <span className="text-red-600 font-medium">2×</span>}
{value==="4×" && <span className="text-red-700 font-semibold">4×</span>}

{value==="½" && <span className="text-green-600">½</span>}
{value==="¼" && <span className="text-green-700 font-semibold">¼</span>}

{value==="IMM" &&
<span className="text-gray-600 text-[10px]">
IMM
</span>
}

</td>

)

})}

</tr>

)

})}


<tr className="border-t">

<td className="font-medium pt-2">
Weak
</td>

{types.map(t=>(
<td key={t} className="text-red-600 text-center pt-2">
{totals.weak[t]}
</td>
))}

</tr>


<tr>

<td className="font-medium">
Resist
</td>

{types.map(t=>(
<td key={t} className="text-green-600 text-center">
{totals.resist[t]}
</td>
))}

</tr>

</tbody>

</table>

</div>

)

}


function getMultiplier(attack,t1,t2){

const chart={

Fire:{Grass:2,Ice:2,Bug:2,Steel:2,Fire:0.5,Water:0.5,Rock:0.5,Dragon:0.5},
Water:{Fire:2,Ground:2,Rock:2,Water:0.5,Grass:0.5,Dragon:0.5},
Grass:{Water:2,Ground:2,Rock:2,Fire:0.5,Grass:0.5,Poison:0.5,Flying:0.5,Bug:0.5,Dragon:0.5,Steel:0.5},
Electric:{Water:2,Flying:2,Electric:0.5,Grass:0.5,Dragon:0.5,Ground:0},
Ice:{Grass:2,Ground:2,Flying:2,Dragon:2,Fire:0.5,Water:0.5,Ice:0.5,Steel:0.5},
Fighting:{Normal:2,Ice:2,Rock:2,Dark:2,Steel:2,Poison:0.5,Flying:0.5,Psychic:0.5,Bug:0.5,Fairy:0.5,Ghost:0},
Ground:{Fire:2,Electric:2,Poison:2,Rock:2,Steel:2,Grass:0.5,Bug:0.5,Flying:0},
Flying:{Grass:2,Fighting:2,Bug:2,Electric:0.5,Rock:0.5,Steel:0.5},
Psychic:{Fighting:2,Poison:2,Psychic:0.5,Steel:0.5,Dark:0},
Rock:{Fire:2,Ice:2,Flying:2,Bug:2,Fighting:0.5,Ground:0.5,Steel:0.5},
Ghost:{Psychic:2,Ghost:2,Dark:0.5,Normal:0},
Dragon:{Dragon:2,Steel:0.5,Fairy:0},
Dark:{Psychic:2,Ghost:2,Fighting:0.5,Dark:0.5,Fairy:0.5},
Steel:{Ice:2,Rock:2,Fairy:2,Fire:0.5,Water:0.5,Electric:0.5,Steel:0.5},
Fairy:{Fighting:2,Dragon:2,Dark:2,Fire:0.5,Poison:0.5,Steel:0.5}

}

let mult=1

if(chart[attack]?.[t1]) mult*=chart[attack][t1]
if(t2 && chart[attack]?.[t2]) mult*=chart[attack][t2]

return mult

}