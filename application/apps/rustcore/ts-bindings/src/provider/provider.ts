import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { TEventData, TEventEmitter, IEventData } from './provider.general';

export abstract class Computation<TEvents, IEventsSignatures, IEventsInterfaces> {
    private _destroyed: boolean = false;
    private readonly _uuid: String;
    private readonly _tracking: {
        subjects: {
            unsupported: Events.Subject<string>,
            error: Events.Subject<string>,
        },
        stat: {
            unsupported: string[],
            error: string[],
        },
        track: boolean,
        store: boolean,
    } = {
        subjects: {
            unsupported: new Events.Subject<string>(),
            error: new Events.Subject<string>(),
        },
        stat: {
            unsupported: [],
            error: [],
        },
        track: false,
        store: false,
    };
    public readonly logger: Logs.Logger;

    constructor(uuid: string) {
        this._uuid = uuid;
        this._emitter = this._emitter.bind(this);
        this.logger = Logs.getLogger(`${this.getName()}: ${uuid}`);
    }

    public destroy(): Promise<void> {
        if (this._destroyed) {
            this.logger.warn(`Computation (${this._uuid}) is already destroying or destroyed`);
        } else {
            this._destroy();
        }
        return Promise.resolve();
    }

    public abstract getName(): string;

    public abstract getEvents(): TEvents;

    public abstract getEventsSignatures(): IEventsSignatures;

    public abstract getEventsInterfaces(): IEventsInterfaces;

    public debug(): {
        getEvents(): {
            unsupported: Events.Subject<string>,
            error: Events.Subject<string>,
        },
        isTracking(): boolean,
        isStored(): boolean,
        setTracking(value: boolean): void,
        setStoring(value: boolean): void,
        stat: {
            unsupported(): string[],
            error(): string[],
        },
        emit: {
            unsupported(msg: string): void,
            error(msg: string): void,
        },
    } {
        const self = this;
        return {
            getEvents() {
                return {
                    unsupported: self._tracking.subjects.unsupported,
                    error: self._tracking.subjects.error,
                }
            },
            isTracking(): boolean {
                return self._tracking.track;
            },
            isStored(): boolean {
                return self._tracking.store;
            },
            setTracking(value: boolean): void {
                self._tracking.track = value;
            },
            setStoring(value: boolean): void {
                self._tracking.store = value;
            },
            stat: {
                unsupported(): string[] {
                    return self._tracking.stat.unsupported;
                },
                error(): string[] {
                    return self._tracking.stat.error;
                },
            },
            emit: {
                unsupported(msg: string): void {
                    if (self._tracking.track) {
                        self._tracking.subjects.unsupported.emit(msg);
                    }
                    if (self._tracking.store) {
                        self._tracking.stat.unsupported.push(msg);
                    }
                },
                error(msg: string): void {
                    if (self._tracking.track) {
                        self._tracking.subjects.error.emit(msg);
                    }
                    if (self._tracking.store) {
                        self._tracking.stat.error.push(msg);
                    }
                },
            },
        }
    }

    /**
     * We are expecting to get from rust event data as JSON string. Required format is:
     * { [type: string]: string | undefined }
     * @param data {string}
     */
    private _emitter(data: TEventData) {
        function dataAsStr(data: TEventData): string {
            if (typeof data === 'string') {
                return `(defined as string): ${data}`;
            } else {
                return `(defined as object): keys: ${Object.keys(data).join(
                    ', ',
                )} / values: ${Object.keys(data)
                    .map((k) => JSON.stringify(data[k]))
                    .join(', ')}`;
            }
        }
        this.logger.debug(`Event from rust:\n\t${dataAsStr(data)}`);
        let event: Required<IEventData>;
        if (typeof data === 'string') {
            try {
                event = JSON.parse(data);
            } catch (e) {
                const msg: string = `Failed to parse rust event data due error: ${e}.\nExpecting type (JSON string): { [type: string]: string | undefined }, got: ${data}`;
                this.debug().emit.error(msg);
                this.logger.error(msg);
                return;
            }
        } else if (typeof data === 'object' && data !== null) {
            event = data;
        } else {
            const msg: string = `Unsupported format of event data: ${typeof data} / ${data}.\nExpecting type (JSON string): { [type: string]: string | undefined }`;
            this.debug().emit.error(msg);
            this.logger.error(msg);
            return;
        }
        if (typeof event === 'string') {
            this._emit(event, null);
        } else if (typeof event !== 'object' || event === null || Object.keys(event).length !== 1) {
            const msg: string = `Has been gotten incorrect event data: ${data}. No any props field found.\nExpecting type (JSON string): { [type: string]: string | undefined }`;
            this.debug().emit.error(msg);
            this.logger.error(msg);
        } else {
            const type: string = Object.keys(event)[0];
            const body: any = event[type];
            this._emit(type, body);
        }
    }

    private _destroy() {
        this._destroyed = true;
        // Unsubscribe all event listeners
        Object.keys(this.getEvents()).forEach((key: string) => {
            (this.getEvents() as any)[key].destroy();
        });
        Object.keys(this._tracking.subjects).forEach((key: string) => {
            (this._tracking.subjects as any)[key].destroy();
        });
        this._tracking.stat.error = [];
        this._tracking.stat.unsupported = [];
        this.logger.debug(`Provider has been destroyed.`);
    }

    private _emit(event: string, data: any) {
        // Callback (_emitter(data: TEventData)) is executed in rust scope.
        // It means if we will have some JS exception it will make rust crash.
        // To prevent it, we have to move event forward in separeted "JS-thread".
        // That's why here used timer with 0 delay.
        // Using of try { } catch() {} here isn't good idea as soon as it would not
        // allow to localize an issue
        setTimeout(() => {
            if ((this.getEventsSignatures() as any)[event] === undefined) {
                const msg: string = `Has been gotten unsupported event: "${event}".`;
                this.debug().emit.unsupported(msg);
                this.logger.error(msg);
            } else {
                const err: Error | undefined = Events.Subject.validate(
                    (this.getEventsInterfaces() as any)[event],
                    data,
                );
                if (err instanceof Error) {
                    this.logger.error(`Failed to parse event "${event}" due error: ${err.message}`);
                } else {
                    (this.getEvents() as any)[event].emit(data);
                }
            }
        }, 0);
    }

    public getEmitter(): TEventEmitter {
        return this._emitter;
    }
}