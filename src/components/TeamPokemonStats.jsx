import { useMemo } from "react"

export default function TeamPokemonStats({ roster, reports, rowHeight }) {

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

<div className="bg-white border rounded-xl p-3 md:p-6 h-full w-full">

<h3 className="font-semibold mb-4">
Pokemon Performance
</h3>

<table className="w-full text-xs md:text-sm">

<thead className="text-center">

<tr className="border-b text-[10px] md:text-xs text-center">
<th className="text-left">Pokemon</th>
<th className="text-center">G</th>
<th className="text-center">K</th>
<th className="text-center">D</th>
</tr>

</thead>

<tbody>

{roster.map((p,i)=>{

if(!p){
return(

<tr
  key={i}
  className="border-b text-slate-300"
  style={{height:`${rowHeight}px`}}
className="border-b h-10 md:h-auto"
>
<td>Empty</td>
<td>0</td>
<td>0</td>
<td>0</td>
</tr>
)
}

const s=stats[p.name] || {games:0,kills:0,deaths:0}

return(

<tr
  key={i}
  className="border-b"
  style={{height:`${rowHeight}px`}}
className="border-b h-10 md:h-auto"
>

<td>
 <div className="flex items-center gap-1 md:gap-2 h-full">

  <img
    src={p.sprite}
    className="w-6 md:w-10"
  />

  <span className="truncate max-w-[80px] md:max-w-none">
    {p.name}
  </span>

</div>
</td>

<td className="text-center w-8 md:w-auto">
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
