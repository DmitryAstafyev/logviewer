import { Frame, ChangesInitiator } from './frame';
import { Subject, Subscription, Subjects } from '@platform/env/subscription';

import { CurrentSelection } from './select.selection';

export class SelectionTracker {
    protected readonly frame!: Frame;
    protected readonly holder!: HTMLElement;
    protected selection: CurrentSelection | undefined;

    public subjects: Subjects<{
        start: Subject<void>;
        finish: Subject<void>;
    }> = new Subjects({
        start: new Subject(),
        finish: new Subject(),
    });

    constructor(holder: HTMLElement, frame: Frame) {
        this.holder = holder;
        this.frame = frame;
    }

    public destroy() {
        this.selection?.destroy();
        this.subjects.destroy();
    }

    public handlers(): {
        start(): void;
        select(): void;
        finish(): void;
    } {
        return {
            start: (): void => {
                this.selection?.destroy();
                this.selection = CurrentSelection.create(this.holder);
                if (this.selection === undefined) {
                    return;
                }
                console.log(`>>>>>>>>>>>>>>>>>>>>>> CREATED`);
                console.log(this.selection);
                this.subjects.get().start.emit();
            },
            select: (): void => {},
            finish: (): void => {
                this.subjects.get().finish.emit();
            },
        };
    }
}
