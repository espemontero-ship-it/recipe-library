Recipe Library v0.13.0 — Auditoría de recetas existentes

QUÉ AÑADE
- Pantalla de administrador: http://localhost:3000/recipe-audit
- Lee todas las recetas existentes de Supabase.
- Vuelve a interpretar raw_source_text con Parser v2 en el navegador.
- Clasifica cada receta como:
  · Looks correct
  · Safe repair candidate
  · Needs review
  · No original text
- Compara receta guardada y vista previa del Parser v2.
- Permite exportar el informe completo en CSV.

SEGURIDAD
- Esta versión no actualiza, repara ni elimina recetas.
- La auditoría solo llama a la lectura existente de Supabase.
- No hay botones de aplicación de cambios.
- No requiere SQL.

USO
1. Instala con INSTALL.bat.
2. Ejecuta npm run dev.
3. Inicia sesión como administradora.
4. Abre http://localhost:3000/recipe-audit o pulsa Audit en la navegación.
5. Espera a que cargue el informe.
6. Exporta CSV para conservar una copia de los resultados si lo necesitas.

El siguiente entregable podrá usar este informe para construir la reparación con previsualización y reversión.
