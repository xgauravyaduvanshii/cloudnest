# CloudNest Client

React + Vite dashboard for CloudNest. It includes the landing page, auth pages,
file manager, storage account pages, admin panel, API key screens, and SDK docs.

## SDK Package Name

Use the official npm package:

```bash
npm install @cloudnest/sdk
```

Do not install similarly named packages. The published SDK import is:

```ts
import { CloudNestClient } from "@cloudnest/sdk";
```

## Local Development

```bash
npm install
npm run dev
```

The client expects the backend API URL in `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

## Build

```bash
npm run build
```
