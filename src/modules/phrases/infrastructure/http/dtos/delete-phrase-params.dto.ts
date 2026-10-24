import { IsUUID } from 'class-validator';

export class DeletePhraseParamsDto {
  @IsUUID()
  id: string;
}
