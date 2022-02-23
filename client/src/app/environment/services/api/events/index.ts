import { Transport, RequestWrapper, wrapResponseConstructor } from '../transport';
import { ServiceAPI } from '@chipmunk/service/service.api';
import { Observable, Subscription } from 'rxjs';

export class APIEventBase<E extends {}> {
	readonly _eventBodyConstructor: new (...args: any[]) => E;

	constructor(eventBodyConstructor: new (...args: any[]) => E) {
		this._eventBodyConstructor = eventBodyConstructor;
	}

	public subscribe(handler: (event: E) => void): Promise<Subscription> {
		const transport: Error | Transport = ServiceAPI.getTransport();
		if (transport instanceof Error) {
			throw transport;
		}
		const signature = (this as any).getSignature();
		if (typeof signature !== 'string' || signature.trim() === '') {
			throw new Error(`No event signature has been found.`);
		}
		return new Promise((resolve, reject) => {
			transport
				.subscribe(signature, this._eventBodyConstructor)
				.then((observable: Observable<any>) => {
					resolve(observable.subscribe(handler));
				})
				.catch(reject);
		});
	}
}

export function APIEvent<T extends { new (...args: any[]): any }>(constructor: T) {
	if (typeof constructor.prototype.subscribe !== 'function') {
		throw new Error(`Cannot create event holder for "${constructor.name}" because no method "subscribe" has been found. \n
Make sure, class "APIEventBase" was extended.\n
@Request\n
class YourEventHolder extended APIEventBase {\n
	...\n
}`);
	}
	return class extends constructor {
		__requestName: string = constructor.name;
		constructor(...args: any[]) {
			super(...args);
			if (args.length !== 1) {
				throw new Error(
					`Event holder constructor should have one argument:\n- event body constructor reference`,
				);
			}
		}
		public getSignature(): string {
			return this.__requestName;
		}
	};
}
