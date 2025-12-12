# Stremio NAS Add-on

A Stremio add-on that connects to the Stremio NAS API server to list and stream video files. The add-on does NOT access the filesystem directly - all file operations happen through the HTTP API.

## Features

- **API-Based**: Connects to Stremio NAS API Server instead of scanning local filesystem
- **HTTP Streaming**: Streams videos via HTTP URLs with Range support for seeking (ID-based URLs)
- **IMDB Matching**: Only indexes files with IMDB IDs (matching original addon behavior)
- **Rich Metadata**: Displays resolution, codec, source, release group, and file size in stream titles
- **Periodic Polling**: Automatically refreshes file index from API server at configurable intervals
- **Hybrid Index + On-Demand**: Lightweight in-memory index (~50 bytes per file) with on-demand fetching of full details
- **LRU Caching**: Caches frequently accessed file details and metadata for fast access
- **Scalable**: Handles 100K+ files with minimal memory footprint (~5MB for 100K files)
- **Structured Logging**: Winston-based logging with configurable log levels
- **Docker Ready**: Can run in Docker containers
- **No Filesystem Access**: Completely network-based, no SMB/NFS/local filesystem access

## Architecture

```
┌─────────────────┐         HTTP API          ┌──────────────────┐
│  Stremio Add-on │ ────────────────────────> │  Stremio NAS API │
│  (This Add-on)  │ <──────────────────────── │  (Docker)        │
└─────────────────┘      JSON + Streams       └──────────────────┘
```

## Prerequisites

1. **Stremio NAS API Server** running (see `../server/README.md`)
2. **Node.js** installed (v14 or higher) OR **Docker/Podman**
3. **Stremio** desktop application

## Installation

### Option 1: Docker (Recommended)

1. **Configure the API URL**:
   Edit `docker-compose.yml` (in project root) and set environment variables:
   ```yaml
   environment:
     # Internal URL: Addon connects to API server
     - API_INTERNAL_URL=http://stremio-nas-api:3000  # Use Docker service name
     
     # External URL: Stremio uses this to stream videos
     - STREAM_BASE_URL=http://localhost:3001  # Use your NAS IP here
     
     # Polling configuration
     - POLL_INTERVAL_MINUTES=5  # Poll every 5 minutes
     - ENABLE_POLLING=true       # Enable automatic updates
   ```

2. **Build and start**:
   ```bash
   cd addon
   docker compose up -d
   # or with podman:
   podman compose up -d
   ```

3. **Check logs**:
   ```bash
   docker compose logs -f
   # or with podman:
   podman compose logs -f
   ```

4. **Add to Stremio**:
   - Open Stremio
   - Go to Addons → Add Addon
   - Enter: `http://localhost:1222/manifest.json`
   - Click Install

### Option 2: Local Node.js

1. **Clone or download** this addon:
   ```bash
   cd addon
   npm install
   ```

2. **Configure environment variables**:
   Set the API URLs and polling configuration:
   ```bash
   export API_INTERNAL_URL=http://your-server-ip:3000
   export STREAM_BASE_URL=http://your-server-ip:3001
   export POLL_INTERVAL_MINUTES=5
   export ENABLE_POLLING=true
   ```
   
   Or on Windows:
   ```cmd
   set API_INTERNAL_URL=http://your-server-ip:3000
   set STREAM_BASE_URL=http://your-server-ip:3001
   set POLL_INTERVAL_MINUTES=5
   set ENABLE_POLLING=true
   ```

3. **Start the addon**:
   ```bash
   npm start
   ```
   
   The addon will start on port 1222 (or the port specified in `PORT` environment variable).

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_INTERNAL_URL` | `http://localhost:3000` | Internal URL for addon to fetch files from API server (use Docker service name or external URL). Also accepts `MEDIA_API_URL` for backward compatibility. |
| `STREAM_BASE_URL` | `http://localhost:3001` | External base URL for stream URLs that Stremio will use to play videos (must be accessible from Stremio). Also accepts `API_HOST` for backward compatibility. |
| `PORT` | `1222` | Port for the Stremio addon HTTP server |
| `LOG_LEVEL` | `debug` | Logging level: `error`, `warn`, `info`, `debug` |
| `POLL_INTERVAL_MINUTES` | `5` | Interval to poll API for file updates (in minutes) |
| `ENABLE_POLLING` | `true` | Set to `false` to disable periodic polling (only indexes on startup) |
| `MAX_INDEXED` | `10000` | Maximum number of files to index in memory (safety limit) |

### Docker Compose Configuration

