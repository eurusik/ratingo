/**
 * Policy Mapper
 *
 * Maps CatalogPolicy domain entities to presentation DTOs.
 * Centralizes mapping logic for PolicyController.
 */

import { PolicyStatus, type PolicyStatusType } from '../../catalog-policy.constants';
import { type CatalogPolicy, type PolicyConfig } from '../../domain/types/policy.types';

/**
 * Policy list item DTO (for GET /admin/catalog-policies).
 */
export interface PolicyListItemDto {
  id: string;
  name: string;
  version: string;
  status: PolicyStatusType;
  description?: string;
  updatedAt: Date;
}

/**
 * Policy detail DTO (for GET /admin/catalog-policies/:id).
 */
export interface PolicyDetailDto {
  id: string;
  name: string;
  version: string;
  status: PolicyStatusType;
  config: PolicyConfig;
  createdAt: Date;
  activatedAt?: Date;
}

/**
 * Maps CatalogPolicy entities to presentation DTOs.
 */
export const PolicyMapper = {
  /**
   * Maps entity to list item DTO.
   */
  toListDto(entity: CatalogPolicy): PolicyListItemDto {
    return {
      id: entity.id,
      name: PolicyMapper.formatDisplayName(entity.version),
      version: String(entity.version),
      status: PolicyMapper.resolveStatus(entity.isActive),
      description: PolicyMapper.formatSummary(entity.policy),
      updatedAt: entity.activatedAt ?? entity.createdAt,
    };
  },

  /**
   * Maps entity to detail DTO.
   */
  toDetailDto(entity: CatalogPolicy): PolicyDetailDto {
    return {
      id: entity.id,
      name: PolicyMapper.formatDisplayName(entity.version),
      version: String(entity.version),
      status: PolicyMapper.resolveStatus(entity.isActive),
      config: entity.policy,
      createdAt: entity.createdAt,
      ...(entity.activatedAt && { activatedAt: entity.activatedAt }),
    };
  },

  /**
   * Maps multiple entities to list DTOs.
   */
  toListDtos(entities: CatalogPolicy[]): PolicyListItemDto[] {
    return entities.map(PolicyMapper.toListDto);
  },

  /**
   * Formats display name from version.
   */
  formatDisplayName(version: number): string {
    return `Policy v${version}`;
  },

  /**
   * Resolves status from isActive flag.
   */
  resolveStatus(isActive: boolean): PolicyStatusType {
    return isActive ? PolicyStatus.ACTIVE : PolicyStatus.INACTIVE;
  },

  /**
   * Formats summary from policy config.
   */
  formatSummary(policy: PolicyConfig): string | undefined {
    if (!policy.eligibilityMode) return undefined;
    const countryCount = policy.allowedCountries?.length ?? 0;
    return `${policy.eligibilityMode} mode, ${countryCount} allowed countries`;
  },
};
