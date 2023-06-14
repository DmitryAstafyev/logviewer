import { Session } from '../session/session';

export class Context {
    public session: Session | undefined;

    public bind(session: Session): Context {
        this.session = session;
        return this;
    }
}
