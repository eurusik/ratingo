import type { Tool } from '@ratingo/ai-core';

export interface RecordedCall {
  tool: string;
  input: unknown;
}

export class ToolRecorder {
  readonly calls: RecordedCall[] = [];
  readonly outputs: string[] = [];

  wrap(tool: Tool): Tool {
    return {
      ...tool,
      run: async (rawInput, context) => {
        this.calls.push({ tool: tool.name, input: rawInput });
        const output = await tool.run(rawInput, context);
        this.outputs.push(output);
        return output;
      },
    };
  }

  get knownTexts(): string[] {
    return [...this.calls.map((call) => JSON.stringify(call.input)), ...this.outputs];
  }
}
