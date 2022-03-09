import { Transport } from './api/transport';
import { Tauri } from './api/transport/tauri';
import { Debug } from './api/transport/debug';
import { IService } from '@chipmunk/interfaces/interface.service';

class ServiceAPI implements IService {
	private _transport: Transport | undefined;

	constructor() {
		this._transport = new Tauri();
		// this._transport = new Debug();
	}

	public init(): Promise<void> {
		return Promise.resolve();
	}

	public getName(): string {
		return ServiceAPI.name;
	}

	public getTransport(): Error | Transport {
		return this._transport === undefined
			? new Error(`No available API transport`)
			: this._transport;
	}
}

const service = new ServiceAPI();
export { service as ServiceAPI };
