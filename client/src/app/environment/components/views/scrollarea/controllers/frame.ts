import { Subscription, Subject, Observable } from 'rxjs';
import { IAPI, IStorageInformation, Range, IRange, IRowsPacket } from './api';
import { Holder } from './holder';
import { IRow } from '@chipmunk/controller/session/dependencies/row/controller.row.api';

export enum ChangesInitiator {
	Wheel = 0,
	StorageUpdated = 1,
	HolderHeight = 2,
	Scrolling = 3,
	RowsDelivered = 4,
	Selecting = 5,
}

export interface PositionEvent {
	range: IRange;
	initiator: ChangesInitiator;
}

export class Frame {
	private _api!: IAPI;
	private _holder!: Holder;
	private _subscriptions: Map<string, Subscription> = new Map();
	private _frame: Range = new Range();
	private _rows: IRow[] = [];
	private readonly _subjects: {
		change: Subject<IRow[]>;
		position: Subject<PositionEvent>;
	} = {
		change: new Subject<IRow[]>(),
		position: new Subject<PositionEvent>(),
	};

	public bind(api: IAPI, holder: Holder) {
		this._api = api;
		this._holder = holder;
		this._subscriptions.set(
			'onFrameChange',
			this._frame.onChange().subscribe((initiator: ChangesInitiator) => {
				this._subjects.position.next({ range: this._frame.get(), initiator });
				this._api.setFrame(this._frame.get());
			}),
		);
		this._subscriptions.set(
			'onHeightChange',
			this._holder.onHeightChange().subscribe((height: number) => {
				this._frame.setLength(
					Math.floor(height / this._api.getItemHeight()),
					ChangesInitiator.HolderHeight,
				);
				this._api.setFrame(this._frame.get());
			}),
		);
		this._subscriptions.set(
			'onRowsDelivered',
			this._api.onRows.subscribe((packet: IRowsPacket) => {
				if (!this._frame.equal(packet.range)) {
					return;
				}
				this._rows = packet.rows;
				this._subjects.change.next(this._rows);
			}),
		);
		this._subscriptions.set(
			'onStorageUpdated',
			this._api.onStorageUpdated.subscribe((storage: IStorageInformation) => {
				this._frame.setTotal(storage.count, ChangesInitiator.StorageUpdated);
			}),
		);
	}

	public destroy(): void {
		this._subscriptions.forEach((subscription: Subscription) => {
			subscription.unsubscribe();
		});
	}

	public get(): IRange {
		return this._frame.get();
	}

	public moveTo(start: number, initiator: ChangesInitiator) {
		this._frame.moveTo(start, initiator);
	}

	public offsetTo(offsetPx: number, initiator: ChangesInitiator) {
		this._frame.offsetTo(Math.round(offsetPx / this._api.getItemHeight()), initiator);
	}

	public offsetToByRows(offsetRow: number, initiator: ChangesInitiator) {
		this._frame.offsetTo(offsetRow, initiator);
	}

	public onFrameChange(): Observable<IRow[]> {
		return this._subjects.change.asObservable();
	}

	public onPositionChange(): Observable<PositionEvent> {
		return this._subjects.position.asObservable();
	}
}
