# Arquitectura

## Tres capas y dirección de dependencias

1. **Presentación** (`apps/web`): páginas, componentes específicos del producto y adaptadores HTTP. Cada Route Handler valida entradas, obtiene la identidad autenticada, invoca un caso de uso y convierte su resultado a un DTO y estado HTTP. No contiene reglas de negocio ni llamadas directas a proveedores.
2. **Negocio** (`packages/core`): entidades, reglas, casos de uso y puertos (interfaces para persistencia, servicios externos y blockchain). Sin imports de Next.js, React, ORM ni SDK externos. Organizar por funcionalidad cuando aparezcan: `features/<feature>/domain`, `application` y `ports`.
3. **Infraestructura** (`packages/infrastructure`): implementa los puertos; contiene los repositorios y adaptadores de proveedores/RPC. Depende de negocio; negocio nunca depende de infraestructura.

El flujo en ejecución es HTTP → caso de uso → adaptador. La dependencia del código se invierte mediante interfaces: presentación → negocio ← infraestructura. `apps/web/src/server/container.ts` es el único punto que selecciona y conecta implementaciones; está protegido con `server-only`. Las reglas de ESLint impiden imports directos de negocio/infraestructura en presentación y dependencias de framework en negocio. La comprobación de Next.js impide importar el contenedor desde un Client Component.

`api-schema` contiene exclusivamente contratos HTTP públicos. `ui` no conoce casos de uso, autenticación, wallets ni proveedores. Usar subrutas públicas y componentes cliente pequeños cuando haga falta interactividad; no convertir toda la biblioteca a cliente.

## Next.js

App Router, Server Components por defecto y Route Handlers con runtime Node.js. Los Server Components pueden invocar la fachada del servidor directamente: no necesitan llamar por HTTP a su propia API. Los clientes y consumidores externos usan `/api/v1/*`. Los casos de uso nunca reciben `NextRequest`, cookies ni sesiones del framework: reciben datos e identidad verificada.

Para operaciones de negocio se añadirá validación runtime de entradas y salidas externas, autorización en cada caso de uso, errores tipados y un mapeador HTTP común. Nunca devolver detalles internos de excepciones. Definir explícitamente la caché por endpoint; el health actual devuelve `no-store`.

## Servicios externos

Crear un puerto por capacidad de negocio cuando se conozca, por ejemplo `PaymentGateway`, y un adaptador concreto después de elegir el servicio. Evitar una abstracción genérica para todos los proveedores. Configuración y secretos permanecen en servidor; únicamente datos públicos pueden usar `NEXT_PUBLIC_*`.

Cada adaptador debe tener timeout, validación de respuesta y errores normalizados. Reintentar solo operaciones seguras o con clave de idempotencia. Para webhooks, verificar firma sobre el cuerpo original y deduplicar eventos. Las tareas largas e indexadores requieren un worker separado cuando existan; no deben ejecutarse indefinidamente dentro de una petición Next.js.

## On-chain

`contracts` es el origen de los contratos Solidity. Al añadirlos, generar ABI a partir de los artefactos del compilador hacia `packages/chain`; no copiar ABI manualmente. Registrar direcciones y bloque de despliegue por chain ID y versión. El paquete público no incluye claves privadas ni credenciales RPC.

Las lecturas server-side se hacen mediante un adaptador que implementa los puertos de negocio. La conexión de wallet y firma del usuario pertenece al frontend y nunca exige enviar su clave al backend. La firma operativa del servidor, si el producto la necesita, exige un diseño explícito de custodia y permisos.

Una transacción enviada no equivale a una operación finalizada. Cuando se implemente escritura, modelar estados pendiente/confirmada/fallida, confirmaciones según la red, reemplazos y reorganizaciones. Deduplicar eventos por red, hash de transacción e índice de log. No asumir atomicidad entre almacenamiento off-chain y blockchain: usar estados persistentes e idempotencia/reconciliación cuando aparezcan esas operaciones.

La red, contratos, reglas de autorización, política de confirmaciones y servicios externos todavía no están definidos. No se han instalado SDK ni provisionado proveedores.

## Extracción futura

Crear `apps/api` cuando sea necesario. Esta nueva aplicación consume los mismos paquetes `core`, `infrastructure` y `api-schema`, implementa su contenedor y expone el mismo contrato `/api/v1`. Next.js puede mantener una fachada o pasar a consumir el backend por HTTP. Los casos de uso permanecen intactos; habrá que adaptar el transporte, sesiones, configuración y despliegue. No crear ahora un proceso adicional solo para simular esta migración.

Los paquetes TypeScript se consumen desde sus fuentes y Next.js los transpila. Un backend futuro que ejecute Node directamente necesitará compilar sus dependencias o usar un bundler.

## Validación

Turborepo coordina compilación y comprobación de tipos. ESLint verifica convenciones y límites de imports. Hay una prueba pequeña que verifica el caso de uso con un reloj inyectado. Añadir pruebas de reglas de dominio y contratos de adaptadores conforme aparezca negocio real. Para Solidity, ejecutar pruebas unitarias, fuzzing e invariantes antes de cualquier despliegue; los directorios actuales están vacíos.

Referencias: [Next.js backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [paquetes internos Turborepo](https://turborepo.dev/docs/core-concepts/internal-packages).
