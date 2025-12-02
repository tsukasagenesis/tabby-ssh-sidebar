import { Component, OnInit, OnDestroy, HostBinding, Inject, HostListener } from '@angular/core'
import {
    ProfilesService,
    AppService,
    ConfigService,
    TranslateService,
    Profile,
    PartialProfile,
    ProfileProvider,
    BaseComponent,
    PlatformService,
    HostAppService,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'
import { Subject } from 'rxjs'
import { takeUntil, debounceTime } from 'rxjs/operators'
import deepClone from 'clone-deep'

interface ProfileGroup {
    id: string
    name: string
    profiles: PartialProfile<SSHProfile>[]
    collapsed: boolean
}

interface ContextMenuPosition {
    x: number
    y: number
}

/**
 * Persistent sidebar component that displays SSH connections
 * UI adapted from Tabby's ProfilesSettingsTab component
 */
@Component({
    selector: 'ssh-sidebar',
    template: `
        <div class="ssh-sidebar-container" [class.collapsed]="collapsed">
            <!-- Sidebar Header -->
            <div class="ssh-sidebar-header">
                <div class="ssh-sidebar-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11zM1.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-13z"/>
                        <path d="M3 4.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm2 0h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
                    </svg>
                    <span>SSH Connections</span>
                </div>
                <div class="ssh-sidebar-actions">
                    <button class="btn btn-link" (click)="toggleCollapse()" title="Hide sidebar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Connection Count & Sort Bar -->
            <div class="ssh-sidebar-controls">
                <div class="ssh-sidebar-count">
                    {{ getConnectionCountText() }}
                </div>
                <div class="ssh-sidebar-sort">
                    <button
                        class="btn btn-sm"
                        [class.active]="sortBy === 'name'"
                        (click)="setSortOrder('name')"
                        title="Sort by name">
                        Name
                    </button>
                    <button
                        class="btn btn-sm"
                        [class.active]="sortBy === 'host'"
                        (click)="setSortOrder('host')"
                        title="Sort by host">
                        Host
                    </button>
                    <button
                        class="btn btn-sm"
                        [class.active]="sortBy === 'recent'"
                        (click)="setSortOrder('recent')"
                        title="Sort by recent">
                        Recent
                    </button>
                </div>
            </div>

            <!-- Search Box -->
            <div class="ssh-sidebar-search">
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="fas fa-fw fa-search"></i>
                    </span>
                    <input
                        type="search"
                        class="form-control"
                        placeholder="Filter"
                        [(ngModel)]="filter"
                        (input)="refreshFilteredProfiles()"
                    >
                </div>
            </div>

            <!-- Profiles List (Tabby-style) -->
            <div class="ssh-sidebar-list list-group">
                <ng-container *ngFor="let group of profileGroups">
                    <ng-container *ngIf="isGroupVisible(group)">
                        <!-- Group Header -->
                        <div class="list-group-item list-group-item-action d-flex align-items-center group-header"
                             (click)="toggleGroupCollapse(group)">
                            <i class="fa fa-fw fa-chevron-right" *ngIf="group.collapsed && group.profiles.length > 0"></i>
                            <i class="fa fa-fw fa-chevron-down" *ngIf="!group.collapsed && group.profiles.length > 0"></i>
                            <span class="ms-2 me-auto">{{ group.name }}</span>
                            <span class="badge bg-secondary">{{ group.profiles.length }}</span>
                        </div>

                        <!-- Group Profiles -->
                        <ng-container *ngIf="!group.collapsed">
                            <ng-container *ngFor="let profile of group.profiles">
                                <div class="list-group-item profile-item d-flex align-items-center"
                                     *ngIf="isProfileVisible(profile)"
                                     [class.active]="isActiveConnection(profile)"
                                     (click)="launchProfile(profile)"
                                     (contextmenu)="onProfileContextMenu($event, profile)">

                                    <!-- Profile Icon -->
                                    <profile-icon
                                        [icon]="profile.icon"
                                        [color]="profile.color">
                                    </profile-icon>

                                    <!-- Profile Name & Description -->
                                    <div class="profile-info">
                                        <div class="profile-name">{{ profile.name }}</div>
                                        <div class="profile-desc text-muted" *ngIf="getDescription(profile)">
                                            {{ getDescription(profile) }}
                                        </div>
                                    </div>

                                    <div class="me-auto"></div>

                                    <!-- Launch Button -->
                                    <button class="btn btn-link btn-sm hover-reveal ms-1"
                                            (click)="$event.stopPropagation(); launchProfile(profile)"
                                            title="Launch connection">
                                        <i class="fas fa-play"></i>
                                    </button>

                                    <!-- Type Badge -->
                                    <span class="ms-1 badge" [ngClass]="'text-bg-' + getTypeColorClass(profile)">
                                        {{ getTypeLabel(profile) }}
                                    </span>
                                </div>
                            </ng-container>
                        </ng-container>
                    </ng-container>
                </ng-container>

                <!-- Empty State -->
                <div *ngIf="!hasVisibleProfiles()" class="ssh-sidebar-empty">
                    <div *ngIf="sshProfiles.length === 0">
                        <p>No SSH connections found</p>
                        <small>Create SSH profiles in Tabby settings</small>
                    </div>
                    <div *ngIf="sshProfiles.length > 0">
                        <p>No matches found</p>
                        <small>Try a different search term</small>
                    </div>
                </div>
            </div>

            <!-- Context Menu -->
            <div class="context-menu"
                 *ngIf="contextMenuVisible"
                 [style.left.px]="contextMenuPosition.x"
                 [style.top.px]="contextMenuPosition.y">
                <div class="context-menu-item" (click)="contextMenuLaunch()">
                    <i class="fas fa-fw fa-play"></i>
                    <span>Launch</span>
                </div>
                <div class="context-menu-item" (click)="contextMenuEdit()">
                    <i class="fas fa-fw fa-edit"></i>
                    <span>Edit</span>
                </div>
                <div class="context-menu-item" (click)="contextMenuDuplicate()">
                    <i class="fas fa-fw fa-copy"></i>
                    <span>Duplicate</span>
                </div>
                <div class="context-menu-item" (click)="contextMenuCopySSHCommand()">
                    <i class="fas fa-fw fa-terminal"></i>
                    <span>Copy SSH Command</span>
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item"
                     *ngIf="contextMenuProfile && contextMenuProfile.id && !isProfileBlacklisted(contextMenuProfile)"
                     (click)="contextMenuBlacklist()">
                    <i class="fas fa-fw fa-eye-slash"></i>
                    <span>Hide from Selector</span>
                </div>
                <div class="context-menu-item"
                     *ngIf="contextMenuProfile && contextMenuProfile.id && isProfileBlacklisted(contextMenuProfile)"
                     (click)="contextMenuUnblacklist()">
                    <i class="fas fa-fw fa-eye"></i>
                    <span>Show in Selector</span>
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item"
                     *ngIf="contextMenuProfile && contextMenuProfile.id && !isProfilePinned(contextMenuProfile)"
                     (click)="contextMenuPin()">
                    <i class="fas fa-fw fa-thumbtack"></i>
                    <span>Pin to Favorites</span>
                </div>
                <div class="context-menu-item"
                     *ngIf="contextMenuProfile && contextMenuProfile.id && isProfilePinned(contextMenuProfile)"
                     (click)="contextMenuUnpin()">
                    <i class="fas fa-fw fa-thumbtack" style="transform: rotate(45deg);"></i>
                    <span>Unpin from Favorites</span>
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item context-menu-item-danger"
                     *ngIf="contextMenuProfile && !contextMenuProfile.isBuiltin"
                     (click)="contextMenuDelete()">
                    <i class="fas fa-fw fa-trash-alt"></i>
                    <span>Delete</span>
                </div>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            height: 100%;
            width: 100%;
        }

        .ssh-sidebar-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--bs-body-bg);
            transition: all 0.3s ease;
        }

        .ssh-sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--bs-border-color);
            background: var(--bs-tertiary-bg);
        }

        .ssh-sidebar-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }

        .ssh-sidebar-actions .btn {
            padding: 4px;
            opacity: 0.6;
        }

        .ssh-sidebar-actions .btn:hover {
            opacity: 1;
        }

        .ssh-sidebar-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-bottom: 1px solid var(--bs-border-color);
            background: var(--bs-body-bg);
            font-size: 12px;
        }

        .ssh-sidebar-count {
            color: var(--bs-secondary-color);
            font-weight: 500;
        }

        .ssh-sidebar-sort {
            display: flex;
            gap: 4px;
        }

        .ssh-sidebar-sort .btn {
            padding: 2px 8px;
            font-size: 11px;
            border: 1px solid var(--bs-border-color);
            background: var(--bs-body-bg);
            color: var(--bs-body-color);
            opacity: 0.6;
            transition: all 0.2s ease;
        }

        .ssh-sidebar-sort .btn:hover {
            opacity: 0.9;
            background: var(--bs-tertiary-bg);
        }

        .ssh-sidebar-sort .btn.active {
            opacity: 1;
            background: var(--bs-primary);
            color: white;
            border-color: var(--bs-primary);
        }

        .ssh-sidebar-search {
            padding: 12px;
            border-bottom: 1px solid var(--bs-border-color);
        }

        .ssh-sidebar-search .input-group-text {
            background: var(--bs-tertiary-bg);
            border-right: none;
            color: var(--bs-secondary-color);
        }

        .ssh-sidebar-search input {
            background: var(--bs-tertiary-bg);
            border-left: none;
            color: var(--bs-body-color);
        }

        .ssh-sidebar-list {
            flex: 1;
            overflow-y: auto;
            padding: 0;
        }

        .ssh-sidebar-empty {
            padding: 40px 20px;
            text-align: center;
            color: var(--bs-secondary-color);
        }

        .ssh-sidebar-empty p {
            margin: 0 0 8px 0;
            font-weight: 500;
        }

        .ssh-sidebar-empty small {
            font-size: 12px;
        }

        /* Group Header Styling */
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

        /* Profile Item Styling */
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

        /* Profile Info */
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

        /* Profile Icon Sizing */
        profile-icon {
            width: 1.25rem;
            flex-shrink: 0;
        }

        /* Hover Reveal Buttons */
        .hover-reveal {
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .profile-item:hover .hover-reveal {
            opacity: 1;
        }

        /* Badge Styling */
        .badge {
            font-size: 9px;
            padding: 2px 6px;
        }

        /* Button Styling */
        .btn-link {
            color: var(--bs-body-color);
            text-decoration: none;
        }

        .btn-link:hover {
            color: var(--bs-primary);
        }

        /* Context Menu Styling */
        .context-menu {
            position: fixed;
            background: var(--bs-body-bg);
            border: 1px solid var(--bs-border-color);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 200px;
            padding: 4px 0;
            font-size: 13px;
        }

        .context-menu-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.2s ease;
            color: var(--bs-body-color);
        }

        .context-menu-item:hover {
            background: var(--bs-tertiary-bg);
        }

        .context-menu-item-danger {
            color: var(--bs-danger);
        }

        .context-menu-item-danger:hover {
            background: var(--bs-danger);
            color: white;
        }

        .context-menu-item i {
            width: 14px;
            text-align: center;
        }

        .context-menu-divider {
            height: 1px;
            background: var(--bs-border-color);
            margin: 4px 0;
        }
    `]
})
export class SSHSidebarComponent extends BaseComponent implements OnInit, OnDestroy {
    @HostBinding('class.ssh-sidebar') hostClass = true

