import { Component } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

export interface SetGroupPasswordResult {
    password: string
}

/**
 * Collects one password and hands it back for storing against every connection
 * in a group.
 *
 * SSH passwords are not config - they live in the OS keychain keyed by
 * host + port + username - so there is no group-level password to set. This
 * writes the same secret once per distinct connection instead.
 *
 * The value is held only as long as the dialog is open and is never written to
 * the config file, logged, or shown in a notification.
 */
@Component({
    template: `
        <div class="modal-header">
            <h5 class="modal-title">Set password for every host in this group</h5>
            <div class="ms-3 text-muted small">{{ groupName }}</div>
        </div>
        <div class="modal-body">

            <p class="small text-muted">
                SSH passwords are not stored in Tabby's config file, so a group cannot hold one.
                This saves the same password to your {{ storeName }} once for each distinct
                host, port and username in the group.
            </p>

            <div class="mb-3">
                <label class="form-label small">Password</label>
                <input type="password" class="form-control" autocomplete="new-password"
                       [(ngModel)]="password" (keyup.enter)="focusConfirm()">
            </div>

            <div class="mb-2">
                <label class="form-label small">Confirm password</label>
                <input type="password" class="form-control" autocomplete="new-password"
                       #confirmField [(ngModel)]="confirmation">
            </div>

            <div class="small text-danger mb-2" *ngIf="password && confirmation && !matches">
                The two entries do not match.
            </div>

            <div class="alert alert-secondary py-2 px-3 small mb-2">
                <div><strong>{{ connectionCount }}</strong>
                    distinct connection{{ connectionCount === 1 ? '' : 's' }} will be updated,
                    from {{ profileCount }} profile{{ profileCount === 1 ? '' : 's' }}.</div>
                <div class="text-muted mt-1" *ngIf="profileCount !== connectionCount">
                    Profiles sharing a host, port and username share one stored password.
                </div>
            </div>

            <div class="alert alert-warning py-2 px-3 small mb-0" *ngIf="skipped.length">
                <strong>{{ skipped.length }} will be skipped</strong> for having no host or no
                username to key the password against: {{ skipped.slice(0, 4).join(', ')
                }}{{ skipped.length > 4 ? ', and ' + (skipped.length - 4) + ' more' : '' }}.
            </div>

            <p class="small text-muted mt-3 mb-0">
                Tabby keys a saved password by host, port and username. If you change any of those
                later the password is no longer found and you will be prompted again. Key-based
                authentication avoids this, and does inherit from the group.
            </p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!canApply" (click)="apply()">
                Save to {{ connectionCount }} connection{{ connectionCount === 1 ? '' : 's' }}
            </button>
        </div>
    `,
})
export class SetGroupPasswordModalComponent {
    groupName = ''
    connectionCount = 0
    profileCount = 0
    skipped: string[] = []
    storeName = 'system keychain'

    password = ''
    confirmation = ''

    constructor(private modalInstance: NgbActiveModal) { }

    get matches(): boolean {
        return this.password === this.confirmation
    }

    get canApply(): boolean {
        return !!this.password && this.matches && this.connectionCount > 0
    }

    focusConfirm(): void {
        const el = document.querySelector('input[autocomplete="new-password"]:last-of-type') as HTMLElement | null
        el?.focus()
    }

    apply(): void {
        const password = this.password
        this.password = ''
        this.confirmation = ''
        this.modalInstance.close({ password } as SetGroupPasswordResult)
    }

    cancel(): void {
        this.password = ''
        this.confirmation = ''
        this.modalInstance.dismiss()
    }
}
