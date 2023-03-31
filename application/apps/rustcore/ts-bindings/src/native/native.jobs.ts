/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Logs from '../util/logging';

import { CancelablePromise } from 'platform/env/promise';
import { error } from 'platform/env/logger';
import { getNativeModule } from '../native/native';

export abstract class JobsNative {
    public abstract abort(sequence: number): Promise<void>;

    public abstract init(): Promise<void>;

    public abstract destroy(): Promise<void>;

    public abstract jobCancelTest(sequence: number, num_a: number, num_b: number): Promise<string>;

    public abstract listFolderContent(sequence: number, path: string): Promise<string>;
}

interface Job {
    started: number;
    alias: string;
}

export class Queue {
    protected jobs: Map<number, Job> = new Map();
    private _sequence: number = 0;

    public add(sequence: number, alias: string): void {
        this.jobs.set(sequence, {
            started: Date.now(),
            alias,
        });
    }

    public remove(sequence: number): void {
        this.jobs.delete(sequence);
    }

    public sequence(): number {
        return ++this._sequence;
    }
}

export type JobResult<T> = { Finished: T } | 'Cancelled';

enum State {
    destroyed,
    destroying,
    inited,
    created,
}

export class Base {
    protected readonly logger: Logs.Logger = Logs.getLogger(`Jobs`);
    protected readonly native: JobsNative;
    protected readonly queue: Queue = new Queue();

    private _state: State = State.created;

    constructor() {
        this.native = new (getNativeModule().UnboundJobs)() as JobsNative;
        this.logger.debug(`Rust Jobs native session is created`);
    }

    public async init(): Promise<Base> {
        return new Promise((resolve, reject) => {
            this.native
                .init()
                .then(() => {
                    this.logger.debug(`Rust Jobs native session is inited`);
                    this._state = State.inited;
                    resolve(this);
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to init Jobs session: ${err instanceof Error ? err.message : err}`,
                    );
                    reject(err);
                });
        });
    }

    public async destroy(): Promise<void> {
        if (this._state !== State.inited) {
            return Promise.reject(new Error(`Session isn't inited`));
        }
        this._state = State.destroying;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.logger.error(`Timeout error. Session wasn't closed in 5 sec.`);
                reject(new Error(`Timeout error. Session wasn't closed in 5 sec.`));
            }, 5000);
            this.native
                .destroy()
                .then(() => {
                    this.logger.debug(`Session has been destroyed`);
                    resolve();
                })
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to close session due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    reject(err);
                })
                .finally(() => {
                    this._state = State.destroyed;
                    clearTimeout(timeout);
                });
        });
    }

    protected async abort(sequence: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.native
                .abort(sequence)
                .then(resolve)
                .catch((err: Error) => {
                    this.logger.error(
                        `Fail to abort operation due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    );
                    reject(err);
                });
        });
    }

    protected sequence(): number {
        return this.queue.sequence();
    }

    protected execute<T>(
        validate: (result: T) => boolean,
        task: Promise<string>,
        sequence: number,
        alias: string,
    ): CancelablePromise<T> {
        return new CancelablePromise((resolve, reject, cancel, refCancel, self) => {
            if (this._state !== State.inited) {
                return reject(new Error(`Session isn't inited`));
            }
            this.queue.add(sequence, alias);
            refCancel(() => {
                this.abort(sequence).catch((err: Error) => {
                    this.logger.error(`Fail to cancel ${error(err)}`);
                });
            });
            task.then((income: string) => {
                try {
                    const result: JobResult<T> = JSON.parse(income);
                    if (result === 'Cancelled') {
                        cancel();
                    } else if (validate(result.Finished)) {
                        resolve(result.Finished);
                    } else {
                        reject(new Error(`Fail to parse results: ${income}`));
                    }
                } catch (e) {
                    reject(new Error(`Fail to parse results (${income}): ${error(e)}`));
                }
            })
                .catch((err: Error) => {
                    this.logger.error(`Fail to do "some" operation due error: ${error(err)}`);
                    reject(new Error(error(err)));
                })
                .finally(() => {
                    this.queue.remove(sequence);
                });
        });
    }
}
