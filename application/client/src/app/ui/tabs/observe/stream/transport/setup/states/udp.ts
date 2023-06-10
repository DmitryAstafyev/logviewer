import * as Errors from '../bases/udp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

const MULTICAST_ADDR = '255.255.255.255';
const MULTUCAST_INTERFACE = '0.0.0.0';

export interface IMulticastInfo {
    fields: Stream.Udp.Multicast;
    errors: {
        multiaddr: Errors.ErrorState;
        interface: Errors.ErrorState;
    };
}

export class State extends Stream.Udp.Configuration {
    static source = Stream.Source.Udp;

    public errors: {
        address: Errors.ErrorState;
    };
    public multicasts: IMulticastInfo[] = [];

    constructor(configuration: Stream.Udp.IConfiguration) {
        super(configuration);
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.bindingAddress, () => {
                // this.update();
            }),
        };
    }

    public isValid(): boolean {
        if (!this.errors.address.isValid()) {
            return false;
        }
        return (
            this.multicasts.filter(
                (m) => !m.errors.multiaddr.isValid() || !m.errors.interface.isValid(),
            ).length === 0
        );
    }

    public drop() {
        this.configuration.bind_addr = Stream.Udp.Configuration.initial().bind_addr;
        this.configuration.multicast = Stream.Udp.Configuration.initial().multicast;
    }

    public from(opt: Stream.Udp.IConfiguration) {
        this.set(opt);
        const pair = opt.bind_addr.split(':');
        if (pair.length !== 2) {
            return;
        }
        this.multicasts = opt.multicast.map((fields) => {
            return {
                fields,
                errors: this.getMulticastErrorsValidators(),
            };
        });
    }

    public addMulticast() {
        this.multicasts.push({
            fields: {
                multiaddr: MULTICAST_ADDR,
                interface: MULTUCAST_INTERFACE,
            },
            errors: this.getMulticastErrorsValidators(),
        });
    }

    public cleanMulticast(index: number) {
        index > -1 && this.multicasts.splice(index, 1);
    }

    protected getMulticastErrorsValidators(): {
        multiaddr: Errors.ErrorState;
        interface: Errors.ErrorState;
    } {
        return {
            multiaddr: new Errors.ErrorState(Errors.Field.multicastAddress, () => {
                // this.update();
            }),
            interface: new Errors.ErrorState(Errors.Field.multicastInterface, () => {
                // this.update();
            }),
        };
    }
}
