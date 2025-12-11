# Stremio NAS

A complete solution for streaming video files from a NAS/media server to Stremio without direct filesystem access. The system consists of two components:

1. **Stremio NAS API** - A Node.js Express API server with SQLite database, automatic file scanning, and metadata extraction
2. **Stremio NAS Add-on** - A Stremio add-on that connects to the API to list and stream videos with rich metadata

## Architecture

```
┌─────────────────┐         HTTP API          ┌──────────────────┐
│  Stremio Add-on │ ────────────────────────> │  Stremio NAS API │
│  (Docker)       │ <──────────────────────── │  (Docker)        │
└─────────────────┘      JSON + Streams       └──────────────────┘
                                                      │
                                                      │ fs operations
                                                      ▼
                                            ┌──────────────────┐
                                            │  /data/videos    │
                                            │  (mounted vol)   │
                                            └──────────────────┘
                                                      │
                                                      │ metadata
                                                      ▼
                                            ┌──────────────────┐
                                            │  SQLite DB      │
                                            │  (file metadata)│
                                            └──────────────────┘
```

## Quick Start

### 1. Deploy Stremio NAS API Server

See [server/README.md](server/README.md) for detailed instructions.

**Quick steps**:
```bash
# From project root
# Edit docker-compose.yml to match your video paths
podman compose up -d stremio-nas-api
# or with docker:
docker compose up -d stremio-nas-api
```

### 2. Configure and Start Stremio NAS Add-on

See [addon/README.md](addon/README.md) for detailed instructions.

**Option A: Run Both Services Together (Recommended)**:
```bash
# From project root
# Edit docker-compose.yml to configure both services
podman compose up -d
# or with docker:
docker compose up -d
```

**Option B: Run Add-on Separately**:
```bash
cd addon
# Edit docker-compose.yml to set MEDIA_API_URL
podman compose up -d
# or with docker:
docker compose up -d
```

**Option C: Local Node.js**:
```bash
cd addon
export MEDIA_API_URL=http://your-server-ip:3001
export API_HOST=http://your-server-ip:3001
npm install
npm start
```

### 3. Add to Stremio

1. Open Stremio
2. Go to Addons → Add Addon
3. Enter: `http://localhost:1222/manifest.json`
4. Click Install

## Features

### Stremio NAS API
- ✅ **Database Storage**: SQLite database for persistent file metadata
- ✅ **Automatic Scanning**: Periodic file system scanning with configurable intervals
- ✅ **Metadata Extraction**: Extracts resolution, codec, source, release group from filenames
- ✅ **IMDB Integration**: Automatic IMDB ID matching and metadata enrichment
- ✅ **API Documentation**: Interactive Swagger UI at `/api-docs`
- ✅ **ID-Based Streaming**: Secure ID-based stream URLs (not filename-based)
- ✅ **Large File Support**: Handles 4K videos and 10GB+ files efficiently

### Stremio NAS Add-on
- ✅ **No Filesystem Access**: Add-on never touches SMB, NFS, or local filesystem
- ✅ **HTTP Streaming**: All streaming happens via HTTP with Range support
- ✅ **Rich Metadata**: Displays resolution, codec, source, and file size in stream titles
- ✅ **In-Memory Storage**: Fast, lightweight in-memory indexing
- ✅ **Structured Logging**: Winston-based logging for better debugging

### Both Components
- ✅ **Docker Ready**: Pre-configured for Docker/Podman Compose
- ✅ **Seeking Support**: Range header support for video seeking
- ✅ **CORS Enabled**: Cross-origin requests supported

## Project Structure

```
stremio-network-addon/
├── server/                 # Stremio NAS API Server
│   ├── index.js           # Entry point
│   ├── src/               # Source code
│   │   ├── app.js        # Express app setup
│   │   ├── config/       # Configuration
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic (scanner, database, IMDB)
│   │   ├── routes/       # API routes
│   │   └── middleware/   # Express middleware
│   ├── Dockerfile         # Docker image definition
│   ├── docker-compose.yml # Server deployment config
│   └── README.md          # API documentation
├── addon/                  # Stremio NAS Add-on
│   ├── index.js           # Add-on entry point
│   ├── bin/               # Startup scripts
│   ├── lib/               # Add-on modules
│   │   ├── handlers/     # Stremio handlers (catalog, meta, stream)
│   │   ├── api/          # API client
│   │   ├── storage.js    # In-memory storage
│   │   └── utils/        # Helper functions
│   ├── Dockerfile         # Addon Docker image definition
│   ├── docker-compose.yml # Addon deployment config
│   └── README.md          # Add-on documentation
├── docker-compose.yml     # Combined setup (both services)
└── README.md              # This file
```

