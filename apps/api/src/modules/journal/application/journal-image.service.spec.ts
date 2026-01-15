import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationException } from '@/common/exceptions';

import { JOURNAL_ERRORS } from '../domain/constants/journal-errors';

import {
  ALLOWED_IMAGE_TYPES,
  EXTENSION_TO_MIME,
  JournalImageService,
  JOURNAL_IMAGES_PREFIX,
  MAX_IMAGE_SIZE,
  MIME_TO_EXTENSION,
  UploadedFile,
} from './journal-image.service';

describe('JournalImageService', () => {
  let service: JournalImageService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JournalImageService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<JournalImageService>(JournalImageService);
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    const createValidFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test'),
      ...overrides,
    });

    describe('file type validation', () => {
      it('should accept valid JPEG files', () => {
        const file = createValidFile({ mimetype: 'image/jpeg' });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should accept valid PNG files', () => {
        const file = createValidFile({ mimetype: 'image/png' });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should accept valid WebP files', () => {
        const file = createValidFile({ mimetype: 'image/webp' });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should accept valid GIF files', () => {
        const file = createValidFile({ mimetype: 'image/gif' });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should reject invalid file types', () => {
        const file = createValidFile({ mimetype: 'application/pdf' });

        expect(() => service.validateFile(file)).toThrow(ValidationException);
        expect(() => service.validateFile(file)).toThrow(
          'Invalid file type. Allowed: jpg, png, webp, gif',
        );
      });

      it('should reject text/plain files', () => {
        const file = createValidFile({ mimetype: 'text/plain' });

        expect(() => service.validateFile(file)).toThrow(ValidationException);
      });

      it('should reject video files', () => {
        const file = createValidFile({ mimetype: 'video/mp4' });

        expect(() => service.validateFile(file)).toThrow(ValidationException);
      });

      it('should include error code in exception details', () => {
        const file = createValidFile({ mimetype: 'application/pdf' });

        try {
          service.validateFile(file);
          fail('Expected ValidationException to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationException);
          expect((error as ValidationException).details).toEqual(
            expect.objectContaining({
              code: JOURNAL_ERRORS.INVALID_IMAGE_TYPE,
              mimetype: 'application/pdf',
              allowedTypes: [...ALLOWED_IMAGE_TYPES],
            }),
          );
        }
      });
    });

    describe('file size validation', () => {
      it('should accept files under 5MB', () => {
        const file = createValidFile({ size: MAX_IMAGE_SIZE - 1 });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should accept files exactly at 5MB limit', () => {
        const file = createValidFile({ size: MAX_IMAGE_SIZE });
        expect(() => service.validateFile(file)).not.toThrow();
      });

      it('should reject files over 5MB', () => {
        const file = createValidFile({ size: MAX_IMAGE_SIZE + 1 });

        expect(() => service.validateFile(file)).toThrow(ValidationException);
        expect(() => service.validateFile(file)).toThrow('File too large. Max size: 5MB');
      });

      it('should include error code in exception details for oversized files', () => {
        const oversizedFile = createValidFile({ size: MAX_IMAGE_SIZE + 1000 });

        try {
          service.validateFile(oversizedFile);
          fail('Expected ValidationException to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationException);
          expect((error as ValidationException).details).toEqual(
            expect.objectContaining({
              code: JOURNAL_ERRORS.IMAGE_TOO_LARGE,
              size: MAX_IMAGE_SIZE + 1000,
              maxSize: MAX_IMAGE_SIZE,
            }),
          );
        }
      });

      it('should accept small files', () => {
        const file = createValidFile({ size: 100 });
        expect(() => service.validateFile(file)).not.toThrow();
      });
    });
  });

  describe('isAllowedType', () => {
    it('should return true for allowed types', () => {
      expect(service.isAllowedType('image/jpeg')).toBe(true);
      expect(service.isAllowedType('image/png')).toBe(true);
      expect(service.isAllowedType('image/webp')).toBe(true);
      expect(service.isAllowedType('image/gif')).toBe(true);
    });

    it('should return false for disallowed types', () => {
      expect(service.isAllowedType('application/pdf')).toBe(false);
      expect(service.isAllowedType('text/plain')).toBe(false);
      expect(service.isAllowedType('video/mp4')).toBe(false);
      expect(service.isAllowedType('image/svg+xml')).toBe(false);
      expect(service.isAllowedType('image/bmp')).toBe(false);
    });
  });

  describe('getExtensionForMimetype', () => {
    it('should return correct extension for JPEG', () => {
      expect(service.getExtensionForMimetype('image/jpeg')).toBe('jpg');
    });

    it('should return correct extension for PNG', () => {
      expect(service.getExtensionForMimetype('image/png')).toBe('png');
    });

    it('should return correct extension for WebP', () => {
      expect(service.getExtensionForMimetype('image/webp')).toBe('webp');
    });

    it('should return correct extension for GIF', () => {
      expect(service.getExtensionForMimetype('image/gif')).toBe('gif');
    });

    it('should return undefined for unknown types', () => {
      expect(service.getExtensionForMimetype('application/pdf')).toBeUndefined();
      expect(service.getExtensionForMimetype('image/svg+xml')).toBeUndefined();
    });
  });

  describe('MIME_TO_EXTENSION mapping', () => {
    it('should have mappings for all allowed types', () => {
      for (const type of ALLOWED_IMAGE_TYPES) {
        expect(MIME_TO_EXTENSION[type]).toBeDefined();
        expect(typeof MIME_TO_EXTENSION[type]).toBe('string');
        expect(MIME_TO_EXTENSION[type].length).toBeGreaterThan(0);
      }
    });
  });

  describe('EXTENSION_TO_MIME mapping', () => {
    it('should have reverse mappings for common extensions', () => {
      expect(EXTENSION_TO_MIME['jpg']).toBe('image/jpeg');
      expect(EXTENSION_TO_MIME['jpeg']).toBe('image/jpeg');
      expect(EXTENSION_TO_MIME['png']).toBe('image/png');
      expect(EXTENSION_TO_MIME['webp']).toBe('image/webp');
      expect(EXTENSION_TO_MIME['gif']).toBe('image/gif');
    });
  });

  describe('getFilenameFromKey', () => {
    it('should extract filename from full key', () => {
      expect(service.getFilenameFromKey('journal/uuid.jpg')).toBe('uuid.jpg');
      expect(service.getFilenameFromKey('journal/test-image.png')).toBe('test-image.png');
    });

    it('should handle key without prefix gracefully', () => {
      expect(service.getFilenameFromKey('uuid.jpg')).toBe('uuid.jpg');
    });
  });

  describe('buildKeyFromFilename', () => {
    it('should build full key from filename', () => {
      expect(service.buildKeyFromFilename('uuid.jpg')).toBe('journal/uuid.jpg');
      expect(service.buildKeyFromFilename('test.png')).toBe('journal/test.png');
    });
  });

  describe('JOURNAL_IMAGES_PREFIX', () => {
    it('should be journal/', () => {
      expect(JOURNAL_IMAGES_PREFIX).toBe('journal/');
    });
  });
});
