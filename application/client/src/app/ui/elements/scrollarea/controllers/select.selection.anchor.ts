import { SelectionNode } from './select.selection.node';
import { isParent } from '@ui/env/dom';

export class Anchor extends SelectionNode {
    public static create(holder: HTMLElement): Anchor | undefined {
        const selection = document.getSelection();
        if (selection === null) {
            return undefined;
        }
        const node = selection.anchorNode;
        if (node === null) {
            return undefined;
        }
        if (!isParent(node as HTMLElement, holder)) {
            return undefined;
        }
        const info = SelectionNode.getRowInfo(selection.anchorNode);
        if (info === undefined) {
            return undefined;
        }
        return new Anchor(holder, info.row, info.path, selection.anchorOffset);
    }
}
