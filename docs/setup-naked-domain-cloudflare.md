# Setup `arenacup26.com` (apex) via Cloudflare

Cómo hacer que `https://arenacup26.com/es` (sin `www.`) cargue la app.

## Por qué Cloudflare y no Arsys directo

- **Railway pide un CNAME en el apex** (`@ → vmdo025k.up.railway.app`).
- **Arsys no permite CNAME en `@`** porque entra en conflicto con los
  registros NS/SOA obligatorios del dominio (RFC 1035). Es restricción
  histórica de muchos registrars antiguos.
- **Cloudflare hace "CNAME flattening"**: acepta el CNAME en apex
  internamente y lo expone al mundo como A record con la IP resuelta.
  Sin conflicto.
- **Coste**: plan Free de Cloudflare cubre esto al 100%.

## Estado inicial asumido

- `www.arenacup26.com` ya funciona como custom domain en Railway (CNAME
  `aq4m11ep.up.railway.app` desde Arsys).
- `arenacup26.com` (apex) ya está añadido como custom domain en
  Railway (CNAME `vmdo025k.up.railway.app`), con TXT verify
  `_railway-verify`.
- Arsys tiene los DNS de `www.arenacup26.com` pero no del apex
  (porque rechazó el CNAME).

## Pasos

### 1) Crear cuenta Cloudflare + añadir el dominio

1. https://cloudflare.com → **Sign Up** (gratis).
2. Dashboard → **Add a Site** → escribir `arenacup26.com`.
3. Seleccionar plan **Free**.
4. Cloudflare escanea los DNS actuales de Arsys e importa lo que
   encuentre. **Confirma que detecta el record `www → aq4m11ep.up.railway.app`**.
   - Si no aparece, déjalo y lo añadimos manualmente en el paso 3.
5. Cloudflare te muestra **2 nameservers** propios (tipo
   `xxx.ns.cloudflare.com` y `yyy.ns.cloudflare.com`). Cópialos.

### 2) En Cloudflare — preconfigurar los 3 records ANTES de cambiar NS

Esto se hace **antes** del cambio en Arsys para que cuando los NS
propaguen Cloudflare ya tenga la zona correcta y `www` no caiga.

DNS → Records → **Add record** uno por uno:

**a) `www` (verificar/crear si no se importó):**
```
Type:    CNAME
Name:    www
Target:  aq4m11ep.up.railway.app
Proxy:   ❌ DNS only (nube GRIS)
TTL:     Auto
```
⚠️ **No actives el proxy (naranja)** en el `www`. Railway emite el
cert SSL del `www` y necesita conexión directa cliente↔Railway.

**b) Apex (CNAME flattening):**
```
Type:    CNAME
Name:    @     (o "arenacup26.com" según cómo lo pida el formulario)
Target:  vmdo025k.up.railway.app
Proxy:   ❌ DNS only (nube GRIS)
TTL:     Auto
```
Cloudflare aceptará el CNAME en apex (Arsys no lo hacía).

**c) Verificación Railway:**
```
Type:    TXT
Name:    _railway-verify
Content: railway-verify=f8b12f690cc1669e2a14c1ee836c7fb6b94c61141ded8cb4eaaf4b3e14cfb003
TTL:     Auto
```

### 3) En Arsys — cambiar nameservers

⚠️ Esto **transfiere toda la gestión DNS** del dominio a Cloudflare. Es
lo único que tocas en Arsys, y solo una vez.

1. Panel Arsys → `arenacup26.com` → sección **Servidores DNS** /
   **Nameservers** / **Editar DNS**.
2. Sustituir los nameservers actuales (los de Arsys) por **los 2 de
   Cloudflare** del paso 1.5.
3. Guardar.
4. Espera. Propagación normalmente 5-30 min, máximo 24h.

Cloudflare te enviará un email cuando detecte el cambio:
> "Your site is now active on Cloudflare"

### 4) Verificar

Cuando llegue el email de Cloudflare:

```bash
# Resolución apex (debe dar IP de Railway, no vacío)
dig +short arenacup26.com

# Comprobar TXT de verificación
dig +short _railway-verify.arenacup26.com TXT

# Probar HTTPS — debe responder 200 con cert válido para arenacup26.com
curl -I https://arenacup26.com/es
```

En Railway → wmundial → Settings → Networking, el custom domain
`arenacup26.com` debe pasar de "Pending verification" a "Active" en
~5 min después de la propagación.

Visita `https://arenacup26.com/es` → carga la app.

## Caveats

- **El `www` se gestiona ahora desde Cloudflare**, no desde Arsys. Si
  alguna vez quieres cambiar algo del DNS (subdomain nuevo, etc.), lo
  haces en Cloudflare.
- **No actives proxy (naranja) en ninguno de los records.** Si lo
  activas, Cloudflare termina el TLS con su propio cert y Railway no
  ve el host original. Resultado: cert mismatch / 526. Mantén siempre
  "DNS only" (nube gris).
- **Plan Free de Cloudflare es indefinido**. No expira, no piden
  tarjeta. Si algún día Cloudflare cambia su política, los NS se
  pueden devolver a Arsys con el mismo procedimiento al revés (pero
  perderás CNAME flattening y volvemos al punto de partida).

## Si quieres lo mismo con `arenacup26.es`

Mismo procedimiento, otra zona en Cloudflare (gratis también soporta
N dominios). Pero recuerda que en Railway ya no tienes
`www.arenacup26.es` (lo borraste para liberar slot). Si quieres
soportar también el `.es`:
- Opción 1: upgrade plan Railway (~$20/mes) para tener más customs.
- Opción 2: mismo Cloudflare redirige `arenacup26.es/*` →
  `https://www.arenacup26.com/*` con una Redirect Rule. Sin slot
  Railway, gratis.
