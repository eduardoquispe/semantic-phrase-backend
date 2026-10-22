import { Phrase } from '../../../domain/entities/phrase.entity';
import { PaginatedResult } from '../../../../../shared/application/pagination/paginated-result.interface';

export interface ListPhrasesInput {
  page: number;
  limit: number;
}

export type ListPhrasesResult = PaginatedResult<Phrase>;

export abstract class ListPhrasesPort {
  abstract execute(input: ListPhrasesInput): Promise<ListPhrasesResult>;
}
