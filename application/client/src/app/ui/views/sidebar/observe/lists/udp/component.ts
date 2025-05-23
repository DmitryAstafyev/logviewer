import { Component, ChangeDetectorRef, AfterContentInit, ViewChild } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Provider } from '@service/session/dependencies/observing/implementations/udp';
import { Element } from '../../element/element';
import { QuickSetup } from '@tabs/observe/origin/stream/transport/setup/quick/udp/component';
import { Action } from '@ui/tabs/observe/action';
import { IButton } from '../../common/title/component';
import { State } from '../../states/udp';
import { ListBase } from '../component';
import { Configuration } from '@platform/types/observe/origin/stream/udp';
import { notifications, Notification } from '@ui/service/notifications';

import * as Factroy from '@platform/types/observe/factory';

@Component({
    selector: 'app-views-observed-list-udp',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class List extends ListBase<State, Provider> implements AfterContentInit {
    @ViewChild('quicksetupref') public quickSetupRef!: QuickSetup;

    public tailing: Element[] = [];
    public offline: Element[] = [];
    public action: Action = new Action();
    public initial: Configuration = new Configuration(Configuration.initial(), undefined);
    public buttons: IButton[] = [
        {
            icon: 'codicon-tasklist',
            handler: () => {
                this.provider.recent();
            },
        },
        {
            icon: 'codicon-empty-window',
            handler: () => {
                this.provider.openNewSessionOptions();
            },
        },
    ];

    constructor(cdRef: ChangeDetectorRef) {
        super(new State(), cdRef);
    }

    public override ngAfterContentInit(): void {
        super.ngAfterContentInit();
        this.update();
        this.env().subscriber.register(
            this.provider.subjects.get().updated.subscribe(() => {
                this.update().detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().apply.subscribe(() => {
                this.provider
                    .openAsNewOrigin(
                        new Factroy.Stream().asDlt().udp(this.initial.configuration).get(),
                    )
                    .then(() => {
                        this.action.applied();
                        this.initial.overwrite(Configuration.initial());
                    })
                    .catch((err: Error) => {
                        notifications.notify(
                            new Notification({
                                message: err.message,
                                actions: [],
                            }),
                        );
                        this.log().error(`Fail to apply connection to UDP: ${err.message}`);
                    });
            }),
        );
    }

    public toggled(opened: boolean) {
        this.state.toggleQuickSetup(opened);
    }

    protected update(): List {
        this.tailing = this.provider
            .sources()
            .filter((s) => s.observer !== undefined)
            .map((s) => new Element(s, this.provider));
        this.offline = this.provider
            .sources()
            .filter((s) => s.observer === undefined)
            .map((s) => new Element(s, this.provider));
        return this;
    }
}
export interface List extends IlcInterface {}
