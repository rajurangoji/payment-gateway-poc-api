import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'message' })
  message: string;
}
