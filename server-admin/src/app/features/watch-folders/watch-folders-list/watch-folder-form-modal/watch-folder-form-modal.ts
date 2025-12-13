import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchFolder, WatchFolderDTO } from '../../../../core/models/watch-folder.model';

@Component({
  selector: 'app-watch-folder-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './watch-folder-form-modal.html',
  styleUrl: './watch-folder-form-modal.css',
})
export class WatchFolderFormModalComponent implements OnChanges {
  @Input() isOpen: boolean = false;
  @Input() editingFolder: WatchFolder | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<WatchFolderDTO>();

  @HostListener('document:keydown', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.closeModal();
    }
  }

  formData = signal<WatchFolderDTO>({
    path: '',
    name: '',
    enabled: true,
    scan_interval: '*/5 * * * *',
    allowed_extensions: ['.mp4', '.mkv', '.avi'],
    min_video_size_mb: 50,
    temporary_extensions: ['.part', '.tmp', '.download', '.crdownload', '.!qB', '.filepart'],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingFolder'] || changes['isOpen']) {
      const folder = this.editingFolder;
      if (folder) {
        // Editing mode - populate form with folder data
        this.formData.set({
          path: folder.path,
          name: folder.name || '',
          enabled: folder.enabled,
          scan_interval: folder.scan_interval,
          allowed_extensions: [...folder.allowed_extensions],
          min_video_size_mb: folder.min_video_size_mb,
          temporary_extensions: [...folder.temporary_extensions],
        });
      } else if (this.isOpen) {
        // Create mode - reset to defaults
        this.formData.set({
          path: '',
          name: '',
          enabled: true,
          scan_interval: '*/5 * * * *',
          allowed_extensions: ['.mp4', '.mkv', '.avi'],
          min_video_size_mb: 50,
          temporary_extensions: ['.part', '.tmp', '.download', '.crdownload', '.!qB', '.filepart'],
        });
      }
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  onSubmit(): void {
    const currentFormData = this.formData();
    if (!currentFormData.path) {
      return; // Form validation will handle this
    }
    this.save.emit(currentFormData);
  }

  addExtension(): void {
    this.formData.update((data) => ({
      ...data,
      allowed_extensions: [...(data.allowed_extensions || []), ''],
    }));
  }

  removeExtension(index: number): void {
    this.formData.update((data) => {
      const extensions = [...(data.allowed_extensions || [])];
      extensions.splice(index, 1);
      return { ...data, allowed_extensions: extensions };
    });
  }

  addTempExtension(): void {
    this.formData.update((data) => ({
      ...data,
      temporary_extensions: [...(data.temporary_extensions || []), ''],
    }));
  }

  removeTempExtension(index: number): void {
    this.formData.update((data) => {
      const extensions = [...(data.temporary_extensions || [])];
      extensions.splice(index, 1);
      return { ...data, temporary_extensions: extensions };
    });
  }

  getAllowedExtension(index: number): string {
    return this.formData().allowed_extensions?.[index] || '';
  }

  setAllowedExtension(index: number, value: string): void {
    this.formData.update((data) => {
      const extensions = [...(data.allowed_extensions || [])];
      extensions[index] = value;
      return { ...data, allowed_extensions: extensions };
    });
  }

  getTemporaryExtension(index: number): string {
    return this.formData().temporary_extensions?.[index] || '';
  }

  setTemporaryExtension(index: number, value: string): void {
    this.formData.update((data) => {
      const extensions = [...(data.temporary_extensions || [])];
      extensions[index] = value;
      return { ...data, temporary_extensions: extensions };
    });
  }

  updateFormDataPath(value: string): void {
    this.formData.update((data) => ({ ...data, path: value }));
  }

  updateFormDataName(value: string): void {
    this.formData.update((data) => ({ ...data, name: value }));
  }

  updateFormDataEnabled(value: boolean): void {
    this.formData.update((data) => ({ ...data, enabled: value }));
  }

  updateFormDataScanInterval(value: string): void {
    this.formData.update((data) => ({ ...data, scan_interval: value }));
  }

  updateFormDataMinVideoSize(value: number): void {
    this.formData.update((data) => ({ ...data, min_video_size_mb: value }));
  }
}
