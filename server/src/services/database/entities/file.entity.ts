import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

/**
 * JSON transformer for complex fields
 */
const jsonTransformer = {
  to: (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value; // Already a string
    return JSON.stringify(value);
  },
  from: (value: string | null): any => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as-is if not valid JSON
    }
  }
};

/**
 * File entity mapping to files table
 */
@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  @Index('idx_files_name')
  name!: string;

  @Column({ type: 'text', unique: true })
  @Index('idx_files_path')
  path!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ type: 'bigint' })
  mtime!: number;

  @Column({ type: 'text', nullable: true })
  parsedName?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_type')
  type?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_imdb')
  imdb_id?: string | null;

  @Column({ type: 'integer', nullable: true })
  season?: number | null;

  @Column({ type: 'integer', nullable: true })
  episode?: number | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_resolution')
  resolution?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_source')
  source?: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_videoCodec')
  videoCodec?: string | null;

  @Column({ type: 'text', nullable: true })
  audioCodec?: string | null;

  @Column({ type: 'text', nullable: true })
  audioChannels?: string | null;

  @Column({ type: 'text', nullable: true, transformer: jsonTransformer })
  languages?: string | string[] | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_files_releaseGroup')
  releaseGroup?: string | null;

  @Column({ type: 'text', nullable: true, transformer: jsonTransformer })
  flags?: string | string[] | null;

  @Column({ type: 'text', nullable: true })
  edition?: string | null;

  @Column({ type: 'text', nullable: true })
  imdbName?: string | null;

  @Column({ type: 'integer', nullable: true })
  imdbYear?: number | null;

  @Column({ type: 'text', nullable: true })
  imdbType?: string | null;

  @Column({ type: 'text', nullable: true })
  yearRange?: string | null;

  @Column({ type: 'text', nullable: true, transformer: jsonTransformer })
  image?: string | object | null;

  @Column({ type: 'text', nullable: true })
  starring?: string | null;

  @Column({ type: 'real', nullable: true })
  similarity?: number | null;

  @Column({ type: 'integer', nullable: true })
  watch_folder_id?: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}

