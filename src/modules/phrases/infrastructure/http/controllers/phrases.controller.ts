import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import { ListPhrasesQueryDto } from '../dtos/list-phrases-query.dto';
import { ListPhrasesPort } from '../../../application/ports/inbound/list-phrases.port';
import { InvalidEmbeddingFilter } from '../filters/invalid-embedding.filter';
import { InvalidPhraseFilter } from '../filters/invalid-phrase.filter';
import { InvalidPhraseTextFilter } from '../filters/invalid-phrase-text.filter';
import { PhrasesMapper } from '../mapper/phrases.mapper';

@Controller('v1/phrases')
@UseFilters(
  InvalidEmbeddingFilter,
  InvalidPhraseFilter,
  InvalidPhraseTextFilter,
)
export class PhrasesController {
  constructor(private readonly listPhrases: ListPhrasesPort) {}

  @Get()
  async get(@Query() query: ListPhrasesQueryDto) {
    const list = await this.listPhrases.execute(query);
    return PhrasesMapper.toListPhrasesResponseDto(list);
  }
}
