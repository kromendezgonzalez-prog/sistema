# LOMUS · Mercaimpulso

App web instalable (PWA) para que las mercaimpulsadoras registren su gestión diaria en los puntos de venta (inventario por lotes con fecha de vencimiento, GPS, fotos de novedades) y para que la administración vea el tablero de indicadores, la auditoría y descargue el backup en Excel.

| Parte | Tecnología | Dónde vive |
|---|---|---|
| Frontend (lo que ven en el celular) | React + Vite (PWA) | **Cloudflare** Workers (Static Assets) |
| API (backend) | Node.js + Express | **Render** |
| Base de datos | MongoDB | **MongoDB Atlas** (M0 gratis) |
| Fotos | — | **Cloudinary** |
| Código | — | **GitHub** (repositorio privado) |

```
apps/web          Frontend PWA
apps/api          API
packages/shared   Reglas compartidas (KPIs, niveles de riesgo, validaciones)
workers/keepalive Despertador de la API (Cloudflare cron)
scripts/          seed (datos iniciales) y backup
docs/             Contrato de la API
referencia/       Prototipo, esquema aprobado y datos semilla
```

---

## 1. Trabajar en el computador (desarrollo)

Requisitos: Node.js 20 o superior, Git.

```bash
npm install
npm run build:shared
```

1. Copia `apps/api/.env.example` a `apps/api/.env` y llena los valores (ver sección 3).
2. Carga los datos iniciales: `npm run seed` (imprime las contraseñas temporales de cada trabajadora).
3. En una terminal: `npm run dev:api` (API en http://localhost:4000).
4. En otra terminal: `npm run dev:web` (app en http://localhost:5173).

Pruebas: `npm test`.

---

## 2. Cuentas necesarias

1. **GitHub**: repositorio privado `mercaimpulso` con este código.
2. **MongoDB Atlas**: cluster M0 gratis.
3. **Render**: cuenta conectada a GitHub.
4. **Cloudflare**: cuenta gratis.
5. **Cloudinary**: cuenta gratis.

---

## 3. Paso a paso de despliegue

### 3.1 MongoDB Atlas (base de datos)
1. Crear un **cluster M0** (gratis), región cercana (p. ej. AWS us-east-1).
2. **Database Access** → *Add new database user* → usuario `merca_api` con contraseña larga → rol *Read and write to any database*.
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (Render no tiene IP fija en plan gratis).
4. **Connect → Drivers** → copiar la cadena `mongodb+srv://...`; reemplazar `<password>` y agregar el nombre de la base antes del `?`: `...mongodb.net/mercaimpulso?retryWrites=true&w=majority`.
   → Esto es `MONGODB_URI`.

### 3.2 Cloudinary (fotos)
1. En el *Dashboard* copiar **Cloud name**, **API Key** y **API Secret**.
   → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### 3.3 Render (API)
1. *New → Blueprint* → elegir el repositorio de GitHub. Render lee `render.yaml` y crea el servicio `mercaimpulso-api`.
2. Llenar las variables marcadas como secretas:

| Variable | Valor |
|---|---|
| `MONGODB_URI` | cadena del paso 3.1 |
| `JWT_SECRET` | texto aleatorio largo (≥ 32 caracteres) |
| `JWT_REFRESH_SECRET` | otro texto aleatorio largo distinto |
| `CORS_ORIGIN` | URL del frontend, p. ej. `https://mercaimpulso.<tu-cuenta>.workers.dev` |
| `CLOUDINARY_*` | del paso 3.2 |
| `ADMIN_USER` / `ADMIN_PASSWORD` | usuario y contraseña inicial de la administradora |
| `TURNSTILE_SECRET` | (opcional) llave secreta de Cloudflare Turnstile |

3. Esperar el primer despliegue y abrir `https://<servicio>.onrender.com/health` → debe responder `{"ok":true}`.
4. **Cargar datos iniciales**: en Render → *Shell* del servicio: `npm run seed`. Anotar las contraseñas temporales que imprime (solo se ven esa vez).

> Plan gratis de Render: el servicio se duerme tras 15 min sin uso y tarda ~1 min en despertar. El *keep-alive* (3.5) lo mantiene despierto de 5 a.m. a 9 p.m. Alternativa: plan **Starter** de Render (≈ US$7/mes), siempre encendido.

### 3.4 Cloudflare (frontend)
1. En el computador: `npx wrangler login` (abre el navegador para autorizar).
2. Crear `apps/web/.env.production` con `VITE_API_URL=https://<servicio>.onrender.com`.
3. Publicar: `npm run build:shared` y luego `npm run deploy -w apps/web`.
4. La app queda en `https://mercaimpulso.<tu-cuenta>.workers.dev`. Poner esa URL en `CORS_ORIGIN` de Render.

**Seguridad básica en Cloudflare** (panel → *Security*):
- *Bot Fight Mode*: activado.
- (Opcional) **Turnstile**: crear un widget para el dominio de la app; la *Site key* va en `VITE_TURNSTILE_SITEKEY` (frontend) y la *Secret key* en `TURNSTILE_SECRET` (Render).
- Los encabezados de seguridad ya vienen en `apps/web/public/_headers`.

### 3.5 Keep-alive (despertador de la API)
1. Editar `workers/keepalive/wrangler.jsonc` → `API_URL` = URL de Render.
2. `npx wrangler deploy -c workers/keepalive/wrangler.jsonc`.

### 3.6 Entregar la app al equipo
1. Entrar como administradora y cambiar la contraseña inicial.
2. En **Admin → Puntos de venta** completar ciudades y, estando en cada punto, tocar **"Fijar con mi ubicación actual"** (o escribir las coordenadas).
3. En **Admin → Usuarios** revisar ciudades y puntos asignados (p. ej. Evellyn aún no tiene puntos).
4. Entregar a cada trabajadora su usuario y contraseña temporal; al entrar la primera vez deberá cambiarla.
5. **Instalar en Android**: abrir la URL en Chrome → menú ⋮ → **"Agregar a pantalla de inicio" / "Instalar app"**. En iPhone: Safari → Compartir → **"Agregar a inicio"**.
6. Pedir que acepten el permiso de **ubicación** y de **cámara** cuando la app lo pida.

---

## 4. Respaldos
- **Desde la app**: Admin → **Descargar backup Excel** (todas las tablas en un .xlsx).
- **Técnico**: `npm run backup -w apps/api` → JSON por colección en `backups/AAAA-MM-DD/` (el M0 de Atlas no tiene respaldos automáticos).

## 5. Fase 2 (pendiente)
- Notificaciones (alertas de vencimiento, recordatorio de reporte).
