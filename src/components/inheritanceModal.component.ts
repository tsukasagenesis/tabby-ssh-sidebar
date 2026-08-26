import { Component } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { PartialProfile, Profile } from 'tabby-core'
import { InheritanceReport, SettingRow, isIdentityKey, isResettable, isSafeToInherit, resultOfInheriting } from '../services/inheritance'

const REDACTED_KEYS = ['password', 'privateKeys', 'passphrase']

export interface InheritanceResult {
    /** Option keys to delete from the profile so they inherit again */
    inheritKeys: string[]
}

/**
 * Shows which of a profile's settings come from its group and which it stores
 * itself, and lets you drop a stored copy so the group takes over again.
 *
 * Nothing is written until Save: clicking Inherit only stages the key.
 */
@Component({
    template: `
        <div class="modal-header">
            <h5 class="modal-title">Inheritance</h5>
            <div class="ms-3 text-muted small font-monospace">
                {{ profileName }}<span *ngIf="groupName"> &rarr; {{ groupName }}</span>
            </div>
        </div>
        <div class="modal-body">

            <div class="alert alert-danger py-2 px-3 small" *ngIf="report.counts.blank">
                <strong>{{ report.counts.blank }} setting{{ report.counts.blank === 1 ? '' : 's' }} blank.</strong>
                This profile stores an empty value where the group provides a real one, so it inherits
                nothing for {{ blankKeys }}.
            </div>

            <div class="alert alert-warning py-2 px-3 small" *ngIf="groupSetsIdentity">
                <strong>This group sets a default <code>{{ groupIdentityKeyList }}</code>.</strong>
                That is almost certainly a mistake - it belongs to one server, not a group. Any profile here
                without its own value will silently pick the group's up.
            </div>

            <div class="d-flex gap-4 mb-3">
                <div *ngIf="report.counts.blank">
                    <div class="stat-value text-danger">{{ report.counts.blank }}</div>
                    <div class="stat-label">blank</div>
                </div>
                <div *ngIf="report.counts.duplicate">
                    <div class="stat-value text-warning">{{ report.counts.duplicate }}</div>
                    <div class="stat-label">duplicates group</div>
                </div>
                <div>
                    <div class="stat-value">{{ report.counts.own }}</div>
                    <div class="stat-label">this profile only</div>
                </div>
                <div>
                    <div class="stat-value">{{ report.counts.inherits }}</div>
                    <div class="stat-label">inherited</div>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Setting</th>
                            <th>This profile</th>
                            <th>Group provides</th>
                            <th>State</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr *ngFor="let row of visibleRows; trackBy: trackByKey"
                            [class.staged]="isStaged(row)">
                            <td class="key" [ngClass]="'stripe-' + row.state">
                                <code>{{ row.key }}</code>
                            </td>
                            <td>
                                <span *ngIf="row.state === 'inherits'" class="text-muted fst-italic">inherited</span>
                                <code *ngIf="row.state !== 'inherits'"
                                      [class.text-danger]="row.state === 'blank'">{{ display(row.key, row.stored) }}</code>
                            </td>
                            <td>
                                <code class="text-muted">{{ row.group === undefined ? '—' : display(row.key, row.group) }}</code>
                            </td>
                            <td>
                                <span class="badge" [ngClass]="badgeClass(row)">{{ label(row) }}</span>
                            </td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-link py-0"
                                        *ngIf="canInherit(row)"
                                        (click)="toggleStaged(row)">
                                    {{ isStaged(row) ? 'Keep' : 'Inherit' }}
                                </button>

                                <button class="btn btn-sm btn-link py-0 text-warning"
                                        *ngIf="needsConfirm(row) && !isStaged(row)"
                                        (click)="requestReset(row)">
                                    {{ confirming === row.key ? confirmLabel(row) : 'Reset...' }}
                                </button>
                                <button class="btn btn-sm btn-link py-0"
                                        *ngIf="needsConfirm(row) && isStaged(row)"
                                        (click)="toggleStaged(row)">Keep</button>

                                <i class="fas fa-lock text-muted small"
                                   *ngIf="isHardLocked(row)"
                                   [title]="lockedReason(row)"></i>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="mt-2" *ngIf="report.tidy.length">
                <button class="btn btn-sm btn-link px-0" (click)="showTidy = !showTidy">
                    {{ showTidy
                        ? 'Hide settings that only tidy the config file'
                        : 'Show ' + report.tidy.length + ' more that only tidy the config file' }}
                </button>
                <span class="text-muted small ms-1">
                    &mdash; these match Tabby's own default, so clearing them changes nothing
                </span>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-sm btn-outline-secondary me-auto"
                    *ngIf="report.counts.duplicate"
                    (click)="stageAllDuplicates()">
                Inherit all group duplicates ({{ report.counts.duplicate }})
            </button>
            <span class="text-muted small me-2" *ngIf="staged.length">
                {{ staged.length }} setting{{ staged.length === 1 ? '' : 's' }} will be removed
            </span>
            <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!staged.length" (click)="save()">Save</button>
        </div>
    `,
    styles: [`
        .stat-value {
            font-size: 19px;
            font-weight: 600;
            line-height: 1.1;
            font-variant-numeric: tabular-nums;
        }

        .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.65;
        }

        td.key {
            position: relative;
            padding-left: 14px !important;
            white-space: nowrap;
        }

        td.key::before {
            content: '';
            position: absolute;
            left: 3px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 17px;
            border-radius: 2px;
            background: transparent;
        }

        td.key.stripe-blank::before { background: var(--bs-danger); }
        td.key.stripe-duplicate::before { background: var(--bs-warning); }
        td.key.stripe-own::before { background: var(--bs-primary); }

        tr.staged {
            opacity: 0.55;
            text-decoration: line-through;
        }

        tr.staged .btn { text-decoration: none; }

        code { font-size: 11.5px; }

        th {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            opacity: 0.65;
            font-weight: 600;
        }
    `],
})
export class InheritanceModalComponent {
    profile: PartialProfile<Profile>
    report: InheritanceReport
    profileName = ''
    groupName = ''

