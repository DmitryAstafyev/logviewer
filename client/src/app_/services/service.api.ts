import { Transport } from './api/transport';
import { Tauri } from './api/transport/tauri';

class ServiceAPI {
	private _transport: Transport | undefined;

	constructor() {
		this._transport = new Tauri();
	}

	public getTransport(): Error | Transport {
		return this._transport === undefined
			? new Error(`No available API transport`)
			: this._transport;
	}
}

const service = new ServiceAPI();
export { service as ServiceAPI };
