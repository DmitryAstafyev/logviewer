import { APIBase, API } from './index';
import * as validator from '@chipmunk/utils/validtor';

export interface Request {}

export class Response {
	public error: string | undefined;

	constructor(input: any) {
		validator.isObject(input);
	}
}

@API
export class Init extends APIBase<Request, Response> {
	public static get(): Init {
		return new Init({}, Response);
	}
}
