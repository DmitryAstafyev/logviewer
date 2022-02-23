import { APIEvent, APIEventBase } from './index';
import * as validator from '@chipmunk/utils/validtor';

export class Event {
	public session: string;
	public rows: number;

	constructor(input: any) {
		validator.isObject(input);
		this.session = validator.getAsNotEmptyString(input, 'session');
		this.rows = validator.getAsValidNumber(input, 'rows');
	}
}

@APIEvent
export class StreamUpdated extends APIEventBase<Event> {
	public static get(): StreamUpdated {
		return new StreamUpdated(Event);
	}
}
