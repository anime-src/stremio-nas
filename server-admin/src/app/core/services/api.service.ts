import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WatchFolder, WatchFolderDTO } from '../models/watch-folder.model';
import { FileRecord } from '../models/file.model';
import { ServerSettings, DatabaseStats, ScanRecord } from '../models/settings.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl; // Use environment configuration

  constructor(private http: HttpClient) {
    console.log('ApiService initialized with apiUrl:', this.apiUrl);
    console.log('Environment:', environment);
  }

  // Watch Folders API
  getWatchFolders(): Observable<WatchFolder[]> {
    const url = `${this.apiUrl}/watch-folders`;
    console.log('API: getWatchFolders ->', url);
    return this.http.get<WatchFolder[]>(url);
  }

  getWatchFolderById(id: number): Observable<WatchFolder> {
    return this.http.get<WatchFolder>(`${this.apiUrl}/watch-folders/${id}`);
  }

  createWatchFolder(folder: WatchFolderDTO): Observable<WatchFolder> {
    return this.http.post<WatchFolder>(`${this.apiUrl}/watch-folders`, folder);
  }

  updateWatchFolder(id: number, folder: Partial<WatchFolderDTO>): Observable<WatchFolder> {
    return this.http.put<WatchFolder>(`${this.apiUrl}/watch-folders/${id}`, folder);
  }

  deleteWatchFolder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/watch-folders/${id}`);
  }

  triggerScan(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/watch-folders/${id}/scan`, {});
  }

  getWatchFolderStats(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/watch-folders/${id}/stats`);
  }

  // Files API
  getFiles(params?: {
    ext?: string;
    imdb_id?: string;
    name?: string;
    watch_folder_id?: number;
  }): Observable<FileRecord[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.ext) httpParams = httpParams.set('ext', params.ext);
      if (params.imdb_id) httpParams = httpParams.set('imdb_id', params.imdb_id);
      if (params.name) httpParams = httpParams.set('name', params.name);
      if (params.watch_folder_id)
        httpParams = httpParams.set('watch_folder_id', String(params.watch_folder_id));
    }
    // Use /api prefix for consistency
    const url = `${this.apiUrl}/files`;
    console.log('API: getFiles ->', url, params);
    return this.http.get<FileRecord[]>(url, { params: httpParams });
  }

  getFileStats(): Observable<any> {
    const url = `${this.apiUrl}/files/stats`;
    console.log('Calling getFileStats with URL:', url);
    return this.http.get<any>(url).pipe(
      tap({
        next: (data) => console.log('getFileStats raw response:', data),
        error: (err) => console.error('getFileStats error:', err),
      })
    );
  }

  getScanHistory(limit: number = 10): Observable<{ history: ScanRecord[] }> {
    return this.http.get<{ history: ScanRecord[] }>(`${this.apiUrl}/files/scan-history`, {
      params: new HttpParams().set('limit', String(limit)),
    });
  }

  triggerFileScan(): Observable<any> {
    return this.http.post(`${this.apiUrl}/files/refresh`, {});
  }

  // Settings API
  getSettings(): Observable<ServerSettings> {
    return this.http.get<ServerSettings>(`${this.apiUrl}/settings`);
  }

  getSetting(key: string): Observable<{ key: string; value: string }> {
    return this.http.get<{ key: string; value: string }>(`${this.apiUrl}/settings/${key}`);
  }

  updateSetting(key: string, value: string): Observable<{ key: string; value: string }> {
    return this.http.put<{ key: string; value: string }>(`${this.apiUrl}/settings/${key}`, {
      value,
    });
  }

  bulkUpdateSettings(settings: ServerSettings): Observable<ServerSettings> {
    return this.http.post<ServerSettings>(`${this.apiUrl}/settings`, settings);
  }
}
