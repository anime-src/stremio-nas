# Caddy Reverse Proxy

A standalone reverse proxy with automatic HTTPS using Let's Encrypt.

## Features

- **Automatic HTTPS**: Let's Encrypt certificates with auto-renewal
- **Simple Config**: Easy Caddyfile syntax
- **Docker Integration**: Works with any Docker Compose project
- **HTTP/3 Support**: Modern QUIC protocol support
- **Zero Downtime**: Hot reload configuration changes

## Quick Start

### 1. Configure Environment

```bash
# Copy example config
cp env.example .env    # Linux/Mac
copy env.example .env  # Windows

# Edit .env with your domain
STREMIO_NAS_ADDON_DOMAIN=your-domain.com
```

### 2. Start the Proxy

```bash
# With Docker
docker compose up -d

# With Podman
podman compose up -d
```

### 3. Check Logs

```bash
docker logs -f caddy-proxy
# or
podman logs -f caddy-proxy
```

## File Structure

```
proxy/
├── docker-compose.yml  # Container configuration
├── Caddyfile           # Proxy rules (uses env variables)
├── env.example         # Environment template
├── .env                # Your configuration (create from env.example)
└── README.md           # This file
```

## Router Port Forwarding

Forward these ports on your router to this machine:

| External Port | Internal Port | Purpose |
|--------------|---------------|---------|
| 80 | 80 | HTTP (Let's Encrypt verification) |
| 443 | 443 | HTTPS |

## Connecting Other Docker Projects

To expose a service from another Docker Compose project through this proxy:

### Step 1: Add External Network

In your other project's `docker-compose.yml`, add:

```yaml
services:
  your-service:
    # ... your service config ...
    networks:
      - your-internal-network
      - proxy-network  # Add this

networks:
  your-internal-network:
    driver: bridge
  proxy-network:
    external: true  # Add this
```

### Step 2: Add to Caddyfile

Edit `Caddyfile` and add:

```caddyfile
your-subdomain.yourdomain.com {
    reverse_proxy your-service:port
}
```

### Step 3: Reload Caddy

```bash
docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
# or
podman exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
```

## Caddyfile Examples

### Basic Reverse Proxy

```caddyfile
example.com {
    reverse_proxy backend:8080
}
```

### With Compression

```caddyfile
example.com {
    reverse_proxy backend:8080
    encode gzip
}
```

### Multiple Subdomains

```caddyfile
app.example.com {
    reverse_proxy app-service:3000
}

api.example.com {
    reverse_proxy api-service:8080
}

admin.example.com {
    reverse_proxy admin-service:80
}
```

### With Basic Auth

```caddyfile
private.example.com {
    basicauth {
        # Generate hash: caddy hash-password
        admin $2a$14$Zkx19XLiW6VYouLHR5NmfOFU0z2GT
    }
    reverse_proxy private-service:8080
}
```

### Path-Based Routing

```caddyfile
example.com {
    reverse_proxy /api/* api-service:8080
    reverse_proxy /app/* app-service:3000
    reverse_proxy admin-service:80
}
```

### With Custom Headers

```caddyfile
example.com {
    reverse_proxy backend:8080 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

## Maintenance

### Reload Configuration (without restart)

After editing Caddyfile:

```bash
docker exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
```

### View Logs

```bash
docker logs -f caddy-proxy
```

### Restart

```bash
docker compose restart
```

### Update Caddy

```bash
docker compose pull
docker compose up -d
```

### Check Certificate Status

```bash
docker exec caddy-proxy caddy list-certificates
```

## Troubleshooting

### Can't get SSL certificate

1. Check port 80 is forwarded on your router
2. Check DNS points to your public IP
3. View logs: `docker logs caddy-proxy`
4. Test: `curl -I http://yourdomain.com`

### Service not reachable

1. Verify service is on `proxy-network`:
   ```bash
   docker network inspect proxy-network
   ```
2. Check service name matches Caddyfile
3. Test connectivity:
   ```bash
   docker exec caddy-proxy wget -q -O- http://service-name:port
   ```

### Configuration errors

Validate your Caddyfile:
```bash
docker exec caddy-proxy caddy validate --config /etc/caddy/Caddyfile
```

## Security Notes

- Caddy automatically redirects HTTP to HTTPS
- Certificates are stored in a Docker volume
- Keep Caddy updated for security patches
- Use strong passwords if using basicauth

## License

MIT
