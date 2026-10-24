# Contrato de dependencia — TEI con OpenAIEmbeddings

Revisión aprobada por el usuario el 2026-10-22: usar `OpenAIEmbeddings` de
`@langchain/openai` directamente en `HuggingFaceEmbeddingAdapter`, sin cliente
TEI personalizado, fetch propio, comprobación automática de `/info` ni lógica
adicional de disponibilidad. Esta revisión sustituye los requisitos anteriores
sobre `TeiEmbeddings`, `caller.fetch`, payload `/embed`, deadline propio y cierre.
El contrato público de validación conserva ruta, campos y estados.

## Configuración

`AI_EMBEDDINGS_URL`: URL HTTP(S) del servicio TEI (no se valida el formato).
Host: `http://127.0.0.1:8080`; red Docker: `http://embeddings:80`.
El adaptador configura `baseURL = "<url sin barras finales>/v1"`, de modo que un pathname base se conserva (`http://tei/base` → `http://tei/base/v1`).
`AI_INFERENCE_TIMEOUT_MS`: sin default ni validación (si falta, `Number(undefined)` da `NaN`); 5000 es ejemplo.
El arranque solo comprueba `AI_EMBEDDING_DIMENSIONS=384` y la inferencia inicial; modelo, versión, umbral y TTL no se validan (no hay secreto de firma).

Una sola instancia de `OpenAIEmbeddings` por adaptador:

```ts
new OpenAIEmbeddings({
  model: config.model,
  apiKey: '',
  maxRetries: 0,
  timeout: config.timeoutMs,
  configuration: { baseURL: `${url.replace(/\/+$/, '')}/v1` },
});
```

No se usa un servicio OpenAI ni una clave real. LangChain Core 0.3.79 y
OpenAI 0.6.16 son compatibles. El SDK interno desactiva también sus reintentos.

## Perfil operativo

Verificar manualmente antes de activar; el adaptador no consulta `/info`:

| Campo                        | Valor                                                       |
| ---------------------------- | ----------------------------------------------------------- |
| model_id                     | sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 |
| model_sha                    | e8f8c211226b894fcb81acc59f3b34ba3efd5f42                    |
| model_dtype                  | float32                                                     |
| model_type.embedding.pooling | mean                                                        |
| version                      | 1.9.4, autorizado por el usuario                            |
| sha observado                | e80ef225ed0e6cb1717ce632a6a84b6cf211bb67                    |
| auto_truncate                | false para preservar entradas completas                     |

Confirmar ausencia de prompt predeterminado en argumentos/variables del contenedor.
El endpoint compatible normaliza, usa dirección Right y ningún prompt explícito.
No permite `truncate` por petición: usa `auto_truncate` del despliegue. Desactivarlo
con `--auto-truncate=false` en el servicio existente. El modelo se mantiene fijo;
cambios requieren revisión de compatibilidad y reinicio coordinado.
`model_sha` informa revisión declarada, no certifica criptográficamente los pesos.

## Identidad configurada

El operador calcula `AI_EMBEDDING_VERSION = 'tei-' + SHA256(JSON.stringify(descriptor))`
(UTF-8, sin espacios ni salto final), con estas claves exactamente en este orden:

```json
{
  "schema": 1,
  "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "revision": "e8f8c211226b894fcb81acc59f3b34ba3efd5f42",
  "runtime": "tei",
  "runtimeVersion": "1.9.4",
  "runtimeBuild": "e80ef225ed0e6cb1717ce632a6a84b6cf211bb67",
  "pooling": "mean",
  "dtype": "float32",
  "normalize": true,
  "dimensions": 384,
  "truncate": false,
  "truncationDirection": "Right",
  "prompt": null
}
```

Resultado: `tei-9674a558292f4607f88dc959067a9762554c3faecfc481af3c0bf66914f764b3`.
El backend valida el formato de la versión y la conserva; no recalcula ni contrasta
el digest con el servicio durante el arranque. La coherencia depende del perfil configurado.

## Inferencia y errores

`embedQuery(text)` envía a `POST /v1/embeddings`:
`{model: config.model, input: text, encoding_format: "base64"}`.
El SDK solicita base64 por defecto y lo decodifica a números. No se añaden
parámetros ni se implementa transporte alternativo. F002 solo utiliza consultas
individuales; no añade una API de lotes. El DTO de validación rechaza controles,
incluidos saltos de línea; los originales admisibles se conservan.

`onModuleInit` realiza `generate('Comprobación de inicio.')`; un error impide init
exitoso. `generate` convierte el resultado con `Embedding` (384 números finitos)
y `PhraseModel(config.model, config.version)`. No añade validación de norma,
vector nulo, cardinalidad, identidad remota ni estado ready. Traduce errores a
`AiUnavailableError`; durante HTTP se devuelve 503 seguro sin buscar/guardar.
El timeout y las redirecciones quedan a cargo del SDK/transporte estándar;
no se promete un deadline adicional para cuerpo/parseo ni aborto propio al cerrar.
No hay descarga, caché, preparación o fallback local.

Comparar vectores únicamente por modelo/versión exactos. No reetiquetar vectores
Xenova ni regenerarlos automáticamente. Corpus antiguo sin texto igual y sin
vectores compatibles mantiene 500 `INTERNAL_ERROR`; colección vacía es éxito.

Fuentes primarias: [TEI 1.9.4 OpenAI compatible](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/server.rs#L1049),
[tipos](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/types.rs#L294),
[OpenAIEmbeddings](https://reference.langchain.com/javascript/langchain-openai/OpenAIEmbeddings).
