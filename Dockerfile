# check=skip=SecretsUsedInArgOrEnv
# DevOps level 3: one pinned toolchain for laptops, CI and the server (DEVOPS.md).
# Same versions as CI: Node 22 runs everything, bun only installs root packages, Java 21 runs the Firebase emulators.
#
#   docker build --target site -t stoodant-site .          # typecheck, unit tests, build, 150 KB budget, then nginx
#   docker run --rm -p 8080:8080 stoodant-site             # the built site on http://localhost:8080
#   docker build --target backend-test .                    # functions typecheck + emulator tests
#
# Versions are pinned here on purpose; bump them in one place (and in package.json engines) together.
FROM oven/bun:1.4.4 AS bun
FROM eclipse-temurin:21-jre AS java

FROM node:22-bookworm-slim AS toolchain
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH \
    CI=true
WORKDIR /app

# Dependencies first, so a code-only change reuses this layer.
FROM toolchain AS deps
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY functions/package.json functions/package-lock.json functions/
RUN npm ci --prefix functions

FROM deps AS build
COPY . .
# Public web settings (not secrets). Left empty, the demo form shows its offline fallback.
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_RECAPTCHA_SITE_KEY=""
ARG VITE_LEAD_ENDPOINT=""
RUN npx tsc --noEmit \
 && npx vitest run \
 && npx vite build \
 && node scripts/check-bundle.mjs --strict

FROM build AS backend-test
RUN cd functions && npm run typecheck && npm test

# Serves dist/client the way Vercel and Firebase Hosting do: clean URLs, 404.html, long cache on hashed assets.
FROM nginx:1.29-alpine AS site
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/client /usr/share/nginx/html
EXPOSE 8080
