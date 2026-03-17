import { Component, Input, Output, EventEmitter } from '@angular/core'
import {
    ProfilesService,
    TranslateService,
    PartialProfile,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'

@Component({
    selector: 'ssh-profile-item',
    template: `
        <div class="list-group-item profile-item d-flex align-items-center"
             [class.active]="active"
             [class.keyboard-focused]="focused"
             [title]="lastConnected ? 'Last connected: ' + lastConnected : ''"
             (click)="launch.emit(profile)"
             (contextmenu)="contextMenu.emit($event)">

            <profile-icon
                [icon]="profile.icon"
                [color]="profile.color">
            </profile-icon>

            <div class="profile-info">
                <div class="profile-name">{{ profile.name }}</div>
                <div class="profile-desc text-muted" *ngIf="description">
                    {{ description }}
                </div>
            </div>

            <div class="me-auto"></div>

            <button class="btn btn-link btn-sm hover-reveal ms-1"
                    (click)="$event.stopPropagation(); launch.emit(profile)"
                    title="Launch connection">
                <i class="fas fa-play"></i>
            </button>

            <span class="ms-1 badge" [ngClass]="'text-bg-' + typeColorClass">
                {{ typeLabel }}
            </span>
        </div>
    `,
    styles: [`
        .profile-item {
            padding: 10px 12px 10px 12px;
            cursor: pointer;
            border-left: 3px solid transparent;
            transition: all 0.2s ease;
        }

        .profile-item:hover {
            background: var(--bs-tertiary-bg);
        }

        .profile-item.active {
            background: var(--bs-primary-bg-subtle);
            border-left-color: var(--bs-primary);
        }

        .profile-item.keyboard-focused {
            background: var(--bs-tertiary-bg);
            outline: 1px solid var(--bs-primary);
            outline-offset: -1px;
        }

        .profile-info {
            flex: 1;
            min-width: 0;
            margin-left: 8px;
        }

        .profile-name {
            font-weight: 500;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .profile-desc {
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        profile-icon {
            width: 1.25rem;
            flex-shrink: 0;
        }

        .hover-reveal {
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .profile-item:hover .hover-reveal {
            opacity: 1;
        }

        .badge {
            font-size: 9px;
            padding: 2px 6px;
        }

        .btn-link {
            color: var(--bs-body-color);
            text-decoration: none;
        }

        .btn-link:hover {
            color: var(--bs-primary);
        }
    `]
})
export class SSHProfileItemComponent {
    @Input() profile!: PartialProfile<SSHProfile>
    @Input() active = false
    @Input() focused = false
    @Input() lastConnected: string | null = null

    @Output() launch = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() contextMenu = new EventEmitter<MouseEvent>()

    constructor(
        private profiles: ProfilesService,
        private translate: TranslateService,
    ) {}

    get description(): string | null {
        if (this.profiles.getDescription) {
            return this.profiles.getDescription(this.profile)
        }

        const sshProfile = this.profile as PartialProfile<SSHProfile>
        if (sshProfile.options) {
            const user = sshProfile.options.user || 'root'
            const host = sshProfile.options.host || 'unknown'
            const port = sshProfile.options.port || 22
            return `${user}@${host}${port !== 22 ? ':' + port : ''}`
        }
        return null
    }

    get typeLabel(): string {
        const provider = this.profiles.providerForProfile(this.profile)
        const name = provider?.name
        if (name === 'Local terminal') {
            return ''
        }
        return name ? this.translate.instant(name) : this.translate.instant('Unknown')
    }

    get typeColorClass(): string {
        const provider = this.profiles.providerForProfile(this.profile)
        return {
            ssh: 'secondary',
            serial: 'success',
            telnet: 'info',
            'split-layout': 'primary',
        }[provider?.id ?? ''] ?? 'warning'
    }
}
