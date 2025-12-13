import { UserProfileVisibilityPolicy } from './user-profile-visibility.policy';

describe('UserProfileVisibilityPolicy', () => {
  const makeOwner = (overrides?: Partial<any>) =>
    ({
      id: 'u1',
      role: 'user',
      isProfilePublic: true,
      showRatings: true,
      showWatchHistory: true,
      ...overrides,
    }) as any;

  it('canViewProfile: public profile is visible to guest', () => {
    const owner = makeOwner({ isProfilePublic: true });
    expect(UserProfileVisibilityPolicy.canViewProfile(owner, null)).toBe(true);
  });

  it('canViewProfile: private profile is visible to owner', () => {
    const owner = makeOwner({ isProfilePublic: false });
    expect(UserProfileVisibilityPolicy.canViewProfile(owner, { id: owner.id, role: 'user' })).toBe(
      true,
    );
  });

  it('canViewProfile: private profile is visible to admin', () => {
    const owner = makeOwner({ isProfilePublic: false });
    expect(
      UserProfileVisibilityPolicy.canViewProfile(owner, { id: 'admin-1', role: 'admin' }),
    ).toBe(true);
  });

  it('canViewRatings: owner/admin override showRatings', () => {
    const owner = makeOwner({ isProfilePublic: true, showRatings: false });
    expect(UserProfileVisibilityPolicy.canViewRatings(owner, { id: owner.id, role: 'user' })).toBe(
      true,
    );
    expect(
      UserProfileVisibilityPolicy.canViewRatings(owner, { id: 'admin-1', role: 'admin' }),
    ).toBe(true);
  });

  it('canViewRatings: guest respects isProfilePublic and showRatings', () => {
    const ownerHidden = makeOwner({ isProfilePublic: true, showRatings: false });
    expect(UserProfileVisibilityPolicy.canViewRatings(ownerHidden, null)).toBe(false);

    const privateProfile = makeOwner({ isProfilePublic: false, showRatings: true });
    expect(UserProfileVisibilityPolicy.canViewRatings(privateProfile, null)).toBe(false);
  });

  it('canViewWatchHistory: owner/admin override showWatchHistory', () => {
    const owner = makeOwner({ isProfilePublic: true, showWatchHistory: false });
    expect(
      UserProfileVisibilityPolicy.canViewWatchHistory(owner, { id: owner.id, role: 'user' }),
    ).toBe(true);
    expect(
      UserProfileVisibilityPolicy.canViewWatchHistory(owner, { id: 'admin-1', role: 'admin' }),
    ).toBe(true);
  });

  it('canViewWatchHistory: guest respects isProfilePublic and showWatchHistory', () => {
    const ownerHidden = makeOwner({ isProfilePublic: true, showWatchHistory: false });
    expect(UserProfileVisibilityPolicy.canViewWatchHistory(ownerHidden, null)).toBe(false);

    const privateProfile = makeOwner({ isProfilePublic: false, showWatchHistory: true });
    expect(UserProfileVisibilityPolicy.canViewWatchHistory(privateProfile, null)).toBe(false);
  });
});
