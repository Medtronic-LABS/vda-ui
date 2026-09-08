# Multi-stage Dockerfile for VDA Admin Web Application (vda-ui)
# Stage 1: Build static assets with Vite & TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time environment arguments (can be overridden via docker-compose build args)
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ARG VITE_DEV_DEMO_MODE=true
ARG VITE_DEV_AUTH_TOKEN=vda-pilot-secret-dev-token-2026

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DEV_DEMO_MODE=$VITE_DEV_DEMO_MODE
ENV VITE_DEV_AUTH_TOKEN=$VITE_DEV_AUTH_TOKEN

RUN npm run build

# Stage 2: Serve static production assets with lightweight Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
