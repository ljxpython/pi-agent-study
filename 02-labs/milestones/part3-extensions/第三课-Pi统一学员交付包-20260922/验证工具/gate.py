#!/usr/bin/env python3
"""Evidence gate, not a test runner. Never infer runtime success from receipt existence."""
import argparse
import hashlib
import json
import math
from pathlib import Path

# IDs and measurable observations correspond to 验收规范.md. All are mandatory.
COMMON = {
    'unit': {'invalid_inputs_rejected': True},
    'combo_tui': {'monitor_visible': True, 'activity_visible': True, 'final_reply_visible': True},
    'prompt_fresh': {'natural_language_entry': True, 'no_preseed_or_probe': True},
    'prompt_resume': {'natural_language_entry': True, 'prior_goal_visible': True},
    'no_events': {'explicit_failure': True, 'success_not_reported': True, 'children_remaining': 0},
    'stream_drop': {'explicit_failure_or_bounded_recovery': True, 'partial_reply_preserved': True},
    'heartbeat_stall': {'business_deadline_enforced': True, 'success_not_reported': True},
    'cancel_wait': {'next_prompt_works': True, 'children_remaining': 0},
    'cancel_tool': {'next_prompt_works': True, 'children_remaining': 0},
    'lifecycle': {'reload_twice': True, 'no_duplicate_handlers': True, 'new_session_works': True, 'restart_works': True},
    'render': {'widths': [80, 120, 160], 'themes': ['dark', 'light'], 'compact_expanded': True, 'long_chinese': True, 'no_clipping_or_lost_reply': True, 'no_secret_or_reasoning_leak': True},
    'repeat_session': {'turns_at_least_3': True, 'idle_reply_visible_30s': True, 'no_key_needed_to_restore': True},
    'global_journey': {'natural_language_entry': True, 'ordinary_pi_start': True, 'no_extension_bypass': True},
    'clean_install': {'fresh_extraction': True, 'documented_install_only': True, 'natural_language_entry': True},
}
TEAMS = {
    'teams_graph': {'offline_peer_fails': True, 'dependency_deadlock_rejected_or_blocked': True, 'explicit_per_task_models': True},
    'teams_messages': {'receiver_evidence_both_directions': True, 'independent_assertions': True, 'children_remaining': 0},
    'long_run': {'at_least_three_stages': True, 'context_goal_retained': True, 'children_remaining': 0},
}
REAL = {'prompt_fresh', 'prompt_resume', 'global_journey', 'clean_install', 'teams_messages', 'long_run'}
SKIP = {'node_modules', '.git', '__pycache__', '.DS_Store'}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def tree(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob('*'))
            if p.is_file() and not any(x in SKIP for x in p.relative_to(root).parts)}


def template(profile):
    required = COMMON | (TEAMS if profile == 'agent-teams' else {})
    return {'schema': 1, 'profile': profile, 'runtime': {}, 'delivery': {},
            'prompt': {}, 'blockers': [], 'history': [],
            'checks': [{'id': key, 'status': 'NOT_RUN', 'driver': '', 'provider': '',
                        'observations': {}, 'evidence': []} for key in required]}


