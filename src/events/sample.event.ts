import { IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

export class SampleEvent {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsISO8601()
  at!: string;

  @IsOptional()
  @IsNumber()
  count?: number;
}
