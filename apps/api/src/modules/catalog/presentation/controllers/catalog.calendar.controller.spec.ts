import { HttpStatus } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception';

import { CatalogCalendarController } from './catalog.calendar.controller';

describe('CatalogCalendarController', () => {
  const from = new Date('2026-11-20T00:00:00.000Z');
  const to = new Date('2026-11-27T00:00:00.000Z');
  let calendarService: { getCalendar: jest.Mock };
  let controller: CatalogCalendarController;

  beforeEach(() => {
    calendarService = {
      getCalendar: jest
        .fn()
        .mockResolvedValue({ from, toExclusive: to, days: [], watchingShowsCount: 2 }),
    };
    controller = new CatalogCalendarController(calendarService as never);
  });

  it('maps the query to a calendar request and the range to ISO strings', async () => {
    const result = await controller.getCalendar(
      { startDate: '2026-11-20T10:00:00Z', days: 7, personalized: 'true', type: 'movie' },
      { id: 'user-1' },
    );

    expect(calendarService.getCalendar).toHaveBeenCalledWith({
      startDate: new Date('2026-11-20T10:00:00Z'),
      days: 7,
      viewerId: 'user-1',
      personalized: true,
      type: 'movie',
    });
    expect(result).toEqual({
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      days: [],
      watchingShowsCount: 2,
    });
  });

  it('serves the public calendar to anonymous viewers', async () => {
    await controller.getCalendar({ days: 7 }, null);

    expect(calendarService.getCalendar).toHaveBeenCalledWith({
      startDate: undefined,
      days: 7,
      viewerId: undefined,
      personalized: false,
      type: undefined,
    });
  });

  it('requires a viewer for the personalized calendar', async () => {
    const request = controller.getCalendar({ days: 7, personalized: 'true' }, null);
    await expect(request).rejects.toBeInstanceOf(AppException);
    await expect(request).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    expect(calendarService.getCalendar).not.toHaveBeenCalled();
  });
});
