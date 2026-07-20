RECIPE LIBRARY v0.13.1 — FULL AUDIT DIAGNOSTICS

Esta corrección amplía la auditoría de recetas existentes.

CAMBIOS
- Mantiene el CSV resumido.
- Añade “Export full diagnostics”, que genera un JSON con:
  - texto original completo;
  - ingredientes y método guardados;
  - ingredientes y método obtenidos por Parser v2;
  - título, autor, URL, raciones, incidencias y similitudes.
- Sigue siendo completamente de solo lectura.
- No modifica Supabase.

INSTALACIÓN
1. Detén Recipe Library con Ctrl+C.
2. Ejecuta INSTALL.bat.
3. Ejecuta npm run dev.
4. Abre http://localhost:3000/recipe-audit.
5. Pulsa “Export full diagnostics”.
6. Sube el JSON generado al chat.

No ejecutes SQL.
