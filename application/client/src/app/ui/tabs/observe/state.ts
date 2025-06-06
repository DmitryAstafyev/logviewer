import { IList, Observe, Parser } from '@platform/types/observe';
import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subjects, Subject, Subscriber } from '@platform/env/subscription';
import { File } from '@platform/types/files';
import { bytesToStr } from '@env/str';
import { Action } from './action';
import { TabControls } from '@service/session';
import { Notification } from '@ui/service/notifications';
import { Locker, Level } from '@ui/service/lockers';
import { PluginEntity } from '@platform/types/bindings';

import * as StreamOrigin from '@platform/types/observe/origin/stream/index';
import * as Origin from '@platform/types/observe/origin/index';
import * as FileOrigin from '@platform/types/observe/origin/file';
import * as ConcatOrigin from '@platform/types/observe/origin/concat';
import * as Parsers from '@platform/types/observe/parser';
import * as Streams from '@platform/types/observe/origin/stream/index';
import { plugins } from '@service/plugins';

export interface IApi {
    finish(observe: Observe): Promise<void>;
    cancel(): void;
    tab(): TabControls;
}

export interface IInputs {
    observe: Observe;
    api: IApi;
}

export class WrappedParserRef {
    constructor(protected readonly inner: Parser.Reference | PluginEntity) {}

    private as_embedded(): Parser.Reference | undefined {
        if (typeof (this.inner as any)['alias'] === 'function') {
            return this.inner as Parser.Reference;
        }
        return undefined;
    }

    private as_plugin(): PluginEntity | undefined {
        if (typeof (this.inner as any)['dir_path'] === 'string') {
            return this.inner as PluginEntity;
        }
        return undefined;
    }

    public desc(): IList {
        const embedded = this.as_embedded();
        if (embedded !== undefined) {
            return embedded.desc();
        }
        const plugin = this.as_plugin();
        if (plugin !== undefined) {
            return {
                major: plugin.metadata.title,
                minor: plugin.metadata.description
                    ? plugin.metadata.description
                    : plugin.metadata.title,
                icon: undefined,
            };
        }
        throw new Error(`Fail to process ${JSON.stringify(this.inner)}`);
    }
    public alias(): Parser.Protocol | string {
        const embedded = this.as_embedded();
        if (embedded !== undefined) {
            return embedded.alias();
        }
        const plugin = this.as_plugin();
        if (plugin !== undefined) {
            return plugin.dir_path;
        }
        throw new Error(`Fail to process ${JSON.stringify(this.inner)}`);
    }
}

export class State extends Subscriber {
    public parser: Parser.Protocol | string | undefined;
    public parsers: { ref: WrappedParserRef; disabled: boolean }[] = [];
    public streams: { ref: StreamOrigin.Reference; disabled: boolean }[] = [];
    public file: File | undefined;
    public concat: File[] | undefined;
    public stream: StreamOrigin.Source | undefined;
    public size: string | undefined;
    public action: Action = new Action();
    public updates: Subjects<{
        parser: Subject<void>;
        stream: Subject<void>;
    }> = new Subjects({
        parser: new Subject<void>(),
        stream: new Subject<void>(),
    });

    constructor(
        protected readonly ref: IlcInterface & ChangesDetector & { api: IApi },
        public readonly observe: Observe,
    ) {
        super();
        this.update().stream();
        this.update().files();
        this.update().parser();
        this.update().validate();
        this.update().action();
        this.register(
            this.action.subjects.get().updated.subscribe(() => {
                this.ref.markChangesForCheck();
            }),
            this.action.subjects.get().apply.subscribe(() => {
                this.finish();
            }),
            this.observe.subscribe(() => {
                this.update().validate();
                this.update().action();
            }),
        );
    }

    public destroy() {
        this.updates.destroy();
        this.unsubscribe();
    }

    public finish() {
        if (this.action.disabled) {
            return;
        }
        this.action.applied();
        this.ref.api.finish(this.observe).catch((err: Error) => {
            this.ref
                .ilc()
                .services.ui.lockers.lock(
                    new Locker(true, err.message).set().type(Level.error).spinner(false).end(),
                    {
                        closable: true,
                        closeOnKey: 'Escape',
                        closeOnBGClick: true,
                    },
                );
            this.ref.ilc().services.ui.notifications.store(
                new Notification({
                    message: err.message,
                    actions: [],
                }),
            );
        });
    }

    public cancel() {
        this.ref.api.cancel();
    }

    public getParser(): {
        embedded(): Parser.Protocol | undefined;
        pluginPath(): string | undefined;
    } {
        return {
            embedded: (): Parser.Protocol | undefined => {
                if (!this.parser) {
                    return undefined;
                }
                const embedded = Parser.tryAsEmbedded(this.parser);
                return embedded ? embedded : undefined;
            },
            pluginPath: (): string | undefined => {
                if (!this.parser) {
                    return undefined;
                }
                return Parser.tryAsEmbedded(this.parser) ? undefined : (this.parser as string);
            },
        };
    }

