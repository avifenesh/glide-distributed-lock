const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const protobuf = require('protobufjs');

for (const schema of [
    'syntax = "proto3"; option (unfinished)',
    'syntax = "proto3"; message M { option unfinished',
]) {
    test(`rejects an unterminated option: ${schema}`, () => {
        const result = spawnSync(process.execPath, [
            '-e',
            'require("protobufjs").parse(process.argv[1])',
            schema,
        ], { timeout: 2000, encoding: 'utf8' });
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /illegal|unexpected|end of input/i);
    });
}

test('a valid schema still encodes and decodes messages', () => {
    const { root } = protobuf.parse('syntax = "proto3"; option java_package = "example"; message Value { string text = 1; }');
    const type = root.lookupType('Value');
    const encoded = type.encode({ text: 'normal value' }).finish();
    assert.equal(type.decode(encoded).text, 'normal value');
});
