import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PhraseText } from '../../../domain/value-objects/phrase-text.value-object';

@ValidatorConstraint({ name: 'isValidPhraseText', async: false })
export class IsValidPhraseText implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      PhraseText.forValidation(value as string);
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'text debe contener de 1 a 280 puntos de código Unicode, sin controles ni texto vacío.';
  }
}
