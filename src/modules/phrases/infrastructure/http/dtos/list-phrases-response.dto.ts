export interface PhraseResponse {
  id: string;
  text: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ListPhrasesResponseDto {
  constructor(
    public readonly data: PhraseResponse[],
    public readonly meta: PaginationMeta,
  ) {}
}
