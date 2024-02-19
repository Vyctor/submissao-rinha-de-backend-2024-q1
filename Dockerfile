# Stage 1: Build the application
FROM node:21 as builder

WORKDIR /app
# Copy only package.json and package-lock.json to utilize Docker cache better
COPY package*.json ./
RUN npm install
# Copy the rest of the application source code and build the app
COPY . .
RUN npm run build

# Stage 2: Create a lightweight production image
FROM node:21-alpine
WORKDIR /app
# Use a non-root user for better security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
# Start Application
CMD ["node", "dist/main.js"]
