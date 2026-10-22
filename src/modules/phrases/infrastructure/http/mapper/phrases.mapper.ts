import { Phrase } from '../../../domain/entities/phrase.entity';
import { ListPhrasesResponseDto } from '../dtos/list-phrases-response.dto';
import { ListPhrasesResult } from '../../../application/ports/inbound/list-phrases.port';

export class PhrasesMapper {
  static toListPhrasesResponseDto(
    list: ListPhrasesResult,
  ): ListPhrasesResponseDto {
    return new ListPhrasesResponseDto(
      list.data.map((phrase: Phrase) => ({
        id: phrase.id,
        text: phrase.text.value,
        createdAt: phrase.createdAt.toISOString(),
      })),
      {
        page: list.meta.page,
        limit: list.meta.limit,
        total: list.meta.total,
        totalPages: list.meta.totalPages,
      },
    );
  }
}
