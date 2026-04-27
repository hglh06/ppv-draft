import { useMemo, useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

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

  const [typeChart, setTypeChart] = useState({})

  useEffect(() => {
    loadTypeChart()
  }, [])

  async function loadTypeChart() {
    const { data } = await supabase
      .from("type_chart")
      .select("*")

    if (!data) return

    const map = {}

    data.forEach(t => {
      map[t.type] = {
        weak: t.weak || [],
        resist: t.resist || [],
        immune: t.immune || []
      }
    })

    setTypeChart(map)
  }

  const rows = useMemo(() => {

    return roster.map(pokemon => {

      if (!pokemon) {
        const empty = {}
        types.forEach(t => empty[t] = "")
        return empty
      }

      const row = {}

      types.forEach(type => {

        const mult = getMultiplier(
          type,
          pokemon.type1,
          pokemon.type2,
          typeChart
        )

        if (mult === 4) row[type] = "4×"
        else if (mult === 2) row[type] = "2×"
        else if (mult === 0.5) row[type] = "½"
        else if (mult === 0.25) row[type] = "¼"
        else if (mult === 0) row[type] = "IMM"
        else row[type] = ""

      })

      return row

    })

  }, [roster, typeChart])


  const totals = useMemo(() => {

    const weak = {}
    const resist = {}

    types.forEach(t => {
      weak[t] = 0
      resist[t] = 0
    })

    rows.forEach(row => {

      types.forEach(type => {

        const v = row[type]

        if (v === "2×") weak[type] += 1
        if (v === "4×") weak[type] += 2

        if (v === "½") resist[type] += 1
        if (v === "¼") resist[type] += 2
        if (v === "IMM") resist[type] += 2

      })

    })

    return { weak, resist }

  }, [rows])


  return (

    <div className="bg-white border rounded-xl p-6">

      {!Object.keys(typeChart).length ? (

        <div className="text-sm text-slate-500">
          Loading type data...
        </div>

      ) : (

      <>
        <h3 className="font-semibold mb-4">
          Type Resistance Analysis
        </h3>

        <div className="overflow-x-auto">
  <table className="w-full min-w-[900px] text-[11px]">

          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-center">Pokemon</th>

              {types.map(type => (
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

            {roster.map((pokemon, i) => {

              const row = rows[i]

              return (
                <tr key={i} className="border-b h-9">

                  <td className="h-10 sticky left-0 bg-white z-10">
                    <div className="flex items-center justify-center h-full">
                      {pokemon && (
                        <img src={pokemon.sprite} className="w-8 md:w-10"/>
                      )}
                    </div>
                  </td>

                  {types.map(type => {

                    const value = row[type]

                    return (
                      <td key={type} className="text-center">

                        {value === "2×" && <span className="text-red-600 font-medium">2×</span>}
                        {value === "4×" && <span className="text-red-700 font-semibold">4×</span>}

                        {value === "½" && <span className="text-green-600">½</span>}
                        {value === "¼" && <span className="text-green-700 font-semibold">¼</span>}

                        {value === "IMM" && (
                          <span className="text-gray-600 text-[10px]">
                            IMM
                          </span>
                        )}

                      </td>
                    )

                  })}

                </tr>
              )

            })}

            <tr className="border-t">
              <td className="font-medium pt-2">Weak</td>

              {types.map(t => (
                <td key={t} className="text-red-600 text-center pt-2">
                  {totals.weak[t]}
                </td>
              ))}
            </tr>

            <tr>
              <td className="font-medium">Resist</td>

              {types.map(t => (
                <td key={t} className="text-green-600 text-center">
                  {totals.resist[t]}
                </td>
              ))}
            </tr>

          </tbody>

        </table>
        </div>
      </>
      )}

    </div>
  )
}


function getMultiplier(attack, t1, t2, chart) {

  let mult = 1

  const apply = (defType) => {

    if (!defType) return

    const data = chart[defType]
    if (!data) return

    if (data.immune.includes(attack)) {
      mult = 0
      return
    }

    if (mult !== 0) {
      if (data.weak.includes(attack)) mult *= 2
      if (data.resist.includes(attack)) mult *= 0.5
    }
  }

  apply(t1)
  apply(t2)

  return mult
}