const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');

const parentRequire = createRequire(require.resolve('query-string'));
const decode = parentRequire('decode-uri-component');
const query = require('query-string');
assert.equal(typeof decode, 'function', 'query-string must receive a CommonJS callable');
assert.equal(parentRequire('decode-uri-component/package.json').version, '0.5.0-avisa.1');
for (const [input, expected] of [
  ['a+b', 'a b'],
  ['%2B', '+'],
  ['%C3%A7', 'ç'],
  ['%F0%9F%98%80', '😀'],
  ['%FE%FF', '\uFFFD\uFFFD'],
  ['%C2', '\uFFFD'],
  ['%C1', '%C1'],
  ['%E2%82', '%E2%82'],
  ['a%GG%', 'a%GG%'],
  ['%C1%41', '%C1A'],
])
  assert.equal(decode(input), expected, input);
for (const value of [null, undefined, 1, {}, []]) assert.throws(() => decode(value), TypeError);
assert.equal(query.parse('q=a+b&u=%C3%A7').q, 'a b');
assert.equal(query.parseUrl('https://example.com/?q=%F0%9F%98%80').query.q, '😀');
const measurements = [];
for (const size of [512, 2048, 16384]) {
  const source = `const q=require(${JSON.stringify(require.resolve('query-string'))}); const x='%C1'.repeat(${size}); const t=performance.now(); if(q.parse('q='+x).q!==x)process.exit(2); console.log(performance.now()-t);`;
  const result = spawnSync(process.execPath, ['-e', source], {
    timeout: 1500,
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '..'),
  });
  assert.equal(result.error, undefined, `decoder timed out at ${size} bytes`);
  assert.equal(result.status, 0, result.stderr);
  measurements.push({ repetitions: size, milliseconds: Number(result.stdout.trim()) });
}
console.log(
  JSON.stringify({
    status: 'PASS',
    package: '0.5.0-avisa.1',
    compatibilityCases: 17,
    timeoutMilliseconds: 1500,
    measurements,
  }),
);
