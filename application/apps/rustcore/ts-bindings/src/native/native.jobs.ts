/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Logs from '../util/logging';

import { RustSessionRequiered } from './native.session.required';
import { TEventEmitter } from '../provider/provider.general';
import { Computation } from '../provider/provider';
import {
    IFilter,
    IGrabbedElement,
    IExtractDTFormatResult,
    IExtractDTFormatOptions,
    Observe,
} from '../interfaces/index';
import { getNativeModule } from './native';
import { EFileOptionsRequirements } from '../api/executors/session.stream.observe.executor';
import { Type, Source, NativeError } from '../interfaces/errors';
import { v4 as uuidv4 } from 'uuid';
import { getValidNum } from '../util/numbers';
import { IRange } from 'platform/types/range';
import { ObservedSourceLink } from 'platform/types/observe';
import { IndexingMode } from 'platform/types/content';

export type RustSessionConstructorImpl<T> = new (
    uuid: string,
    provider: Computation<any, any, any>,
    cb: (err: Error | undefined) => void,
) => T;
export type TCanceler = () => void;

// Create abstract class to declare available methods
export abstract class RustSession extends RustSessionRequiered {
    constructor(uuid: string, provider: Computation<any, any, any>) {
        super();
    }

    public abstract override destroy(): Promise<void>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     *
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabStreamChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    public abstract grabStreamRanges(ranges: IRange[]): Promise<IGrabbedElement[]>;

    public abstract grabIndexed(start: number, len: number): Promise<IGrabbedElement[]>;

    public abstract setIndexingMode(mode: IndexingMode): Promise<void>;

    public abstract getIndexedLen(): Promise<number>;

    public abstract getAroundIndexes(
        position: number,
    ): Promise<{ before: number | undefined; after: number | undefined }>;

    public abstract expandBreadcrumbs(
        seporator: number,
        offset: number,
        above: boolean,
    ): Promise<void>;

    public abstract removeBookmark(row: number): Promise<void>;

    public abstract addBookmark(row: number): Promise<void>;

    public abstract setBookmarks(rows: number[]): Promise<void>;

    /**
     * Returns chunk of stream/session file.
     * @param start { number } row number of range's start
     * @param len { number } length of the chunk's range
     * @returns { string }
     * @error In case of incorrect range should return { NativeError }
     */
    public abstract grabSearchChunk(start: number, len: number): Promise<IGrabbedElement[]>;

    /**
     * TODO: @return needs interface. It should not be a string
     */
    public abstract grabMatchesChunk(start: number, len: number): string[] | NativeError;

    /**
     * Returns list of observed sources.
     * @returns { string }
     */
    public abstract getSourcesDefinitions(): Promise<ObservedSourceLink[]>;

    public abstract getUuid(): string;

    /**
     * Bind filters with current session. Rust core should break (stop) search (if it wasn't
     * finished before) and start new with defined filters. Search results should be stored
     * in search results file.
     * Search results would be requested with @method grabSearchChunk, which should return
     * whole rows with matches
     *
     * @param filters { IFilter[] } list of filters for session search
     * @returns { void }
     *
     * @error { NativeError }
     */
    public abstract setFilters(filters: IFilter[]): NativeError | string;

    /**
     * Returns a list of filters, which are bound with session
     * @returns { IFilter[] }
     *
     * @error { NativeError }
     */
    public abstract getFilters(): IFilter[] | NativeError;

    /**
     * Bind filters with current session. Rust core should break (stop) search of matches (if
     * it wasn't finished before) and start new with defined filters.
     * Results of search matches would be requested with @method grabMatchesChunk
     * @param filters { IFilter[] } list of filters for session search
     * @returns { void }
     *
     * @error { NativeError }
     */
    public abstract setMatches(filters: IFilter[]): NativeError | undefined;

    /**
     * Returns reference to option's type, which should be defined for @method append
     * Would be called each time before @method append
     * @param filename { string } full filename
     * @returns { EFileOptionsRequirements }
     */
    public abstract getFileOptionsRequirements(filename: string): EFileOptionsRequirements;

