import { Destroy } from '@platform/types/env/types';
import { Action } from '@ui/tabs/observe/action';

import * as Errors from '../bases/tcp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

export class State extends Stream.Tcp.Configuration implements Destroy {
    public action: Action;
    public errors: {
        address: Errors.ErrorState;
    };

    constructor(
        action: Action,
        configuration: Stream.Tcp.IConfiguration = Stream.Tcp.Configuration.initial(),
    ) {
        super(configuration);
        this.action = action;
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.address, () => {
                // this.update();
            }),
        };
    }

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public isValid(): boolean {
        if (!this.errors.address.isValid()) {
            return false;
        }
        return true;
    }

    public drop() {
        this.configuration.bind_addr = Stream.Tcp.Configuration.initial().bind_addr;
    }

    public from(opt: Stream.Tcp.IConfiguration) {
        this.overwrite(opt);
    }
}
