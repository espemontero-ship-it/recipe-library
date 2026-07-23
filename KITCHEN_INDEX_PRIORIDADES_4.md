Kitchen Index — Prioridades y registro de decisiones

Última actualización: 23 julio 2026

Este documento complementa a KITCHEN_INDEX_HANDOFF.md. Mientras aquel describe el estado y las reglas del proyecto, este registra qué se decidió después de la auditoría real del código y en qué orden se va a ejecutar. Pégalo al inicio de cualquier sesión nueva (aquí o en Claude Code) junto con el handoff original para no perder contexto.

Reglas para decidir cosas estéticas (añadidas 24 julio 2026, tras errores repetidos de asumir preferencias)
No se aprueba NADA estético sin una maqueta.
No se asume NADA sin preguntar específicamente.
Se hacen preguntas para todo.
Las maquetas SIEMPRE se enseñan como página completa, nunca como fragmento aislado — Esperanza solo puede juzgar un cambio en el contexto real de toda la página.
No mostramos imágenes no completas.
No se pide evaluar decisiones estéticas sin mostrar imágenes.
No hacemos propuestas de UX sin hacer análisis de UX.
Antes de introducir cambios estéticos, revisar la guía de diseño memorizada (este documento) y asegurarse de que sea acorde con lo ya acordado.
A partir de ahora, cada vez que una maqueta se valide, su código HTML/CSS exacto se añade tal cual al documento (Anexo de maquetas exactas) — no una descripción en prosa de cómo quedó, el código real usado para generarla. La prosa puede resumir o interpretar sin querer; el código no.
Cero desviaciones de lo acordado en este documento. Si algo impide implementar exactamente lo escrito (un componente compartido, una regla heredada, cualquier motivo técnico), Claude Code debe PARAR y preguntar antes de tocar nada — nunca implementar una versión distinta y avisar después. "Implementado" significa que coincide exactamente con el documento, punto por punto, sin excepciones silenciosas.
Regla general para todo lo que sigue

Cualquier rediseño visual (tipografía, ficha de receta, filtros de Browse, Home) debe:

Mantener exactamente los mismos flujos de trabajo actuales (login, Planning, Shopping, edición).
Mostrar toda la misma información que se muestra hoy — no ocultar ni eliminar campos, secciones o acciones por no aparecer en una maqueta.
Enseñarse primero como maqueta y esperar aprobación explícita antes de tocar código.
Estado de la auditoría

Auditoría de código completada (vía Claude Code, sobre HEAD real cc1e884b3cec8f7e239c7b3bbd83464dab9408c2, idéntico a origin/main) para: Home, Browse, Ficha de receta, Planning, Shopping, Autenticación, Supabase/permisos.

Pendiente sin resolver: confirmar si Vercel despliega exactamente ese commit (no verificado por falta de acceso a Vercel CLI).

Orden de prioridad acordado
1. ✅ Seguridad — RLS de recipes_clean_v14_final (RESUELTO — verificado 23/24 julio 2026)

Confirmado directamente en el dashboard de Supabase: RLS activado, SELECT abierto a anon+authenticated (correcto, es una biblioteca pública de lectura), e INSERT/UPDATE/DELETE todos con condición is_recipe_admin() tanto en using como en with check. Nadie puede escribir sin ser admin. Sin acción pendiente aquí.

1b. ✅ Subida de imágenes — RLS de Storage (RESUELTO — verificado 24 julio 2026)

Confirmado en el dashboard de Supabase (Storage → Policies, bucket recipe-images): la policy de INSERT comprueba bucket_id = 'recipe-images' AND is_recipe_admin(). Correctamente protegido, contrario a lo que sugería el CHANGELOG desactualizado. Sin acción pendiente.

1c. Registro público — activo (decisión tomada, no un fallo)

Confirmado en Supabase Authentication: el alta de nuevos usuarios está activada. Esperanza decide mantenerlo abierto a propósito, pensando en que en el futuro otra persona pueda usar la app. No es un riesgo de escritura (protegido por is_recipe_admin()), pero hace que el punto 2 (rol no-admin) deje de ser hipotético: alguien podría registrarse hoy mismo y encontrarse con un login que expulsa a cualquiera que no sea admin.

Estado: decisión tomada — registro abierto. Aumenta la urgencia del punto 2.

2. ✅ Rol "usuario autenticado no-admin" (IMPLEMENTADO — 24 julio 2026, pendiente de commit/push por Esperanza)

Modelo de 3 niveles acordado con Esperanza:

Visitante (sin login): Home, Browse, ficha de receta completa (pública). Solo puede ver favorito/hecha/valoración (dato compartido, no personal). No ve "Plan recipes" en Browse ni "Add to this week" en la ficha.
Usuario registrado (no-admin): todo lo del visitante + su propio Planning y Shopping personales, y ya puede usar "Plan recipes"/"Add to this week". Favorito/hecha/valoración siguen siendo el dato compartido que gestiona la admin — se descartó hacerlos personales por usuario.
Admin (Esperanza): todo lo anterior + crear/editar/borrar recetas + gestiona el favorito/hecha/valoración compartido.

