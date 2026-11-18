# LOMUS · Mercaimpulso — Esquema del proyecto (v2 producción)

> Estado: **v2 con decisiones (16-nov-2026)** — pendiente de visto bueno final para empezar a construir.
> Base: `PROMPT-CLAUDE-CODE.md` + `prototipo-artefacto.html` + `seed-config.json`, con los cambios pedidos el 16-nov-2026.

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Contraseñas | **Nadie las ve**, ni el admin. El admin solo las **resetea** (queda en auditoría). La trabajadora cambia la temporal al primer ingreso |
| GPS fuera de rango (> 300 m) | **Se permite guardar con marca roja** "fuera de rango", visible en tablero y auditoría |
| Rol supervisor | **Se mantiene** (ve tablero de todo el equipo, no configura, no ve auditoría) |
| Sin señal | **Modo offline**: guarda conteo, GPS y fotos y sincroniza al volver la red |
| Lotes | **Al llegar y al cierre**: inventario inicial y final se registran por lotes (cortes en kg y paquetes en unidades), cada lote con su fecha |
| Dirección web | **Gratis de Cloudflare** (`*.workers.dev`); se puede pasar a dominio propio después |
| Ciudades / puntos faltantes | **Carolina los completa desde el panel admin**; el seed carga lo que hay |
| GitHub | **Ya existe cuenta** — se crea un repositorio privado para que Render despliegue |

---

## 1. Qué cambia frente al prompt original

| # | Prompt original | Versión nueva |
|---|---|---|
| 1 | Login con usuario + PIN | **Usuario + contraseña** por trabajadora. El admin crea usuarios y resetea contraseñas (no las ve) |
| 2 | Historial de ediciones dentro de cada registro | **Colección `auditoria`** con TODO lo que pasa (logins, registros, fotos, exportes, cambios de admin). **Solo admin** la ve |
| 3 | Una sola alerta de vencimiento (`alertaVto = 5`) | **4 niveles de riesgo**: Medio (≤10 d), Crítico (≤7 d), Emergencia–Salida (≤5 d), Vencido (<0) |
| 4 | GPS opcional | **GPS obligatorio** para cualquier conteo (registro laboral). Sin ubicación no se guarda; fuera de 300 m se guarda con marca roja |
| 5 | Un vencimiento por producto ("el más próximo") | **Lotes al llegar y al cierre**: cada producto puede tener N lotes (ej. 5 piezas de punta de anca), cada uno con su cantidad/peso y su fecha de vencimiento |
| 6 | Foto de góndola general | **Novedad por producto/lote**: tipo (vacío perdido, empaque abierto…), nota y foto |
| 7 | Fotos en Cloudflare R2 | Fotos en **Cloudinary** (subida firmada) |
| 8 | Exportar CSV/XLSX | **Botón admin "Descargar backup Excel"** con todas las tablas en hojas separadas |
| 9 | — | **Botón "?" de ayuda** en cada pantalla + tour guiado la primera vez |
| 10 | Notificaciones | **Fase 2** (fuera de este alcance) |

---

## 2. Arquitectura

```
 Celular / PC (PWA instalable)
        │  HTTPS
        ▼
┌──────────────────────────────┐        ┌─────────────────────────┐
│ CLOUDFLARE                   │        │ CLOUDINARY              │
│ • Worker + Static Assets     │◄──────►│ Fotos de novedades      │
│   (frontend React)           │ subida │ (subida directa firmada)│
│ • Seguridad: HTTPS, WAF,     │ directa└─────────────────────────┘
│   Bot Fight, rate limit,     │                   ▲ firma
│   headers, Turnstile (login) │                   │
│ • Worker cron keep-alive     │──── /health ──┐   │
└──────────────┬───────────────┘               ▼   │
               │ /api/v1 (JSON, JWT)   ┌───────────┴─────────┐
               └──────────────────────►│ RENDER              │
                                       │ API Node 20 +       │
                                       │ Express + TS        │
                                       └──────────┬──────────┘
                                                  ▼
                                       ┌─────────────────────┐
                                       │ MONGODB ATLAS (M0)  │
                                       └─────────────────────┘
```

