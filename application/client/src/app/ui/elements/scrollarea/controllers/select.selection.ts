import { Anchor } from './select.selection.anchor';
import { Focus } from './select.selection.focus';

export class CurrentSelection {
    public static create(holder: HTMLElement): CurrentSelection | undefined {
        const anchor = Anchor.create(holder);
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
}
