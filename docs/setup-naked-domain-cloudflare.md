# Setup `arenacup26.com` (apex) via Cloudflare

Hacer que `https://arenacup26.com/...` redirija a `https://www.arenacup26.com/...`
sin consumir slot de custom domain en Railway (los dos que tenemos son
`www` y `admin`).

## Estrategia

Cloudflare actúa como proxy + redirector:
- DNS del dominio se gestiona desde Cloudflare (cambio NS en Arsys).
- `www` y `admin` siguen siendo CNAME a Railway (proxy OFF → conexión
  directa, Railway emite su cert SSL).
- El apex `arenacup26.com` apunta a una IP dummy con **proxy ON**
  (Cloudflare intercepta).
- Una **Single Redirect Rule** de Cloudflare manda
  `https://arenacup26.com/*` → `https://www.arenacup26.com/$1` con
  301. Cloudflare emite el cert SSL del apex (plan Free Universal SSL).

Coste total: 0€. Plan Free de Cloudflare es indefinido y sin tarjeta.

## Datos que vamos a meter

| Dato                            | Valor                                                                              |
|---------------------------------|------------------------------------------------------------------------------------|
| CNAME `www`                     | `aq4m11ep.up.railway.app`                                                          |
| CNAME `admin`                   | `w4bklyzw.up.railway.app`                                                          |
| TXT `_railway-verify.www`       | `railway-verify=7221f2d0faf1e893918099f9cfdf1991f013484e34d5a03377b477910a715bda`  |
| TXT `_railway-verify.admin`     | `railway-verify=3996a86b33c716f97b327f2d3f35f592264e1663a7b4571f8b992b7ecc9a5ca8`  |
| A `@` (apex, dummy)             | `192.0.2.1` (test IP RFC5737, no existe — Cloudflare intercepta)                   |

## Pasos

### 1. Crear cuenta + añadir dominio

1. https://cloudflare.com → **Sign Up** (gratis, sin tarjeta).
2. Dashboard → **Add a Site** → `arenacup26.com` → **Free** plan.
3. Cloudflare escanea los DNS actuales de Arsys e importa lo que
   detecte. Probablemente detecte:
   - `www CNAME aq4m11ep.up.railway.app`
   - `admin CNAME w4bklyzw.up.railway.app`
   - Quizá los TXT `_railway-verify.*` si Arsys los tenía.
4. Cloudflare te muestra 2 **nameservers** propios (formato
   `xxx.ns.cloudflare.com`). Cópialos para el paso 3.

### 2. En Cloudflare — DNS records (antes de cambiar NS en Arsys)

Configura todo ANTES de cambiar los NS para que cuando propaguen no
caiga `www` ni `admin`.

**Verifica que están estos 5 records (añade los que falten):**

```
Type: CNAME      Name: www                    Target: aq4m11ep.up.railway.app                 Proxy: 🔘 DNS only (GRIS)
Type: CNAME      Name: admin                  Target: w4bklyzw.up.railway.app                 Proxy: 🔘 DNS only (GRIS)
Type: TXT        Name: _railway-verify.www    Content: railway-verify=7221f2d0faf1...         (no proxy, no aplica)
Type: TXT        Name: _railway-verify.admin  Content: railway-verify=3996a86b33c7...         (no proxy, no aplica)
Type: A          Name: @                      Target: 192.0.2.1                               Proxy: 🟠 Proxied (NARANJA)
```

⚠️ **Crítico**:
- Los CNAME a Railway DEBEN ir con **proxy OFF (gris)**. Si activas
  proxy en ellos, Cloudflare termina TLS con su cert y Railway no ve
  el host original → error 526 / cert mismatch.
- El A del apex DEBE ir con **proxy ON (naranja)** para que la
  Redirect Rule del paso 4 pueda interceptar.

### 3. En Arsys — cambiar nameservers

⚠️ Esto **transfiere toda la gestión DNS** del dominio de Arsys a
Cloudflare. Una vez hecho, todos los DNS se editan desde Cloudflare.

1. Panel Arsys → `arenacup26.com` → **Servidores DNS** /
   **Nameservers** / **Editar DNS**.
2. Sustituir los dos NS actuales por los **2 de Cloudflare** del paso 1.4.
3. Guardar.

Propagación 5-30 min (a veces hasta 24h). Cloudflare manda un email
"Your site is now active on Cloudflare" cuando lo detecta.

### 4. En Cloudflare — Single Redirect del apex a www

Cloudflare → tu dominio `arenacup26.com` → menu izquierdo **Rules** →
**Redirect Rules** → **Create rule**.

```
Rule name:      apex-to-www
When incoming requests match:
  Field:        Hostname
  Operator:     equals
  Value:        arenacup26.com
Then:
  Type:         Dynamic
  Expression:   concat("https://www.arenacup26.com", http.request.uri.path)
  Status code:  301
  Preserve query string: ✅ ON
```

**Deploy**.

> Truco del A → `192.0.2.1`: la regla aplica antes de que Cloudflare
> intente alcanzar el origin. La IP nunca se llama de verdad. Si
> alguna vez la regla se desactivara, los visitantes verían un timeout
> (no expone nada porque `192.0.2.0/24` es bloque de test RFC5737).

### 5. Verificar

Cuando llegue el email de Cloudflare ("Your site is now active"):

```bash
# Apex resuelve a IPs de Cloudflare (no a 192.0.2.1, eso es solo el origin)
dig +short arenacup26.com
# → 104.21.x.x  /  172.67.x.x  (rangos Cloudflare)

# www sigue resolviendo a Railway
dig +short CNAME www.arenacup26.com
# → aq4m11ep.up.railway.app.

# admin sigue resolviendo a Railway
dig +short CNAME admin.arenacup26.com
# → w4bklyzw.up.railway.app.

# Apex → 301 a www con cert SSL Cloudflare
curl -I https://arenacup26.com
# HTTP/2 301
# location: https://www.arenacup26.com/

# Path se preserva
curl -I https://arenacup26.com/es/inicio
# HTTP/2 301
# location: https://www.arenacup26.com/es/inicio

# Y www sigue funcionando normal con cert Railway
curl -I https://www.arenacup26.com/
# HTTP/2 307 (redirect normal de la app)
```

## Caveats

- **No actives proxy (naranja) en los CNAME a Railway.** Si lo activas
  Cloudflare termina TLS con su cert y Railway responde 526 / cert
  mismatch.
- **El cert SSL del apex lo emite Cloudflare** (Universal SSL gratis).
  Para `www` y `admin` lo sigue emitiendo Railway (Let's Encrypt).
- Si Railway alguna vez marca `www` o `admin` como "unverified", abre
  el panel Railway y verás los TXT que necesita. Los mete en
  Cloudflare igual que cualquier otro record.
- **Plan Free de Cloudflare** cubre esto al 100%. No expira, sin
  tarjeta. Si algún día revertimos, los NS se devuelven a Arsys con
  el mismo procedimiento al revés.

## Si quieres lo mismo con `arenacup26.es`

Mismo procedimiento, otra zona Cloudflare (gratis soporta N dominios).
Single Redirect Rule: `https://arenacup26.es/*` →
`https://www.arenacup26.com/$1`. Cero slots Railway.
