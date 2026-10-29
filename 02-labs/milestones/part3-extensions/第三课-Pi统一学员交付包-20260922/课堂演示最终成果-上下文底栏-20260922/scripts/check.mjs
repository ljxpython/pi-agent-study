#!/usr/bin/env node
/**
 * 静态检查 + 针对性测试。
 *
 * 设计前提：本阶段**不安装任何包**。脚本因此不假设 node_modules 存在，而是：
 *   - 优先使用项目内 node_modules（若使用者自行运行过 npm ci）；
 *   - 否则回落到本机已存在的 TypeScript 编译器与全局安装的 Pi 包（Pi 0.85.1）；
 *   - 通过临时 overlay tsconfig 把 `@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`
 *     与 `@types/node` 指向实际找到的位置，不修改项目内 tsconfig.json，也不写入 node_modules。
 *   - 通过 PI_TUI_ENTRY 把 pi-tui 的实际入口路径传给测试，使宽度断言用真实宽度工具而非本地复刻。
 *
 * 用法：
 *   node scripts/check.mjs                  # 类型检查 + 测试
 *   node scripts/check.mjs --typecheck-only
 *   node scripts/check.mjs --tests-only
 * 环境变量：PI_HOST_ROOT（含 Pi 包的目录）、PI_HOST_PACKAGE_DIR（Pi 包目录）、TSC（tsc 入口）
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PI_PACKAGE = "@earendil-works/pi-coding-agent";
const PI_TUI_PACKAGE = "@earendil-works/pi-tui";
const testsDir = path.join(projectRoot, "tests");

const args = new Set(process.argv.slice(2));
const runTypecheck = !args.has("--tests-only");
const runTests = !args.has("--typecheck-only");

let failures = 0;

function step(title) {
  console.log(`\n=== ${title} ===`);
}

function fail(message, hint) {
  failures += 1;
  console.error(`✗ ${message}`);
  if (hint) console.error(`  提示：${hint}`);
  return false;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function npmGlobalRoot() {
  if (process.env.PI_HOST_ROOT) return process.env.PI_HOST_ROOT;
  const result = spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function findPiPackageDir() {
  const candidates = [
    process.env.PI_HOST_PACKAGE_DIR,
    path.join(projectRoot, "node_modules", PI_PACKAGE),
    npmGlobalRoot() ? path.join(npmGlobalRoot(), PI_PACKAGE) : undefined,
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(path.join(dir, "dist", "index.d.ts")));
}

/**
 * 找到 pi-tui 的实际入口。Pi 把它作为依赖安装在自身 node_modules 下，
 * 所以优先取 Pi 包内的副本，其次取全局根下的同名包。
 */
function findPiTuiDir(piDir) {
  const globalRoot = npmGlobalRoot();
  const candidates = [
    piDir ? path.join(piDir, "node_modules", PI_TUI_PACKAGE) : undefined,
    globalRoot ? path.join(globalRoot, PI_TUI_PACKAGE) : undefined,
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(path.join(dir, "dist", "index.js")));
}

