import { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {

  const [teams, setTeams] = useState([])
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [pokemonLeaders, setPokemonLeaders] = useState([])
  const revealRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (revealRef.current) {
      observer.observe(revealRef.current)
    }

    return () => observer.disconnect()

  }, [])

  async function loadTeams() {

  /* TEAMS */

  const { data: teamsData } = await supabase
    .from("teams")
    .select("id,name,logo,conference,coach_name")

  setTeams(teamsData || [])

  /* MATCHES */

  const { data: matchesData } = await supabase
  .from("matches")
  .select(`
  week,
  status,
  conference,
  teamA:team_a(logo),
  teamB:team_b(logo)
`)
  .order("week",{ascending:true})

  // encontrar la primera semana con matches pendientes

const nextWeek = matchesData
  ?.find(m => m.status !== "completed")
  ?.week

const weekMatches = matchesData
  ?.filter(m => m.week === nextWeek && m.status !== "completed")

const kantoMatches = weekMatches?.filter(m => m.conference === "Kanto")
const johtoMatches = weekMatches?.filter(m => m.conference === "Johto")

setMatches({
  kanto: kantoMatches || [],
  johto: johtoMatches || []
})


  /* REPORTS */

  const { data: reportsData } = await supabase
    .from("reports")
    .select("*")
    .eq("status","approved")

  /* POKEDEX */

  const { data: pokedexData } = await supabase
    .from("pokedex")
    .select("name,sprite")

  /* CALCULAR POKEMON LEADERBOARD */

  const stats = {}

  reportsData?.forEach(report => {

    const sides = [
      ...(report.team_a_data || []),
      ...(report.team_b_data || [])
    ]

    sides.forEach(pokemon => {

      if (!stats[pokemon.name]) {
        stats[pokemon.name] = {
          name: pokemon.name,
          games: 0,
          kills: 0,
          deaths: 0
        }
      }

      pokemon.games.forEach(g => {
        stats[pokemon.name].games++
        stats[pokemon.name].kills += g.kills
        stats[pokemon.name].deaths += g.deaths
      })

    })

  })

  const rows = Object.values(stats).map(p => {

    const poke = pokedexData?.find(pk => pk.name === p.name)

    const ratio =
      p.deaths === 0 ? p.kills : (p.kills / p.deaths)

    return {
      ...p,
      sprite: poke?.sprite || "",
      ratio
    }

  })

  rows.sort((a,b)=>b.ratio-a.ratio)

  setPokemonLeaders(rows.slice(0,3))

  setStandings(teamsData || [])

}

