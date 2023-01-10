import { SelectionNode } from './select.selection.node';
import { isParent } from '@ui/env/dom';

export class Anchor extends SelectionNode {
    public static create(holder: HTMLElement, event: MouseEvent): Anchor | undefined {
        const range = document.caretRangeFromPoint(event.x, event.y);
        if (range === null) {
            return undefined;
        }
        if (!range.collapsed) {
            range.collapse();
        }
        const node = range.startContainer;
        if (node === null) {
            return undefined;
        }
        if (!isParent(node as HTMLElement, holder)) {
            return undefined;
        }
        const info = SelectionNode.getRowInfo(node);
        if (info === undefined) {
            return undefined;
        }
        return new Anchor(holder, info.row, info.path, range.startOffset);
    }
}
