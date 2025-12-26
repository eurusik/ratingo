/**
 * Catalog Policy Service
 *
 * Application service for managing catalog policies.
 * Provides high-level operations with validation and business logic.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  ICatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from '../../infrastructure/repositories/catalog-policy.repository';
import { CatalogPolicy, PolicyConfig } from '../../domain/types/policy.types';
import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';
import { InvalidEligibilityStatusError, InvalidBreakoutRuleError } from '../../domain/errors';

@Injectable()
export class CatalogPolicyService {
  private readonly logger = new Logger(CatalogPolicyService.name);

  constructor(
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
  ) {}

  /**
   * Gets the active policy or throws if none exists.
   *
   * @returns Active policy
   * @throws {NotFoundException} If no active policy found
   *
   * @example
   * const policy = await service.getActiveOrThrow();
   */
  async getActiveOrThrow(): Promise<CatalogPolicy> {
    const policy = await this.policyRepository.findActive();

    if (!policy) {
      throw new NotFoundException('No active policy found. Please seed the default policy first.');
    }

    return policy;
  }

  /**
   * Gets the active policy or null if none exists.
   *
   * @returns Active policy or null
   */
  async getActive(): Promise<CatalogPolicy | null> {
    return this.policyRepository.findActive();
  }

  /**
   * Gets a policy by version number.
   *
   * @param version - Policy version number
   * @returns Policy or null if not found
   */
  async getByVersion(version: number): Promise<CatalogPolicy | null> {
    return this.policyRepository.findByVersion(version);
  }

  /**
   * Creates a new policy draft.
   *
   * @param rawPolicy - Raw policy configuration (will be validated)
   * @returns Created policy with auto-incremented version
   * @throws {BadRequestException} If policy validation fails
   */
  async createDraft(rawPolicy: unknown): Promise<CatalogPolicy> {
    try {
      // Validate and normalize
      const validatedPolicy = validatePolicyOrThrow(rawPolicy);

      // Create in repository
      const created = await this.policyRepository.create(validatedPolicy);

      this.logger.log(`Created policy draft v${created.version}`);

      return created;
    } catch (error) {
      // Map domain errors to HTTP exceptions
      if (error instanceof InvalidEligibilityStatusError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InvalidBreakoutRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Activates a policy by ID.
   *
   * @param id - Policy ID to activate
   * @returns Activated policy
   * @throws {NotFoundException} If policy not found
   */
  async activate(id: string): Promise<CatalogPolicy> {
    await this.policyRepository.activate(id);

    // Fetch the activated policy to return
    const policies = await this.policyRepository.findAll();
    const activated = policies.find((p) => p.id === id);

    if (!activated) {
      throw new NotFoundException(`Policy ${id} not found after activation`);
    }

    this.logger.log(`Activated policy v${activated.version}`);

    return activated;
  }

  /**
   * Creates and immediately activates a new policy.
   *
   * @param rawPolicy - Raw policy configuration
   * @returns Activated policy
   */
  async createAndActivate(rawPolicy: unknown): Promise<CatalogPolicy> {
    const draft = await this.createDraft(rawPolicy);
    return this.activate(draft.id);
  }

  /**
   * Lists all policies ordered by version descending.
   *
   * @returns List of all policies
   */
  async listAll(): Promise<CatalogPolicy[]> {
    return this.policyRepository.findAll();
  }
}
