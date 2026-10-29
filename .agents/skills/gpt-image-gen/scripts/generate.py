#!/usr/bin/env python3
"""
FluxCode / OpenAI-Compatible Image Generation & Edit Script.
Supports zero-cost pre-flight checks, local prompt linting, automatic gateway failover, and exponential backoff retry.
"""

import argparse
import base64
import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error
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
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    env_vars[key] = val
    except Exception as e:
        print(f"[WARN] Failed to read {filepath}: {e}", file=sys.stderr)
    return env_vars


def find_project_env() -> Path:
    cur = Path.cwd().resolve()
    for p in [cur, *cur.parents]:
        env_f = p / ".env"
        if env_f.is_file():
            return env_f
    return Path(".env")


def resolve_gateways() -> list[dict]:
    """
    Resolve prioritized gateway configurations for high-availability failover.
    Primary: Local project .env / process env
    Secondary: Global ~/.my_best/.env (if different)
    """
    project_env_path = find_project_env()
    project_env = load_env_file(project_env_path) if project_env_path.exists() else {}
    best_env_path = Path.home() / ".my_best" / ".env"
    global_env = load_env_file(best_env_path)

    gateways = []

    def extract_gw(source_env: dict, source_name: str, prefix="IMAGE_25"):
        url = source_env.get(f"{prefix}_URL")
        key = source_env.get(f"{prefix}_KEY")
        model = source_env.get(f"{prefix}_MODEL") or "gpt-image-2.5"
        if url and key:
            return {
                "base_url": url.rstrip("/"),
                "api_key": key,
                "model": model,
                "source": source_name,
            }
        return None

    # 1. Project-level .env (Highest priority for workspace isolation)
    proj_gw = extract_gw(project_env, f"project_env ({project_env_path})")
    if proj_gw:
        gateways.append(proj_gw)

    # 2. Project backup (if configured as IMAGE_25_BACKUP_*)
    proj_backup = extract_gw(project_env, "project_backup_env", prefix="IMAGE_25_BACKUP")
    if proj_backup and not any(g["base_url"] == proj_backup["base_url"] and g["api_key"] == proj_backup["api_key"] for g in gateways):
        gateways.append(proj_backup)

    # 3. Process environment (IMAGE_25_* only)
    proc_gw = extract_gw(os.environ, "process_env")
    if proc_gw and not any(g["base_url"] == proc_gw["base_url"] and g["api_key"] == proc_gw["api_key"] for g in gateways):
        gateways.append(proc_gw)

    # 4. Global ~/.my_best/.env fallback
    glob_gw = extract_gw(global_env, f"global_env ({best_env_path})")
    if glob_gw and not any(g["base_url"] == glob_gw["base_url"] and g["api_key"] == glob_gw["api_key"] for g in gateways):
        gateways.append(glob_gw)

    # Fallback default if nothing is found
    if not gateways:
        default_url = "https://wawapii.com/v1"
        gateways.append({
            "base_url": default_url,
            "api_key": "",
            "model": "gpt-image-2.5",
            "source": "default_unconfigured",
        })

    return gateways


def lint_prompt(prompt: str) -> tuple[bool, list[str], list[str]]:
    """
    Zero-cost local static Prompt Linter.
    Validates structure, syntax, text budget, and safety constraints.
    Returns (is_valid, errors, warnings).
    """
    errors = []
    warnings = []

    if not prompt or not prompt.strip():
        errors.append("Prompt is completely empty.")
        return False, errors, warnings

    cleaned = prompt.strip()

    # Case 1: Structured JSON Prompt
    if cleaned.startswith("{"):
        if not cleaned.endswith("}"):
            errors.append("Unclosed JSON: Prompt starts with '{' but does not close with '}'.")
            return False, errors, warnings
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            errors.append(f"Structured JSON syntax error at line {e.lineno}, col {e.colno}: {e.msg}")
            return False, errors, warnings

        if not isinstance(data, dict):
            errors.append("Structured JSON root must be a dictionary object.")
            return False, errors, warnings

        # Structural inspection
        if "type" not in data and "subject" not in data and "theme" not in data:
            warnings.append("Missing high-level descriptor ('type', 'subject', or 'theme') in JSON root.")

        # Check negative prompt constraint
        neg_keys = [k for k in data.keys() if "negative" in k.lower()]
        if not neg_keys:
            warnings.append("No negative prompt field ('strict_negative' or 'negative_prompt') detected in JSON payload.")

        # Text Budget recursive inspection (preventing overly verbose text slots)
        def inspect_strings(obj, path=""):
            if isinstance(obj, str):
                # If a label or title is longer than 50 chars, warn about hallucination risk
                if any(kw in path.lower() for kw in ["title", "label", "headline", "step", "name"]) and len(obj) > 40:
                    warnings.append(f"Text budget warning at '{path}': '{obj[:25]}...' exceeds 40 chars. Long phrases often cause rendering typos.")
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    inspect_strings(v, f"{path}.{k}" if path else k)
            elif isinstance(obj, list):
                for idx, item in enumerate(obj):
                    inspect_strings(item, f"{path}[{idx}]")

        inspect_strings(data)

    # Case 2: Natural Language Prompt
    else:
        if len(cleaned) < 10:
            warnings.append("Prompt is unusually short (< 10 characters). Output may be unpredictable.")
        if len(cleaned) > 2500:
            warnings.append(f"Prompt is very long ({len(cleaned)} chars). Consider structured JSON mode to prevent prompt truncation.")
        if "negative" not in cleaned.lower() and "no text" not in cleaned.lower():
            warnings.append("No negative constraints (e.g. 'NO text, NO watermark') found in prompt.")

    return len(errors) == 0, errors, warnings


