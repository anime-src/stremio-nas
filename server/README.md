# Stremio NAS API

A TypeScript/Node.js Express API server that runs in Docker to serve video files over HTTP with streaming support. Provides file scanning, metadata extraction, and video streaming capabilities for Stremio addons.

## Features

- **File Listing**: Scan and list video files from mounted directory with rich metadata
- **HTTP Streaming**: Stream video files with Range header support for seeking (ID-based URLs)
- **Streaming Optimizations**: Large buffers (512KB), HTTP caching headers, HEAD request support, file stats caching
- **Database Storage**: SQLite database for persistent file metadata storage
- **Periodic Scanning**: Automatic file system scanning with configurable intervals (cron-based)
- **Metadata Extraction**: Extracts video metadata (resolution, codec, source, release group) from filenames
- **IMDB Integration**: Automatic IMDB ID matching and metadata enrichment
- **API Documentation**: Interactive Swagger UI at `/api-docs`
- **Query Filters**: Filter files by extension, IMDB ID, or filename (partial search)
- **MIME Type Detection**: Automatically detects correct content type based on file extension
- **Structured Logging**: Winston-based logging with configurable log levels
- **CORS Enabled**: Cross-origin requests supported
- **Docker Ready**: Pre-configured for Docker and Docker Compose
- **Large File Support**: Efficiently handles 4K videos and 10GB+ files with optimized streaming

## Prerequisites

- Docker and Docker Compose installed
- Video files stored in a directory accessible to Docker

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone or copy the server files** to your server or local machine

2. **Edit `docker-compose.yml`** (in project root) to match your setup:
   
   **For Linux/Unix systems:**
   ```yaml
   volumes:
     - /path/to/your/videos:/data/videos:ro
   ```
   
   **For Windows (Docker Desktop):**
   ```yaml
   volumes:
     - C:\Users\YourName\Videos:/data/videos:ro
     # Or use WSL2 format:
     # - /mnt/c/Users/YourName/Videos:/data/videos:ro
   ```
   
   **Important for Windows:**
   - Enable file sharing in Docker Desktop Settings → Resources → File Sharing
   - Add the drive/folder you want to share (e.g., `C:` or specific folders)
   - Use forward slashes or escaped backslashes in paths

3. **Deploy via Docker Compose**:
   - Navigate to the project root directory
   - Run: `podman compose up -d` (or `docker compose up -d`)

### Using Docker CLI

1. **Build the image**:
   ```bash
   cd server
   docker build -t media-api .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name stremio-nas-api \
     -p 3001:3000 \
     -v /path/to/videos:/data/videos:ro \
     -e MEDIA_DIR=/data/videos \
     -e PORT=3000 \
     -e ALLOWED_EXTENSIONS=.mp4,.mkv,.avi \
     -e API_HOST=http://localhost:3001 \
     stremio-nas-api
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the API server listens on |
| `MEDIA_DIR` | `/data/videos` | Directory path inside container to scan for videos |
| `ALLOWED_EXTENSIONS` | `.mp4,.mkv,.avi` | Comma-separated list of file extensions to include |
| `API_HOST` | `http://localhost:3000` | Base URL for stream URLs (use your NAS IP and mapped port, e.g., `http://192.168.1.100:3001`) |
| `LOG_LEVEL` | `info` | Logging level: `error`, `warn`, `info`, `debug` |
| `SCAN_INTERVAL` | `*/5 * * * *` | Cron expression for periodic scans (default: every 5 minutes) |
| `SCAN_ON_STARTUP` | `true` | Whether to scan filesystem on server startup |
| `MIN_VIDEO_SIZE_MB` | `50` | Minimum file size in MB (smaller files are skipped as incomplete) |
| `TEMPORARY_EXTENSIONS` | `.part,.tmp,.download,.crdownload,.!qB,.filepart` | Comma-separated list of temporary extensions to skip |
| `DB_PATH` | `./storage/media.db` | Path to SQLite database file |
| `CACHE_IMDB_TTL` | `86400000` | IMDB lookup cache TTL in milliseconds (24 hours) |
| `CACHE_MAX_SIZE` | `1000` | Maximum number of cached IMDB lookups |

