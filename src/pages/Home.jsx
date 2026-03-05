import { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {

  const [teams, setTeams] = useState([])
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

    const { data } = await supabase
      .from("teams")
      .select("name, logo")
      .order("name")

    setTeams(data || [])

  }

  return (
    <div className="w-full overflow-x-hidden">

      {/* ================= HERO ================= */}

      <section className="relative h-screen w-full overflow-hidden">

        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/home-bg.mp4"
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