def check_gateway_health(gateway: dict, timeout=8) -> tuple[bool, str]:
    """
    Zero-Cost Pre-Flight Probe via GET /v1/models.
    Consumes 0 Image Tokens and 0 Cost!
    Validates API key validity, network connectivity, and target model existence.
    """
    base_url = gateway["base_url"]
    api_key = gateway["api_key"]
    target_model = gateway["model"]

    if not api_key:
        return False, "API Key is empty."

    endpoint = f"{base_url}/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    req = urllib.request.Request(endpoint, headers=headers, method="GET")
    ssl_context = ssl._create_unverified_context()

    try:
        start_t = time.time()
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as resp:
            elapsed = time.time() - start_t
            if resp.status == 200:
                body = json.loads(resp.read().decode("utf-8"))
                models = [m.get("id") for m in body.get("data", []) if isinstance(m, dict)]
                if models and target_model in models:
                    return True, f"OK ({elapsed:.2f}s, verified '{target_model}')"
                elif models:
                    return True, f"OK ({elapsed:.2f}s, gateway responsive, {len(models)} models listed)"
                return True, f"OK ({elapsed:.2f}s, gateway responsive)"
            return False, f"HTTP status {resp.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        if e.code in (401, 403):
            return False, f"Auth Failed (HTTP {e.code}): Check API Key."
        return False, f"HTTP {e.code} - {e.reason}: {body[:80]}"
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return False, f"Network unreachable: {e}"
    except Exception as e:
        return False, f"Probe error: {e}"


