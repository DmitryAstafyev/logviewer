import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    Input,
    AfterContentInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../state';

@Component({
    selector: 'app-tabs-observe-file',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabObserveFile extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        //
    }

    public ngAfterViewInit(): void {
        //
    }
}
export interface TabObserveFile extends IlcInterface {}
