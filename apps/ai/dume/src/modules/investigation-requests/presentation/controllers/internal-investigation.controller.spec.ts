import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';

import type { InvestigationLookupService } from '../../application/services/investigation-lookup.service';
import {
  SubmitKind,
  type SubmitInvestigationService,
} from '../../application/services/submit-investigation.service';
import { RejectionReason } from '../../domain/constants/request.constants';
import { answeredOutcome, queuedRecord } from '../../testing/investigation-requests.testing';
import { finishRecord } from '../../application/mappers/outcome-record.mapper';

import { InternalInvestigationController } from './internal-investigation.controller';

const valid = { requestId: 'tg1000001', question: 'Why does sync-show time out?' };

const setup = (submit: jest.Mock = jest.fn(), find: jest.Mock = jest.fn()) => ({
  submit,
  find,
  controller: new InternalInvestigationController(
    { submit } as unknown as SubmitInvestigationService,
    { find } as unknown as InvestigationLookupService,
  ),
});

describe('InternalInvestigationController', () => {
  it('submits a valid request with the default ref and returns the view without the question', async () => {
    const { controller, submit } = setup(
      jest.fn().mockResolvedValue({
        kind: SubmitKind.ACCEPTED,
        created: true,
        record: queuedRecord(),
      }),
    );

    const response = await controller.submit(valid);

    expect(submit).toHaveBeenCalledWith({ ...valid, ref: 'main' });
    expect(response).toEqual({
      status: 'accepted',
      created: true,
      request: { requestId: 'tg1000001', state: 'queued', createdAtMs: queuedRecord().createdAtMs },
    });
  });

  it('answers 400 to a body that fails validation, without calling the service', async () => {
    const { controller, submit } = setup();

    await expect(controller.submit({ ...valid, question: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.submit(null)).rejects.toBeInstanceOf(BadRequestException);
    expect(submit).not.toHaveBeenCalled();
  });

  it('answers 429 with the reason when a limit is reached', async () => {
    const { controller } = setup(
      jest
        .fn()
        .mockResolvedValue({ kind: SubmitKind.REJECTED, reason: RejectionReason.DAILY_COUNT_CAP }),
    );

    const error = await controller.submit(valid).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual({
      status: 'rejected',
      reason: RejectionReason.DAILY_COUNT_CAP,
    });
  });

  it('answers 409 when the request id was used for another question', async () => {
    const { controller } = setup(jest.fn().mockResolvedValue({ kind: SubmitKind.CONFLICT }));

    await expect(controller.submit(valid)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not_found for an unknown request and the view of a known one', async () => {
    const answered = finishRecord(queuedRecord(), answeredOutcome(), 'eurusik/ratingo', 5);
    const { controller } = setup(
      jest.fn(),
      jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(answered),
    );

    expect(await controller.find('tg1000009')).toEqual({ status: 'not_found' });
    const found = await controller.find('tg1000001');
    expect(found).toMatchObject({
      status: 'found',
      request: { state: 'answered', result: { commit: 'a'.repeat(40) } },
    });
    expect(JSON.stringify(found)).not.toContain('Why does sync-show time out?');
  });

  it('answers 400 to a request id that is not valid', async () => {
    const { controller, find } = setup();

    await expect(controller.find('..')).rejects.toBeInstanceOf(BadRequestException);
    expect(find).not.toHaveBeenCalled();
  });
});
