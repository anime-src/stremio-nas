import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

/**
 * Scan entity mapping to scans table
 */
@Entity('scans')
export class ScanEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamp' })
  timestamp!: Date;

  @Column({ type: 'integer' })
  filesFound!: number;

  @Column({ type: 'integer' })
  duration!: number;

  @Column({ type: 'integer', default: 0 })
  errors!: number;

  @Column({ type: 'integer', default: 0 })
  processedCount!: number;

  @Column({ type: 'integer', default: 0 })
  skippedCount!: number;

  @Column({ type: 'integer', nullable: true })
  watch_folder_id?: number | null;
}

