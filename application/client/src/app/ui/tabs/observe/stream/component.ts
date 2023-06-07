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
import { State as StreamState } from './transport/setup/state';
import { Action } from '@ui/tabs/sources/common/actions/action';

import * as Streams from '@platform/types/observe/origin/stream/index';

@Component({
    selector: 'app-tabs-observe-stream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabObserveStream extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() state!: State;

    public stream: StreamState = new StreamState();
    public action: Action = new Action();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.updates.get().stream.subscribe(() => {
                const stream = this.state.stream;
                if (stream === undefined) {
                    return;
                }
                this.stream.from({ [stream]: Streams.getByAlias(stream).get() });
            }),
        );
    }

    public ngAfterViewInit(): void {
        //
    }
}
export interface TabObserveStream extends IlcInterface {}