### Example Configuration

For a server with IP `192.168.1.100`:

```yaml
environment:
  - PORT=3000
  - MEDIA_DIR=/data/videos
  - ALLOWED_EXTENSIONS=.mp4,.mkv,.avi,.mov
  - API_HOST=http://192.168.1.100:3000
  - LOG_LEVEL=info
```

### Logging

The API uses Winston for structured logging. Log levels:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: Informational messages, warnings, and errors (default)
- `debug`: Detailed debugging information including all requests

Set `LOG_LEVEL` environment variable to control verbosity. Logs include timestamps, request details, and performance metrics.

## API Endpoints

### GET /files

List all video files in the media directory.

**Query Parameters** (priority: `imdb_id` > `name` > `ext`):
- `imdb_id` (optional): Filter by IMDB ID (e.g., `?imdb_id=tt1234567`) - **Highest priority**
- `name` (optional): Filter by filename (partial, case-insensitive, min 2 chars, e.g., `?name=Matrix`) - **Second priority**
- `ext` (optional): Filter by extension (e.g., `?ext=.mp4`) - **Third priority**

**Response**:
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
    "audioChannels": "5.1",
    "releaseGroup": "RARBG",
    "season": null,
    "episode": null,
    "imdbName": "Movie 1",
    "imdbYear": 2023,
    "imdbType": "movie"
  }
]
```

**Examples**:
- `GET /files` - Get all files
- `GET /files?imdb_id=tt1234567` - Get files for specific IMDB ID (used by addon for on-demand fetch)
- `GET /files?name=Matrix` - Search files by name (for testing in Swagger)
- `GET /files?ext=.mkv` - Filter by extension

**Note**: Stream URLs are constructed using the `id` field: `http://API_HOST/stream/{id}`

### GET /stream/:id

Stream a video file with Range header support for seeking. Uses file ID from database (not filename). MIME type is automatically detected based on file extension.

**Request Headers**:
- `Range`: Optional, for partial content requests (e.g., `bytes=0-1023`)

**Response Headers**:
- `Content-Type`: Automatically detected MIME type (e.g., `video/mp4`, `video/x-matroska`)
- `Content-Length`: File size or chunk size for partial requests
- `Accept-Ranges`: `bytes`
- `Content-Range`: For partial requests (e.g., `bytes 0-1023/1048576`)
- `Cache-Control`: `public, max-age=31536000, immutable` (for better seeking)
- `Last-Modified`: File modification time (for conditional requests)
- `ETag`: File signature (for cache validation)
- `Content-Encoding`: `identity` (prevents compression)

**Streaming Optimizations**:
- Large read buffers (512KB) for better throughput
- File stats caching (5min TTL) to avoid repeated disk operations
- HTTP server optimizations (no timeout, keepAlive, headers timeout)
- Proper stream cleanup on client disconnect

### HEAD /stream/:id

Get video file headers without downloading content. Useful for checking existence and metadata.

**Response Headers**: Same as GET (without body)
- `Content-Type`, `Content-Length`, `Accept-Ranges`, `Cache-Control`, `Last-Modified`, `ETag`

### GET /files/stats

Get database and scan statistics.

**Response**:
```json
{
  "totalFiles": 150,
  "uniqueImdb": 120,
  "totalSize": 1073741824000,
  "typeStats": [
    { "fileType": "movie", "count": 100 },
    { "fileType": "series", "count": 50 }
  ],
  "nextScan": "2024-01-01T00:05:00.000Z"
}
```

### GET /files/scan-history

Get history of file system scans.

**Query Parameters**:
- `limit` (optional): Maximum number of records to return (default: 10)

**Response**:
```json
[
  {
    "id": 1,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "filesFound": 150,
    "duration": 5000,
    "errors": 0,
    "processedCount": 5,
    "skippedCount": 145
  }
]
```

### POST /files/refresh