The `docker-compose.yml` file includes:
- Port mapping: `1222:1222`
- Network configuration for connecting to `stremio-nas-api` service
- In-memory storage (no persistence needed - data rebuilt from API on startup)

### Example Configuration

For a server at IP `192.168.1.100` with API on port 3001:

**Docker (in docker-compose.yml):**
```yaml
environment:
  - API_INTERNAL_URL=http://stremio-nas-api:3000  # Internal Docker network
  - STREAM_BASE_URL=http://192.168.1.100:3001     # External URL for Stremio
  - PORT=1222
  - POLL_INTERVAL_MINUTES=5                        # Poll every 5 minutes
  - ENABLE_POLLING=true                            # Enable automatic updates
  - LOG_LEVEL=debug
```

**Local Node.js:**
```bash
export API_INTERNAL_URL=http://192.168.1.100:3001
export STREAM_BASE_URL=http://192.168.1.100:3001
export PORT=1222
export POLL_INTERVAL_MINUTES=5
npm start
```

## Running Both Services Together

You can run both the Stremio NAS API server and the Stremio addon together using Docker Compose. The `docker-compose.yml` file is already in the project root:

```yaml
version: '3.8'

services:
  stremio-nas-api:
    build: ./server
    container_name: stremio-nas-api
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - PORT=3000
      - MEDIA_DIR=/data/videos
      - ALLOWED_EXTENSIONS=.mp4,.mkv,.avi
      - API_HOST=http://localhost:3001
      - LOG_LEVEL=info
    volumes:
      - /volume1/video:/data/videos:ro
    networks:
      - media-network

  stremio-nas-addon:
    build: ./addon
    container_name: stremio-nas-addon
    restart: unless-stopped
    ports:
      - "1222:1222"
    environment:
      # Internal URL for fetching files
      - API_INTERNAL_URL=http://stremio-nas-api:3000
      
      # External URL for streaming (use your NAS IP)
      - STREAM_BASE_URL=http://localhost:3001
      
      # Polling configuration
      - POLL_INTERVAL_MINUTES=5
      - ENABLE_POLLING=true
      
      # Server config
      - PORT=1222
      - LOG_LEVEL=debug
    networks:
      - media-network
    depends_on:
      - stremio-nas-api

networks:
  media-network:
    driver: bridge
```

## How It Works

1. **Initial File Discovery**: On startup, the addon calls `GET /files` on the Stremio NAS API to retrieve video files with metadata
2. **IMDB Filtering**: Only files with IMDB IDs are indexed (matching original addon behavior)
3. **Lightweight Indexing**: Files are indexed in memory (~50 bytes per file) with pre-aggregation by IMDB ID
4. **Periodic Polling**: Every N minutes (configurable), the addon polls the API for updates and incrementally updates the index
5. **Catalog Generation**: Each IMDB ID becomes a catalog item using lightweight index data (fast)
6. **On-Demand Fetching**: When Stremio requests metadata or streams, the addon fetches full file details from API (with LRU caching)
7. **Metadata Enrichment**: Stream titles include resolution, codec, source, release group, and file size (fetched from full details)
8. **Streaming**: The addon constructs HTTP URLs using file ID (`{STREAM_BASE_URL}/stream/{id}`)
9. **Caching**: Frequently accessed file details and metadata are cached in LRU caches (1000 items, 30min TTL)
10. **No Filesystem Access**: All file operations happen on the Stremio NAS API server, not on the addon machine

## Adding to Stremio

1. **Start the addon** (see Installation above)

2. **Add to Stremio**:
   - Open Stremio
   - Go to Addons
   - Click "Add Addon"
   - Enter: `http://localhost:1222/manifest.json`
   - Click "Install"

3. **Verify Installation**:
   - The addon should appear in your Stremio catalog
   - Video files from your Media API server should be listed

## API Integration

The addon expects the Stremio NAS API to return files in this format:

```json
[
  {
    "id": 1,
    "type": "movie",
    "name": "Movie1.mkv",
    "path": "Movie1.mkv",
    "size": 104857600,
    "mtime": 1704067200000,
    "parsedName": "Movie 1",
    "imdb_id": "tt1234567",
    "resolution": "1080p",
    "source": "WEB-DL",
    "videoCodec": "HEVC",
    "audioCodec": "AAC",
    "releaseGroup": "RARBG",
    "season": null,
    "episode": null,
    "imdbName": "Movie 1",
    "imdbYear": 2023
  }
]
```

**API Endpoints Used**:
- `GET /files`: Fetch all files for periodic polling
- `GET /files?imdb_id=tt1234567`: Fetch files for a specific IMDB ID (on-demand)

