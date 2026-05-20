/**
 * Manages catalog policies with validation and business logic.
 */

import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';

import { InvalidEligibilityStatusError, InvalidBreakoutRuleError } from '../../domain/errors';
import {
  CATALOG_POLICY_REPOSITORY,
  type ICatalogPolicyRepository,
} from '../../domain/repositories';
import { type CatalogPolicy } from '../../domain/types/policy.types';
import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';

@Injectable()
export class CatalogPolicyService {
  private readonly logger = new Logger(CatalogPolicyService.name);

  constructor(
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
  ) {}

  async getActiveOrThrow(): Promise<CatalogPolicy> {
    const policy = await this.policyRepository.findActive();
    if (!policy) {
      throw new NotFoundException('No active policy found. Please seed the default policy first.');
    }
    return this.sortBreakoutRules(policy);
  }

  async getActive(): Promise<CatalogPolicy | null> {
    const policy = await this.policyRepository.findActive();
    return policy ? this.sortBreakoutRules(policy) : null;
  }

  async getById(id: string): Promise<CatalogPolicy | null> {
    return this.policyRepository.findById(id);
  }

  async getByVersion(version: number): Promise<CatalogPolicy | null> {
    return this.policyRepository.findByVersion(version);
  }

  async createDraft(rawPolicy: unknown): Promise<CatalogPolicy> {
    try {
      const validatedPolicy = validatePolicyOrThrow(rawPolicy);
      const created = await this.policyRepository.create(validatedPolicy);

      this.logger.log(`Created policy draft v${created.version}`);

      return created;
    } catch (error) {
      if (error instanceof InvalidEligibilityStatusError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidBreakoutRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async activate(id: string): Promise<CatalogPolicy> {
    await this.policyRepository.activate(id);

    const activated = await this.policyRepository.findById(id);
    if (!activated) {
      throw new NotFoundException(`Policy ${id} not found after activation`);
    }

    this.logger.log(`Activated policy v${activated.version}`);

    return activated;
  }

  async listAll(): Promise<CatalogPolicy[]> {
    return this.policyRepository.findAll();
  }

  private sortBreakoutRules(policy: CatalogPolicy): CatalogPolicy {
    return {
      ...policy,
      policy: {
        ...policy.policy,
        breakoutRules: [...policy.policy.breakoutRules].sort((a, b) => a.priority - b.priority),
      },
    };
  }
}
