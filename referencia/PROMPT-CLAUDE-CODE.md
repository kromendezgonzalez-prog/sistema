# Prompt para Claude Code — App Mercaimpulso LOMUS

> **Cómo usarlo:** crea una carpeta vacía para el proyecto y, dentro, una subcarpeta `referencia/` con estos dos archivos: `prototipo-artefacto.html` (la app que ya funciona como prototipo) y `seed-config.json` (catálogo, puntos de venta, equipo y metas). Abre Claude Code en esa carpeta y pega **todo** lo que está debajo de la línea.

---

Eres un ingeniero full-stack senior. Vas a construir para producción la app **"LOMUS · Mercaimpulso"**: una PWA móvil para que un equipo de mercaimpulsadoras de carne de cerdo registre su gestión diaria en puntos de venta (supermercados) de varias ciudades de Colombia, y un tablero de indicadores para la administración. Todo en **español de Colombia**.

## 0. Contexto y referencias (léelas primero)

- `referencia/prototipo-artefacto.html` es un prototipo funcional de una sola página. **Replica su experiencia de usuario, campos, validaciones, fórmulas de KPIs y textos**, pero con la arquitectura de este documento. Su capa de datos (`window.claude.use("db")`, `assets`, `user`, `downloads`) **no existe fuera del prototipo**: reemplázala por llamadas a la API descrita aquí.
- `referencia/seed-config.json` contiene el catálogo (32 productos), 21 puntos de venta, 6 mercaimpulsadoras con sus puntos asignados, metas y marcas de competencia. Úsalo para el script de semillas.
- El problema de negocio: hay problemas de **rotación y devoluciones**. Hasta agosto se registraba en un Excel con una hoja por persona y se perdió la trazabilidad (casillas vacías, puntos de venta escritos a mano de 30 formas distintas, fechas de vencimiento inválidas, sin campo de avería). La app debe hacer imposible esos errores.

Antes de escribir código: lee ambos archivos, resume en 10 líneas lo que entendiste y muéstrame el plan de carpetas. Luego construye por fases (sección 11) y al terminar cada fase corre las pruebas y dime qué quedó.

## 1. Arquitectura y stack (obligatorio)

| Capa | Tecnología | Despliegue |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript, React Router, TanStack Query, `vite-plugin-pwa` (Workbox), Dexie (IndexedDB) para la cola offline | **Cloudflare Workers con Static Assets** (`wrangler`), con fallback SPA |
| API | Node.js 20 LTS + TypeScript + Express (o Fastify), Mongoose, Zod para validar, JWT, bcrypt, helmet, cors, express-rate-limit, pino | **Render** Web Service (`render.yaml`) |
| Base de datos | **MongoDB Atlas** (cluster M0 gratis para empezar) | Atlas |
| Fotos de exhibición | **Cloudflare R2** (S3 compatible) con URLs prefirmadas generadas por la API (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) | R2 |
| Exportación | CSV (UTF-8 con BOM) y XLSX (`exceljs`) desde la API | — |

Monorepo con npm workspaces:

```
/apps/web        (PWA React)
/apps/api        (API Express)
/packages/shared (tipos TS, esquemas Zod y fórmulas de KPIs compartidas por web y api)
/scripts         (seed, backups)
render.yaml
apps/web/wrangler.jsonc
README.md         (paso a paso de despliegue en español)
.env.example      (en api y web)
```

Las **fórmulas de KPIs viven en `packages/shared`** y se prueban con Vitest. La API calcula el tablero (agregaciones) y la web solo lo muestra; la web reutiliza `ventaOf` y validaciones para feedback inmediato en el formulario.

## 2. Roles y autenticación

- Roles: `admin` (dueña de la app, configura todo), `supervisor` (ve tablero de todo el equipo, no configura), `impulsadora` (registra y ve solo sus datos y su propio tablero).
- Login simple pensado para celular: **usuario (o celular) + PIN de 4–6 dígitos**. PIN con bcrypt. Bloqueo de 15 min tras 5 intentos fallidos.
- JWT de acceso (12 h) + refresh token (30 días) en cookie `httpOnly; Secure; SameSite=None` (frontend y API están en dominios distintos). Endpoint `/auth/refresh`.
- El admin crea usuarios, asigna rol, ciudad y puntos de venta, y puede resetear PIN. Primer admin creado por el script de semillas con variables de entorno `ADMIN_USER` y `ADMIN_PIN`.
- Toda consulta del rol `impulsadora` se filtra en el servidor por su `impulsadoraId` (nunca confiar en el cliente).

## 3. Modelo de datos (MongoDB)

