import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MAX_PHRASE_TEXT_LENGTH,
  MIN_PHRASE_TEXT_LETTERS,
} from '../../../domain/constants/phrase-text.constants';
import { PhraseText } from '../../../domain/value-objects/phrase-text.value-object';

@ValidatorConstraint({ name: 'isValidPhraseText', async: false })
export class IsValidPhraseText implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      new PhraseText(value as string);
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return `text debe contener de 1 a ${MAX_PHRASE_TEXT_LENGTH} puntos de código Unicode, con al menos ${MIN_PHRASE_TEXT_LETTERS} letras, sin emojis, controles ni texto vacío.`;
  }
}
