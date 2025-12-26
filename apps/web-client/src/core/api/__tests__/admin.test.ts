/**
 * Admin API Client Tests
 *
 * Unit tests for AdminApiClient methods.
 */

import { AdminApiClient, PolicyDetailDto } from '../admin'
import { apiGet, apiPost } from '../client'

// Mock the client module
jest.mock('../client', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>

describe('AdminApiClient', () => {
  let client: AdminApiClient

  beforeEach(() => {
    client = new AdminApiClient()
    jest.clearAllMocks()
  })

  describe('getPolicyById', () => {
    const mockPolicyDetail: PolicyDetailDto = {
      id: 'policy-123',
      name: 'Policy v2',
      version: '2',
      status: 'active',
      config: {
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
      createdAt: '2024-01-01T00:00:00Z',
      activatedAt: '2024-01-02T00:00:00Z',
    }

    it('should fetch policy by ID', async () => {
      mockApiGet.mockResolvedValue(mockPolicyDetail)

      const result = await client.getPolicyById('policy-123')

      expect(mockApiGet).toHaveBeenCalledWith('admin/catalog-policies/policy-123')
      expect(result).toEqual(mockPolicyDetail)
    })

    it('should return policy with full config', async () => {
      mockApiGet.mockResolvedValue(mockPolicyDetail)

      const result = await client.getPolicyById('policy-123')

      expect(result.config).toBeDefined()
      expect(result.config.allowedCountries).toEqual(['US', 'GB', 'UA'])
      expect(result.config.blockedCountries).toEqual(['RU', 'BY'])
      expect(result.config.breakoutRules).toHaveLength(1)
      expect(result.config.breakoutRules[0].id).toBe('high-quality')
    })

    it('should handle policy without activatedAt', async () => {
      const inactivePolicy: PolicyDetailDto = {
        ...mockPolicyDetail,
        status: 'inactive',
        activatedAt: undefined,
      }
      mockApiGet.mockResolvedValue(inactivePolicy)

      const result = await client.getPolicyById('policy-123')

      expect(result.status).toBe('inactive')
      expect(result.activatedAt).toBeUndefined()
    })

    it('should handle policy with empty breakout rules', async () => {
      const policyWithoutRules: PolicyDetailDto = {
        ...mockPolicyDetail,
        config: {
          ...mockPolicyDetail.config,
          breakoutRules: [],
        },
      }
      mockApiGet.mockResolvedValue(policyWithoutRules)

      const result = await client.getPolicyById('policy-123')

      expect(result.config.breakoutRules).toEqual([])
    })

    it('should propagate API errors', async () => {
      const error = new Error('Policy not found')
      mockApiGet.mockRejectedValue(error)

      await expect(client.getPolicyById('non-existent')).rejects.toThrow('Policy not found')
    })
  })

  describe('getPolicies', () => {
    it('should fetch all policies', async () => {
      const mockPolicies = {
        data: [
          { id: 'policy-1', name: 'Policy v1', version: '1', status: 'active', updatedAt: '2024-01-01' },
          { id: 'policy-2', name: 'Policy v2', version: '2', status: 'inactive', updatedAt: '2024-01-02' },
        ],
      }
      mockApiGet.mockResolvedValue(mockPolicies)

      const result = await client.getPolicies()

      expect(mockApiGet).toHaveBeenCalledWith('admin/catalog-policies')
      expect(result).toHaveLength(2)
    })
  })
})
