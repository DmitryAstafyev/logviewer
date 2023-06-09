import {
    Configuration as Base,
    ConfigurationStatic,
    ReferenceDesc,
    Reference as ReferenceBase,
} from '../../configuration';
import { OriginDetails, IOriginDetails } from '../../description';
import { Statics } from '../../../../env/decorators';
import { Mutable } from '../../../unity/mutable';

import * as Origin from '../index';

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

export type Reference = ReferenceDesc<IDeclaration, Declaration, Source>;

export abstract class Support {
    public abstract getSupportedStream(): Reference[];
}

export enum Source {
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
    [Source.Serial]?: Serial.IConfiguration;
    [Source.Process]?: Process.IConfiguration;
    [Source.Tcp]?: Tcp.IConfiguration;
    [Source.Udp]?: Udp.IConfiguration;
}

export const REGISTER = {
    [Source.Process]: Process.Configuration,
    [Source.Serial]: Serial.Configuration,
    [Source.Tcp]: Tcp.Configuration,
    [Source.Udp]: Udp.Configuration,
};

export const DEFAULT = Tcp.Configuration;

export function getByAlias(alias: Source, configuration?: IDeclaration): Declaration {
    const Ref: Reference = REGISTER[alias];
    if (Ref === undefined) {
        throw new Error(`Unknown stream: ${alias}`);
    }
    return new Ref(configuration === undefined ? Ref.initial() : configuration, Ref);
}

export function getAliasByConfiguration(configuration: IConfiguration): Source {
    let detected: Source | undefined;
    Object.keys(configuration).forEach((key) => {
        if (REGISTER[key as Source] !== undefined) {
            if (detected !== undefined) {
                throw new Error(
                    `Configuration has a multiple source defined: ${JSON.stringify(configuration)}`,
                );
            }
            detected = key as Source;
        }
    });
    if (detected === undefined) {
        throw new Error(
            `Configuration doesn't have any known source: ${JSON.stringify(configuration)}`,
        );
    }
    return detected;
}

@Statics<ConfigurationStatic<IConfiguration, Origin.Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Origin.Context>
    implements OriginDetails, Sde.Support, Parser.Support
{
    static alias(): Origin.Context {
        return Origin.Context.Stream;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Source])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Stream transport isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config: any = configuration[key as Source];
            if (config === undefined) {
                return;
            }
            const err = REGISTER[key as Source].validate(config);
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
            const config: any = configuration[key as Source];
            if (config === undefined) {
                return;
            }
            const Ref: any = REGISTER[key as Source];
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
        ref: ReferenceBase<IConfiguration, Configuration, Origin.Context>,
    ) {
        super(configuration, ref);
        this.setInstance();
    }

    public change(): {
        byConfiguration(configuration: IConfiguration): void;
        byDeclaration(declaration: Declaration): void;
    } {
        return {
            byConfiguration: (configuration: IConfiguration): void => {
                this.set(configuration);
                this.setInstance();
            },
            byDeclaration: (stream: Declaration): void => {
                this.set({ [stream.alias()]: stream.get() });
                this.setInstance();
            },
        };
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
