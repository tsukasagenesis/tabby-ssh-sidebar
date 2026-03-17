import { Component, OnInit, OnDestroy, HostBinding, HostListener, ViewChild, ElementRef } from '@angular/core'
import {
    ProfilesService,
    AppService,
    ConfigService,
    Profile,
    PartialProfile,
    BaseComponent,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'
import { Subject } from 'rxjs'
import { takeUntil, debounceTime } from 'rxjs/operators'
import { ProfileGroup } from './profileGroup.component'
import { ContextMenuPosition } from './contextMenu.component'

@Component({
    selector: 'ssh-sidebar',
    template: `
        <div class="ssh-sidebar-container" [class.collapsed]="collapsed" tabindex="0">
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

            <!-- Tag Filter -->
            <div class="ssh-sidebar-tags" *ngIf="allTags.length > 0">
                <button class="tag-filter-btn"
                        [class.active]="activeTagFilter === null"
                        (click)="setTagFilter(null)">All</button>
                <button class="tag-filter-btn"
                        *ngFor="let tag of allTags"
                        [class.active]="activeTagFilter === tag"
                        (click)="setTagFilter(tag)">{{ tag }}</button>
            </div>

            <!-- Search Box -->
            <div class="ssh-sidebar-search">
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="fas fa-fw fa-search"></i>
                    </span>
                    <input
                        #searchInput
                        type="search"
                        class="form-control"
                        placeholder="Filter (/ to focus)"
                        [(ngModel)]="filter"
                        (input)="refreshFilteredProfiles()"
                        (keydown.escape)="blurSearch()"
                        (keydown.arrowDown)="onSearchArrowDown($event)"
                    >
                </div>
            </div>

            <!-- Profiles List -->
            <div class="ssh-sidebar-list list-group">
                <ng-container *ngFor="let group of profileGroups">
                    <ssh-profile-group
                        *ngIf="isGroupVisible(group)"
                        [group]="group"
                        [filter]="filter"
                        [activeProfileIds]="activeProfileIds"
                        [focusedProfileId]="getFocusedProfileId()"
                        [profileStats]="profileStats"
                        [activeTagFilter]="activeTagFilter"
                        [profileTags]="profileTags"
                        (collapseToggled)="onGroupCollapseToggled($event)"
                        (profileLaunched)="launchProfile($event)"
                        (profileContextMenu)="onProfileContextMenu($event)">
                    </ssh-profile-group>
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
            <ssh-context-menu
                [visible]="contextMenuVisible"
                [position]="contextMenuPosition"
                [profile]="contextMenuProfile"
                [isPinned]="contextMenuProfile ? isProfilePinned(contextMenuProfile) : false"
                [profileTags]="contextMenuProfile?.id ? (profileTags[contextMenuProfile.id] || []) : []"
                [allTags]="allTags"
                (closed)="contextMenuVisible = false"
                (profileLaunched)="launchProfile($event)"
                (profileDuplicated)="refreshProfiles()"
                (profileDeleted)="refreshProfiles()"
                (profilePinned)="onProfilePinned($event)"
                (profileUnpinned)="onProfileUnpinned($event)"
                (tagAdded)="onTagAdded($event)"
                (tagRemoved)="onTagRemoved($event)">
            </ssh-context-menu>
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
            color: var(--bs-white, #fff);
            border-color: var(--bs-primary);
        }

        .ssh-sidebar-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--bs-border-color);
        }

        .tag-filter-btn {
            padding: 2px 10px;
            font-size: 11px;
            border: 1px solid var(--bs-border-color);
            border-radius: 12px;
            background: var(--bs-body-bg);
            color: var(--bs-secondary-color);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .tag-filter-btn:hover {
            background: var(--bs-tertiary-bg);
            color: var(--bs-body-color);
        }

        .tag-filter-btn.active {
            background: var(--bs-primary);
            color: var(--bs-white, #fff);
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

        .btn-link {
            color: var(--bs-body-color);
            text-decoration: none;
        }

        .btn-link:hover {
            color: var(--bs-primary);
        }

        .ssh-sidebar-container:focus {
            outline: none;
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
    pinnedProfiles: string[] = []
    activeProfileIds: string[] = []
    profileStats: { [id: string]: { lastConnected: number, connectionCount: number } } = {}
    profileTags: { [id: string]: string[] } = {}
    allTags: string[] = []
    activeTagFilter: string | null = null

    // Context menu state
    contextMenuVisible = false
    contextMenuPosition: ContextMenuPosition = { x: 0, y: 0 }
    contextMenuProfile: PartialProfile<SSHProfile> | null = null

    // Keyboard navigation
    focusedProfileIndex = -1

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>

    private destroy$ = new Subject<void>()
    public sidebarService: any = null

    constructor(
        private profiles: ProfilesService,
        private app: AppService,
        private config: ConfigService,
    ) {
        super()
    }

    async ngOnInit(): Promise<void> {
        this.configGroups = this.config.store.groups || []
        this.loadPinnedProfiles()
        this.loadProfileStats()
        this.loadProfileTags()

        await this.refreshProfiles()
        await this.refreshProfileGroups()

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

        this.app.tabsChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.updateActiveProfileIds()
            })

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
            if (p.type !== 'ssh') return false
            if (p.isTemplate) return false
            const sshProfile = p as PartialProfile<SSHProfile>
            if (!sshProfile.options?.host) return false
            return true
        }) as PartialProfile<SSHProfile>[]
        this.updateActiveProfileIds()
        await this.refreshProfileGroups()
    }

    async refreshProfileGroups(): Promise<void> {
        const profileGroupCollapsed = JSON.parse(window.localStorage.profileGroupCollapsed ?? '{}')

        await this.sortProfiles()

        const grouped: { [key: string]: PartialProfile<SSHProfile>[] } = {}

        for (const profile of this.sshProfiles) {
            const groupId = profile.group || 'ungrouped'
            if (!grouped[groupId]) {
                grouped[groupId] = []
            }
            grouped[groupId].push(profile)
        }

        this.profileGroups = Object.entries(grouped).map(([groupId, profiles]) => {
            let groupName = groupId
            if (groupId !== 'ungrouped') {
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

        if (this.pinnedProfiles.length > 0) {
            const pinnedProfileObjects = this.sshProfiles.filter(p =>
                p.id && this.pinnedProfiles.includes(p.id)
            )

            if (pinnedProfileObjects.length > 0) {
                this.profileGroups.forEach(group => {
                    group.profiles = group.profiles.filter(p =>
                        !p.id || !this.pinnedProfiles.includes(p.id)
                    )
                })

                this.profileGroups.unshift({
                    id: 'favorites',
                    name: '\u2B50 Favorites',
                    profiles: pinnedProfileObjects,
                    collapsed: profileGroupCollapsed['favorites'] ?? false,
                })
            }
        }

        this.profileGroups = this.profileGroups.filter(group =>
            group.profiles.length > 0
        )

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
            // Use Tabby's recent list as primary, our persistent stats as fallback
            const recentProfiles = await this.profiles.getRecentProfiles()
            const recentIds = recentProfiles.map(p => p.id)

            this.sshProfiles.sort((a, b) => {
                // Active connections first
                const aActive = this.activeProfileIds.includes(a.id || '')
                const bActive = this.activeProfileIds.includes(b.id || '')
                if (aActive && !bActive) return -1
                if (!aActive && bActive) return 1

                // Tabby's recent list
                const aIndex = recentIds.indexOf(a.id)
                const bIndex = recentIds.indexOf(b.id)
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                if (aIndex !== -1) return -1
                if (bIndex !== -1) return 1

                // Persistent stats fallback (survives restarts)
                const aStats = this.profileStats[a.id || '']
                const bStats = this.profileStats[b.id || '']
                const aTime = aStats?.lastConnected || 0
                const bTime = bStats?.lastConnected || 0
                if (aTime !== bTime) return bTime - aTime

                return a.name.localeCompare(b.name)
            })
        } else {
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
        // Filter is applied in sub-components via isProfileVisible
    }

    isGroupVisible(group: ProfileGroup): boolean {
        return group.profiles.some(p => this.isProfileFullyVisible(p, group))
    }

    isProfileFullyVisible(profile: PartialProfile<SSHProfile>, group?: ProfileGroup): boolean {
        // Tag filter
        if (this.activeTagFilter) {
            const tags = this.profileTags[profile.id || ''] || []
            if (!tags.includes(this.activeTagFilter)) return false
        }
        // Text filter
        if (!this.filter) return true
        const filterLower = this.filter.toLowerCase()
        if (group && group.name.toLowerCase().includes(filterLower)) return true
        return this.matchesFilter(profile, filterLower)
    }

    hasVisibleProfiles(): boolean {
        return this.profileGroups.some(g => g.profiles.some(p => this.isProfileFullyVisible(p, g)))
    }

    getConnectionCountText(): string {
        const total = this.sshProfiles.length
        const active = this.activeProfileIds.length

        if (active === 0) {
            return `${total} connection${total !== 1 ? 's' : ''}`
        }
        return `${total} connection${total !== 1 ? 's' : ''} (${active} active)`
    }

    toggleCollapse(): void {
        if (this.sidebarService) {
            this.sidebarService.hide()
        } else {
            this.collapsed = !this.collapsed
            const pluginConfig = this.config.store.pluginConfig || {}
            if (!pluginConfig['ssh-sidebar']) {
                pluginConfig['ssh-sidebar'] = {}
            }
            pluginConfig['ssh-sidebar'].sidebarCollapsed = this.collapsed
            this.config.store.pluginConfig = pluginConfig
            this.config.save()
        }
    }

    launchProfile(profile: PartialProfile<Profile>): void {
        if (profile.id) {
            this.recordProfileLaunch(profile.id)
        }
        if (this.profiles.openNewTabForProfile) {
            this.profiles.openNewTabForProfile(profile)
        } else {
            (this.profiles as any).launchProfile(profile)
        }
    }

    isProfilePinned(profile: PartialProfile<SSHProfile>): boolean {
        return profile.id ? this.pinnedProfiles.includes(profile.id) : false
    }

    onProfileContextMenu(event: { event: MouseEvent, profile: PartialProfile<SSHProfile> }): void {
        this.contextMenuProfile = event.profile
        this.contextMenuPosition = {
            x: event.event.clientX,
            y: event.event.clientY,
        }
        this.contextMenuVisible = true
    }

    async onProfilePinned(profile: PartialProfile<SSHProfile>): Promise<void> {
        if (profile.id && !this.pinnedProfiles.includes(profile.id)) {
            this.pinnedProfiles.push(profile.id)
            this.savePinnedProfiles()
            await this.refreshProfileGroups()
        }
    }

    async onProfileUnpinned(profile: PartialProfile<SSHProfile>): Promise<void> {
        if (profile.id) {
            this.pinnedProfiles = this.pinnedProfiles.filter(id => id !== profile.id)
            this.savePinnedProfiles()
            await this.refreshProfileGroups()
        }
    }

    onGroupCollapseToggled(group: ProfileGroup): void {
        const profileGroupCollapsed = JSON.parse(window.localStorage.profileGroupCollapsed ?? '{}')
        profileGroupCollapsed[group.id] = group.collapsed
        window.localStorage.profileGroupCollapsed = JSON.stringify(profileGroupCollapsed)
    }

    // ─── Keyboard Navigation ───

    @HostListener('keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        // Don't handle if search input is focused (except Escape and ArrowDown)
        const isSearchFocused = document.activeElement === this.searchInput?.nativeElement

        switch (event.key) {
            case '/':
                if (!isSearchFocused) {
                    event.preventDefault()
                    this.searchInput?.nativeElement?.focus()
                }
                break
            case 'Escape':
                if (this.contextMenuVisible) {
                    this.contextMenuVisible = false
                } else if (isSearchFocused) {
                    this.blurSearch()
                } else {
                    this.focusedProfileIndex = -1
                }
                break
            case 'ArrowDown':
                if (!isSearchFocused) {
                    event.preventDefault()
                    this.moveFocus(1)
                }
                break
            case 'ArrowUp':
                if (!isSearchFocused) {
                    event.preventDefault()
                    this.moveFocus(-1)
                }
                break
            case 'Enter':
                if (!isSearchFocused) {
                    this.launchFocusedProfile()
                }
                break
        }
    }

    getVisibleProfiles(): PartialProfile<SSHProfile>[] {
        const result: PartialProfile<SSHProfile>[] = []
        for (const group of this.profileGroups) {
            if (!this.isGroupVisible(group) || group.collapsed) continue
            for (const profile of group.profiles) {
                if (this.isProfileVisibleForKeyboard(profile)) {
                    result.push(profile)
                }
            }
        }
        return result
    }

    private isProfileVisibleForKeyboard(profile: PartialProfile<SSHProfile>): boolean {
        return this.isProfileFullyVisible(profile)
    }

    matchesFilter(profile: PartialProfile<SSHProfile>, filterLower: string): boolean {
        const parts = [
            profile.name,
            profile.options?.host,
            profile.options?.user,
            profile.options?.port != null ? String(profile.options.port) : '',
        ]
        const searchText = parts.filter(Boolean).join(' ').toLowerCase()
        return searchText.includes(filterLower)
    }

    private moveFocus(direction: number): void {
        const visible = this.getVisibleProfiles()
        if (visible.length === 0) return

        this.focusedProfileIndex += direction
        if (this.focusedProfileIndex < 0) this.focusedProfileIndex = 0
        if (this.focusedProfileIndex >= visible.length) this.focusedProfileIndex = visible.length - 1

        this.scrollFocusedIntoView()
    }

    private launchFocusedProfile(): void {
        const visible = this.getVisibleProfiles()
        if (this.focusedProfileIndex >= 0 && this.focusedProfileIndex < visible.length) {
            this.launchProfile(visible[this.focusedProfileIndex])
        }
    }

    private scrollFocusedIntoView(): void {
        // Use setTimeout to let Angular render the focused class first
        setTimeout(() => {
            const focused = document.querySelector('.ssh-sidebar-list .profile-item.keyboard-focused')
            focused?.scrollIntoView({ block: 'nearest' })
        }, 0)
    }

    blurSearch(): void {
        this.searchInput?.nativeElement?.blur()
    }

    onSearchArrowDown(event: Event): void {
        event.preventDefault()
        this.blurSearch()
        this.focusedProfileIndex = 0
        this.scrollFocusedIntoView()
    }

    getFocusedProfileId(): string | null {
        const visible = this.getVisibleProfiles()
        if (this.focusedProfileIndex >= 0 && this.focusedProfileIndex < visible.length) {
            return visible[this.focusedProfileIndex].id || null
        }
        return null
    }

    private updateActiveProfileIds(): void {
        this.activeProfileIds = this.app.tabs
            .map(tab => (tab as any).profile)
            .filter(p => p && p.type === 'ssh' && p.id)
            .map(p => p.id)
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

    // ─── Tag Management ───

    setTagFilter(tag: string | null): void {
        this.activeTagFilter = tag
    }

    onTagAdded(event: { profile: PartialProfile<SSHProfile>, tag: string }): void {
        const id = event.profile.id
        if (!id) return
        if (!this.profileTags[id]) this.profileTags[id] = []
        if (!this.profileTags[id].includes(event.tag)) {
            this.profileTags[id].push(event.tag)
            this.saveProfileTags()
        }
    }

    onTagRemoved(event: { profile: PartialProfile<SSHProfile>, tag: string }): void {
        const id = event.profile.id
        if (!id || !this.profileTags[id]) return
        this.profileTags[id] = this.profileTags[id].filter(t => t !== event.tag)
        if (this.profileTags[id].length === 0) {
            delete this.profileTags[id]
        }
        this.saveProfileTags()
    }

    private loadProfileTags(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        this.profileTags = pluginConfig.profileTags || {}
        this.rebuildAllTags()
    }

    private saveProfileTags(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.profileTags = this.profileTags
        if (!this.config.store.pluginConfig) {
            this.config.store.pluginConfig = {}
        }
        this.config.store.pluginConfig['ssh-sidebar'] = pluginConfig
        this.config.save()
        this.rebuildAllTags()
    }

    private rebuildAllTags(): void {
        const tagSet = new Set<string>()
        for (const tags of Object.values(this.profileTags)) {
            for (const tag of tags) tagSet.add(tag)
        }
        this.allTags = Array.from(tagSet).sort()
        // Clear active filter if the tag no longer exists
        if (this.activeTagFilter && !this.allTags.includes(this.activeTagFilter)) {
            this.activeTagFilter = null
        }
    }

    private loadPinnedProfiles(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        this.pinnedProfiles = pluginConfig.pinnedProfiles || []
    }

    // ─── Connection Statistics ───

    private loadProfileStats(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        this.profileStats = pluginConfig.profileStats || {}
    }

    private recordProfileLaunch(profileId: string): void {
        const stats = this.profileStats[profileId] || { lastConnected: 0, connectionCount: 0 }
        stats.lastConnected = Date.now()
        stats.connectionCount++
        this.profileStats[profileId] = stats
        this.saveProfileStats()
    }

    private saveProfileStats(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.profileStats = this.profileStats
        if (!this.config.store.pluginConfig) {
            this.config.store.pluginConfig = {}
        }
        this.config.store.pluginConfig['ssh-sidebar'] = pluginConfig
        this.config.save()
    }

    getLastConnected(profile: PartialProfile<SSHProfile>): string | null {
        const stats = this.profileStats[profile.id || '']
        if (!stats?.lastConnected) return null
        const date = new Date(stats.lastConnected)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours}h ago`
        const diffDays = Math.floor(diffHours / 24)
        if (diffDays < 30) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }
}
