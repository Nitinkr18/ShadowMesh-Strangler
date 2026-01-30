FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "server.js"]