**`usuarios`**: `_id, nombre, usuario (único, minúsculas), pinHash, rol, ciudad, pdvIds[], activo, intentosFallidos, bloqueadoHasta, creadoEn`.

**`pdvs`** (puntos de venta): `_id (slug, p. ej. "mercacentro-4"), nombre, cadena, ciudad, portafolio[] (códigos de producto codificados en ese punto; vacío = todos), lat?, lng?, activo`.

**`productos`**: `_id = cod (string, p. ej. "33014"), nombre, unidad ("kg" | "und"), pesoKg (número o null; ej. 0.5 para paquetes de 500 g), activo`.

**`config`** (un solo documento `_id:"general"`): `metas {doh:4, merma:0.02, osa:0.95, alertaVto:5, sos:0.30, conv:0.15}, marcasCompetencia[], novedades[]`.

**`registros`** (uno por persona + punto + fecha + turno):
```
_id: "{fecha}_{impulsadoraId}_{pdvId}_{turno}"   // idempotente: reenviar no duplica
fecha: "YYYY-MM-DD", turno: "Mañana"|"Tarde"|"Completa",
tipoDia: "Laboral"|"Descanso"|"Festivo"|"Incapacidad"|"Capacitación"|"Vacaciones",
impulsadoraId, impulsadoraNombre, pdvId, pdvNombre, ciudad,
items: { [cod]: { ini, rec, fin, ave, vto: "YYYY-MM-DD"|"" , agot: bool } },
ejec: { exhib: "Sí"|"Parcial"|"No", frentesL, frentesC, precioOk: "Sí"|"No", pop: "Sí"|"No", temp },
comp: { [marca]: { precio, act } },
impulso: { abordados, degust, compras },
nov: string[], obs, fotoKeys: string[],
geo?: { lat, lng, precisionM, distanciaPdvM },
creadoEn, actualizadoEn, creadoPor (userId), mismoDia: bool, origen: "online"|"offline-sync",
historial: [{ en, por, cambios }]   // auditoría de ediciones
```
Índices: `{fecha:1}`, `{impulsadoraId:1, fecha:-1}`, `{pdvId:1, fecha:-1}`.

> Tamaño estimado: ~5 KB por registro → 6 personas × 2 turnos × 365 días ≈ 4.400 registros/año ≈ 25 MB/año. Las fotos **no** van en Mongo, van en R2.

## 4. API REST (prefijo `/api/v1`)

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `GET /config` (catálogo activo, pdvs, metas, marcas, novedades — todo lo que la PWA necesita para trabajar offline; con `ETag`)
- `GET /registros?desde&hasta&impulsadoraId&pdvId` (paginado)
- `GET /registros/:id`
- `PUT /registros/:id` (crea o reemplaza; valida con Zod; guarda historial si ya existía; el servidor fija `creadoPor`, `actualizadoEn`, `mismoDia`)
- `POST /registros/sync` (lote de hasta 50 registros encolados offline; responde estado por id)
- `GET /registros/ultimo-inventario?pdvId&fecha&turno` → último registro laboral **anterior** de ese punto (de cualquier persona) para precargar el inventario inicial
- `POST /fotos/presign` → `{ uploadUrl, key }` (PUT directo a R2, solo `image/jpeg`, máx. 2 MB, expira en 10 min); `GET /fotos/:key` → URL firmada de lectura
- `GET /tablero?desde&hasta&impulsadoraId&pdvId` → todos los KPIs y tablas de la sección 6 ya calculados
- `GET /export?desde&hasta&formato=csv|xlsx` (admin/supervisor) → una fila por producto por registro, con las mismas columnas del `exportCsv` del prototipo
- Admin: CRUD `/admin/usuarios`, `/admin/pdvs`, `/admin/productos`, `PUT /admin/config`
- `GET /health` → `{ok:true}` sin tocar la base de datos (para el ping de keep-alive)

Errores en JSON `{error, detalle}` con mensajes en español. CORS solo para el dominio del frontend (`CORS_ORIGIN`). Rate limit en `/auth/*`.

## 5. Frontend: pantallas y comportamiento

Copia el diseño del prototipo (color principal `#8f1d2c`, tarjetas, botones tipo píldora, barra fija inferior con "Guardar registro"). Mobile-first, botones de mínimo 44 px, teclado numérico (`inputmode="decimal"`) en cantidades.

