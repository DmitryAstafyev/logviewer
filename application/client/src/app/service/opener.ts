import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Services } from '@service/ilc';
import { Session } from './session/session';
import { File } from '@platform/types/files';
import { Observe } from '@platform/types/observe/index';
import { getRender } from '@schema/render/tools';
import { components } from '@env/decorators/initial';

@SetupService(services['opener'])
export class Service extends Implementation {
    protected services!: Services;

    public override ready(): Promise<void> {
        this.services = ilc.services(this.getName(), this.log());
        return Promise.resolve();
    }

    public configure(observe: Observe): void {
        const api = this.services.system.session.add().tab({
            name: observe.origin.desc().major,
            content: {
                factory: components.get('app-tabs-observe'),
                inputs: {
                    getTabApi: () => api,
                    observe,
                    done: (observe: Observe) => {
                        this.observe(observe).catch((err: Error) => {
                            this.log().error(`Fail to setup observe: ${err.message}`);
                        });
                    },
                },
            },
            active: true,
        });
    }

    public async observe(observe: Observe, session?: Session): Promise<void> {
        const render = getRender(observe);
        if (render instanceof Error) {
            throw render;
        }
        session =
            session !== undefined
                ? session
                : await this.services.system.session.add(true).empty(render);
        await session.stream.observe().start(observe);
    }

    public multiple(files: File[]) {
        const api = this.services.system.session.add().tab({
            name: 'Multiple Files',
            content: {
                factory: components.get('app-tabs-source-multiple-files'),
                inputs: {
                    getTabApi: () => api,
                    files,
                    done: (observe: Observe) => {
                        this.observe(observe).catch((err: Error) => {
                            this.log().error(`Fail to setup observe: ${err.message}`);
                        });
                    },
                },
            },
            active: true,
            closable: true,
        });
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
