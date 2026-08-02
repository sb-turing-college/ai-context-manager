# Stage 1: Builder
# Full Node.js environment to compile TypeScript and bundle with Vite.
# The output is just static HTML/CSS/JS – Node.js is not needed at runtime.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is injected at build time via docker-compose build args.
# Must be the public URL of the server (e.g. http://100.x.x.x for Tailscale).
# Nginx proxies /api/ requests from that origin to the backend container.
ARG VITE_API_URL
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env.production

# Use vite build directly to skip tsc strict checking (test files, unused vars).
# The TypeScript check is a CI concern, not a deployment blocker.
RUN npx vite build


# Stage 2: Runtime
# Minimal Nginx image – serves the static bundle and proxies /api to backend.
FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
