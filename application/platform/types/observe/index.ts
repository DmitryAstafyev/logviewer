import { unique } from '../../env/sequence';
import { Configuration as Base } from './configuration';

import * as Parser from './parser';
import * as Origin from './origin';
import * as Sde from './sde';

export * as Parser from './parser';
export * as Origin from './origin';
export * as Types from './types';

export { IList, IOriginDetails } from './description';

export interface IObserve {
    origin: Origin.IConfiguration;
    parser: Parser.IConfiguration;
}

export class Observe
    extends Base<IObserve, Observe, undefined>
    implements Sde.Support, Parser.Support
{
    static new(): Observe {
        return new Observe({
            parser: {
                Dlt: Parser.Dlt.Configuration.initial(),
            },
            origin: {
                Stream: Origin.Stream.Configuration.initial(),
            },
        });
    }

    static alias(): undefined {
        return undefined;
    }

    static initial(): IObserve {
        return {
            origin: Origin.Configuration.initial(),
            parser: Parser.Configuration.initial(),
        };
    }

    static validate(configuration: IObserve): Error | IObserve {
        let error: Error | unknown = Origin.Configuration.validate(configuration.origin);
        if (error instanceof Error) {
            return error;
        }
        error = Parser.Configuration.validate(configuration.parser);
        return error instanceof Error ? error : configuration;
    }

    public readonly uuid: string = unique();
    public readonly childs: Observe[] = [];
    public readonly parent: Observe | undefined;
    public readonly origin: Origin.Configuration;
    public readonly parser: Parser.Configuration;

    constructor(observe: IObserve) {
        super(observe);
        this.origin = new Origin.Configuration(observe.origin);
        this.parser = new Parser.Configuration(observe.parser);
    }

    public override isSdeSupported(): boolean {
        return this.origin.isSdeSupported();
    }

    public getSupportedParsers(): Parser.Reference[] {
        return this.origin.getSupportedParsers();
    }
}
