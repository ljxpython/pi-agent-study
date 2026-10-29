/**
 * 偏好存储的针对性测试：真实文件系统 + 真实锁 + 真实原子替换。
 *
 * 全部读写都在 tests/runtime-fixtures 造出的临时目录里（模块内有前缀白名单断言，
 * 不可能碰到 `~/.pi/agent/lesson3-context-panel/` 或任何真实配置）。
 * 这里验证的是**存储层本身**：解析口径、首次默认、原子替换、锁的获取/释放/接管/超时、
 * 损坏记录不被覆盖、并发提交不丢反转。
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_ENABLED,
  LOCK_WAIT_MS,
  STATE_FILE_NAME,
  STATE_FORMAT_VERSION,
  clearLockFile,
  createPanelStateStore,
  lockFileExists,
  parseStateRecord,
  resolveStatePath,
  serializeStateRecord,
  stateFileExists,
  type PanelStateStore,
} from "../extensions/context-panel-store.ts";
import {
  blockPathComponent,
  createFixtureRoot,
  lockPathFor,
  makeDirectoryReadOnly,
  makeRecordPathDirectory,
  placeLock,
  recordPathIn,
  restoreDirectory,
  writeCorruptRecord,
  writeValidRecord,
  type FixtureRoot,
} from "./runtime-fixtures/failure-injection.ts";

/** 每个用例独占一个临时根目录，结束即删。 */
function withFixture(label: string, body: (root: FixtureRoot) => void | Promise<void>) {
  const root = createFixtureRoot(label);
  return Promise.resolve()
    .then(() => body(root))
    .finally(() => root.cleanup());
}

function storeFor(statePath: string, overrides: { lockWaitMs?: number; lockRetryMs?: number; lockStaleMs?: number } = {}): PanelStateStore {
  // 生产默认等待 2 秒；测试缩短到毫秒级，只验证分支，不改变生产常量。
  return createPanelStateStore({ statePath, lockWaitMs: 300, lockRetryMs: 5, lockStaleMs: 5_000, ...overrides });
}

function readRecordBytes(statePath: string): string {
  return readFileSync(statePath, "utf8");
}

/** 目录内是否残留临时文件（原子替换只应留下正式记录）。 */
function tempFilesIn(statePath: string): string[] {
  const dir = path.dirname(statePath);
  return readdirSync(dir).filter((name) => name.includes(".tmp"));
}

test("resolveStatePath：落在 <agentDir>/lesson3-context-panel/state.json", () => {
  assert.equal(resolveStatePath("/tmp/agent"), path.join("/tmp/agent", "lesson3-context-panel", "state.json"));
  assert.equal(STATE_FILE_NAME, "state.json");
  assert.equal(STATE_FORMAT_VERSION, 1);
  assert.equal(DEFAULT_ENABLED, true);
});

test("parseStateRecord：合法记录", () => {
  assert.deepEqual(parseStateRecord('{"version":1,"enabled":true}'), { kind: "ok", enabled: true });
  assert.deepEqual(parseStateRecord('{"version":1,"enabled":false}'), { kind: "ok", enabled: false });
  assert.deepEqual(parseStateRecord('{"enabled":true,"version":1}'), { kind: "ok", enabled: true }, "键顺序无关");
  assert.deepEqual(
    parseStateRecord('{"version":1,"enabled":true,"note":"多余字段被忽略"}'),
    { kind: "ok", enabled: true },
  );
});

test("parseStateRecord：损坏记录一律带可读原因", () => {
  const describeResult = (result: ReturnType<typeof parseStateRecord>): string =>
    result.kind === "corrupt" ? result.reason : `（未判为损坏：${result.kind}）`;
  const cases: Array<[string, string]> = [
    ["", "不是合法 JSON"],
    ["{", "不是合法 JSON"],
    ["null", "顶层不是 JSON 对象"],
    ["[]", "顶层不是 JSON 对象"],
    ['"enabled"', "顶层不是 JSON 对象"],
    ['{"enabled":true}', "格式版本"],
    ['{"version":2,"enabled":true}', "格式版本"],
    ['{"version":"1","enabled":true}', "格式版本"],
    ['{"version":1}', "enabled 不是布尔值"],
    ['{"version":1,"enabled":"true"}', "enabled 不是布尔值"],
    ['{"version":1,"enabled":1}', "enabled 不是布尔值"],
    ['{"version":1,"enabled":null}', "enabled 不是布尔值"],
  ];
  for (const [text, expected] of cases) {
    const result = parseStateRecord(text);
    assert.equal(result.kind, "corrupt", `输入 ${JSON.stringify(text)} 应判为损坏`);
    assert.ok(
      result.kind === "corrupt" && result.reason.includes(expected),
      `输入 ${JSON.stringify(text)} 的原因应包含「${expected}」，实际：${describeResult(result)}`,
    );
  }
});

