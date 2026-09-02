# Ohmni — Agent-Native Hardware Diagnostic Workbench

> A remote MCP server can reach your cloud. WebMCP can reach the device on your desk.

## Architecture & Project Structure

- **Domain Core**: `src/domain/device/` — `DeviceAdapter`, `VirtualDeviceAdapter`, capabilities, deterministic brownout physics.
- **Contract Tests**: `tests/contracts/` — Reusable behavioral contract for all adapter implementations.
- **Regression Suite**: `tests/regression/` — Permanent golden-path verification tests.
- **Deployment**: Configured for **Vercel** (Vite SPA production build).

## Verification Gate

Before accepting any milestone or merging changes:

```bash
bun run verify
```

This single command executes:
1. Full test suite (`bun test`)
2. Strict TypeScript type check (`tsc --noEmit`)
3. Production Vite build (`vite build`)

## Deployment

- **Provider**: Vercel
- **Build Command**: `bun run build`
- **Output Directory**: `dist`
- **Smoke Testing**:

```bash
bun run smoke -- https://<deployment-url>.vercel.app
```
