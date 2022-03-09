import { Frame, ChangesInitiator, PositionEvent } from './frame';
import { Subject, Observable } from 'rxjs';
import {
	ROW_INDEX_ATTR,
	NodeInfo,
	RestorableNodeInfo,
	getFocusNodeInfo,
	getAnchorNodeInfo,
} from './selection.nodeinfo';
import { SelectionNode } from './selection.node';

export enum SelectionDirection {
	Top = 'Top',
	Bottom = 'Bottom',
}

export class Selecting {
	private _frame!: Frame;
	private _holder!: HTMLElement;
	private _progress: boolean = false;
	private _selection: {
		focus: NodeInfo;
		anchor: NodeInfo;
	} = {
		focus: getFocusNodeInfo(),
		anchor: getAnchorNodeInfo(),
	};
	private _subjects: {
		start: Subject<void>;
		finish: Subject<void>;
	} = {
		start: new Subject(),
		finish: new Subject(),
	};

	bind(holder: HTMLElement, frame: Frame) {
		this._holder = holder;
		this._frame = frame;
		this._onSelectionStarted = this._onSelectionStarted.bind(this);
		this._onSelectionEnded = this._onSelectionEnded.bind(this);
		this._onSelectionChange = this._onSelectionChange.bind(this);
		this._onMouseDown = this._onMouseDown.bind(this);
		this._holder.addEventListener('selectstart', this._onSelectionStarted);
		document.addEventListener('selectionchange', this._onSelectionChange);
		window.addEventListener('mousedown', this._onMouseDown);
		window.addEventListener('mouseup', this._onSelectionEnded);
	}

	public destroy() {
		this._holder.removeEventListener('selectstart', this._onSelectionStarted);
		document.removeEventListener('selectionchange', this._onSelectionChange);
		window.removeEventListener('mouseup', this._onSelectionEnded);
		window.removeEventListener('mousedown', this._onMouseDown);
	}

	public isInProgress(): boolean {
		return this._progress;
	}

	public restore() {
		const getMaxOffset = (node: Node): number => {
			if (node.nodeType === Node.TEXT_NODE) {
				return node.textContent === null ? 0 : node.textContent.length - 1;
			} else if (node.childNodes.length > 0) {
				return node.childNodes.length;
			} else {
				return 0;
			}
		};
		const frame = this._frame.get();
		const focus: RestorableNodeInfo | undefined = this._selection.focus.get();
		const anchor: RestorableNodeInfo | undefined = this._selection.anchor.get();
		if (!focus || !anchor) {
			return;
		}
		if (focus.row < frame.start && anchor.row < frame.start) {
			return;
		}
		if (focus.row > frame.end && anchor.row > frame.end) {
			return;
		}
		let anchorOffset: number = -1;
		let focusOffset: number = -1;
		let anchorPath: string = '';
		let focusPath: string = '';
		if (focus.row === anchor.row) {
			anchorOffset = anchor.offset;
			focusOffset = focus.offset;
			anchorPath = anchor.path;
			focusPath = focus.path;
		} else if (focus.row > anchor.row) {
			// Direction: down
			anchorOffset = anchor.row < frame.start ? 0 : anchor.offset;
			focusOffset = focus.row > frame.end ? Infinity : focus.offset;
			anchorPath =
				anchor.row < frame.start ? `li[${ROW_INDEX_ATTR}="${frame.start}"]` : anchor.path;
			focusPath = focus.row > frame.end ? `li[${ROW_INDEX_ATTR}="${frame.end}"]` : focus.path;
		} else if (focus.row < anchor.row) {
			// Direction: up
			anchorOffset = anchor.row > frame.end ? Infinity : anchor.offset;
			focusOffset = focus.row < frame.start ? 0 : focus.offset;
			anchorPath =
				anchor.row > frame.end ? `li[${ROW_INDEX_ATTR}="${frame.end}"]` : anchor.path;
			focusPath =
				focus.row < frame.start ? `li[${ROW_INDEX_ATTR}="${frame.start}"]` : focus.path;
		}
		const selection: Selection | null = document.getSelection();
		if (selection === null) {
			return;
		}
		selection.removeAllRanges();
		const anchorNode: Node | null = SelectionNode.select(this._holder, anchorPath);
		const focusNode: Node | null = SelectionNode.select(this._holder, focusPath);
		if (anchorNode === null || focusNode === null) {
			return;
		}
		if (!isFinite(anchorOffset)) {
			anchorOffset = getMaxOffset(anchorNode);
		}
		if (!isFinite(focusOffset)) {
			focusOffset = getMaxOffset(focusNode);
		}
		try {
			console.log(`A (${anchorOffset}): ${anchorPath} / F (${focusOffset}): ${focusPath}`);
			if (focus.row >= anchor.row) {
				selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
			} else {
				selection.setBaseAndExtent(focusNode, focusOffset, anchorNode, anchorOffset);
			}
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

	public onSelectionStart(): Observable<void> {
		return this._subjects.start.asObservable();
	}

	public onSelectionFinish(): Observable<void> {
		return this._subjects.finish.asObservable();
	}

	public doSelectionInDirection(direction?: SelectionDirection) {
		if (!this._progress) {
			return;
		}
		if (direction !== undefined) {
			switch (direction) {
				case SelectionDirection.Top:
					this._frame.offsetToByRows(-1, ChangesInitiator.Selecting);
					this._selection.focus.setToRow(this._frame.get().start);
					break;
				case SelectionDirection.Bottom:
					this._frame.offsetToByRows(1, ChangesInitiator.Selecting);
					this._selection.focus.setToRow(this._frame.get().end);
					break;
			}
		} else {
			const selection: Selection | null = document.getSelection();
			if (selection === null) {
				return;
			}
			this._selection.focus.update(selection);
			this._selection.anchor.update(selection);
			if (this._selection.focus.row === this._frame.get().start) {
				this._frame.offsetToByRows(-1, ChangesInitiator.Selecting);
			} else if (this._selection.focus.row === this._frame.get().end) {
				this._frame.offsetToByRows(1, ChangesInitiator.Selecting);
			}
		}
		this._holder.focus();
	}

	private _drop() {
		this._selection = {
			focus: getFocusNodeInfo(),
			anchor: getAnchorNodeInfo(),
		};
		const selection: Selection | null = document.getSelection();
		selection && selection.removeAllRanges();
	}

	private _onSelectionStarted() {
		this._progress = true;
		this._drop();
		this._subjects.start.next();
		this._holder.focus();
	}

	private _onSelectionEnded() {
		this._progress = false;
		this._subjects.finish.next();
	}

	private _onSelectionChange() {
		this.doSelectionInDirection(undefined);
	}

	private _onMouseDown() {
		this._drop();
	}
}
