import { error } from '../../../../../log/utils';
import { Source } from '../index';
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

@Statics<ConfigurationStaticDesc<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support
{
    static desc(): IList {
        return {
            major: `UDP`,
            minor: 'UDP Connection',
            icon: 'network_wifi_3_bar',
        };
    }

    static alias(): Source {
        return Source.Udp;
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
            major: this.configuration.bind_addr,
            minor:
                this.configuration.multicast.length === 0
                    ? ''
                    : this.configuration.multicast.map((m) => m.multiaddr).join(', '),
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