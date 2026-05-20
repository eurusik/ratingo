import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { InvalidEligibilityStatusError, InvalidBreakoutRuleError } from '../../domain/errors';
import type { CatalogPolicy, PolicyConfig } from '../../domain/types/policy.types';
import { CATALOG_POLICY_REPOSITORY } from '../../domain/repositories';

import { CatalogPolicyService } from './catalog-policy.service';

jest.mock('../../domain/validation/policy.schema', () => ({
  validatePolicyOrThrow: jest.fn((policy) => policy),
}));

import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';

describe('CatalogPolicyService', () => {
  let service: CatalogPolicyService;
  let mockPolicyRepository: {
    findActive: jest.Mock;
    findById: jest.Mock;
    findByVersion: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    activate: jest.Mock;
  };

  const mockPolicyConfig: PolicyConfig = {
    allowedCountries: ['US', 'UA'],
    blockedCountries: [],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['en', 'uk'],
    blockedLanguages: [],
    globalProviders: ['netflix'],
    breakoutRules: [],
    eligibilityMode: 'RELAXED',
    homepage: { minRelevanceScore: 0.5 },
  };

  const createMockPolicy = (overrides?: Partial<CatalogPolicy>): CatalogPolicy => ({
    id: 'policy-1',
    version: 1,
    isActive: true,
    policy: mockPolicyConfig,
    createdAt: new Date(),
    activatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    mockPolicyRepository = {
      findActive: jest.fn(),
      findById: jest.fn(),
      findByVersion: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      activate: jest.fn(),
    };

    (validatePolicyOrThrow as jest.Mock).mockImplementation((policy) => policy);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogPolicyService,
        {
          provide: CATALOG_POLICY_REPOSITORY,
          useValue: mockPolicyRepository,
        },
      ],
    }).compile();

    service = moduleRef.get<CatalogPolicyService>(CatalogPolicyService);
  });

  describe('getActiveOrThrow', () => {
    it('should return active policy when exists', async () => {
      const policy = createMockPolicy();
      mockPolicyRepository.findActive.mockResolvedValue(policy);

      const result = await service.getActiveOrThrow();

      expect(result).toStrictEqual(policy);
      expect(mockPolicyRepository.findActive).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no active policy', async () => {
      mockPolicyRepository.findActive.mockResolvedValue(null);

      await expect(service.getActiveOrThrow()).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActive', () => {
    it('should return active policy when exists', async () => {
      const policy = createMockPolicy();
      mockPolicyRepository.findActive.mockResolvedValue(policy);

      const result = await service.getActive();

      expect(result).toStrictEqual(policy);
    });

    it('should return null when no active policy', async () => {
      mockPolicyRepository.findActive.mockResolvedValue(null);

      const result = await service.getActive();

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return policy when found', async () => {
      const policy = createMockPolicy();
      mockPolicyRepository.findById.mockResolvedValue(policy);

      const result = await service.getById('policy-1');

      expect(result).toBe(policy);
      expect(mockPolicyRepository.findById).toHaveBeenCalledWith('policy-1');
    });

    it('should return null when not found', async () => {
      mockPolicyRepository.findById.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByVersion', () => {
    it('should return policy when found', async () => {
      const policy = createMockPolicy({ version: 5 });
      mockPolicyRepository.findByVersion.mockResolvedValue(policy);

      const result = await service.getByVersion(5);

      expect(result).toBe(policy);
      expect(mockPolicyRepository.findByVersion).toHaveBeenCalledWith(5);
    });

    it('should return null when not found', async () => {
      mockPolicyRepository.findByVersion.mockResolvedValue(null);

      const result = await service.getByVersion(999);

      expect(result).toBeNull();
    });
  });

  describe('createDraft', () => {
    it('should create and return policy draft', async () => {
      const policy = createMockPolicy({ isActive: false });
      mockPolicyRepository.create.mockResolvedValue(policy);

      const result = await service.createDraft(mockPolicyConfig);

      expect(result).toBe(policy);
      expect(validatePolicyOrThrow).toHaveBeenCalledWith(mockPolicyConfig);
      expect(mockPolicyRepository.create).toHaveBeenCalledWith(mockPolicyConfig);
    });

    it('should throw BadRequestException on InvalidEligibilityStatusError', async () => {
      (validatePolicyOrThrow as jest.Mock).mockImplementation(() => {
        throw new InvalidEligibilityStatusError('Invalid status');
      });

      await expect(service.createDraft(mockPolicyConfig)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on InvalidBreakoutRuleError', async () => {
      (validatePolicyOrThrow as jest.Mock).mockImplementation(() => {
        throw new InvalidBreakoutRuleError('rule-1', 'Invalid rule');
      });

      await expect(service.createDraft(mockPolicyConfig)).rejects.toThrow(BadRequestException);
    });

    it('should rethrow unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      (validatePolicyOrThrow as jest.Mock).mockImplementation(() => {
        throw unknownError;
      });

      await expect(service.createDraft(mockPolicyConfig)).rejects.toThrow(unknownError);
    });
  });

  describe('activate', () => {
    it('should activate and return policy', async () => {
      const policy = createMockPolicy({ isActive: true });
      mockPolicyRepository.activate.mockResolvedValue(undefined);
      mockPolicyRepository.findById.mockResolvedValue(policy);

      const result = await service.activate('policy-1');

      expect(result).toBe(policy);
      expect(mockPolicyRepository.activate).toHaveBeenCalledWith('policy-1');
      expect(mockPolicyRepository.findById).toHaveBeenCalledWith('policy-1');
    });

    it('should throw NotFoundException when policy not found after activation', async () => {
      mockPolicyRepository.activate.mockResolvedValue(undefined);
      mockPolicyRepository.findById.mockResolvedValue(null);

      await expect(service.activate('policy-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listAll', () => {
    it('should return all policies', async () => {
      const policies = [
        createMockPolicy({ id: 'policy-1', version: 2 }),
        createMockPolicy({ id: 'policy-2', version: 1 }),
      ];
      mockPolicyRepository.findAll.mockResolvedValue(policies);

      const result = await service.listAll();

      expect(result).toBe(policies);
      expect(mockPolicyRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no policies', async () => {
      mockPolicyRepository.findAll.mockResolvedValue([]);

      const result = await service.listAll();

      expect(result).toEqual([]);
    });
  });
});
