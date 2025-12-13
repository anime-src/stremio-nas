import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileRecord } from '../../../../core/models/file.model';
import { WatchFolder } from '../../../../core/models/watch-folder.model';
import { DateUtils } from '../../../../core/utils/date-utils';

@Component({
  selector: 'app-file-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-details-modal.html',
  styleUrl: './file-details-modal.css',
})
export class FileDetailsModalComponent {
  @Input() file: FileRecord | null = null;
  @Input() watchFolders: WatchFolder[] = [];
  @Output() close = new EventEmitter<void>();

  @HostListener('document:keydown', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.file) {
      this.closeModal();
    }
  }

  // Expose Array for template use
  Array = Array;

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getWatchFolderName(watchFolderId: number | null | undefined): string {
    if (!watchFolderId) return '-';
    const folder = this.watchFolders.find((f) => f.id === watchFolderId);
    return folder?.name || folder?.path || `Folder ${watchFolderId}`;
  }

  getImageSrc(): string | null {
    if (!this.file?.image) return null;
    if (typeof this.file.image === 'string') return this.file.image;
    if (
      typeof this.file.image === 'object' &&
      this.file.image !== null &&
      'src' in this.file.image
    ) {
      return (this.file.image as { src: string; width?: number; height?: number }).src;
    }
    return null;
  }

  getLanguages(): string[] {
    if (!this.file?.languages) return [];
    if (Array.isArray(this.file.languages)) return this.file.languages;
    if (typeof this.file.languages === 'string') return [this.file.languages];
    return [];
  }

  getFlags(): string[] {
    if (!this.file?.flags) return [];
    if (Array.isArray(this.file.flags)) return this.file.flags;
    if (typeof this.file.flags === 'string') return [this.file.flags];
    return [];
  }

  closeModal(): void {
    this.close.emit();
  }

  formatDate = DateUtils.formatDate;
  formatUnixTimestamp = DateUtils.formatUnixTimestamp;
}
