#!/usr/bin/env python3
"""
Article Publisher CLI Wrapper for WechatSync Bridge.
Synchronizes Markdown/HTML content directly into draft boxes of 29+ content platforms
(Juejin, Zhihu, Xiaohongshu, CSDN, Yuque, etc.) via local Chrome extension bridge.
"""

import argparse
import os
import re
import subprocess
import sys
import time
from pathlib import Path


def load_env_file(filepath: Path) -> dict:
    env_vars = {}
    if not filepath.exists():
        return env_vars
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip("\"'")
    except Exception as e:
        print(f"[WARN] Failed to read {filepath}: {e}", file=sys.stderr)
    return env_vars


def resolve_token() -> str:
    # 1. Process environment
    token = os.environ.get("WECHATSYNC_TOKEN") or os.environ.get("MCP_TOKEN")
    if token:
        return token

    # 2. Local project .env
    cur = Path.cwd().resolve()
    for p in [cur, *cur.parents]:
        env_f = p / ".env"
        if env_f.is_file():
            loaded = load_env_file(env_f)
            token = loaded.get("WECHATSYNC_TOKEN") or loaded.get("MCP_TOKEN")
            if token:
                return token

    # 3. Global ~/.my_best/.env
    global_env = Path.home() / ".my_best" / ".env"
    if global_env.is_file():
        loaded = load_env_file(global_env)
        token = loaded.get("WECHATSYNC_TOKEN") or loaded.get("MCP_TOKEN")
        if token:
            return token

    return ""


def extract_first_image(markdown_content: str, base_dir: Path) -> str:
    """Extract the first image path or URL from markdown content."""
    match = re.search(r'!\[.*?\]\((.*?)\)', markdown_content)
    if match:
        img_path = match.group(1).strip()
        if img_path.startswith("http://") or img_path.startswith("https://"):
            return img_path
        # Local relative path or absolute path
        p = Path(img_path)
        if p.is_file():
            return str(p.resolve())
        resolved = (base_dir / img_path).resolve()
        if resolved.is_file():
            return str(resolved)
    return ""


def extract_title_from_markdown(content: str) -> str:
    """Extract title from the first level 1 heading."""
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def run_wechatsync_stream(args_list: list[str], token: str, timeout: int = 60) -> int:
    env = os.environ.copy()
    if token:
        env["WECHATSYNC_TOKEN"] = token
        env["MCP_TOKEN"] = token

    cmd = ["npx", "@wechatsync/cli", *args_list]
    
    proc = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True,
    )

    start_time = time.time()
    last_output_time = time.time()

    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                if proc.poll() is not None:
                    break
                time.sleep(0.1)
                # If stuck without any output for 35s, or total timeout 60s
                if time.time() - last_output_time > 35:
                    proc.kill()
                    print("\n[!] 错误：等待 Chrome 插件连接超时（35秒未响应）！", file=sys.stderr)
                    print("    请检查：", file=sys.stderr)
                    print("    1. Chrome 浏览器是否已开启？", file=sys.stderr)
                    print("    2. 是否已在 WechatSync 扩展设置中开启【CLI / MCP 连接】？", file=sys.stderr)
                    print("    3. 端口 9527 是否被其他后台进程占用？", file=sys.stderr)
                    return 124
                continue

            last_output_time = time.time()
            sys.stdout.write(line)
            sys.stdout.flush()

        return proc.wait()
    except KeyboardInterrupt:
        proc.kill()
        print("\n[!] 进程被手动中断。", file=sys.stderr)
        return 130
    except Exception as e:
        proc.kill()
        print(f"\n[!] 执行异常: {e}", file=sys.stderr)
        return 1


def cmd_list_platforms(token: str, show_auth=True):
    args = ["platforms"]
    if show_auth:
        args.append("--auth")
    print("[*] 正在通过 Chrome 扩展探测支持的平台及登录态...")
    code = run_wechatsync_stream(args, token, timeout=30)
    sys.exit(code)


