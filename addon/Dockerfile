FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create /data directory for storage and ensure node user has write permissions
RUN mkdir -p /data && chown -R node:node /data

# Use the node user that already exists in the image (UID 1000)
# Ensure /app is owned by the node user
RUN chown -R node:node /app

USER node

# Expose port (default Stremio addon port)
EXPOSE 1222

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1222/manifest.json', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "bin/addon.js"]

