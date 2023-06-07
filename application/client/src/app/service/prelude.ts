import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Services } from '@service/ilc';

@SetupService(services['prelude'])
export class Service extends Implementation {
    protected services!: Services;

    public override ready(): Promise<void> {
        this.services = ilc.services(this.getName(), this.log());
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const prelude = register(new Service());
