# Paperboy knowledge-builder — scheduled Cloud Run Job image.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY build-knowledge.js ./
CMD ["node", "build-knowledge.js"]