function getConferenceTop(conference){

  const confTeams = standings
  .filter(t=>t.conference === conference)

  return confTeams.slice(0,3)

}

  return (
    <div className="w-full overflow-x-hidden">

      {/* ================= HERO ================= */}

      <section className="relative h-screen w-full overflow-hidden">

        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="https://ftqjbvtivchkcotgljbc.supabase.co/storage/v1/object/sign/assets/home-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mYTcyNjVjYi0wYjE1LTQ0NzktYWYzZS0zM2M5NGYwMDA5ZjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvaG9tZS1iZy5tcDQiLCJpYXQiOjE3NzI3NTA2NjgsImV4cCI6MTgwNDI4NjY2OH0.pIvBetHPwrg-fg4-m8RIIl4zvJk8iQ7KiBtrBPlgzPc"
          autoPlay
          muted
          loop
          playsInline
        />

        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 flex items-center justify-center h-full">
          <img
            src="/logo-ppv.png"
            alt="PPV Logo"
            className="w-80 md:w-[35%]"
          />
        </div>

      </section>

      {/* ================= MARQUEE 1 ================= */}

      <Marquee>
  {teams.map((t, i) => (
    <img
      key={i}
      src={t.logo}
      alt={t.name}
      className="mx-10 h-12 w-auto object-contain opacity-80 hover:opacity-100 hover:scale-110 transition duration-300"
    />
  ))}
</Marquee>

      {/* ================= MARQUEE 2 ================= */}

      <Marquee reverse>
        {[
          "Estrategia",
          "Competencia",
          "Draft Inteligente",
          "Trades Estratégicos",
          "Waivers Dinámicos",
          "Playoffs Intensos",
          "Meta Evolutivo",
          "Dominio Total"
        ].map((text, i) => (
          <span key={i} className="mx-10 text-xl tracking-widest">
            {text}
          </span>
        ))}
      </Marquee>

      {/* ================= HEX BACKGROUND WRAPPER ================= */}

      <div
  style={{
    backgroundImage: "url('/hex-bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center"
  }}
>

        {/* ================= MENSAJE ================= */}

        <section className="pt-32 pb-12 px-8 text-center">

          <h2 className="text-5xl font-bold mb-10">
            Siente tu liga. Vive cada pick. Domina cada semana.
          </h2>

          <p className="max-w-3xl mx-auto text-lg text-slate-600 leading-relaxed">
            PPV no es solo competencia. Es visión, estrategia y carácter.
            Cada draft construye historias. Cada trade redefine destinos.
            Cada batalla acerca al campeonato.
          </p>

        </section>

        {/* ================= LEAGUE STATUS ================= */}

<section className="pb-20 px-8">

<div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">

{/* ================= KANTO ================= */}

<div className="p-6">

<h3 className="font-bold text-xl mb-6 text-center">
Kanto Conference
</h3>

{/* TOP 3 */}

<div className="mb-8">

{getConferenceTop("Kanto").map((t,i)=>(
<div key={i} className="flex items-center gap-3 mb-2">

<img src={t.logo} className="w-8 h-8"/>

<span>{t.name}</span>

</div>
))}

</div>

{/* MATCHES */}

<div>

<h4 className="font-semibold mb-4 text-center text-slate-600">
Week {matches.kanto?.[0]?.week}
</h4>

{matches.kanto?.map((m,i)=>(

<div key={i} className="flex justify-center gap-6 mb-3">

<img
src={m.teamA.logo}
className="w-10 h-10 object-contain hover:scale-110 transition"
/>

<span className="text-slate-400 font-semibold">
vs
</span>

<img
src={m.teamB.logo}
className="w-10 h-10 object-contain hover:scale-110 transition"
/>

</div>

))}

</div>

</div>


{/* ================= JOHTO ================= */}

<div className="p-6">

<h3 className="font-bold text-xl mb-6 text-center">
Johto Conference
</h3>

{/* TOP 3 */}

<div className="mb-8">

{getConferenceTop("Johto").map((t,i)=>(
<div key={i} className="flex items-center gap-3 mb-2">

<img src={t.logo} className="w-8 h-8"/>

<span>{t.name}</span>

</div>
))}

</div>

{/* MATCHES */}

<div>

<h4 className="font-semibold mb-4 text-center text-slate-600">
Week {matches.johto?.[0]?.week}
</h4>

{matches.johto?.map((m,i)=>(

<div key={i} className="flex justify-center gap-6 mb-3">

<img
src={m.teamA.logo}
className="w-10 h-10 object-contain hover:scale-110 transition"
/>

<span className="text-slate-400 font-semibold">
vs
</span>

<img
src={m.teamB.logo}
className="w-10 h-10 object-contain hover:scale-110 transition"
/>

</div>

))}

</div>

</div>

</div>


{/* ================= POKEMON LEADERBOARD ================= */}

<div className="max-w-md mx-auto mt-16 p-6">

<h3 className="font-bold text-xl mb-4 text-center">
Top Pokémon
</h3>

{pokemonLeaders.map((p,i)=>(

<div key={i} className="flex items-center gap-3 mb-3">

<img src={p.sprite} className="w-8"/>

<span className="flex-1">{p.name}</span>

<span className="font-semibold text-slate-600">
{p.ratio.toFixed(2)}
</span>

</div>

))}

</div>

</section>

        {/* ================= PPV REVEAL ================= */}

        <section
          ref={revealRef}
          className="pt-12 pb-32 px-8 text-center overflow-hidden"
        >

          <div className="grid md:grid-cols-3 gap-20 max-w-6xl mx-auto">

            <Reveal visible={visible}>
              <Letter image="/ppv-p.jpg">P</Letter>
              <p className="mt-6 text-lg text-slate-600">
                Precisión estratégica en cada movimiento.
              </p>
            </Reveal>

            <Reveal visible={visible} delay={200}>
              <Letter image="/ppv-p2.jpg">P</Letter>
              <p className="mt-6 text-lg text-slate-600">
                Pasión competitiva que impulsa campeones.
              </p>
            </Reveal>

            <Reveal visible={visible} delay={400}>
              <Letter image="/ppv-v.jpg">V</Letter>
              <p className="mt-6 text-lg text-slate-600">
                Visión táctica para dominar el meta.
              </p>
            </Reveal>

          </div>

        </section>

      </div>

    </div>
  )
}

/* ================= MARQUEE ================= */

function Marquee({ children, reverse }) {

  const bg = reverse ? "bg-red-600" : "bg-black"

  return (
    <div className={`${bg} py-6 overflow-hidden`}>
      <div
        className={`flex items-center w-max ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {children}
        {children}
      </div>
    </div>
  )
}

/* ================= REVEAL ================= */

function Reveal({ children, visible, delay = 0 }) {

  return (
    <div
      className={`transform transition-all duration-1000 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-20"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )

}

/* ================= LETTER ================= */

function Letter({ children, image }) {

  return (
    <h3
      className="text-[260px] font-extrabold leading-none"
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        WebkitBackgroundClip: "text",
        color: "transparent"
      }}
    >
      {children}
    </h3>
  )

}