**Stack**
- Frontend: React 18 + Vite + TypeScript, React Router, TanStack Query, Zustand (estado del formulario), Tailwind + componentes propios (estilo del prototipo, color `#8f1d2c`), Framer Motion (transiciones suaves), Recharts, `vite-plugin-pwa`, Dexie (cola offline + borradores), `browser-image-compression`.
- API: Node 20 + Express + TypeScript, Mongoose, Zod, JWT + refresh en cookie httpOnly, bcrypt, helmet, cors, express-rate-limit, pino, exceljs, SDK de Cloudinary.
- Monorepo (npm workspaces):

```
/apps/web          PWA React
/apps/api          API Express
/packages/shared   Tipos, esquemas Zod, fórmulas KPI y niveles de riesgo (usados por web y api)
/scripts           seed.ts, backup.ts
/workers/keepalive Worker cron que despierta la API
render.yaml · apps/web/wrangler.jsonc · README.md (paso a paso en español) · .env.example
```

---

## 3. Roles y permisos

| Acción | Impulsadora | Supervisor* | Admin |
|---|:-:|:-:|:-:|
| Registrar conteo (con GPS) | ✓ (solo sus puntos) | — | ✓ |
| Ver / editar sus registros | ✓ (edición hasta 3 días) | — | ✓ todos |
| Tablero | Solo el suyo | Todo el equipo | Todo el equipo |
| Gestionar usuarios, puntos, catálogo, metas | — | — | ✓ |
| Resetear contraseñas (nadie puede verlas) | — | — | ✓ |
| **Auditoría** | — | — | ✓ **(exclusivo)** |
| **Descargar backup Excel** | — | — | ✓ |

\* Rol supervisor confirmado.

Toda consulta de una impulsadora se filtra **en el servidor** por su id.

---

## 4. Modelo de datos (MongoDB)

### `usuarios`
```
_id, nombre, usuario (único, minúsculas), passwordHash (bcrypt, irreversible: nadie la puede ver),
rol: "admin"|"supervisor"|"impulsadora", ciudad, pdvIds[], activo,
debeCambiarPassword: bool, intentosFallidos, bloqueadoHasta, ultimoAcceso, creadoEn
```

### `pdvs` (puntos de venta)
```
_id (slug, ej. "mercacentro-4"), nombre, cadena, ciudad, portafolio[] (cods; vacío = todos),
ubicacion?: { lat, lng }, radioM (default 300), activo
```
> El seed no trae coordenadas. Propuesta: el admin (o la impulsadora la 1.ª vez, con aprobación del admin) "fija la ubicación" del punto desde la app estando en él.

### `productos`
```
_id = cod ("33017"), nombre, unidad: "kg"|"und", pesoKg (null o ej. 0.5), activo
```

### `config` (`_id: "general"`)
```
metas { doh:4, merma:0.02, osa:0.95, sos:0.30, conv:0.15 },
riesgoVto { medio:10, critico:7, emergencia:5 },     ← NUEVO (editable por admin)
marcasCompetencia[], tiposNovedad[] (generales), tiposNovedadProducto[]
```
`tiposNovedadProducto` propuesto: *Vacío perdido · Empaque abierto/roto · Cambio de color/olor · Golpe/daño · Etiqueta ilegible · Sin fecha · Otro*.

### `registros` (uno por persona + punto + fecha + turno)
```
_id: "{fecha}_{impulsadoraId}_{pdvId}_{turno}"     (idempotente: reenviar no duplica)
fecha, turno, tipoDia, impulsadoraId/Nombre, pdvId/Nombre, ciudad,

items: {
  [cod]: {
    rec, ave, agot,
    lotesIni: [ Lote ],     ← NUEVO: al llegar (precargado con los lotes del último cierre del punto, editable)
    lotesFin: [ Lote ],     ← NUEVO: al cierre
      Lote = { id, cantidad, vto: "YYYY-MM-DD",     (cantidad en kg o en und según el producto)
               novedad?: { tipo, nota, fotos: [{ publicId, url }] } }
    ini        = Σ lotesIni.cantidad                (calculado, no se digita)
    fin        = Σ lotesFin.cantidad                (calculado, no se digita)
    vtoMin     = min(lotesFin.vto)                  (calculado; si no hay cierre aún, usa lotesIni)
    nivelRiesgo                                     (calculado con vtoMin)
  }
},
ejec { exhib, frentesL, frentesC, precioOk, pop, temp },
comp { [marca]: { precio, act } },
impulso { abordados, degust, compras },
nov[], obs, fotosGondola[],
geo: { lat, lng, precisionM, distanciaPdvM, dentroDeRango, capturadoEn }   ← OBLIGATORIO si Laboral
creadoEn, actualizadoEn, creadoPor, mismoDia, origen: "online"|"offline-sync"
```
Índices: `{fecha:1}`, `{impulsadoraId:1, fecha:-1}`, `{pdvId:1, fecha:-1}`, `{"items.*.vtoMin"}` vía campo plano `riesgos[]` para consultar rápido lo que está por vencer.