test("serializeStateRecord 与 parseStateRecord 往返一致", () => {
  for (const enabled of [true, false]) {
    const text = serializeStateRecord(enabled);
    assert.ok(text.endsWith("\n"), "记录以换行结尾，便于人工查看");
    assert.deepEqual(parseStateRecord(text), { kind: "ok", enabled });
  }
});

test("首次无记录：read 返回 missing，提交后建目录建文件", async () => {
  await withFixture("fresh", async (root) => {
    const statePath = recordPathIn(root);
    const store = storeFor(statePath);

    assert.deepEqual(store.read(), { kind: "missing" });
    assert.equal(stateFileExists(statePath), false);

    const result = await store.commit(true);
    assert.deepEqual(result, { kind: "ok", enabled: true });
    assert.equal(readRecordBytes(statePath), serializeStateRecord(true), "写入内容为冻结格式");
    assert.deepEqual(store.read(), { kind: "ok", enabled: true }, "重新读取得到新值");
    assert.equal(tempFilesIn(statePath).length, 0, "不留临时文件");
    assert.equal(lockFileExists(statePath), false, "提交后锁已释放");
  });
});

test("首次无记录 + 相对提交：起点是默认开启，toggle 结果为关闭", async () => {
  await withFixture("first-toggle", async (root) => {
    const statePath = recordPathIn(root);
    const store = storeFor(statePath);

    const result = await store.commit((current) => !current);
    assert.deepEqual(result, { kind: "ok", enabled: !DEFAULT_ENABLED }, "默认开启 → 反转为关闭");
    assert.deepEqual(parseStateRecord(readRecordBytes(statePath)), { kind: "ok", enabled: false });
  });
});

test("提交后锁文件已释放，记录已落盘", async () => {
  await withFixture("lock-release", async (root) => {
    const statePath = recordPathIn(root);
    const store = storeFor(statePath);

    await store.commit(false);
    assert.equal(lockFileExists(statePath), false);
    assert.equal(statSync(statePath).isFile(), true);

    await store.commit(true);
    assert.equal(lockFileExists(statePath), false, "重复提交后同样不残留锁");
  });
});

test("记录位置被目录占住：判为损坏并拒绝提交，不静默覆盖", async () => {
  await withFixture("record-is-dir", async (root) => {
    const statePath = recordPathIn(root);
    makeRecordPathDirectory(statePath); // 故障注入：记录位置被一个目录占住
    const store = storeFor(statePath);

    const read = store.read();
    assert.equal(read.kind, "corrupt", "读不出内容按损坏处理，而不是当成空记录");
    const result = await store.commit(true);
    assert.equal(result.kind, "corrupt", `应拒绝提交，实际 ${result.kind}`);
    assert.equal(statSync(statePath).isDirectory(), true, "原位置未被破坏");
    assert.equal(lockFileExists(statePath), false, "被拒的提交也释放了锁");
  });
});

test("持锁期间写入失败：报写入失败、释放锁、清掉临时文件、旧记录不变", { skip: typeof process.getuid === "function" && process.getuid() === 0 }, async () => {
  await withFixture("write-fails", async (root) => {
    const statePath = recordPathIn(root);
    writeValidRecord(statePath, false);
    const before = readRecordBytes(statePath);
    const store = storeFor(statePath);

    makeDirectoryReadOnly(path.dirname(statePath)); // 故障注入：目录不可写，临时文件建不出来
    let result;
    try {
      result = await store.commit(true);
    } finally {
      restoreDirectory(path.dirname(statePath));
    }

    assert.equal(result.kind, "write-failed", `应报写入失败，实际 ${result.kind}`);
    assert.ok(result.kind === "write-failed" && result.reason.length > 0, "失败原因非空，供提示使用");
    assert.equal(lockFileExists(statePath), false, "失败路径也必须释放锁");
    assert.equal(tempFilesIn(statePath).length, 0, "临时文件未残留");
    assert.equal(readRecordBytes(statePath), before, "旧记录保持原样");
  });
});

