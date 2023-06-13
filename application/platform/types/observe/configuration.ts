import { error } from '../../log/utils';
import { JsonConvertor } from '../storage/json';
import { Validate, SelfValidate, Alias } from '../env/types';
import { List } from './description';
import { Mutable } from '../unity/mutable';
import { scope } from '../../env/scope';
import { Subject } from '../../env/subscription';

import * as Stream from './origin/stream/index';
import * as File from './types/file';

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

function observe<T>(entry: T, subject: Subject<void>): T {
    function logger() {
        return scope.getLogger('ObserveConfig');
    }
    if (entry === null) {
        logger().error(`Cannot observe null value`);
        return undefined as T;
    }
    if (['function', 'symbol'].includes(typeof entry)) {
        logger().error(`Cannot observe ${typeof entry} value`);
        return undefined as T;
    }
    if (['string', 'number', 'boolean'].includes(typeof entry)) {
        return entry;
    }
    const set = (target: any, prop: string | symbol, value: any): boolean => {
        (target as any)[prop] = observe(value, subject);
        subject.emit();
        return true;
    };
    if (entry instanceof Array) {
        return new Proxy(entry as object, { set }) as T;
    } else if (entry instanceof Object) {
        Object.keys(entry).forEach((key: string | number) => {
            if (!entry.hasOwnProperty(key)) {
                return;
            }
            const value = (entry as any)[key];
            if (['string', 'number', 'boolean'].indexOf(typeof value) !== -1) {
                return;
            } else if (value instanceof Array || value instanceof Object) {
                (entry as any)[key] = observe(value, subject);
            }
        });
        return new Proxy(entry as object, { set }) as T;
    }
    logger().error(`Type "${typeof entry}" cannot be observed`);
    return undefined as T;
}

// To prevent circle dependency we are loading compatibility table in async way
let compatibility:
    | {
          Streams: {
              [key: string]: Stream.Reference[];
          };
          Files: {
              [key: string]: File.FileType[];
          };
          SDESupport: {
              [key: string]: boolean;
          };
      }
    | undefined;
import('./compatibility')
    .then((mod) => {
        compatibility = mod;
    })
    .catch((err: Error) => {
        console.error(err.message);
    });

export abstract class Configuration<T, C, A>
    implements JsonConvertor<Configuration<T, C, A>>, SelfValidate
{
    protected ref: Reference<T, C, A>;

    public readonly configuration: T;
    public readonly watcher: Subject<void> = new Subject();

    constructor(configuration: T) {
        if (typeof this.constructor !== 'function') {
            throw new Error(`Fail to get reference to Constructor`);
        }
        this.ref = this.constructor as Reference<T, C, A>;
        this.configuration = observe<T>(configuration, this.watcher);
    }

    public overwrite(configuration: T): void {
        (this as Mutable<Configuration<unknown, unknown, unknown>>).configuration = observe<T>(
            // We should serialize object, because it can be already Proxy
            JSON.parse(JSON.stringify(configuration)),
            this.watcher,
        );
    }

    public validate(): Error | undefined {
        const error: Error | T = this.ref.validate(this.configuration);
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
                return JSON.stringify(this.configuration);
            },
            from: (str: string): Configuration<T, C, A> | Error => {
                try {
                    const configuration: T | Error = this.ref.validate(JSON.parse(str));
                    if (configuration instanceof Error) {
                        return configuration;
                    }
                    this.overwrite(configuration);
                    return this;
                } catch (e) {
                    return new Error(error(e));
                }
            },
        };
    }

    public getSupportedStream(): Stream.Reference[] {
        if (compatibility === undefined) {
            throw new Error(`Moudle "compatibility" isn't loaded yet`);
        }
        if (compatibility.Streams[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.Streams list`,
            );
        }
        return compatibility.Streams[this.ref.alias() as string];
    }

    public getSupportedFileType(): File.FileType[] {
        if (compatibility === undefined) {
            throw new Error(`Moudle "compatibility" isn't loaded yet`);
        }
        if (compatibility.Files[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.Files list`,
            );
        }
        return compatibility.Files[this.ref.alias() as string];
    }

    public isSdeSupported(): boolean {
        if (compatibility === undefined) {
            throw new Error(`Moudle "compatibility" isn't loaded yet`);
        }
        if (compatibility.SDESupport[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.SDESupport list`,
            );
        }
        return compatibility.SDESupport[this.ref.alias() as string];
    }
}
