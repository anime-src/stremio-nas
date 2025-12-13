import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  // Lazy load other routes
  {
    path: 'watch-folders',
    loadComponent: () =>
      import('./features/watch-folders/watch-folders-list/watch-folders-list').then(
        (m) => m.WatchFoldersListComponent
      ),
  },
  {
    path: 'files',
    loadComponent: () =>
      import('./features/files/files-list/files-list').then((m) => m.FilesListComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings/settings').then((m) => m.SettingsComponent),
  },
];
