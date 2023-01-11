import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    Input,
    AfterViewInit,
    ElementRef,
    ChangeDetectionStrategy,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Subscriber } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { Holder } from './controllers/holder';
import { Service } from './controllers/service';
import { Frame, ChangesInitiator } from './controllers/frame';
import { Selecting } from './controllers/selection';
import { Keyboard } from './controllers/keyboard';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { RemoveHandler } from '@ui/service/styles';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { stop } from '@ui/env/dom';
import { unique } from '@platform/env/sequence';
import { SelectionTracker } from './controllers/select';

export enum SelectionDirection {
    Top = 'Top',
    Bottom = 'Bottom',
}

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
@Ilc()
export class ScrollAreaComponent extends ChangesDetector implements OnDestroy, AfterViewInit {
    @ViewChild('content_holder', { static: false }) _nodeHolder!: ElementRef<HTMLElement>;

    @Input() public service!: Service;
    @Input() public tabIndex!: number;

    private readonly _subscriber: Subscriber = new Subscriber();
    private _id: string = unique();
    private _removeGlobalStyleHandler: RemoveHandler | undefined;

    @HostBinding('tabindex') get tabndex() {
        return this.tabIndex === undefined ? 0 : this.tabIndex;
    }

    @HostBinding('id') set id(id: string) {
        this._id = id;
    }

    get id() {
        return this._id;
    }

    @HostListener('window:keydown', ['$event']) onKeyDown(event: KeyboardEvent) {
        this.keyboard.process(event);
    }

    @HostListener('window:keyup') onKeyUp() {
        this.keyboard.stop();
    }

    @HostListener('window:mouseup', ['$event']) onMouseUp(event: MouseEvent) {
        this.selection.handlers(event).finish();
    }

    @HostListener('document:selectstart', ['$event']) onDocSelectStart(event: MouseEvent) {
        console.log(`>>>>>>>>>>>>>> doc: selectstart`);
        return stop(event);
    }
    @HostListener('document:selectionchange', ['$event']) onDocSelectionChange(event: MouseEvent) {
        console.log(`>>>>>>>>>>>>>> doc: selectionchange`);
        // this.selection.check();
        // return stop(event);
    }

    @HostListener('selectstart', ['$event']) onSelectStart(event: MouseEvent) {
        console.log(`>>>>>>>>>>>>>> selectstart`);
        return stop(event);
    }

    @HostListener('selectionchange', ['$event']) onSelectionChange(event: MouseEvent) {
        console.log(`>>>>>>>>>>>>>> selectionchange`);
        return stop(event);
    }

    @HostListener('focus') onFocus() {
        this.keyboard.focus();
        this.service.focus().in();
    }

    @HostListener('blur') onBlur() {
        this.keyboard.blur();
        this.service.focus().out();
    }

    public rows: Row[] = [];
    public readonly holder: Holder = new Holder();
    public readonly frame: Frame = new Frame();
    public readonly keyboard: Keyboard = new Keyboard();
    public selecting: Selecting = new Selecting(); //<-------- Rudement
    public selection!: SelectionTracker;
    public selectionDirection = SelectionDirection;

    constructor(changeDetectorRef: ChangeDetectorRef, private elRef: ElementRef<HTMLElement>) {
        super(changeDetectorRef);
    }

    public ngOnDestroy(): void {
        this.detauchChangesDetector();
        this.holder.destroy();
        this.frame.destroy();
        this.selection.destroy();
        this._subscriber.unsubscribe();
    }

    public ngAfterViewInit(): void {
        this.holder.bind(this._nodeHolder);
        this.frame.bind(this.service, this.holder);
        this.service.bind(this.frame, this.elRef.nativeElement);
        this.keyboard.bind(this.frame);
        this.selection = new SelectionTracker(this._nodeHolder.nativeElement, this.frame);

        this._subscriber.register(
            this.frame.onFrameChange((rows: Row[]) => {
                const exists = this.rows.length;
                rows.forEach((updated: Row, i: number) => {
                    if (i < exists) {
                        this.rows[i].from(updated);
                    } else {
                        this.rows.push(updated);
                    }
                });
                if (rows.length < exists) {
                    this.rows.splice(rows.length).forEach((row) => {
                        row.destroy();
                    });
                }
                this.detectChanges();
                this.selection.render();
            }),
        );
        this._subscriber.register(
            this.selection.subjects.get().start.subscribe(() => {
                this._removeGlobalStyleHandler = this.ilc().services.ui.styles
                    .add(`:not(*[id="${this._id}"] *) {
                	user-select: none;
                }`);
                this.detectChanges();
            }),
        );
        this._subscriber.register(
            this.selection.subjects.get().finish.subscribe(() => {
                if (typeof this._removeGlobalStyleHandler === 'function') {
                    this._removeGlobalStyleHandler();
                    this._removeGlobalStyleHandler = undefined;
                }
                this.detectChanges();
            }),
        );
        this._subscriber.register(
            this.ilc().services.system.hotkeys.listen('G', () => {
                if (!this.service.focus().get()) {
                    return;
                }
                this.service.scrollToTop();
            }),
        );
        this._subscriber.register(
            this.ilc().services.system.hotkeys.listen('gg', () => {
                if (!this.service.focus().get()) {
                    return;
                }
                this.service.scrollToBottom();
            }),
        );
        this._subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + C', () => {
                if (!this.service.focus().get()) {
                    return;
                }
                // this.selection.copyToClipboard().catch((err: Error) => {
                //     this.log().error(`Fail to copy content into clipboard: ${err.message}`);
                // });
            }),
        );
        this.frame.init();
    }

    public getFrameStart(): number {
        return this.frame.get().from;
    }

    public isSourceSwitched(i: number): boolean {
        return this.rows[i - 1] === undefined
            ? false
            : this.rows[i - 1].source !== this.rows[i].source;
    }

    public onScrolling(position: number) {
        this.frame.moveTo(position, ChangesInitiator.Scrolling);
    }

    public onWheel(event: WheelEvent) {
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            this.frame.offsetTo(event.deltaY, ChangesInitiator.Wheel);
            stop(event);
        }
    }

    public showSelectionDetectors(): boolean {
        return this._removeGlobalStyleHandler !== undefined;
    }

    public onMouseMoveSelectionDetector(direction: SelectionDirection) {
        switch (direction) {
            case SelectionDirection.Top:
                this.selection.handlers().up();
                break;
            case SelectionDirection.Bottom:
                this.selection.handlers().down();
                break;
        }
    }

    public onContentMouseDown(event: MouseEvent) {
        this.selection.handlers(event).start();
    }

    public onContentMouseMove(event: MouseEvent) {
        this.selection.handlers(event).select();
    }
}
export interface ScrollAreaComponent extends IlcInterface {}
