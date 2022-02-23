import * as Toolkit from 'chipmunk.client.toolkit';

import { IService } from '@chipmunk/interfaces/interface.service';
import * as Interfaces from '@chipmunk/interfaces/index';
import { IPC } from './service.electron.ipc';

import ElectronIpcService from './service.electron.ipc';

export interface IElectronEnv {
	showOpenDialog: (
		options: Interfaces.Electron.OpenDialogOptions,
	) => Promise<Interfaces.Electron.OpenDialogReturnValue>;
	openExternal: (url: string) => Promise<void>;
	platform: () => Promise<string>;
}

export class ElectronEnvService implements IService {
	private _logger: Toolkit.Logger = new Toolkit.Logger('ElectronEnvService');

	public init(): Promise<void> {
		return Promise.resolve();
	}

	public getName(): string {
		return 'ElectronEnvService';
	}

	public get(): IElectronEnv {
		const self = this;
		return {
			showOpenDialog: (
				options: Interfaces.Electron.OpenDialogOptions,
			): Promise<Interfaces.Electron.OpenDialogReturnValue> => {
				return new Promise((resolve, reject) => {
					ElectronIpcService.request<IPC.ElectronEnvShowOpenDialogResponse>(
						new IPC.ElectronEnvShowOpenDialogRequest({
							options: options,
						}),
						IPC.ElectronEnvShowOpenDialogResponse,
					)
						.then((message) => {
							if (message.error !== undefined) {
								return reject(
									new Error(
										self._logger.warn(
											`Cannot call ShowOpenDialog due error: ${message.error}`,
										),
									),
								);
							}
							if (message.result === undefined) {
								return reject(
									new Error(
										self._logger.warn(
											`ElectronEnvShowOpenDialogResponse didn't return any results`,
										),
									),
								);
							}
							resolve(message.result);
						})
						.catch((err: Error) => {
							reject(
								new Error(
									self._logger.warn(
										`Fail to call ShowOpenDialog due error: ${err.message}`,
									),
								),
							);
						});
				});
			},
			openExternal: (url: string): Promise<void> => {
				return new Promise((resolve, reject) => {
					ElectronIpcService.request<IPC.ElectronEnvShellOpenExternalResponse>(
						new IPC.ElectronEnvShellOpenExternalRequest({
							url: url,
						}),
						IPC.ElectronEnvShellOpenExternalResponse,
					)
						.then((message) => {
							if (message.error !== undefined) {
								return reject(
									new Error(
										self._logger.warn(
											`Cannot call OpenExternal due error: ${message.error}`,
										),
									),
								);
							}
							resolve(undefined);
						})
						.catch((err: Error) => {
							reject(
								new Error(
									self._logger.warn(
										`Fail to call OpenExternal due error: ${err.message}`,
									),
								),
							);
						});
				});
			},
			platform: (): Promise<string> => {
				return new Promise((resolve, reject) => {
					ElectronIpcService.request<IPC.ElectronEnvPlatformResponse>(
						new IPC.ElectronEnvPlatformRequest(),
						IPC.ElectronEnvPlatformResponse,
					)
						.then((message) => {
							resolve(message.platform);
						})
						.catch((err: Error) => {
							reject(
								new Error(
									self._logger.warn(
										`Fail to call OpenExternal due error: ${err.message}`,
									),
								),
							);
						});
				});
			},
		};
	}
}

export default new ElectronEnvService();
