import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ServerSettings } from '../../../core/models/settings.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent implements OnInit {
  settings = signal<ServerSettings>({});
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  saving = signal<boolean>(false);

  logLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.error.set(null);
    this.apiService.getSettings().subscribe({
      next: (settings) => {
        console.log('Settings loaded:', settings);
        this.settings.set(settings || {});
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading settings:', err);
        this.error.set(
          `Failed to load settings: ${err.message || err.statusText || 'Unknown error'}`
        );
        this.loading.set(false);
        this.settings.set({});
      },
    });
  }

  saveSettings(): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.apiService.bulkUpdateSettings(this.settings()).subscribe({
      next: () => {
        this.success.set('Settings saved successfully');
        this.saving.set(false);
        setTimeout(() => {
          this.success.set(null);
        }, 3000);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save settings');
        this.saving.set(false);
        console.error(err);
      },
    });
  }

  updateSetting(key: string, value: string): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  getSetting(key: string): string {
    return this.settings()[key] || '';
  }

  setSetting(key: string, value: string): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }
}
