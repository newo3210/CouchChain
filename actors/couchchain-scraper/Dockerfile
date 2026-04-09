# Build en Apify con carpeta del repo: actors/couchchain-scraper
FROM apify/actor-node:22

COPY package.json package-lock.json ./
RUN npm --quiet set progress=false \
    && npm ci --omit=dev \
    && echo "NPM packages:" && (npm list --depth=0 || true)

COPY . ./

CMD ["npm", "start"]
