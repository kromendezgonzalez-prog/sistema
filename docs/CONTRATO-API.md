# Contrato de la API — `/api/v1`

Fuente de verdad de tipos: `packages/shared/src/api.ts` y `schemas.ts`. Si algo aquí y allí difiere, manda el código de `shared` y se corrige este documento.

## Convenciones
- JSON en todo. Errores: `ApiError { error, detalle?, codigo? }` con mensaje en español listo para mostrar.
- Auth: `Authorization: Bearer <accessToken>` (JWT 12 h, payload `{ sub, rol, nombre }`). Refresh token (30 d) en cookie `rt` `httpOnly; Secure; SameSite=None; Path=/api/v1/auth`. La web llama `fetch(..., { credentials: 'include' })`.
- Ante `401` con `codigo: 'TOKEN_EXPIRADO'` la web llama una vez `POST /auth/refresh` y reintenta.
- Si `usuario.debeCambiarPassword` es true, todos los endpoints excepto `/auth/*` y `GET /config` responden `403 { codigo: 'DEBE_CAMBIAR_PASSWORD' }`.
- Fechas de negocio `YYYY-MM-DD` en hora de Bogotá; timestamps ISO-8601 UTC.
- Toda consulta del rol `impulsadora` se filtra en el servidor por su `_id`. `supervisor` = lectura de todo; `admin` = todo.
- Cada acción relevante escribe un `EventoAuditoria` (colección `auditoria`, solo escritura desde el servidor).

## Endpoints

| Método y ruta | Rol | Entrada | Salida |
|---|---|---|---|
| `GET /health` | público | — | `{ ok: true }` (no toca la BD) |
| `POST /auth/login` | público (rate limit 10/15 min por IP) | `LoginInputSchema` | `AuthResponse` + cookie `rt`. 5 fallos → bloqueo 15 min (`423 BLOQUEADO`) |
| `POST /auth/refresh` | cookie | — | `AuthResponse` (rota la cookie) |
| `POST /auth/logout` | cualquiera | — | `204`, borra cookie |
| `GET /auth/me` | cualquiera | — | `{ usuario: UsuarioPublico }` |
| `POST /auth/cambiar-password` | cualquiera | `CambiarPasswordSchema` | `AuthResponse` (con `debeCambiarPassword=false`) |
| `GET /config` | cualquiera | header `If-None-Match` | `ConfigResponse` + `ETag` (o `304`) |
| `GET /registros?desde&hasta&impulsadoraId&pdvId&pagina&porPagina` | todos (impulsadora: solo suyos) | — | `Paginado<Registro>` orden fecha desc, turno desc. `porPagina` máx 200 |
| `GET /registros/:id` | dueño / sup / admin | — | `{ registro }` |
| `PUT /registros/:id` | impulsadora (sus puntos, fecha ≥ hoy−3) / admin | `RegistroInputSchema`; `:id` debe ser `registroId(fecha, impulsadoraId, pdvId, turno)` | `GuardarRegistroResponse`. El servidor fija nombres, `ciudad`, `geo.distanciaPdvM/dentroDeRango` (con `evaluarGeo`), `riesgos` (`riesgosRegistro` con hoy), `mismoDia` (fecha == hoy Bogotá), `creadoPor/En`, `actualizadoPor/En`, `origen` (`online`). Audita `REGISTRO_CREADO`/`REGISTRO_EDITADO` (con diff resumido) y `GPS_FUERA_DE_RANGO` si aplica |
| `POST /registros/sync` | igual que PUT | `SyncInputSchema` | `SyncResponse` (procesa cada uno como PUT con `origen: 'offline-sync'`; un error no frena los demás) |
| `GET /registros/ultimo-inventario?pdvId&fecha&turno` | todos | — | `UltimoInventarioResponse`: registro **Laboral** más reciente del punto (de cualquier persona) estrictamente anterior a (fecha, turno); orden de turno Mañana < Tarde < Completa |
| `POST /fotos/firma` | todos | `{ contexto: 'novedad' \| 'gondola' }` | `FirmaFotoResponse` (folder `mercaimpulso/{fecha}/{usuario}`, firma válida 10 min; la web sube con `fetch(uploadUrl, { method:'POST', body: FormData })` y guarda `{ publicId: public_id, url: secure_url }`). Audita `FOTO_SUBIDA` |
| `GET /tablero?desde&hasta&impulsadoraId&pdvId` | todos (impulsadora: forzado a sí misma) | — | `TableroResponse` (usa `calcularTablero` de shared) |
| `GET /export?desde&hasta` | admin, supervisor | — | `.xlsx` una fila por lote por producto por registro (ver columnas abajo). Audita `EXPORT_EXCEL` |
| `GET /admin/backup.xlsx` | admin | — | Backup completo: hojas *Registros, Detalle productos, Lotes, Novedades, Usuarios (sin contraseñas), Puntos de venta, Productos, Configuración, Auditoría*. Audita `BACKUP_EXCEL` |
| `GET /admin/usuarios` | admin | — | `{ items: UsuarioPublico[] }` |
| `POST /admin/usuarios` | admin | `UsuarioCrearSchema` | `PasswordTemporalResponse` (`201`). Audita |
| `PATCH /admin/usuarios/:id` | admin | `UsuarioEditarSchema` | `{ usuario }`. Audita con diff. No puede desactivarse ni quitarse el rol admin a sí mismo |
| `POST /admin/usuarios/:id/reset-password` | admin | — | `PasswordTemporalResponse` (deja `debeCambiarPassword=true`, desbloquea). Audita |
| `GET/POST /admin/pdvs`, `PATCH /admin/pdvs/:id` | admin | `PdvSchema` (parcial en PATCH) | `{ items }` / `{ pdv }` |
| `POST /pdvs/:id/ubicacion` | admin | `{ lat, lng }` | `{ pdv }`. Fija la ubicación del punto desde el celular. Audita `PDV_UBICACION_FIJADA` |
| `GET/POST /admin/productos`, `PATCH /admin/productos/:id` | admin | `ProductoSchema` | `{ items }` / `{ producto }` |
| `PUT /admin/config` | admin | `ConfigSchema` | `{ config }`. Audita con diff |
| `GET /admin/auditoria?desde&hasta&usuarioId&accion&q&pagina&porPagina` | admin | — | `AuditoriaResponse` (orden `en` desc) |
| `GET /admin/novedades?desde&hasta&pdvId&tipo&pagina` | admin, supervisor | — | `NovedadesResponse` |

### Columnas de `/export` (hoja "Detalle")
`fecha, turno, tipo_dia, mercaimpulsadora, punto_venta, ciudad, codigo, producto, unidad, momento (llegada/cierre), lote, cantidad, cantidad_kg_eq, vence, dias_a_vencer, nivel_riesgo, inv_inicial, recibido, inv_final, averia, venta, venta_kg_eq, agotado, novedad_tipo, novedad_nota, novedad_fotos, exhibicion, frentes_lomus, frentes_comp, precio_ok, temp_c, abordados, compras, novedades, observaciones, gps_distancia_m, gps_en_rango, registrado_mismo_dia, actualizado`
