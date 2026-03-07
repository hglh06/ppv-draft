import { useMemo } from "react"

export default function TeamPokemonStats({ roster, reports }) {

const stats = useMemo(()=>{

const base = {}

roster.forEach(p=>{

if(!p) return

base[p.name]={
games:0,
kills:0,
deaths:0
}

})

reports.forEach(report=>{

const processSide=(side)=>{

if(!side) return

side.forEach(p=>{

if(!base[p.name]) return

p.games?.forEach(g=>{

base[p.name].games+=1
base[p.name].kills+=g.kills||0
base[p.name].deaths+=g.deaths||0

})

})

}

processSide(report.team_a_data)
processSide(report.team_b_data)

})

return base

},[roster,reports])


return(

<div className="bg-white border rounded-xl p-6 h-full">

<h3 className="font-semibold mb-4">
Pokemon Performance
</h3>

<table className="w-full text-sm">

<thead className="text-center">

<tr className="border-b text-xs">

<th className="text-left">Pokemon</th>
<th>G</th>
<th>K</th>
<th>D</th>

</tr>

</thead>

<tbody>

{roster.map((p,i)=>{

if(!p){

return(
<tr key={i} className="border-b h-10 text-slate-300">
<td>Empty</td>
<td>0</td>
<td>0</td>
<td>0</td>
</tr>
)

}

const s=stats[p.name] || {games:0,kills:0,deaths:0}

return(

<tr key={i} className="border-b h-10">

<td className="h-10">
  <div className="flex items-center justify-center gap-2 h-full">

<img
src={p.sprite}
className="w-10"
/>

{p.name}
    </div>
</td>

<td className="text-center">
{s.games}
</td>

<td className="text-center text-green-600">
{s.kills}
</td>

<td className="text-center text-red-600">
{s.deaths}
</td>

</tr>

)

})}

</tbody>

</table>

</div>

)

}