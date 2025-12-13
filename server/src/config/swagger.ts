import swaggerJsdoc from 'swagger-jsdoc';
import config from './index';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stremio NAS API',
      version: '1.0.0',
      description: 'Media API server for streaming NAS video files to Stremio. Provides file listing, metadata extraction, and video streaming capabilities.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: config.apiHost,
        description: 'API server',
      },
    ],
    components: {
      schemas: {
        File: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'File identifier (filename)',
              example: 'Movie.2023.1080p.BluRay.x264.mkv',
            },
            name: {
              type: 'string',
              description: 'Original filename',
              example: 'Movie.2023.1080p.BluRay.x264.mkv',
            },
            path: {
              type: 'string',
              description: 'Relative path to file',
              example: 'Movie.2023.1080p.BluRay.x264.mkv',
            },
            size: {
              type: 'integer',
              description: 'File size in bytes',
              example: 2147483648,
            },
            url: {
              type: 'string',
              description: 'Streaming URL',
              example: 'http://localhost:3000/stream/Movie.2023.1080p.BluRay.x264.mkv',
            },
            parsedName: {
              type: 'string',
              description: 'Parsed title from filename',
              example: 'Movie',
            },
            type: {
              type: 'string',
              description: 'Content type (movie or series)',
              example: 'movie',
              enum: ['movie', 'series']
            },
            imdb_id: {
              type: 'string',
              description: 'IMDB identifier',
              example: 'tt1234567',
            },
            season: {
              type: 'integer',
              description: 'Season number (for TV series)',
              example: 1,
              nullable: true,
            },
            episode: {
              type: 'integer',
              description: 'Episode number (for TV series)',
              example: 1,
              nullable: true,
            },
            resolution: {
              type: 'string',
              description: 'Video resolution',
              example: '1080p',
              nullable: true,
            },
            source: {
              type: 'string',
              description: 'Video source',
              example: 'BluRay',
              nullable: true,
            },
            videoCodec: {
              type: 'string',
              description: 'Video codec',
              example: 'x264',
              nullable: true,
            },
            audioCodec: {
              type: 'string',
              description: 'Audio codec',
              example: 'AC3',
              nullable: true,
            },
            audioChannels: {
              type: 'string',
              description: 'Audio channels',
              example: '5.1',
              nullable: true,
            },
            languages: {
              type: 'string',
              description: 'Languages (JSON array as string)',
              example: '["ENGLISH"]',
              nullable: true,
            },
            releaseGroup: {
              type: 'string',
              description: 'Release group',
              example: 'GROUP',
              nullable: true,
            },
            flags: {
              type: 'string',
              description: 'Release flags (JSON array as string)',
              example: '["PROPER"]',
              nullable: true,
            },
            edition: {
              type: 'string',
              description: 'Edition information',
              example: 'EXTENDED',
              nullable: true,
            },
            imdbName: {
              type: 'string',
              description: 'Official IMDB title',
              example: 'The Movie',
              nullable: true,
            },
            imdbYear: {
              type: 'integer',
              description: 'IMDB release year',
              example: 2023,
              nullable: true,
            },
            imdbType: {
              type: 'string',
              description: 'IMDB type',
              example: 'movie',
              nullable: true,
            },
            yearRange: {
              type: 'string',
              description: 'Year range (for series)',
              example: '2020-',
              nullable: true,
            },
            image: {
              type: 'string',
              description: 'Poster image (JSON object as string)',
              example: '{"src":"https://...","width":680,"height":1000}',
              nullable: true,
            },
            starring: {
              type: 'string',
              description: 'Cast information',
              example: 'Actor One, Actor Two',
              nullable: true,
            },
            similarity: {
              type: 'number',
              description: 'Match similarity score',
              example: 0.95,
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
          },
        },
        ScanResult: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'File scan completed successfully',
            },
            fileCount: {
              type: 'integer',
              example: 150,
            },
            scanCompleted: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                totalFiles: { type: 'integer' },
                uniqueImdb: { type: 'integer' },
                totalSize: { type: 'integer' },
                byType: { type: 'object' },
                lastScan: { type: 'object', nullable: true },
              },
            },
            scheduler: {
              type: 'object',
              properties: {
                active: { type: 'boolean' },
                isScanning: { type: 'boolean' },
                interval: { type: 'string' },
                jobs: { type: 'array', items: { type: 'string' } },
              },
            },
            config: {
              type: 'object',
              properties: {
                scanInterval: { type: 'string' },
                scanOnStartup: { type: 'boolean' },
              },
            },
          },
        },
        ScanHistory: {
          type: 'object',
          properties: {
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                  filesFound: { type: 'integer' },
                  duration: { type: 'integer' },
                  errors: { type: 'integer' },
                },
              },
            },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Files',
        description: 'File listing and management operations',
      },
      {
        name: 'Streaming',
        description: 'Video file streaming operations',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/app.ts'], // Paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