def main():
    parser = argparse.ArgumentParser(description="Industrial-grade OpenAI-Compatible Image Generation with Pre-flight & Lint.")
    parser.add_argument("prompt", nargs="?", default="", help="Text prompt or structured JSON for image generation")
    parser.add_argument("-o", "--output", default="output.png", help="Output image file path (default: output.png)")
    parser.add_argument("-s", "--size", default="1024x1024", help="Image size (e.g. 1024x1024, 2048x1152)")
    parser.add_argument("-q", "--quality", default="medium", choices=["auto", "low", "medium", "high"], help="Image quality")
    parser.add_argument("-f", "--format", default="png", choices=["png", "jpeg", "webp"], help="Output format")
    parser.add_argument("-m", "--model", default=None, help="Override model name")
    parser.add_argument("--url", default=None, help="Override base URL")
    parser.add_argument("--key", default=None, help="Override API Key")
    parser.add_argument("--lint", action="store_true", help="Perform zero-cost local prompt linting and exit")
    parser.add_argument("--dry-run", action="store_true", help="Perform local lint + zero-cost network health probe without calling image generation API")
    parser.add_argument("--skip-probe", action="store_true", help="Skip pre-flight probe and execute image generation directly")

    args = parser.parse_args()

    if not args.prompt:
        parser.print_help()
        sys.exit(1)

    # -------------------------------------------------------------
    # Step 1: Zero-Cost Local Prompt Linting
    # -------------------------------------------------------------
    is_valid, errors, warnings = lint_prompt(args.prompt)
    if errors:
        print("❌ [LINT FAILED] Local prompt pre-validation rejected the payload:")
        for err in errors:
            print(f"   • {err}")
        sys.exit(1)

    if warnings:
        print("⚠️ [LINT WARNINGS]:")
        for w in warnings:
            print(f"   • {w}")

    if args.lint:
        print("✅ [LINT SUCCESS] Prompt passed local syntax and structural verification! (0 tokens consumed)")
        sys.exit(0)

    # -------------------------------------------------------------
    # Step 2: Gateway Resolution
    # -------------------------------------------------------------
    gateways = resolve_gateways()

    # Manual CLI override
    if args.url or args.key or args.model:
        override_gw = {
            "base_url": (args.url or gateways[0]["base_url"]).rstrip("/"),
            "api_key": args.key or gateways[0]["api_key"],
            "model": args.model or gateways[0]["model"],
            "source": "cli_override",
        }
        gateways.insert(0, override_gw)

    # -------------------------------------------------------------
    # Step 3: Zero-Cost Pre-flight Probe (Optional Dry-Run)
    # -------------------------------------------------------------
    healthy_gateways = []

    if not args.skip_probe:
        print("[*] Performing zero-cost pre-flight health probe across gateway pool (0 Image Tokens)...")
        for gw in gateways:
            ok, msg = check_gateway_health(gw)
            status_icon = "🟢" if ok else "🔴"
            print(f"    {status_icon} [{gw['source']}] {gw['base_url']} ({gw['model']}) -> {msg}")
            if ok:
                healthy_gateways.append(gw)
    else:
        healthy_gateways = gateways

    if args.dry_run:
        if healthy_gateways:
            print(f"✅ [DRY-RUN SUCCESS] Ready for one-click generation! {len(healthy_gateways)} healthy gateway(s) available.")
            sys.exit(0)
        else:
            print("❌ [DRY-RUN FAILED] No healthy gateways found. Please check API credentials.", file=sys.stderr)
            sys.exit(1)

    if not healthy_gateways:
        print("[WARN] All pre-flight probes failed or were inconclusive. Falling back to primary gateway anyway...")
        healthy_gateways = gateways

    # -------------------------------------------------------------
    # Step 4: Industrial Image Generation Execution with Failover & Backoff
    # -------------------------------------------------------------
    payload = {
        "prompt": args.prompt,
        "n": 1,
        "size": args.size,
        "quality": args.quality,
        "output_format": args.format,
    }

    ssl_context = ssl._create_unverified_context()
    generation_success = False
    resp_data = None
    last_error = None

    for gw_idx, active_gw in enumerate(healthy_gateways, start=1):
        base_url = active_gw["base_url"]
        api_key = active_gw["api_key"]
        model = active_gw["model"]
        payload["model"] = model

        endpoint = f"{base_url}/images/generations"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        print(f"\n[*] Launching generation on gateway #{gw_idx} [{active_gw['source']}]")
        print(f"    Endpoint: {endpoint} | Model: {model} | Size: {args.size} | Quality: {args.quality}")

        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                if attempt > 1:
                    backoff_sec = 2 ** (attempt - 1)
                    print(f"[*] Transient error recovery: Sleeping {backoff_sec}s before attempt {attempt}/{max_attempts}...")
                    time.sleep(backoff_sec)

                with urllib.request.urlopen(req, timeout=240, context=ssl_context) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    generation_success = True
                    break

            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")
                last_error = f"HTTP {e.code} - {e.reason}: {body}"
                print(f"[!] HTTP Error on attempt {attempt}: {last_error}", file=sys.stderr)

                # Unrecoverable client error: Don't retry, abort or failover immediately
                if e.code in (400, 401, 403):
                    print(f"[!] Fatal client error {e.code}. Skipping retries on this gateway.", file=sys.stderr)
                    break
                # Server side 502/503/504 or rate limit 429: Eligible for exponential backoff

            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_error = f"Network exception: {e}"
                print(f"[!] Network error on attempt {attempt}: {e}", file=sys.stderr)

            except Exception as e:
                last_error = f"Unexpected exception: {e}"
                print(f"[!] Unexpected error on attempt {attempt}: {e}", file=sys.stderr)

        if generation_success:
            break
        else:
            print(f"[WARN] Gateway #{gw_idx} failed after retries. Failing over to next available gateway...", file=sys.stderr)

    if not generation_success or not resp_data or "data" not in resp_data or not resp_data["data"]:
        print(f"\n❌ [FATAL] Generation failed across all candidate gateways. Last error: {last_error}", file=sys.stderr)
        sys.exit(1)

    # -------------------------------------------------------------
    # Step 5: Save Image Output
    # -------------------------------------------------------------
    first = resp_data["data"][0]
    out_path = Path(args.output).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if "b64_json" in first:
        img_bytes = base64.b64decode(first["b64_json"])
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"\n✅ [+] Successfully saved image to: {out_path} ({len(img_bytes)} bytes)")
    elif "url" in first:
        img_url = first["url"]
        print(f"\n[*] Downloading image from URL: {img_url}")
        dl_req = urllib.request.Request(img_url, headers={"User-Agent": headers["User-Agent"]})
        with urllib.request.urlopen(dl_req, timeout=60, context=ssl_context) as dl_resp:
            with open(out_path, "wb") as f:
                f.write(dl_resp.read())
        print(f"\n✅ [+] Successfully downloaded and saved image to: {out_path}")
    else:
        print(f"[ERROR] Neither b64_json nor url found in response: {first}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
