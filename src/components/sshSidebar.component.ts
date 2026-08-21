import { Component, OnInit, OnDestroy, HostBinding, Inject, HostListener, ViewChild, ElementRef } from '@angular/core'
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
    SelectorService,
    SelectorOption,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subject } from 'rxjs'
import { takeUntil, debounceTime } from 'rxjs/operators'
import deepClone from 'clone-deep'

interface ProfileGroup {
    id: string
    name: string
    profiles: PartialProfile<SSHProfile>[]
    collapsed: boolean
    icon?: string
    color?: string
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
                    {{ connectionCountText }}
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
                             (click)="toggleGroupCollapse(group)"
                             (contextmenu)="onGroupContextMenu($event, group)">
                            <i class="fa fa-fw"
                               [class.fa-chevron-right]="group.collapsed"
                               [class.fa-chevron-down]="!group.collapsed"
                               [style.visibility]="group.profiles.length > 0 ? 'visible' : 'hidden'"></i>
                            <i class="fa-fw ms-1 group-icon"
                               [ngClass]="group.icon || 'far fa-folder'"
                               [style.color]="group.color || null"></i>
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
                 #contextMenu
                 *ngIf="contextMenuVisible"
                 [style.left.px]="contextMenuPosition.x"
                 [style.top.px]="contextMenuPosition.y">

                <!-- Group menu -->
                <ng-container *ngIf="contextMenuMode === 'group'">
                    <div class="context-menu-header">{{ contextMenuGroup?.name }}</div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-item"
                         *ngIf="contextMenuGroup && isEditableGroup(contextMenuGroup)"
                         (click)="contextMenuEditGroup()">
                        <i class="fas fa-fw fa-edit"></i>
                        <span>Edit Group &amp; Defaults</span>
                    </div>
                    <div class="context-menu-item"
                         *ngIf="contextMenuGroup && !isEditableGroup(contextMenuGroup)"
                         (click)="contextMenuVisible = false">
                        <i class="fas fa-fw fa-info-circle"></i>
                        <span>Not a real group</span>
                    </div>
                    <div class="context-menu-item" (click)="contextMenuCollapseGroup()">
                        <i class="fas fa-fw" [ngClass]="contextMenuGroup?.collapsed ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                        <span>{{ contextMenuGroup?.collapsed ? 'Expand' : 'Collapse' }}</span>
                    </div>
                </ng-container>

                <!-- Profile menu -->
                <ng-container *ngIf="contextMenuMode === 'profile'">
                <div class="context-menu-item" (click)="contextMenuLaunch()">
                    <i class="fas fa-fw fa-play"></i>
                    <span>Launch</span>
                </div>
                <div class="context-menu-item"
                     *ngIf="contextMenuProfile && !contextMenuProfile.isBuiltin"
                     (click)="contextMenuEdit()">
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
                     *ngIf="contextMenuProfile && !contextMenuProfile.isBuiltin"
                     (click)="contextMenuMoveToGroup()">
                    <i class="fas fa-fw fa-folder-open"></i>
                    <span>Move to Group...</span>
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
                </ng-container>
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

