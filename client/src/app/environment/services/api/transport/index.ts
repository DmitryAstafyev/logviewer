import { Observable } from 'rxjs';
import { CancelablePromise } from '@chipmunk/utils/promise';

export class RequestWrapper<B>
	implements ISignatureRequirement, IBodyRequirement
{
	private _signature: string;
	private _body: B;
	constructor(signature: string, body: B) {
		this._signature = signature;
		this._body = body;
	}
	public getSignature(): string {
		return this._signature;
	}
	public getBody(): B {
		return this._body;
	}
}

export function wrapResponseConstructor<Response>(
	signature: string,
	constructorRef: ResponseConstructor<Response>
): ResponseConstructor<Response> & ISignatureRequirement {
	(constructorRef as any).getSignature = function () {
		return signature;
	};
	return constructorRef as ResponseConstructor<Response> &
		ISignatureRequirement;
}

export interface ISignatureRequirement {
	getSignature(): string;
}

export interface IBodyRequirement {
	getBody(): any;
}

export type ResponseConstructor<Response> = new (...args: any[]) => Response;

export abstract class Transport {
	public abstract request<Request, Response>(
		request: Request & ISignatureRequirement & IBodyRequirement,
		responseConstructorRef: ResponseConstructor<Response> &
			ISignatureRequirement
	): Promise<Response>;

	public abstract operation<Request, Response>(
		operationUuid: string,
		request: Request & ISignatureRequirement & IBodyRequirement,
		responseConstructorRef: ResponseConstructor<Response> &
			ISignatureRequirement
	): CancelablePromise<Response>;

	public abstract abort(operationUuid: string): Promise<void>;

	public abstract notify<Notification>(
		notification: Notification & ISignatureRequirement & IBodyRequirement
	): Promise<void>;

	public abstract subscribe(
		event: string,
		refEventConstructor: new (...args: any[]) => any
	): Promise<Observable<any>>;

	public abstract subscribeDirect(
		event: string,
		refEventConstructor: new (...args: any[]) => any
	): Observable<any>;
}
