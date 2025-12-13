import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private apiBaseUrl = '';

  constructor() {
    // In production, this could be set from environment variables
    // For now, we'll use relative URLs which work with the same host
    this.apiBaseUrl = '';
  }

  getApiUrl(): string {
    return this.apiBaseUrl;
  }
}
