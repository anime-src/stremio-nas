import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import logger from './config/logger';
import routes from './routes';
import { errorHandler } from './middleware/error-handler';
import requestLogger from './middleware/request-logger';

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

  // Mount all routes
  app.use('/', routes);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
