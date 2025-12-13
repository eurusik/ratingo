import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import authConfig from '../../src/config/auth.config';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { JwtService } from '@nestjs/jwt';
import { USERS_REPOSITORY } from '../../src/modules/users/domain/repositories/users.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from '../../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import { USER_MEDIA_STATE_REPOSITORY } from '../../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './_fakes';

export interface UsersE2eContext {
  app: INestApplication;
  authBase: string;
  usersBase: string;
  usersRepo: InMemoryUsersRepository;
  userMediaRepo: InMemoryUserMediaRepository;
  makeAccessToken: (payload: { sub: string; email: string; role: string }) => Promise<string>;
  registerAndLogin: () => Promise<{
    accessToken: string;
    email: string;
    username: string;
    password: string;
  }>;
  get: (path: string, token?: string) => any;
  post: (path: string, token?: string) => any;
  patch: (path: string, token?: string) => any;
  close: () => Promise<void>;
}

export async function createUsersApp(): Promise<UsersE2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
      AuthModule,
      UsersModule,
    ],
  })
    .overrideProvider(USERS_REPOSITORY)
    .useClass(InMemoryUsersRepository)
    .overrideProvider(REFRESH_TOKENS_REPOSITORY)
    .useClass(InMemoryRefreshTokensRepository)
    .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
    .useClass(InMemoryUserMediaRepository)
    .overrideProvider(DATABASE_CONNECTION)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  const usersRepo = app.get(USERS_REPOSITORY) as unknown as InMemoryUsersRepository;
  const userMediaRepo = app.get(
    USER_MEDIA_STATE_REPOSITORY,
  ) as unknown as InMemoryUserMediaRepository;
  const configService = app.get(ConfigService);
  const jwtService = app.get(JwtService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();

  const makeAccessToken = async (payload: { sub: string; email: string; role: string }) => {
    const secret = configService.get<string>('auth.accessTokenSecret');
    return jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m',
    });
  };

  const authBase = '/api/auth';
  const usersBase = '/api/users';

  const registerAndLogin = async () => {
    const email = `user${Date.now()}@example.com`;
    const username = `user${Date.now()}`;
    const password = 'S3curePassw0rd';

    await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${authBase}/login`)
      .send({ email, password })
      .expect(200);

    return {
      accessToken: loginRes.body.data.accessToken as string,
      email,
      username,
      password,
    };
  };

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const post = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).post(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const patch = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).patch(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  return {
    app,
    authBase,
    usersBase,
    usersRepo,
    userMediaRepo,
    makeAccessToken,
    registerAndLogin,
    get,
    post,
    patch,
    close: () => app.close(),
  };
}
