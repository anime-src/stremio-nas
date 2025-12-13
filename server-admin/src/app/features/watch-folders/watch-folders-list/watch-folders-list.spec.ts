import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WatchFoldersList } from './watch-folders-list';

describe('WatchFoldersList', () => {
  let component: WatchFoldersList;
  let fixture: ComponentFixture<WatchFoldersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatchFoldersList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WatchFoldersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
