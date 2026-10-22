export const teiInfo = {
  model_id: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
  model_sha: 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42',
  model_dtype: 'float32',
  model_type: { embedding: { pooling: 'mean' } },
  version: '1.9.4',
  sha: 'e80ef225ed0e6cb1717ce632a6a84b6cf211bb67',
  auto_truncate: false,
};
export const teiConfig = {
  AI_EMBEDDINGS_URL: 'http://tei/base/',
  AI_MODEL: teiInfo.model_id,
  AI_MODEL_REVISION: teiInfo.model_sha,
  AI_EMBEDDING_DIMENSIONS: '384',
  AI_EMBEDDING_VERSION:
    'tei-9674a558292f4607f88dc959067a9762554c3faecfc481af3c0bf66914f764b3',
  AI_INFERENCE_TIMEOUT_MS: 1000,
};
export const teiVector = [1, ...Array<number>(383).fill(0)];
export function teiResponse(vector: number[] = teiVector) {
  const bytes = Buffer.alloc(vector.length * 4);
  vector.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return {
    model: teiInfo.model_id,
    data: [{ index: 0, embedding: bytes.toString('base64') }],
    object: 'list',
    usage: { prompt_tokens: 1, total_tokens: 1 },
  };
}