### `auditoria` ← NUEVA (solo admin)
```
_id, en (fecha-hora Bogotá), usuarioId, usuarioNombre, rol,
accion: LOGIN_OK | LOGIN_FALLIDO | LOGOUT | BLOQUEO |
        REGISTRO_CREADO | REGISTRO_EDITADO | REGISTRO_SYNC_OFFLINE |
        FOTO_SUBIDA | GPS_FUERA_DE_RANGO |
        USUARIO_CREADO | USUARIO_EDITADO | PASSWORD_RESETEADA | PASSWORD_VISTA |
        PDV_*, PRODUCTO_*, CONFIG_CAMBIADA, EXPORT_EXCEL,
entidad, entidadId, cambios (antes → después), ip, dispositivo, geo?
```
Índices: `{en:-1}`, `{usuarioId:1, en:-1}`, `{accion:1, en:-1}`. Solo se escribe desde el servidor, nunca se edita ni borra.

---

## 5. Niveles de riesgo de vencimiento (en `packages/shared`)

`dias = vto − hoy` (hora Colombia), por **lote**; el producto toma el peor de sus lotes.

| Días al vencimiento | Nivel | Color + ícono | Acción sugerida en la app |
|---|---|---|---|
| > 10 | OK | Verde ✓ | — |
| 8 – 10 | **Medio** | Amarillo ! | Rotar FEFO, adelantar en góndola |
| 6 – 7 | **Crítico** | Naranja ⚠ | Impulso + degustación prioritaria |
| 0 – 5 | **Emergencia crítica – SALIDA** | Rojo ✕ | Retirar / gestionar salida hoy |
| < 0 | **Vencido** | Negro ⛔ | Retiro inmediato + novedad obligatoria |

Umbrales editables por el admin. En el tablero: kg y lotes por nivel, y lista "Acción hoy" ordenada por días.

---

## 6. Flujo de la trabajadora (registro de conteo)

1. **Login** (usuario + contraseña, recordar usuario). Primera vez → cambiar contraseña + tour de ayuda.
2. **Inicio**: punto(s) asignados, botón grande "Iniciar conteo", pendientes offline.
3. **Check-in GPS (obligatorio)**: pide permiso de ubicación → muestra mapa pequeño y distancia al punto.
   - Dentro de 300 m → ✓ continúa.
   - Fuera → aviso amarillo "Estás a N m del punto"; puede continuar y el registro queda con **marca roja "fuera de rango"** (tablero + auditoría).
   - Sin permiso / GPS apagado → pantalla que explica cómo activarlo; no deja seguir.
4. **Inventario por producto** (tarjetas con buscador y filtro "solo con datos"), en dos momentos:
   - **Al llegar → Lotes iniciales**: vienen precargados con los lotes del último cierre de ese punto; la trabajadora confirma, corrige o agrega ("+ Agregar lote": cantidad + fecha).
   - **Durante**: Recibido · Avería · Agotado.
   - **Al cierre → Lotes finales**: lo que queda en nevera, lote por lote (botón "Copiar lotes iniciales" para ahorrar digitación y solo ajustar).
   - Cada lote muestra al instante su **chip de nivel de riesgo** y tiene botón **"Reportar novedad"** (tipo + nota + foto de cámara).
   - Inicial, final y venta se calculan solos. El registro se puede guardar al llegar y completar al cierre (mismo registro del turno).
5. Góndola y precio · Competencia · Impulso · Novedades generales (igual que prototipo).
6. **Resumen antes de guardar** (alertas en rojo, lotes en emergencia, fotos pendientes) → Guardar.
7. Offline: si no hay señal, queda en cola (incluidas fotos y GPS capturado en el momento) y se envía sola.

