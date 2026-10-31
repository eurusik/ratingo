import { Injectable } from '@nestjs/common';

import { UserMediaService } from '@/modules/user-media/public';

import { IUserStateProvider, UserState } from '../../domain/ports/user-state-provider.port';

/**
 * Adapter implementing IUserStateProvider using UserMediaService.
 * Bridges catalog module with user-media module.
 */
@Injectable()
export class UserStateAdapter implements IUserStateProvider {
  constructor(private readonly userMediaService: UserMediaService) {}

  async getState(userId: string, mediaItemId: string): Promise<UserState | null> {
    return this.userMediaService.getState(userId, mediaItemId);
  }

  async findMany(userId: string, mediaItemIds: string[]): Promise<UserState[]> {
    return this.userMediaService.findMany(userId, mediaItemIds);
  }
}
