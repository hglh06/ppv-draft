import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Pokedex() {

  const [pokemon, setPokemon] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredPokemon, setHoveredPokemon] = useState(null)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [takenPokemon, setTakenPokemon] = useState([])
  const [search, setSearch] = useState("")
  const [hoverTimer, setHoverTimer] = useState(null)

  useEffect(() => {
    loadPokedex()
  }, [])

  async function loadPokedex() {

    setLoading(true)

    const { data: seasonData } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .single()

    if (!seasonData) {
      setLoading(false)
      return
    }

    const { data: seasonPokemon } = await supabase
      .from("season_pokemon")
      .select("pokemon_id, points")
      .eq("season_id", seasonData.id)
      .eq("available", true)
      .range(0, 5000)

    const { data: pokedexData } = await supabase
      .from("pokedex")
      .select("*")
      .range(0, 5000)

    if (!seasonPokemon || !pokedexData) {
      setLoading(false)
      return
    }

    const pokedexMap = Object.fromEntries(
      pokedexData.map(p => [String(p.id), p])
    )

    const merged = seasonPokemon.map(sp => {

      const pokeData = pokedexMap[String(sp.pokemon_id)]

      if (!pokeData) return null

      return {
        points: sp.points,
        pokedex: pokeData
      }

    }).filter(Boolean)

   const { data: rosterData } = await supabase
  .from("rosters")
  .select(`
    pokedex(name)
  `)

const taken = rosterData?.map(r => r.pokedex?.name)

setTakenPokemon(taken || [])
    setPokemon(merged)
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center mt-20">Cargando Pokémon...</div>
  }

  const grouped = pokemon.reduce((acc, p) => {

    if (!p || !p.pokedex) return acc

    const pts = Number(p.points)

    if (isNaN(pts)) return acc

    if (!acc[pts]) acc[pts] = []

    acc[pts].push(p)

    return acc

  }, {})

  const sortedTiers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)

  return (
  <div
  className="min-h-screen -mt-24 pt-32 px-12 pb-4 flex flex-col overflow-hidden"
    style={{
      backgroundImage: "url('/hex-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    }}
  >

      {/* frase */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <p className="text-lg text-slate-700 italic leading-relaxed">
          “Pokémon fuertes. Pokémon débiles. Esa es solo la percepción egoísta de la gente.
          Los entrenadores verdaderamente hábiles deberían intentar ganar con sus favoritos.”
        </p>
        <p className="mt-3 text-sm text-slate-500">
          — Karen, Pokémon Oro/Plata
        </p>
      </div>

      <div className="max-w-md mx-auto mb-8">

  <input
    type="text"
    placeholder="Search Pokémon..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
  />

</div>

      <div className="flex-1 w-full overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">

          {sortedTiers.map(points => (

            <div
              key={points}
              className="bg-white rounded-lg border border-slate-200 w-[160px] min-w-[160px] h-[64vh] flex flex-col"
            >

              <div className="sticky top-0 bg-white border-b py-1 text-center font-semibold text-sm text-slate-700">
                {points} pts
              </div>

              <div className="overflow-y-auto flex-1 p-2 space-y-1">

                {grouped[points]
                  .filter(p =>
  p.pokedex.name.toLowerCase().includes(search.toLowerCase())
)
.sort((a, b) =>
  a.pokedex.name.localeCompare(b.pokedex.name)
)
.map(p => {

                    const poke = p.pokedex
                    const isTaken = takenPokemon.includes(poke.name)

                    return (
                      <div
                        key={poke.id}
                        className={`flex items-center gap-2 p-1 rounded transition
                        ${isTaken
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "hover:bg-slate-50 cursor-pointer"}
                      `}
                        onMouseEnter={(e) => {

  if (isTaken) return

  const rect = e.currentTarget.getBoundingClientRect()

  const timer = setTimeout(() => {

    let x = rect.right + 8

    if (x + 320 > window.innerWidth) {
      x = rect.left - 330
    }

    setPopupPosition({
      x,
      y: rect.top
    })

    setHoveredPokemon(poke)

  }, 1000)

  setHoverTimer(timer)

}}
                        onMouseLeave={() => {
  clearTimeout(hoverTimer)
  setHoveredPokemon(null)
}}
                      >

                        {poke.sprite && (
                          <img
                            src={poke.sprite}
                            alt={poke.name}
                            className={`w-6 ${isTaken ? "opacity-40" : ""}`}
                          />
                        )}

                        <div className="flex justify-between w-full text-xs font-medium">
  <span className="truncate">{poke.name}</span>

  {isTaken && (
    <span className="text-[10px] font-semibold text-red-500">
      Drafted
    </span>
  )}
</div>

                      </div>
                    )
                  })}

              </div>

            </div>

          ))}

        </div>
      </div>

      {hoveredPokemon && (
        <PokemonPopup
          pokemon={hoveredPokemon}
          position={popupPosition}
        />
      )}

    </div>
  )
}

function PokemonPopup({ pokemon, position }) {

  return (
    <div
      className="fixed bg-white border border-slate-200 shadow-xl rounded-xl p-6 w-80 z-50"
      style={{
        top: position.y,
        left: position.x
      }}
    >

      <div className="flex items-center gap-4 mb-4">
        {pokemon.sprite && (
          <img
  src={pokemon.sprite}
  alt={pokemon.name}
  className="w-20 pokemon-float"
/>
        )}

        <h3 className="text-xl font-bold text-slate-800">
          {pokemon.name}
        </h3>
      </div>

      <div className="flex gap-4 mb-4">

        {pokemon.type1 && (
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
            <img src={pokemon.type1image} className="w-5"/>
            <span className="text-sm font-semibold">
              {pokemon.type1}
            </span>
          </div>
        )}

        {pokemon.type2 && pokemon.type2 !== "None" && (
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
            <img src={pokemon.type2image} className="w-5"/>
            <span className="text-sm font-semibold">
              {pokemon.type2}
            </span>
          </div>
        )}

      </div>

      <div className="space-y-2 text-sm text-slate-600">

        {pokemon.ability1 && (
          <div><strong>Ability 1:</strong> {pokemon.ability1}</div>
        )}

        {pokemon.ability2 && pokemon.ability2 !== "None" && (
          <div><strong>Ability 2:</strong> {pokemon.ability2}</div>
        )}

        {pokemon.hiddenability && pokemon.hiddenability !== "None" && (
          <div><strong>Hidden:</strong> {pokemon.hiddenability}</div>
        )}

      </div>

    </div>
  )
}