import { Observe, Parser } from '@platform/types/observe/index';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subjects, Subject } from '@platform/env/subscription';
// import { error } from '@platform/log/utils';
// import { File } from '@platform/types/files';

import * as Streams from '@platform/types/observe/origin/stream/index';
import * as Origin from '@platform/types/observe/origin/index';

export class State {
    public parsers: Parser.Reference[] = [];
    public parser: Parser.Protocol | undefined;
    public streams: Streams.Reference[] = [];
    public stream: Streams.Source | undefined;
    public updates: Subjects<{
        parser: Subject<void>;
        stream: Subject<void>;
    }> = new Subjects({
        parser: new Subject<void>(),
        stream: new Subject<void>(),
    });

    constructor(
        protected readonly ref: IlcInterface & ChangesDetector,
        public readonly observe: Observe,
    ) {
        this.update().stream();
        this.update().parser();
    }

    public destroy() {
        this.updates.destroy();
    }

    public update(): {
        stream(): void;
        parser(): void;
    } {
        return {
            stream: (): void => {
                const prev = this.stream;
                if (this.observe.origin.configuration.Stream === undefined) {
                    this.streams = [];
                    this.stream = undefined;
                } else {
                    const current = this.stream;
                    this.streams = this.observe.parser.getSupportedStream();
                    this.stream =
                        current !== undefined &&
                        this.streams.find((p) => p.alias() === current) !== undefined
                            ? current
                            : this.streams[0].alias();
                }
                this.ref.markChangesForCheck();
                prev !== this.stream && this.updates.get().stream.emit();
            },
            parser: (): void => {
                const current = this.parser;
                this.parsers = this.observe.origin.getSupportedParsers();
                this.parser =
                    current !== undefined &&
                    this.parsers.find((p) => p.alias() === current) !== undefined
                        ? current
                        : this.parsers[0].alias();
                this.ref.markChangesForCheck();
                current !== this.parser && this.updates.get().parser.emit();
            },
        };
    }

    public change(): {
        stream(): void;
        parser(): void;
    } {
        return {
            stream: (): void => {
                if (this.stream === undefined) {
                    this.ref.log().error(`Stream cannot be changed, because it's undefined`);
                    return;
                }
                const instance = this.observe.origin.instance;
                if (!(instance instanceof Origin.Stream.Configuration)) {
                    this.ref.log().error(`Stream cannot be changed, because origin isn't Stream`);
                    return;
                }
                instance.change(Streams.getByAlias(this.stream));
                this.updates.get().stream.emit();
                this.update().parser();
            },
            parser: (): void => {
                if (this.parser === undefined) {
                    this.ref.log().error(`Parser cannot be changed, because it's undefined`);
                    return;
                }
                this.observe.parser.change(Parser.getByAlias(this.parser));
                this.updates.get().parser.emit();
                this.update().stream();
            },
        };
    }
}
