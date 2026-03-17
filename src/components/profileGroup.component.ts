import { Component, Input, Output, EventEmitter } from '@angular/core'
import { PartialProfile } from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'

export interface ProfileGroup {
    id: string
    name: string
    profiles: PartialProfile<SSHProfile>[]
    collapsed: boolean
}

@Component({
    selector: 'ssh-profile-group',
    template: `
        <ng-container>
            <!-- Group Header -->
            <div class="list-group-item list-group-item-action d-flex align-items-center group-header"
                 (click)="toggleCollapse()">
                <i class="fa fa-fw fa-chevron-right" *ngIf="group.collapsed && group.profiles.length > 0"></i>
                <i class="fa fa-fw fa-chevron-down" *ngIf="!group.collapsed && group.profiles.length > 0"></i>
                <span class="ms-2 me-auto">{{ group.name }}</span>
                <span class="badge bg-secondary">{{ group.profiles.length }}</span>
            </div>

            <!-- Group Profiles -->
            <ng-container *ngIf="!group.collapsed">
                <ng-container *ngFor="let profile of group.profiles">
                    <ssh-profile-item
                        *ngIf="isProfileVisible(profile)"
                        [profile]="profile"
                        [active]="isActiveConnection(profile)"
                        [focused]="profile.id === focusedProfileId"
                        [lastConnected]="getLastConnectedText(profile)"
                        (launch)="profileLaunched.emit($event)"
                        (contextMenu)="onProfileContextMenu($event, profile)">
                    </ssh-profile-item>
                </ng-container>
            </ng-container>
        </ng-container>
    `,
    styles: [`
        .group-header {
            background: var(--bs-tertiary-bg);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            padding: 10px 16px;
        }

        .group-header:hover {
            background: var(--bs-secondary-bg);
        }

        .badge {
            font-size: 9px;
            padding: 2px 6px;
        }
    `]
})
export class SSHProfileGroupComponent {
    @Input() group!: ProfileGroup
    @Input() filter = ''
    @Input() activeProfileIds: string[] = []
    @Input() focusedProfileId: string | null = null
    @Input() profileStats: { [id: string]: { lastConnected: number, connectionCount: number } } = {}
    @Input() activeTagFilter: string | null = null
    @Input() profileTags: { [id: string]: string[] } = {}

    @Output() collapseToggled = new EventEmitter<ProfileGroup>()
    @Output() profileLaunched = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() profileContextMenu = new EventEmitter<{ event: MouseEvent, profile: PartialProfile<SSHProfile> }>()

    toggleCollapse(): void {
        if (this.group.profiles.length === 0) {
            return
        }
        this.group.collapsed = !this.group.collapsed
        this.collapseToggled.emit(this.group)
    }

    isProfileVisible(profile: PartialProfile<SSHProfile>): boolean {
        // Tag filter
        if (this.activeTagFilter) {
            const tags = this.profileTags[profile.id || ''] || []
            if (!tags.includes(this.activeTagFilter)) return false
        }
        // Text filter
        if (!this.filter) return true
        const filterLower = this.filter.toLowerCase()
        if (this.group.name.toLowerCase().includes(filterLower)) return true
        const parts = [
            profile.name,
            profile.options?.host,
            profile.options?.user,
            profile.options?.port != null ? String(profile.options.port) : '',
        ]
        return parts.filter(Boolean).join(' ').toLowerCase().includes(filterLower)
    }

    isActiveConnection(profile: PartialProfile<SSHProfile>): boolean {
        return !!(profile.id && this.activeProfileIds.includes(profile.id))
    }

    getLastConnectedText(profile: PartialProfile<SSHProfile>): string | null {
        const stats = this.profileStats[profile.id || '']
        if (!stats?.lastConnected) return null
        const diffMs = Date.now() - stats.lastConnected
        const diffMins = Math.floor(diffMs / 60000)
        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours}h ago`
        const diffDays = Math.floor(diffHours / 24)
        if (diffDays < 30) return `${diffDays}d ago`
        return new Date(stats.lastConnected).toLocaleDateString()
    }

    onProfileContextMenu(event: MouseEvent, profile: PartialProfile<SSHProfile>): void {
        event.preventDefault()
        event.stopPropagation()
        this.profileContextMenu.emit({ event, profile })
    }
}
