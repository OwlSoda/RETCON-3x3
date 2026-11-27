# Stage 1: Build production bundle
FROM node:22-alpine AS build

WORKDIR /app

# Copy dependency manifests and install clean dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with lightweight Nginx Alpine
FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/OwlSoda/RETCON-3x3"
LABEL org.opencontainers.image.description="Minimalist, high-performance 3x3 grid and moodboard creator"
LABEL org.opencontainers.image.licenses="MIT"

# Copy hardened SPA Nginx configuration and security headers
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
