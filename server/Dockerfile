# Use Bun base image
FROM oven/bun:debian

WORKDIR /app

# Install build dependencies for native modules (if needed for other packages)
# Install cifs-utils and keyutils for SMB/UNC path mounting
# Note: smbclient is not available in Debian, but cifs-utils provides mount.cifs which is sufficient
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    cifs-utils \
    keyutils \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and lockfile
COPY package*.json ./
COPY bun.lock* ./

# Install dependencies (Bun runs TypeScript directly, no build step needed)
RUN bun install --production --frozen-lockfile

# Copy TypeScript source files and config
COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src

# Create storage directory and network mount directory
# Note: Network mounts require root privileges (CAP_SYS_ADMIN capability)
# The /mnt/network directory will be created, but mounting requires root
# Users can either: 1) Run container as root, or 2) Add CAP_SYS_ADMIN capability
RUN mkdir -p /app/storage /mnt/network && chmod 777 /mnt/network && chmod 777 /mnt

# Note: For network mounting to work, container must run as root
# CIFS mounting requires root privileges even with CAP_SYS_ADMIN
# Running as root is required for mount command to work
USER root

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the application (Bun runs TypeScript directly)
CMD ["bun", "run", "src/index.ts"]
