import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr, timestampToUTC } from '@env/str';
import { State } from './state';

import * as Dlt from '@platform/types/observe/parser/dlt';

@Component({
    selector: 'app-el-dlt-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class DltGeneralConfiguration extends ChangesDetector implements AfterContentInit {
    @Input() configuration!: Dlt.IConfiguration;

    protected state!: State;

    public bytesToStr = bytesToStr;
    public timestampToUTC = timestampToUTC;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.configuration);
        this.state.bind(this);
    }
}
export interface DltGeneralConfiguration extends IlcInterface {}
