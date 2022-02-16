import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import * as dialog from '@chipmunk/requests/OpenFileDialog';
import * as init from '@chipmunk/requests/Init';
import * as streamupdated from '@chipmunk/events/StreamUpdated';
import { Subscription } from 'rxjs';
@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.less'],
})
export class AppComponent implements AfterViewInit {
	title = 'chipmunk';
	constructor(chdec: ChangeDetectorRef) {}
	ngAfterViewInit(): void {
		streamupdated.StreamUpdated.get()
			.subscribe((event: streamupdated.Event) => {
				console.log(
					`>>>>> Event StreamUpdate has been gotten: ${JSON.stringify(
						event
					)}`
				);
			})
			.then((subscription: Subscription) => {
				console.log(`Event subscribed`);
			})
			.catch((err: Error) => {
				console.error(`Fail to subscribe event: ${err.message}`);
			});
		const initRequest = init.Init.get();
		initRequest
			.send()
			.then((initResponse: init.Response) => {
				console.log(initResponse);
				const request = dialog.OpenFileDialog.get({
					foo: 'test_foo',
					bar: 'test_bar',
				});
				request
					.send()
					.then((response: dialog.Response) => {
						console.log(
							`Responsed: foo = ${response.foo}; bar = ${response.bar}`
						);
					})
					.catch((err: Error) => {
						console.log(err);
					});
			})
			.catch((err: Error) => {
				console.log(err);
			});
	}
}
