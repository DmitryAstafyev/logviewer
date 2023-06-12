import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DltStaticConfigurationModule } from './dlt/module';
import { SomeIpStaticConfigurationModule } from './someip/module';
import { ParserStaticConfiguration } from './component';
@NgModule({
    imports: [CommonModule, DltStaticConfigurationModule, SomeIpStaticConfigurationModule],
    declarations: [ParserStaticConfiguration],
    exports: [
        ParserStaticConfiguration,
        DltStaticConfigurationModule,
        SomeIpStaticConfigurationModule,
    ],
    bootstrap: [
        ParserStaticConfiguration,
        DltStaticConfigurationModule,
        SomeIpStaticConfigurationModule,
    ],
})
export class ParserStaticConfigurationModule {}