**Note**: Stream URLs are constructed by the addon using the `id` field: `{STREAM_BASE_URL}/stream/{id}`. The API no longer returns a `url` field.

## Troubleshooting

### Addon Can't Connect to API

1. **Check API URL**: Verify `API_INTERNAL_URL` is set correctly (use Docker service name for internal communication)
2. **Test API**: Try `curl http://your-server-ip:3001/files` to verify API is running
3. **Check Network**: Ensure addon machine can reach the server IP
4. **Check Firewall**: Ensure port 3001 (or your mapped port) is accessible
5. **Docker Network**: If using Docker, ensure both containers are on the same network (`media-network`)
6. **Service Name**: In Docker, use service name `stremio-nas-api` for `API_INTERNAL_URL`
7. **Polling**: Check addon logs for "Files fetched from API" messages (should appear every N minutes)

### No Files Appearing in Stremio

1. **Check API Response**: Verify API returns files: `curl http://your-nas-ip:3001/files`
2. **Check Addon Logs**: Look for errors: `podman logs stremio-nas-addon` (or `docker logs stremio-nas-addon`)
3. **Verify IMDB IDs**: Ensure files have IMDB IDs (addon only indexes files with IMDB IDs)
4. **Check File Discovery**: Look for "File discovery finished" message in logs
5. **Restart Addon**: Stop and restart the addon after API changes

### Streaming Not Working

1. **Check Stream URL**: Verify the addon constructs URLs correctly (uses `STREAM_BASE_URL` environment variable)
2. **Test Stream Directly**: Try opening `http://your-nas-ip:3001/stream/1` in a browser or VLC (use file ID from `/files` response)
3. **Check Range Support**: Ensure API supports Range headers (required for seeking)
4. **Check Network**: Ensure Stremio can reach the NAS IP and port
5. **Check STREAM_BASE_URL**: Verify `STREAM_BASE_URL` is set to the external accessible URL (must be reachable from Stremio)
6. **Check Metadata**: Verify stream titles show resolution/codec (indicates on-demand fetch is working)

### Port Already in Use

Change the port in `docker-compose.yml`:
```yaml
ports:
  - "1223:1222"  # Use different host port
```

Then update the addon URL in Stremio to: `http://localhost:1223/manifest.json`

### Docker Issues

1. **Build fails**: Ensure Dockerfile is in the `addon` directory
2. **Container won't start**: Check logs with `podman compose logs` (or `docker compose logs`)
3. **Storage**: Addon uses in-memory storage (no persistence needed - data rebuilt from API on startup)

## Development

### Testing Locally

1. **Start Media API Server** (see `../server/README.md`)

2. **Set environment variables**:
   ```bash
   export API_INTERNAL_URL=http://localhost:3000
   export STREAM_BASE_URL=http://localhost:3001
   export POLL_INTERVAL_MINUTES=1  # Fast polling for testing
   export LOG_LEVEL=debug
   ```

3. **Run addon**:
   ```bash
   npm start
   ```

4. **Test endpoints**:
   ```bash
   # Check manifest
   curl http://localhost:1222/manifest.json
   
   # Check catalog (should show indexed items)
   curl http://localhost:1222/catalog/movie/api.json
   ```

### Code Structure

- `index.js`: Main addon entry point (addonBuilder, startIndexing)
- `bin/addon.js`: Startup script (serveHTTP, starts polling)
- `lib/api/media.client.js`: API client for fetching files from Stremio NAS API (supports filtering by `imdb_id`)
- `lib/api/cinemeta.client.js`: API client for fetching metadata from Cinemeta API
- `lib/services/index.manager.js`: Index manager with LRU caching for full details and metadata, on-demand fetching
- `lib/services/polling.service.js`: Polling service for periodic API updates (configurable interval)
- `lib/handlers/catalog.js`: Catalog handler (uses lightweight index, fast)
- `lib/handlers/meta.js`: Meta handler (on-demand fetch with caching, enriched metadata)
- `lib/handlers/stream.js`: Stream handler (on-demand fetch with caching, enriched titles)
- `lib/storage/lightweight-index.js`: Lightweight in-memory index (~50 bytes per file, pre-aggregated by IMDB ID)
- `lib/config/index.js`: Centralized configuration (environment variables)
- `lib/config/logger.js`: Winston logger configuration
- `lib/utils/helpers.js`: Helper functions (URL construction, title formatting)
- `lib/utils/consts.js`: Constants (URLs, prefixes)

## License

MIT
