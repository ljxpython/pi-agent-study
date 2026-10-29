// Local deterministic provider for testing real Pi streaming/dispatch/rendering. No network.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import { Type } from 'typebox';
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(new Error('Request was aborted'));
        return;
    }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    function abort() { clearTimeout(timer); reject(new Error('Request was aborted')); }
    signal?.addEventListener('abort', abort, { once: true });
});
export default function (pi: ExtensionAPI) {
    pi.registerCommand('fixture-ready', { description: 'Test readiness', handler: async (_args, ctx) => { writeFileSync(join(ctx.cwd, 'fixture-ready'), 'ready'); } });
    pi.registerTool({ name: 'fixture_check', label: 'Fixture check', description: 'Local UI test only', parameters: Type.Object({ index: Type.Number(), fail: Type.Boolean() }), executionMode: 'sequential',
        async execute(_id, args, signal) { await delay(650, signal); if (args.fail)
            throw new Error('登录过期后未跳转到登录页'); return { content: [{ type: 'text', text: `RAW_TOOL_OUTPUT_${args.index}` }], details: { index: args.index } }; },
    });
    pi.registerCommand('fixture-confirm', { description: 'Test real approval visibility', async handler(_args, ctx) { const ok = await ctx.ui.confirm('操作确认', '是否执行需要确认的操作？'); ctx.ui.notify(ok ? '确认完成' : '已取消确认', 'info'); } });
    pi.registerProvider('concise-fixture', {
        baseUrl: 'http://127.0.0.1/unused', apiKey: 'fixture-not-a-secret', api: 'concise-fixture-api' as any,
        models: [{ id: 'demo-model', name: 'Local deterministic UI fixture', reasoning: true, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000000, maxTokens: 65536 }],
        streamSimple(model, context, options) {
            const stream = createAssistantMessageEventStream();
            (async () => {
                const lastUser = context.messages.findLastIndex(m => m.role === 'user');
                const user = context.messages[lastUser];
                const prompt = typeof user?.content === 'string' ? user.content : JSON.stringify(user?.content);
                const results = context.messages.slice(lastUser + 1).filter(m => m.role === 'toolResult');
                const output: any = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 736, output: 143, cacheRead: 24576, cacheWrite: 0, totalTokens: 25455, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'pending', timestamp: Date.now() };
                try {
                    stream.push({ type: 'start', partial: output });
                    output.content.push({ type: 'thinking', thinking: '' });
                    stream.push({ type: 'thinking_start', contentIndex: 0, partial: output });
                    output.content[0].thinking = 'THINKING_SENTINEL_SHOULD_NEVER_APPEAR';
                    stream.push({ type: 'thinking_delta', contentIndex: 0, delta: output.content[0].thinking, partial: output });
                    await delay(1800, options?.signal);
                    stream.push({ type: 'thinking_end', contentIndex: 0, content: output.content[0].thinking, partial: output });
                    if (!results.length && !prompt.includes('你好')) {
                        const count = prompt.includes('长任务') ? 40 : 6;
                        for (let i = 0; i < count; i++) {
                            const block: any = { type: 'toolCall', id: `fixture-${lastUser}-${i}`, name: i === 0 ? 'bash' : 'fixture_check', arguments: i === 0 ? { command: 'pwd && printf "RAW_BASH_OUTPUT\\n"' } : { index: i, fail: prompt.includes('失败') && i === 1 } };
                            const index = output.content.length;
                            output.content.push(block);
                            stream.push({ type: 'toolcall_start', contentIndex: index, partial: output });
                            stream.push({ type: 'toolcall_delta', contentIndex: index, delta: JSON.stringify(block.arguments), partial: output });
                            stream.push({ type: 'toolcall_end', contentIndex: index, toolCall: block, partial: output });
                        }
                        output.stopReason = 'toolUse';
                        stream.push({ type: 'done', reason: 'toolUse', message: output });
                    }
                    else {
                        const text = prompt.includes('你好') ? '你好！有什么需要我帮你完成的？' : prompt.includes('失败') ? '发现登录跳转测试失败，需要继续修复。' : '已完成本地验证。所有工具结果已收到，任务目标保留。';
                        output.content.push({ type: 'text', text });
                        stream.push({ type: 'text_start', contentIndex: 1, partial: output });
                        stream.push({ type: 'text_delta', contentIndex: 1, delta: text, partial: output });
                        stream.push({ type: 'text_end', contentIndex: 1, content: text, partial: output });
                        output.stopReason = 'stop';
                        stream.push({ type: 'done', reason: 'stop', message: output });
                    }
                }
                catch (error) {
                    output.stopReason = options?.signal?.aborted ? 'aborted' : 'error';
                    output.errorMessage = String(error);
                    stream.push({ type: 'error', reason: output.stopReason, error: output });
                }
                stream.end();
            })();
            return stream;
        },
    });
}
