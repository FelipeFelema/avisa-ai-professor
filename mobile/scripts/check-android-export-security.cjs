const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { parse } = require('@babel/parser');
const { TraceMap, originalPositionFor, decodedMappings } = require('@jridgewell/trace-mapping');

const [bundleArgument, expectedApi] = process.argv.slice(2);
if (!bundleArgument || !expectedApi) {
  console.error(
    'Usage: node scripts/check-android-export-security.cjs <android.js> <expected-public-api>',
  );
  process.exit(1);
}
try {
  const url = new URL(expectedApi);
  assert.equal(url.protocol, 'https:');
  const bundle = fs.readFileSync(path.resolve(bundleArgument), 'utf8');
  const sourceMap = JSON.parse(fs.readFileSync(path.resolve(bundleArgument) + '.map', 'utf8'));
  const trace = new TraceMap(sourceMap);
  const position = (index) => {
    const before = bundle.slice(0, index);
    return originalPositionFor(trace, {
      line: (before.match(/\n/g) || []).length + 1,
      column: index - before.lastIndexOf('\n') - 1,
    });
  };
  assert.match(bundle, /__DEV__\s*=\s*(?:false|!1)/, 'EXPORT_DEVELOPMENT_MODE');
  const apiValues = [...bundle.matchAll(/apiUrl\s*:\s*("(?:[^"\\]|\\.)*")/g)]
    .filter((match) => position(match.index).source?.endsWith('/src/config/env.ts'))
    .map((match) => JSON.parse(match[1]));
  assert.ok(apiValues.length > 0, 'EXPORT_API_MODULE_NOT_FOUND');
  assert.ok(
    apiValues.every((value) => value === expectedApi),
    'EXPORT_API_MISMATCH',
  );
  for (const match of bundle.matchAll(
    /localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|\b10\.(?:\d+\.){2}\d+|\b172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+/g,
  )) {
    assert.ok(
      !/^\/(src|app)\//.test(position(match.index).source ?? ''),
      'EXPORT_LOCAL_APPLICATION_NETWORK',
    );
  }
  assert.doesNotMatch(
    bundle,
    /JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|DATABASE_URL|EXPO_PUSH_ACCESS_TOKEN|-----BEGIN (?:RSA )?PRIVATE KEY-----/,
    'EXPORT_BACKEND_CREDENTIAL',
  );
  const normalize = (source) => source.replaceAll('\\', '/');
  const excluded = ['shell-quote', 'braces', 'image-size', 'node-forge', 'sprintf-js', 'uuid'];
  for (const name of excluded)
    assert.ok(
      !sourceMap.sources.some((source) =>
        normalize(source).includes('/node_modules/' + name + '/'),
      ),
      'EXPORT_VULNERABLE_PACKAGE_' + name,
    );
  const decoderIndex = sourceMap.sources.findIndex((source) =>
    normalize(source).endsWith('/vendor/decode-uri-component/index.js'),
  );
  assert.ok(decoderIndex >= 0, 'EXPORT_DECODER_PATCH_MISSING');
  const reviewedDecoder = fs.readFileSync(
    path.resolve(__dirname, '../vendor/decode-uri-component/index.js'),
    'utf8',
  );
  assert.equal(
    sourceMap.sourcesContent[decoderIndex],
    reviewedDecoder,
    'EXPORT_DECODER_SOURCE_MISMATCH',
  );
  // Execute the actual minified Metro factory, rather than only its source-map text.
  const anchor = [...bundle.matchAll(/%FE%FF/g)].find((match) =>
    position(match.index).source?.endsWith('/vendor/decode-uri-component/index.js'),
  );
  assert.ok(anchor, 'EXPORT_DECODER_FACTORY_NOT_FOUND');
  const ast = parse(bundle, { sourceType: 'script' });
  const factoryCall = ast.program.body
    .map((node) => node.expression)
    .find(
      (node) =>
        node?.type === 'CallExpression' &&
        node.callee?.name === '__d' &&
        node.start <= anchor.index &&
        node.end >= anchor.index,
    );
  assert.ok(factoryCall, 'EXPORT_DECODER_FACTORY_NOT_FOUND');
  const queryIndex = sourceMap.sources.findIndex((source) =>
    normalize(source).endsWith('/node_modules/query-string/index.js'),
  );
  assert.ok(queryIndex >= 0, 'EXPORT_QUERY_STRING_MISSING');
  const mappings = decodedMappings(trace);
  let queryPosition;
  for (let line = 0; line < mappings.length && !queryPosition; line++) {
    const segment = mappings[line].find((entry) => entry[1] === queryIndex);
    if (segment) queryPosition = { line: line + 1, column: segment[0] };
  }
  assert.ok(queryPosition, 'EXPORT_QUERY_STRING_UNMAPPED');
  const lineOffsets = [0];
  for (let index = 0; index < bundle.length; index++)
    if (bundle[index] === '\n') lineOffsets.push(index + 1);
  const queryOffset = lineOffsets[queryPosition.line - 1] + queryPosition.column;
  const queryFactory = ast.program.body
    .map((node) => node.expression)
    .find(
      (node) =>
        node?.type === 'CallExpression' &&
        node.callee?.name === '__d' &&
        node.start <= queryOffset &&
        node.end >= queryOffset,
    );
  assert.ok(queryFactory, 'EXPORT_QUERY_STRING_FACTORY_MISSING');
  assert.ok(
    queryFactory.arguments[2].elements.some(
      (node) => node?.value === factoryCall.arguments[1].value,
    ),
    'EXPORT_QUERY_STRING_NOT_BOUND_TO_PATCH',
  );
  const factory = factoryCall.arguments[0];
  const context = vm.createContext({ module: { exports: {} } });
  vm.runInContext(
    '(' +
      bundle.slice(factory.start, factory.end) +
      ')(globalThis,()=>{throw Error("UNEXPECTED_DEPENDENCY")},null,null,module,module.exports,[]); decoder=module.exports;',
    context,
    { timeout: 1500 },
  );
  assert.equal(typeof context.decoder, 'function');
  assert.equal(vm.runInContext("decoder('a+b')", context, { timeout: 1500 }), 'a b');
  assert.equal(vm.runInContext("decoder('%F0%9F%98%80')", context, { timeout: 1500 }), '😀');
  const measurements = [];
  for (const repetitions of [512, 2048, 16384]) {
    context.input = '%C1'.repeat(repetitions);
    const start = performance.now();
    const decoded = vm.runInContext('decoder(input)', context, { timeout: 1500 });
    assert.equal(decoded, context.input);
    measurements.push({ repetitions, milliseconds: performance.now() - start });
  }
  console.log(
    JSON.stringify({
      status: 'PASS',
      expectedApi,
      devFalse: true,
      excludedNpmPackages: excluded,
      decoderSourceEqual: true,
      actualMinifiedDecoderExecuted: true,
      queryStringBoundToPatchedDecoder: true,
      measurements,
      bundleSHA256: crypto.createHash('sha256').update(bundle).digest('hex'),
      moduleCount: sourceMap.sources.length,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: 'FAIL',
      code: error.code ?? 'EXPORT_SECURITY_ASSERTION_FAILED',
      reason: error.message?.split('\n')[0],
    }),
  );
  process.exitCode = 1;
}
