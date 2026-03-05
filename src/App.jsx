import { Routes, Route, NavLink, useLocation } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import { useEffect, useState } from "react"

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

  const { isAdmin, user, logout } = useAuth()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  const isHome = location.pathname === "/"

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

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

        <h1 className="text-xl font-bold">
          PPV Draft S4
        </h1>

        <div className="flex gap-6 items-center">

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
            Draft
          </NavLink>

          {user && (
  <NavLink to="/trades" className={navItem}>
    Trades
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
            <button
              onClick={logout}
              className="hover:opacity-70 transition"
            >
              Logout
            </button>
          )}

        </div>
      </nav>

      {/* HOME no necesita padding */}
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

          <Route
            path="/admin/reports"
            element={isAdmin ? <AdminReports /> : <Login />}
          />

        </Routes>

      </main>

    </div>
  )
}