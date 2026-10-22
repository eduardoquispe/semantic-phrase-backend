export class ListPhrasesResponseDto {
  data: { id: string; text: string; createdAt: string }[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(
    data: { id: string; text: string; createdAt: string }[],
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
  ) {
    this.data = data;
    this.meta = meta;
  }
}
