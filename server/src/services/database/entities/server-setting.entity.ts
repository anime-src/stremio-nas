import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn
} from 'typeorm';

/**
 * Server setting entity mapping to server_settings table
 */
@Entity('server_settings')
export class ServerSettingEntity {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}

