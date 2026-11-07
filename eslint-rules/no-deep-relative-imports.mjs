import * as path from 'node:path';

const PARENT_SEGMENT = '..';
const CURRENT_SEGMENT = '.';
const JEST_MODULE_PATH_METHODS = new Set([
  'createMockFromModule',
  'doMock',
  'dontMock',
  'mock',
  'requireActual',
  'requireMock',
  'setMock',
  'unmock',
]);

function countLeadingParentSegments(specifier) {
  const segments = specifier.split('/').filter((segment) => segment !== CURRENT_SEGMENT);
  const firstNonParent = segments.findIndex((segment) => segment !== PARENT_SEGMENT);
  return firstNonParent === -1 ? segments.length : firstNonParent;
}

function isInsideRoot(pathFromRoot) {
  return (
    pathFromRoot !== '' &&
    !pathFromRoot.startsWith(PARENT_SEGMENT) &&
    !path.isAbsolute(pathFromRoot)
  );
}

function isStringLiteral(node) {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

function isModulePathCall(callee) {
  if (callee.type === 'Identifier') {
    return callee.name === 'require';
  }
  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'jest' &&
    callee.property.type === 'Identifier' &&
    JEST_MODULE_PATH_METHODS.has(callee.property.name)
  );
}

export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow relative imports that climb more than a set number of directories',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxParentLevels: { type: 'integer', minimum: 0 },
          aliasRoot: { type: 'string' },
          aliasPrefix: { type: 'string' },
        },
        required: ['maxParentLevels', 'aliasRoot', 'aliasPrefix'],
        additionalProperties: false,
      },
    ],
    messages: {
      useAlias: "'{{specifier}}' climbs {{levels}} directories: import '{{alias}}' instead.",
      tooDeep:
        "'{{specifier}}' climbs {{levels}} directories (max {{maxParentLevels}}) and points outside {{aliasPrefix}}.",
    },
  },
  create(context) {
    const [{ maxParentLevels, aliasRoot, aliasPrefix }] = context.options;
    const importerDir = path.dirname(context.filename);

    function reportOutsideRoot(sourceNode, levels) {
      context.report({
        node: sourceNode,
        messageId: 'tooDeep',
        data: { specifier: sourceNode.value, levels, maxParentLevels, aliasPrefix },
      });
    }

    function reportWithAliasFix(sourceNode, levels, pathFromRoot) {
      const alias = `${aliasPrefix}${pathFromRoot.split(path.sep).join('/')}`;
      const quote = sourceNode.raw[0];
      context.report({
        node: sourceNode,
        messageId: 'useAlias',
        data: { specifier: sourceNode.value, levels, alias },
        fix: (fixer) => fixer.replaceText(sourceNode, `${quote}${alias}${quote}`),
      });
    }

    function check(sourceNode) {
      if (!isStringLiteral(sourceNode)) {
        return;
      }
      const levels = countLeadingParentSegments(sourceNode.value);
      if (levels <= maxParentLevels) {
        return;
      }
      const pathFromRoot = path.relative(aliasRoot, path.resolve(importerDir, sourceNode.value));
      if (isInsideRoot(pathFromRoot)) {
        reportWithAliasFix(sourceNode, levels, pathFromRoot);
      } else {
        reportOutsideRoot(sourceNode, levels);
      }
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.argument?.literal ?? node.argument),
      TSExternalModuleReference: (node) => check(node.expression),
      CallExpression: (node) => {
        if (isModulePathCall(node.callee)) {
          check(node.arguments[0]);
        }
      },
    };
  },
};
