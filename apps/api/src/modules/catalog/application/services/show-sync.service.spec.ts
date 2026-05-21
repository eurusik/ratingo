import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { CLOCK_PORT } from '../../../shared/clock';
import { ShowNotFoundError } from '../../domain/errors';
import { COOLDOWN_GATE_PORT } from '../../domain/ports/cooldown-gate.port';
import { IMPORT_JOB_PORT } from '../../domain/ports/import-job.port';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';

import { ShowSyncService } from './show-sync.service';

const FIXED_NOW = new Date('2026-01-15T12:00:00.000Z');

const mockShowIdentity = {
  id: 'show-media-1',
  tmdbId: 12345,
  lastSyncedAt: new Date('2025-12-01T00:00:00.000Z'),
};

describe('ShowSyncService', () => {
  let service: ShowSyncService;
  let showRepository: any;
  let importJobPort: any;
  let cooldownGate: any;
  let clock: any;

  beforeEach(async () => {
    showRepository = {
      findIdentityBySlug: jest.fn().mockResolvedValue(mockShowIdentity),
    };

    importJobPort = {
      queueImport: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
    };

    cooldownGate = {
      tryAcquire: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
    };

    clock = {
      now: jest.fn().mockReturnValue(FIXED_NOW),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShowSyncService,
        { provide: SHOW_REPOSITORY, useValue: showRepository },
        { provide: IMPORT_JOB_PORT, useValue: importJobPort },
        { provide: COOLDOWN_GATE_PORT, useValue: cooldownGate },
        { provide: CLOCK_PORT, useValue: clock },
      ],
    }).compile();

    service = module.get(ShowSyncService);
  });

  describe('requestSync', () => {
    describe('when show does not exist', () => {
      it('throws ShowNotFoundError', async () => {
        showRepository.findIdentityBySlug.mockResolvedValue(null);

        await expect(service.requestSync('unknown-show')).rejects.toThrow(ShowNotFoundError);
        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('uses findIdentityBySlug (not full findBySlug)', async () => {
        showRepository.findIdentityBySlug.mockResolvedValue(null);

        await expect(service.requestSync('some-show')).rejects.toThrow();
        expect(showRepository.findIdentityBySlug).toHaveBeenCalledWith('some-show');
      });
    });

    describe('when cooldown is not active (gate acquired)', () => {
      beforeEach(() => {
        cooldownGate.tryAcquire.mockResolvedValue({ acquired: true, token: 'test-token-abc' });
      });

      it('queues an import job for the show', async () => {
        await service.requestSync('test-show');

        expect(importJobPort.queueImport).toHaveBeenCalledWith(
          mockShowIdentity.tmdbId,
          MediaType.SHOW,
        );
      });

      it('returns queued=true and no cooldownExpiresAt', async () => {
        const result = await service.requestSync('test-show');

        expect(result.queued).toBe(true);
        expect(result.cooldownExpiresAt).toBeNull();
      });

      it('returns lastSyncedAt from show identity', async () => {
        const result = await service.requestSync('test-show');

        expect(result.lastSyncedAt).toEqual(mockShowIdentity.lastSyncedAt);
      });

      it('passes versioned cooldown key to gate', async () => {
        await service.requestSync('test-show');

        expect(cooldownGate.tryAcquire).toHaveBeenCalledWith(
          `sync:cooldown:v1:show:${mockShowIdentity.id}`,
          7 * 24 * 3600,
        );
      });
    });

    describe('when cooldown is active (gate blocked)', () => {
      const EXPIRES_IN_SECONDS = 3 * 24 * 3600;

      beforeEach(() => {
        cooldownGate.tryAcquire.mockResolvedValue({
          acquired: false,
          expiresInSeconds: EXPIRES_IN_SECONDS,
        });
      });

      it('does NOT queue an import job', async () => {
        await service.requestSync('test-show');

        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('returns queued=false', async () => {
        const result = await service.requestSync('test-show');

        expect(result.queued).toBe(false);
      });

      it('computes cooldownExpiresAt from clock.now() + expiresInSeconds', async () => {
        const result = await service.requestSync('test-show');

        const expectedExpiry = new Date(FIXED_NOW.getTime() + EXPIRES_IN_SECONDS * 1000);
        expect(result.cooldownExpiresAt).toEqual(expectedExpiry);
      });

      it('uses clock.now() for computing expiry (not Date.now())', async () => {
        await service.requestSync('test-show');

        expect(clock.now).toHaveBeenCalled();
      });

      it('returns lastSyncedAt from show identity', async () => {
        const result = await service.requestSync('test-show');

        expect(result.lastSyncedAt).toEqual(mockShowIdentity.lastSyncedAt);
      });
    });

    describe('when show has never been synced', () => {
      it('returns lastSyncedAt as null', async () => {
        showRepository.findIdentityBySlug.mockResolvedValue({
          ...mockShowIdentity,
          lastSyncedAt: null,
        });
        cooldownGate.tryAcquire.mockResolvedValue({ acquired: true, token: 'test-token-xyz' });

        const result = await service.requestSync('test-show');

        expect(result.lastSyncedAt).toBeNull();
      });
    });

    describe('when import job port throws', () => {
      beforeEach(() => {
        cooldownGate.tryAcquire.mockResolvedValue({ acquired: true, token: 'test-token-fail' });
        importJobPort.queueImport.mockRejectedValue(new Error('Queue unavailable'));
      });

      it('re-throws the error', async () => {
        await expect(service.requestSync('test-show')).rejects.toThrow('Queue unavailable');
      });

      it('releases the cooldown key with fencing token so the user is not blocked for 7 days', async () => {
        await expect(service.requestSync('test-show')).rejects.toThrow();

        expect(cooldownGate.release).toHaveBeenCalledWith(
          `sync:cooldown:v1:show:${mockShowIdentity.id}`,
          'test-token-fail',
        );
      });
    });
  });
});
