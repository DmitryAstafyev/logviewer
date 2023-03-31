import { CancelablePromise } from 'platform/env/promise';
import { Base } from '../native/native.jobs';

export class Jobs extends Base {
    public static async create(): Promise<Jobs> {
        const instance = new Jobs();
        await instance.init();
        return instance;
    }

    // This method is used for testing
    public cancelTest(num_a: number, num_b: number, seq?: number): CancelablePromise<number> {
        const sequence = seq === undefined ? this.sequence() : seq;
        const job: CancelablePromise<number> = this.execute(
            // We should define validation callback. As argument it takes result of job,
            // which should be checked for type. In case it type is correct, callback
            // should return true
            (res: number): boolean => {
                return typeof res === 'number';
            },
            // As second argument of executor we should provide native function of job.
            this.native.jobCancelTest(sequence, num_a, num_b),
            // Sequence of job
            sequence,
            // Alias of job for logs
            'cancelTest',
        );
        return job;
    }

    public listContent(path: string): CancelablePromise<string> {
        const sequence = this.sequence();
        const job: CancelablePromise<string> = this.execute(
            (res: string): boolean => {
                return typeof res === 'string';
            },
            this.native.listFolderContent(sequence, path),
            sequence,
            'listContent',
        );
        return job;
    }
}
