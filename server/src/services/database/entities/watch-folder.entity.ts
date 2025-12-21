import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

/**
 * JSON transformer for array fields
 */
const jsonArrayTransformer = {
  to: (value: string[]): string => {
    return JSON.stringify(value);
  },
  from: (value: string): string[] => {
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
};

/**
 * Watch folder entity mapping to watch_folders table
 */
@Entity('watch_folders')
export class WatchFolderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  @Index('idx_watch_folders_path')
  path!: string;

  @Column({ type: 'text', nullable: true })
  name?: string | null;

  @Column({ type: 'integer', default: 1 })
  @Index('idx_watch_folders_enabled')
  enabled!: number; // 1 for true, 0 for false

  @Column({ type: 'text' })
  scan_interval!: string;

  @Column({ type: 'text', transformer: jsonArrayTransformer })
  allowed_extensions!: string[];

  @Column({ type: 'integer', default: 50 })
  min_video_size_mb!: number;

  @Column({ type: 'text', transformer: jsonArrayTransformer })
  temporary_extensions!: string[];

  @Column({ type: 'text', default: 'local' })
  type!: string;

  @Column({ type: 'text', nullable: true })
  username?: string | null;

  @Column({ type: 'text', nullable: true })
  password_encrypted?: string | null;

  @Column({ type: 'text', nullable: true })
  domain?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}

