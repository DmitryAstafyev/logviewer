export enum ELogLevels {
	INFO = 'INFO',
	DEBUG = 'DEBUG',
	WARNING = 'WARNING',
	VERBOS = 'VERBOS',
	ERROR = 'ERROR',
}

const DEFAUT_ALLOWED_CONSOLE = {
	DEBUG: true,
	ERROR: true,
	INFO: true,
	VERBOS: false,
	WARNING: true,
};

const LOGS_LEVEL_TABLE = {
	VERBOS: [
		ELogLevels.VERBOS,
		ELogLevels.DEBUG,
		ELogLevels.INFO,
		ELogLevels.WARNING,
		ELogLevels.ERROR,
	],
	DEBUG: [
		ELogLevels.DEBUG,
		ELogLevels.INFO,
		ELogLevels.WARNING,
		ELogLevels.ERROR,
	],
	INFO: [ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
	WARNING: [ELogLevels.WARNING, ELogLevels.ERROR],
	ERROR: [ELogLevels.ERROR],
};

export type TOutputFunc = (...args: any[]) => any;
export type TLogCallback = (message: string, level: ELogLevels) => void;

const ALLOWED_CONSOLE_REF_NAME = '__chipmunkAllowedConsoleLogger__';
const CALLBACK_REF_NAME = '__chipmunkLoggerCallback__';

export function setGlobalLogLevel(lev: ELogLevels) {
	if (LOGS_LEVEL_TABLE[lev] === undefined) {
		return;
	}
	if (window === undefined) {
		return;
	}
	(window as any)[ALLOWED_CONSOLE_REF_NAME] = Object.assign(
		{},
		DEFAUT_ALLOWED_CONSOLE
	);
	Object.keys((window as any)[ALLOWED_CONSOLE_REF_NAME]).forEach(
		(key: string) => {
			(window as any)[ALLOWED_CONSOLE_REF_NAME][key] =
				LOGS_LEVEL_TABLE[lev].indexOf(key as ELogLevels) !== -1;
		}
	);
}

export function setGlobalLogCallback(cb: TLogCallback) {
	if (window === undefined) {
		return;
	}
	(window as any)[CALLBACK_REF_NAME] = cb;
}

/**
 * @class
 * Settings of logger
 *
 * @property {boolean} console - Show / not show logs in console
 * @property {Function} output - Sends ready string message as argument to output functions
 */

export class LoggerParameters {
	public console: boolean = true;
	public output: TOutputFunc | null = null;

	private _allowedConsole: { [key: string]: boolean } = {};

	constructor({
		console = true,
		output = null,
		allowedConsole = DEFAUT_ALLOWED_CONSOLE,
	}: {
		console?: boolean;
		output?: TOutputFunc | null;
		allowedConsole?: { [key: string]: boolean };
	}) {
		this.console = console;
		this.output = output;
		this._allowedConsole = allowedConsole;
	}

	public getAllowedConsole(): { [key: string]: boolean } {
		if (window === undefined) {
			return {};
		}
		if ((window as any)[ALLOWED_CONSOLE_REF_NAME] === undefined) {
			return this._allowedConsole;
		} else {
			return (window as any)[ALLOWED_CONSOLE_REF_NAME];
		}
	}

	public getCallback(): TLogCallback | undefined {
		if (window === undefined) {
			return;
		}
		if (typeof (window as any)[CALLBACK_REF_NAME] === 'function') {
			return (window as any)[CALLBACK_REF_NAME] as TLogCallback;
		}
		return undefined;
	}
}