    showTidy = false
    staged: string[] = []
    /** Key of the row awaiting a second click to confirm a reset */
    confirming: string | null = null

    constructor(private modalInstance: NgbActiveModal) { }

    get visibleRows(): SettingRow[] {
        return this.showTidy ? this.report.rows : this.report.significant
    }

    get blankKeys(): string {
        return this.report.rows.filter(r => r.state === 'blank').map(r => r.key).join(', ')
    }

    trackByKey(_index: number, row: SettingRow): string {
        return row.key
    }

    /** Never print secrets, even though they are already in the config file. */
    display(key: string, value: any): string {
        if (value === undefined) {
            return '—'
        }
        if (REDACTED_KEYS.includes(key)) {
            if (Array.isArray(value)) {
                return value.length ? `${value.length} item${value.length === 1 ? '' : 's'}` : '[]'
            }
            return value === null || value === '' ? String(value === '' ? '— empty —' : value) : '••••••'
        }
        if (value === '') {
            return '— empty —'
        }
        if (Array.isArray(value)) {
            return value.length ? `[${value.length} item${value.length === 1 ? '' : 's'}]` : '[]'
        }
        if (value === null) {
            return 'null'
        }
        return String(value)
    }

    label(row: SettingRow): string {
        return {
            inherits: 'inherits',
            duplicate: 'same as group',
            blank: 'blank override',
            own: 'this profile only',
            tidy: 'matches default',
        }[row.state]
    }

    badgeClass(row: SettingRow): string {
        return {
            inherits: 'text-bg-success',
            duplicate: 'text-bg-warning',
            blank: 'text-bg-danger',
            own: 'text-bg-primary',
            tidy: 'text-bg-secondary',
        }[row.state]
    }

    canInherit(row: SettingRow): boolean {
        return isSafeToInherit(row)
    }

    /** A value that genuinely differs: resettable, but only after confirming. */
    needsConfirm(row: SettingRow): boolean {
        return isResettable(row)
    }

    /** Identity keys are never resettable at all. */
    isHardLocked(row: SettingRow): boolean {
        return row.state !== 'inherits' && !this.canInherit(row) && !this.needsConfirm(row)
    }

    lockedReason(row: SettingRow): string {
        if (isIdentityKey(row.key)) {
            return 'Identifies this host - never inherited'
        }
        return ''
    }

    /** Spells out the actual outcome, since falling back to Tabby's default is
     *  not the same as taking the group's value. */
    confirmLabel(row: SettingRow): string {
        const outcome = resultOfInheriting(row)
        const shown = this.display(row.key, outcome.value)
        return outcome.source === 'group'
            ? `Use group's ${shown}?`
            : `Fall back to Tabby default ${shown}?`
    }

    requestReset(row: SettingRow): void {
        if (this.confirming === row.key) {
            this.confirming = null
            this.toggleStaged(row)
            return
        }
        this.confirming = row.key
    }

    /** A group setting host as a default is a mistake worth pointing out. */
    get groupSetsIdentity(): boolean {
        return this.report.groupIdentityKeys.length > 0
    }

    get groupIdentityKeyList(): string {
        return this.report.groupIdentityKeys.join(', ')
    }

    isStaged(row: SettingRow): boolean {
        return this.staged.includes(row.key)
    }

    toggleStaged(row: SettingRow): void {
        this.staged = this.isStaged(row)
            ? this.staged.filter(k => k !== row.key)
            : [...this.staged, row.key]
    }

    /** Duplicates only - a genuinely different value is never swept up in bulk. */
    stageAllDuplicates(): void {
        const keys = this.report.rows.filter(r => r.state === 'duplicate').map(r => r.key)
        this.staged = [...new Set([...this.staged, ...keys])]
    }

    save(): void {
        this.modalInstance.close({ inheritKeys: this.staged } as InheritanceResult)
    }

    cancel(): void {
        this.modalInstance.dismiss()
    }
}
