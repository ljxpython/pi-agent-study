import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Container, visibleWidth } from '@earendil-works/pi-tui';
import { initTheme } from '@earendil-works/pi-coding-agent';
import { installAdapter } from '../src/adapter.ts';
import { groupLines, action, plain } from '../src/presentation.ts';
initTheme('dark', false);
const base = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
const { AssistantMessageComponent: Assistant } = await import(join(base, 'modes/interactive/components/assistant-message.js'));
const { UserMessageComponent: User } = await import(join(base, 'modes/interactive/components/user-message.js'));
const { ToolExecutionComponent: Tool } = await import(join(base, 'modes/interactive/components/tool-execution.js'));
const strip = (s: string) => s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
const result = { content: [{ type: 'text', text: 'RAW_TOOL_OUTPUT_KEEP_IN_SESSION' }] };
function message() { return { role: 'assistant', content: [{ type: 'thinking', thinking: 'THINKING_SENTINEL' }, { type: 'text', text: '正式回复' }], stopReason: 'stop' }; }
function harness() {
    const root = new Container(), chat = new Container();
    root.addChild(chat);
    const state = { enabled: true, active: false };
    const restore = installAdapter(root, state);
    const tool = (id: string, error = false) => { const node = new Tool('bash', id, { command: 'pwd && echo RAW_COMMAND' }, {}, undefined, { requestRender() { } }, '/tmp'); chat.addChild(node); node.markExecutionStarted(); node.updateResult({ ...result, isError: error }, false); return node; };
    return { root, chat, state, restore, tool };
}
test('real native assistant hides reasoning without mutating messages; final text and errors remain', () => {
    const h = harness();
    try {
        const m = message();
        const a = new Assistant(m);
        h.chat.addChild(a);
        const before = JSON.stringify(m);
        assert.ok(h.root.render(100).join('\n').includes('正式回复'));
        assert.ok(!h.root.render(100).join('\n').includes('THINKING_SENTINEL'));
        assert.equal(JSON.stringify(m), before);
        assert.equal(a.lastMessage, m);
        h.state.enabled = false;
        assert.ok(h.root.render(100).join('\n').includes('THINKING_SENTINEL'));
        h.state.enabled = true;
        m.stopReason = 'error';
        (m as any).errorMessage = 'NETWORK_FAILURE';
        a.updateContent(m);
        assert.ok(h.root.render(100).join('\n').includes('NETWORK_FAILURE'));
    }
    finally {
        h.restore();
    }
});
test('real builtin and third party rows collapse; raw output reappears in details; restore is exact', () => {
    const h = harness();
    try {
        h.chat.addChild(new User('用户目标'));
        for (let i = 0; i < 6; i++)
            h.tool(String(i));
        let text = h.root.render(100).join('\n');
        assert.ok(text.includes('已完成 6 步'));
        assert.ok(!text.includes('RAW_TOOL_OUTPUT'));
        assert.ok(text.includes('用户目标'));
        for (const n of h.chat.children as any[])
            n.setExpanded?.(true);
        assert.ok(h.root.render(100).join('\n').includes('RAW_TOOL_OUTPUT'));
        for (const n of h.chat.children as any[])
            n.setExpanded?.(false);
        h.restore();
        assert.ok(h.root.render(100).join('\n').includes('RAW_TOOL_OUTPUT'));
    }
    finally {
        h.restore();
    }
});
test('running latest three; failure stays visible; no cross-user merging; Ctrl+O native expansion', () => {
    const h = harness();
    try {
        h.chat.addChild(new User('第一轮'));
        h.tool('old');
        h.chat.addChild(new User('第二轮'));
        for (let i = 0; i < 6; i++)
            h.tool('new' + i, i === 0);
        h.state.active = true;
        const lines = h.root.render(80).map(strip);
        assert.ok(lines.join('\n').includes('已完成 1 步'));
        assert.equal(lines.filter(s => s.includes('●')).length, 4);
        assert.ok(lines.join('\n').includes('失败'));
        const node = h.tool('expanded');
        node.setExpanded(true);
        assert.ok(h.root.render(80).join('\n').includes('RAW_TOOL_OUTPUT'));
    }
    finally {
        h.restore();
    }
});
test('reload is idempotent, existing nodes are adopted, disposing old owner cannot remove new owner', () => {
    const root = new Container(), chat = new Container();
    root.addChild(chat);
    const a = new Assistant(message());
    chat.addChild(a);
    const original = Container.prototype.addChild;
    const one = installAdapter(root, { enabled: true, active: false });
    const two = installAdapter(root, { enabled: true, active: false });
    one();
    assert.ok(!root.render(80).join('\n').includes('THINKING_SENTINEL'));
    two();
    assert.equal(Container.prototype.addChild, original);
    assert.ok(root.render(80).join('\n').includes('THINKING_SENTINEL'));
});
test('unknown tools sanitized, no raw shell arguments, narrow Unicode rows never exceed width', () => {
    assert.equal(action('bash', { command: 'pwd && cat SECRET' }), '定位项目 · pwd');
    assert.equal(action('bash', { command: 'npm test -- --verbose' }), '运行测试');
    assert.ok(!action('bash', { command: 'curl SECRET' }).includes('SECRET'));
    assert.ok(!plain('\x1b[31mbad\n\x00').includes('\x1b'));
    for (const width of [12, 40, 60, 80, 120]) {
        const rows = [{ id: 'x', name: '自定义工具'.repeat(30), args: {}, result: { content: [{ type: 'text', text: '失败'.repeat(80) }], isError: true }, partial: false, started: true }];
        for (const value of groupLines(rows, false, width).values())
            for (const line of value)
                assert.ok(visibleWidth(line) <= width);
    }
});
test('unfinished tools are never reported successful', () => {
    const rows = [{ id: 'x', name: 'bash', args: {}, partial: true, started: true }];
    assert.ok(groupLines(rows, false, 100).get('x')!.join('').includes('1 项未完成'));
});
test('active execution is visible even with many queued calls', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: 'bash', args: { command: 'pwd' }, partial: true, started: i === 0 }));
    const text = [...groupLines(rows, true, 100).values()].flat().join('\n');
    assert.ok(text.includes('正在定位项目'));
    assert.equal((text.match(/●/g) || []).length, 1);
});
test('cancellation remains distinct from success and generic failures', () => {
    const rows = [{ id: 'x', name: 'bash', args: {}, partial: false, started: true, result: { isError: true, content: [{ type: 'text', text: 'Request was aborted' }] } }];
    const text = groupLines(rows, false, 100).get('x')!.join('');
    assert.ok(text.includes('1 项已取消'));
    assert.ok(text.includes('已完成 0 步'));
});
test('non-TUI lifecycle never installs adapter or writes UI', async () => {
    const { default: extension } = await import('../src/extension.ts');
    const events = new Map<string, Function>();
    const commands = new Map<string, any>();
    let transformer: any;
    extension({ on: (name: string, handler: Function) => events.set(name, handler), registerCommand: (name: string, command: any) => commands.set(name, command), registerMarkdownTransformer: (fn: any) => { transformer = fn; } } as any);
    const original = Container.prototype.addChild;
    const ctx = { mode: 'json', ui: new Proxy({}, { get() { throw new Error('non-TUI access'); } }) };
    await events.get('session_start')!({}, ctx);
    await events.get('agent_start')!({}, ctx);
    await events.get('message_start')!({ message: { role: 'assistant' } }, ctx);
    await events.get('tool_execution_start')!({}, ctx);
    await events.get('agent_end')!({}, ctx);
    await events.get('agent_settled')!({}, ctx);
    await commands.get('activity').handler('off', ctx);
    await events.get('session_shutdown')!({}, ctx);
    assert.equal(Container.prototype.addChild, original);
    assert.equal(transformer('reasoning', { messageType: 'assistant-thinking' }), '');
    assert.equal(transformer('正式回复', { messageType: 'assistant' }), '正式回复');
});
test('widget disposal freezes sanitized old frame until transcript clear, then restores native behavior', () => {
    const h = harness();
    h.chat.addChild(new User('目标'));
    h.tool('one');
    h.chat.addChild(new Assistant(message()));
    h.root.render(100);
    h.restore(true);
    assert.ok(!h.root.render(100).join('\n').includes('RAW_TOOL_OUTPUT'));
    assert.ok(!h.root.render(100).join('\n').includes('THINKING_SENTINEL'));
    h.chat.clear();
    h.chat.addChild(new Assistant(message()));
    assert.ok(h.root.render(100).join('\n').includes('THINKING_SENTINEL'));
});
test('lifecycle widget can remount after disposal using /activity on', async () => {
    const { default: extension } = await import('../src/extension.ts');
    const events = new Map<string, Function>();
    const commands = new Map<string, any>();
    const root = new Container(), chat = new Container();
    root.addChild(chat);
    let widget: any;
    let expanded = false;
    const ctx: any = { mode: 'tui', ui: { setWidget(_key: string, factory: Function) { widget?.dispose(); widget = factory(root); }, setToolsExpanded(value: boolean) { expanded = value; }, getToolsExpanded() { return expanded; }, setWorkingIndicator() { }, setWorkingMessage() { }, setWorkingVisible() { } } };
    (root as any).requestRender = () => { };
    extension({ on: (name: string, handler: Function) => events.set(name, handler), registerCommand: (name: string, command: any) => commands.set(name, command), registerMarkdownTransformer() { } } as any);
    const original = Container.prototype.addChild;
    await events.get('session_start')!({}, ctx);
    widget.dispose();
    assert.equal(Container.prototype.addChild, original);
    await commands.get('activity').handler('on', ctx);
    assert.notEqual(Container.prototype.addChild, original);
    chat.addChild(new Assistant(message()));
    assert.ok(!root.render(80).join('\n').includes('THINKING_SENTINEL'));
    widget.dispose();
    await commands.get('activity').handler('off', ctx);
    assert.ok(root.render(80).join('\n').includes('THINKING_SENTINEL'));
    await events.get('session_shutdown')!({}, ctx);
    assert.equal(Container.prototype.addChild, original);
});
test('unrelated user-like extension widget is not patched or frozen', () => {
    const h = harness();
    const other = new Container();
    const widget: any = new Container();
    widget.text = 'not a user';
    widget.rebuild = () => { };
    widget.setOutputPad = () => { };
    other.addChild(widget);
    h.root.addChild(other);
    const render = other.render;
    h.root.render(80);
    h.restore(true);
    assert.equal(other.render, render);
    h.chat.clear();
});

