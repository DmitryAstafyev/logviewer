import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr } from '@env/str';
import { State } from './state';
import { Observe } from '@platform/types/observe/index';

@Component({
    selector: 'app-el-someip-static',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SomeIpStaticConfiguration extends ChangesDetector implements AfterContentInit {
    @Input() observe!: Observe;

    protected state!: State;

    public bytesToStr = bytesToStr;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.observe);
        this.state.bind(this);
    }
}
export interface SomeIpStaticConfiguration extends IlcInterface {}
