# Stremio NAS Add-on

A Stremio add-on that connects to the Stremio NAS API server to list and stream video files. The add-on does NOT access the filesystem directly - all file operations happen through the HTTP API.

## Features

- **API-Based**: Connects to Stremio NAS API Server instead of scanning local filesystem
- **HTTP Streaming**: Streams videos via HTTP URLs with Range support for seeking (ID-based URLs)
- **IMDB Matching**: Only indexes files with IMDB IDs (matching original addon behavior)
- **Rich Metadata**: Displays resolution, codec, source, release group, and file size in stream titles
- **Lightweight Index**: Fast, scalable in-memory indexing with on-demand fetching (~5MB for 100K files)
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
   Edit `docker-compose.yml` (in project root) and set `MEDIA_API_URL`:
   ```yaml
   environment:
     - MEDIA_API_URL=http://stremio-nas-api:3000  # Internal Docker network
     - API_HOST=http://localhost:3001  # External URL for Stremio
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

2. **Configure the API URL**:
   Set the `MEDIA_API_URL` environment variable:
   ```bash
   export MEDIA_API_URL=http://your-server-ip:3000
   ```
   
   Or on Windows:
   ```cmd
   set MEDIA_API_URL=http://your-server-ip:3000
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
| `MEDIA_API_URL` | `http://localhost:3000` | URL of the Stremio NAS API server (internal Docker network) |
| `API_HOST` | `http://localhost:3001` | External URL for stream URLs (accessible from Stremio) |
| `PORT` | `1222` | Port for the Stremio addon HTTP server |
| `LOG_LEVEL` | `debug` | Logging level: `error`, `warn`, `info`, `debug` |

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
  - MEDIA_API_URL=http://stremio-nas-api:3000  # Internal Docker network
  - API_HOST=http://192.168.1.100:3001  # External URL
  - PORT=1222
```

**Local Node.js:**
```bash
export MEDIA_API_URL=http://192.168.1.100:3001
export API_HOST=http://192.168.1.100:3001
export PORT=1222
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
      - MEDIA_API_URL=http://stremio-nas-api:3000
      - API_HOST=http://localhost:3001
      - PORT=1222
    networks:
      - media-network
    depends_on:
      - stremio-nas-api

networks:
  media-network:
    driver: bridge
```

## How It Works

1. **File Discovery**: The addon calls `GET /files` on the Stremio NAS API to retrieve a list of video files with metadata
2. **IMDB Filtering**: Only files with IMDB IDs are indexed (matching original addon behavior)
3. **In-Memory Indexing**: Files are indexed in memory (no disk persistence - rebuilt from API on each startup)
4. **Catalog Generation**: Each file becomes a catalog item using IMDB ID and parsed name
5. **Streaming**: When Stremio requests a stream, the addon constructs the HTTP URL using file ID (`/stream/{id}`)
6. **Metadata Enrichment**: Stream titles include resolution, codec, source, release group, and file size
7. **No Filesystem Access**: All file operations happen on the Stremio NAS API server, not on the addon machine

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
    "type": "video",
    "name": "Movie1.mkv",
    "path": "Movie1.mkv",
    "size": 104857600,
    "parsedName": "Movie 1",
    "fileType": "movie",
    "imdb_id": "tt1234567",
    "resolution": "1080p",
    "source": "WEB-DL",
    "videoCodec": "HEVC",
    "audioCodec": "AAC",
    "releaseGroup": "RARBG",
    "season": null,
    "episode": null
  }
]
```

**Note**: Stream URLs are constructed by the addon using the `id` field: `{API_HOST}/stream/{id}`. The API no longer returns a `url` field.

## Troubleshooting

### Addon Can't Connect to API

1. **Check API URL**: Verify `MEDIA_API_URL` is set correctly
2. **Test API**: Try `curl http://your-server-ip:3001/files` to verify API is running
3. **Check Network**: Ensure addon machine can reach the server IP
4. **Check Firewall**: Ensure port 3001 (or your mapped port) is accessible
5. **Docker Network**: If using Docker, ensure both containers are on the same network (`media-network`)
6. **Service Name**: In Docker, use service name `stremio-nas-api` for internal communication

### No Files Appearing in Stremio

1. **Check API Response**: Verify API returns files: `curl http://your-nas-ip:3001/files`
2. **Check Addon Logs**: Look for errors: `podman logs stremio-nas-addon` (or `docker logs stremio-nas-addon`)
3. **Verify IMDB IDs**: Ensure files have IMDB IDs (addon only indexes files with IMDB IDs)
4. **Check File Discovery**: Look for "File discovery finished" message in logs
5. **Restart Addon**: Stop and restart the addon after API changes

### Streaming Not Working

1. **Check Stream URL**: Verify the addon constructs URLs correctly (uses `API_HOST` environment variable)
2. **Test Stream Directly**: Try opening `http://your-nas-ip:3001/stream/1` in a browser or VLC (use file ID from `/files` response)
3. **Check Range Support**: Ensure API supports Range headers (required for seeking)
4. **Check Network**: Ensure Stremio can reach the NAS IP and port
5. **Check API_HOST**: Verify `API_HOST` is set to the external accessible URL

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

2. **Set API URL**:
   ```bash
   export MEDIA_API_URL=http://localhost:3000
   ```

3. **Run addon**:
   ```bash
   npm start
   ```

4. **Test endpoints**:
   ```bash
   curl http://localhost:1222/manifest.json
   ```

### Code Structure

- `index.js`: Main addon entry point, handles Stremio requests
- `bin/addon.js`: Startup script
- `lib/api/index.js`: API client that fetches files from Stremio NAS API
- `lib/handlers/catalog.js`: Generates catalog from API file list
- `lib/handlers/stream.js`: Returns HTTP stream URLs constructed from file IDs
- `lib/handlers/meta.js`: Handles metadata requests with enriched stream titles
- `lib/utils/helpers.js`: Helper functions for URL construction and title formatting
- `lib/storage/lightweight-index.js`: Lightweight in-memory index (~50 bytes per file)
- `lib/services/index.manager.js`: Index manager with LRU caching and on-demand fetching
- `lib/config/logger.js`: Winston logger configuration

## Differences from Original Addon

This version differs from the original `stremio-local-addon`:

- **No Filesystem Scanning**: Uses API instead of platform-specific file finders
- **IMDB Filtering**: Only indexes files with IMDB IDs (matching original behavior)
- **HTTP URLs**: Returns HTTP stream URLs (ID-based) instead of `file://` URLs
- **Network-Based**: Completely network-based, no local file access
- **Lightweight Index**: Hybrid approach with minimal memory footprint and LRU caching
- **Rich Metadata**: Enhanced stream titles with resolution, codec, source, and file size
- **Structured Logging**: Winston-based logging instead of console.log
- **Docker Support**: Can run in Docker/Podman containers

## License

MIT
