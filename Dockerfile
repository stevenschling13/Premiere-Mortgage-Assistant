FROM node:20-alpine AS builder

WORKDIR /app

# Pass API key values at build time so Vite can inline them for the client bundle
# These are optional; leave unset if you prefer to provide the key through other means.
ARG VITE_API_KEY
ARG API_KEY
ENV VITE_API_KEY=${VITE_API_KEY}
ENV API_KEY=${API_KEY}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the production bundle (type-checks via tsc first)
RUN npm run build

FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

# Clean default assets and copy built files
RUN rm -rf ./*
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod -R 755 /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
