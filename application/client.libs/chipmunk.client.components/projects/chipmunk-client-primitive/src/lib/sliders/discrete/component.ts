// tslint:disable:member-ordering
import { Component, Input, AfterContentInit, AfterViewInit, ChangeDetectorRef,
         OnChanges, SimpleChanges, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { MDCSlider } from '@material/slider';

declare class ResizeObserver {
    constructor(callback: ResizeObserverCallback);
    disconnect(): void;
    observe(target: Element): void;
    unobserve(target: Element): void;
}

type ResizeObserverCallback = (entries: ReadonlyArray<ResizeObserverEntry>) => void;

interface ResizeObserverEntry {
    readonly target: Element;
    readonly contentRect: DOMRectReadOnly;
}

@Component({
    selector: 'lib-primitive-discrete-slider',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SliderDiscreteComponent implements AfterContentInit, OnChanges, AfterViewInit, OnDestroy {

    @ViewChild('container', {static: false}) private _containerElRef: ElementRef;

    @Input() public label: string = 'Select value';
    @Input() public value: number = 0;
    @Input() public min: number = 0;
    @Input() public max: number = 100;
    @Input() public step: number = 1;
    @Input() public onChange: (value: string | number, event?: KeyboardEvent) => any = () => void 0;

    private _resizeObserver: ResizeObserver;
    private _component: MDCSlider | undefined;
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._resizeObserver = new ResizeObserver(this._onResize.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        if (this._component === undefined) {
            return;
        }
        this._component.destroy();
        this._component = undefined;
    }

    public ngAfterContentInit() {
        this._forceUpadte();
    }

    public ngAfterViewInit() {
        if (this._containerElRef === undefined) {
            return;
        }
        this._component = new MDCSlider(this._containerElRef.nativeElement);
        this._component.listen('MDCSlider:change', (event: CustomEvent) => {
            this.value = this._component.value;
            this._onChange();
        });
        this._resizeObserver.observe(this._containerElRef.nativeElement);
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.value !== undefined) {
            this.value = changes.value.currentValue;
        }
        if (changes.min !== undefined) {
            this.min = changes.min.currentValue;
        }
        if (changes.max !== undefined) {
            this.max = changes.max.currentValue;
        }
        this._forceUpadte();
    }

    public drop() {
        this.value = this.min;
    }

    public refresh() {
        this._onChange();
    }

    public setValue(value: number, silence: boolean = false) {
        this.value = value;
        if (silence) {
            this._forceUpadte();
        } else {
            this._onChange();
        }
    }

    public getValue(): string | number {
        return this.value;
    }

    private _onResize(entries: ResizeObserverEntry[]) {
        if (entries.length === 0) {
            return;
        }
        if (this._component === undefined) {
            return;
        }
        this._component.layout();
        this._forceUpadte();
    }

    private _onChange() {
        this.onChange(this.value, undefined);
        this._forceUpadte();
    }

    private _forceUpadte() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }


}