def cmd_sync(file_path: Path, platforms: str, cover: str, title: str, dry_run: bool, token: str):
    if not file_path.is_file():
        print(f"[!] 错误：未找到目标文章文件: {file_path}", file=sys.stderr)
        sys.exit(1)

    content = file_path.read_text(encoding="utf-8")

    # Auto extract title if not provided
    if not title:
        detected_title = extract_title_from_markdown(content)
        if detected_title:
            title = detected_title
            print(f"[*] 自动提取文章标题: {title}")

    # Xiaohongshu requires cover image
    target_platforms = [p.strip().lower() for p in platforms.split(",") if p.strip()]
    if "xiaohongshu" in target_platforms and not cover:
        extracted = extract_first_image(content, file_path.parent)
        if extracted:
            print(f"[*] 针对小红书自动提取第一张配图作为封面: {extracted}")
            cover = extracted
        else:
            print("[WARN] 目标平台包含小红书但未指定封面，可能导致发布草稿失败！", file=sys.stderr)

    # Multi-platform Referer ACL protection:
    # Zhihu and Juejin enforce strict Referer ACLs. If zhihu is mixed with juejin/others,
    # juejin CDN returns 403 on zhihu.com. We automatically split zhihu into its own dedicated batch!
    batches = []
    if "zhihu" in target_platforms and len(target_platforms) > 1:
        batches.append(["zhihu"])
        remaining = [p for p in target_platforms if p != "zhihu"]
        if remaining:
            batches.append(remaining)
        print("[*] 检测到目标包含知乎：自动拆解为专属图床批次，杜绝跨站 Referer ACL 防盗链 403 碎图！")
    else:
        batches.append(target_platforms)

    exit_code = 0
    for b_platforms in batches:
        p_str = ",".join(b_platforms)
        args = ["sync", str(file_path), "-p", p_str]
        if cover:
            args.extend(["--cover", cover])
        if title:
            args.extend(["--title", title])
        if dry_run:
            args.append("--dry-run")

        print(f"\n[*] 开始向目标批次 [{p_str}] 推送草稿...")
        code = run_wechatsync_stream(args, token, timeout=90)
        if code != 0:
            exit_code = code

    sys.exit(exit_code)


def main():
    parser = argparse.ArgumentParser(description="工业级多平台文章自动发文/草稿箱同步工具（基于 WechatSync 桥接）")
    subparsers = parser.add_subparsers(dest="command", help="可用子命令")

    # Subcommand: list / platforms
    subparsers.add_parser("list", help="列出所有支持的 29+ 平台及当前登录状态")

    # Subcommand: sync
    parser_sync = subparsers.add_parser("sync", help="同步文章到各平台草稿箱")
    parser_sync.add_argument("file", help="待发布的 Markdown 或 HTML 文件路径")
    parser_sync.add_argument("-p", "--platforms", default="zhihu,juejin,csdn,cnblogs", help="目标平台逗号分隔（默认收敛四大平台: zhihu,juejin,csdn,cnblogs）")
    parser_sync.add_argument("-c", "--cover", default="", help="封面图绝对路径或 URL（小红书强制必须）")
    parser_sync.add_argument("-t", "--title", default="", help="自定义文章标题（默认从首行 # 提取）")
    parser_sync.add_argument("--dry-run", action="store_true", help="演练模式，仅预览不实际推送")

    args = parser.parse_args()

    token = resolve_token()
    if not token and args.command != "list":
        print("[!] 警告：未检测到 WECHATSYNC_TOKEN。请确认本地 .env 或 Chrome 扩展已配置连接 Token。", file=sys.stderr)

    if args.command in ("list", None):
        cmd_list_platforms(token)
    elif args.command == "sync":
        cmd_sync(
            file_path=Path(args.file).resolve(),
            platforms=args.platforms,
            cover=args.cover,
            title=args.title,
            dry_run=args.dry_run,
            token=token,
        )


if __name__ == "__main__":
    main()
