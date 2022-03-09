import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';

@Component({
	selector: 'app-layout-status-bar',
	templateUrl: './template.html',
	styleUrls: ['./styles.less'],
})
export class LayoutStatusBarComponent implements OnDestroy {
	public _ng_plugins: any[] = [];

	constructor(private _cdRef: ChangeDetectorRef) {
		this._onTaskBarPlugin = this._onTaskBarPlugin.bind(this);
	}

	ngOnDestroy() {}

	private _onTaskBarPlugin(pluginId: number, factory: any, ipc: any) {
		this._ng_plugins.push({
			factory: factory,
			resolved: true,
			inputs: {
				session: -1,
				ipc: ipc,
			},
		});
		this._cdRef.detectChanges();
	}
}
