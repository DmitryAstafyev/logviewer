import { Frame, ChangesInitiator } from './frame';
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

    public handlers(event: MouseEvent | undefined = undefined): {
        start(): void;
        select(): void;
        finish(): void;
        up(): void;
        down(): void;
    } {
        return {
            start: (): void => {
                if (event === undefined) {
                    return;
                }
                this.selection?.destroy();
                this.selection = CurrentSelection.create(this.frame, this.holder, event);
                console.log(
                    `>>>>>>>>>>>>>>>>>>> SELECTION IS: ${
                        this.selection !== undefined ? 'created' : 'NOT created'
                    }`,
                );
                if (this.selection === undefined) {
                    return;
                }
                this.subjects.get().start.emit();
            },
            select: (): void => {
                if (event === undefined) {
                    return;
                }
                this.selection?.move().view(event, false);
            },
            finish: (): void => {
                if (event === undefined) {
                    return;
                }
                this.selection?.move().view(event, true);
                this.subjects.get().finish.emit();
            },
            up: (): void => {
                this.frame.offsetToByRows(-1, ChangesInitiator.Selecting);
                this.selection?.move().focusTo(this.frame.get().from);
            },
            down: (): void => {
                this.frame.offsetToByRows(1, ChangesInitiator.Selecting);
                this.selection?.move().focusTo(this.frame.get().to);
            },
        };
    }

    public check() {
        this.selection?.check();
    }

    public render() {
        this.selection?.render();
    }
}
