import type { ShownEvidence } from '../entities/investigation-answer';

export class RuntimeEvidenceLedger {
  private readonly shown = new Map<string, ShownEvidence>();
  private readonly shownTexts: string[] = [];

  record(evidence: ShownEvidence): void {
    this.shown.set(evidence.ref, evidence);
  }

  noteShownText(text: string): void {
    this.shownTexts.push(text);
  }

  shownText(): string {
    return this.shownTexts.join('\n');
  }

  find(ref: string): ShownEvidence | undefined {
    return this.shown.get(ref);
  }

  toolsShown(): string[] {
    return [...new Set([...this.shown.values()].map((evidence) => evidence.tool))].sort();
  }
}
