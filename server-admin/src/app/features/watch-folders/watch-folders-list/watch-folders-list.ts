import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { WatchFolder, WatchFolderDTO } from '../../../core/models/watch-folder.model';
import { WatchFolderFormModalComponent } from './watch-folder-form-modal/watch-folder-form-modal';

@Component({
  selector: 'app-watch-folders-list',
  standalone: true,
  imports: [CommonModule, FormsModule, WatchFolderFormModalComponent],
  templateUrl: './watch-folders-list.html',
  styleUrl: './watch-folders-list.css',
})
export class WatchFoldersListComponent implements OnInit {
  watchFolders = signal<WatchFolder[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  showForm = signal<boolean>(false);
  editingFolder = signal<WatchFolder | null>(null);
  scanningFolders = signal<Set<number>>(new Set());

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadWatchFolders();
  }

  loadWatchFolders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.apiService.getWatchFolders().subscribe({
      next: (folders) => {
        console.log('Watch folders loaded:', folders?.length || 0);
        this.watchFolders.set(folders || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading watch folders:', err);
        this.error.set(
          `Failed to load watch folders: ${err.message || err.statusText || 'Unknown error'}`
        );
        this.loading.set(false);
        this.watchFolders.set([]);
      },
    });
  }

  openCreateForm(): void {
    this.editingFolder.set(null);
    this.showForm.set(true);
  }

  openEditForm(folder: WatchFolder): void {
    this.editingFolder.set(folder);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingFolder.set(null);
  }

  onSaveFolder(formData: WatchFolderDTO): void {
    if (!formData.path) {
      this.error.set('Path is required');
      return;
    }

    const editingFolder = this.editingFolder();
    const operation = editingFolder
      ? this.apiService.updateWatchFolder(editingFolder.id!, formData)
      : this.apiService.createWatchFolder(formData);

    operation.subscribe({
      next: () => {
        this.closeForm();
        this.loadWatchFolders();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save watch folder');
        console.error(err);
      },
    });
  }

  deleteFolder(folder: WatchFolder): void {
    if (!confirm(`Are you sure you want to delete "${folder.name || folder.path}"?`)) {
      return;
    }

    if (!folder.id) return;

    this.apiService.deleteWatchFolder(folder.id).subscribe({
      next: () => {
        this.loadWatchFolders();
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to delete watch folder');
        console.error(err);
      },
    });
  }

  triggerScan(folder: WatchFolder): void {
    if (!folder.id) return;

    if (folder.isScanning) {
      return;
    }

    const folderId = folder.id;
    const currentSet = new Set(this.scanningFolders());
    currentSet.add(folderId);
    this.scanningFolders.set(currentSet);

    this.apiService.triggerScan(folderId).subscribe({
      next: () => {
        const updatedSet = new Set(this.scanningFolders());
        updatedSet.delete(folderId);
        this.scanningFolders.set(updatedSet);
        this.loadWatchFolders();
      },
      error: (err) => {
        const updatedSet = new Set(this.scanningFolders());
        updatedSet.delete(folderId);
        this.scanningFolders.set(updatedSet);
        this.error.set(err.error?.error || 'Failed to trigger scan');
        console.error(err);
      },
    });
  }
}
