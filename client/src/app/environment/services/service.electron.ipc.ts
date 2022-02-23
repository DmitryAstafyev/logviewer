import { guid, Subscription, THandler, Logger } from 'chipmunk.client.toolkit';
import { IPCMessagePackage } from './service.electron.ipc.messagepackage';
import { IService } from '@chipmunk/interfaces/interface.service';
import { IPC } from '@chipmunk/interfaces/interface.ipc';
import { ServiceAPI } from './service.api';
import { Transport, wrapResponseConstructor } from './api/transport';
import { Init } from '@chipmunk/api/requests/Init';
export { IPC, Subscription, THandler };

export type TResponseFunc = (message: Required<IPC.Interface>) => Promise<Required<IPC.Interface>>;

interface IPendingTask<T extends IPC.Interface> {
	resolver: (message: T) => any;
	rejector: (error: Error) => void;
	signature: string;
	created: number;
}

export type ResponseConstructor<Response> = new (...args: any[]) => Response;

class ElectronIpcService implements IService {
	static PENDING_ERR_DURATION: number = 600 * 1000; // 10 mins before report error about pending tasks.
	static PENDING_WARN_DURATION: number = 120 * 1000; // 2 mins before report warn about pending tasks.
	static QUEUE_CHECK_DELAY: number = 5 * 1000;

	private _logger: Logger = new Logger('ElectronIpcService');
	private _subscriptions: Map<string, Subscription> = new Map();
	// private _pending: Map<string, IPendingTask<any>> = new Map();
	private _handlers: Map<string, Map<string, THandler>> = new Map();
	private _listeners: Map<string, boolean> = new Map();
	private _api: Transport;

	constructor() {
		const transport = ServiceAPI.getTransport();
		if (transport instanceof Error) {
			throw transport;
		}
		this._api = transport;
	}

