export function isObject(src: any) {
	if ((src ?? true) === true || typeof src !== 'object') {
		throw new Error(`Expecting an object`);
	}
}
export function getObject(src: any): Object {
	if ((src ?? true) === true || typeof src !== 'object') {
		throw new Error(`Expecting an object`);
	}
	return src;
}
export function getAsNotEmptyString(src: any, key: string): string {
	if (typeof src[key] !== 'string' || src[key].trim() === '') {
		throw new Error(`Parameter "${key}" should be a none-empty string`);
	}
	return src[key];
}
export function getAsValidNumber(src: any, key: string): number {
	if (
		typeof src[key] !== 'number' ||
		isNaN(src[key]) ||
		!isFinite(src[key])
	) {
		throw new Error(`Parameter "${key}" should be valid number`);
	}
	return src[key];
}
