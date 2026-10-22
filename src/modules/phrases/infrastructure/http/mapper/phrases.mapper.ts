import { CreatePhraseResponseDto } from '../dtos/create-phrase-response.dto';
import type { ValidatePhraseResult } from '../../../application/ports/inbound/validate-phrase.port';
import { PhraseValidationResponseDto } from '../dtos/phrase-validation-response.dto';
import { Phrase } from '../../../domain/entities/phrase.entity';
import { ListPhrasesResponseDto } from '../dtos/list-phrases-response.dto';
import { ListPhrasesResult } from '../../../application/ports/inbound/list-phrases.port';

export class PhrasesMapper {
  static toCreatePhraseResponse(phrase: Phrase): CreatePhraseResponseDto {
    return {
      data: {
        id: phrase.id,
        text: phrase.text.value,
        createdAt: phrase.createdAt.toISOString(),
      },
    };
  }
  static toValidationResponse(
    result: ValidatePhraseResult,
  ): PhraseValidationResponseDto {
    const match = result.match;
    return {
      data: {
        validationId: result.validationId,
        expiresAt: result.expiresAt.toISOString(),
        requiresConfirmation: result.requiresConfirmation,
        match:
          match === null
            ? null
            : {
                type: match.type,
                phrase: { id: match.phrase.id, text: match.phrase.text },
                similarityScore: match.similarityScore?.value ?? null,
              },
      },
    };
  }

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
