# Research vigente — F002 con OpenAIEmbeddings

Decisión del usuario del 2026-10-22: OpenAIEmbeddings de LangChain contra TEI 1.9.4,
con el adaptador mínimo proporcionado. Sustituye el diseño de cliente TEI propio.

- `@langchain/openai` 0.6.16 declara peer Core >=0.3.68 <0.4.0; conservar 0.3.79.
- `configuration.baseURL` apunta a `<base>/v1`; el SDK llama a `/embeddings`.
- `apiKey: ''` satisface el constructor; no se usa una cuenta OpenAI.
- LangChain maxRetries=0; su implementación configura también el SDK con maxRetries=0.
- Sin encodingFormat explícito, el SDK solicita base64 y decodifica float32.
- TEI 1.9.4 normaliza en /v1/embeddings; truncation Right y prompt explícito None.
  No acepta truncate por petición; usa `info.auto_truncate`. Requiere desactivarlo
  operativamente para conservar el contrato de entradas completas.
- Conservar verificación manual /info/imagen/prompts y descriptor tei-SHA256.
  La versión configurada se guarda sin comprobación automática contra /info.
- El adaptador solo calienta con generate al iniciar, envuelve el vector en
  Embedding y modelo/versión en PhraseModel, y traduce errores. No incluye fetch,
  ready, timers/deadline propios, validación de norma/cero/cardinalidad ni shutdown.
- No prometer timeout adicional sobre el parseo del cuerpo ni rechazo propio de
  redirecciones: se usan las garantías estándar del SDK.
- Mantener selección textual/Top-1, corpus vacío/incompatible, UUID persistido, fechas y puertos de inferencia/persistencia.
  Los vectores Xenova se conservan separados; no hay backfill automático.
- Retirar Transformers, sus transitivas exclusivas, código/script/manifiesto locales
  y cliente TEI provisional. No eliminar cachés ajenas ni evidencia histórica.

Fuentes primarias verificadas: código instalado de LangChain OpenAI 0.6.16
`dist/embeddings.js`, Core 0.3.79 y SDK OpenAI `resources/embeddings.js`;
[TEI 1.9.4 servidor](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/server.rs#L1049),
[tipos](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/http/types.rs#L294),
[argumentos](https://github.com/huggingface/text-embeddings-inference/blob/v1.9.4/router/src/main.rs#L74).
