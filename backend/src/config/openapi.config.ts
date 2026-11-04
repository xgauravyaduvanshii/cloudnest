/**
 * A hand-maintained OpenAPI 3 document for the public v1 API. Kept in code (no
 * swagger dependencies) and served as JSON + a lightweight Swagger UI page.
 * Auth: API keys (`sk_live_...`) via `Authorization: Bearer`, with scopes enforced
 * per-operation. The AI surface (/api/ai/*) is internal/JWT-only and intentionally
 * excluded from this public contract.
 */
import { Env } from './env.config';
import { WEBHOOK_EVENTS, ALL_SCOPES } from '../constant/scopes';

const base = Env.BASE_PATH;

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CloudNest API',
    version: '1.0.0',
    description:
      'Reliable, AI-powered cloud storage and asset management. Public v1 endpoints are ' +
      'API-key authenticated and scope-guarded.',
  },
  servers: [{ url: Env.API_PUBLIC_URL || '', description: 'Current host' }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'API key of the form sk_live_... issued from the dashboard.',
      },
    },
    schemas: {
      File: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'uuid' },
          originalName: { type: 'string' },
          mimeType: { type: 'string' },
          size: { type: 'integer' },
          formattedSize: { type: 'string' },
          provider: { type: 'string' },
          url: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          errorCode: { type: 'integer' },
          statusCode: { type: 'integer' },
        },
      },
    },
  },
  security: [{ apiKey: [] }],
  paths: {
    [`${base}/v1/files`]: {
      get: {
        summary: 'List files',
        'x-required-scope': 'files:read',
        tags: ['Files'],
        responses: {
          '200': { description: 'A page of files' },
          '403': { description: 'Missing scope', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        summary: 'Upload files',
        'x-required-scope': 'files:write',
        tags: ['Files'],
        responses: { '201': { description: 'Uploaded' } },
      },
    },
    [`${base}/v1/files/{fileId}`]: {
      get: { summary: 'Get a file', 'x-required-scope': 'files:read', tags: ['Files'], parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'File' } } },
      delete: { summary: 'Delete a file', 'x-required-scope': 'files:write', tags: ['Files'], parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deleted' } } },
    },
    [`${base}/v1/upload-jobs`]: {
      get: { summary: 'List upload jobs', 'x-required-scope': 'files:read', tags: ['Upload Jobs'], responses: { '200': { description: 'Jobs' } } },
      post: { summary: 'Create an upload job', 'x-required-scope': 'upload:write', tags: ['Upload Jobs'], responses: { '202': { description: 'Accepted' } } },
    },
    [`${base}/v1/upload-jobs/{jobId}/progress`]: {
      get: { summary: 'Job progress', 'x-required-scope': 'files:read', tags: ['Upload Jobs'], parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Progress' } } },
    },
    [`${base}/share/{token}`]: {
      get: { summary: 'Resolve a public share (anonymous)', tags: ['Sharing'], security: [], parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Share contents' }, '403': { description: 'Password required / expired' } } },
    },
  },
  'x-scopes': ALL_SCOPES,
  'x-webhook-events': WEBHOOK_EVENTS,
};

/** Minimal Swagger UI page rendered from a CDN — no server dependency required. */
export const swaggerHtml = (specUrl: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CloudNest API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () =>
        window.SwaggerUIBundle({ url: '${specUrl}', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>`;
