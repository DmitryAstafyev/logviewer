import { IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subject } from '@platform/env/subscription';

export class Base<T> {
    protected ref!: IlcInterface & ChangesDetector;
    public updated: Subject<void> = new Subject<void>();

    constructor(public configuration: T) {}

    public destroy() {
        this.updated.destroy();
    }

    public bind(ref: IlcInterface & ChangesDetector) {
        this.ref = ref;
    }

    public change(configuration: T) {
        this.configuration = configuration;
        this.updated.emit();
        this.ref.markChangesForCheck();
    }
}