test('render is observational: native reply subtree remains stable across frames and streaming updates', () => {
    const h = harness();
    try {
        const m = message();
        const a = new Assistant(m);
        h.chat.addChild(a);
        const nodes = [...a.contentContainer.children];
        for (let i = 0; i < 5; i++) {
            assert.ok(h.root.render(100).join('\n').includes('正式回复'));
            nodes.forEach((node, index) => assert.equal(a.contentContainer.children[index], node));
        }
        m.content.push({type: 'text', text: '后续正文自动显示'} as any);
        a.updateContent(m, true);
        const updated = [...a.contentContainer.children];
        assert.ok(h.root.render(100).join('\n').includes('后续正文自动显示'));
        updated.forEach((node, index) => assert.equal(a.contentContainer.children[index], node));
        assert.equal(a.lastMessage, m);
        h.state.enabled = false;
        assert.ok(h.root.render(100).join('\n').includes('THINKING_SENTINEL'));
    } finally { h.restore(); }
});

test('tool-to-model wait remains visible and status follows actual stream events', async () => {
    const {default: extension} = await import('../src/extension.ts');
    const events = new Map<string, Function>();
    const frames: boolean[] = [];
    const root: any = new Container(); root.requestRender = (force = false) => frames.push(force);
    let visible = false, label = ''; let widget: any;
    const ctx: any = {mode:'tui', ui:{
        setWidget(_key: string, factory: Function) { widget = factory(root); },
        setToolsExpanded() {}, setWorkingIndicator() {},
        setWorkingVisible(v: boolean) { visible=v; },
        setWorkingMessage(v: string) { label=v; },
    }};
    extension({on:(name:string,handler:Function)=>events.set(name,handler), registerCommand(){}, registerMarkdownTransformer(){}} as any);
    try {
        await events.get('session_start')!({},ctx);
        await events.get('agent_start')!({},ctx);
        assert.equal(label,'等待模型响应…');
        await events.get('tool_execution_start')!({},ctx);
        assert.equal(visible,false);
        await events.get('turn_start')!({},ctx);
        assert.equal(visible,true);
        assert.equal(label,'等待模型响应…');
        await events.get('message_update')!({assistantMessageEvent:{type:'thinking_delta'}},ctx);
        assert.equal(label,'正在思考…');
        await events.get('message_update')!({assistantMessageEvent:{type:'text_delta'}},ctx);
        assert.equal(label,'正在生成回复…');
        await events.get('agent_end')!({},ctx);
        frames.length = 0;
        await events.get('agent_settled')!({},ctx);
        assert.deepEqual(frames,[true], 'settled reply commits a final frame without keyboard input');
    } finally {await events.get('session_shutdown')!({},ctx);}
});