function findTsc() {
  const candidates = [process.env.TSC, path.join(projectRoot, "node_modules", "typescript", "bin", "tsc")];
  const globalRoot = npmGlobalRoot();
  if (globalRoot && existsSync(globalRoot)) {
    for (const entry of readdirSync(globalRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      candidates.push(path.join(globalRoot, entry.name, "node_modules", "typescript", "bin", "tsc"));
    }
  }
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  // 最后尝试 PATH 上的 tsc
  const probe = spawnSync("tsc", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return "tsc";
  return undefined;
}

function readPackageVersion(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const nodeVersion = process.versions.node;
console.log(`环境：Node ${nodeVersion}，项目 ${projectRoot}`);

const piDir = findPiPackageDir();
if (!piDir) {
  fail(
    `未找到 ${PI_PACKAGE} 的类型定义（dist/index.d.ts）`,
    "用 PI_HOST_PACKAGE_DIR 指定 Pi 包目录，或先运行 npm ci 安装开发依赖",
  );
} else {
  console.log(`宿主：${piDir}（版本 ${readPackageVersion(piDir)}）`);
}

const piTuiDir = findPiTuiDir(piDir);
if (!piTuiDir) {
  fail(
    `未找到 ${PI_TUI_PACKAGE} 的入口（dist/index.js）`,
    "该包由 Pi 自带，通常在 <Pi 包>/node_modules 下；确认 Pi 安装完整",
  );
} else {
  console.log(`TUI 宽度工具：${piTuiDir}（版本 ${readPackageVersion(piTuiDir)}）`);
}

if (runTypecheck && piDir && piTuiDir) {
  step("类型检查（tsc --noEmit）");
  const tscPath = findTsc();
  if (!tscPath) {
    fail("未找到 TypeScript 编译器", "设置 TSC 环境变量，或运行 npm ci 安装 devDependencies 后重试");
  } else {
    const tscArgs = tscPath === "tsc" ? [] : [tscPath];
    const version = spawnSync(tscPath === "tsc" ? "tsc" : process.execPath, [...tscArgs, "--version"], { encoding: "utf8" }).stdout?.trim();
    console.log(`编译器：${tscPath}${version ? `（${version}）` : ""}`);

    const typeRoots = [
      path.join(projectRoot, "node_modules", "@types"),
      path.join(piDir, "node_modules", "@types"),
    ].filter((dir) => existsSync(dir));

    const overlayDir = mkdtempSync(path.join(tmpdir(), "pi-context-panel-check-"));
    const overlayPath = path.join(overlayDir, "tsconfig.check.json");
    const overlay = {
      extends: path.join(projectRoot, "tsconfig.json"),
      compilerOptions: {
        // 不用 baseUrl（TS 6 已弃用）；绝对路径，避免被解析到临时目录。
        paths: {
          [PI_PACKAGE]: [path.join(piDir, "dist", "index.d.ts")],
          [PI_TUI_PACKAGE]: [path.join(piTuiDir, "dist", "index.d.ts")],
        },
      },
      include: [
        path.join(projectRoot, "extensions", "**", "*.ts"),
        path.join(projectRoot, "tests", "**", "*.ts"),
      ],
    };
    if (typeRoots.length > 0) overlay.compilerOptions.typeRoots = typeRoots;
    writeFileSync(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`);

    try {
      const result = spawnSync(
        tscPath === "tsc" ? "tsc" : process.execPath,
        [...tscArgs, "-p", overlayPath, "--pretty", "false"],
        { stdio: "inherit", cwd: projectRoot },
      );
      if (result.status === 0) ok("类型检查通过");
      else fail(`类型检查失败（退出码 ${result.status}）`);
    } finally {
      rmSync(overlayDir, { recursive: true, force: true });
    }
  }
}

if (runTests) {
  step("针对性测试（node --test）");
  const testFiles = existsSync(testsDir)
    ? readdirSync(testsDir)
        .filter((name) => name.endsWith(".test.ts"))
        .sort()
        .map((name) => path.join(testsDir, name))
    : [];
  if (testFiles.length === 0) {
    fail(`未找到测试文件：${testsDir}`);
  } else if (!piTuiDir) {
    fail("缺少 pi-tui 入口，无法运行宽度断言", "确认 Pi 安装完整后重试");
  } else {
    const nodeMajor = Number(nodeVersion.split(".")[0]);
    const nodeArgs = nodeMajor < 23 ? ["--experimental-strip-types"] : [];
    console.log(`用例文件：${testFiles.map((file) => path.relative(projectRoot, file)).join(", ")}`);
    const result = spawnSync(process.execPath, [...nodeArgs, "--test", ...testFiles], {
      stdio: "inherit",
      cwd: projectRoot,
      // 测试用真实 pi-tui 的 visibleWidth / truncateToWidth 做宽度断言。
      env: { ...process.env, PI_TUI_ENTRY: path.join(piTuiDir, "dist", "index.js") },
    });
    if (result.status === 0) ok("测试通过");
    else fail(`测试失败（退出码 ${result.status}）`);
  }
}

step("结果");
if (failures === 0) {
  console.log("全部检查通过（模拟分支测试，不能替代真实终端验证）");
  process.exit(0);
}
console.error(`${failures} 项检查失败`);
process.exit(1);
