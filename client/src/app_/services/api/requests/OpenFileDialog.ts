import { APIBase, API } from './index';
import * as validator from '@chipmunk/utils/validtor';

export interface Request {
	foo: string;
	bar: string;
}

export class Response {
	public foo: string;
	public bar: string;

	constructor(input: any) {
		validator.isObject(input);
		this.foo = validator.getAsNotEmptyString(input, 'foo');
		this.bar = validator.getAsNotEmptyString(input, 'bar');
	}
}

@API
export class OpenFileDialog extends APIBase<Request, Response> {
	public static get(request: Request): OpenFileDialog {
		return new OpenFileDialog(request, Response);
	}
}
