import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../states/udp';
// import { Action } from '@ui/tabs/sources/common/actions/action';

import * as Stream from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-udp-setup-base',
    template: '',
})
@Ilc()
export class SetupBase extends ChangesDetector implements OnDestroy, AfterContentInit {
    @Input() public configuration!: Stream.Udp.IConfiguration;
    public state!: State;
    // @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        // this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.configuration);
        // this.env().subscriber.register(
        //     this.state.subjects.get().updated.subscribe(this.verify.bind(this)),
        // );
        // this.env().subscriber.register(
        //     this.action.subjects.get().applied.subscribe(() => {
        //         this.state.drop();
        //         this.verify();
        //     }),
        // );
        this.verify();
    }

    public addMulticast() {
        this.state.addMulticast();
        this.verify();
    }

    public removeMulticast(index: number) {
        this.state.removeMulticast(index);
        this.verify();
    }

    public verify() {
        // setTimeout(() => {
        //     this.action.setDisabled(!this.state.isValid());
        // });
    }
}
export interface SetupBase extends IlcInterface {}