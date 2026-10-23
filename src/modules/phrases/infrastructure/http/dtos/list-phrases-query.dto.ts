import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../constants/list-phrases-query.constants';

export class ListPhrasesQueryDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: string }) => Number(value))
  page = DEFAULT_PAGE;

  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @Transform(({ value }: { value: string }) => Number(value))
  limit = DEFAULT_LIMIT;
}
