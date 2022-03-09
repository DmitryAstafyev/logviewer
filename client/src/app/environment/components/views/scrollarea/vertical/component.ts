import {
	Component,
	Input,
	OnDestroy,
	AfterContentInit,
	HostListener,
	Output,
	EventEmitter,
	ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IAPI, IStorageInformation, IRange } from '../controllers/api';
import { Holder } from '../controllers/holder';
import { ChangesInitiator, Frame, PositionEvent } from '../controllers/frame';
import { LockToken } from '@chipmunk/controller/views/lock.token';
import { Selecting } from '../controllers/selection';

const MAX_SCROLL_THUMB_HEIGHT: number = 20;

@Component({
	selector: 'app-scrollarea-vertical',
	templateUrl: './template.html',
	styleUrls: ['./styles.less'],
})
export class ScrollAreaVerticalComponent implements AfterContentInit, OnDestroy {
	@Input() public api!: IAPI;
	@Input() public holder!: Holder;
	@Input() public frame!: Frame;

	@Output() public scrolling = new EventEmitter<number>();

	private _subscriptions: Map<string, Subscription> = new Map();
	private _height: number = 0;
	private _fillerHeight: number = 0;
	private _count: number = 0;
	private _rowsInView: number = 0;
	private _scrollEventLockToken: LockToken = new LockToken(-1);

	@HostListener('scroll', ['$event', '$event.target']) onScroll(
		event: MouseEvent,
		target: HTMLElement,
	) {
		if (this._scrollEventLockToken.isLocked()) {
			return;
		}
		if (this._fillerHeight === 0) {
			return;
		}
		this.scrolling.next(
			Math.round(
				(this._count - this._rowsInView) *
					(target.scrollTop / (target.scrollHeight - this._height)),
			),
		);
	}

	@HostListener('mousedown', ['$event']) onMouseDown(event: MouseEvent) {
		this._scrollEventLockToken.unlock();
	}

	@HostListener('window:mouseup', ['$event']) onWindowMouseUp(event: MouseEvent) {
		this._scrollEventLockToken.lock();
	}

	@HostListener('wheel', ['$event']) onWheel(event: MouseEvent) {
		event.preventDefault();
		return false;
	}

	constructor(private elRef: ElementRef<HTMLElement>) {}

	public ngOnDestroy() {
		this._subscriptions.forEach((subscription: Subscription) => {
			subscription.unsubscribe();
		});
	}

	public ngAfterContentInit() {
		this._scrollEventLockToken.lock();
		this._subscriptions.set(
			'onStorageUpdated',
			this.api.onStorageUpdated.subscribe((storage: IStorageInformation) => {
				this._count = storage.count;
				this._calculate();
			}),
		);
		this._subscriptions.set(
			'onHeightChange',
			this.holder.onHeightChange().subscribe((height: number) => {
				this._height = height;
				this._calculate();
			}),
		);
		this._subscriptions.set(
			'onPositionChange',
			this.frame.onPositionChange().subscribe((event: PositionEvent) => {
				if (
					event.initiator === ChangesInitiator.Scrolling ||
					event.initiator === ChangesInitiator.RowsDelivered
				) {
					return;
				}
				const position = event.range.start / this._count;
				this.elRef.nativeElement.scrollTop =
					this.elRef.nativeElement.scrollHeight * position;
			}),
		);
	}

	public getFillerStyles(): { height: string } {
		return {
			height: `${this._fillerHeight}px`,
		};
	}

	private _calculate() {
		const fillerHeight: number = this._count * this.api.getItemHeight();
		this._rowsInView = Math.floor(this._height / this.api.getItemHeight());
		if (fillerHeight === 0 || this._height === 0 || this._height > fillerHeight) {
			this._fillerHeight = 0;
		} else {
			const rate: number = this._height / fillerHeight;
			const thumb: number = this._height * rate;
			if (thumb < MAX_SCROLL_THUMB_HEIGHT) {
				this._fillerHeight = this._height / (MAX_SCROLL_THUMB_HEIGHT / this._height);
			} else {
				this._fillerHeight = fillerHeight;
			}
		}
	}
}
