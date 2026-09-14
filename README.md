# Pickler

Monorepo con npm workspaces, Turborepo, Next.js App Router y TypeScript estricto.

## Desarrollo

Node 22 o superior y npm 10.9.3. Desde la raíz:

```sh
npm install
npm run dev
```

Web: http://localhost:3000. Endpoint de liveness: `/api/v1/health`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Organización

```text
apps/web/src/
  app/                      # Presentación: páginas y Route Handlers
    api/v1/health/route.ts
  server/container.ts       # Composición e inyección; server-only
packages/
  core/src/                 # Negocio: dominio, casos de uso e interfaces
  infrastructure/src/       # Adaptadores: reloj; futuros repositorios/API/RPC
  api-schema/src/           # DTO públicos serializables
  ui/src/                   # Componentes React independientes del producto
  chain/src/                # Tipos públicos; futuros ABI y despliegues por red
  typescript-config/        # Configuración compartida
contracts/                  # Proyecto Foundry independiente
  src/                      # Solidity
  test/                     # Pruebas, fuzzing e invariantes
  script/                   # Scripts de despliegue
```

La implementación inicial conecta un Route Handler con un caso de uso y un reloj real inyectado. `health` comprueba que la aplicación responde; no comprueba servicios externos. No hay todavía proveedores conectados, base de datos, wallet ni contratos de negocio. El contrato HTTP inicial se expresa en TypeScript; las entradas futuras necesitan validación en runtime.

Ver [decisiones de arquitectura](docs/architecture.md).

## Solidity

Se incluye la estructura y configuración de Foundry. No hay contratos hasta definir sus reglas, permisos y red de destino. Los comandos siguientes requieren Foundry instalado:

```sh
npm run contracts:build
npm run contracts:test
```

Los despliegues on-chain se ejecutan explícitamente, nunca como efecto de `build`. Solidity tiene su propia cadena de compilación; los comandos de contratos son independientes de las tareas de la web.
