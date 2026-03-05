import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"

export default function Teams() {

  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name")

    if (!error) setTeams(data || [])

    setLoading(false)
  }

  if (loading) return <div className="text-center mt-20">Loading teams...</div>

  const kanto = teams.filter(t => t.conference === "Kanto")
  const johto = teams.filter(t => t.conference === "Johto")

  return (
    <div
      className="min-h-screen -mt-24 pt-32 px-12 pb-16"
      style={{
        backgroundImage: "url('/hex-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >

      {/* TITLES */}

      <div className="grid grid-cols-2 mb-12 relative">

        <div className="text-center text-2xl font-semibold text-slate-800 tracking-wide">
          Kanto Conference
        </div>

        <div className="text-center text-2xl font-semibold text-slate-800 tracking-wide">
          Johto Conference
        </div>

        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-200"></div>

      </div>


      <div className="grid grid-cols-2 gap-12 relative">

        {/* DIVIDER */}

        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-200"></div>


        {/* KANTO */}

        <div className="grid grid-cols-3 gap-6 pr-8">

          {kanto.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              navigate={navigate}
            />
          ))}

        </div>


        {/* JOHTO */}

        <div className="grid grid-cols-3 gap-6 pl-8">

          {johto.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              navigate={navigate}
            />
          ))}

        </div>

      </div>

    </div>
  )
}


function TeamCard({ team, navigate }) {

  return (
    <div
      onClick={() => navigate(`/teams/${team.id}`)}
      className="
      w-52 h-44
      bg-white
      rounded-xl
      border border-slate-200
      flex flex-col
      items-center
      justify-between
      p-3
      cursor-pointer
      shadow-sm
      transition-all duration-300
      hover:shadow-lg hover:-translate-y-1
      group
      "
    >

      {/* LOGO */}

      <div className="flex items-center justify-center h-24">

  <img
    src={team.logo}
    alt={team.name}
    className="max-h-20 object-contain transition-transform duration-300 group-hover:scale-110"
  />

</div>


      {/* TEAM NAME */}

      <div className="text-center">

        <div className="font-medium text-slate-800 text-sm leading-tight">
          {team.name}
        </div>

      </div>


      {/* ROSTER */}

      <div className="flex flex-wrap justify-center gap-1 max-w-[170px]">

        {team.roster?.map((p, i) => (
          <img
            key={i}
            src={p.sprite}
            className="w-4 h-4 object-contain"
          />
        ))}

      </div>

    </div>
  )
}