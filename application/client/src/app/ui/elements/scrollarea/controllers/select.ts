import { Frame } from './frame';
import { Subject, Subjects } from '@platform/env/subscription';
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
        start(event: MouseEvent): void;
        select(event: MouseEvent): void;
        finish(): void;
    } {
        return {
            start: (event: MouseEvent): void => {
                this.selection?.destroy();
                this.selection = CurrentSelection.create(this.holder, event);
                if (this.selection === undefined) {
                    return;
                }
                this.subjects.get().start.emit();
            },
            select: (event: MouseEvent): void => {
                this.selection?.move(event);
            },
            finish: (): void => {
                this.subjects.get().finish.emit();
            },
        };
    }
}