    sshProfiles: PartialProfile<SSHProfile>[] = []
    profileGroups: ProfileGroup[] = []
    filter = ''
    collapsed = false
    configGroups: any[] = []
    sortBy: 'name' | 'host' | 'recent' = 'name'
    pinnedProfiles: string[] = [] // Array of profile IDs

    // Context menu state
    contextMenuVisible = false
    contextMenuPosition: ContextMenuPosition = { x: 0, y: 0 }
    contextMenuProfile: PartialProfile<SSHProfile> | null = null

    private destroy$ = new Subject<void>()
    public sidebarService: any = null  // Will be injected by the service

    constructor(
        private profiles: ProfilesService,
        private app: AppService,
        private config: ConfigService,
        private translate: TranslateService,
        private platform: PlatformService,
        private hostApp: HostAppService,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
    ) {
        super()
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        // Close context menu when clicking outside
        this.contextMenuVisible = false
    }

    async ngOnInit(): Promise<void> {
        // Load config groups
        this.configGroups = this.config.store.groups || []

        // Load pinned profiles
        this.loadPinnedProfiles()

        await this.refreshProfiles()
        await this.refreshProfileGroups()

        // Watch for config changes (profiles added/deleted/modified)
        // Config changes include profile edits, additions, and deletions
        // Debounce to avoid multiple rapid refreshes
        this.config.changed$
            .pipe(
                takeUntil(this.destroy$),
                debounceTime(300)
            )
            .subscribe(async () => {
                this.configGroups = this.config.store.groups || []
                await this.refreshProfiles()
                await this.refreshProfileGroups()
            })

        // Watch for tab changes to update active connection indicators
        this.app.tabsChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                // Force change detection for active state
            })

        // Load collapsed state from config
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        this.collapsed = pluginConfig.sidebarCollapsed || false
    }

    ngOnDestroy(): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    async refreshProfiles(): Promise<void> {
        const allProfiles = await this.profiles.getProfiles()
        this.sshProfiles = allProfiles.filter(p => {
            // Only include SSH profiles
            if (p.type !== 'ssh') {
                return false
            }

            // Exclude template profiles
            if (p.isTemplate) {
                return false
            }

            // Exclude profiles without a host
            const sshProfile = p as PartialProfile<SSHProfile>
            if (!sshProfile.options?.host) {
                return false
            }

            return true
        }) as PartialProfile<SSHProfile>[]
        await this.refreshProfileGroups()
    }

    async refreshProfileGroups(): Promise<void> {
        const profileGroupCollapsed = JSON.parse(window.localStorage.profileGroupCollapsed ?? '{}')

        // Sort profiles first
        await this.sortProfiles()

        // Group profiles by their group property
        const grouped: { [key: string]: PartialProfile<SSHProfile>[] } = {}

        for (const profile of this.sshProfiles) {
            const groupId = profile.group || 'ungrouped'
            if (!grouped[groupId]) {
                grouped[groupId] = []
            }
            grouped[groupId].push(profile)
        }

        // Convert to ProfileGroup array
        this.profileGroups = Object.entries(grouped).map(([groupId, profiles]) => {
            let groupName = groupId
            if (groupId !== 'ungrouped') {
                // Try to resolve group ID to name from config
                const configGroup = this.configGroups.find(g => g.id === groupId)
                if (configGroup) {
                    groupName = configGroup.name
                }
            } else {
                groupName = 'Ungrouped'
            }

            return {
                id: groupId,
                name: groupName,
                profiles,
                collapsed: profileGroupCollapsed[groupId] ?? false,
            }
        })

        // Add Favorites group at the top if there are pinned profiles
        if (this.pinnedProfiles.length > 0) {
            const pinnedProfileObjects = this.sshProfiles.filter(p =>
                p.id && this.pinnedProfiles.includes(p.id)
            )

            if (pinnedProfileObjects.length > 0) {
                // Remove pinned profiles from other groups
                this.profileGroups.forEach(group => {
                    group.profiles = group.profiles.filter(p =>
                        !p.id || !this.pinnedProfiles.includes(p.id)
                    )
                })

                // Add Favorites group at the beginning
                this.profileGroups.unshift({
                    id: 'favorites',
                    name: '⭐ Favorites',
                    profiles: pinnedProfileObjects,
                    collapsed: profileGroupCollapsed['favorites'] ?? false,
                })
            }
        }

        // Remove empty groups
        this.profileGroups = this.profileGroups.filter(group =>
            group.profiles.length > 0
        )

        // Sort groups: favorites first, ungrouped second, then alphabetically
        this.profileGroups.sort((a, b) => {
            if (a.id === 'favorites') return -1
            if (b.id === 'favorites') return 1
            if (a.id === 'ungrouped') return -1
            if (b.id === 'ungrouped') return 1
            return a.name.localeCompare(b.name)
        })
    }

    async sortProfiles(): Promise<void> {
        if (this.sortBy === 'recent') {
            // Use Tabby's built-in recent profiles tracking
            const recentProfiles = await this.profiles.getRecentProfiles()
            const recentIds = recentProfiles.map(p => p.id)

            this.sshProfiles.sort((a, b) => {
                // Active connections always come first
                const aActive = this.isActiveConnection(a)
                const bActive = this.isActiveConnection(b)
                if (aActive && !bActive) return -1
                if (!aActive && bActive) return 1

                // Then sort by Tabby's recent profiles order
                const aIndex = recentIds.indexOf(a.id)
                const bIndex = recentIds.indexOf(b.id)

                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex
                }
                if (aIndex !== -1) return -1
                if (bIndex !== -1) return 1
                return a.name.localeCompare(b.name)
            })
        } else {
            // Synchronous sorting for name and host
            this.sshProfiles.sort((a, b) => {
                switch (this.sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name)
                    case 'host':
                        const hostA = a.options?.host || ''
                        const hostB = b.options?.host || ''
                        return hostA.localeCompare(hostB)
                    default:
                        return 0
                }
            })
        }
    }

    async setSortOrder(sortBy: 'name' | 'host' | 'recent'): Promise<void> {
        this.sortBy = sortBy
        await this.refreshProfileGroups()
    }

    refreshFilteredProfiles(): void {
        // Filter is applied in the template via isProfileVisible
    }

    isGroupVisible(group: ProfileGroup): boolean {
        return !this.filter || group.profiles.some(x => this.isProfileVisible(x))
    }

    isProfileVisible(profile: PartialProfile<Profile>): boolean {
        if (!this.filter) {
            return true
        }
        const searchText = (profile.name + '$' + (this.getDescription(profile) ?? '')).toLowerCase()
        return searchText.includes(this.filter.toLowerCase())
    }

    hasVisibleProfiles(): boolean {
        return this.profileGroups.some(g => this.isGroupVisible(g))
    }

    getDescription(profile: PartialProfile<Profile>): string | null {
        // Try to use ProfilesService method if available, otherwise construct manually
        if (this.profiles.getDescription) {
            return this.profiles.getDescription(profile)
        }

        // Fallback: construct description for SSH profiles
        const sshProfile = profile as PartialProfile<SSHProfile>
        if (sshProfile.options) {
            const user = sshProfile.options.user || 'root'
            const host = sshProfile.options.host || 'unknown'
            const port = sshProfile.options.port || 22
            return `${user}@${host}${port !== 22 ? ':' + port : ''}`
        }
        return null
    }

    getTypeLabel(profile: PartialProfile<Profile>): string {
        const provider = this.profiles.providerForProfile(profile)
        const name = provider?.name
        if (name === 'Local terminal') {
            return ''
        }
        return name ? this.translate.instant(name) : this.translate.instant('Unknown')
    }

    getTypeColorClass(profile: PartialProfile<Profile>): string {
        const provider = this.profiles.providerForProfile(profile)
        return {
            ssh: 'secondary',
            serial: 'success',
            telnet: 'info',
            'split-layout': 'primary',
        }[provider?.id ?? ''] ?? 'warning'
    }

    toggleGroupCollapse(group: ProfileGroup): void {
        if (group.profiles.length === 0) {
            return
        }
        group.collapsed = !group.collapsed
        this.saveProfileGroupCollapse(group)
    }

    launchProfile(profile: PartialProfile<Profile>): void {
        if (this.profiles.openNewTabForProfile) {
            this.profiles.openNewTabForProfile(profile)
        } else {
            // Fallback to launchProfile method
            (this.profiles as any).launchProfile(profile)
        }
    }

    isActiveConnection(profile: PartialProfile<SSHProfile>): boolean {
        // Check if there's an active tab with this profile
        return this.app.tabs.some(tab => {
            const tabProfile = (tab as any).profile
            return tabProfile &&
                   tabProfile.type === 'ssh' &&
                   tabProfile.id === profile.id
        })
    }

    isProfileBlacklisted(profile: PartialProfile<Profile>): boolean {
        return profile.id && this.config.store.profileBlacklist.includes(profile.id)
    }

    getConnectionCountText(): string {
        const total = this.sshProfiles.length
        const active = this.sshProfiles.filter(p => this.isActiveConnection(p)).length

        if (active === 0) {
            return `${total} connection${total !== 1 ? 's' : ''}`
        }
        return `${total} connection${total !== 1 ? 's' : ''} (${active} active)`
    }

    toggleCollapse(): void {
        // If the service is available, use it to hide the sidebar completely
        if (this.sidebarService) {
            this.sidebarService.hide()
        } else {
            // Fallback: just collapse internally
            this.collapsed = !this.collapsed

            // Save state to config
            const pluginConfig = this.config.store.pluginConfig || {}
            if (!pluginConfig['ssh-sidebar']) {
                pluginConfig['ssh-sidebar'] = {}
            }
            pluginConfig['ssh-sidebar'].sidebarCollapsed = this.collapsed
            this.config.store.pluginConfig = pluginConfig
            this.config.save()
        }
    }

    // Context Menu Methods
    onProfileContextMenu(event: MouseEvent, profile: PartialProfile<SSHProfile>): void {
        event.preventDefault()
        event.stopPropagation()

        this.contextMenuProfile = profile
        this.contextMenuPosition = {
            x: event.clientX,
            y: event.clientY,
        }
        this.contextMenuVisible = true
    }

    contextMenuLaunch(): void {
        if (this.contextMenuProfile) {
            this.launchProfile(this.contextMenuProfile)
        }
        this.contextMenuVisible = false
    }

    async contextMenuEdit(): Promise<void> {
        if (!this.contextMenuProfile) {
            this.contextMenuVisible = false
            return
        }

        const profileToEdit = this.contextMenuProfile
        const profileName = profileToEdit.name
        const profileId = profileToEdit.id

        try {
            // Use Tabby's pattern for opening settings with profiles tab
            const { SettingsTabComponent } = window['nodeRequire']('tabby-settings')

            // Check if a settings tab is already open
            const existingSettingsTab = this.app.tabs.find(tab => tab instanceof SettingsTabComponent)

            if (existingSettingsTab) {
                // Reuse existing settings tab
                console.log('Reusing existing settings tab')
                this.app.selectTab(existingSettingsTab)

                // Switch to profiles tab if not already there
                const settingsComponent = existingSettingsTab as any
                if (settingsComponent.activeTab !== 'profiles') {
                    settingsComponent.activeTab = 'profiles'
                }
            } else {
                // Open new settings tab
                console.log('Opening new settings tab')
                this.app.openNewTabRaw({
                    type: SettingsTabComponent,
                    inputs: { activeTab: 'profiles' },
                })
            }

            // Wait for the settings tab to render
            await new Promise(resolve => setTimeout(resolve, 500))

            // Try to find and click the profile element in the settings tab
            // The ProfilesSettingsTab renders profiles as clickable list items
            // Structure: .list-group-item.ps-5 (profile item, has padding-start: 5)
            //   - Click on the main element triggers editProfile()
            //   - DO NOT click on the .fa-play button (that launches the profile)
            let clicked = false

            // Try multiple times with increasing delays to handle async rendering
            for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200))
                }

                // Find profile list items - they have .ps-5 class (padding-start: 5rem)
                // This distinguishes them from group headers
                const profileElements = document.querySelectorAll('.list-group-item.ps-5')

                for (const element of Array.from(profileElements)) {
                    const textContent = element.textContent || ''

                    // Check if this element contains our profile name
                    if (textContent.includes(profileName)) {
                        console.log(`Found profile element for "${profileName}", attempting click...`)

                        // Make sure we're clicking on the main element, not a button
                        // The template structure has the profile name in a .no-wrap div
                        const nameElement = element.querySelector('.no-wrap')

                        if (nameElement && nameElement.textContent?.trim() === profileName) {
                            console.log(`Exact match found, clicking on profile name element...`)

                            try {
                                // Click on the name element (guaranteed to trigger editProfile)
                                const clickable = nameElement as HTMLElement
                                clickable.click()
                                console.log(`Clicked profile name for "${profileName}"`)
                                clicked = true
                                break
                            } catch (err) {
                                console.debug('Error clicking name element, trying main element:', err)

                                // Fallback: click on the main list item
                                try {
                                    (element as HTMLElement).click()
                                    console.log(`Clicked main element for "${profileName}"`)
                                    clicked = true
                                    break
                                } catch (err2) {
                                    console.debug('Error clicking main element:', err2)
                                }
                            }
                        }
                    }
                }
            }

            if (clicked) {
                console.log('Successfully triggered profile edit by simulating click')
            } else {
                console.warn('Could not find profile element to click')
                console.info(`Please manually click on "${profileName}" in the profiles list to edit it`)
            }
        } catch (error) {
            console.error('Failed to open settings or trigger edit:', error)
        }

        this.contextMenuVisible = false
    }

    async contextMenuDuplicate(): Promise<void> {
        if (!this.contextMenuProfile) {
            this.contextMenuVisible = false
            return
        }

        const baseProfile: PartialProfile<Profile> = deepClone(this.contextMenuProfile)
        delete baseProfile.id
        baseProfile.name = this.translate.instant('{name} copy', this.contextMenuProfile)
        baseProfile.isBuiltin = false
        baseProfile.isTemplate = false

        // Write the new profile
        this.config.store.profiles = this.config.store.profiles || []
        this.config.store.profiles.push(baseProfile)
        await this.config.save()

        // Refresh the profile list
        await this.refreshProfiles()

        this.contextMenuVisible = false
    }

    contextMenuCopySSHCommand(): void {
        if (!this.contextMenuProfile) {
            this.contextMenuVisible = false
            return
        }

        const profile = this.contextMenuProfile
        const user = profile.options?.user || 'root'
        const host = profile.options?.host || 'unknown'
        const port = profile.options?.port || 22

        let command = `ssh ${user}@${host}`
        if (port !== 22) {
            command += ` -p ${port}`
        }

        // Copy to clipboard
        this.platform.setClipboard({ text: command })

        this.contextMenuVisible = false
    }

    contextMenuBlacklist(): void {
        if (this.contextMenuProfile && this.contextMenuProfile.id) {
            this.config.store.profileBlacklist = [...this.config.store.profileBlacklist, this.contextMenuProfile.id]
            this.config.save()
        }
        this.contextMenuVisible = false
    }

    contextMenuUnblacklist(): void {
        if (this.contextMenuProfile && this.contextMenuProfile.id) {
            this.config.store.profileBlacklist = this.config.store.profileBlacklist.filter(x => x !== this.contextMenuProfile!.id)
            this.config.save()
        }
        this.contextMenuVisible = false
    }

    async contextMenuDelete(): Promise<void> {
        if (!this.contextMenuProfile || this.contextMenuProfile.isBuiltin) {
            this.contextMenuVisible = false
            return
        }

        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: this.translate.instant('Delete "{name}"?', this.contextMenuProfile),
            buttons: [
                this.translate.instant('Delete'),
                this.translate.instant('Cancel'),
            ],
            defaultId: 1,
            cancelId: 1,
        })

        if (result.response === 0) {
            // Remove from config
            this.config.store.profiles = this.config.store.profiles.filter(p => p.id !== this.contextMenuProfile!.id)
            await this.config.save()

            // Refresh the profile list
            await this.refreshProfiles()
        }

        this.contextMenuVisible = false
    }

    async contextMenuPin(): Promise<void> {
        if (!this.contextMenuProfile || !this.contextMenuProfile.id) {
            this.contextMenuVisible = false
            return
        }

        // Add to pinned profiles
        if (!this.pinnedProfiles.includes(this.contextMenuProfile.id)) {
            this.pinnedProfiles.push(this.contextMenuProfile.id)
            this.savePinnedProfiles()
            await this.refreshProfileGroups()
        }

        this.contextMenuVisible = false
    }

    async contextMenuUnpin(): Promise<void> {
        if (!this.contextMenuProfile || !this.contextMenuProfile.id) {
            this.contextMenuVisible = false
            return
        }

        // Remove from pinned profiles
        this.pinnedProfiles = this.pinnedProfiles.filter(id => id !== this.contextMenuProfile!.id)
        this.savePinnedProfiles()
        await this.refreshProfileGroups()

        this.contextMenuVisible = false
    }

    isProfilePinned(profile: PartialProfile<SSHProfile>): boolean {
        return profile.id ? this.pinnedProfiles.includes(profile.id) : false
    }

    private savePinnedProfiles(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.pinnedProfiles = this.pinnedProfiles
        if (!this.config.store.pluginConfig) {
            this.config.store.pluginConfig = {}
        }
        this.config.store.pluginConfig['ssh-sidebar'] = pluginConfig
        this.config.save()
    }

    private loadPinnedProfiles(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        this.pinnedProfiles = pluginConfig.pinnedProfiles || []
    }

    private saveProfileGroupCollapse(group: ProfileGroup): void {
        const profileGroupCollapsed = JSON.parse(window.localStorage.profileGroupCollapsed ?? '{}')
        profileGroupCollapsed[group.id] = group.collapsed
        window.localStorage.profileGroupCollapsed = JSON.stringify(profileGroupCollapsed)
    }
}
