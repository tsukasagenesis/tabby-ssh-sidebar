import { Component } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { NormalizeEntry, NormalizePlan, countProfiles, countSettings } from '../services/normalize'

export interface NormalizeResult {
    entries: NormalizeEntry[]
}

/**
 * Bulk form of the inheritance panel: drops redundant copies across a whole
 * group so its profiles follow the group again.
 *
 * Only entries the per-profile panel would offer are listed, and everything is
 * shown with its count before anything is written.
 */
@Component({
    template: `
        <div class="modal-header">
            <h5 class="modal-title">Normalize inheritance</h5>
            <div class="ms-3 text-muted small">{{ groupName }}</div>
        </div>
        <div class="modal-body">

            <p class="small text-muted">
                These settings are stored on individual profiles but already match what they would inherit.
                Removing them changes no values &mdash; it only stops the profile shadowing its group.
            </p>

            <div class="alert alert-secondary py-2 px-3 small" *ngIf="!plan.significant.length">
                Nothing in this group shadows its group settings. The entries below would only shorten the
                config file.
            </div>

            <ng-container *ngIf="plan.significant.length">
                <div class="section-label">Changes what these profiles resolve to</div>
                <table class="table table-sm align-middle">
                    <thead>
                        <tr><th style="width: 2rem"></th><th>Setting</th><th>Profiles</th><th>Effect</th></tr>
                    </thead>
                    <tbody>
                        <tr *ngFor="let entry of plan.significant; trackBy: trackByEntry">
                            <td>
                                <input class="form-check-input" type="checkbox"
                                       [checked]="isSelected(entry)" (change)="toggle(entry)">
                            </td>
                            <td class="key"><code>{{ entry.key }}</code></td>
                            <td class="tabular">{{ entry.profileIds.length }}</td>
                            <td class="small">
                                <span *ngIf="entry.state === 'duplicate'">will follow the group again</span>
                                <span *ngIf="entry.state === 'blank'" class="text-danger">
                                    currently blank &mdash; will start inheriting the group's value
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </ng-container>

            <ng-container *ngIf="plan.tidy.length">
                <button class="btn btn-sm btn-link px-0" (click)="showTidy = !showTidy">
                    {{ showTidy ? 'Hide' : 'Show' }} {{ tidyCount }} that only tidy the config file
                </button>
                <table class="table table-sm align-middle" *ngIf="showTidy">
                    <tbody>
                        <tr *ngFor="let entry of plan.tidy; trackBy: trackByEntry">
                            <td style="width: 2rem">
                                <input class="form-check-input" type="checkbox"
                                       [checked]="isSelected(entry)" (change)="toggle(entry)">
                            </td>
                            <td class="key"><code>{{ entry.key }}</code></td>
                            <td class="tabular">{{ entry.profileIds.length }}</td>
                            <td class="small text-muted">matches Tabby's default &mdash; no behaviour change</td>
                        </tr>
                    </tbody>
                </table>
            </ng-container>

            <div class="alert alert-warning py-2 px-3 small mt-2" *ngIf="plan.skipped.length">
                {{ plan.skipped.length }} profile{{ plan.skipped.length === 1 ? '' : 's' }} skipped for having
                no ID: {{ plan.skipped.join(', ') }}
            </div>
        </div>
        <div class="modal-footer">
            <span class="text-muted small me-auto">
                {{ selectedSettings }} setting{{ selectedSettings === 1 ? '' : 's' }} removed across
                {{ selectedProfiles }} profile{{ selectedProfiles === 1 ? '' : 's' }} &middot; 0 values changed
            </span>
            <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!selected.length" (click)="apply()">Normalize</button>
        </div>
    `,
    styles: [`
        .section-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            opacity: 0.65;
            margin-bottom: 4px;
        }

        th {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            opacity: 0.65;
            font-weight: 600;
        }

        code { font-size: 11.5px; }
        .tabular { font-variant-numeric: tabular-nums; }
        td.key { white-space: nowrap; }
    `],
})
export class NormalizeGroupModalComponent {
    groupName = ''
    plan: NormalizePlan = { significant: [], tidy: [], skipped: [] }

    showTidy = false
    selected: NormalizeEntry[] = []

    constructor(private modalInstance: NgbActiveModal) { }

    /** Behaviour-changing entries start selected; tidying is opt-in. */
    ngOnInit(): void {
        this.selected = [...this.plan.significant]
    }

    trackByEntry(_index: number, entry: NormalizeEntry): string {
        return `${entry.key} ${entry.state}`
    }

    isSelected(entry: NormalizeEntry): boolean {
        return this.selected.includes(entry)
    }

    toggle(entry: NormalizeEntry): void {
        this.selected = this.isSelected(entry)
            ? this.selected.filter(e => e !== entry)
            : [...this.selected, entry]
    }

    get tidyCount(): number {
        return countSettings(this.plan.tidy)
    }

    get selectedSettings(): number {
        return countSettings(this.selected)
    }

    get selectedProfiles(): number {
        return countProfiles(this.selected)
    }

    apply(): void {
        this.modalInstance.close({ entries: this.selected } as NormalizeResult)
    }

    cancel(): void {
        this.modalInstance.dismiss()
    }
}
