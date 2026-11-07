import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

// Trae todas las filas de una consulta (PostgREST corta en 1000 por pagina)
export async function fetchAll(build, size = 1000) {
  const out = []
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < size) break
  }
  return out
}

export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}
