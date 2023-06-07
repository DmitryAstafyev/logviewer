import {
    Configuration as Base,
    ConfigurationStatic,
    ReferenceDesc,
    Reference as ReferenceBase,
} from '../configuration';
import { Statics } from '../../../env/decorators';
import { List, IList } from '../description';
import { Mutable } from '../../unity/mutable';

import * as Dlt from './dlt';
import * as SomeIp from './someip';
import * as Text from './text';

export * as Dlt from './dlt';
export * as SomeIp from './someip';
export * as Text from './text';
import * as Stream from '../origin/stream/index';
import * as Files from '../types/file';

export type Reference = ReferenceDesc<IDeclaration, Declaration, Alias>;

export abstract class Support {
    public abstract getSupportedParsers(): Reference[];
}

export enum Alias {
    Dlt = 'Dlt',
    SomeIp = 'SomeIp',
    Text = 'Text',
}

export type IDeclaration = Text.IConfiguration | Dlt.IConfiguration | SomeIp.IConfiguration;

export type Declaration = Text.Configuration | Dlt.Configuration | SomeIp.Configuration;

export interface IConfiguration {
    [Alias.Dlt]?: Dlt.IConfiguration;
    [Alias.SomeIp]?: SomeIp.IConfiguration;
    [Alias.Text]?: Text.IConfiguration;
}

const REGISTER = {
    [Alias.Dlt]: Dlt.Configuration,
    [Alias.SomeIp]: SomeIp.Configuration,
    [Alias.Text]: Text.Configuration,
};

const DEFAULT = Text.Configuration;

export function getByAlias(alias: Alias): Declaration {
    const Ref: Reference = REGISTER[alias];
    if (Ref === undefined) {
        throw new Error(`Unknown parser: ${alias}`);
    }
    return new Ref(Ref.initial(), Ref);
}

@Statics<ConfigurationStatic<IConfiguration, undefined>>()
export class Configuration
    extends Base<IConfiguration, Configuration, undefined>
    implements List, Stream.Support, Files.Support
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
            // Error with "never" comes because text parser has settings NULL
            const err = REGISTER[key as Alias].validate(config as never);
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

    protected setInstance(): void {
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

    public change(parser: Declaration): void {
        this.set({ [parser.alias()]: parser.get() });
        this.setInstance();
    }

    public desc(): IList {
        return this.instance.desc();
    }

    public getSupportedStream(): Stream.Reference[] {
        return this.instance.getSupportedStream();
    }

    public getSupportedFileType(): Files.FileType[] {
        return this.instance.getSupportedFileType();
    }
}
