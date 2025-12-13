import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileRecord } from '../../models/file.model';
import { WatchFolder } from '../../models/watch-folder.model';
import { DateUtils } from '../../utils/date-utils';

@Component({
  selector: 'app-files-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './files-table.html',
  styleUrl: './files-table.css',
})
export class FilesTableComponent {
  @Input() files: FileRecord[] = [];
  @Input() watchFolders: WatchFolder[] = [];
  @Input() showActions: boolean = true;
  @Input() showThumbnail: boolean = true;
  @Input() showWatchFolder: boolean = true;
  @Input() showAddedDate: boolean = false;
  @Input() onFileClick?: (file: FileRecord) => void;

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

  getImageSrc(file: FileRecord): string | null {
    if (!file?.image) return null;
    if (typeof file.image === 'string') return file.image;
    if (typeof file.image === 'object' && file.image !== null && 'src' in file.image) {
      return (file.image as { src: string; width?: number; height?: number }).src;
    }
    return null;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
      const placeholder = img.nextElementSibling as HTMLElement;
      if (placeholder) {
        placeholder.style.display = 'flex';
      }
    }
  }

  handleFileClick(file: FileRecord): void {
    if (this.onFileClick) {
      this.onFileClick(file);
    }
  }

  getColspan(): number {
    let cols = 6; // Name, Type, IMDB ID, Size, Resolution (base columns)
    if (this.showThumbnail) cols++;
    if (this.showWatchFolder) cols++;
    if (this.showAddedDate) cols++;
    if (this.showActions) cols++;
    return cols;
  }

  formatDate = DateUtils.formatDate;
}
