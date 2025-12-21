import { Injectable, signal } from '@angular/core';

const API_KEY_STORAGE_KEY = 'stremio_nas_api_key';

/**
 * Service for managing API key authentication
 * Stores the API key in localStorage for persistence across sessions
 */
@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  private apiKey = signal<string | null>(null);

  constructor() {
    // Load API key from localStorage on initialization
    this.loadApiKey();
  }

  /**
   * Load API key from localStorage
   */
  private loadApiKey(): void {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) {
      this.apiKey.set(stored);
    }
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    return this.apiKey();
  }

  /**
   * Set the API key and persist it to localStorage
   */
  setApiKey(key: string | null): void {
    this.apiKey.set(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return this.apiKey() !== null && this.apiKey()!.trim() !== '';
  }

  /**
   * Clear the API key
   */
  clearApiKey(): void {
    this.setApiKey(null);
  }
}

