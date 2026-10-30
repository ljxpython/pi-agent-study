import assert from "node:assert/strict";
import test from "node:test";

test("模拟包内单元测试：应当通过且绝不打入最终分发包", () => {
  assert.equal(1 + 1, 2);
});
