import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListPhrasesQueryDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: string }) => Number(value))
  page = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: string }) => Number(value))
  limit = 20;
}
