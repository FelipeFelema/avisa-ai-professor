// Jest's CommonJS VM must load native SDK mocks without Node's ESM loader.
module.exports = ({ types: t }) => ({
  name: 'jest-native-sdk-dynamic-import',
  visitor: {
    CallExpression(path, state) {
      if (!t.isImport(path.node.callee)) return;
      const [source] = path.node.arguments;
      if (path.node.arguments.length !== 1 || !t.isStringLiteral(source)) {
        throw path.buildCodeFrameError('The Jest SDK loader requires a literal module name.');
      }

      path.replaceWith(
        t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
              [],
            ),
            t.identifier('then'),
          ),
          [
            t.arrowFunctionExpression(
              [],
              t.callExpression(state.file.addHelper('interopRequireWildcard'), [
                t.callExpression(t.identifier('require'), [source]),
              ]),
            ),
          ],
        ),
      );
    },
  },
});
