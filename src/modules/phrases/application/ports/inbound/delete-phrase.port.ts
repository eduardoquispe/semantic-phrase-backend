export abstract class DeletePhrasePort {
  abstract execute(id: string): Promise<void>;
}
