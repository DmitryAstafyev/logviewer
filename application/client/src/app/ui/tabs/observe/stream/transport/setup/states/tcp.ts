import * as Errors from '../bases/tcp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

export class State extends Stream.Tcp.Configuration {
    public errors: {
        address: Errors.ErrorState;
    };

    constructor(configuration: Stream.Tcp.IConfiguration) {
        super(configuration, Stream.Tcp.Configuration);
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.address, () => {
                // this.update();
            }),
        };
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
        this.set(opt);
    }
}
