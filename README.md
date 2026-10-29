# Rule34 - Plugin de Agregación de Medios para Kino

Plugin de agregación y reproducción de video desde plataformas de catálogo visual (Boorus). Desarrollado para fines estrictamente educativos y demostrativos bajo el entorno sandbox QuickJS de la aplicación Kino.

> ⚠️ **CONTENIDO NO APTO PARA SENSIBLES (+18)**  
> Este plugin agrega fuentes de video de la comunidad que pueden incluir material poco apropiado. Al instalar, aceptas ser mayor de edad y asumes total responsabilidad por el contenido que decidas visualizar. Este proyecto es con fines educativos y de ficción. No nos hacemos responsables. Sección 230.

---

## 📁 Estructura del Proyecto

```text
videobooru/
├── kino-plugin.json    # Manifiesto de metadatos, permisos y dominios
├── plugin.js           # Lógica ES Module (search, home, resolve)
├── icon.png            # Icono del plugin (128x128 PNG)
├── kino.d.ts           # Definiciones TypeScript de la API de Kino
└── README.md           # Guía de configuración y pruebas
```

---

## 🛠️ Cómo agregar tus propios sitios (Boorus / CDNs)

El plugin está estructurado para que agregues tus propios hosts y dominios en dos lugares clave:

### 1. `kino-plugin.json` (Permisos de red)
Kino exige que todos los dominios a los que el plugin realiza peticiones HTTP estén declarados en el array `hosts`:

```json
"hosts": [
  "safebooru.org",
  "danbooru.org",
  "tu-booru-personal.com",
  "*.tu-cdn-de-videos.com"
]
```
*(Se admiten comodines `*.dominio.com` para CDNs distribuidos).*

### 2. `plugin.js` (Lógica de consulta)
Busca la constante `BOORU_HOSTS` al inicio del archivo:

```javascript
// TODO: [inserta sitios web] Reemplazar con la lista final de dominios
export const BOORU_HOSTS = [
  "tu-booru-1.com",
  "tu-booru-2.org"
];
```

El agregador consultará concurrentemente los endpoints REST estándar de cada host sin bloquear la búsqueda si alguno se encuentra caído o no responde.

---

## 🧪 Pruebas Locales (Sin publicar en GitHub)

Puedes probar y validar el plugin sin subirlo a ningún repositorio:

1. **Validación formal con el SDK de Kino:**
   ```bash
   node /home/usuario/kino-plugin-frikiseries/sdk/validate.mjs /home/usuario/videobooru
   ```

2. **Carga directa en Kino AppImage:**
   - Abre Kino TV.
   - Ve a **Ajustes > Plugins**.
   - Puedes instalar plugins locales apuntando a la ruta del directorio o mediante un servidor local temporal (`python3 -m http.server 8080`).

---

## 🔒 Privacidad y Publicación Futura (Incógnito)

Cuando decidas subirlo a tu cuenta de GitHub:
- **Mantener repositorio Privado** o sin etiquetas públicas.
- **NO agregues el topic `kino-plugin`** en GitHub para evitar que aparezca en el buscador público de la comunidad de Kino.
- Puedes instalarlo en tu cliente de Kino usando tu URL de GitHub cruda (`raw.githubusercontent.com/.../kino-plugin.json`) o repositorio directo.
