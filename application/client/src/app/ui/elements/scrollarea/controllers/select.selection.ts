import { Anchor } from './select.selection.anchor';
import { Focus } from './select.selection.focus';
import { Frame } from './frame';
import { SelectionNode } from './select.selection.node';

export class CurrentSelection {
    public static create(
        frame: Frame,
        holder: HTMLElement,
        event: MouseEvent,
    ): CurrentSelection | undefined {
        const anchor = Anchor.create(holder, event);
        if (anchor === undefined) {
            return undefined;
        }
        return new CurrentSelection(frame, holder, anchor);
    }
    protected focus: Focus | undefined;
    protected anchor: Anchor;
    protected holder: HTMLElement;
    protected finished: boolean = false;
    protected frame!: Frame;

    constructor(frame: Frame, holder: HTMLElement, anchor: Anchor) {
        this.frame = frame;
        this.holder = holder;
        this.anchor = anchor;
    }

    public destroy() {
        document.getSelection()?.removeAllRanges();
    }

    public move(): {
        view(event: MouseEvent, finish: boolean): void;
        focusTo(row: number): void;
    } {
        return {
            view: (event: MouseEvent, finish: boolean): void => {
                if (this.finished) {
                    return;
                }
                const focus = Focus.create(this.holder, event);
                if (focus !== undefined) {
                    this.focus = focus;
                    console.log(`>>>>>>>>>>>>>>>>>>>>>> FOCUS: ${focus.row}:${focus.offset}`);
                } else {
                    console.log(`>>>>>>>>>>>>>>>>>>>>>> FAIL TO GET FOCUS`);
                }
                if (finish) {
                    this.finished = true;
                }
                // console.log(`>>>>>>>>>>>>>>>>>> ${this.focus?.row}:${this.focus?.offset}`);
                this.render();
            },
            focusTo: (row: number): void => {
                if (this.finished || this.focus === undefined) {
                    return;
                }
                this.focus.setToRow(row);
                this.render();
            },
        };
    }

    public check() {
        if (this.anchor === undefined || this.focus === undefined) {
            console.log(`>>>>>>>>>>>>>>>>>>>> check: no anchor or focus`);
            return;
        }
        const selection = document.getSelection();
        if (selection === null) {
            console.log(`>>>>>>>>>>>>>>>>>>>> check: no selection`);
            return;
        }
        if (
            !this.anchor.isMatch(selection.anchorNode) &&
            !this.anchor.isMatch(selection.focusNode)
        ) {
            console.log(`>>>>>>>>>>>>>>>>>>>> check: correction because anchor`);
            this.render();
            return;
        }
        if (!this.focus.isMatch(selection.anchorNode) && !this.focus.isMatch(selection.focusNode)) {
            console.log(`>>>>>>>>>>>>>>>>>>>> check: correction because focus`);
            this.render();
            return;
        }
        console.log(`>>>>>>>>>>>>>>>>>>>> check: no changes`);
    }

    public render() {
        const getMaxOffset = (node: Node): number => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent === null ? 0 : node.textContent.length - 1;
            } else if (node.childNodes.length > 0) {
                return node.childNodes.length;
            } else {
                return 0;
            }
        };
        if (this.anchor === undefined || this.focus === undefined) {
            console.log(`>>>>>>>>>>>>>>>>>>>> no anchor or focus`);
            return;
        }
        const selection = document.getSelection();
        if (selection === null) {
            console.log(`>>>>>>>>>>>>>>>>>>>> no selection`);
            return;
        }
        const frame = this.frame.get();
        let anchorOffset: number = -1;
        let focusOffset: number = -1;
        let anchorPath: string = '';
        let focusPath: string = '';
        if (this.focus.row === this.anchor.row) {
            anchorOffset = this.anchor.offset;
            focusOffset = this.focus.offset;
            anchorPath = this.anchor.path;
            focusPath = this.focus.path;
        } else if (this.focus.row > this.anchor.row) {
            // Direction: down
            anchorOffset = this.anchor.row < frame.from ? 0 : this.anchor.offset;
            focusOffset = this.focus.row > frame.to ? Infinity : this.focus.offset;
            anchorPath =
                this.anchor.row < frame.from
                    ? SelectionNode.getSelector(frame.from)
                    : this.anchor.path;
            focusPath =
                this.focus.row > frame.to ? SelectionNode.getSelector(frame.to) : this.focus.path;
        } else if (this.focus.row < this.anchor.row) {
            // Direction: up
            anchorOffset = this.anchor.row > frame.to ? Infinity : this.anchor.offset;
            focusOffset = this.focus.row < frame.from ? 0 : this.focus.offset;
            anchorPath =
                this.anchor.row > frame.to ? SelectionNode.getSelector(frame.to) : this.anchor.path;
            focusPath =
                this.focus.row < frame.from
                    ? SelectionNode.getSelector(frame.from)
                    : this.focus.path;
            // reverse = this.anchor.row > frame.to;
        }
        const anchorNode = SelectionNode.select(this.holder, anchorPath);
        const focusNode = SelectionNode.select(this.holder, focusPath);
        if (anchorNode === null || focusNode === null) {
            console.log(
                `>>>>>>>>>>>>>>>>>>>>>>>> FAIL TO GET NODES: ${focusNode === null ? 'focus' : ''} ${
                    anchorNode === null ? 'anchor' : ''
                }`,
            );
            return;
        }
        selection.removeAllRanges();
        if (
            !isFinite(anchorOffset) ||
            (typeof anchorNode.textContent === 'string' &&
                anchorNode.textContent.length <= anchorOffset)
        ) {
            anchorOffset = getMaxOffset(anchorNode);
        }
        if (
            !isFinite(focusOffset) ||
            (typeof focusNode.textContent === 'string' &&
                focusNode.textContent.length <= focusOffset)
        ) {
            focusOffset = getMaxOffset(focusNode);
        }
        try {
            // console.log(`>>>>>>>>>>>>>>>>>>>>>> render: f::${focusPath} - a::${anchorPath}`);
            // if (this.anchor.row <= this.focus.row) {
            //     console.log(`>>>>>>>>>>>>>>>>>>> reversed`);
            //     selection.setBaseAndExtent(focusNode, focusOffset, anchorNode, anchorOffset);
            // } else {
            //     selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
            // }
            selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
        } catch (e) {
            let details: string = 'Error with restoring selection:';
            details += `\n\t-\tanchorPath: ${anchorPath}`;
            details += `\n\t-\tfocusNode: ${focusPath}`;
            if (typeof anchorNode.textContent === 'string') {
                details += `\n\t-\t${
                    anchorNode.textContent.length <= anchorOffset ? '[WRONG]' : ''
                }anchor (${anchorNode.nodeName}): "${anchorNode.textContent}" (${
                    anchorNode.textContent.length
                }): ${anchorOffset}`;
            }
            if (typeof focusNode.textContent === 'string') {
                details += `\n\t-\t${
                    focusNode.textContent.length <= focusOffset ? '[WRONG]' : ''
                }focus (${focusNode.nodeName}): "${focusNode.textContent}" (${
                    focusNode.textContent.length
                }): ${focusOffset}`;
            }
            details += `\n\t-\terror: ${e instanceof Error ? e.message : e}`;
            console.warn(details);
        }
    }
}
