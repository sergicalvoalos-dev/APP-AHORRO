# APP-AHORRO

Aplicación para tener tus ahorros en orden: un reto de ahorro (piso, coche o lo que quieras), tus ingresos de cada mes y tu cartera de inversión.

**Dirección:** https://sergicalvoalos-dev.github.io/APP-AHORRO/

## Cómo funciona

- **Panel:** cuánto llevas ahorrado para el reto, la fecha estimada en la que lo conseguirás, cómo vas frente a tu plan, los hitos, tu capital total y tu cartera.
- **Ingresos:** una ficha por mes con sueldo, dietas, sobrante, retiros de trading y dinero extra. Lo que toca apartar se calcula solo con tu reparto. Los cambios no cuentan hasta que pulsas «Guardar».
- **Cartera:** tus activos con sus compras y ventas, y el precio de cada uno, que apuntas a mano.
- **Perfil:** el reto (nombre, objetivo, con cuánto empiezas y sueldo base), el reparto del sueldo y la copia de seguridad.

En el ordenador se puede editar todo. En el móvil la app es **solo de consulta**.

## Dónde se guardan los datos

Los datos se guardan en Firebase (Cloud Firestore), en el documento `usuarios/<tu id de usuario>`, al que solo puede acceder tu cuenta de Google. **En este repositorio no hay ningún dato tuyo**, solo el código. La configuración de Firebase que aparece en `firebase.js` no es secreta: es la que usa cualquier web para conectarse; lo que protege los datos son las reglas de `firestore.rules`.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura y estilos de la app |
| `app.js` | Toda la lógica: cálculos, pantallas, modo consulta, copia de seguridad |
| `firebase.js` | Inicio de sesión con Google y guardado en Firestore |
| `firestore.rules` | Reglas de seguridad que hay que pegar en Firestore → Reglas |
| `sw.js`, `manifest.webmanifest`, `icons/` | Para instalar la app y abrirla sin conexión |

## Configuración (solo una vez)

1. **Firebase → Authentication → Método de inicio de sesión:** Google activado.
2. **Firebase → Authentication → Configuración → Dominios autorizados:** añadir `sergicalvoalos-dev.github.io`.
3. **Firebase → Firestore Database → Reglas:** pegar el contenido de `firestore.rules` y publicar.
4. **GitHub → Settings → Pages:** «Deploy from a branch», rama `main`, carpeta `/ (root)`.

## Instalarla

- **Ordenador (Chrome o Edge):** abre la dirección y pulsa el icono de instalar de la barra de direcciones.
- **Android (Chrome):** menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».
- **iPhone (Safari):** botón Compartir → «Añadir a pantalla de inicio».

## Cambios en la app

Cualquier cambio que se suba a la rama `main` se publica solo en unos minutos. Después de una actualización, recarga la app para ver la versión nueva.