Implementado por Claude Code, verificado con build limpio y pruebas manuales de los 3 roles (visitante, no-admin, admin): components/AuthGate.tsx (nuevo), app/login/page.tsx (quita "Access denied", redirect por user), app/planning/page.tsx y app/shopping/page.tsx (envueltos en AuthGate), components/AppHeader.tsx (muestra "Sign out" para cualquier user), components/RecipeQuickActions.tsx (separa el gate de "this week" del de favorito/hecho/valoración), app/recipes/[id]/page.tsx y app/browse/page.tsx (ocultan sus botones de planificación para visitantes sin sesión).

Además se detectó y corrigió sobre la marcha: no existía pantalla de registro (sign up), solo sign-in — se añadió app/signup/page.tsx siguiendo el patrón visual de /login//forgot-password, con signUpWithPassword en lib/auth.tsx, reaccionando en tiempo real a si Supabase exige confirmación por email o no.

Estado: implementado y probado; pendiente de que Esperanza haga commit/push.

6b. ✅ Mensaje de onboarding para visitantes (COMPLETADO — 24 julio 2026, pendiente de commit/push)

Banner "Plan your week" / "Sign up to save your own weekly plan and shopping list." / botón "Sign up" → /signup, visible solo para visitantes sin sesión, en PersonalRecipeSections.tsx reutilizando la clase .browse-band existente. Probado y aprobado visualmente.

3. ✅ Naming: "Recipe Library" → "Kitchen Index" (COMPLETADO — 24 julio 2026, pendiente de commit/push)

Corregido en 8 archivos (metadata/title, logo del header, textos de login/forgot-password/reset-password/signup, editor de macros, package.json). Se decidió deliberadamente NO tocar README/CHANGELOG/comentarios de migraciones SQL, por ser historial/documentación, no interfaz en ejecución.

4. ✅ Home: "Recently Added" + "Your week" (COMPLETADO — 24 julio 2026, pendiente de commit/push)

Se sustituyeron "This Weekend" y "Favorites" por: "Recently Added" (público, 4 recetas más recientes por fecha de creación) y "Your week" (solo usuarios logueados, su propia semana de Planning, con estado vacío y enlace a /planning si no tienen nada planificado). Implementado en components/PersonalRecipeSections.tsx.

5. ✅ Botón "Share" sin función (COMPLETADO — 24 julio 2026, pendiente de commit/push)

Eliminado por completo de app/recipes/[id]/page.tsx, junto con el import no usado de Share2.

6. ✅ Guard de acceso en Planning y Shopping (COMPLETADO — implementado junto al punto 2)

AuthGate ahora protege ambas rutas con un mensaje de "Sign in to use Planning and Shopping" en vez de un error genérico.

Estado: resuelto, ver punto 2.

7. ✅ Limpieza de repo y código muerto (COMPLETADO — 24 julio 2026, pendiente de commit/push por Esperanza)

Borrado por Claude Code, verificado con npm run build exitoso (14 rutas generadas, ninguna perdida, /api/source-image desaparece limpiamente). Se borraron: código muerto (recipeRepair.ts, recipeAudit.ts, browserRecipeStorage.ts, source-image/route.ts, scripts/next.config.mjs, HomePageContent.tsx), la función no-op mergePersonalState() y sus 4 usos, y todos los backups/zips/snapshots antiguos (app.zip, .recipe-library-backups/, carpetas kitchen-index-v0.18.x-* y recipe-library-v0.x-*, READMEs/QA sueltos). Nota: parte de lo borrado estaba trackeado en git — queda como "deleted" pendiente de commit, no reduce el tamaño del repo remoto (para eso haría falta reescribir historia, descartado). Sin commit ni push hechos todavía, a la espera de que Esperanza revise el diff.

8. Mejorar la edición de información de la ficha

Auditoría de usabilidad completada por Claude Code (24 julio 2026), sobre RecipeEditor.tsx, IngredientEditor.tsx, app/recipes/[id]/edit, app/paste, lib/recipePasteParser.ts. El formulario de alta y edición es literalmente el mismo componente (<RecipeEditor mode="review"|"edit">), así que todo lo siguiente aplica a ambos flujos.

🔴 Crítico:

Botón "Check source" roto en 2 sitios (RecipeEditor.tsx:103, app/paste/page.tsx:186) — llama a /api/source-metadata, ruta inexistente. En el editor falla con un mensaje engañoso ("no se pudo inspeccionar"); en /paste falla en silencio total.
Sin protección de pérdida de trabajo — cero beforeunload, cero aviso al navegar fuera. Un clic accidental en "Back" borra un formulario largo entero.
Validación de guardado reducida a un único campo (el título) — se puede guardar sin ingredientes, sin pasos, sin nada más.
Botones "Duplicar" y "Eliminar" ingrediente casi idénticos visualmente (IngredientEditor.tsx:266-312), mismo estilo, solo distinguidos por icono — riesgo de clic destructivo accidental.