1. **Login** con usuario + PIN (teclado numérico). Recordar usuario.
2. **Registrar** (igual al prototipo, secciones numeradas):
   - Jornada: fecha (hoy, máximo 3 días atrás), turno, **tipo de día** (si no es Laboral solo pide novedades), punto de venta desde lista (primero los asignados). **Nunca texto libre** para el punto de venta.
   - Inventario por producto: Inicial · Recibido · Final · Avería · Vence (más próximo) · Agotado. Venta = ini + rec − fin − ave, calculada en vivo. Precarga de **inicial** (y vencimiento) con el último final de ese punto. Si ya existe el registro de ese turno, lo abre para editar. Buscador, filtro "solo con datos", y si el punto tiene portafolio, mostrar solo esos productos.
   - Validaciones (en rojo, permiten enviar con doble confirmación): venta negativa, vencimiento ya pasado, vencimiento a más de 120 días. Chip "Vence en N días" si ≤ `alertaVto`.
   - Góndola y precio: exhibición, frentes LOMUS, frentes competencia, temperatura de nevera, precio bien marcado, POP, **foto con la cámara** (comprimir en el cliente a 1280 px JPEG 0,72 antes de subir).
   - Competencia: marcas con precio $/kg y actividad.
   - Impulso: abordados, degustaciones, compras → conversión en vivo.
   - Novedades + observaciones.
   - **Check-in con GPS** (opcional pero recomendado): al guardar un registro laboral, pedir ubicación; si el punto tiene `lat/lng`, guardar distancia y marcar en el tablero los registros a más de 300 m.
   - Borrador autoguardado en IndexedDB.
3. **Offline-first:** el service worker cachea la app y `/config`. Si no hay red al guardar, el registro va a una cola en Dexie y se sincroniza con `/registros/sync` al volver la conexión (evento `online` + Background Sync donde exista). Banner "N registros sin enviar · Reintentar". Las fotos pendientes también se encolan.
4. **Mis registros:** últimos 60, con estado (enviado / pendiente), tocar para editar.
5. **Tablero:** igual al prototipo (ver sección 6). Impulsadora ve solo el suyo; admin/supervisor ven todo con filtros de rango (hoy, 7, 14, 30, mes actual, 90 días), persona y punto, y botones de descarga CSV/XLSX.
6. **Indicadores:** pantalla explicativa con la definición de cada KPI y la rutina diaria sugerida (copiar textos del prototipo; metas leídas de config).
7. **Administración** (solo admin): metas, usuarios (crear, editar, asignar puntos, resetear PIN, activar/desactivar), puntos de venta (con portafolio y coordenadas), catálogo (unidad y peso por unidad), marcas de competencia.

Gráficos: línea de sell-out diario y barras horizontales del top 10 de referencias, **una sola serie y un solo color**, con tooltip al pasar el dedo o el mouse, y responsivos (como en el prototipo). Puedes usar Recharts.

## 6. Fórmulas de KPIs (exactas, en `packages/shared`)

Sobre los registros filtrados con `tipoDia = "Laboral"`:

- `venta(item) = ini + (rec||0) − fin − (ave||0)`; si `ini` o `fin` es null → null. Ventas negativas se **excluyen** y se cuentan como "inconsistencias".
- `kgEq(cod, q) = unidad=="kg" ? q : (pesoKg ? q*pesoKg : null)`. Las unidades sin peso se reportan aparte como "und sin peso".
- **Sell-out** = Σ kgEq(venta). **Venta diaria** = sell-out ÷ días distintos con datos.
- **Inventario actual** = Σ kgEq(fin) del registro más reciente de cada par (pdv, producto) (orden: fecha, luego turno Mañana < Tarde < Completa).
- **Días de inventario (DOH)** = inventario actual ÷ venta diaria. Meta ≤ `metas.doh`.
- **% merma/devolución** = Σ kgEq(ave) ÷ (Σ kgEq(venta) + Σ kgEq(ave)). Meta ≤ `metas.merma`.
- **Riesgo de vencimiento** = pares (pdv, producto) con último `fin > 0` y `vto − hoy ≤ alertaVto` días (negativos = vencidos). Mostrar kg totales y lista ordenada por días.
- **OSA** = 1 − (ítems con `agot`) ÷ (ítems registrados). Meta ≥ `metas.osa`.
- **Share of shelf** = Σ frentesL ÷ Σ (frentesL + frentesC). Meta ≥ `metas.sos`.
- **Exhibición cumplida** = registros con exhib "Sí" ÷ registros con exhib. **Precio OK** análogo.
- **Conversión** = Σ compras ÷ Σ abordados. Meta ≥ `metas.conv`.
- **Reporte a tiempo** = registros con `mismoDia` ÷ registros.
- **Cumplimiento de reporte** por impulsadora activa: días con al menos un registro (de cualquier tipo de día) ÷ días calendario del rango hasta hoy; "días sin reporte"; ¿reportó hoy?; último registro.
- Semáforo por KPI: "mayor es mejor" → verde si ≥ meta, ámbar si ≥ 85 % de la meta, rojo si menos; "menor es mejor" → verde si ≤ meta, ámbar si ≤ 1,5 × meta, rojo si más. Siempre ícono + texto (✓ En meta / ! Atención / ✕ Crítico), nunca solo color.

