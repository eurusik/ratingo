import { Inject, Injectable } from '@nestjs/common';

import { MAX_READ_FILE_BYTES } from '../../domain/constants/review-limits.constants';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import { FindingStatus, type TrackedFinding } from '../../domain/entities/tracked-finding';
import {
  classifyPrevious,
  touchedFrom,
  type HeadFiles,
} from '../../domain/policies/finding-carry-over';
import { isSafePath } from '../../domain/policies/safe-path';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';

@Injectable()
export class CarryOverService {
  constructor(@Inject(CODE_HOST_PORT) private readonly host: CodeHostPort) {}

  async classify(
    pr: PullRequest,
    previous: readonly TrackedFinding[],
    scope: { precise: boolean; files: readonly ChangedFile[] },
  ): Promise<TrackedFinding[]> {
    const open = previous.filter((finding) => finding.status !== FindingStatus.RESOLVED);
    const headFiles = scope.precise ? await this.readHeadFiles(pr, open) : new Map();
    return classifyPrevious(open, {
      precise: scope.precise,
      touched: touchedFrom(scope.files),
      headFiles,
    });
  }

  private async readHeadFiles(
    pr: PullRequest,
    findings: readonly TrackedFinding[],
  ): Promise<HeadFiles> {
    const paths = [...new Set(findings.map((finding) => finding.file))].filter(isSafePath);
    const files = new Map<string, string | null>();
    await Promise.all(
      paths.map(async (path) => {
        try {
          files.set(
            path,
            await this.host.readFile(pr.ref, path, pr.headSha, { maxBytes: MAX_READ_FILE_BYTES }),
          );
        } catch {
          return;
        }
      }),
    );
    return files;
  }
}
