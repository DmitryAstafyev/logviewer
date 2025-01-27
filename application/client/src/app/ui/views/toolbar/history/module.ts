import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { EditableModule } from '@ui/elements/editable/module';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Preset } from './preset/component';
import { History } from './component';
import { FilterPreview } from './preview/filter/component';
import { ChartPreview } from './preview/chart/component';

@NgModule({
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatSelectModule,
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
        EditableModule,
    ],
    declarations: [Preset, History, FilterPreview, ChartPreview],
    exports: [History],
    bootstrap: [History],
})
export class HistoryModule {}
