FROM node:22-bookworm AS deps

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY client/package*.json ./client/
RUN cd client && npm ci

FROM deps AS build

ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

COPY backend ./backend
COPY client ./client

RUN cd backend && npm run build
RUN cd client && npm run build

FROM node:22-bookworm AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/backend ./backend
COPY --from=build /app/client ./client

EXPOSE 3000 4173

CMD ["sh", "-c", "cd /app/backend && npm run db:migrate && npm run start & cd /app/client && npm run preview -- --host 0.0.0.0 --port 4173"]