## Requirements

- Docker and Docker Compose (or Podman Compose)
- Node.js 14+ (for add-on if running locally, optional if using Docker)
- Stremio desktop application
- Video files accessible to Docker

## Configuration

### Stremio NAS API Server

Configure via environment variables in `docker-compose.yml`:
- `MEDIA_DIR`: Directory to scan (default: `/data/videos`)
- `PORT`: API port (default: `3000`)
- `API_HOST`: External URL for stream URLs (default: `http://localhost:3001`)
- `ALLOWED_EXTENSIONS`: File extensions (default: `.mp4,.mkv,.avi`)
- `SCAN_INTERVAL`: Cron expression for periodic scans (default: `*/5 * * * *` - every 5 minutes)
- `SCAN_ON_STARTUP`: Scan on server startup (default: `true`)
- `MIN_VIDEO_SIZE_MB`: Minimum file size in MB (default: `50`)
- `LOG_LEVEL`: Logging level (default: `info`)

### Stremio NAS Add-on

Configure via environment variables:
- `MEDIA_API_URL`: Internal URL of Stremio NAS API Server (default: `http://localhost:3000`)
- `API_HOST`: External URL for stream URLs accessible from Stremio (default: `http://localhost:3001`)
- `PORT`: Add-on port (default: `1222`)
- `LOG_LEVEL`: Logging level (default: `debug`)

## Testing

### Test API Server

```bash
# List files (returns files with metadata and database IDs)
curl http://your-server-ip:3001/files

# Get statistics
curl http://your-server-ip:3001/files/stats

# Get scan history
curl http://your-server-ip:3001/files/scan-history

# Trigger manual scan
curl -X POST http://your-server-ip:3001/files/refresh

# Test streaming (use file ID from /files response)
curl -I http://your-server-ip:3001/stream/1

# Health check
curl http://your-server-ip:3001/health

# View API documentation
# Open in browser: http://your-server-ip:3001/api-docs
```

### Test Add-on

```bash
# Check manifest
curl http://localhost:1222/manifest.json

# Check catalog
curl http://localhost:1222/catalog/movie/api.json
```

## Troubleshooting

### API Issues

- **Files not appearing**: 
  - Check volume mapping in `docker-compose.yml`
  - Verify files have IMDB IDs (check logs)
  - Check database: `podman exec stremio-nas-api sqlite3 /app/storage/media.db "SELECT COUNT(*) FROM files"`
- **Streaming fails**: 
  - Use file ID from `/files` response (not filename)
  - Verify Range header support, check network connectivity
- **Container won't start**: 
  - Check port conflicts (default: 3001 on host)
  - Verify Docker permissions
  - Check storage directory permissions
- **Database issues**: 
  - Database stored at `./storage/media.db` inside container
  - Ensure `node` user has write access

### Add-on Issues

- **Can't connect**: 
  - Verify `MEDIA_API_URL` environment variable (use service name in Docker)
  - Check `API_HOST` is set to external accessible URL
- **No files in Stremio**: 
  - Check API is running: `curl http://your-server-ip:3001/files`
  - Verify files have IMDB IDs (addon only indexes files with IMDB IDs)
  - Check addon logs: `podman logs stremio-nas-addon`
- **Streaming fails**: 
  - Verify stream URLs use correct `API_HOST` (accessible from Stremio machine)
  - Test stream URL directly: `curl -I http://your-server-ip:3001/stream/1`
- **Docker issues**: 
  - Check logs: `podman compose logs` or `docker compose logs`
  - Verify both containers are on same network (`media-network`)

See individual README files for detailed troubleshooting:
- [Server Troubleshooting](server/README.md#troubleshooting)
- [Add-on Troubleshooting](addon/README.md#troubleshooting)

## Security Considerations

- API container runs as non-root user (`node`)
- Volume mounts are read-only (`:ro`)
- ID-based streaming URLs prevent path traversal attacks
- Database stored inside container (not exposed externally)
- CORS can be restricted if needed (modify `server/src/app.js`)

## License

MIT

