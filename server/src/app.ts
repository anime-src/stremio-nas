import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import logger from './config/logger';
import routes from './routes';
import { errorHandler } from './middleware/error-handler';
import requestLogger from './middleware/request-logger';
import { apiKeyAuth } from './middleware/api-key';
import config from './config';

/**
 * Express application setup
 */
function createApp(): Express {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());

  // Morgan HTTP logger (integrate with Winston)
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));

  // Custom request logger
  app.use(requestLogger);

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Media API Documentation',
  }));

  // API key authentication middleware (only applied if API key is configured)
  // Excludes /health and /api-docs endpoints
  if (config.apiKey) {
    app.use((req, res, next) => {
      // Skip authentication for health check and Swagger docs
      if (req.path === '/health' || req.path.startsWith('/api-docs')) {
        return next();
      }
      // Apply API key authentication to all other routes
      apiKeyAuth(req, res, next);
    });
    logger.info('API key authentication enabled');
  }

  // Mount all routes
  app.use('/', routes);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
