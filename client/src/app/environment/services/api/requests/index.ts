import { Transport, RequestWrapper, wrapResponseConstructor } from '../transport';
import { ServiceAPI } from '@chipmunk/service/service.api';

export class APIBase<Q extends {}, A extends {}> {
	readonly _request: Q;
	readonly _responseConstructor: new (...args: any[]) => A;

	constructor(request: Q, responseConstructor: new (...args: any[]) => A) {
		this._request = request;
		this._responseConstructor = responseConstructor;
	}

	public send(): Promise<A> {
		const transport: Error | Transport = ServiceAPI.getTransport();
		if (transport instanceof Error) {
			return Promise.reject(transport);
		}
		const signature = (this as any).getSignature();
		if (typeof signature !== 'string' || signature.trim() === '') {
			return Promise.reject(new Error(`No request signature has been found.`));
		}
		return transport.request(
			new RequestWrapper(signature, this._request),
			wrapResponseConstructor<A>(signature, this._responseConstructor),
		);
	}
}

export function API<T extends { new (...args: any[]): any }>(constructor: T) {
	if (typeof constructor.prototype.send !== 'function') {
		throw new Error(`Cannot create request for "${constructor.name}" because no method "send" has been found. \n
Make sure, class "APIBase" was extended.\n
@Request\n
class YourRequest extended APIBase {\n
	...\n
}`);
	}
	return class extends constructor {
		__requestName: string = constructor.name;
		constructor(...args: any[]) {
			super(...args);
			if (args.length !== 2) {
				throw new Error(
					`Request constructor should have two arguments:\n- request\n- response constructor reference`,
				);
			}
		}
		public getSignature(): string {
			return this.__requestName;
		}
	};
}
