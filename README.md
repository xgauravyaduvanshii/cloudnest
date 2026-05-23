# CloudNest

CloudNest is an educational cloud storage platform built with an Express/Postgres backend, a React client, and a TypeScript SDK. It demonstrates multi-provider file storage with AWS S3, Google Drive, and Telegram user-session storage, plus admin controls for users, storage providers, API keys, folders, previews, and provider settings.

> Important: this project is for educational, learning, demo, and experimentation purposes only. It is not production-ready and must not be used as-is for production workloads, real customer data, sensitive files, or commercial storage services.

## Educational Use Only

CloudNest is intentionally provided as a learning project. Before any real-world or production use, it would require a full security review, provider policy review, legal review, privacy review, monitoring, backups, rate limiting, abuse prevention, secret rotation, hardened deployment, and operational testing.

Do not treat this repository as a finished SaaS product.

## Features

- Multi-provider storage abstraction for AWS S3, Google Drive, and Telegram.
- User-owned and admin-shared storage accounts.
- Google Drive OAuth connection, folder browsing, upload, preview, move, and delete.
- Telegram user-session storage flow using GramJS-style sessions.
- Admin panel for users, files, providers, API keys, settings, and storage accounts.
- Provider enable/disable controls.
- File folders, previews, downloads, and delete/move actions.
- Public landing pages, SDK docs, help, privacy, terms, contact, security, and about pages.
- TypeScript SDK package: `@cloudnest/sdk`.

## Tech Stack

- Backend: Node.js, Express, TypeScript, PostgreSQL.
- Client: React, Vite, TypeScript, Tailwind CSS.
- SDK: TypeScript, tsup.
- Storage providers: AWS S3, Google Drive API, Telegram sessions.

## Repository Structure

```text
FileStorage/
  backend/   Express API, Postgres migrations, provider services
  client/    React web app and public landing pages
  sdk/       TypeScript CloudNest SDK
  Dockerfile
```

## Requirements

- Node.js 18+
- npm
- PostgreSQL
- Provider credentials if testing external storage:
  - AWS S3 credentials
  - Google OAuth client credentials
  - Telegram API ID and API hash

## Environment Setup

Copy the example env files:

```bash
cp backend/.env.example backend/.env
cp client/.env.example client/.env
```

Important backend variables:

```env
DATABASE_URL=postgresql://filestorage_user:filestorage_password@localhost:5432/filestorage
JWT_SECRET=replace_me
ENCRYPTION_KEY=replace_with_32_plus_random_characters
ADMIN_EMAIL=demo@example.com

AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/storage-accounts/google/callback

TELEGRAM_API_ID=
TELEGRAM_API_HASH=
```

Important client variable:

```env
VITE_API_URL=http://localhost:3000/api
```

## Local Development

Install dependencies:

```bash
cd backend
npm install

cd ../client
npm install

cd ../sdk
npm install
```

Run database migrations and seed data:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

Start the backend:

```bash
cd backend
npm run dev
```

Start the client:

```bash
cd client
npm run dev
```

Default local URLs:

- Client: `http://localhost:5173`
- Backend: `http://localhost:3000`
- API base: `http://localhost:3000/api`

Default seed user depends on `backend/.env`; the example uses:

```text
demo@example.com
password123
```

## Build

Backend:

```bash
cd backend
npm run build
npm run start
```

Client:

```bash
cd client
npm run build
```

SDK:

```bash
cd sdk
npm run build
```

## SDK Example

```ts
import { CloudNestClient } from "@cloudnest/sdk";

const client = new CloudNestClient({
  apiKey: process.env.CLOUDNEST_API_KEY!,
});

await client.uploadFiles(files, {
  provider: "GOOGLE_DRIVE",
});
```

Supported providers:

```ts
"S3" | "GOOGLE_DRIVE" | "TELEGRAM"
```

## Provider Notes

Google Drive:

- Enable Google Drive API in Google Cloud Console.
- Configure OAuth consent screen.
- Use a web OAuth client.
- Set the redirect URI to match `GOOGLE_REDIRECT_URI`.

Telegram:

- Create an app at `my.telegram.org`.
- Use API ID and API hash.
- Login uses user sessions, not Bot API storage.

AWS S3:

- Configure bucket, region, access key, and secret key.
- In this educational project, S3 can be used as the default admin-shared provider.

## Security Warning

This repository includes concepts such as encrypted credentials, JWT auth, API keys, provider sessions, and admin controls, but it is not a complete security implementation.

Before real deployment, at minimum review and harden:

- Authentication and session policy.
- Authorization checks.
- API key hashing and rotation.
- Rate limiting and abuse prevention.
- CSRF/CORS/headers.
- Upload scanning and file type validation.
- Secrets management.
- Database backups and migrations.
- Logging and audit retention.
- Provider terms and OAuth verification requirements.
- Privacy and data deletion workflows.

## License

This project is licensed under the CloudNest Educational Use License. See [LICENSE](./LICENSE).

In short: you may use, study, copy, and modify this project for educational and demo purposes, but you may not use it as-is in production or as a commercial storage service.

