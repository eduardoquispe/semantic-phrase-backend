import { AiUnavailableFilter } from '../filters/ai-unavailable.filter';
import { InvalidValidationTextFilter } from '../filters/invalid-validation-text.filter';
import { UseFilters } from '@nestjs/common';
import { Body, Controller, Post, Query } from '@nestjs/common';
import { ValidatePhrasePort } from '../../../application/ports/inbound/validate-phrase.port';
import { ValidatePhraseRequestDto } from '../dtos/validate-phrase-request.dto';
import { ValidatePhraseQueryDto } from '../dtos/validate-phrase-query.dto';
import { PhraseValidationResponseDto } from '../dtos/phrase-validation-response.dto';
import { PhrasesMapper } from '../mapper/phrases.mapper';
@Controller('v1/phrase-validations')
@UseFilters(InvalidValidationTextFilter, AiUnavailableFilter)
export class PhraseValidationsController {
  constructor(private readonly validatePhrase: ValidatePhrasePort) {}

  @Post()
  async validate(
    @Body() body: ValidatePhraseRequestDto,
    @Query() query: ValidatePhraseQueryDto,
  ): Promise<PhraseValidationResponseDto> {
    void query;
    return PhrasesMapper.toValidationResponse(
      await this.validatePhrase.execute(body),
    );
  }
}
