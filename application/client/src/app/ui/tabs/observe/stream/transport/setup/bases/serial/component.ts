import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/serial';
// import { Action } from '@ui/tabs/sources/common/actions/action';
import { Ilc, IlcInterface } from '@env/decorators/component';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-serial-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public configuration!: Stream.Serial.IConfiguration;
    public state!: State;
    // @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.configuration);
        this.env().subscriber.register(
            this.state.changed.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.state.scan().start();
    }

    public ngOnDestroy() {
        this.state.scan().stop();
        // this.state.destroy();
    }
}
export interface SetupBase extends IlcInterface {}
