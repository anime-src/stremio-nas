# Build stage
FROM node:lts-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy TypeScript source files and config
COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:lts-alpine

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
# Install cifs-utils and keyutils for SMB/UNC path mounting
# Note: smbclient is not available in Alpine, but cifs-utils provides mount.cifs which is sufficient
RUN apk add --no-cache python3 make g++ cifs-utils keyutils

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy built JavaScript files from builder stage
COPY --from=builder /app/dist ./dist

# Create storage directory and network mount directory
# Note: Network mounts require root privileges (CAP_SYS_ADMIN capability)
# The /mnt/network directory will be created, but mounting requires root
# Users can either: 1) Run container as root, or 2) Add CAP_SYS_ADMIN capability
RUN mkdir -p /app/storage /mnt/network && chown -R node:node /app && chmod 777 /mnt/network && chmod 777 /mnt

# Note: For network mounting to work, container must run as root
# CIFS mounting requires root privileges even with CAP_SYS_ADMIN
# Running as root is required for mount command to work
USER root

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application (now runs from dist/index.js)
CMD ["node", "dist/index.js"]
