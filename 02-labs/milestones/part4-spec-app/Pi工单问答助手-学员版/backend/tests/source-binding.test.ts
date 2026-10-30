/**
 * ==============================================================================
 * 🧪 Part 4 核心实战练习：backend/tests/source-binding.test.ts
 * ==============================================================================
 * 对应课件：Part 4.ipynb §3.4《用一项验证练习理解来源绑定》
 * 验证目标（三大黄金预期）：
 * 1. 正常情况：内置资料筛出 T01、T04、T06，且 analysis.sourceRef 精确绑定本轮资料；
 * 2. 缺失引用：没有资料引用 (source 为 null) 时，Datasets.bound() 明确拒绝 (NO_DATASET_SELECTED)；
 * 3. 版本过期：拿旧版本引用当前资料时，Datasets.bound() 明确拒绝 (SOURCE_NOT_AUTHORIZED)；
 * 4. 越权引用：请求不存在的资料 ID 时，明确拒绝 (RESOURCE_NOT_FOUND)。
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN, Datasets, type Dataset } from "../src/datasets.js";
import { queryTickets } from "../src/business.js";
import { hash } from "../src/resources.js";
import type { SourceRef } from "../src/contracts.js";

function setupDatasets(): { datasets: Datasets; builtinItem: Dataset; validSourceRef: SourceRef } {
  const root = "/tmp/fake-test-root";
  const datasets = new Datasets(root);

  const version = hash(JSON.stringify(BUILTIN));
  const builtinItem: Dataset = {
    dataset: {
      id: "builtin-tickets",
      name: "内置工单资料包",
      version,
      count: BUILTIN.tickets.length,
      origin: "builtin",
    },
    payload: BUILTIN,
  };

  // 注册内置资料集
  datasets.register(builtinItem);

  const validSourceRef: SourceRef = {
    datasetId: "builtin-tickets",
    version,
  };

  return { datasets, builtinItem, validSourceRef };
}

test("预期一：内置资料正确筛选出 T01、T04、T06，且 analysis.sourceRef 精确对应本轮资料", () => {
  const { datasets, validSourceRef } = setupDatasets();

  // 1. 来源绑定校验
  const bound = datasets.bound(validSourceRef);
  assert.equal(bound.dataset.id, "builtin-tickets");
  assert.equal(bound.dataset.version, validSourceRef.version);

  // 2. 执行工单业务筛选（筛选平台团队的 open 状态工单）
  const requestId = "req-test-001";
  const filters = { team: "平台", status: "open" };
  const analysis = queryTickets(bound.payload, validSourceRef, filters, requestId);

  // 3. 断言工单 ID 必须精确为 T01、T04、T06
  const ticketIds = analysis.records.map((t) => t.id).sort();
  assert.deepEqual(ticketIds, ["T01", "T04", "T06"], "平台开放工单必须精确匹配 T01、T04、T06");
  assert.equal(analysis.count, 3, "工单计数必须为 3");

  // 4. 断言来源凭据精准绑定
  assert.deepEqual(analysis.analysis.sourceRef, validSourceRef, "analysis.sourceRef 必须与输入资料版本完全一致");
  assert.equal(analysis.analysis.queryRequestId, requestId);
  assert.equal(analysis.statistics.urgent, 1, "T01 为 urgent");
  assert.equal(analysis.statistics.normal, 2, "T04、T06 为 normal");
});

test("预期二：没有资料引用 (source 为 null) 时，Datasets.bound() 明确拒绝抛出 NO_DATASET_SELECTED", () => {
  const { datasets } = setupDatasets();

  assert.throws(
    () => {
      datasets.bound(null);
    },
    (err: any) => {
      assert.equal(err.code, "NO_DATASET_SELECTED", "错误码必须为 NO_DATASET_SELECTED");
      assert.ok(err.message.includes("请先选择资料"), "提示文本必须明确要求先选择资料");
      return true;
    },
    "未传资料引用时必须坚决拒绝"
  );
});

test("预期三：使用旧版本引用当前资料时，Datasets.bound() 明确拒绝抛出 SOURCE_NOT_AUTHORIZED", () => {
  const { datasets } = setupDatasets();

  // 模拟版本过期（例如旧版本的 hash 为 stale-v0-hash）
  const staleSourceRef: SourceRef = {
    datasetId: "builtin-tickets",
    version: "stale-outdated-hash-9999",
  };

  assert.throws(
    () => {
      datasets.bound(staleSourceRef);
    },
    (err: any) => {
      assert.equal(err.code, "SOURCE_NOT_AUTHORIZED", "错误码必须为 SOURCE_NOT_AUTHORIZED");
      assert.ok(err.message.includes("资料版本已变化"), "必须明确告知资料版本已变化，防止数据串味");
      return true;
    },
    "版本不匹配时必须坚决拒绝执行"
  );
});

test("预期四：请求不存在的资料 ID 时，Datasets.bound() 明确抛出 RESOURCE_NOT_FOUND", () => {
  const { datasets } = setupDatasets();

  const fakeSourceRef: SourceRef = {
    datasetId: "non-existent-tickets",
    version: "any-version",
  };

  assert.throws(
    () => {
      datasets.bound(fakeSourceRef);
    },
    (err: any) => {
      assert.equal(err.code, "RESOURCE_NOT_FOUND", "错误码必须为 RESOURCE_NOT_FOUND");
      assert.ok(err.message.includes("资料不存在"));
      return true;
    },
    "不存在的资料集必须直接报错阻断"
  );
});
