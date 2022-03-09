import {
	Component,
	OnDestroy,
	ChangeDetectorRef,
	ViewChild,
	Input,
	AfterViewInit,
	AfterViewChecked,
	ElementRef,
	ChangeDetectionStrategy,
	HostBinding,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IRow } from '@chipmunk/controller/session/dependencies/row/controller.row.api';
import { Holder } from './controllers/holder';
import { IAPI } from './controllers/api';
import { Frame, ChangesInitiator } from './controllers/frame';
import { Selecting, SelectionDirection } from './controllers/selection';
import { ChangesDetector } from '@chipmunk/controller/views/changes';
import { ServiceGlobalStyles, RemoveHandler } from '@chipmunk/service/service.styles';

export interface IScrollBoxSelection {
	selection: string;
	original: string;
	anchor: number;
	anchorOffset: number;
	focus: number;
	focusOffset: number;
}

@Component({
	selector: 'app-scrollarea',
	templateUrl: './template.html',
	styleUrls: ['./styles.less'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollAreaComponent
	extends ChangesDetector
	implements OnDestroy, AfterViewInit, AfterViewChecked
{
	@ViewChild('content_holder', { static: false }) _nodeHolder!: ElementRef<HTMLElement>;

	@Input() public api!: IAPI;

	private readonly _subscriptions: Map<string, Subscription> = new Map();
	private _cssClass: string = '';
	private _removeGlobalStyleHandler: RemoveHandler | undefined;

	@HostBinding('class') set cssClass(cssClass: string) {
		this._cssClass = cssClass;
	}
	get cssClass() {
		return this._cssClass;
	}

	public rows: IRow[] = [];
	public readonly holder: Holder = new Holder();
	public readonly frame: Frame = new Frame();
	public readonly selecting: Selecting = new Selecting();
	public selectionDirection = SelectionDirection;

	constructor(changeDetectorRef: ChangeDetectorRef) {
		super(changeDetectorRef);
	}

	public ngOnDestroy(): void {
		this.detauchChangesDetector();
		this.holder.destroy();
		this.frame.destroy();
		this.selecting.destroy();
		this._subscriptions.forEach((subscription: Subscription) => {
			subscription.unsubscribe();
		});
	}

	public ngAfterViewChecked(): void {}

	public ngAfterViewInit(): void {
		this.holder.bind(this._nodeHolder);
		this.frame.bind(this.api, this.holder);
		this.selecting.bind(this._nodeHolder.nativeElement, this.frame);
		this._subscriptions.set(
			'onFrameChange',
			this.frame.onFrameChange().subscribe((rows: IRow[]) => {
				this.rows = rows;
				this.detectChanges();
				this.selecting.restore();
			}),
		);
		this._subscriptions.set(
			'onSelectionStart',
			this.selecting.onSelectionStart().subscribe(() => {
				this.cssClass = 'selecting';
				this._removeGlobalStyleHandler = ServiceGlobalStyles.add(`:not(.selecting *) {
					user-select: none;
				}`);
			}),
		);
		this._subscriptions.set(
			'onSelectionFinish',
			this.selecting.onSelectionFinish().subscribe(() => {
				this.cssClass = '';
				if (typeof this._removeGlobalStyleHandler === 'function') {
					this._removeGlobalStyleHandler();
					this._removeGlobalStyleHandler = undefined;
				}
			}),
		);
	}

	public getFrameStart(): number {
		return this.frame.get().start;
	}

	public onScrolling(position: number) {
		this.frame.moveTo(position, ChangesInitiator.Scrolling);
	}

	public onWheel(event: WheelEvent) {
		if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
		} else {
			this.frame.offsetTo(event.deltaY, ChangesInitiator.Wheel);
			event.preventDefault();
		}
	}

	public showSelectionDetectors(): boolean {
		return this._removeGlobalStyleHandler !== undefined;
	}

	public onMouseMoveSelectionDetector(direction: SelectionDirection) {
		this.selecting.doSelectionInDirection(direction);
	}
}
