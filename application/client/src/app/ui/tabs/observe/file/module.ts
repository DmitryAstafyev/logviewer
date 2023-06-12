import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ParserGeneralConfigurationModule } from '@elements/parsers/general/module';
import { ParserStaticConfigurationModule } from '@elements/parsers/static/module';

import { TabObserveFile } from './component';

const components = [TabObserveFile];

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        ParserGeneralConfigurationModule,
        ParserStaticConfigurationModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class FileModule {}
