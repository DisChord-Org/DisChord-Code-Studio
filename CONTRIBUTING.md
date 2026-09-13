# Contribuir a DisChord Code Studio

Este documento recoge las convenciones **reales** que ya sigue el proyecto (o que debería seguir de forma consistente), de cara a la refactorización general del código.

## Stack

- Frontend: Tauri v2 + React 19 + TypeScript + Tailwind 4, gestionado con **pnpm**.
- Backend: Rust, en `src-tauri/`.

## Estructura del proyecto

Frontend organizado por *features*, con esta forma objetivo:

```
src/features/<nombre>/
  components/   (uno o más .tsx)
  index.ts      (barrel: reexporta lo público de la feature)
  types.ts      (tipos propios de la feature)
  use<Algo>.ts  (hooks propios, si aplica)
```

`src/features/settings/` es el ejemplo que más se acerca a esta forma completa. **Hoy hay excepciones que el refactor debería resolver**:
- `dashboard/` y `system-monitor/` no tienen carpeta `components/` (el componente vive suelto en la raíz de la feature) ni `index.ts`.
- `packages/` no tiene `types.ts` — los tipos (`PackageEntry`, `PkgOpOutcome`, etc.) están declarados inline en el propio componente.
- `editor/` no tiene un hook `useX.ts` propio; su estado vive en `src/views/Editor.tsx`.

Resto de carpetas:
- `src/components/ui/` — primitivas compartidas (`Button`, `Modal`, `Tooltip`, `Typography`, `WindowControls`...). Sin barrel: se importan por ruta directa.
- `src/views/` — pantallas de nivel superior (`Dashboard`, `Editor`, `Settings`, `Update`).
- `src/languages/` — integración de CodeMirror y el lenguaje `chord` (parser, tema, autocompletado).
- `src/utils/` — utilidades sueltas sin feature asociada.
- Backend: `src-tauri/src/commands/<dominio>.rs` — un fichero por dominio (`config`, `file`, `packages`, `process`, `project`, `system_stats`), y `updater/` como submódulo con varios ficheros internos.

## Componentes

- Un componente por fichero, PascalCase, y el nombre de archivo coincide con el nombre exportado. (Excepción a corregir: `ProjectCard.tsx` exporta un componente llamado `Card`.)
- Props: `interface <Nombre>Props { ... }` declarada justo encima del componente. (Excepción a corregir: `ProjectCard.tsx` usa `CardProps` para un componente `Card` — el nombre de la interfaz debería coincidir con el del componente, no con el del fichero.)
- Exports: **named export** (`export const X = (...) => {...}`) en todo excepto `src/views/*.tsx`, que además de la declaración con nombre añaden un `export default` al final del fichero. Mantener esta distinción — es limpia y consistente.
- Todo lo público de una feature se reexporta desde su `index.ts`.

## Estilos (Tailwind)

- Solo clases utilitarias inline, en `className`. Nada de CSS modules, `styled-components`, `clsx` ni `cva`.
- No hay theme extension de Tailwind para los colores propios de la app — se repiten como *arbitrary values* (`bg-[#5865F2]`). Paleta recurrente a mantener:
  - `#5865F2` (hover `#4752C4`) — acento principal (azul Discord).
  - `#0B0E14` — fondo general de la app.
  - `#111214` / `#12151c` — fondos de paneles y tarjetas.
  - `#1e1f22` / `#30363d` — bordes.
  - La paleta de sintaxis estilo One Dark vive **solo** en `src/languages/chord-theme.ts` y `editor-theme.ts` — no mezclarla con los colores de chrome de la interfaz.
- Tamaños de texto muy pequeños y recurrentes (`text-[9px]` a `text-[13px]`): la interfaz es deliberadamente compacta, no usar los tamaños por defecto de Tailwind (`text-sm`, `text-xs`) donde ya hay un arbitrary value establecido para ese contexto.
- Reutiliza los primitivos de `src/components/ui/` (`Button`, `Tooltip`...) en vez de elementos nativos a mano. Hay sitios que no lo hacen hoy (p. ej. `Modal.tsx` usa `<button>` en crudo en vez de `Button`) — corregirlo es parte del refactor.

## Datos y estado

