import {
	LoggerParameters,
	ELogLevels,
	TOutputFunc,
	TLogCallback,
} from './parameters';

export { ELogLevels };

const LEFT_SPACE_ON_LOGGER_SIG: number = 1;
const RIGHT_SPACE_ON_LOGGER_SIG: number = 1;
const LOG_LEVEL_MAX: number = 7;
/**
 * @class
 * Logger
 */
export class Logger {
	public static maxNameLength: number = 0;
	private _signature: string = '';
	private _parameters: LoggerParameters = new LoggerParameters({});

	/**
	 * @constructor
	 * @param {string} signature        - Signature of logger instance
	 * @param {LoggerParameters} params - Logger parameters
	 */
	constructor(signature: string, params?: LoggerParameters) {
		params instanceof LoggerParameters && (this._parameters = params);
		if (signature.length > Logger.maxNameLength) {
			Logger.maxNameLength = signature.length;
		}
		const fill = Logger.maxNameLength - signature.length;
		this._signature = `${' '.repeat(
			LEFT_SPACE_ON_LOGGER_SIG
		)}${signature}${' '.repeat(
			fill > 0 && isFinite(fill) && !isNaN(fill) ? fill : 0
		)}${' '.repeat(RIGHT_SPACE_ON_LOGGER_SIG)}`;
	}

	/**
	 * Publish info logs
	 * @param {any} args - Any input for logs
	 * @returns {string} - Formatted log-string
	 */
	public info(...args: any[]) {
		return this._log(this._getMessage(...args), ELogLevels.INFO);
	}

	/**
	 * Publish warnings logs
	 * @param {any} args - Any input for logs
	 * @returns {string} - Formatted log-string
	 */
	public warn(...args: any[]) {
		return this._log(this._getMessage(...args), ELogLevels.WARNING);
	}

	/**
	 * Publish verbose logs
	 * @param {any} args - Any input for logs
	 * @returns {string} - Formatted log-string
	 */
	public verbose(...args: any[]) {
		return this._log(this._getMessage(...args), ELogLevels.VERBOS);
	}

	/**
	 * Publish error logs
	 * @param {any} args - Any input for logs
	 * @returns {string} - Formatted log-string
	 */
	public error(...args: any[]) {
		return this._log(this._getMessage(...args), ELogLevels.ERROR);
	}

	/**
	 * Publish debug logs
	 * @param {any} args - Any input for logs
	 * @returns {string} - Formatted log-string
	 */
	public debug(...args: any[]) {
		return this._log(this._getMessage(...args), ELogLevels.DEBUG);
	}

	public measure(operation: string): () => void {
		const started = Date.now();
		this.debug(`starting "${operation}"`);
		return () => {
			const duration: number = Date.now() - started;
			this.debug(
				`"${operation}" finished in: ${(duration / 1000).toFixed(
					2
				)} sec (${duration}ms)`
			);
		};
	}

	private _console(message: string, level: ELogLevels) {
		if (!this._parameters.console) {
			return;
		}
		/* tslint:disable */
		this._parameters.getAllowedConsole()[level] &&
			console.log(
				`%c${message}`,
				(() => {
					switch (level) {
						case ELogLevels.VERBOS:
							return 'color: grey';
						case ELogLevels.INFO:
							return 'color: blue';
						case ELogLevels.DEBUG:
							return 'color: green';
						case ELogLevels.WARNING:
							return 'color: yellow';
						case ELogLevels.ERROR:
							return 'color: red';
						default:
							return '';
					}
				})()
			);
		/* tslint:enable */
	}

	private _output(message: string) {
		typeof this._parameters.output === 'function' &&
			this._parameters.output(message);
	}

	private _callback(message: string, level: ELogLevels) {
		if (
			typeof this._parameters.getCallback() === 'function' &&
			this._parameters.getAllowedConsole()[level]
		) {
			const cb = this._parameters.getCallback();
			if (cb === undefined) {
				throw new Error("Callback for logger isn't defined");
			}
			cb(message, level);
		}
	}

	private _getMessage(...args: any[]) {
		let message = ``;
		if (args instanceof Array) {
			args.forEach((smth: any, index: number) => {
				if (typeof smth !== 'string') {
					message = `${message} (type: ${typeof smth})`;
				} else {
					message = `${message}${smth}`;
				}
				index < args.length - 1 && (message = `${message},\n `);
			});
		}
		return message;
	}

	private _getTime(): string {
		const time: Date = new Date();
		return `${time.toJSON()}`;
	}

	private _log(original: string, level: ELogLevels) {
		const levelStr = `${level}`;
		const fill = LOG_LEVEL_MAX - levelStr.length;
		const message: string = `[${this._signature}][${levelStr}${' '.repeat(
			fill > 0 && isFinite(fill) && !isNaN(fill) ? fill : 0
		)}]: ${original}`;
		this._console(`[${this._getTime()}]${message}`, level);
		this._callback(`[${this._getTime()}]${message}`, level);
		this._output(`[${this._getTime()}]${message}`);
		return original;
	}
}
