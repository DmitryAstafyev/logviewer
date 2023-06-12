import * as $ from './index';

class Factory<T> {
    public observe: $.Observe = $.Observe.new();

    public protocol(protocol: $.Parser.Protocol): T {
        this.observe.parser.change(
            (() => {
                switch (protocol) {
                    case $.Parser.Protocol.Dlt:
                        return new $.Parser.Dlt.Configuration($.Parser.Dlt.Configuration.initial());
                    case $.Parser.Protocol.SomeIp:
                        return new $.Parser.SomeIp.Configuration(
                            $.Parser.SomeIp.Configuration.initial(),
                        );
                    case $.Parser.Protocol.Text:
                        return new $.Parser.Text.Configuration(
                            $.Parser.Text.Configuration.initial(),
                        );
                }
            })(),
        );
        return this as unknown as T;
    }

    public parser(): {
        dlt(configuration?: $.Parser.Dlt.IConfiguration): T;
        someip(configuration?: $.Parser.SomeIp.IConfiguration): T;
        text(): T;
    } {
        return {
            dlt: (configuration?: $.Parser.Dlt.IConfiguration): T => {
                this.observe.parser.change(
                    new $.Parser.Dlt.Configuration(
                        configuration === undefined
                            ? $.Parser.Dlt.Configuration.initial()
                            : configuration,
                    ),
                );
                return this as unknown as T;
            },
            someip: (configuration?: $.Parser.SomeIp.IConfiguration): T => {
                this.observe.parser.change(
                    new $.Parser.SomeIp.Configuration(
                        configuration === undefined
                            ? $.Parser.SomeIp.Configuration.initial()
                            : configuration,
                    ),
                );
                return this as unknown as T;
            },
            text: (): T => {
                this.observe.parser.change(new $.Parser.Text.Configuration(null));
                return this as unknown as T;
            },
        };
    }
}

export class File extends Factory<File> {
    static FileType = $.Types.File.FileType;

    public file(filename: string): File {
        this.observe.origin.change(
            new $.Origin.File.Configuration($.Origin.File.Configuration.initial())
                .set()
                .filename(filename),
        );
        return this;
    }

    public type(type: $.Types.File.FileType): File {
        if (!(this.observe.origin.instance instanceof $.Origin.File.Configuration)) {
            throw new Error(`Given observe object doesn't have File origin`);
        }
        this.observe.origin.instance.set().type(type);
        return this;
    }
}

export class Concat extends Factory<Concat> {
    static FileType = $.Types.File.FileType;

    public files(files: string[]): Concat {
        this.observe.origin.change(
            new $.Origin.Concat.Configuration($.Origin.Concat.Configuration.initial())
                .set()
                .files(files),
        );
        return this;
    }

    public type(type: $.Types.File.FileType): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().defaults(type);
        return this;
    }

    public push(filename: string, type: $.Types.File.FileType): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().push(filename, type);
        return this;
    }

    public remove(filename: string): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().remove(filename);
        return this;
    }
}

export class Stream extends Factory<Stream> {
    public process(configuration?: $.Origin.Stream.Stream.Process.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Process.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Process.Configuration.initial(),
            ),
        );
        return this;
    }
    public serial(configuration?: $.Origin.Stream.Stream.Serial.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Serial.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Serial.Configuration.initial(),
            ),
        );
        return this;
    }
    public tcp(configuration?: $.Origin.Stream.Stream.Tcp.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Tcp.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Tcp.Configuration.initial(),
            ),
        );
        return this;
    }
    public udp(configuration?: $.Origin.Stream.Stream.Udp.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Udp.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Udp.Configuration.initial(),
            ),
        );
        return this;
    }
}
