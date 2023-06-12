import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParserGeneralConfigurationModule } from './general/module';
import { ParserStaticConfigurationModule } from './static/module';

@NgModule({
    imports: [CommonModule, ParserGeneralConfigurationModule, ParserStaticConfigurationModule],
    declarations: [],
    exports: [],
    bootstrap: [],
})
export class ParsersModule {}
