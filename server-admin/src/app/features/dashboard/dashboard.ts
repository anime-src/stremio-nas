import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DatabaseStats, ScanRecord } from '../../core/models/settings.model';
import { WatchFolder } from '../../core/models/watch-folder.model';
import { FileRecord } from '../../core/models/file.model';
import { FilesTableComponent } from '../../core/components/files-table/files-table';
import { DateUtils } from '../../core/utils/date-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FilesTableComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  stats = signal<DatabaseStats | null>(null);
  watchFolders = signal<WatchFolder[]>([]);
  recentScans = signal<ScanRecord[]>([]);
  recentFiles = signal<FileRecord[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load stats
    this.apiService.getFileStats().subscribe({
      next: (response: any) => {
        console.log('Stats response received:', response);
        console.log('Response type:', typeof response);
        console.log('Response keys:', response ? Object.keys(response) : 'null');

        try {
          if (response && response.database) {
            this.stats.set(response.database);
            console.log('Stats assigned:', this.stats());
            console.log('Stats.totalFiles:', this.stats()?.totalFiles);
          } else {
            console.error('Invalid stats response structure:', response);
            this.error.set('Invalid response format');
          }
        } catch (e) {
          console.error('Error processing stats response:', e);
          this.error.set('Error processing response');
        } finally {
          this.loading.set(false);
          console.log('Loading set to false, stats:', this.stats());
        }
      },
      error: (err) => {
        this.error.set('Failed to load statistics');
        this.loading.set(false);
        console.error('Error loading stats:', err);
        console.error('Error details:', {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          error: err.error,
          url: err.url,
        });
      },
      complete: () => {
        console.log('Stats observable completed, loading:', this.loading());
      },
    });

    // Load watch folders
    this.apiService.getWatchFolders().subscribe({
      next: (folders) => {
        this.watchFolders.set(folders || []);
      },
      error: (err) => {
        console.error('Failed to load watch folders', err);
        this.watchFolders.set([]);
      },
    });

    // Load recent scans
    this.apiService.getScanHistory(10).subscribe({
      next: (response) => {
        this.recentScans.set(response?.history || []);
      },
      error: (err) => {
        console.error('Failed to load scan history', err);
        this.recentScans.set([]);
      },
    });

    // Load recent files
    this.apiService.getFiles().subscribe({
      next: (files) => {
        // Sort by createdAt descending and take first 10
        const sorted = (files || [])
          .filter((f) => f.createdAt)
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA; // Descending order
          })
          .slice(0, 10);
        this.recentFiles.set(sorted);
      },
      error: (err) => {
        console.error('Failed to load recent files', err);
        this.recentFiles.set([]);
      },
    });
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getEnabledWatchFoldersCount(): number {
    return this.watchFolders().filter((f) => f.enabled).length;
  }

  getWatchFolderName(watchFolderId: number | null | undefined): string {
    if (!watchFolderId) return '-';
    const folder = this.watchFolders().find((f) => f.id === watchFolderId);
    return folder?.name || folder?.path || `Folder ${watchFolderId}`;
  }

  formatDate = DateUtils.formatDate;
}
