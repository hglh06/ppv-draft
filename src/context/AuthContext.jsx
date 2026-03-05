import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

const AuthContext = createContext()

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function getSession() {

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }

      setLoading(false)
    }

    getSession()

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setTeam(null)
      }
    })

  }, [])

  async function loadProfile(userId) {

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    setProfile(profileData)

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("user_id", userId)
      .single()

    setTeam(teamData)
  }

  function logout() {
    supabase.auth.signOut()
  }

  const value = {
    user,
    profile,
    team,
    isAdmin: profile?.role === "admin",
    logout
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}