**Botón "?"** fijo en todas las pantallas: abre una hoja inferior con la explicación del paso actual (con ejemplos: "punta de anca con 5 piezas = 5 lotes"), más acceso al tour y a "Indicadores".

---

## 7. Pantallas admin

- **Tablero** (como prototipo + niveles de riesgo + mapa de check-ins + registros fuera de rango).
- **Usuarios**: crear, editar, asignar puntos, activar/desactivar, resetear contraseña (genera una temporal que se muestra una sola vez para entregarla a la trabajadora).
- **Puntos de venta** (con portafolio y ubicación), **Catálogo**, **Metas y umbrales de riesgo**, **Marcas / tipos de novedad**.
- **Auditoría**: tabla filtrable (fecha, usuario, acción), detalle de cambios antes/después, exportable.
- **Galería de novedades**: todas las fotos con filtro por punto, producto y tipo.
- **Descargar backup Excel**: un .xlsx con hojas *Registros · Detalle productos · Lotes · Novedades (con link a foto) · Usuarios · Puntos · Productos · Config · Auditoría*.

---

## 8. API (`/api/v1`) — cambios principales sobre el prompt
- `POST /auth/login` (usuario + contraseña), `/auth/refresh`, `/auth/logout`, `/auth/me`, `POST /auth/cambiar-password`
- `GET /config`, `GET/PUT /registros…`, `POST /registros/sync`, `GET /registros/ultimo-inventario` (precarga también lotes)
- `POST /fotos/firma` → firma Cloudinary (carpeta `mercaimpulso/{fecha}/{usuario}`, solo imágenes, ≤ 2 MB)
- `GET /tablero` (incluye riesgo por nivel)
- Admin: `/admin/usuarios` (+ `POST /:id/reset-password`), `/admin/pdvs`, `/admin/productos`, `/admin/config`, `GET /admin/auditoria`, `GET /admin/backup.xlsx`, `GET /admin/novedades`
- `GET /health`

---

## 9. Seguridad básica (Cloudflare + API)
- HTTPS forzado, headers de seguridad (CSP, HSTS, X-Frame-Options) desde el Worker.
- Cloudflare: Bot Fight Mode, regla de rate limit en `/auth/login`, **Turnstile** (captcha invisible) en el login.
- API: CORS solo al dominio del frontend, helmet, Zod en todo, bloqueo 15 min tras 5 intentos, contraseñas bcrypt, secretos solo en variables de entorno.

---

## 10. Equipo de agentes y plan de trabajo

| Agente | Responsabilidad | Cuándo |
|---|---|---|
| **Ingeniero líder** (yo) | Arquitectura, contratos, revisión de código, integración, despliegue | Todo el proyecto |
| **Agente Shared** | `packages/shared`: tipos, Zod, KPIs, niveles de riesgo + pruebas | Fase 1 (primero: es el contrato que usan todos) |
| **Agente Backend** | API completa, auditoría, Cloudinary, Excel, seed, pruebas | Fase 2 (en paralelo) |
| **Agente Frontend – Campo** | Login, inicio, check-in GPS, registro con lotes/novedades/fotos, offline, ayuda | Fase 2 (en paralelo) |
| **Agente Frontend – Admin** | Tablero, usuarios, auditoría, galería, backup, configuración | Fase 2 (en paralelo) |
| **Agente QA / DevOps** | Pruebas e2e, `render.yaml`, `wrangler`, keep-alive, README | Fase 3 |

Fases: **1** contratos → **2** backend + 2 frontends en paralelo → **3** integración, pruebas y despliegue a producción → **(Fase 2 del negocio)** notificaciones.

---

## 11. Lo que necesito de las cuentas (variables)
- **GitHub**: cuenta existente → repositorio privado `mercaimpulso` (Render despliega desde ahí).
- **Render**: acceso para crear el Web Service conectado a ese repositorio.
- **MongoDB Atlas**: `MONGODB_URI` (usuario de BD + Network Access 0.0.0.0/0 para Render).
- **Cloudflare**: cuenta + token de API para `wrangler deploy` (o hacer login desde la terminal).
- **Cloudinary**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

Las llaves se ponen directamente en los paneles de Render/Cloudflare o en un `.env` local que **no** se sube al repo.
