import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { FileRecord } from '../../../core/models/file.model';
import { WatchFolder } from '../../../core/models/watch-folder.model';
import { FileDetailsModalComponent } from './file-details-modal/file-details-modal';
import { FilesTableComponent } from '../../../core/components/files-table/files-table';

@Component({
  selector: 'app-files-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FileDetailsModalComponent, FilesTableComponent],
  templateUrl: './files-list.html',
  styleUrl: './files-list.css',
})
export class FilesListComponent implements OnInit {
  files = signal<FileRecord[]>([]);
  watchFolders = signal<WatchFolder[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  searchQuery = signal<string>('');
  selectedWatchFolder = signal<number | null>(null);
  selectedFile = signal<FileRecord | null>(null);

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadWatchFolders();
    this.loadFiles();
  }

  loadWatchFolders(): void {
    this.apiService.getWatchFolders().subscribe({
      next: (folders) => {
        this.watchFolders.set(folders || []);
      },
      error: (err) => {
        console.error('Failed to load watch folders', err);
        this.watchFolders.set([]);
      },
    });
  }

  loadFiles(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: any = {};
    if (this.searchQuery()) {
      params.name = this.searchQuery();
    }
    if (this.selectedWatchFolder()) {
      params.watch_folder_id = this.selectedWatchFolder();
    }

    this.apiService.getFiles(params).subscribe({
      next: (files) => {
        console.log('Files loaded:', files?.length || 0);
        this.files.set(files || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading files:', err);
        this.error.set(`Failed to load files: ${err.message || err.statusText || 'Unknown error'}`);
        this.loading.set(false);
        this.files.set([]);
      },
    });
  }

  onSearch(): void {
    this.loadFiles();
  }

  onWatchFolderChange(): void {
    this.loadFiles();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  openFileDetails(file: FileRecord): void {
    this.selectedFile.set(file);
  }

  closeFileDetails(): void {
    this.selectedFile.set(null);
  }
}