	public init(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.log(`>>>>>>>>>>>>>>>>>>>> initing API Service`);
			Init.get()
				.send()
				.then(() => {
					console.log(`>>>>>>>>>>>>>>>>>>>> API Service inited`);
					resolve();
				})
				.catch((err: Error) => {
					console.error(`>>>>>>>>>>>>>>>>>>>> Fail to init API service: ${err.message}`);
					//reject(err);
					resolve();
				});
		});
	}

	public getName(): string {
		return 'ElectronIpcService';
	}

	public sendToPluginHost(message: any, token: string, stream?: string): void {
		const pluginMessage: IPC.PluginInternalMessage = new IPC.PluginInternalMessage({
			data: message,
			token: token,
			stream: stream,
		});
		this._sendWithoutResponse(pluginMessage);
	}

	public requestToPluginHost(message: any, token: string, stream?: string): Promise<any> {
		return Promise.resolve();
		// return new Promise((resolve, reject) => {
		// 	const pluginMessage: IPC.PluginInternalMessage = new IPC.PluginInternalMessage({
		// 		data: message,
		// 		token: token,
		// 		stream: stream,
		// 	});
		// 	this.request(pluginMessage, IPC.PluginError)
		// 		.then((response: IPC.TMessage | undefined) => {
		// 			if (
		// 				!(response instanceof IPC.PluginInternalMessage) &&
		// 				!(response instanceof IPC.PluginError)
		// 			) {
		// 				return reject(
		// 					new Error(
		// 						`From plugin host was gotten incorrect responce: ${typeof response}/${response}`,
		// 					),
		// 				);
		// 			}
		// 			if (response instanceof IPC.PluginError) {
		// 				return reject(response);
		// 			}
		// 			resolve(response.data);
		// 		})
		// 		.catch((sendingError: Error) => {
		// 			reject(sendingError);
		// 		});
		// });
	}

	public send(message: Required<IPC.Interface>): Promise<void> {
		return new Promise((resolve, reject) => {
			const ref: Function | undefined = this._getRefToMessageClass(message);
			if (ref === undefined) {
				return reject(new Error(`Incorrect type of message`));
			}
			this._sendWithoutResponse(message);
			resolve(undefined);
		});
	}

	public response(sequence: string, message: Required<IPC.Interface>): Promise<void> {
		return new Promise((resolve, reject) => {
			const ref: Function | undefined = this._getRefToMessageClass(message);
			if (ref === undefined) {
				return reject(new Error(`Incorrect type of message`));
			}
			this._sendWithoutResponse(message, sequence);
			resolve(undefined);
		});
	}

	public request<Response extends IPC.Interface>(
		message: Required<IPC.Interface>,
		expected: ResponseConstructor<Response> & Required<IPC.Interface>,
	): Promise<Response> {
		const start = Date.now();
		return new Promise((resolve, reject) => {
			this._sendWithResponse<Response>({ message: message, sequence: guid(), expected })
				.then((res: Response) => {
					console.log(`>>>>>>>> ${message.signature}: ${Date.now() - start}ms`);
					resolve(res);
				})
				.catch(reject);
		});
	}

	public subscribe(message: Function, handler: THandler): Subscription {
		// if (!this._isValidMessageClassRef(message)) {
		// 	throw new Error(this._logger.error('Incorrect reference to message class.', message));
		// }
		const signature: string = (message as any).signature;
		console.log(`>>>>>>>>>>>>>>>> subscribe: ${signature}`);
		const subscription = this._api
			.subscribeDirect(signature, message as new (...args: any[]) => any)
			.subscribe(handler);
		return new Subscription(signature, () => {
			subscription.unsubscribe();
		});
	}

	public subscribeOnPluginMessage(handler: THandler): Promise<Subscription> {
		return new Promise((resolve) => {
			resolve(this._setSubscription(IPC.PluginInternalMessage.signature, handler));
		});
	}

	public destroy() {
		this._subscriptions.forEach((subscription: Subscription) => {
			subscription.destroy();
		});
		this._subscriptions.clear();
	}

	private _setSubscription(signature: string, handler: THandler): Subscription {
		const subscriptionId: string = guid();
		let handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
		if (handlers === undefined) {
			handlers = new Map();
			this._subscribeIPCMessage(signature);
		}
		handlers.set(subscriptionId, handler);
		this._handlers.set(signature, handlers);
		const subscription: Subscription = new Subscription(
			signature,
			() => {
				this._unsubscribe(signature, subscriptionId);
			},
			subscriptionId,
		);
		this._subscriptions.set(subscriptionId, subscription);
		return subscription;
	}

	private _emitIncomePluginMessage(message: any) {
		const handlers: Map<string, THandler> | undefined = this._handlers.get(
			IPC.PluginInternalMessage.signature,
		);
		if (handlers === undefined) {
			return;
		}
		handlers.forEach((handler: THandler) => {
			handler(message);
		});
	}

	private _subscribeIPCMessage(messageAlias: string): boolean {
		if (this._listeners.has(messageAlias)) {
			return false;
		}
		this._listeners.set(messageAlias, true);
		const EventConstructor = class {};
		this._api
			.subscribe(messageAlias, EventConstructor)
			.then((observe) => {
				observe.subscribe();
			})
			.catch((error: Error) => {
				this._logger.error(`Fail to subscribe to ${messageAlias}: ${error.message}`);
			});
		//this._ipcRenderer.on(messageAlias, this._onIPCMessage.bind(this));
		return true;
	}

	// private _onIPCMessage(ipcEvent: Event, eventName: string, data: any) {
	// 	const messagePackage: IPCMessagePackage = new IPCMessagePackage(data);
	// 	const pending: IPendingTask<any> | undefined = this._pending.get(messagePackage.sequence);
	// 	this._pending.delete(messagePackage.sequence);
	// 	const refMessageClass = this._getRefToMessageClass(messagePackage.message);
	// 	if (refMessageClass === undefined) {
	// 		return this._logger.warn(
	// 			`Cannot find ref to class of message. Event: ${eventName}; data: ${data}.`,
	// 		);
	// 	}
	// 	const instance: IPC.TMessage = new (refMessageClass as any)(messagePackage.message);
	// 	if (pending !== undefined) {
	// 		return pending.resolver(instance);
	// 	}
	// 	if (instance instanceof IPC.PluginInternalMessage || instance instanceof IPC.PluginError) {
	// 		if (typeof instance.token !== 'string' || instance.token.trim() === '') {
	// 			return this._logger.warn(
	// 				`Was gotten message "PluginInternalMessage", but message doesn't have token. Message will be ignored.`,
	// 				instance,
	// 			);
	// 		}
	// 		// This is plugin message. Do not pass into common stream of messages
	// 		this._emitIncomePluginMessage(instance);
	// 		return;
	// 	}
	// 	const handlers = this._handlers.get(instance.signature);
	// 	if (handlers === undefined) {
	// 		return;
	// 	}
	// 	// TODO: try / catch should be only on production
	// 	handlers.forEach((handler: THandler) => {
	// 		handler(instance, this.response.bind(this, messagePackage.sequence));
	// 	});
	// }

	private _sendWithResponse<Response extends IPC.Interface>(params: {
		message: Required<IPC.Interface>;
		sequence: string;
		expected: ResponseConstructor<Response> & Required<IPC.Interface>;
	}): Promise<Response> {
		return new Promise((resolve, reject) => {
			const messagePackage: IPCMessagePackage = new IPCMessagePackage({
				message: params.message,
				sequence: params.sequence,
			});
			debugger;
			const signature: string = params.message.signature;
			// this._pending.set(params.sequence, {
			// 	resolver: resolve,
			// 	rejector: reject,
			// 	signature: signature,
			// 	created: new Date().getTime(),
			// });
			const request = {
				getSignature: () => {
					return signature;
				},
				getBody: () => {
					return params.message;
				},
			};
			const WrappedResponse = class {
				private _input: any;
				constructor(input: any) {
					this._input = input;
				}
				public extract() {
					return new params.expected(this._input);
				}
			};
			this._api
				.request(
					request,
					wrapResponseConstructor(params.expected.signature, WrappedResponse),
				)
				.then((wrapped: { extract: () => any }) => {
					resolve(wrapped.extract());
				})
				.catch(reject);
			// Format:               | channel  |  event  | instance |
			// this._ipcRenderer.send(signature, signature, messagePackage);
		});
	}

	private _sendWithoutResponse(message: Required<IPC.Interface>, sequence?: string): void {
		// const messagePackage: IPCMessagePackage = new IPCMessagePackage({
		// 	message: message,
		// 	sequence: sequence,
		// });
		const signature: string = message.signature;
		const request = {
			getSignature: () => {
				return signature;
			},
			getBody: () => {
				return message;
			},
		};
		this._api.notify(request).catch((err: Error) => {
			// console.error(`>>>>>>>>>>>>> Fail to send ${signature}: ${err.message}`);
		});
		// // Format:               | channel  |  event  | instance |
		// this._ipcRenderer.send(signature, signature, messagePackage);
	}

	private _isValidMessageClassRef(messageRef: Function): boolean {
		let result: boolean = false;
		if (
			typeof (messageRef as any).signature !== 'string' ||
			(messageRef as any).signature.trim() === ''
		) {
			return false;
		}
		Object.keys(IPC.Map).forEach((alias: string) => {
			if (result) {
				return;
			}
			if ((messageRef as any).signature === (IPC.Map as any)[alias].signature) {
				result = true;
			}
		});
		return result;
	}

	private _getRefToMessageClass(message: any): Function | undefined {
		let ref: Function | undefined;
		Object.keys(IPC.Map).forEach((alias: string) => {
			if (ref) {
				return;
			}
			if (
				message instanceof (IPC.Map as any)[alias] ||
				message.signature === (IPC.Map as any)[alias].signature
			) {
				ref = (IPC.Map as any)[alias];
			}
		});
		return ref;
	}

	private _unsubscribe(signature: string, subscriptionId: string) {
		this._subscriptions.delete(subscriptionId);
		const handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
		if (handlers === undefined) {
			return;
		}
		handlers.delete(subscriptionId);
		if (handlers.size === 0) {
			// this._ipcRenderer.removeAllListeners(signature);
			this._handlers.delete(signature);
			this._listeners.delete(signature);
		} else {
			this._handlers.set(signature, handlers);
		}
	}

	private _report() {
		// const current = new Date().getTime();
		// this._pending.forEach((task: IPendingTask<any>) => {
		// 	const duration = current - task.created;
		// 	if (duration > ElectronIpcService.PENDING_ERR_DURATION) {
		// 		this._logger.error(
		// 			`Pending task "${task.signature}" too long stay in queue: ${(
		// 				duration / 1000
		// 			).toFixed(2)}s.`,
		// 		);
		// 	} else if (duration > ElectronIpcService.PENDING_WARN_DURATION) {
		// 		this._logger.warn(
		// 			`Pending task "${task.signature}" is in a queue for ${(duration / 1000).toFixed(
		// 				2,
		// 			)}s.`,
		// 		);
		// 	}
		// });
		// if (this._pending.size > 0) {
		// 	this._logger.debug(`Pending task queue has ${this._pending.size} tasks.`);
		// 	this._logger.debug(
		// 		`\n\t -${Array.from(this._pending.values())
		// 			.map((t) => `${t.signature}:: ${t.created}`)
		// 			.join(`\n\t -`)}`,
		// 	);
		// }
		// setTimeout(this._report.bind(this), ElectronIpcService.QUEUE_CHECK_DELAY);
	}
}

export default new ElectronIpcService();