    /**
     * Returns length (count of rows) of session/stream file
     * @returns { nummber }
     */
    public abstract getStreamLen(): Promise<number>;

    /**
     * Returns length (count of rows) of search results stream
     * @returns { nummber }
     */
    public abstract getSearchLen(): Promise<number>;

    /**
     * Returns length (count of rows with matches) of getting matches in stream
     * @returns { nummber }
     */
    public abstract getMatchesLen(): number | NativeError;

    /**
     * Returns path to socket, which can be used to pass data into session stream
     * @returns { string }
     */
    public abstract getSocketPath(): string | NativeError;

    /**
     * Assigns session with the file. After the file was assigned, @method concat, @method merge cannot be used
     * and should return @error NativeError.
     * @param emitter { TEventEmitter } emitter to handle event related to lifecircle of this method only
     * @param filename { string } file, which should be assigned to session
     * @param options { TFileOptions } options to open file
     * @returns { string | NativeError } - callback, which can be called on NodeJS level to cancel
     * async operation. After TCanceler was called, @event destroy of @param emitter would be expected to
     * confirm cancelation.
     */
    public abstract observe(source: Observe.DataSource, operationUuid: string): Promise<void>;

    public abstract export(dest: string, ranges: IRange[], operationUuid: string): Promise<void>;

    public abstract exportRaw(dest: string, ranges: IRange[], operationUuid: string): Promise<void>;

    public abstract isRawExportAvailable(): Promise<boolean>;

    /**
     * This operation is sync.
     */
    public abstract extract(options: IExtractDTFormatOptions): IExtractDTFormatResult | NativeError;

    public abstract search(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract searchValues(filters: string[], operationUuid: string): Promise<void>;

    public abstract dropSearch(): Promise<boolean>;

    public abstract extractMatchesValues(filters: IFilter[], operationUuid: string): Promise<void>;

    public abstract getMap(
        operationUuid: string,
        datasetLength: number,
        from?: number,
        to?: number,
    ): Promise<string>;

    public abstract getNearestTo(
        operationUuid: string,
        positionInStream: number,
    ): Promise<{ index: number; position: number } | undefined>;

    public abstract sendIntoSde(targetOperationUuid: string, jsonStrMsg: string): Promise<string>;

    public abstract abort(
        selfOperationUuid: string,
        targetOperationUuid: string,
    ): NativeError | undefined;

    public abstract setDebug(debug: boolean): Promise<void>;

    public abstract getOperationsStat(): Promise<string>;

    public abstract sleep(operationUuid: string, duration: number): Promise<void>;

    // public abstract sleepUnblock(duration: number): Promise<void>;
}

export abstract class JobsNative {
    public abstract abort(operationUuid: string): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract some(uuid: (uuid: string) => void, num: number): Promise<number>;
}

export class Jobs {
    private readonly _logger: Logs.Logger = Logs.getLogger(`Jobs`);
    private readonly _native: JobsNative;

    constructor() {
        this._native = new (getNativeModule().Jobs)() as JobsNative;
        this._logger.debug(`Rust Jobs native session is created`);
    }

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._native
                .init()
                .then(() => {
                    this._logger.debug(`Rust Jobs native session is inited`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to init Jobs session: ${err instanceof Error ? err.message : err}`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }

    public async destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._logger.error(`Timeout error. Session wasn't closed in 5 sec.`);
                reject(new Error(`Timeout error. Session wasn't closed in 5 sec.`));
            }, 5000);
            this._native
                .destroy()
                .then(() => {
                    this._logger.debug(`Session has been destroyed`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to close session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                })
                .finally(() => {
                    clearTimeout(timeout);
                });
        });
    }

    public async abort(uuid: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._native
                .abort(uuid)
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to abort operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }

    public async some(uuid: (uuid: string) => void, num: number): Promise<number> {
        return new Promise((resolve, reject) => {
            this._native
                .some(uuid, num)
                .then(resolve)
                .catch((err: Error) => {
                    this._logger.error(
                        `Fail to do "some" operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    console.log(err);
                    reject(err);
                });
        });
    }
}
