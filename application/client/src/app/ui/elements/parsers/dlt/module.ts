import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DltGeneralConfigurationModule } from './general/module';

@NgModule({
    imports: [CommonModule, DltGeneralConfigurationModule],
    declarations: [],
    exports: [],
    bootstrap: [],
})
export class DltModule {}
