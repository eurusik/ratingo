/**
 * Policy Controller Tests
 *
 * Unit tests for PolicyController endpoints:
 * - GET /admin/catalog-policies
 * - GET /admin/catalog-policies/:id
 * - POST /admin/catalog-policies
 * - POST /admin/catalog-policies/:id/prepare
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PolicyController } from './policy.controller';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { CatalogPolicyService } from '../../application/services/catalog-policy.service';
import { CATALOG_POLICY_REPOSITORY } from '../../infrastructure/repositories/catalog-policy.repository';

describe('PolicyController', () => {
  let controller: PolicyController;
  let mockPolicyActivationService: any;
  let mockCatalogPolicyService: any;
  let mockPolicyRepository: any;

  beforeEach(async () => {
    mockPolicyActivationService = {
      preparePolicy: jest.fn(),
    };

    mockCatalogPolicyService = {
      createDraft: jest.fn(),
    };

    mockPolicyRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolicyController],
      providers: [
        { provide: PolicyActivationService, useValue: mockPolicyActivationService },
        { provide: CatalogPolicyService, useValue: mockCatalogPolicyService },
        { provide: CATALOG_POLICY_REPOSITORY, useValue: mockPolicyRepository },
      ],
    }).compile();

    controller = module.get<PolicyController>(PolicyController);
  });

  describe('getPolicies', () => {
    it('should return list of policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          version: 1,
          isActive: true,
          policy: { eligibilityMode: 'STRICT', allowedCountries: ['US', 'GB'] },
          createdAt: new Date('2024-01-01'),
          activatedAt: new Date('2024-01-02'),
        },
        {
          id: 'policy-2',
          version: 2,
          isActive: false,
          policy: { eligibilityMode: 'RELAXED', allowedCountries: ['US'] },
          createdAt: new Date('2024-01-03'),
          activatedAt: null,
        },
      ];

      mockPolicyRepository.findAll.mockResolvedValue(mockPolicies);

      const result = await controller.getPolicies();

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'policy-1',
        name: 'Policy v1',
        version: '1',
        status: 'active',
        description: 'STRICT mode, 2 allowed countries',
        updatedAt: new Date('2024-01-02'),
      });
      expect(result.data[1].status).toBe('inactive');
    });

    it('should return empty list when no policies exist', async () => {
      mockPolicyRepository.findAll.mockResolvedValue([]);

      const result = await controller.getPolicies();

      expect(result.data).toEqual([]);
    });
  });

  describe('getPolicyById', () => {
    const mockFullPolicy = {
      id: 'policy-1',
      version: 2,
      isActive: true,
      policy: {
        allowedCountries: ['US', 'GB', 'UA'],
        blockedCountries: ['RU', 'BY'],
        blockedCountryMode: 'ANY',
        allowedLanguages: ['en', 'uk'],
        blockedLanguages: ['ru'],
        globalProviders: ['netflix', 'prime', 'disney'],
        breakoutRules: [
          {
            id: 'high-quality',
            name: 'High Quality Exception',
            priority: 1,
            requirements: {
              minImdbVotes: 10000,
              minQualityScoreNormalized: 0.7,
            },
          },
        ],
        eligibilityMode: 'STRICT',
        homepage: { minRelevanceScore: 50 },
      },
      createdAt: new Date('2024-01-01'),
      activatedAt: new Date('2024-01-02'),
    };

    it('should return policy with full config', async () => {
      mockPolicyRepository.findById.mockResolvedValue(mockFullPolicy);

      const result = await controller.getPolicyById('policy-1');

      expect(result.id).toBe('policy-1');
      expect(result.name).toBe('Policy v2');
      expect(result.version).toBe('2');
      expect(result.status).toBe('active');
      expect(result.createdAt).toEqual(mockFullPolicy.createdAt);
      expect(result.activatedAt).toEqual(mockFullPolicy.activatedAt);

      // Verify config is included
      expect(result.config).toBeDefined();
      expect(result.config.allowedCountries).toEqual(['US', 'GB', 'UA']);
      expect(result.config.blockedCountries).toEqual(['RU', 'BY']);
      expect(result.config.blockedCountryMode).toBe('ANY');
      expect(result.config.allowedLanguages).toEqual(['en', 'uk']);
      expect(result.config.blockedLanguages).toEqual(['ru']);
      expect(result.config.globalProviders).toEqual(['netflix', 'prime', 'disney']);
      expect(result.config.eligibilityMode).toBe('STRICT');
      expect(result.config.homepage.minRelevanceScore).toBe(50);

      // Verify breakout rules
      expect(result.config.breakoutRules).toHaveLength(1);
      expect(result.config.breakoutRules[0].id).toBe('high-quality');
      expect(result.config.breakoutRules[0].name).toBe('High Quality Exception');
      expect(result.config.breakoutRules[0].priority).toBe(1);
      expect(result.config.breakoutRules[0].requirements.minImdbVotes).toBe(10000);
    });

    it('should return inactive status for non-active policy', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        ...mockFullPolicy,
        isActive: false,
        activatedAt: null,
      });

      const result = await controller.getPolicyById('policy-1');

      expect(result.status).toBe('inactive');
      expect(result.activatedAt).toBeUndefined();
    });

    it('should throw NotFoundException when policy not found', async () => {
      mockPolicyRepository.findById.mockResolvedValue(null);

      await expect(controller.getPolicyById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(controller.getPolicyById('non-existent')).rejects.toThrow(
        'Policy with ID non-existent not found',
      );
    });

    it('should handle policy with empty breakout rules', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        ...mockFullPolicy,
        policy: {
          ...mockFullPolicy.policy,
          breakoutRules: [],
        },
      });

      const result = await controller.getPolicyById('policy-1');

      expect(result.config.breakoutRules).toEqual([]);
    });

    it('should handle policy with multiple breakout rules', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        ...mockFullPolicy,
        policy: {
          ...mockFullPolicy.policy,
          breakoutRules: [
            {
              id: 'rule-1',
              name: 'Rule 1',
              priority: 1,
              requirements: { minImdbVotes: 5000 },
            },
            {
              id: 'rule-2',
              name: 'Rule 2',
              priority: 2,
              requirements: { requireAnyOfProviders: ['netflix'] },
            },
          ],
        },
      });

      const result = await controller.getPolicyById('policy-1');

      expect(result.config.breakoutRules).toHaveLength(2);
      expect(result.config.breakoutRules[0].id).toBe('rule-1');
      expect(result.config.breakoutRules[1].id).toBe('rule-2');
    });
  });

  describe('createPolicy', () => {
    it('should create policy and return response', async () => {
      const dto = {
        allowedCountries: ['US', 'GB'],
        blockedCountries: ['RU'],
        blockedCountryMode: 'ANY' as const,
        allowedLanguages: ['en'],
        blockedLanguages: ['ru'],
        globalProviders: ['Netflix'],
        breakoutRules: [],
        eligibilityMode: 'STRICT' as const,
        homepage: { minRelevanceScore: 50 },
      };

      mockCatalogPolicyService.createDraft.mockResolvedValue({
        id: 'new-policy-id',
        version: 3,
      });

      const result = await controller.createPolicy(dto);

      expect(result.id).toBe('new-policy-id');
      expect(result.version).toBe(3);
      expect(result.message).toContain('v3 created successfully');
      expect(mockCatalogPolicyService.createDraft).toHaveBeenCalledWith(dto);
    });
  });

  describe('preparePolicy', () => {
    it('should start policy preparation and return run info', async () => {
      mockPolicyActivationService.preparePolicy.mockResolvedValue({
        runId: 'run-123',
        status: 'running',
      });

      const result = await controller.preparePolicy('policy-1', { batchSize: 500 });

      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('running');
      expect(result.message).toContain('preparation started');
      expect(mockPolicyActivationService.preparePolicy).toHaveBeenCalledWith('policy-1', {
        batchSize: 500,
      });
    });

    it('should work without options', async () => {
      mockPolicyActivationService.preparePolicy.mockResolvedValue({
        runId: 'run-456',
        status: 'running',
      });

      const result = await controller.preparePolicy('policy-2', undefined);

      expect(result.runId).toBe('run-456');
      expect(mockPolicyActivationService.preparePolicy).toHaveBeenCalledWith('policy-2', undefined);
    });
  });
});
