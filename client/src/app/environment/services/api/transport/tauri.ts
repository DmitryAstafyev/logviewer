import { Transport, ResponseConstructor, IBodyRequirement, ISignatureRequirement } from './index';
import { Subject, Observable } from 'rxjs';
import { CancelablePromise } from '@chipmunk/utils/promise';
import { Logger } from '@chipmunk/logs/index';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import * as validator from '@chipmunk/utils/validtor';

interface IEventDesc {
	subject: Subject<any>;
	ref: new (...args: any[]) => any;
}
export class Tauri extends Transport {
	private _log: Logger = new Logger('TauriAPITransport');
	private _subjects: Map<string, IEventDesc> = new Map();

	constructor() {
		super();
		listen('api-event', this._eventsListener.bind(this));
	}

	public request<Request, Response>(
		request: Request & ISignatureRequirement & IBodyRequirement,
		responseConstructorRef: ResponseConstructor<Response> & ISignatureRequirement,
	): Promise<Response> {
		return new Promise((resolve, reject) => {
			this._log.info(
				`Sending ${request.getSignature()}; expected response: ${responseConstructorRef.getSignature()}`,
			);
			invoke('api', {
				request: {
					[request.getSignature()]: request.getBody(),
				},
			})
				.then((response: any) => {
					try {
						validator.isObject(response);
						const instance = new responseConstructorRef(
							validator.getObject(response[responseConstructorRef.getSignature()]),
						);
						this._log.info(
							`Response for ${request.getSignature()} has been gotten and successfully constructed.`,
						);
						resolve(instance);
					} catch (err) {
						this._log.error(
							`Fail to construct response for ${request.getSignature()}: ${
								err instanceof Error ? err.message : err
							}.`,
						);
						reject(
							err instanceof Error
								? err
								: new Error(`Fail to construct response: ${err}`),
						);
					}
				})
				.catch((err: Error | string) => {
					this._log.error(
						`Fail to get response for ${request.getSignature()}: ${
							err instanceof Error ? err.message : err
						}.`,
					);
					reject(err);
				});
		});
	}

	public operation<Request, Response>(
		operationUuid: string,
		request: Request & ISignatureRequirement & IBodyRequirement,
		responseConstructorRef: ResponseConstructor<Response> & ISignatureRequirement,
	): CancelablePromise<Response> {
		return new CancelablePromise((resolve, reject) => {
			reject(new Error(`Not implemented`));
		});
	}

	public abort(operationUuid: string): Promise<void> {
		return Promise.reject(new Error(`Not implemented`));
	}

	public notify<Notification>(notification: Notification): Promise<void> {
		return Promise.reject(new Error(`Not implemented`));
	}

	public subscribe(
		event: string,
		refEventConstructor: new (...args: any[]) => any,
	): Promise<Observable<any>> {
		if (typeof event !== 'string' || event.trim() === '') {
			return Promise.reject(new Error(`Event name should be a not-empty string`));
		}
		let desc: IEventDesc | undefined = this._subjects.get(event);
		if (desc === undefined) {
			desc = {
				subject: new Subject<any>(),
				ref: refEventConstructor,
			};
			this._subjects.set(event, desc);
		}
		return Promise.resolve(desc.subject.asObservable());
	}

	public subscribeDirect(
		event: string,
		refEventConstructor: new (...args: any[]) => any,
	): Observable<any> {
		if (typeof event !== 'string' || event.trim() === '') {
			throw new Error(`Event name should be a not-empty string`);
		}
		let desc: IEventDesc | undefined = this._subjects.get(event);
		if (desc === undefined) {
			desc = {
				subject: new Subject<any>(),
				ref: refEventConstructor,
			};
			this._subjects.set(event, desc);
		}
		return desc.subject.asObservable();
	}

	private _eventsListener(event: { event: string; payload: any }) {
		if (
			typeof event.payload !== 'object' ||
			event.payload === null ||
			Object.keys(event.payload).length !== 1
		) {
			this._log.warn(`Unexpected event's payload structure`);
			return;
		}
		const key = Object.keys(event.payload)[0];
		const desc: IEventDesc | undefined = this._subjects.get(key);
		if (desc === undefined) {
			return;
		}
		try {
			const instance = new desc.ref(event.payload[key]);
			this._log.info(`Event ${key} has been gotten and successfully constructed.`);
			desc.subject.next(instance);
		} catch (err) {
			this._log.error(
				`Fail to construct event ${key}: ${err instanceof Error ? err.message : err}.`,
			);
		}
	}
}
