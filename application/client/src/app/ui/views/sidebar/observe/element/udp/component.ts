import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Element } from '../element';
import { Mutable } from '@platform/types/unity/mutable';
import { stop } from '@ui/env/dom';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-views-observed-udp',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class Item extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;

    public readonly connection: $.Origin.Stream.Stream.UDP.IConfiguration | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const conf =
            this.element.source.observe.origin.as<$.Origin.Stream.Stream.UDP.Configuration>(
                $.Origin.Stream.Stream.UDP.Configuration,
            );
        if (conf === undefined) {
            this.log().error(`Expected origin Source would be UDP`);
            return;
        }
        (this as Mutable<Item>).connection = conf.configuration;
    }

    public isActive(): boolean {
        return this.element.source.observer !== undefined;
    }

    public restart(event: MouseEvent): void {
        stop(event);
        this.element.provider.clone(this.element.source.observe).catch((err: Error) => {
            this.log().error(`Fail to restart UDP connection: ${err.message}`);
        });
    }

    public stop(event: MouseEvent): void {
        stop(event);
        const observer = this.element.source.observer;
        if (observer === undefined) {
            return;
        }
        observer.abort().catch((err: Error) => {
            this.log().error(`Fail to abort UDP connection: ${err.message}`);
        });
    }
}
export interface Item extends IlcInterface {}
