import type { paths } from './api-types.js';

export type ApiPath = keyof paths & string;

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

type PathHttpMethods<P extends ApiPath> = Extract<keyof paths[P], HttpMethod>;

export type ApiMethod<P extends ApiPath> = {
  [M in PathHttpMethods<P>]: paths[P][M] extends never ? never : M;
}[PathHttpMethods<P>];

export type ApiOperation<P extends ApiPath, M extends ApiMethod<P>> = NonNullable<paths[P][M]>;

export type ApiQuery<P extends ApiPath, M extends ApiMethod<P>> = ApiOperation<P, M> extends {
  parameters: { query?: infer Q };
}
  ? Q
  : never;

export type ApiResponse<P extends ApiPath, M extends ApiMethod<P>> = ApiOperation<P, M> extends {
  responses: infer R;
}
  ? R
  : never;

export type ApiResponseByStatus<
  P extends ApiPath,
  M extends ApiMethod<P>,
  Status extends keyof ApiResponse<P, M>
> = ApiResponse<P, M>[Status];

export type ApiJson<
  P extends ApiPath,
  M extends ApiMethod<P>,
  Status extends keyof ApiResponse<P, M>
> = ApiResponseByStatus<P, M, Status> extends { content: { 'application/json': infer J } } ? J : never;

export type ApiData<
  P extends ApiPath,
  M extends ApiMethod<P>,
  Status extends keyof ApiResponse<P, M>
> = ApiJson<P, M, Status> extends { data: infer D } ? D : never;

export type GetPath = {
  [P in ApiPath]: paths[P] extends { get: unknown } ? P : never;
}[ApiPath];

export type GetOperation<P extends GetPath> = paths[P] extends { get: infer Op }
  ? NonNullable<Op>
  : never;

export type GetResponses<P extends GetPath> = GetOperation<P> extends { responses: infer R } ? R : never;

export type GetQuery<P extends GetPath> = GetOperation<P> extends { parameters: { query?: infer Q } }
  ? Q
  : never;

export type GetJson<
  P extends GetPath,
  Status extends keyof GetResponses<P> = Extract<keyof GetResponses<P>, 200>
> = GetResponses<P>[Status] extends { content: { 'application/json': infer J } } ? J : never;

export type GetData<
  P extends GetPath,
  Status extends keyof GetResponses<P> = Extract<keyof GetResponses<P>, 200>
> = GetJson<P, Status> extends { data: infer D } ? D : never;

export type PatchPath = {
  [P in ApiPath]: paths[P] extends { patch: unknown } ? P : never;
}[ApiPath];

export type PatchOperation<P extends PatchPath> = paths[P] extends { patch: infer Op }
  ? NonNullable<Op>
  : never;

export type PatchResponses<P extends PatchPath> = PatchOperation<P> extends { responses: infer R }
  ? R
  : never;

export type PatchQuery<P extends PatchPath> = PatchOperation<P> extends { parameters: { query?: infer Q } }
  ? Q
  : never;

export type PatchBody<P extends PatchPath> = PatchOperation<P> extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type PatchJson<
  P extends PatchPath,
  Status extends keyof PatchResponses<P> = Extract<keyof PatchResponses<P>, 200>
> = PatchResponses<P>[Status] extends { content: { 'application/json': infer J } } ? J : never;

export type PatchData<
  P extends PatchPath,
  Status extends keyof PatchResponses<P> = Extract<keyof PatchResponses<P>, 200>
> = PatchJson<P, Status> extends { data: infer D } ? D : never;

export type PostPath = {
  [P in ApiPath]: paths[P] extends { post: unknown } ? P : never;
}[ApiPath];

export type PostOperation<P extends PostPath> = paths[P] extends { post: infer Op }
  ? NonNullable<Op>
  : never;

export type PostResponses<P extends PostPath> = PostOperation<P> extends { responses: infer R }
  ? R
  : never;

export type PostQuery<P extends PostPath> = PostOperation<P> extends { parameters: { query?: infer Q } }
  ? Q
  : never;

export type PostBody<P extends PostPath> = PostOperation<P> extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type PostJson<
  P extends PostPath,
  Status extends keyof PostResponses<P> = Extract<keyof PostResponses<P>, 200>
> = PostResponses<P>[Status] extends { content: { 'application/json': infer J } } ? J : never;

export type PostData<
  P extends PostPath,
  Status extends keyof PostResponses<P> = Extract<keyof PostResponses<P>, 200>
> = PostJson<P, Status> extends { data: infer D } ? D : never;

export type PostNoContent<
  P extends PostPath,
  Status extends keyof PostResponses<P> = Extract<keyof PostResponses<P>, 204>
> = Status extends never ? never : void;

export type DeletePath = {
  [P in ApiPath]: paths[P] extends { delete: unknown } ? P : never;
}[ApiPath];

export type DeleteOperation<P extends DeletePath> = paths[P] extends { delete: infer Op }
  ? NonNullable<Op>
  : never;

export type DeleteResponses<P extends DeletePath> = DeleteOperation<P> extends { responses: infer R }
  ? R
  : never;

export type DeleteQuery<P extends DeletePath> = DeleteOperation<P> extends { parameters: { query?: infer Q } }
  ? Q
  : never;

export type DeleteBody<P extends DeletePath> = DeleteOperation<P> extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type DeleteJson<
  P extends DeletePath,
  Status extends keyof DeleteResponses<P> = Extract<keyof DeleteResponses<P>, 200>
> = DeleteResponses<P>[Status] extends { content: { 'application/json': infer J } } ? J : never;

export type DeleteData<
  P extends DeletePath,
  Status extends keyof DeleteResponses<P> = Extract<keyof DeleteResponses<P>, 200>
> = DeleteJson<P, Status> extends { data: infer D } ? D : never;

export type DeleteNoContent<
  P extends DeletePath,
  Status extends keyof DeleteResponses<P> = Extract<keyof DeleteResponses<P>, 204>
> = Status extends never ? never : void;
