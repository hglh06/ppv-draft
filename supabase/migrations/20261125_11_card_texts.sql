-- Textos de las tarjetas con acentos (ya aplicado en produccion con execute_sql).
update public.card_defs d set name = v.name, effect = v.effect, rule = v.rule from (values
('vistazo','Vistazo','Tu rival te enseña 2 de los 6 Pokémon que va a llevar.','24 h antes de la serie, por mensaje a ti y al admin.'),
('hoja-abierta','Hoja abierta','Tu rival te dice qué objeto lleva en 2 de sus Pokémon.','Tú eliges los 2 Pokémon de los 6 que llevará.'),
('set-descubierto','Set al descubierto','Ves el set completo de 1 Pokémon que tu rival va a llevar.','Objeto, habilidad y movimientos.'),
('spread-revelado','Spread revelado','Tu rival te muestra naturaleza y EVs de 2 Pokémon que va a llevar.','Tú eliges los 2 Pokémon de los 6 que llevará.'),
('veto','Veto','Prohíbes 1 Pokémon del roster de tu rival.','Solo en un game que eliges antes de jugarlo. No puede ser el más caro de su roster.'),
('objeto-vetado','Objeto vetado','Tu rival no puede usar 1 objeto que tú eliges.','Solo en un game que eliges antes de jugarlo.'),
('movimiento-vetado','Movimiento vetado','Prohíbes 1 movimiento a un Pokémon específico de tu rival.','Solo en un game que eliges antes de jugarlo.'),
('ajuste-objeto','Ajuste de objeto','Entre games cambias el objeto de 1 de tus Pokémon.','Avisas a tu rival antes del siguiente game.'),
('cambio-caliente','Cambio en caliente','Cambias 1 de tus 6 por otro Pokémon de tu roster.','Solo después de perder un game de la serie.'),
('ajuste-movimiento','Ajuste de movimiento','Entre games cambias 1 movimiento de 1 de tus Pokémon.','Avisas a tu rival antes del siguiente game.'),
('fichaje-tardio','Fichaje fuera de tiempo','Haces un movimiento de agente libre fuera de tiempo.','Hasta 1 día después del cierre de la semana.'),
('primero-fila','Primero en la fila','Tienes la prioridad #1 en waivers.','Solo esa semana; después vuelves a tu lugar.'),
('rebaja','Rebaja','Tu siguiente agente libre cuesta 1 punto menos.','Se aplica al aprobar el movimiento.'),
('prestamo','Préstamo','Usas cualquier agente libre sin pagarlo.','Solo esa semana; después vuelve al pool.'),
('pronostico-doble','Pronóstico doble','Tus aciertos en los pronósticos valen doble.','Solo los de esa jornada. Se aplica solo.'),
('bono-remontada','Bono de remontada','Si ganas tu serie, sumas +1 de diferencial.','Se aplica solo en la tabla.'),
('seguro','Seguro','Si pierdes 0-2, en la tabla cuenta como 1-2.','Se aplica solo en la tabla.'),
('antimagia','Antimagia','Anula la tarjeta de tu rival.','Solo esa semana.'),
('espejo','Espejo','Copias el efecto de la tarjeta de tu rival.','Si tu rival no tiene tarjeta, no pasa nada.'),
('mulligan','Mulligan','Descartas tus 3 opciones y te salen 3 nuevas.','Se usa al momento de elegir; no da efecto en la serie.')
) v(id, name, effect, rule) where d.id = v.id;
