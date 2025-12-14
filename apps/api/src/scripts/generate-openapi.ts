import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { BullRegistrar, getQueueToken } from '@nestjs/bullmq';

import { AppModule } from '../app.module';
import { DATABASE_CONNECTION } from '../database/database.module';
import { INGESTION_QUEUE } from '../modules/ingestion/ingestion.constants';
import { STATS_QUEUE } from '../modules/stats/stats.constants';

const GLOBAL_PREFIX = 'api';
const OUTPUT_PATH = path.resolve(__dirname, '../../../../packages/api-contract/openapi.json');

const DEFAULT_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  TMDB_API_KEY: 'dummy',
  TRAKT_CLIENT_ID: 'dummy',
  TRAKT_CLIENT_SECRET: 'dummy',
  OMDB_API_KEY: 'dummy',
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

interface JsonSchema {
  type?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MediaObject {
  schema?: JsonSchema;
}

interface ResponseObject {
  content?: Record<string, MediaObject>;
}

interface OperationObject {
  responses?: Record<string, ResponseObject>;
}

type PathItemObject = Partial<Record<(typeof HTTP_METHODS)[number], OperationObject>>;

/**
 * Apply default environment variables required to bootstrap the Nest app for OpenAPI generation.
 */
const applyDefaultEnv = () =>
  Object.entries(DEFAULT_ENV).forEach(([k, v]) => (process.env[k] ??= v));

/**
 * Resolve output path for generated OpenAPI JSON.
 *
 * Uses `OPENAPI_OUTPUT_PATH` if provided, otherwise writes into the contract package.
 */
const getOutputPath = () =>
  process.env.OPENAPI_OUTPUT_PATH ? path.resolve(process.env.OPENAPI_OUTPUT_PATH) : OUTPUT_PATH;

/**
 * Check if the given media type represents JSON.
 */
const isJsonMedia = (type: string) => type === 'application/json' || type.endsWith('+json');

/**
 * Check if the given HTTP status code represents a success response.
 */
const isSuccessStatus = (code: string) => code.startsWith('2');

/**
 * Check if a schema is already wrapped as `{ success: true, data: ... }`.
 */
const isAlreadyWrapped = (schema: JsonSchema) =>
  schema.type === 'object' &&
  schema.properties?.success !== undefined &&
  schema.properties?.data !== undefined;

/**
 * Wrap a response schema into the standardized API success format.
 */
const wrapSchema = (schema: JsonSchema): JsonSchema => ({
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: schema,
  },
});

/**
 * Collect all operation objects from all paths.
 */
const getOperations = (doc: OpenAPIObject): OperationObject[] =>
  Object.values(doc.paths ?? {}).flatMap(
    (pathItem) =>
      HTTP_METHODS.map((method) => (pathItem as PathItemObject)[method]).filter(
        Boolean,
      ) as OperationObject[],
  );

/**
 * Collect all JSON media objects for successful (2xx) responses for a given operation.
 */
const getSuccessJsonMediaObjects = (op: OperationObject): MediaObject[] =>
  Object.entries(op.responses ?? {})
    .filter(([code]) => isSuccessStatus(code))
    .flatMap(([, res]) => Object.entries(res.content ?? {}))
    .filter(([type]) => isJsonMedia(type))
    .map(([, media]) => media);

/**
 * Wrap all 2xx JSON responses in the OpenAPI document into `{ success: true, data: ... }`.
 */
const wrapSuccessResponses = (doc: OpenAPIObject): void => {
  getOperations(doc)
    .flatMap(getSuccessJsonMediaObjects)
    .filter((media) => media.schema && !isAlreadyWrapped(media.schema))
    .forEach((media) => {
      media.schema = wrapSchema(media.schema!);
    });
};

/**
 * Build Swagger/OpenAPI metadata.
 */
const buildSwaggerConfig = () =>
  new DocumentBuilder()
    .setTitle('Ratingo API')
    .setDescription('Rest API for Ratingo mobile and web clients')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

/**
 * Create a Nest application instance configured for offline OpenAPI generation.
 *
 * Stubs database and BullMQ-related providers to avoid requiring Postgres/Redis.
 */
const createApp = async (): Promise<NestFastifyApplication> => {
  const noopBullRegistrar = { onModuleInit: () => {}, register: () => {} };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE_CONNECTION)
    .useValue({})
    .overrideProvider(BullRegistrar)
    .useValue(noopBullRegistrar)
    .overrideProvider(getQueueToken(INGESTION_QUEUE))
    .useValue({})
    .overrideProvider(getQueueToken(STATS_QUEUE))
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.init();

  return app;
};

/**
 * Generate OpenAPI JSON into the contract package.
 *
 * Post-processes the document to match the runtime API response wrapper
 * (`{ success: true, data: ... }`).
 */
const generateOpenApi = async (): Promise<void> => {
  applyDefaultEnv();

  const app = await createApp();
  const doc = SwaggerModule.createDocument(app, buildSwaggerConfig());

  wrapSuccessResponses(doc);

  await writeFile(getOutputPath(), JSON.stringify(doc, null, 2) + '\n', 'utf8');
  await app.close();
};

generateOpenApi();
