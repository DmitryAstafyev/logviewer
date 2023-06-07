import { error } from '../../../../../log/utils';
import { Alias } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';

export interface IConfiguration {
    command: string;
    cwd: string;
    envs: { [key: string]: string };
}

@Statics<ConfigurationStaticDesc<IConfiguration, Alias>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Alias>
    implements OriginDetails, Sde.Support
{
    static desc(): IList {
        return {
            major: `Terminal`,
            minor: 'Executing Terminal Command',
            icon: 'web_asset',
        };
    }

    static alias(): Alias {
        return Alias.Process;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'command');
            obj.getAsString(configuration, 'cwd');
            obj.getAsObjWithPrimitives(configuration, 'envs');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            command: '',
            cwd: '',
            envs: {},
        };
    }

    public desc(): IOriginDetails {
        return {
            major: `${this.get().command}`,
            minor: this.get().cwd === '' ? 'no defined cwd' : this.get().cwd,
            icon: 'web_asset',
            state: {
                running: 'spawning',
                stopped: '',
            },
        };
    }

    public isSdeSupported(): boolean {
        return true;
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Text.Configuration];
    }
}