test("存储位置不可写入（路径中一段是普通文件）：报写入失败且不抛异常", async () => {
  await withFixture("blocked", async (root) => {
    const statePath = blockPathComponent(root);
    const store = storeFor(statePath);

    assert.deepEqual(store.read(), { kind: "missing" }, "ENOTDIR 按首次无记录处理");
    const result = await store.commit(true);
    assert.equal(result.kind, "write-failed");
    assert.equal(lockFileExists(statePath), false, "连目录都建不出来时不应留下锁");
  });
});

test("损坏记录：读取报损坏，提交被拒且原文件字节不变", async () => {
  await withFixture("corrupt", async (root) => {
    const statePath = recordPathIn(root);
    const broken = '{"version":1,"enabled":"yes"}\n';
    writeCorruptRecord(statePath, broken);
    const store = storeFor(statePath);

    const read = store.read();
    assert.equal(read.kind, "corrupt");
    assert.ok(read.kind === "corrupt" && read.reason.includes("enabled 不是布尔值"), "原因指出具体字段问题");

    const result = await store.commit(false);
    assert.equal(result.kind, "corrupt", "损坏记录必须先修复，不允许静默覆盖");
    assert.equal(readRecordBytes(statePath), broken, "原文件字节完全未变");
    assert.equal(lockFileExists(statePath), false, "被拒的提交也释放了锁");
    assert.equal(tempFilesIn(statePath).length, 0, "被拒的提交不产生临时文件");
  });
});

test("版本不符的记录同样视为损坏，不被覆盖", async () => {
  await withFixture("version", async (root) => {
    const statePath = recordPathIn(root);
    writeValidRecord(statePath, true, 99);
    const store = storeFor(statePath);

    const read = store.read();
    assert.ok(read.kind === "corrupt" && read.reason.includes("格式版本"), `原因应指出格式版本：${read.kind}`);
    assert.equal((await store.commit(true)).kind, "corrupt");
    assert.deepEqual(parseStateRecord(readRecordBytes(statePath)), {
      kind: "corrupt",
      reason: "格式版本不受支持（version=99）",
    });
  });
});

test("toggle 以共享记录为起点：另一个 store 实例读到新值，不基于旧缓存", async () => {
  await withFixture("shared", async (root) => {
    const statePath = recordPathIn(root);
    const windowA = storeFor(statePath);
    const windowB = storeFor(statePath);

    await windowA.commit(true); // A 窗口保存「开启」
    assert.deepEqual(windowB.read(), { kind: "ok", enabled: true }, "B 读到 A 的结果");

    const afterB = await windowB.commit((current) => !current); // B 的 toggle 必须基于共享记录
    assert.deepEqual(afterB, { kind: "ok", enabled: false });
    assert.deepEqual(windowA.read(), { kind: "ok", enabled: false }, "A 下次读取也拿到最新值");
  });
});

test("锁被占住：等待超过上限就报超时，不改动记录、不残留锁", async () => {
  await withFixture("lock-timeout", async (root) => {
    const statePath = recordPathIn(root);
    writeValidRecord(statePath, true);
    const before = readRecordBytes(statePath);
    const store = storeFor(statePath, { lockWaitMs: 120, lockRetryMs: 10 });

    const lockPath = placeLock(statePath, { ageMs: 0 }); // 故障注入：另一个进程正持锁
    const started = Date.now();
    const result = await store.commit(false);
    const elapsed = Date.now() - started;

    assert.equal(result.kind, "lock-timeout");
    assert.ok(result.kind === "lock-timeout" && result.waitedMs >= 120, "报告实际等待时长");
    assert.ok(elapsed >= 120, `确实等满了上限（实测 ${elapsed}ms）`);
    assert.equal(readRecordBytes(statePath), before, "未写入任何东西");
    assert.equal(lockFileExists(statePath), true, "超时方不释放别人的锁");
    assert.equal(readFileSync(lockPath, "utf8").includes("999999"), true, "锁文件仍是对方写的那个");

    clearLockFile(statePath);
  });
});

