import { CreatePhrasePort } from '../../../application/ports/inbound/create-phrase.port';
import { CreatePhraseRequestDto } from '../dtos/create-phrase-request.dto';
import { PHRASE_REGISTRATION_FILTERS } from '../filters/phrase-registration.filters';
import { InvalidValidationTextFilter } from '../filters/invalid-validation-text.filter';
import { Body, Controller, Get, Post, Query, UseFilters } from '@nestjs/common';
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
  constructor(
    private readonly listPhrasesUseCase: ListPhrasesPort,
    private readonly createPhraseUseCase: CreatePhrasePort,
  ) {}

  @Post()
  @UseFilters(...PHRASE_REGISTRATION_FILTERS, InvalidValidationTextFilter)
  async post(@Body() body: CreatePhraseRequestDto) {
    const response = await this.createPhraseUseCase.execute(body);
    return PhrasesMapper.toCreatePhraseResponse(response);
  }

  @Get()
  async get(@Query() query: ListPhrasesQueryDto) {
    const list = await this.listPhrasesUseCase.execute(query);
    return PhrasesMapper.toListPhrasesResponseDto(list);
  }
}
