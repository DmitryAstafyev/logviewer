import { Subject, Observable } from 'rxjs';
import { IRow } from '@chipmunk/controller/session/dependencies/row/controller.row.api';
import { ChangesInitiator } from './frame';

export interface IRange {
	start: number;
	end: number;
}

export interface IStorageInformation {
	count: number;
}

export interface IRowsPacket {
	range: IRange;
	rows: IRow[];
}

export interface IAPI {
	setFrame: (range: IRange) => void;
	getLastFrame: () => IRange;
	getStorageInfo: () => IStorageInformation;
	getComponentFactory: () => any;
	getItemHeight: () => number;
	updatingDone: (range: IRange) => void;
	cleanUpClipboard?: (str: string) => string;
	onStorageUpdated: Observable<IStorageInformation>;
	onScrollTo: Subject<number>;
	onScrollUntil: Subject<number>;
	onRows: Observable<IRowsPacket>;
	onSourceUpdated: Subject<void>;
	onRerequest: Subject<void>;
	onRedraw: Subject<void>;
}

export class Range {
	private _start: number = 0;
	private _end: number = 0;
	private _length: number = 0;
	private _total: number = 0;
	private readonly _subjects: {
		change: Subject<ChangesInitiator>;
	} = {
		change: new Subject<ChangesInitiator>(),
	};
	constructor(range?: IRange) {
		if (range !== undefined) {
			this._start = range.start;
			this._end = range.end;
		}
	}

	public setLength(len: number, initiator: ChangesInitiator) {
		const prev = this._hash();
		this._length = len;
		const end = this._start + len;
		this._end = end <= this._total ? end : this._total;
		const curr = this._hash();
		if (prev !== curr) {
			this._subjects.change.next(initiator);
		}
	}

	public setTotal(total: number, initiator: ChangesInitiator) {
		this._total = total;
		this.setLength(this._length, initiator);
	}

	public moveTo(start: number, initiator: ChangesInitiator) {
		const prev = this._hash();
		this._start = start;
		const end = this._start + this._length;
		this._end = end <= this._total ? end : this._total;
		const curr = this._hash();
		if (prev !== curr) {
			this._subjects.change.next(initiator);
		}
	}

	public offsetTo(offset: number, initiator: ChangesInitiator) {
		const prev = this._hash();
		if (offset < 0) {
			this._start = this._start + offset > 0 ? this._start + offset : 0;
			const end = this._start + this._length;
			this._end = end <= this._total ? end : this._total;
		} else {
			const end = this._start + offset + this._length;
			this._end = end <= this._total ? end : this._total;
			this._start = this._end - this._length;
		}
		const curr = this._hash();
		if (prev !== curr) {
			this._subjects.change.next(initiator);
		}
	}

	public get(): IRange {
		return { start: this._start, end: this._end };
	}

	public equal(range: IRange): boolean {
		return this._start === range.start && this._end === range.end;
	}

	private _hash(): string {
		return `${this._start}:${this._end}`;
	}

	public onChange(): Observable<ChangesInitiator> {
		return this._subjects.change.asObservable();
	}
}
