import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'FindInSearchDialogRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'FindInSearchDialogResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