Trigger a manual file system scan. Returns 409 Conflict if a scan is already in progress.

**Response**:
```json
{
  "message": "File scan completed successfully",
  "fileCount": 150,
  "removedCount": 2,
  "duration": 5000,
  "scanCompleted": "2024-01-01T00:00:00.000Z"
}
```

### GET /api-docs

Interactive Swagger API documentation. Access via web browser at `http://your-server:port/api-docs`

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Volume Mapping

The container mounts your video folder as read-only:

```yaml
volumes:
  - /volume1/video:/data/videos:ro
```

**Important**: 
- Adjust `/volume1/video` to your actual video folder path
- The `:ro` flag makes it read-only for security
- Ensure the Docker user has read permissions to the folder

## Network Configuration

The API listens on `0.0.0.0` to accept connections from other devices on your network.

**Firewall**: Ensure port 3000 (or your configured port) is open in your firewall settings.

## Troubleshooting

### Files Not Appearing

1. **Check volume mapping**: Verify the path in `docker-compose.yml` matches your actual folder
2. **Check permissions**: Ensure Docker has read access to the video folder
3. **Check extensions**: Verify files have allowed extensions (`.mp4`, `.mkv`, `.avi`)
4. **Check logs**: `podman logs stremio-nas-api` (or `docker logs stremio-nas-api`)

### Streaming Issues

1. **Range header support**: The API automatically handles Range requests for seeking
2. **Large files**: The API uses streaming with 512KB buffers and optimized settings
3. **Network**: Ensure your client can reach the NAS IP and port
4. **ID-based URLs**: Stream URLs use database IDs (e.g., `/stream/1`), not filenames
5. **HEAD requests**: Use `HEAD /stream/:id` to check file existence without downloading
6. **Caching**: Response includes caching headers for better seeking performance
7. **File stats cache**: File stats cached for 5 minutes to reduce disk operations

### Database Issues

1. **Database location**: Database is stored in Docker volume `stremio-nas-db` at `/app/storage/media.db` (inside container)
2. **Permissions**: Storage directory is automatically created with correct permissions
3. **Reset database**: Stop container, remove volume: `docker compose down -v` (or `podman compose down -v`), restart container
4. **Local development**: Database stored at `./storage/media.db` (relative to project root, auto-created)

### Container Won't Start

1. **Check port conflict**: Ensure port 3000 (or mapped port) isn't already in use
2. **Check Docker logs**: `podman logs stremio-nas-api` (or `docker logs stremio-nas-api`)
3. **Verify Dockerfile**: Ensure all dependencies are correct
4. **Check storage permissions**: Ensure storage directory is writable

## Security Considerations

- The container runs as a non-root user (`node`)
- Volume mounts are read-only (`:ro`)
- ID-based streaming URLs prevent path traversal attacks
- Database stored in Docker volume (not exposed externally)
- CORS can be restricted if needed (modify `src/app.ts`)

## Development

### Prerequisites

- Node.js 20+ (for TypeScript support)
- npm or yarn

### Local Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build TypeScript**:
   ```bash
   npm run build
   ```

3. **Run locally** (production mode):
   ```bash
   MEDIA_DIR=/path/to/videos PORT=3000 npm start
   ```

   Or run in development mode (auto-reload on changes):
   ```bash
   MEDIA_DIR=/path/to/videos PORT=3000 npm run dev
   ```

3. **Test endpoints**:
   ```bash
   # List all files
   curl http://localhost:3000/files
   
   # Filter by IMDB ID
   curl http://localhost:3000/files?imdb_id=tt1234567
   
   # Search by filename
   curl http://localhost:3000/files?name=Matrix
   
   # Filter by extension
   curl http://localhost:3000/files?ext=.mkv
   
   # Test streaming (use file ID from /files response)
   curl -I http://localhost:3000/stream/1  # HEAD request
   curl http://localhost:3000/stream/1     # GET request
   
   # View Swagger documentation
   curl http://localhost:3000/api-docs
   ```

## License

MIT

