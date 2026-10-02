FROM node:20-alpine
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 5000
CMD ["node", "src/index.js"]