        .group-icon {
            opacity: 0.75;
            font-size: 12px;
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
            /* Never taller than the viewport - scroll instead of overflowing */
            max-height: calc(100vh - 16px);
            overflow-y: auto;
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

        .context-menu-header {
            padding: 6px 16px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--bs-secondary-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
    connectionCountText = ''

    // Template getters run on every change detection pass, and this list can be
    // hundreds of rows long. Anything that costs more than a map lookup has to be
    // computed on refresh instead of per render - notably descriptions, which go
    // through ProfilesService.getConfigProxyForProfile (four deepmerges plus a
    // ConfigProxy construction, per profile, per call).
    private descriptionCache = new Map<string, string | null>()
    private activeProfileIds = new Set<string>()
    private typeLabelCache = new Map<string, string>()
    private typeColorCache = new Map<string, string>()

    // Context menu state
    contextMenuVisible = false
    contextMenuMode: 'profile' | 'group' = 'profile'
    contextMenuPosition: ContextMenuPosition = { x: 0, y: 0 }
    contextMenuProfile: PartialProfile<SSHProfile> | null = null
    contextMenuGroup: ProfileGroup | null = null

    @ViewChild('contextMenu') contextMenuElement?: ElementRef<HTMLElement>

    private destroy$ = new Subject<void>()
    public sidebarService: any = null  // Will be injected by the service

    constructor(
        private profiles: ProfilesService,
        private app: AppService,
        private config: ConfigService,
        private translate: TranslateService,
        private platform: PlatformService,
        private hostApp: HostAppService,
        private ngbModal: NgbModal,
        private selector: SelectorService,
        @Inject(ProfileProvider) private profileProviders: ProfileProvider<Profile>[],
    ) {
        super()
    }

    /**
     * Builds a profile ID in the same format Tabby's ProfilesService uses.
     * Used only as a fallback when ProfilesService.newProfile is unavailable.
     */
    private generateProfileId(profile: PartialProfile<Profile>): string {
        const slug = (profile.name || 'profile')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
        return `${profile.type}:custom:${slug}:${uuid}`
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

        // refreshProfiles() already rebuilds the groups, so calling
        // refreshProfileGroups() as well just did the whole job twice
        await this.refreshProfiles()

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
            })

        // Watch for tab changes to update active connection indicators
        this.app.tabsChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.refreshActiveConnections()
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

        // Descriptions are expensive to derive, so build them once per refresh
        // rather than letting the template recompute them every render
        this.descriptionCache.clear()
        for (const profile of this.sshProfiles) {
            this.descriptionCache.set(this.profileCacheKey(profile), this.computeDescription(profile))
        }

        await this.refreshProfileGroups()
    }

    private profileCacheKey(profile: PartialProfile<Profile>): string {
        return profile.id ?? `name:${profile.name}`
    }

    /**
     * Recomputes which profiles have a live tab, plus the header count text.
     * Both used to be derived inside template getters, which meant walking every
     * profile and every open tab on each change detection pass.
     */
    private refreshActiveConnections(): void {
        const active = new Set<string>()
        for (const tab of this.app.tabs) {
            const tabProfile = (tab as any).profile
            if (tabProfile && tabProfile.type === 'ssh' && tabProfile.id) {
                active.add(tabProfile.id)
            }
        }
        this.activeProfileIds = active

        const total = this.sshProfiles.length
        let activeCount = 0
        for (const profile of this.sshProfiles) {
            if (profile.id && active.has(profile.id)) {
                activeCount++
            }
        }

        const plural = total !== 1 ? 's' : ''
        this.connectionCountText = activeCount === 0
            ? `${total} connection${plural}`
            : `${total} connection${plural} (${activeCount} active)`
    }