🟠 Medio: 4. Formulario único larguísimo sin pasos ni indicador de progreso — el bloque "Information" ya tiene ~20 campos por sí solo. → Esperanza quiere maqueta antes de implementar (dividir en pasos/wizard). 5. Campos numéricos (Servings, Prep minutes...) vacían el valor en silencio si se escribe algo no numérico, sin avisar. 6. Sin confirmación visible de guardado ("Guardado ✓") — solo se nota porque cambias de pantalla; invita a doble clic en conexiones lentas.

🟡 Menor: 8. Campos de nutrición automática (calories, protein...) vestigiales en el parser, nunca usados — ruido de código, sin efecto para el usuario. 9. Clasificación (Main ingredients, Dish, Cuisine...) por texto libre separado por comas, sin autocompletar ni avisar de valores ya existentes — conecta directo con los 14 valores de ingrediente que aparecen en 1 sola receta que ya vimos en los datos reales (probablemente errores tipográficos sin nada que los prevenga). 10. "Check source" (si se arregla) solo rellena campos vacíos, nunca sobrescribe uno ya existente — diseño defendible pero no obvio para quien lo usa.

Buena noticia: el parser de pegado sí estructura bien los ingredientes (cantidad/unidad/nombre separados, con contador "X parsed · Y need review") — no es solo texto plano a reformatear a mano.

Decisión: arreglar todo, sin priorizar orden. Los puntos 1,2,3,5,6,7,8,10 son arreglos funcionales (sin necesidad de maqueta). El punto 4 (dividir el formulario en pasos) es un cambio de diseño real — pendiente de maqueta antes de implementar.

Maqueta del punto 4 — validada (24 julio 2026), tras varias iteraciones:

❌ Descartado: dividir en pasos/pestañas (Esperanza no quiere nada oculto tras pasos).
❌ Descartado: colapsar campos "confirmados" como solo lectura (si el parser no es fiable marcando qué está bien, ocultar genera falsa confianza — conecta con la necesidad de mejorar el parser, punto 9).
✅ Todos los campos visibles y editables siempre, en formato de lista/tabla compacta (sin aire decorativo, es una pantalla funcional no editorial), agrupados por bloque con una cabecera de fondo gris claro (no líneas decorativas).
✅ El texto original pegado se muestra en una franja sticky (fija) en la parte superior, tanto en escritorio como en móvil — nunca al lado en columna (eso desperdiciaba ancho y cortaba campos de texto largo). Aprovechar todo el ancho para el formulario permite más columnas por fila sin cortar texto.
✅ Campos numéricos cortos (servings, tiempos, macros) en grid de varias columnas; campos de texto largo (tags de clasificación, autor, notas, URL) a ancho completo o con proporción generosa (ej. Name del ingrediente a 2fr/3fr vs Note a 1fr) para que nunca se corten.
✅ Ingrediente: Qty/Unit/Name/Note como columnas separadas (no fusionadas), con "Details" (checkboxes Optional/Garnish/Accompaniment) accesible sin ocupar espacio permanente.
✅ Método: cada paso con su propio título + instrucciones (no un textarea único fusionando todos los pasos).
✅ Vista previa real de imagen (miniatura + nombre de archivo + Replace/Remove) tras subir foto, no solo un enlace de texto.
✅ Móvil: una sola columna, numéricos en filas de 3 en vez de 6-8, botón "Save recipe" fijo abajo.

Nota de robustez: la franja sticky del texto original usa altura máxima + scroll interno propio, así que por diseño soporta cualquier longitud (un caption corto o una receta de blog larga con muchos hashtags) sin desbordarse ni romper el layout — no requiere validación adicional, queda resuelto por construcción.

Estado: CERRADO. Maqueta y arreglos funcionales (1,2,3,5,6,7,8,10) listos para enviar a Claude Code para implementación.

9. Mejorar el parser de recetas

La segunda auditoría confirma que recipeModel.ts, ingredientParser.ts y recipePasteParser.ts están bien tipados y sin código chapucero — así que esto no es "arreglar algo roto", sino una mejora de producto (¿qué falla al importar/pegar una receta hoy? ¿qué formatos fallan?). A concretar contigo.

Estado: pendiente de especificar.

10. Rediseño visual de toda la web

Incluye: tipografía, ficha de receta (reducir scroll, ya identificada como tarea pendiente en el handoff original), filtros de Browse (sistema actual con 8 filtros independientes, considerado a rediseñar aunque estaba "cerrado" previamente), preferencia confirmada por modo lista sobre grid en Browse.

Condición innegociable: mismos flujos, misma información, maqueta antes de código.

Resolución de preguntas bloqueantes (24 julio 2026) — leer antes de implementar nada

Estas son decisiones explícitas de Esperanza que resuelven ambigüedades reales detectadas por Claude Code. Tienen prioridad sobre cualquier otra lectura del documento:

Alcance del nuevo sistema de color/botones/esquinas: se aplica GLOBALMENTE a toda la web (no solo a Home/Browse/ficha/editor). Planning, Shopping, Login, Signup y Maintenance heredan el nuevo aspecto como efecto colateral — no crear variables/clases paralelas para aislarlos.
Botón "Filters" de Home: enlaza simplemente a /browse (sin parámetro ?filters=1), ya que la barra lateral de filtros siempre está visible en Browse, no hay panel que abrir.
Fuente de títulos de página (ej. "Browse recipes", "Edit recipe" — no confundir con "Recently added", que va en DM Sans): Noto Serif, confirmado.
Ficha de receta en móvil: se deja con el layout apilado que existe hoy (placeholder), no se diseña ahora — tarea aparte.
Botón "Check source": se elimina por completo (no se construye el endpoint que nunca existió).
Autocompletado del buscador: se implementa con criterio propio de Claude Code y se muestra para aprobación después — no bloquea el resto de la implementación.
"Ingredients" en la barra lateral de filtros de Browse: sí lleva su propio grupo de chips, pero solo con los valores más numerosos (no los 158 totales), con "+N" para el resto.
10a. ✅ Dirección visual para Home — APROBADA (24 julio 2026)

Tras muchas rondas de prueba y error (incluyendo errores míos de asumir preferencias sin preguntar, ya corregidos en las "Reglas para decidir cosas estéticas" de este documento), Esperanza aprobó una dirección clara: estética fiel al sitio real de NYT Cooking (consultado con búsqueda de imágenes para no inventar de memoria). Concretamente:

Fondo blanco/crudo, texto en negro, un único acento en rojo apagado (tipo 
#a3272c) usado con moderación (etiquetas en mayúsculas, enlaces "See all", botón de "Sign up").
Regla de sistema para botones: un único botón "principal" por pantalla lleva relleno sólido en rojo (la acción más importante de esa pantalla, ej. "Sign up" en Home, "Add to this week" en la ficha). Todo lo demás (Edit recipe, Filters, navegación, acciones secundarias) va en texto plano o subrayado, sin relleno — nunca bloques sólidos negros ni múltiples botones rellenos en la misma pantalla.
El hero ("What will you cook next?") se mantiene exactamente como está hoy — Libre Caslon Display, sin cambios.
Títulos de sección ("Recently added", "Browse the library") en una serif distinta al hero (ej. Noto Serif u otra serif editorial), en negro.
Nav con línea inferior roja bajo el enlace activo.
Botones y bordes de esquina recta (sin border-radius), estética editorial/prensa.
Sistema de iconos aprobado (no inventar otros)

Solo estos 4 iconos están aprobados y deben reutilizarse en cualquier pantalla que los necesite — nunca inventar iconos nuevos para categorías o conceptos sin aprobación explícita:

Corazón (heart) — favorito.
Check en círculo (check-circle) — marcada como hecha.
Calendario+ (calendar-plus) — añadir/quitar de esta semana (Planning).
Estrella (star) — valoración.

Mismo tamaño (~13-16px según contexto), mismo grosor de trazo en los 4, color gris cuando inactivo y rojo (el acento único) cuando activo. Si una pantalla necesita representar un concepto sin icono aprobado (ej. Method, Type, Cuisine, Ingredients en los filtros de Browse), se usa solo texto — no se inventa un icono nuevo sin preguntar primero.

Bandas de "Plan your week" y "Find your way in" pasan de bloque de color sólido a bandas delimitadas por líneas finas negras arriba/abajo, sin relleno de color — mucho más "aire" y look de prensa.
Botón "Filters" junto al buscador de Home → lleva a /browse?filters=1 (ya decidido).
"Find your way in" con conteos reales dinámicos: recipe.source.author (o el campo equivalente en el modelo) para la segunda columna, en vez de recipe.source.publication — decisión revisada, se prefiere buscar por autor. recipe.classification.ingredientsIndex para "Main ingredient" se mantiene.

Pendiente: aplicar esta misma dirección visual a Planning y Shopping — todavía sin empezar.

Estado: maqueta de Home aprobada; pendiente de que Claude Code la implemente en local para verificar con fuentes/datos reales antes de comitear, y de extenderla al resto de pantallas.

10b. Decisiones sobre el panel de filtros de Browse (24 julio 2026)
"Cooked" y "Made before" se fusionan en un único filtro — Esperanza confirma que son conceptualmente lo mismo.
El buscador necesita sugerencias/autocompletado mientras se escribe — hoy es un campo de texto plano sin sugerencias, se considera poco cómodo.
Gestión de categorías de filtro: Esperanza quiere poder añadir o quitar categorías ENTERAS de filtro (no solo editar los valores dentro de una categoría) — esto implica una interfaz de administración nueva para el sistema de filtros, no solo un rediseño visual.
Reducción de categorías — DECIDIDO (24 julio 2026), con datos reales de Supabase (547 recetas):
Ingredients (93% cobertura, 158 valores) y Method (82% cobertura, 18 valores) se mantienen tal cual — los más útiles con diferencia.
Dish (solo 12% cobertura) se elimina.
Format + Meal se fusionan en una única categoría: se queda con los valores actuales de Format (salad, bake, pasta, bowl, sauce, soup, skewers, sandwich, wrap) y se añaden los valores de Meal distintos de "main" (dessert, breakfast, snack, side) — "main" desaparece como valor porque es el 84% de las recetas con Meal y no discrimina nada como filtro.
Cuisine (solo 14% cobertura: mexican, korean, greek, mediterranean, thai...) se mantiene como categoría, pero necesita poblarse en más recetas — ver punto 14 del backlog.

Estado: ✅ CERRADO — implementable directamente (decisión de datos, no bloqueada por estética; la reducción de categorías ya se refleja en la maqueta aprobada de 10c). Autocompletado del buscador: implementar con criterio propio y mostrar para aprobación (no bloqueante). Gestión de categorías enteras (añadir/quitar): pendiente, requiere interfaz de administración nueva, no es parte de esta tanda.

10c. ✅ Rediseño de Browse — APROBADO (24 julio 2026)
Estética NYT Cooking (la misma de Home) extendida a Browse.
Modo lista y modo grid como vistas (ambas se mantienen, es preferencia del usuario) — el contenido VIGENTE de la tarjeta no cambia (imagen, título, preview de ingredientes, favorito/hecho/valoración/añadir semana), solo cambia la disposición visual de los iconos de acción (ver más abajo).
Patrón de filtrado rediseñado por completo: se descarta el panel desplegable con selects anidados (probado y rechazado por "cero intuitivo, hay que desplegarlo todo"). Se sustituye por una barra lateral fija vertical (nunca horizontal arriba — empuja el contenido y no queda visible al hacer scroll), con chips seleccionables (no checkboxes) agrupados por categoría: Personal, Rating, Method, Type (Format+Meal fusionados), Cuisine, Ingredients (solo los más numerosos + "+N"). Conteo real de recetas junto a cada valor. Los iconos de Personal (favorito/calendario) y Rating (estrella) reutilizan el sistema de iconos aprobado (ver sección de identidad visual); Method/Type/Cuisine/Ingredients van solo con texto, sin icono inventado.
Buscador con sugerencias en vivo (ya decidido en 10b).
Tratamiento de iconos de la tarjeta — APROBADO: los iconos de acción (favorito, hecho, añadir a esta semana) y la valoración se superponen sobre la imagen de la receta, dentro de una franja de degradado (negro semitransparente arriba → transparente abajo, pegada al borde inferior de la imagen, ancho completo — NO un badge/píldora flotante). Valoración a la izquierda de la franja (icono estrella + número, o "No rating"), iconos de acción a la derecha, mismo tamaño (~15-16px) y mismo grosor de trazo para los 4. Un único color de acento (rojo, el mismo del resto de la web) para el estado "activo"; blanco/gris para inactivo. Se descartaron: iconos con texto y separadores "|" (inconsistente), badge circular flotante solo para favorito (inconsistente con el resto), y un tercer color dorado para la estrella (rompía la regla de un único acento).

Estado: maqueta aprobada; pendiente de que Claude Code la implemente en local con fotos reales para validación final.

Pendiente de revisar contra la nueva regla de botones: el botón "Search" de Browse se mostró sólido/negro en maquetas anteriores — corregido: "Search" es el botón principal de Browse (relleno rojo), ya que buscar/encontrar es la acción más importante de esta pantalla, no un registro. El resto (Filters ya no existe como botón separado — ahora es la barra lateral siempre visible, iconos de tarjeta) va sin relleno.

10d. Rediseño de la ficha de receta — en curso

Objetivo original (ya en el handoff): reducir el scroll excesivo, aumentar jerarquía, sin perder contenido ni acciones.

Decisiones tomadas hasta ahora:

Layout de ingredientes fijos (sticky) + método con scroll independiente, en vez de todo apilado verticalmente — resuelve el problema de scroll sin comprimir el contenido.
Se descarta la numeración "01 Ingredients" / "02 Method" (tenía sentido en vertical, no en columnas paralelas).
Todas las acciones consolidadas en una sola franja bajo el título (favorito, hecho, valoración, macros, añadir a esta semana, editar) — antes estaban repartidas entre la barra superior y el bloque de contenido, lo cual se sentía desconectado.
Esa franja usa líneas horizontales (arriba/abajo), no una caja con borde completo — consistente con el resto de la página.
Valoración en rojo (el acento único), no dorado — mismo error que se corrigió en Browse, se coló de nuevo y se corrigió aquí también.
"Add to this week" es el botón principal de la pantalla (relleno sólido rojo de verdad, no solo texto en rojo); "Edit recipe" y el resto van en texto/subrayado.

Estado: maqueta validada por Esperanza; pendiente de implementación en local (Claude Code) y de diseñar el comportamiento en móvil (aún sin definir cómo se apilan las dos columnas en pantalla estrecha).

12. Cálculo automático de macros a partir de ingredientes (REVIERTE una decisión anterior — APLAZADO, ver punto 9)

El documento de traspaso original (sección 2, VIGENTE) establecía que la nutrición es 100% manual por ración y que el parser automático de nutrición se había eliminado por completo. Esperanza planteó revertir esa decisión, pero tras valorar el esfuerzo real (base de datos nutricional, matching de texto libre a ingredientes, conversión de unidades, ingredientes ambiguos, qué hacer con las ~544 recetas ya existentes) y su mala experiencia previa intentando esto con ChatGPT, se decide aplazar la decisión hasta el punto 9 (mejorar el parser de recetas): primero se resuelve que el parser extraiga bien cantidad+unidad+ingrediente al pegar una receta (sin macros), y desde ahí se evalúa si merece la pena dar el paso siguiente de calcular macros automáticamente.

Estado: aplazado, se retoma junto con el punto 9.

Bugs encontrados y corregidos durante la implementación
Bug: "Could not load recipes. Auth session missing!" en Browse (CORREGIDO — 24 julio 2026, pendiente de commit/push)

Detectado en producción tras implementar el punto 2: visitantes sin sesión no podían ver ninguna receta en /browse. Causa raíz: un useEffect preexistente (desde antes de esta sesión, commit e788a2a) llamaba a getPlanning() sin condicionar a user, que fallaba con "Auth session missing!" para visitantes anónimos, y ese error se guardaba en el mismo estado error que decide si se muestra el grid de recetas — bloqueando Browse entero aunque las recetas sí se habían cargado bien. Nadie lo había notado porque quien probaba Browse siempre estaba logueado como admin.

Corregido: (1) getPlanning() ya no se llama si !user; (2) se separó recipesError de planningError para que un fallo de Planning nunca vuelva a bloquear el grid de recetas; (3) mismo arreglo de eficiencia aplicado en app/recipes/[id]/page.tsx (no se llama a getPlanning() sin sesión, aunque ahí no había bug visible, solo una llamada de red innecesaria).

13. Hallazgo menor: saveError no visible para usuarios no-admin logueados

En app/recipes/[id]/page.tsx, si toggleThisWeek() falla para un usuario no-admin logueado (p. ej. al usar el botón "Add to this week" que ahora sí pueden ver), el error se guarda en saveError, pero ese estado solo se renderiza dentro de la rama isAdmin del panel personal — así que un no-admin nunca vería el mensaje si algo falla. No es el bug que se estaba cazando, es del mismo vecindario (estados de error mal repartidos entre roles).

Estado: no corregido, aparcado para revisar con calma en otra tarea (no se tocó para no mezclar con el fix del bug de Browse).

14. Poblar el campo Cuisine en las recetas existentes

Solo el 14% de las 547 recetas (77) tienen Cuisine asignado (mexican, korean, greek, mediterranean, thai, italian, turkish, cajun, moroccan, japanese). Se mantiene como categoría de filtro (ver punto 10b), pero necesita poblarse en el resto de recetas para ser realmente útil.

Estado: en backlog, sin definir aún cómo se poblaría (¿manual receta a receta, inferencia automática a partir de ingredientes/título, revisión asistida por IA?).

Secuencia de ejecución acordada (visión de Product Manager)

No se ejecuta la lista de arriba a abajo por número — se agrupa por impacto/esfuerzo:

Sprint "Fundaciones" (barato, reduce riesgo): RLS recetas (1) + RLS storage (1b) + limpieza de repo (7) + naming Recipe Library→Kitchen Index (3).
Sprint "Decisiones de producto" (poco código, mucha decisión): rol usuario no-admin (2) → guard Planning/Shopping (6) → Recently Added (4) → botón Share (5).
Sprint "Flujo diario": edición de ficha (8) + parser de recetas (9) — pendiente de que Esperanza concrete qué falla exactamente en cada uno antes de estimar esfuerzo.
Sprint "Rediseño": rediseño visual completo (10), el último, sobre una base ya limpia y sin dudas de contenido/seguridad.
11. Pantallas descubiertas sin auditar (detectadas en la lista de rutas del build)

/collections, /parser-lab, /paste, /week no aparecían en el documento de traspaso original. A determinar si son herramientas internas, restos de pruebas, o pantallas activas que hay que auditar igual que las demás.

Estado: pendiente de que Esperanza aclare qué son antes de decidir si se auditan o se limpian.

Decisiones ya tomadas (no discutir de nuevo salvo que cambie de opinión)
Registro público ("Allow new users to sign up") se mantiene activado a propósito: Esperanza planea compartir Kitchen Index con más gente más adelante. Por eso el punto 2 (login para no-admins) pasa a ser prioritario de verdad.
El flujo de compra es: receta → "Add to this week" (Planning) → gestión en Shopping. No habrá botón de "añadir a Shopping" directo desde la ficha.
Los filtros de Browse ya no se consideran "cerrados" pese a estar así en el handoff original — se rediseñarán.
Preferencia por modo lista sobre grid en Browse.
La tarjeta de receta en modo lista (imagen, título, preview de ingredientes, favorito, hecha, valoración, añadir/quitar semana) es innegociable y no se toca en ningún rediseño.
Anexo: maquetas exactas validadas (código fuente de referencia)

Esto es el HTML/CSS literal de las maquetas que Esperanza aprobó. No es para copiar y pegar tal cual en componentes React — es la referencia visual exacta (estructura, tamaños, colores, tipografías) contra la que debe compararse la implementación real. Ante cualquier duda de "¿cómo se veía exactamente?", esto es la fuente de verdad, no la prosa de las secciones anteriores.

Anexo A — Home (referencia de 10a)
html
<link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',sans-serif;background:#ffffff;border:0.5px solid var(--border);border-radius:4px;overflow:hidden">

  <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 26px;border-bottom:1px solid #1a1a1a">
    <span style="font-family:'Libre Caslon Display',serif;font-size:19px;color:#1a1a1a">Kitchen Index</span>
    <div style="display:flex;gap:22px;font-size:12px;letter-spacing:0.04em;color:#333;text-transform:uppercase">
      <span style="color:#1a1a1a;font-weight:600;border-bottom:2px solid #a3272c;padding-bottom:3px">Home</span><span>Browse</span><span>Planning</span><span>Shopping</span>
    </div>
  </div>

  <div style="padding:36px 26px 24px">
    <p style="font-size:11px;letter-spacing:0.1em;color:#a3272c;margin:0 0 8px;font-weight:700;text-transform:uppercase">Your personal cooking library</p>
    <h1 style="font-family:'Libre Caslon Display',serif;font-size:36px;color:#1a1a1a;margin:0 0 14px">What will you cook next?</h1>
    <div style="display:flex;gap:8px">
      <input placeholder="Search recipes, ingredients, authors..." style="flex:1;max-width:340px;border:1px solid #1a1a1a;border-radius:0"/>
      <button style="border:1px solid #1a1a1a;background:#fff;border-radius:0">Filters</button>
      <button style="background:#1a1a1a;color:#fff;border:none;border-radius:0">Search</button>
    </div>
  </div>

  <div style="padding:0 26px 8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h2 style="font-family:'DM Sans',sans-serif;font-weight:700;font-size:22px;color:#1a1a1a;margin:0">Recently added</h2>
      <span style="font-size:12px;color:#a3272c;text-decoration:underline">See all</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <!-- 4 tarjetas de receta reales -->
    </div>

    <div style="border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a;padding:18px 0;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <div><p style="font-size:11px;letter-spacing:0.1em;color:#a3272c;margin:0 0 6px;font-weight:700;text-transform:uppercase">Plan your week</p><h3 style="font-family:'DM Sans',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;margin:0">Sign up to save your own weekly plan and shopping list.</h3></div>
      <button style="background:#a3272c;color:#fff;border:none;border-radius:0;white-space:nowrap">Sign up</button>
    </div>

    <div style="padding-bottom:20px">
      <p style="font-size:11px;letter-spacing:0.1em;color:#a3272c;margin:0 0 6px;font-weight:700;text-transform:uppercase">Find your way in</p>
      <h3 style="font-family:'DM Sans',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;margin:0 0 12px">Browse the library</h3>
      <p style="font-size:10px;color:#888;text-transform:uppercase;margin:0 0 6px">Main ingredient</p>
      <div style="display:flex;gap:14px;margin-bottom:12px;font-size:12px"><span>Chicken · 86</span><span>Pasta · 54</span><span>Salmon · 31</span></div>
      <p style="font-size:10px;color:#888;text-transform:uppercase;margin:0 0 6px">Author</p>
      <div style="display:flex;gap:14px;font-size:12px"><span>Adam Hoad · 12</span><span>Alfonso D. Martín · 8</span></div>
    </div>
  </div>
</div>

Puntos clave que no se deben perder: el hero es la ÚNICA cosa en Libre Caslon Display. "Recently added" es <h2> en DM Sans 700, 22px. El banner "Plan your week" tiene el titular en DM Sans 700 a 16px (no más grande), en 1-2 líneas. Orden de botones: Filters antes que Search. Bandas delimitadas por border-top/border-bottom, nunca relleno de color sólido.

Anexo B — Browse (referencia de 10c)
html
<div style="font-family:'DM Sans',sans-serif;background:#ffffff;border:0.5px solid var(--border);border-radius:4px;overflow:hidden">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid #1a1a1a">
    <span style="font-family:'Libre Caslon Display',serif;font-size:17px;color:#1a1a1a">Kitchen Index</span>
    <div style="display:flex;gap:20px;font-size:11px;letter-spacing:0.04em;color:#333;text-transform:uppercase">
      <span>Home</span><span style="color:#1a1a1a;font-weight:600;border-bottom:2px solid #a3272c;padding-bottom:3px">Browse</span><span>Planning</span><span>Shopping</span>
    </div>
  </div>

  <div style="padding:18px 24px">
    <h1 style="font-family:'Noto Serif',serif;font-size:26px;color:#1a1a1a;margin:0 0 12px">Browse recipes</h1>
    <div style="display:flex;gap:8px">
      <input placeholder="Search title, ingredient, author..." style="flex:1;border:1px solid #1a1a1a;border-radius:0"/>
      <div style="display:flex;border:1px solid #1a1a1a"><span style="padding:6px 10px;border-right:1px solid #1a1a1a">⊞</span><span style="padding:6px 10px;background:#1a1a1a;color:#fff">☰</span></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:220px 1fr;gap:0;border-top:1px solid #1a1a1a">
    <div style="padding:16px 16px 16px 24px;border-right:1px solid #e5e5e5">
      <!-- barra lateral: chips agrupados por categoría, estilo .rchip/.rchip.on abajo -->
      <p style="font-size:10px;letter-spacing:0.06em;color:#1a1a1a;font-weight:700;text-transform:uppercase;margin:0 0 7px">Personal</p>
      <div style="margin-bottom:14px">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:4px 10px;border:1px solid #999;color:#333;margin:0 5px 5px 0">Favorites</span>
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:4px 10px;background:#1a1a1a;color:#fff;border:1px solid #1a1a1a;margin:0 5px 5px 0">Planning</span>
      </div>
      <!-- Rating, Method, Type, Cuisine, Ingredients: mismo patrón de chips, con conteo real "· N" -->
    </div>
    <div style="padding:16px 24px">
      <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #e5e5e5">
        <div style="width:110px;height:80px;background:#f0f0f0;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0 0 6px">Garlic Parmesan Chicken Wraps</p>
          <p style="font-size:12px;color:#888;margin:0;max-width:460px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Chicken, garlic, parmesan, tortilla, spinach <span style="color:#a3272c">+3 more</span></p>
        </div>
      </div>
    </div>
  </div>
</div>

Puntos clave: buscador con flex:1 (nunca ancho fijo). Filtros = chips (fondo negro sólido 
#1a1a1a si activo, borde #999 si no — nunca checkbox), tamaño de texto ≥12px, con icono aprobado solo en Personal/Rating. Texto de ingredientes con max-width + text-overflow:ellipsis (nunca 3 columnas fijas con hueco vacío). "Search" es el único botón de relleno sólido de esta pantalla (rojo, no negro).

Anexo C — Ficha de receta (referencia de 10d)
html
<div style="font-family:'DM Sans',sans-serif;background:#ffffff;border:0.5px solid var(--border);border-radius:4px;overflow:hidden">
  <div style="padding:14px 26px 0"><span style="font-size:12px;color:#888;text-decoration:underline">← Back to library</span></div>
  <div style="padding:14px 26px 0"><h1 style="font-family:'Noto Serif',serif;font-size:26px;color:#1a1a1a;margin:0 0 6px">Garlic Parmesan Chicken Wraps</h1><p style="font-size:12px;color:#888;margin:0 0 14px">Makes 3 · Adam Hoad · Instagram · <span style="color:#a3272c;text-decoration:underline">View original</span></p></div>

  <div style="display:flex;align-items:center;gap:14px;padding:12px 26px;border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a">
    <span style="font-size:12px">♡ Favorite</span><span style="width:1px;height:14px;background:#ddd"></span>
    <span style="font-size:12px">✓ Mark as made</span><span style="width:1px;height:14px;background:#ddd"></span>
    <span style="font-size:12px;color:#a3272c">★★★★★</span><span style="flex:1"></span>
    <span style="font-size:11px;color:#888">398 kcal · 24g protein</span>
    <button style="background:#a3272c;color:#fff;border:none;border-radius:0;padding:6px 14px;font-size:12px;font-weight:600">+ Add to this week</button>
  </div>

  <div style="display:grid;grid-template-columns:230px 1fr;gap:0">
    <div style="border-right:1px solid #e5e5e5;padding:16px 20px;position:sticky;top:0;align-self:start">
      <div style="height:110px;background:#f0f0f0;margin-bottom:12px"></div>
      <p style="font-size:10px;letter-spacing:0.08em;color:#1a1a1a;margin:0 0 8px;font-weight:700;text-transform:uppercase">Ingredients</p>
      <ul style="list-style:none;padding:0;margin:0;font-size:12px;color:#333;line-height:1.9">
        <li>☐ 2 chicken breasts</li>
      </ul>
    </div>
    <div style="padding:16px 24px">
      <p style="font-size:10px;letter-spacing:0.08em;color:#1a1a1a;margin:0 0 10px;font-weight:700;text-transform:uppercase">Method</p>
      <ol style="padding-left:18px;font-size:12px;color:#333;line-height:1.7;margin:0">
        <li>Season the chicken with salt, pepper and garlic.</li>
      </ol>
    </div>
  </div>
</div>

Puntos clave: franja de acciones consolidada bajo el título (UNA sola, con líneas horizontales arriba/abajo, nunca caja con borde completo). Valoración en rojo 
#a3272c, nunca dorado. "Add to this week" es el único relleno sólido de la pantalla. Columna de ingredientes con position: sticky — no numeración "01/02".