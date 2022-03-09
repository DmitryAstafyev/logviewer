import { IService } from '@chipmunk/interfaces/interface.service';

export type RemoveHandler = () => void;

class ServiceGlobalStyles implements IService {
	private _sheet!: CSSStyleSheet;

	constructor() {}

	public init(): Promise<void> {
		const style = document.createElement('style') as HTMLStyleElement;
		document.head.appendChild(style);
		if (style.sheet === null) {
			return Promise.reject(new Error(`Fail to create global style sheet`));
		}
		this._sheet = style.sheet;
		return Promise.resolve();
	}

	public getName(): string {
		return ServiceGlobalStyles.name;
	}

	public add(rule: string): RemoveHandler {
		const index = this._sheet.insertRule(rule);
		return () => {
			this._sheet.deleteRule(index);
		};
	}
}

const service = new ServiceGlobalStyles();
export { service as ServiceGlobalStyles };
