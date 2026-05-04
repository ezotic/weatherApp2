---
description: "Use when writing or editing Dockerfiles, docker-compose.yml, or any deployment configuration. Covers image choices, secrets handling, service structure, and build best practices."
applyTo: "**/Dockerfile,**/docker-compose*.yml,**/.dockerignore"
---
# Docker & Deployment Conventions

## Image Tags
- Always use pinned, specific tags — never `latest` (e.g., `node:20-alpine`, `nginx:1.27-alpine`, `redis:7-alpine`)
- Prefer `-alpine` variants to keep images small and reduce attack surface

## Dockerfile Best Practices
- Copy only what the service needs — avoid `COPY . .` unless scoped with a `.dockerignore`
- For Node.js services: run `npm install --omit=dev` to exclude dev dependencies from production images
- Set a `WORKDIR` explicitly; never rely on the image default
- `EXPOSE` only the port the service actually listens on
- Use `CMD` (not `ENTRYPOINT`) for the start command unless wrapping with a shell script

## Secrets & Environment Variables
- Never hardcode secrets (API keys, passwords, tokens) in Dockerfiles or `docker-compose.yml`
- Pass sensitive values via environment variables referenced from a `.env` file (e.g., `${OPENWEATHER_API_KEY}`)
- Provide safe defaults for non-sensitive config (e.g., `${CACHE_TTL_SECONDS:-600}`)
- Ensure `.env` is listed in `.gitignore`

## docker-compose Structure
- Name services clearly and consistently (`web`, `api`, `redis`)
- Use `depends_on` to declare explicit startup order between services
- Keep service-level `environment` blocks in `docker-compose.yml`; keep secret values in `.env`
- Use internal service names for inter-service URLs (e.g., `redis://redis:6379`, not `localhost`)
- Bind only required ports to the host; internal services should not expose ports unless needed

## Multi-Service Layout
- Each service has its own `Dockerfile` co-located with its source (e.g., `server/Dockerfile`)
- The root `Dockerfile` is for the frontend/static server (nginx)
- The `docker-compose.yml` at the root orchestrates all services

## Redis
- Disable persistence for ephemeral cache usage: `command: ["redis-server", "--save", "", "--appendonly", "no"]`
- Do not expose Redis ports to the host in production
