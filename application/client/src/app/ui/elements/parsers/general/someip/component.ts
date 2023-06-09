import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr } from '@env/str';
import { State } from './state';

import * as SomeIp from '@platform/types/observe/parser/someip';

@Component({
    selector: 'app-el-someip-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SomeIpGeneralConfiguration extends ChangesDetector implements AfterContentInit {
    @Input() configuration!: SomeIp.IConfiguration;

    protected state!: State;

    public bytesToStr = bytesToStr;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.configuration);
        this.state.bind(this);
    }
}
export interface SomeIpGeneralConfiguration extends IlcInterface {}
