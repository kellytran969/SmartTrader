FROM node:20-alpine AS build
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /srv/dist /usr/share/nginx/html
EXPOSE 80