    async refreshProfileGroups(): Promise<void> {
        const profileGroupCollapsed = JSON.parse(window.localStorage.profileGroupCollapsed ?? '{}')

        // Must run before sortProfiles - the 'recent' sort puts active
        // connections first, and reads this
        this.refreshActiveConnections()

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

        // Seed every configured group, so a group with no hosts in it yet - one
        // you have just created, or one you emptied - still shows up and can be
        // moved into. Groups used to be derived purely from the profiles, which
        // made a new group invisible until something was already in it.
        for (const configGroup of this.configGroups) {
            if (configGroup?.id && !grouped[configGroup.id]) {
                grouped[configGroup.id] = []
            }
        }

        // Convert to ProfileGroup array
        this.profileGroups = Object.entries(grouped).map(([groupId, profiles]) => {
            let groupName = groupId
            let groupIcon: string | undefined
            let groupColor: string | undefined

            if (groupId !== 'ungrouped') {
                // Try to resolve group ID to name from config
                const configGroup = this.configGroups.find(g => g.id === groupId)
                if (configGroup) {
                    groupName = configGroup.name
                    groupIcon = configGroup.icon
                    groupColor = configGroup.color
                }
            } else {
                groupName = 'Ungrouped'
            }

            return {
                id: groupId,
                name: groupName,
                profiles,
                collapsed: profileGroupCollapsed[groupId] ?? false,
                icon: groupIcon,
                color: groupColor,
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

        // Drop empty synthetic groups ('ungrouped'), but keep empty real ones so
        // configured groups stay visible even when nothing is in them
        this.profileGroups = this.profileGroups.filter(group =>
            group.profiles.length > 0 || this.configGroups.some(g => g?.id === group.id)
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
        const key = this.profileCacheKey(profile)
        const cached = this.descriptionCache.get(key)
        if (cached !== undefined) {
            return cached
        }
        const computed = this.computeDescription(profile)
        this.descriptionCache.set(key, computed)
        return computed
    }

    private computeDescription(profile: PartialProfile<Profile>): string | null {
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
        // Keyed by profile type - the label only ever depends on the provider
        const typeKey = profile.type ?? ''
        const cached = this.typeLabelCache.get(typeKey)
        if (cached !== undefined) {
            return cached
        }

        const provider = this.profiles.providerForProfile(profile)
        const name = provider?.name
        const label = name === 'Local terminal'
            ? ''
            : name ? this.translate.instant(name) : this.translate.instant('Unknown')

        this.typeLabelCache.set(typeKey, label)
        return label
    }

    getTypeColorClass(profile: PartialProfile<Profile>): string {
        const typeKey = profile.type ?? ''
        const cached = this.typeColorCache.get(typeKey)
        if (cached !== undefined) {
            return cached
        }

        const provider = this.profiles.providerForProfile(profile)
        const colorClass = {
            ssh: 'secondary',
            serial: 'success',
            telnet: 'info',
            'split-layout': 'primary',
        }[provider?.id ?? ''] ?? 'warning'

        this.typeColorCache.set(typeKey, colorClass)
        return colorClass
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
        // Set lookup - the set is rebuilt on refresh and whenever tabs change
        return !!profile.id && this.activeProfileIds.has(profile.id)
    }

    isProfileBlacklisted(profile: PartialProfile<Profile>): boolean {
        return profile.id && this.config.store.profileBlacklist.includes(profile.id)
    }

    getConnectionCountText(): string {
        return this.connectionCountText
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

        this.contextMenuMode = 'profile'
        this.contextMenuGroup = null
        this.contextMenuProfile = profile
        this.contextMenuPosition = {
            x: event.clientX,
            y: event.clientY,
        }
        this.contextMenuVisible = true

        // The menu is created by *ngIf, so it cannot be measured until Angular
        // has rendered it. Its height also varies with which items are visible
        // (pin/unpin, hide/show, delete), so it has to be measured rather than
        // assumed.
        setTimeout(() => this.keepContextMenuOnScreen())
    }

    /**
     * Flips the context menu back over the cursor when it would otherwise run
     * off the bottom or right edge of the window, the way a native menu does.
     */
    private keepContextMenuOnScreen(): void {
        const menu = this.contextMenuElement?.nativeElement
        if (!menu) {
            return
        }

        const margin = 8
        const width = menu.offsetWidth
        const height = menu.offsetHeight
        let { x, y } = this.contextMenuPosition

        if (x + width + margin > window.innerWidth) {
            // Prefer opening to the left of the cursor, then clamp
            x = x - width >= margin ? x - width : Math.max(margin, window.innerWidth - width - margin)
        }

        if (y + height + margin > window.innerHeight) {
            // Prefer opening above the cursor, then clamp
            y = y - height >= margin ? y - height : Math.max(margin, window.innerHeight - height - margin)
        }

        this.contextMenuPosition = { x, y }
    }

    onGroupContextMenu(event: MouseEvent, group: ProfileGroup): void {
        event.preventDefault()
        event.stopPropagation()

        this.contextMenuMode = 'group'
        this.contextMenuProfile = null
        this.contextMenuGroup = group
        this.contextMenuPosition = {
            x: event.clientX,
            y: event.clientY,
        }
        this.contextMenuVisible = true

        setTimeout(() => this.keepContextMenuOnScreen())
    }

    /**
     * 'favorites' and 'ungrouped' are synthesised by this sidebar rather than
     * stored in config.store.groups, so there is nothing to edit for them.
     */
    isEditableGroup(group: ProfileGroup): boolean {
        if (group.id === 'favorites' || group.id === 'ungrouped') {
            return false
        }
        return (this.config.store.groups || []).some(g => g.id === group.id)
    }

    contextMenuCollapseGroup(): void {
        if (this.contextMenuGroup) {
            this.toggleGroupCollapse(this.contextMenuGroup)
        }
        this.contextMenuVisible = false
    }

    async contextMenuEditGroup(): Promise<void> {
        const target = this.contextMenuGroup
        this.contextMenuVisible = false

        if (!target || !this.isEditableGroup(target)) {
            return
        }

        // Edit the real stored group, not the display object this sidebar builds
        const storedGroup = (this.config.store.groups || []).find(g => g.id === target.id)
        if (!storedGroup) {
            return
        }

        try {
            const result = await this.showProfileGroupEditModal(deepClone(storedGroup))
            if (!result) {
                return
            }

            // Strip the fields Tabby's own settings tab strips before writing
            const toWrite: any = { ...result }
            delete toWrite.collapsed
            delete toWrite.children

            await (this.profiles as any).writeProfileGroup(toWrite)
            await this.config.save()

            this.configGroups = this.config.store.groups || []
            await this.refreshProfiles()
        } catch (error) {
            console.error('SSH Sidebar: failed to edit the group:', error)
        }
    }

    /**
     * Mirrors ProfilesSettingsTabComponent.showProfileGroupEditModal - the group
     * modal can hand back a provider, meaning "now edit this group's defaults for
     * that provider", after which we return to the group modal.
     */
    private async showProfileGroupEditModal(group: any): Promise<any | null> {
        const { EditProfileGroupModalComponent } = window['nodeRequire']('tabby-settings')

        const modal = this.ngbModal.open(EditProfileGroupModalComponent, { size: 'lg' })
        modal.componentInstance.group = group
        modal.componentInstance.providers = this.profileProviders

        const result = await modal.result.catch(() => null)
        if (!result) {
            return null
        }

        if (result.provider) {
            return this.editProfileGroupDefaults(result.group, result.provider)
        }

        return result.group
    }

    private async editProfileGroupDefaults(group: any, provider: ProfileProvider<Profile>): Promise<any | null> {
        const { EditProfileModalComponent } = window['nodeRequire']('tabby-settings')

        const modal = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
        const model = group.defaults?.[provider.id] ?? {}
        model.type = provider.id
        modal.componentInstance.partialProfile = { ...model }
        modal.componentInstance.profileProvider = provider
        modal.componentInstance.defaultsMode = 'group'

        const result = await modal.result.catch(() => null)
        if (result) {
            // Fully replace the defaults rather than merging into them
            for (const k in model) {
                delete model[k]
            }
            Object.assign(model, result)
            if (!group.defaults) {
                group.defaults = {}
            }
            group.defaults[provider.id] = model
        }

        // Back to the group modal, the way Tabby's settings tab loops
        return this.showProfileGroupEditModal(group)
    }

    async contextMenuMoveToGroup(): Promise<void> {
        const profile = this.contextMenuProfile
        this.contextMenuVisible = false

        if (!profile) {
            return
        }

        if (!profile.id) {
            await this.platform.showMessageBox({
                type: 'warning',
                message: this.translate.instant('This profile has no ID and cannot be moved from here. Please edit it in Settings -> Profiles.'),
                buttons: [this.translate.instant('OK')],
                defaultId: 0,
                cancelId: 0,
            })
            return
        }

        const groups = this.config.store.groups || []
        const options: SelectorOption<string>[] = [
            {
                name: this.translate.instant('Ungrouped'),
                description: profile.group ? undefined : this.translate.instant('(current)'),
                icon: 'fas fa-folder-open',
                result: '',
                weight: profile.group ? 1 : 0,
            },
            ...groups.map(g => ({
                name: g.name,
                description: g.id === profile.group ? this.translate.instant('(current)') : undefined,
                icon: 'fas fa-folder',
                result: g.id,
                weight: g.id === profile.group ? 0 : 1,
            })),
        ]

        const targetGroupId = await this.selector.show<string>(
            this.translate.instant('Move "{name}" to group', profile),
            options,
        ).catch(() => null)

        if (targetGroupId === null || targetGroupId === undefined) {
            return
        }

        if ((profile.group ?? '') === targetGroupId) {
            return
        }

        // Write through ProfilesService so the change lands on the stored profile
        const updated: any = deepClone(profile)
        if (targetGroupId) {
            updated.group = targetGroupId
        } else {
            delete updated.group
        }

        await (this.profiles as any).writeProfile(updated)
        await this.config.save()
        await this.refreshProfiles()
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
        this.contextMenuVisible = false

        // Built-in profiles do not live in config.store.profiles, so writeProfile
        // would find nothing and silently discard the edit. Tabby's own settings
        // tab makes them non-clickable for the same reason.
        if (profileToEdit.isBuiltin) {
            await this.platform.showMessageBox({
                type: 'warning',
                message: this.translate.instant('Built-in profiles cannot be edited. Duplicate it first to make your own copy.'),
                buttons: [this.translate.instant('OK')],
                defaultId: 0,
                cancelId: 0,
            })
            return
        }

        try {
            // Open Tabby's own profile edit modal directly, the same way
            // ProfilesSettingsTabComponent.editProfile does. Previously this
            // method opened the settings tab and tried to synthesise a click on
            // the matching row, which broke whenever Tabby's markup changed and
            // could target the wrong row when two profiles shared a name.
            const { EditProfileModalComponent } = window['nodeRequire']('tabby-settings')

            const provider = this.profiles.providerForProfile(profileToEdit)
            if (!provider) {
                console.error('SSH Sidebar: cannot edit a profile without a provider')
                return
            }

            const modal = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
            modal.componentInstance.partialProfile = deepClone(profileToEdit)
            modal.componentInstance.profileProvider = provider

            const result = await modal.result.catch(() => null)
            if (!result) {
                return
            }

            result.type = provider.id
            await (this.profiles as any).writeProfile(result)
            await this.config.save()
            await this.refreshProfiles()
        } catch (error) {
            console.error('SSH Sidebar: failed to open the profile editor:', error)
            this.openProfilesSettingsTab()
        }
    }

    /**
     * Fallback for when the edit modal cannot be opened - surface Tabby's
     * profiles settings tab so the user can edit by hand.
     */
    private openProfilesSettingsTab(): void {
        try {
            const { SettingsTabComponent } = window['nodeRequire']('tabby-settings')
            const existing = this.app.tabs.find(tab => tab instanceof SettingsTabComponent)
            if (existing) {
                this.app.selectTab(existing)
                const settingsComponent = existing as any
                if (settingsComponent.activeTab !== 'profiles') {
                    settingsComponent.activeTab = 'profiles'
                }
            } else {
                this.app.openNewTabRaw({
                    type: SettingsTabComponent,
                    inputs: { activeTab: 'profiles' },
                })
            }
        } catch (error) {
            console.error('SSH Sidebar: could not open the profiles settings tab:', error)
        }
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

        this.config.store.profiles = this.config.store.profiles || []

        // The new profile MUST get an id. Tabby matches profiles by id when
        // editing (writeProfile), deleting (deleteProfile) and when listing them
        // in the profile selector, so an id-less profile is invisible in the
        // selector, and deleting or editing one silently hits every other
        // id-less profile as well.
        const profilesService = this.profiles as any
        if (profilesService.newProfile) {
            await profilesService.newProfile(baseProfile)
        } else {
            baseProfile.id = this.generateProfileId(baseProfile)
            this.config.store.profiles.push(baseProfile)
        }

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

        const profileToDelete = this.contextMenuProfile

        // Deleting matches on id, so an id-less profile would take every other
        // id-less profile down with it. Refuse rather than destroy data.
        if (!profileToDelete.id) {
            this.contextMenuVisible = false
            await this.platform.showMessageBox({
                type: 'warning',
                message: this.translate.instant('This profile has no ID and cannot be safely deleted from here. Please delete it in Settings -> Profiles.'),
                buttons: [this.translate.instant('OK')],
                defaultId: 0,
                cancelId: 0,
            })
            return
        }

        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: this.translate.instant('Delete "{name}"?', profileToDelete),
            buttons: [
                this.translate.instant('Delete'),
                this.translate.instant('Cancel'),
            ],
            defaultId: 1,
            cancelId: 1,
        })

        if (result.response === 0) {
            // Delegate to Tabby so the provider's own cleanup runs (for SSH that
            // removes the saved password from the keychain) and so the profile's
            // hotkey entry is dropped too.
            const profilesService = this.profiles as any
            if (profilesService.deleteProfile) {
                await profilesService.deleteProfile(profileToDelete)
            } else {
                this.config.store.profiles = this.config.store.profiles.filter(p => p.id !== profileToDelete.id)
            }
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
