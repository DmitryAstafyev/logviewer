import { Anchor } from './select.selection.anchor';
import { Focus } from './select.selection.focus';
import { SelectionNode } from './select.selection.node';

export class CurrentSelection {
    public static create(holder: HTMLElement, event: MouseEvent): CurrentSelection | undefined {
        const anchor = Anchor.create(holder, event);
        if (anchor === undefined) {
            return undefined;
        }
        return new CurrentSelection(holder, anchor);
    }
    protected focus: Focus | undefined;
    protected anchor: Anchor;
    protected holder: HTMLElement;

    constructor(holder: HTMLElement, anchor: Anchor) {
        this.holder = holder;
        this.anchor = anchor;
    }

    public destroy() {
        document.getSelection()?.removeAllRanges();
    }

    public move(event: MouseEvent) {
        this.focus = Focus.create(this.holder, event);
        console.log(`>>>>>>>>>>>>>>>>>> ${this.focus?.row}:${this.focus?.offset}`);
        this.render();
    }

    public render() {
        const selection = document.getSelection();
        if (selection === null) {
            return;
        }
        selection.removeAllRanges();
        if (this.anchor === undefined || this.focus === undefined) {
            return;
        }
        const anchorNode = this.anchor.getNode();
        const focusNode = this.focus.getNode();
        if (anchorNode === null || focusNode === null) {
            return;
        }
        try {
            selection.setBaseAndExtent(
                anchorNode,
                this.anchor.offset,
                focusNode,
                this.focus.offset,
            );
        } catch (e) {
            let details: string = 'Error with restoring selection:';
            details += `\n\t-\tanchorPath: ${this.anchor.path}`;
            details += `\n\t-\tfocusNode: ${this.focus.path}`;
            if (typeof anchorNode.textContent === 'string') {
                details += `\n\t-\t${
                    anchorNode.textContent.length <= this.anchor.offset ? '[WRONG]' : ''
                }anchor (${anchorNode.nodeName}): "${anchorNode.textContent}" (${
                    anchorNode.textContent.length
                }): ${this.anchor.offset}`;
            }
            if (typeof focusNode.textContent === 'string') {
                details += `\n\t-\t${
                    focusNode.textContent.length <= this.focus.offset ? '[WRONG]' : ''
                }focus (${focusNode.nodeName}): "${focusNode.textContent}" (${
                    focusNode.textContent.length
                }): ${this.focus.offset}`;
            }
            details += `\n\t-\terror: ${e instanceof Error ? e.message : e}`;
            console.warn(details);
        }
    }
}
