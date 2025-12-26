/**
 * Policy Controller Tests
 *
 * Unit tests for PolicyController endpoints:
 * - GET /admin/catalog-policies
 * - POST /admin/catalog-policies
 * - POST /admin/catalog-policies/:id/prepare
 */

import { Test, TestingModule } from '@nestjs/testing';
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