test("陈旧锁可被接管：持锁进程崩溃后不会永久卡住", async () => {
  await withFixture("stale-lock", async (root) => {
    const statePath = recordPathIn(root);
    const store = storeFor(statePath, { lockWaitMs: 300, lockRetryMs: 5, lockStaleMs: 1_000 });

    placeLock(statePath, { ageMs: 60_000 }); // 故障注入：一把 60 秒前的死锁
    const result = await store.commit(true);

    assert.deepEqual(result, { kind: "ok", enabled: true }, "接管后提交成功");
    assert.equal(lockFileExists(statePath), false, "接管并完成后锁已释放");
  });
});

test("并发提交两次 toggle：都成功，且不丢失一次反转", async () => {
  await withFixture("concurrent", async (root) => {
    const statePath = recordPathIn(root);
    const windowA = storeFor(statePath, { lockWaitMs: 3_000, lockRetryMs: 2 });
    const windowB = storeFor(statePath, { lockWaitMs: 3_000, lockRetryMs: 2 });

    await windowA.commit(true); // 基线：开启

    // 两个窗口几乎同时 toggle：锁必须保证「读取最新值 → 计算 → 提交」整段串行，
    // 否则两边都读到 true、都算出 false，就会丢掉一次反转。
    const [resultA, resultB] = await Promise.all([
      windowA.commit((current) => !current),
      windowB.commit((current) => !current),
    ]);

    assert.equal(resultA.kind, "ok");
    assert.equal(resultB.kind, "ok");
    const observed = [resultA.kind === "ok" ? resultA.enabled : null, resultB.kind === "ok" ? resultB.enabled : null].sort();
    assert.deepEqual(observed, [false, true], "一次得到关闭、一次得到开启，说明第二次读到了第一次的结果");
    assert.deepEqual(parseStateRecord(readRecordBytes(statePath)), { kind: "ok", enabled: true }, "两次反转后回到开启");
    assert.equal(lockFileExists(statePath), false, "两边都释放了锁");
    assert.equal(tempFilesIn(statePath).length, 0);
  });
});

test("并发提交同一目标值：两边都成功，最终值一致", async () => {
  await withFixture("concurrent-same", async (root) => {
    const statePath = recordPathIn(root);
    const store = storeFor(statePath, { lockWaitMs: 3_000, lockRetryMs: 2 });

    const [a, b] = await Promise.all([store.commit(false), store.commit(false)]);
    assert.equal(a.kind, "ok");
    assert.equal(b.kind, "ok");
    assert.deepEqual(store.read(), { kind: "ok", enabled: false });
    assert.equal(lockFileExists(statePath), false);
  });
});

test("生产默认等待上限保持 2 秒（缩短参数只用于测试）", () => {
  assert.equal(LOCK_WAIT_MS, 2_000);
  const store = createPanelStateStore({ statePath: "/tmp/不存在/state.json" });
  assert.equal(typeof store.read, "function");
  assert.equal(typeof store.commit, "function");
  assert.equal(store.statePath, "/tmp/不存在/state.json");
});

test("夹具白名单：拒绝写非夹具路径，防止误伤真实偏好", () => {
  assert.throws(() => writeCorruptRecord("/tmp/not-a-fixture/state.json", "{"), /非夹具路径/);
  assert.throws(() => writeValidRecord(path.join(process.env.HOME ?? "/", ".pi/agent/x/state.json"), true), /非夹具路径/);
});

test("夹具目录可用：写文件后能在预期位置读到", async () => {
  await withFixture("meta", async (root) => {
    const statePath = recordPathIn(root);
    writeValidRecord(statePath, false);
    assert.equal(stateFileExists(statePath), true);
    assert.deepEqual(parseStateRecord(readFileSync(statePath, "utf8")), { kind: "ok", enabled: false });
    assert.ok(lockPathFor(statePath).startsWith(root.dir));
  });
});
