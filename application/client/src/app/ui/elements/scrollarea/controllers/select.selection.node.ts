export const ROW_INDEX_ATTR: string = 'data-row-index';
export const ROOT_ROW_NODE: string = 'li';

export interface IRowNodeInfo {
    path: string;
    row: number;
}

export class SelectionNode {
    public static getRowInfo(node: Node | null, path: string = ''): IRowNodeInfo | undefined {
        if (node === null) {
            return undefined;
        }
        if (node.parentNode === undefined || node.parentNode === null) {
            return undefined;
        }
        if (node.nodeName.toLowerCase() === 'body') {
            return undefined;
        }
        const rowIndex: number | undefined = SelectionNode.getRowAttrValue(node);
        if (rowIndex !== undefined) {
            return {
                row: rowIndex,
                path: `${node.nodeName.toLowerCase()}[${ROW_INDEX_ATTR}="${rowIndex}"]${
                    path !== '' ? ' ' : ''
                }${path}`,
            };
        } else if (node.nodeType === Node.TEXT_NODE) {
            const textNodeIndex: number = SelectionNode.getTextNodeIndex(node);
            return textNodeIndex === -1
                ? undefined
                : SelectionNode.getRowInfo(
                      node.parentNode as HTMLElement,
                      `#text:${textNodeIndex}`,
                  );
        } else if (node.parentNode.children.length !== 0 && rowIndex === undefined) {
            const childIndex: number = SelectionNode.getChildIndex(node);
            return childIndex === -1
                ? undefined
                : SelectionNode.getRowInfo(
                      node.parentNode,
                      `${node.nodeName.toLowerCase()}:nth-child(${childIndex + 1})${
                          path !== '' ? ' ' : ''
                      }${path}`,
                  );
        } else {
            return SelectionNode.getRowInfo(
                node.parentNode as HTMLElement,
                `${node.nodeName.toLowerCase()}${path !== '' ? ' ' : ''}${path}`,
            );
        }
    }

    public static getRowAttrValue(node: Node): number | undefined {
        if (typeof (node as HTMLElement).getAttribute !== 'function') {
            return undefined;
        }
        const attr: string | null = (node as HTMLElement).getAttribute(ROW_INDEX_ATTR);
        if (attr === null || attr.trim().length === 0) {
            return undefined;
        }
        const row = parseInt(attr, 10);
        if (isNaN(row) || !isFinite(row)) {
            return undefined;
        }
        return row;
    }

    public static getTextNodeIndex(node: Node): number {
        if (node.parentNode === null) {
            return -1;
        }
        let index: number = -1;
        try {
            Array.prototype.forEach.call(node.parentNode.childNodes, (child: Node, i: number) => {
                if (node === child) {
                    index = i;
                    throw `found`;
                }
            });
        } catch (_) {
            // Exit from forEach;
        }
        return index;
    }

    public static getChildIndex(node: Node): number {
        if (node.parentNode === null) {
            return -1;
        }
        let index: number = -1;
        try {
            Array.prototype.forEach.call(node.parentNode.children, (child: Node, i: number) => {
                if (node === child) {
                    index = i;
                    throw `found`;
                }
            });
        } catch (_) {
            // Exit from forEach;
        }
        return index;
    }

    protected readonly holder: HTMLElement;
    public readonly row: number;
    public readonly path: string;
    public readonly offset: number;

    constructor(holder: HTMLElement, row: number, path: string, offset: number) {
        this.holder = holder;
        this.row = row;
        this.path = path;
        this.offset = offset;
    }
}
