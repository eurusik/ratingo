import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';

describe('AllExceptionsFilter', () => {
  const replyMock = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    return res;
  };

  const hostMock = (response: any): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    }) as any;

  let filter: AllExceptionsFilter;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.NODE_ENV;
  });

  it('should handle AppException and log warn', () => {
    const response = replyMock();
    const exception = new AppException(ErrorCode.UNKNOWN_ERROR, 'oops', HttpStatus.BAD_REQUEST);

    filter.catch(exception, hostMock(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'oops',
        statusCode: HttpStatus.BAD_REQUEST,
        details: undefined,
      },
    });
    expect(loggerWarnSpy).toHaveBeenCalled();
  });

  it('should handle HttpException with validation messages array', () => {
    const response = replyMock();
    const validationException = new HttpException(
      { message: ['field must be defined', 'other issue'] },
      HttpStatus.BAD_REQUEST
    );

    filter.catch(validationException, hostMock(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'field must be defined, other issue',
        statusCode: HttpStatus.BAD_REQUEST,
        details: { errors: ['field must be defined', 'other issue'] },
      },
    });
    expect(loggerWarnSpy).toHaveBeenCalled();
  });

  it('should handle unknown errors and mask message in production', () => {
    process.env.NODE_ENV = 'production';
    const response = replyMock();
    const exception = new Error('secret stack');

    filter.catch(exception, hostMock(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
