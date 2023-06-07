import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Source } from '@platform/types/transport';
import { Action } from '@ui/tabs/sources/common/actions/action';

@Component({
    selector: 'app-transport',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    public readonly Source = Source;

    @Input() public state!: State;
    @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.updated.subscribe(() => {
                this.action.defaults();
                this.detectChanges();
            }),
        );
    }

    public ngOnSourceChange() {
        this.state.switch();
        this.action.defaults();
    }
}
export interface Transport extends IlcInterface {}
