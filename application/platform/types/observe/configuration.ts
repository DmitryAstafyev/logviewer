import { error } from '../../log/utils';
import { JsonConvertor } from '../storage/json';
import { Validate, SelfValidate, Alias } from '../env/types';
import { List } from './description';
import { Mutable } from '../unity/mutable';

export interface ConfigurationStatic<T, A> extends Validate<T>, Alias<A> {
    initial(): T;
}

export interface ConfigurationStaticDesc<T, A> extends Validate<T>, Alias<A>, List {
    initial(): T;
}

export interface Reference<T, C, A> extends ConfigurationStatic<T, A> {
    new (...args: any[]): C & Configuration<T, C, A>;
}

export interface ReferenceDesc<T, C, A> extends ConfigurationStaticDesc<T, A> {
    new (...args: any[]): C & Configuration<T, C, A>;
}

export abstract class Configuration<T, C, A>
    implements JsonConvertor<Configuration<T, C, A>>, SelfValidate
{
    constructor(public readonly configuration: T, protected ref: Reference<T, C, A>) {}

    public get(): T {
        return this.configuration;
    }

    public set(configuration: T): void {
        (this as Mutable<Configuration<unknown, unknown, unknown>>).configuration = configuration;
    }

    public validate(): Error | undefined {
        const error: Error | T = this.ref.validate(this.get());
        return error instanceof Error ? error : undefined;
    }

    public alias(): A {
        return this.ref.alias();
    }

    public json(): {
        to(): string;
        from(str: string): Configuration<T, C, A> | Error;
    } {
        return {
            to: (): string => {
                return JSON.stringify(this.get());
            },
            from: (str: string): Configuration<T, C, A> | Error => {
                try {
                    const configuration: T | Error = this.ref.validate(JSON.parse(str));
                    if (configuration instanceof Error) {
                        return configuration;
                    }
                    this.set(configuration);
                    return this;
                } catch (e) {
                    return new Error(error(e));
                }
            },
        };
    }
}
