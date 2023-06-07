import {
    Configuration as Base,
    ConfigurationStatic,
    ReferenceDesc,
    Reference as ReferenceBase,
} from '../../configuration';
import { OriginDetails, IOriginDetails } from '../../description';
import { Statics } from '../../../../env/decorators';
import { Mutable } from '../../../unity/mutable';

import * as Process from './process';
import * as Serial from './serial';
import * as Tcp from './tcp';
import * as Udp from './udp';
import * as Parser from '../../parser';
import * as Sde from '../../sde';

export * as Process from './process';
export * as Serial from './serial';
export * as Tcp from './tcp';
export * as Udp from './udp';

export type Reference = ReferenceDesc<IDeclaration, Declaration, Alias>;

export abstract class Support {
    public abstract getSupportedStream(): Reference[];
}

export enum Alias {
    Tcp = 'Tcp',
    Udp = 'Udp',
    Serial = 'Serial',
    Process = 'Process',
}

export type IDeclaration =
    | Serial.IConfiguration
    | Process.IConfiguration
    | Tcp.IConfiguration
    | Udp.IConfiguration;

export type Declaration =
    | Serial.Configuration
    | Process.Configuration
    | Tcp.Configuration
    | Udp.Configuration;

export interface IConfiguration {
    [Alias.Serial]?: Serial.IConfiguration;
    [Alias.Process]?: Process.IConfiguration;
    [Alias.Tcp]?: Tcp.IConfiguration;
    [Alias.Udp]?: Udp.IConfiguration;
}

export const REGISTER = {
    [Alias.Process]: Process.Configuration,
    [Alias.Serial]: Serial.Configuration,
    [Alias.Tcp]: Tcp.Configuration,
    [Alias.Udp]: Udp.Configuration,
};

export const DEFAULT = Tcp.Configuration;

export function getByAlias(alias: Alias): Declaration {
    const Ref: Reference = REGISTER[alias];
    if (Ref === undefined) {
        throw new Error(`Unknown stream: ${alias}`);
    }
    return new Ref(Ref.initial(), Ref);
}

@Statics<ConfigurationStatic<IConfiguration, undefined>>()
export class Configuration
    extends Base<IConfiguration, Configuration, undefined>
    implements OriginDetails, Sde.Support, Parser.Support
{
    static alias(): undefined {
        return undefined;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Alias])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Stream transport isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config: any = configuration[key as Alias];
            if (config === undefined) {
                return;
            }
            const err = REGISTER[key as Alias].validate(config);
            if (err instanceof Error) {
                error = err;
            } else {
                error = undefined;
            }
        });
        return error instanceof Error ? error : configuration;
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            [DEFAULT.alias()]: DEFAULT.initial(),
        };
    }

    protected setInstance() {
        const configuration = this.get();
        let instance: Declaration | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (instance !== undefined) {
                return;
            }
            const config: any = configuration[key as Alias];
            if (config === undefined) {
                return;
            }
            const Ref: any = REGISTER[key as Alias];
            instance = new Ref(config, Ref);
        });
        if (instance === undefined) {
            throw new Error(`Configuration of stream doesn't have definition of known source.`);
        }
        (this as Mutable<Configuration>).instance = instance;
    }

    public readonly instance!: Declaration;

    constructor(
        configuration: IConfiguration,
        ref: ReferenceBase<IConfiguration, Configuration, undefined>,
    ) {
        super(configuration, ref);
        this.setInstance();
    }

    public change(stream: Declaration): void {
        this.set({ [stream.alias()]: stream.get() });
        this.setInstance();
    }

    public desc(): IOriginDetails {
        return this.instance.desc();
    }

    public isSdeSupported(): boolean {
        return this.instance.isSdeSupported();
    }

    public getSupportedParsers(): Parser.Reference[] {
        return this.instance.getSupportedParsers();
    }
}
