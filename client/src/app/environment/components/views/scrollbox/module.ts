import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ComplexScrollBoxComponent } from './component';
import { ComplexScrollBoxSBVComponent } from './sbv/component';
import { ComplexScrollBoxSBHComponent } from './sbh/component';
import { ViewRowModule } from '../row/module';

export { ComplexScrollBoxComponent, ComplexScrollBoxSBVComponent, ComplexScrollBoxSBHComponent };

const entryComponents = [
	ComplexScrollBoxComponent,
	ComplexScrollBoxSBVComponent,
	ComplexScrollBoxSBHComponent,
];
const components = [...entryComponents];

@NgModule({
	entryComponents: [...entryComponents],
	imports: [CommonModule, ViewRowModule],
	declarations: [...components],
	exports: [...components],
})
export class ScrollBoxModule {
	constructor() {}
}
