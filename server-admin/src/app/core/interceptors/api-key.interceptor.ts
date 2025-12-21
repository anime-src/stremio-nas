import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiKeyService } from '../services/api-key.service';

/**
 * HTTP interceptor that adds X-API-Key header to all API requests
 * Only adds the header if an API key is configured
 */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const apiKeyService = inject(ApiKeyService);
  const apiKey = apiKeyService.getApiKey();

  // Only add API key header if it's configured
  if (apiKey) {
    const clonedReq = req.clone({
      setHeaders: {
        'X-API-Key': apiKey,
      },
    });
    return next(clonedReq);
  }

  return next(req);
};

