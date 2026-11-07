import { after, describe, it } from 'node:test';

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

import rule from './no-deep-relative-imports.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = after;

const aliasRoot = '/repo/src';
const filename = '/repo/src/modules/catalog/application/catalog.service.ts';
const options = [{ maxParentLevels: 1, aliasRoot, aliasPrefix: '@/' }];

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
});

const useAlias = (source, output) => ({
  code: source,
  output,
  filename,
  options,
  errors: [{ messageId: 'useAlias' }],
});

ruleTester.run('no-deep-relative-imports', rule, {
  valid: [
    { code: "import { a } from './a';", filename, options },
    { code: "import { a } from '../domain/a';", filename, options },
    { code: "import { a } from '@/common/a';", filename, options },
    { code: "import { a } from 'lodash';", filename, options },
    { code: "jest.mock('../domain/a');", filename, options },
    { code: "const a = require('./a');", filename, options },
  ],
  invalid: [
    useAlias("import { a } from '../../common/a';", "import { a } from '@/modules/common/a';"),
    useAlias("import { a } from '../../../common/a';", "import { a } from '@/common/a';"),
    useAlias('import { a } from "../../../common/a";', 'import { a } from "@/common/a";'),
    useAlias("import { a } from './../../../common/a';", "import { a } from '@/common/a';"),
    useAlias("export { a } from '../../../common/a';", "export { a } from '@/common/a';"),
    useAlias("export * from '../../../common/a';", "export * from '@/common/a';"),
    useAlias("const m = import('../../../common/a');", "const m = import('@/common/a');"),
    useAlias("type A = import('../../../common/a').A;", "type A = import('@/common/a').A;"),
    useAlias("const a = require('../../../common/a');", "const a = require('@/common/a');"),
    useAlias("jest.mock('../../../common/a');", "jest.mock('@/common/a');"),
    useAlias("jest.requireActual('../../../common/a');", "jest.requireActual('@/common/a');"),
    {
      code: "import { a } from '../../../../test/a';",
      output: null,
      filename,
      options,
      errors: [{ messageId: 'tooDeep' }],
    },
    {
      code: "import { a } from '../../../..';",
      output: null,
      filename,
      options,
      errors: [{ messageId: 'tooDeep' }],
    },
  ],
});
