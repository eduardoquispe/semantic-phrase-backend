import { IsBoolean, IsUUID, ValidateIf, Validate } from 'class-validator';
import { IsValidPhraseText } from '../validation/is-valid-phrase-text.validator';
export class CreatePhraseRequestDto {
  @Validate(IsValidPhraseText)
  text!: string;
  @IsUUID('4')
  validationId!: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  confirmed?: boolean;
}
