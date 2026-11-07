# PPV Draft League · sitio S5

Sitio de la liga con el rediseño (Temporada 5) conectado a Supabase. Cada temporada vive en la misma base de datos y se puede ver por separado; la S4 queda como archivo.

## Correr en local

```bash
npm install
# .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (las mismas de Vercel)
npm run dev
```

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Markup del rediseño (todas las páginas). |
| `src/main.js` | Arranque: sesión, elige temporada (`?t=4` para ver la S4), carga datos, aplica colores. |
| `src/data.js` | Lee Supabase y arma los datos con la forma que usa el rediseño (`TEAMS`, `RAW_MATCHES`, `PROFILES`, `POOL`…). |
| `src/app.js` | Lógica y render del rediseño (lee `window.PPV`). |
| `src/actions.js` | Login, reportar series, fichajes, trades, sala del draft, página de temporadas, faints en riesgo. |
| `src/admin.js` | Panel de admin (`#admin`): temporadas, reglas, conferencias, equipos, pool, draft, calendario y aprobaciones. |
| `supabase/migrations` | Cambios a la base de datos, en orden. |

## Temporadas

- Solo una temporada está **activa** (`seasons.is_active`): es la que se ve en `/`. Las demás se ven con `/?t=N` o desde **Temporadas**.
- Reglas por temporada en `league_settings` (roster, presupuesto, puntos por victoria, FA, diferencia en trades, segundos por pick, regla de escape).
- Conferencias en `conferences` (nombre y color); participación de cada equipo en `season_teams`.
- Stats por Pokémon y por juego en `pokemon_stats` (se llenan al aprobar un reporte).

## Regla de escape

`league_settings.faint_limit`: al aprobar un reporte, si un Pokémon suma ese número de faints (todas las semanas) sale del roster, se registra en `pokemon_escapes` y en `transactions` (tipo `escape`), y queda libre en waivers. Opciones: reiniciar el contador al cambiar de equipo y contar o no los playoffs.

## Roles y permisos

Tabla `roles` (editable en Admin → Roles y usuarios). Roles base: Administrador (`all`), CM (panel, contenido, kit de redes) y Jugador (jugar con su equipo, pronosticos). Se pueden crear roles nuevos y elegir sus permisos: `admin.access`, `season.manage`, `pool.manage`, `draft.manage`, `results.approve`, `market.approve`, `roles.manage`, `content.manage`, `media.access`, `team.play`, `predictions.play`. Las politicas RLS y las funciones usan `has_perm()`.

## Repetidos y starters

- Reglas → "Permitir Pokemon repetidos". En Pool, cada Pokemon tiene `max_copies` y `copy_surcharge`: la copia N cuesta `puntos + sobrecosto × (N-1)`. Lo que paga cada equipo queda en `rosters.points_paid`.
- Reglas → "Starters por equipo": cada trainer marca sus starters en Mi equipo (hasta que empieza la fase regular); los starters no se escapan.

## Pronosticos, apodos y noticias

`predictions` (los de otros se ven al terminar la serie; tabla de aciertos con `prediction_table`), `pokemon_nicknames` y `posts` (con imagenes en el bucket `media`).

## Migraciones aplicadas

01 respaldo de la S4 en el esquema `backup_s4` · 02 esquema multi-temporada · 03 S4 pasada al nuevo esquema + S5 creada · 04 funciones por temporada, escape y admin · 04b Champions ID.
05 seguridad / RLS · 06 roles, pronosticos, apodos, repetidos, starters y noticias · 07 funciones con permisos y copias · 08 restriccion de draft para copias.
