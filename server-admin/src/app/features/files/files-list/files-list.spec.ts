import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilesList } from './files-list';

describe('FilesList', () => {
  let component: FilesList;
  let fixture: ComponentFixture<FilesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilesList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