- Llamadas a Tauri: `invoke<T>("nombre_comando", { argCamelCase })`. Las claves del objeto de argumentos van en camelCase aunque el comando Rust las reciba en snake_case (Tauri traduce automáticamente).
- Llamadas sin valor de retorno relevante: sin el genérico `<T>`, terminando en `.catch(console.error)`.
- Eventos: `listen` de `@tauri-apps/api/event`.
- Ventana actual: `getCurrentWindow()` de `@tauri-apps/api/window`, izada a una constante de módulo fuera del componente (no dentro del cuerpo del componente).
- Patrón de configuración: el hook `useConfig` (`src/features/settings/useConfig.ts`) es la referencia — estado sembrado con un `DEFAULT_CONFIG`, carga vía `invoke("get_config")` en un `useEffect`, y `updateConfig` hace una actualización optimista del estado local antes de persistir. Si un valor de config necesita reflejarse en una variable CSS (p. ej. la fuente del editor), hazlo en un `useEffect` dentro del propio hook, no en cada componente consumidor.

## Backend (Rust)

- Un fichero por dominio en `src-tauri/src/commands/`.
- Comandos con `#[tauri::command]`, devolviendo `Result<T, String>` cuando pueden fallar.
- Usa el trait `LogErr` (`log_err.rs`) para convertir errores a `String` con log automático: `.log_err("mensaje de contexto")?`.
- La lógica específica de plataforma vive en `platform.rs`, con pares `#[cfg(target_os = "windows")]` / `#[cfg(not(target_os = "windows"))]` para la misma función cuando el comportamiento difiere.
- Los procesos hijos se lanzan con `silent_command()` (evita que se abra una ventana de consola en Windows).

## Logs y comentarios

- Los mensajes de log (`info!`/`warn!`/`error!`) van **en español**, como el resto del proyecto — mantener esta convención, no traducirlos al refactorizar.
- Los mensajes de `console.error` en el frontend también van en español, igual que el resto de strings de cara al usuario.
- Comentarios de código: van **en inglés**. El proyecto tenía una mezcla histórica (mayoría en español en el backend y el código más antiguo), pero la convención decidida de cara al refactor es inglés — los comentarios existentes en español se van traduciendo a medida que se toca cada fichero.
- Esto coincide con el idioma de los mensajes de commit (ver abajo) — comentarios de código y commits van en inglés; logs, `console.error` y todo lo de cara al usuario se quedan en español.

## TypeScript

- `strict`, `noUnusedLocals` y `noUnusedParameters` activos en `tsconfig.json` — no dejar imports ni variables sin usar.
- Si un `useEffect`/`useCallback` tiene dependencias incompletas a propósito, añade `// eslint-disable-next-line react-hooks/exhaustive-deps` justo encima de esa línea. No desactivar la regla de forma global.
- **Nada de `SCREAMING_SNAKE_CASE`** para constantes de módulo — van en `camelCase`, igual que cualquier otra variable (`const minFontSize = 8`, no `const MIN_FONT_SIZE = 8`).
- Las constantes que son tablas de mapeo o listas de opciones (objetos `Record<K, V>`, arrays de `{ value, label, ... }` usados para renderizar opciones, diccionarios de etiquetas, etc.) no van inline en el componente — se extraen a un fichero hermano `<Componente>.constants.ts` junto al fichero que las usa (p. ej. `EditorSettings.tsx` + `EditorSettings.constants.ts`). Constantes escalares sueltas (un número de tamaño, un intervalo de polling, una regex) se quedan donde están, solo renombradas.
- Esto no aplica al backend Rust: ahí las constantes van en `SCREAMING_SNAKE_CASE` porque es la convención obligatoria del lenguaje (el compilador avisa si no se sigue).

## Commits

- Mensajes en **inglés**, sin trailer de co-autoría ni crédito a herramientas/IA.
- **Un commit por asunto** — dos cambios sin relación son dos commits.
- Prefijo según el tipo: `add:` / `delete:` / `refactor:` / `modify:` / `fix:`.

## Antes de dar por terminado un cambio

- Frontend: `npx tsc --noEmit` sin errores.
- Backend: `cargo check` sin errores ni warnings nuevos.
