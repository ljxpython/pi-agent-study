import { Container, truncateToWidth } from '@earendil-works/pi-tui';
import { groupLines, type Row } from './presentation.ts';
// Pi 0.85.1 presentation adapter. These are UI component fields, NEVER tool definitions.
type Node = any;
export interface ViewState {
    enabled: boolean;
    active: boolean;
}
const isTool = (n: Node) => typeof n?.toolCallId === 'string' && typeof n?.toolName === 'string' && typeof n?.markExecutionStarted === 'function' && typeof n?.updateResult === 'function';
const isAssistant = (n: Node) => typeof n?.setHideThinkingBlock === 'function' && typeof n?.updateContent === 'function';
const isUser = (n: Node) => n?.constructor?.name === 'UserMessageComponent' && typeof n?.text === 'string' && typeof n?.rebuild === 'function' && typeof n?.setOutputPad === 'function' && !isAssistant(n);
const SLOT = Symbol.for('pi.concise-activity.adapter');
const FROZEN = Symbol.for('pi.concise-activity.frozen-transcript');
export function installAdapter(tui: Node, state: ViewState): (freezeView?: boolean) => void {
    // Reload or duplicate loader: dispose previous owner before installing a new one.
    const prototype = Container.prototype as any;
    prototype[SLOT]?.();
    const restorers: (() => void)[] = [];
    const patched = new WeakSet<object>();
    const parents = new WeakSet<object>();
    const parentRefs: WeakRef<any>[] = [];
    const plans = new WeakMap<object, string[]>();
    const assistantViews = new WeakMap<object, Node>();
    let disposed = false;
    const replace = (object: Node, key: string, replacement: any) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        object[key] = replacement;
        const reference = new WeakRef(object);
        restorers.push(() => {
            const live = reference.deref();
            if (!live || live[key] !== replacement)
                return;
            if (descriptor)
                Object.defineProperty(live, key, descriptor);
            else
                delete live[key];
        });
    };
    function prepareParent(parent: Node) {
        if (parents.has(parent))
            return;
        parents.add(parent);
        parentRefs.push(new WeakRef(parent));
        parent[FROZEN]?.();
        const original = parent.render;
        replace(parent, 'render', function (this: Node, width: number) {
            if (state.enabled) {
                const groups: Node[][] = [[]];
                for (const child of this.children) {
                    if (isUser(child))
                        groups.push([]);
                    if (isTool(child))
                        groups.at(-1)!.push(child);
                }
                const last = groups.length - 1;
                groups.forEach((group, index) => {
                    const rows: Row[] = group.map(n => ({ id: n.toolCallId, name: n.toolName, args: n.args, result: n.result, partial: n.isPartial, started: n.executionStarted }));
                    const layout = groupLines(rows, state.active && index === last, width);
                    for (const n of group)
                        plans.set(n, layout.get(n.toolCallId) ?? []);
                });
            }
            return original.call(this, width);
        });
    }
    function attach(parent: Node, child: Node) {
        if (patched.has(child))
            return;
        if (isTool(child)) {
            prepareParent(parent);
            patched.add(child);
            const original = child.render;
            replace(child, 'render', function (this: Node, width: number) {
                if (!state.enabled || this.expanded)
                    return original.call(this, width);
                return plans.get(this) ?? original.call(this, width);
            });
        }
        else if (isAssistant(child)) {
            prepareParent(parent);
            patched.add(child);
            // Keep the native message/component untouched. Rebuild a separate view only
            // when content changes; render must not clear/recreate the native subtree.
            const view = new child.constructor(undefined, child.hideThinkingBlock,
                child.markdownTheme, child.hiddenThinkingLabel, child.outputPad,
                child.markdownTransformers);
            assistantViews.set(child, view);
            const updateView = (native: Node, message: Node, streaming: boolean) => {
                const projection = assistantViews.get(native);
                if (message && projection) {
                    projection.outputPad = native.outputPad;
                    projection.markdownTheme = native.markdownTheme;
                    projection.updateContent({ ...message, content: message.content.filter((c: Node) => c.type !== 'thinking') }, streaming);
                }
            };
            updateView(child, child.lastMessage, child.isStreaming);
            const originalUpdate = child.updateContent;
            replace(child, 'updateContent', function (this: Node, message: Node, streaming = this.isStreaming) {
                const result = originalUpdate.call(this, message, streaming);
                updateView(this, message, streaming);
                return result;
            });
            const originalRender = child.render;
            replace(child, 'render', function (this: Node, width: number) {
                return state.enabled ? assistantViews.get(this).render(width) : originalRender.call(this, width);
            });
        }
    }
    const originalAdd = prototype.addChild;
    const add = function (this: Node, child: Node) {
        attach(this, child);
        return originalAdd.call(this, child);
    };
    prototype.addChild = add;
    const seen = new WeakSet<object>();
    function visit(n: Node) {
        if (!n || typeof n !== 'object' || seen.has(n))
            return;
        seen.add(n);
        for (const child of n.children ?? []) {
            attach(n, child);
            visit(child);
        }
    }
    visit(tui);
    function dispose(freezeView = false) {
        if (disposed)
            return;
        // Pi draws the old transcript once after disposing widgets during /reload.
        // Keep a static sanitized frame until that same transcript is cleared/rebound.
        const snapshots = freezeView && state.enabled ? parentRefs.flatMap(ref => {
            const parent = ref.deref();
            return parent ? [{ parent, lines: parent.render(tui.terminal?.columns ?? 120) }] : [];
        }) : [];
        disposed = true;
        if (prototype.addChild === add)
            prototype.addChild = originalAdd;
        for (const restore of restorers.reverse())
            restore();
        if (prototype[SLOT] === dispose)
            delete prototype[SLOT];
        for (const { parent, lines } of snapshots) {
            const renderDescriptor = Object.getOwnPropertyDescriptor(parent, 'render');
            const clearDescriptor = Object.getOwnPropertyDescriptor(parent, 'clear');
            const clear = parent.clear;
            const frozenRender = (width: number) => lines.map((line: string) => truncateToWidth(line, width));
            const thaw = () => {
                if (parent.render === frozenRender) {
                    if (renderDescriptor)
                        Object.defineProperty(parent, 'render', renderDescriptor);
                    else
                        delete parent.render;
                }
                if (parent.clear === frozenClear) {
                    if (clearDescriptor)
                        Object.defineProperty(parent, 'clear', clearDescriptor);
                    else
                        delete parent.clear;
                }
                if (parent[FROZEN] === thaw)
                    delete parent[FROZEN];
            };
            const frozenClear = function (this: Node) { thaw(); return clear.call(this); };
            parent.render = frozenRender;
            parent.clear = frozenClear;
            parent[FROZEN] = thaw;
        }
    }
    prototype[SLOT] = dispose;
    return dispose;
}
