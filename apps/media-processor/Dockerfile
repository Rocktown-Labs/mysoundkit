FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./package.json
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "src/server.mjs"]