Tablas del tablero: cumplimiento de reporte; por mercaimpulsadora (registros, venta kg, DOH, merma, OSA, conversión); productos por vencer (acción hoy); por punto de venta (venta, kg/día, inventario, DOH, merma); rotación por referencia (venta, inventario, DOH, merma, lectura: "Lenta" si DOH > 2 × meta o sin venta con inventario, "Riesgo de agotado" si DOH < 1); competencia (veces vista, precio promedio, actividades); novedades por tipo y neveras por encima de 4,4 °C.

Pruebas unitarias obligatorias de cada fórmula con casos borde (sin datos, división por cero, venta negativa, unidades sin peso, vencidos).

## 7. Seguridad y calidad

- Secretos solo en variables de entorno; `.env.example` documentado; nada de credenciales en el repo.
- Validación Zod en todas las entradas; límites de tamaño del body (1 MB).
- `helmet`, CORS estricto, rate limit, logs con pino sin datos sensibles.
- Mongoose con `maxPoolSize` pequeño (5) para no agotar conexiones del M0.
- ESLint + Prettier; Vitest (shared y api con `mongodb-memory-server`), y un smoke test e2e con Playwright del flujo login → registrar → ver tablero.
- Accesibilidad: labels en todos los campos, contraste AA, foco visible.

## 8. Variables de entorno

API (Render): `MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, ADMIN_USER, ADMIN_PIN, TZ=America/Bogota, NODE_ENV`.
Web (Cloudflare, en build): `VITE_API_URL`.

Todas las fechas de negocio se calculan en **America/Bogota**.

## 9. Despliegue

- `render.yaml` con el Web Service de la API (build `npm ci && npm run build -w apps/api`, start `node apps/api/dist/index.js`, `healthCheckPath: /health`, región Oregon u Ohio).
- `apps/web/wrangler.jsonc` con `assets.directory = "./dist"` y `not_found_handling = "single-page-application"`. Script `npm run deploy -w apps/web` (`vite build && wrangler deploy`).
- **Keep-alive:** el plan gratis de Render apaga el servicio tras 15 minutos sin tráfico. Crea un Worker pequeño con **Cron Trigger cada 10 minutos de 5:00 a 21:00 hora Colombia** que haga `GET /health`. Documenta en el README que la alternativa es pasar la API al plan pago Starter.
- Script `scripts/seed.ts` que carga `referencia/seed-config.json` (productos, pdvs, usuarios con PIN temporal impreso en consola, config) y crea el admin.
- Script `scripts/backup.ts` que exporta las colecciones a JSON (el M0 de Atlas no tiene respaldos automáticos) y un GitHub Action semanal opcional que lo ejecuta y guarda el archivo en R2.
- README en español, paso a paso para alguien no técnico: crear cluster M0 en Atlas, usuario de BD y Network Access; crear bucket R2 y llaves; desplegar API en Render; desplegar web en Cloudflare; correr el seed; entregar usuarios y PIN al equipo; instalar la PWA en Android ("Agregar a pantalla de inicio").

## 10. Criterios de aceptación

1. Una impulsadora sin señal llena y guarda un registro; al volver la red se sincroniza solo y aparece en el tablero del admin sin duplicarse.
2. Al elegir un punto con historial, el inventario inicial se precarga con el último final de ese punto.
3. Es imposible guardar un punto de venta que no exista en la lista.
4. Descanso/festivo cuentan como día reportado.
5. Los KPIs del tablero coinciden con los del prototipo usando los mismos datos (crea un test con datos de ejemplo).
6. La exportación XLSX abre en Excel con tildes correctas.
7. Una impulsadora no puede ver ni modificar registros de otra (probarlo con la API directamente).
8. Lighthouse PWA instalable y rendimiento ≥ 85 en móvil.

## 11. Fases (para y muéstrame el resultado al final de cada una)

1. Monorepo, `packages/shared` con tipos, Zod y fórmulas + pruebas.
2. API: auth, config, registros, último inventario, sync, tablero, export, admin + pruebas.
3. Web: login, registrar (con offline y borrador), mis registros.
4. Web: tablero, indicadores, administración, fotos a R2, GPS.
5. Despliegue: `render.yaml`, `wrangler.jsonc`, keep-alive, seed, backup, README.

Si algo de este documento es ambiguo o contradice el prototipo, **pregúntame antes de decidir**. No inventes datos de negocio.
