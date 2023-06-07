import { error } from '../../../../../log/utils';
import { Alias } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';

export interface Multicast {
    multiaddr: string;
    interface: string | undefined;
}

export interface IConfiguration {
    bind_addr: string;
    multicast: Multicast[];
}

@Statics<ConfigurationStaticDesc<IConfiguration, Alias>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Alias>
    implements OriginDetails, Sde.Support
{
    static desc(): IList {
        return {
            major: `UDP`,
            minor: 'UDP Connection',
            icon: 'network_wifi_3_bar',
        };
    }

    static alias(): Alias {
        return Alias.Udp;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'bind_addr');
            obj.getAsArray(configuration, 'multicast');
            configuration.multicast.forEach((multicast: Multicast) => {
                obj.getAsNotEmptyString(multicast, 'multiaddr');
                obj.getAsArrayOfNotEmptyString(multicast, 'interface');
            });
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            bind_addr: '0.0.0.0',
            multicast: [],
        };
    }

    public desc(): IOriginDetails {
        return {
            major: this.get().bind_addr,
            minor:
                this.get().multicast.length === 0
                    ? ''
                    : this.get()
                          .multicast.map((m) => m.multiaddr)
                          .join(', '),
            icon: 'network_wifi_3_bar',
            state: {
                running: 'listening',
                stopped: '',
            },
        };
    }

    public isSdeSupported(): boolean {
        return false;
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
    }
}
