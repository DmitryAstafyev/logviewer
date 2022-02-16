
export interface IPluginsInstallRequest {
    name: string;
    version?: string;
}

export class PluginsInstallRequest {
    public static signature: string = 'PluginsInstallRequest';
    public signature: string = PluginsInstallRequest.signature;

    public name: string;
    public version?: string;

    constructor(params: IPluginsInstallRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        this.name = params.name;
        this.version = params.version;
    }
}
