import { useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"

export default function Login() {

  const navigate = useNavigate()

  const [isRegister, setIsRegister] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [loading, setLoading] = useState(false)

  /* =============================
     PASSWORD MATCH CHECK
  ============================= */

  const passwordsMatch =
    password && confirmPassword && password === confirmPassword

  const passwordsDontMatch =
    confirmPassword && password !== confirmPassword


  /* =============================
     LOGIN
  ============================= */

  async function handleLogin(e) {

    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    navigate("/")
    setLoading(false)

  }


  /* =============================
     REGISTER
  ============================= */

  async function handleRegister(e) {

    e.preventDefault()

    if (password !== confirmPassword) {
      alert("Passwords do not match")
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://ppvdraftleague.com"
      }
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    alert("✔ Account created. Check your email to verify.")

    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setIsRegister(false)

    setLoading(false)

  }


  return (
    <div className="flex justify-center mt-20">

      <form
        onSubmit={isRegister ? handleRegister : handleLogin}
        className="bg-white p-8 rounded-2xl shadow-xl w-96"
      >

        <h2 className="text-2xl font-bold mb-6 text-center">
          {isRegister ? "Create Account" : "Login"}
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="border p-3 w-full mb-4 rounded"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="border p-3 w-full mb-4 rounded"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {isRegister && (
          <div className="relative mb-6">

            <input
              type="password"
              placeholder="Confirm Password"
              className="border p-3 w-full rounded pr-10"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />

            {passwordsMatch && (
              <span className="absolute right-3 top-3 text-green-500 font-bold">
                ✓
              </span>
            )}

            {passwordsDontMatch && (
              <span className="absolute right-3 top-3 text-red-500 font-bold">
                ✕
              </span>
            )}

          </div>
        )}

        <button
          type="submit"
          disabled={loading || (isRegister && !passwordsMatch)}
          className="bg-blue-600 text-white w-full py-3 rounded-lg disabled:opacity-50"
        >
          {loading
            ? "Loading..."
            : isRegister
            ? "Create Account"
            : "Login"}
        </button>

        <div className="text-center mt-4 text-sm">

          {isRegister ? (
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className="text-blue-600 hover:underline"
            >
              Already have an account? Login
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className="text-blue-600 hover:underline"
            >
              Create account
            </button>
          )}

        </div>

      </form>

    </div>
  )
}