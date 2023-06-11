import { Configuration as Base, ConfigurationStatic } from '../configuration';
import { Statics } from '../../../env/decorators';
import { Mutable } from '../../unity/mutable';
import { Alias } from '../../env/types';

export * as File from './file';
export * as Concat from './concat';
export * as Stream from './stream';

import * as File from './file';
import * as Concat from './concat';
import * as Stream from './stream';
import * as Parser from '../parser';
import * as Sde from '../sde';

export enum Context {
    File = 'File',
    Concat = 'Concat',
    Stream = 'Stream',
}

export type SourceUuid = string;

export interface IConfiguration {
    [Context.File]?: File.IConfiguration;
    [Context.Concat]?: Concat.IConfiguration;
    [Context.Stream]?: Stream.IConfiguration;
}

export const REGISTER = {
    [Context.File]: File.Configuration,
    [Context.Concat]: Concat.Configuration,
    [Context.Stream]: Stream.Configuration,
};

export const DEFAULT = File.Configuration;

export type Declaration = File.Configuration | Concat.Configuration | Stream.Configuration;

@Statics<ConfigurationStatic<IConfiguration, undefined>>()
export class Configuration
    extends Base<IConfiguration, Configuration, undefined>
    implements Parser.Support, Sde.Support
{
    static alias(): undefined {
        return undefined;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Context])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Origin isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config = configuration[key as Context];
            if (config === undefined) {
                return;
            }
            const err = REGISTER[key as Context].validate(config as any);
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
        const configuration = this.configuration;
        let instance: Declaration | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (instance !== undefined) {
                return;
            }
            const config = configuration[key as Context];
            if (config === undefined) {
                return;
            }
            const Ref = REGISTER[key as Context];
            instance = new Ref(config as any);
        });
        if (instance === undefined) {
            throw new Error(`Configuration of origin doesn't have definition of known source.`);
        }
        (this as Mutable<Configuration>).instance = instance;
    }

    public readonly instance!: Declaration;

    constructor(configuration: IConfiguration) {
        super(configuration);
        this.setInstance();
    }

    public change(origin: Declaration): void {
        this.overwrite({ [origin.alias()]: origin.configuration });
        this.setInstance();
    }

    public isSdeSupported(): boolean {
        return this.instance.isSdeSupported();
    }

    public getSupportedParsers(): Parser.Reference[] {
        return this.instance.getSupportedParsers();
    }

    public as<T>(Ref: { new (...args: any[]): Declaration } & Alias<unknown>): T | undefined {
        return this.instance.alias() === Ref.alias() ? (this.instance as T) : undefined;
    }
}
