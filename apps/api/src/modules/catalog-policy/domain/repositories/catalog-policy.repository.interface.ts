/**
 * Catalog Policy Repository Interface
 *
 * Manages catalog policy persistence and retrieval.
 * Policies define eligibility rules for catalog items.
 */

import { type CatalogPolicy, type PolicyConfig } from '../types/policy.types';

export const CATALOG_POLICY_REPOSITORY = Symbol('CATALOG_POLICY_REPOSITORY');

export interface ICatalogPolicyRepository {
  /** Returns the currently active policy, or null if none is active. */
  findActive(): Promise<CatalogPolicy | null>;

  /** Finds a policy by its unique ID. */
  findById(id: string): Promise<CatalogPolicy | null>;

  /** Finds a policy by its version number. */
  findByVersion(version: number): Promise<CatalogPolicy | null>;

  /** Creates a new policy with auto-incremented version. Returns the created policy. */
  create(policy: PolicyConfig): Promise<CatalogPolicy>;

  /** Activates a policy by ID, deactivating any previously active policy. */
  activate(id: string): Promise<void>;

  /** Returns all policies, ordered by version descending. */
  findAll(): Promise<CatalogPolicy[]>;
}
