const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const logger = require('./config/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

/**
 * Express application setup
 */
function createApp() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());

  // Morgan HTTP logger (integrate with Winston)
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
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

module.exports = createApp;

