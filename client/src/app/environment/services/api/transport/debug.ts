import { Transport, ResponseConstructor, IBodyRequirement, ISignatureRequirement } from './index';
import { Subject, Observable } from 'rxjs';
import { CancelablePromise } from '@chipmunk/utils/promise';
import { Logger } from '@chipmunk/logs/index';

interface IEventDesc {
	subject: Subject<any>;
	ref: new (...args: any[]) => any;
}

const ROWS_COUNT: number = 10000;

export class Debug extends Transport {
	private _log: Logger = new Logger('TauriAPITransport');
	private _subjects: Map<string, IEventDesc> = new Map();
	private _event: Subject<any> = new Subject();

	constructor() {
		super();
	}

	public request<Request, Response>(
		request: Request & ISignatureRequirement & IBodyRequirement,
		responseConstructorRef: ResponseConstructor<Response> & ISignatureRequirement,
	): Promise<Response> {
		return new Promise((resolve, reject) => {
			// this._log.info(
			// 	`Sending ${request.getSignature()}; expected response: ${responseConstructorRef.getSignature()}`,
			// );
			const signature = request.getSignature();
			const body = request.getBody();
			switch (signature) {
				case 'Init':
					return resolve(new responseConstructorRef({ error: null }));
				case 'HostState':
					return resolve(new responseConstructorRef({ state: 'ready', message: '' }));
				case 'ChipmunkLogLevelRequest':
					return resolve(new responseConstructorRef({ level: 'DEBUG' }));
				case 'StreamAddRequest':
					resolve(new responseConstructorRef({ guid: '0000-0000-0000-0000-0000' }));
					setTimeout(() => {
						this._emit({
							event: 'StreamUpdated',
							payload: {
								StreamUpdated: {
									guid: '0000-0000-0000-0000-0000',
									length: ROWS_COUNT,
									rowsCount: ROWS_COUNT,
								},
							},
						});
					}, 150);
					return;
				case 'StreamChunk':
					let data = '';
					for (let i = (body as any).start; i <= (body as any).end; i += 1) {
						data += `${i}${'='.repeat(60)}${i}${i === (body as any).end ? '' : '\n'}`;
					}
					return resolve(
						new responseConstructorRef({
							guid: '0000-0000-0000-0000-0000',
							id: (body as any).id,
							data,
							start: (body as any).start,
							end: (body as any).end,
							length: ROWS_COUNT,
							rows: ROWS_COUNT,
						}),
					);
			}
			return reject(new Error('Not supported'));
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

	private _emit(event: { event: string; payload: any }) {
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
