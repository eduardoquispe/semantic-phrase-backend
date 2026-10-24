import { CreatePhrasePort } from '../../../application/ports/inbound/create-phrase.port';
import { CreatePhraseRequestDto } from '../dtos/create-phrase-request.dto';
import { PhraseRegistrationFilter } from '../filters/phrase-registration.filter';
import { InvalidValidationTextFilter } from '../filters/invalid-validation-text.filter';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { DeletePhrasePort } from '../../../application/ports/inbound/delete-phrase.port';
import { DeletePhraseParamsDto } from '../dtos/delete-phrase-params.dto';
import { PhraseNotFoundFilter } from '../filters/phrase-not-found.filter';
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
    private readonly deletePhraseUseCase: DeletePhrasePort,
  ) {}

  @Post()
  @HttpCode(201)
  @UseFilters(PhraseRegistrationFilter, InvalidValidationTextFilter)
  async post(@Body() body: CreatePhraseRequestDto) {
    const response = await this.createPhraseUseCase.execute(body);
    return PhrasesMapper.toCreatePhraseResponse(response);
  }

  @Get()
  @HttpCode(200)
  async get(@Query() query: ListPhrasesQueryDto) {
    const list = await this.listPhrasesUseCase.execute(query);
    return PhrasesMapper.toListPhrasesResponseDto(list);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseFilters(PhraseNotFoundFilter)
  async delete(@Param() { id }: DeletePhraseParamsDto): Promise<void> {
    await this.deletePhraseUseCase.execute(id);
  }
}