    public update(): {
        stream(): void;
        files(): void;
        parser(): void;
        validate(): void;
        action(): void;
    } {
        return {
            stream: (): void => {
                const prev = this.stream;
                const nature = this.observe.origin.nature();
                if (
                    nature instanceof Origin.File.Configuration ||
                    nature instanceof Origin.Concat.Configuration ||
                    nature instanceof Origin.Plugin.Configuration
                ) {
                    this.streams = [];
                    this.stream = undefined;
                } else {
                    this.streams = this.observe.parser.getSupportedStream().map((ref) => {
                        return { ref, disabled: false };
                    });
                    if (this.stream === undefined) {
                        this.stream = nature.alias();
                    } else {
                        const current = this.stream;
                        this.stream =
                            current !== undefined &&
                            this.streams.find((p) => p.ref.alias() === current) !== undefined
                                ? current
                                : this.streams[0].ref.alias();
                    }
                    this.streams.push(
                        ...Streams.getAllRefs()
                            .filter(
                                (ref) =>
                                    this.streams.find((p) => p.ref.alias() === ref.alias()) ===
                                    undefined,
                            )
                            .map((ref) => {
                                return { ref, disabled: true };
                            }),
                    );
                }
                this.ref.markChangesForCheck();
                prev !== this.stream && this.updates.get().stream.emit();
            },
            files: (): void => {
                const instance = this.observe.origin.instance;
                const files: string[] | undefined =
                    instance instanceof FileOrigin.Configuration
                        ? [instance.filename()]
                        : instance instanceof ConcatOrigin.Configuration
                        ? instance.files()
                        : undefined;
                if (files === undefined) {
                    return;
                }
                this.ref
                    .ilc()
                    .services.system.bridge.files()
                    .getByPath(files)
                    .then((files: File[]) => {
                        this.size = bytesToStr(
                            files
                                .map((f) => f.stat.size)
                                .reduce((partialSum, a) => partialSum + a, 0),
                        );
                        if (instance instanceof FileOrigin.Configuration) {
                            if (files.length !== 1) {
                                this.ref
                                    .log()
                                    .error(
                                        `Expecting only 1 file stats. Has been gotten: ${files.length}`,
                                    );
                                return;
                            }
                            this.file = files[0];
                        } else if (instance instanceof ConcatOrigin.Configuration) {
                            this.concat = files;
                        }
                    })
                    .catch((err: Error) => {
                        this.ref
                            .log()
                            .error(
                                `Fail to get stats for files: ${files.join(', ')}: ${err.message}`,
                            );
                    })
                    .finally(() => {
                        this.ref.markChangesForCheck();
                    });
            },
            parser: (): void => {
                const current = this.parser;
                this.parsers = [
                    ...this.observe.origin
                        .getSupportedParsers()
                        .filter((ref) => ref.alias() !== Parser.Protocol.Plugin)
                        .map((ref) => {
                            return { ref: new WrappedParserRef(ref), disabled: false };
                        }),
                    ...plugins
                        .list()
                        .preload()
                        .filter((ref) => ref.plugin_type === 'Parser')
                        .map((ref) => {
                            return { ref: new WrappedParserRef(ref), disabled: false };
                        }),
                ];
                this.parser =
                    current !== undefined &&
                    this.parsers.find((p) => p.ref.alias() === current) !== undefined
                        ? current
                        : this.parsers[0].ref.alias();
                this.parsers.push(
                    ...Parsers.getAllRefs()
                        .filter(
                            (ref) =>
                                this.parsers.find((p) => p.ref.alias() === ref.alias()) ===
                                    undefined && ref.inited(),
                        )
                        .map((ref) => {
                            return { ref: new WrappedParserRef(ref), disabled: true };
                        }),
                );
                this.ref.markChangesForCheck();
                current !== this.parser && this.updates.get().parser.emit();
            },
            validate: (): void => {
                const error = this.observe.validate();
                this.action.setDisabled(error instanceof Error);
            },
            action: (): void => {
                this.action.setCaption(this.observe.origin.desc().action);
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
                instance.change(StreamOrigin.getByAlias(this.stream));
                this.updates.get().stream.emit();
                this.update().parser();
            },
            parser: (): void => {
                if (this.parser === undefined) {
                    this.ref.log().error(`Parser cannot be changed, because it's undefined`);
                    return;
                }
                const alias = Parser.tryAsEmbedded(this.parser);
                this.observe.parser.change(
                    Parser.getByAlias(alias ? alias : Parser.Protocol.Plugin),
                );
                this.updates.get().parser.emit();
                this.update().stream();
            },
        };
    }
}
