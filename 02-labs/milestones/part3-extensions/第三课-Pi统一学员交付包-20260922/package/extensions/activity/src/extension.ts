import { VERSION, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { installAdapter, type ViewState } from './adapter.ts';
import { colors } from './presentation.ts';
export default function (pi: ExtensionAPI) {
    const state: ViewState = { enabled: true, active: false };
    // Public transformer protects the reload interval before the UI adapter is rebound.
    pi.registerMarkdownTransformer((markdown, context) => VERSION === '0.85.1' && state.enabled && context.messageType === 'assistant-thinking' ? '' : markdown);
    let current: ExtensionContext | undefined;
    let redraw: ((force?: boolean) => void) | undefined;
    let dispose: ((freezeView?: boolean) => void) | undefined;
    function working(label = '等待模型响应…') {
        if (current?.mode !== 'tui' || VERSION !== '0.85.1')
            return;
        if (state.enabled) {
            current.ui.setWorkingIndicator({ frames: [colors.active + '●' + colors.reset, colors.muted + '●' + colors.reset], intervalMs: 450 });
            current.ui.setWorkingMessage(label);
        }
        else {
            current.ui.setWorkingIndicator();
            current.ui.setWorkingMessage();
        }
        current.ui.setWorkingVisible(true);
    }
    function mount(ctx: ExtensionContext) {
        ctx.ui.setWidget('concise-activity-lifecycle', (tui) => {
            dispose = installAdapter(tui, state);
            redraw = (force = false) => tui.requestRender(force);
            return { render: () => [], invalidate() { }, dispose() { dispose?.(true); dispose = undefined; redraw = undefined; } };
        });
    }
    pi.on('session_start', async (_event, ctx) => {
        dispose?.();
        current = ctx;
        state.active = false;
        if (ctx.mode !== 'tui')
            return;
        if (VERSION !== '0.85.1') {
            ctx.ui.notify(`简洁执行模式未启用：当前 Pi ${VERSION}，已验证版本为 0.85.1。`, 'warning');
            return;
        }
        mount(ctx);
        ctx.ui.setToolsExpanded(false);
        working();
        redraw?.();
    });
    pi.on('agent_start', async (_event, ctx) => { current = ctx; state.active = true; working(); redraw?.(); });
    pi.on('message_start', async (event, ctx) => { current = ctx; if (event.message.role === 'assistant')
        working(); });
    pi.on('message_update', async (event, ctx) => {
        current = ctx;
        if (VERSION === '0.85.1' && state.enabled && ctx.mode === 'tui') {
            const type = event.assistantMessageEvent.type;
            if (type === 'text_delta') ctx.ui.setWorkingMessage('正在生成回复…');
            else if (type === 'thinking_delta') ctx.ui.setWorkingMessage('正在思考…');
        }
    });
    pi.on('turn_start', async (_event, ctx) => { current = ctx; if (state.active) working(); });
    pi.on('tool_execution_start', async (_event, ctx) => {
        current = ctx;
        if (VERSION === '0.85.1' && state.enabled && ctx.mode === 'tui')
            ctx.ui.setWorkingVisible(false);
        redraw?.();
    });
    pi.on('agent_end', async (_event, ctx) => { current = ctx; state.active = false; redraw?.(); });
    // Commit the settled frame after native subscribers have finalized the reply.
    // This must not depend on a subsequent keyboard event to invalidate the screen.
    pi.on('agent_settled', async (_event, ctx) => {
        if (ctx.mode !== 'tui' || !state.enabled) return;
        await new Promise<void>(resolve => setImmediate(() => { redraw?.(true); resolve(); }));
    });
    pi.on('session_shutdown', async () => { dispose?.(); dispose = undefined; redraw = undefined; });
    pi.registerCommand('activity', {
        description: '简洁执行：details 展开、compact 收起、off 原生、on 启用',
        handler: async (args, ctx) => {
            if (ctx.mode !== 'tui')
                return;
            if (VERSION !== '0.85.1') {
                ctx.ui.notify('当前 Pi 版本不受支持，保持原生界面。', 'warning');
                return;
            }
            const command = args.trim();
            if (!['', 'on', 'off', 'details', 'compact'].includes(command)) {
                ctx.ui.notify('用法：/activity [on|off|details|compact]', 'info');
                return;
            }
            if (!dispose)
                mount(ctx);
            if (command === 'off') {
                state.enabled = false;
            }
            else if (command === 'on') {
                state.enabled = true;
                ctx.ui.setToolsExpanded(false);
            }
            else {
                const expanded = command === 'details' || (command === '' && !ctx.ui.getToolsExpanded());
                ctx.ui.setToolsExpanded(expanded);
            }
            current = ctx;
            working();
            redraw?.();
        },
    });
}