def validate(data, base):
    errors = []
    def need(condition, message):
        if not condition:
            errors.append(message)
    def artifact(ref):
        if not isinstance(ref, dict) or not isinstance(ref.get('path'), str):
            errors.append('缺少证据文件引用'); return False
        p = (base / ref['path']).resolve()
        if not p.is_relative_to(base.resolve()) or not p.is_file():
            errors.append('证据缺失或越过收据目录: ' + ref['path']); return False
        valid = bool(p.stat().st_size) and sha(p) == ref.get('sha256')
        need(valid, '证据为空或哈希失配: ' + ref['path'])
        return valid
    def limit(obs, key, maximum):
        v = obs.get(key)
        need(type(v) in (int, float) and math.isfinite(v) and 0 <= v <= maximum,
             f'{key} 未测量或超出 {maximum}')
    need(data.get('schema') == 1, '未知 schema')
    profile = data.get('profile')
    need(profile in ('extension', 'agent-teams'), '缺少受支持的 profile')
    required = COMMON | (TEAMS if profile == 'agent-teams' else {})
    runtime = data.get('runtime', {})
    for key in ('pi_version', 'node_version', 'os', 'terminal', 'extensions'):
        need(bool(runtime.get(key)), '缺少运行环境: ' + key)
    need(data.get('blockers') == [], '存在阻塞项或未登记 blockers')
    delivery = data.get('delivery', {})
    expected = delivery.get('sha256_by_path')
    need(isinstance(expected, dict) and bool(expected), '未冻结完整源码清单')
    for key in ('source_root', 'installed_root', 'extracted_root'):
        value = delivery.get(key)
        root = Path(value) if isinstance(value, str) and value else None
        need(root is not None and root.is_dir(), '缺少实际目录: ' + key)
        if root is not None and root.is_dir() and isinstance(expected, dict):
            need(tree(root) == expected, key + ' 与冻结源码不一致')
    prompt = data.get('prompt', {})
    artifact(prompt)
    checks = data.get('checks', [])
    if not isinstance(checks, list):
        return errors + ['checks 必须为数组']
    ids = [c.get('id') for c in checks if isinstance(c, dict)]
    need(len(ids) == len(checks) and len(ids) == len(set(ids)), '检查项无效或 ID 重复')
    by_id = {c['id']: c for c in checks if isinstance(c, dict) and isinstance(c.get('id'), str)}
    for key, expectations in required.items():
        c = by_id.get(key, {})
        need(c.get('status') == 'PASS', key + ' 未通过')
        if key != 'unit':
            need(c.get('driver') in ('tmux', 'pty'), key + ' 缺少原生终端证据')
        if key in REAL:
            need(c.get('provider') == 'real', key + ' 不可用 fixture 替代真实模型')
            need(c.get('prompt_sha256') == prompt.get('sha256') and bool(prompt.get('sha256')),
                 key + ' 未使用交付提示词')
        evidence = c.get('evidence', [])
        need(isinstance(evidence, list) and bool(evidence), key + ' 缺少证据')
        if isinstance(evidence, list):
            for ref in evidence:
                artifact(ref)
        obs = c.get('observations', {})
        for name, expected_value in expectations.items():
            need(type(obs.get(name)) is type(expected_value) and obs.get(name) == expected_value,
                 key + ': ' + name + ' 未满足')
        if key in ('combo_tui', 'no_events', 'heartbeat_stall'):
            limit(obs, 'first_feedback_ms', 1000)
            limit(obs, 'progress_refresh_ms', 2000)
        if key in ('cancel_wait', 'cancel_tool'):
            limit(obs, 'cancel_ack_ms', 1000)
            limit(obs, 'children_exit_ms', 10000)
        if key == 'no_events':
            limit(obs, 'deadline_ms', 120000)
            deadline = obs.get('deadline_ms')
            if type(deadline) in (int, float) and math.isfinite(deadline) and deadline > 0:
                limit(obs, 'failure_ms', deadline + 6000)
            else:
                errors.append('无事件截止时间必须为正数')
        if key == 'heartbeat_stall':
            limit(obs, 'business_deadline_ms', 900000)
            deadline = obs.get('business_deadline_ms')
            if type(deadline) in (int, float) and math.isfinite(deadline) and deadline > 0:
                limit(obs, 'failure_ms', deadline + 10000)
            else:
                errors.append('业务截止时间必须为正数')
        if key == 'prompt_fresh':
            runs = c.get('runs', [])
            need(isinstance(runs, list) and len(runs) >= 3, '原始提示词不足三轮独立复验')
            if isinstance(runs, list):
                last = runs[-3:]
                need(len({x.get('session_id') for x in last}) == 3, '三轮必须是不同会话')
                for run in last:
                    need(bool(run.get('session_id')) and run.get('status') == 'PASS'
                         and run.get('prompt_sha256') == prompt.get('sha256'), '最近三轮未连续通过同一提示词')
                    artifact(run.get('evidence'))
        if key == 'long_run':
            duration = obs.get('duration_ms')
            need(type(duration) in (int, float) and math.isfinite(duration) and duration >= 900000,
                 '团队长任务不足15分钟或未测量')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('receipt', nargs='?', type=Path)
    parser.add_argument('--init', choices=['extension', 'agent-teams'])
    args = parser.parse_args()
    if args.init:
        print(json.dumps(template(args.init), ensure_ascii=False, indent=2)); return 0
    if not args.receipt:
        parser.error('需要收据路径或 --init')
    try:
        errors = validate(json.loads(args.receipt.read_text()), args.receipt.parent)
    except (ValueError, OSError, TypeError, AttributeError, KeyError) as exc:
        errors = ['无效收据: ' + str(exc)]
    print(json.dumps({'status': 'BLOCKED' if errors else 'EVIDENCE_COMPLETE_REVIEW_REQUIRED',
                      'errors': errors}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
