import { type User } from '../../../users/domain/entities/user.entity';
import { MeMapper } from './me.mapper';

describe('MeMapper', () => {
  const sampleUser: User = {
    id: 'u1',
    email: 'user@example.com',
    username: 'ratingo_fan',
    passwordHash: 'hashed',
    googleId: 'google-123',
    avatarUrl: 'https://cdn.ratingo/avatar.png',
    bio: 'Film lover',
    location: 'Kyiv',
    website: 'https://example.com',
    preferredLanguage: 'uk',
    preferredRegion: 'UA',
    isProfilePublic: true,
    showWatchHistory: false,
    showRatings: true,
    allowFollowers: true,
    autoSubscribeOnWatch: false,
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
  };

  const sampleStats = {
    moviesRated: 24,
    showsRated: 10,
    watchlistCount: 42,
  };

  it('should map all top-level fields correctly', () => {
    const dto = MeMapper.toDto(sampleUser, sampleStats);

    expect(dto.id).toBe('u1');
    expect(dto.email).toBe('user@example.com');
    expect(dto.username).toBe('ratingo_fan');
    expect(dto.avatarUrl).toBe('https://cdn.ratingo/avatar.png');
    expect(dto.role).toBe('user');
  });

  it('should map profile fields correctly', () => {
    const dto = MeMapper.toDto(sampleUser, sampleStats);

    expect(dto.profile).toEqual({
      bio: 'Film lover',
      location: 'Kyiv',
      website: 'https://example.com',
      preferredLanguage: 'uk',
      preferredRegion: 'UA',
      privacy: {
        isProfilePublic: true,
        showWatchHistory: false,
        showRatings: true,
        allowFollowers: true,
        autoSubscribeOnWatch: false,
      },
    });
  });

  it('should pass stats through as-is', () => {
    const dto = MeMapper.toDto(sampleUser, sampleStats);

    expect(dto.stats).toEqual(sampleStats);
  });

  it('should handle null optional fields', () => {
    const userWithNulls: User = {
      ...sampleUser,
      avatarUrl: null,
      bio: null,
      location: null,
      website: null,
      preferredLanguage: null,
      preferredRegion: null,
    };

    const dto = MeMapper.toDto(userWithNulls, sampleStats);

    expect(dto.avatarUrl).toBeNull();
    expect(dto.profile.bio).toBeNull();
    expect(dto.profile.location).toBeNull();
    expect(dto.profile.website).toBeNull();
    expect(dto.profile.preferredLanguage).toBeNull();
    expect(dto.profile.preferredRegion).toBeNull();
  });

  it('should map admin role correctly', () => {
    const adminUser: User = { ...sampleUser, role: 'admin' };

    const dto = MeMapper.toDto(adminUser, sampleStats);

    expect(dto.role).toBe('admin');
  });

  it('should not leak sensitive fields (passwordHash, googleId, timestamps)', () => {
    const dto = MeMapper.toDto(sampleUser, sampleStats);

    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('googleId');
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });
});
