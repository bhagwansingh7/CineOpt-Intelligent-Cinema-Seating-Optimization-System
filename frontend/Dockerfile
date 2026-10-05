FROM node:20-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Vite bakes VITE_* variables into the bundle at build time
ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_CURRENCY=$

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CURRENCY=$VITE_CURRENCY

RUN npm run build


FROM node:20-slim

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN npm install -g serve

RUN chown -R node:node /app

USER node

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["serve", "-s", "dist", "-l", "5173"]