import { IsString, Validate } from 'class-validator';
import { IsValidPhraseText } from '../validation/is-valid-phrase-text.validator';
export class ValidatePhraseRequestDto {
  @IsString()
  @Validate(IsValidPhraseText)
  text: string;
}
