import { Routes, Route, NavLink, useLocation } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import { useEffect, useState, useRef } from "react"
import { supabase } from "./lib/supabase"

import Home from "./pages/Home"
import Standings from "./pages/Standings"
import Matches from "./pages/Matches"
import Pokedex from "./pages/Pokedex"
import Teams from "./pages/Teams"
import TeamDetail from "./pages/TeamDetail"
import Draft from "./pages/Draft"
import Login from "./pages/Login"
import Playoffs from "./pages/Playoffs"
import Trades from "./pages/Trades"
import AdminReports from "./pages/AdminReports"

export default function App() {

  const { isAdmin, user, team, logout } = useAuth()
  const location = useLocation()

  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draftActive, setDraftActive] = useState(false)
  const [pendingTrades, setPendingTrades] = useState(false)

  const menuRef = useRef(null)

  const isHome = location.pathname === "/"

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {

  async function checkDraft() {

    const { data } = await supabase
      .from("draft_state")
      .select("is_active")
      .single()

    if (data?.is_active) {
      setDraftActive(true)
    } else {
      setDraftActive(false)
    }

  }

  checkDraft()

  /* ======================
     REALTIME DRAFT STATUS
  ====================== */

  const channel = supabase
    .channel("draft-status")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "draft_state"
      },
      (payload) => {

        const isActive = payload.new.is_active

        setDraftActive(isActive)

      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }

}, [])


  /* ======================
     CLOSE MENU ON OUTSIDE CLICK
  ====================== */

  useEffect(() => {

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }

  }, [])

  useEffect(() => {

  async function checkTrades() {

    if (!team) return

    const { data } = await supabase
      .from("transactions")
      .select("id")
      .eq("team_b", team.id)
      .eq("status", "pending_player")

    if (data && data.length > 0) {
      setPendingTrades(true)
    }

  }

  checkTrades()

}, [team])


  /* ======================
     NAV LINK STYLE
  ====================== */

  const navItem = ({ isActive }) => {

    const showIndicator = isActive && (!isHome || scrolled)

    return `
      relative pb-1 transition duration-300
      ${isActive ? "font-semibold" : "opacity-80 hover:opacity-100"}
      ${showIndicator
        ? "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:bg-red-500 after:content-[''] after:transition-all after:duration-300"
        : ""
      }
    `
  }

  return (
    <div className="min-h-screen text-slate-900">

      <nav
        className={`fixed top-0 w-full z-50 px-8 py-4 flex justify-between items-center transition-all duration-500
        ${
          isHome
            ? scrolled
              ? "bg-white shadow-md text-slate-900"
              : "bg-transparent text-white"
            : "bg-white shadow-md text-slate-900"
        }`}
      >

        {/* IZQUIERDA */}
<div className="flex items-center gap-3">

  <img
    src="/logo-ppv.png"
    className={`h-10 transition duration-500 ${
      isHome && !scrolled ? "invert-0" : "invert"
    }`}
  />

  <span
    className={`text-lg font-bold tracking-[0.2em] ${
      isHome && !scrolled ? "text-white" : "text-slate-900"
    }`}
  >
    GENESIS
  </span>

</div>

{/* DERECHA (HAMBURGUESA SOLO MOBILE) */}
<button
  onClick={() => setMenuOpen(!menuOpen)}
  className="md:hidden text-2xl"
>
  ☰
</button>

        <div className="hidden md:flex gap-6 items-center">

          <NavLink to="/" className={navItem}>
            Home
          </NavLink>

          <NavLink to="/standings" className={navItem}>
            Standings
          </NavLink>

          <NavLink to="/matches" className={navItem}>
            Matches
          </NavLink>

          <NavLink to="/playoffs" className={navItem}>
            Playoffs
          </NavLink>

          <NavLink to="/pokedex" className={navItem}>
            Pokedex
          </NavLink>

          <NavLink to="/teams" className={navItem}>
            Teams
          </NavLink>

          <NavLink to="/draft" className={navItem}>
  <div className="flex items-center gap-2">
    Draft
    {draftActive && (
      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
    )}
  </div>
</NavLink>

          {user && (
  <NavLink to="/trades" className={navItem}>
    <div className="flex items-center gap-2">
      Trades
      {pendingTrades && (
        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
      )}
    </div>
  </NavLink>
)}

          {isAdmin && (
            <NavLink to="/admin/reports" className={navItem}>
              Reports
            </NavLink>
          )}

          {!user && (
            <NavLink
              to="/login"
              className="font-semibold"
            >
              Login
            </NavLink>
          )}

          {user && (
            <div ref={menuRef} className="relative">

              {/* TEAM ICON */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center"
              >

                {team ? (
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-9 h-9 object-contain hover:scale-110 transition"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-300 animate-pulse"></div>
                )}

              </button>

              {/* DROPDOWN MENU */}
              {menuOpen && (
                <div className="absolute right-0 mt-3 w-40 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">

                  {team && (
                    <NavLink
                      to={`/teams/${team.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-black hover:bg-slate-100"
                    >
                      Ir a Equipo
                    </NavLink>
                  )}

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      logout()
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>

                </div>
              )}

            </div>
          )}

        </div>
      </nav>

      {menuOpen && (
  <div className="md:hidden fixed top-0 left-0 w-full h-full bg-black/60 z-40">

    <div className="bg-white w-64 h-full p-6 shadow-lg flex flex-col gap-4">

      <button
        onClick={() => setMenuOpen(false)}
        className="self-end text-xl"
      >
        ✕
      </button>

      <NavLink to="/" onClick={()=>setMenuOpen(false)}>Home</NavLink>
      <NavLink to="/standings" onClick={()=>setMenuOpen(false)}>Standings</NavLink>
      <NavLink to="/matches" onClick={()=>setMenuOpen(false)}>Matches</NavLink>
      <NavLink to="/playoffs" onClick={()=>setMenuOpen(false)}>Playoffs</NavLink>
      <NavLink to="/pokedex" onClick={()=>setMenuOpen(false)}>Pokedex</NavLink>
      <NavLink to="/teams" onClick={()=>setMenuOpen(false)}>Teams</NavLink>
      <NavLink to="/draft" onClick={()=>setMenuOpen(false)}>Draft</NavLink>

      {user && (
        <NavLink to="/trades" onClick={()=>setMenuOpen(false)}>
          Trades
        </NavLink>
      )}

      {isAdmin && (
        <NavLink to="/admin/reports" onClick={()=>setMenuOpen(false)}>
          Reports
        </NavLink>
      )}

      {!user && (
        <NavLink to="/login" onClick={()=>setMenuOpen(false)}>
          Login
        </NavLink>
      )}

      {user && (
        <button
          onClick={() => {
            setMenuOpen(false)
            logout()
          }}
          className="text-red-600 text-left"
        >
          Logout
        </button>
      )}

    </div>
  </div>
)}

      <main className={isHome ? "" : "pt-24"}>

        <Routes>

          <Route path="/" element={<Home />} />

          <Route path="/standings" element={<Standings />} />

          <Route path="/matches" element={<Matches />} />

          <Route
            path="/playoffs"
            element={
              <div className="-m-6">
                <Playoffs />
              </div>
            }
          />

          <Route path="/pokedex" element={<Pokedex />} />

          <Route path="/teams" element={<Teams />} />

          <Route path="/teams/:teamId" element={<TeamDetail />} />

          <Route path="/draft" element={<Draft />} />

          <Route path="/trades" element={<Trades />} />

          <Route path="/login" element={<Login />} />

          <Route path="/reset" element={<Login />} />

          <Route
            path="/admin/reports"
            element={isAdmin ? <AdminReports /> : <Login />}
          />

        </Routes>

      </main>

    </div>
  )
}