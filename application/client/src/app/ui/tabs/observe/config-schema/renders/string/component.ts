import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings/plugins';
import { State } from '../../state';

@Component({
    selector: 'app-tabs-config-schema-string',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaString extends ChangesDetector implements AfterContentInit, OnChanges {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public value?: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['value']) {
            this.state.saveConfig(this.config.id, {
                Text: changes['value'].currentValue,
            });
        }
    }

    ngAfterContentInit(): void {
        const input_type = this.config.input_type;
        this.value = this.state.isTextItem(input_type) ? input_type.Text : '';
        this.state.saveConfig(this.config.id, { Text: this.value });
    }

    public ngOnInputChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.state.saveConfig(this.config.id, { Text: target?.value ?? '' });
    }
}
