import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

/**
 * HTTP interceptor that handles API errors
 * Specifically handles 401 Unauthorized errors for API key authentication
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized errors (API key missing or invalid)
      if (error.status === 401) {
        console.error('API authentication failed:', error.error);
        // The error will be handled by the component/service making the request
        // Components can check for 401 status and prompt user to configure API key
      }
      return throwError(() => error);
    })
  );
};

