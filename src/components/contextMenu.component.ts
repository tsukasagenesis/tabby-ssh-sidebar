import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core'
import {
    ConfigService,
    TranslateService,
    Profile,
    PartialProfile,
    PlatformService,
    ProfilesService,
    AppService,
    NotificationsService,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'
import deepClone from 'clone-deep'

export interface ContextMenuPosition {
    x: number
    y: number
}

@Component({
    selector: 'ssh-context-menu',
    template: `
        <div class="context-menu"
             *ngIf="visible"
             [style.left.px]="position.x"
             [style.top.px]="position.y">
            <div class="context-menu-item" (click)="launch()">
                <i class="fas fa-fw fa-play"></i>
                <span>Launch</span>
            </div>
            <div class="context-menu-item" (click)="edit()">
                <i class="fas fa-fw fa-edit"></i>
                <span>Edit</span>
            </div>
            <div class="context-menu-item" (click)="duplicate()">
                <i class="fas fa-fw fa-copy"></i>
                <span>Duplicate</span>
            </div>
            <div class="context-menu-item" (click)="copySSHCommand()">
                <i class="fas fa-fw fa-terminal"></i>
                <span>Copy SSH Command</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item"
                 *ngIf="profile && profile.id && !isProfileBlacklisted()"
                 (click)="blacklist()">
                <i class="fas fa-fw fa-eye-slash"></i>
                <span>Hide from Selector</span>
            </div>
            <div class="context-menu-item"
                 *ngIf="profile && profile.id && isProfileBlacklisted()"
                 (click)="unblacklist()">
                <i class="fas fa-fw fa-eye"></i>
                <span>Show in Selector</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item"
                 *ngIf="profile && profile.id && !isPinned"
                 (click)="pin()">
                <i class="fas fa-fw fa-thumbtack"></i>
                <span>Pin to Favorites</span>
            </div>
            <div class="context-menu-item"
                 *ngIf="profile && profile.id && isPinned"
                 (click)="unpin()">
                <i class="fas fa-fw fa-thumbtack" style="transform: rotate(45deg);"></i>
                <span>Unpin from Favorites</span>
            </div>
            <div class="context-menu-divider"></div>
            <!-- Tags Section -->
            <div class="context-menu-item" *ngIf="profile && profile.id && !showTagInput"
                 (click)="$event.stopPropagation(); showTagInput = true">
                <i class="fas fa-fw fa-tags"></i>
                <span>Tags{{ profileTags.length ? ' (' + profileTags.length + ')' : '' }}</span>
            </div>
            <div *ngIf="showTagInput" class="context-menu-tags" (click)="$event.stopPropagation()">
                <div class="tag-chips">
                    <span class="tag-chip" *ngFor="let tag of profileTags">
                        {{ tag }}
                        <i class="fas fa-times tag-remove" (click)="removeTag(tag)"></i>
                    </span>
                </div>
                <div class="tag-suggestions" *ngIf="getUnusedTags().length > 0">
                    <span class="tag-suggestion" *ngFor="let tag of getUnusedTags()"
                          (click)="addExistingTag(tag)">+ {{ tag }}</span>
                </div>
                <input type="text" class="tag-input" placeholder="New tag..."
                       [(ngModel)]="newTagName"
                       (keydown.enter)="addNewTag()"
                       (keydown.escape)="showTagInput = false">
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-item-danger"
                 *ngIf="profile && !profile.isBuiltin"
                 (click)="deleteProfile()">
                <i class="fas fa-fw fa-trash-alt"></i>
                <span>Delete</span>
            </div>
        </div>
    `,
    styles: [`
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
            color: var(--bs-white, #fff);
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

        .context-menu-tags {
            padding: 6px 12px;
        }

        .tag-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 6px;
        }

        .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            font-size: 11px;
            background: var(--bs-primary);
            color: var(--bs-white, #fff);
            border-radius: 10px;
        }

        .tag-remove {
            cursor: pointer;
            font-size: 9px;
            opacity: 0.7;
        }

        .tag-remove:hover {
            opacity: 1;
        }

        .tag-suggestions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 6px;
        }

        .tag-suggestion {
            padding: 2px 8px;
            font-size: 11px;
            background: var(--bs-tertiary-bg);
            border-radius: 10px;
            cursor: pointer;
            color: var(--bs-secondary-color);
        }

        .tag-suggestion:hover {
            background: var(--bs-secondary-bg);
            color: var(--bs-body-color);
        }

        .tag-input {
            width: 100%;
            padding: 4px 8px;
            font-size: 12px;
            background: var(--bs-tertiary-bg);
            border: 1px solid var(--bs-border-color);
            border-radius: 4px;
            color: var(--bs-body-color);
            outline: none;
        }

        .tag-input:focus {
            border-color: var(--bs-primary);
        }
    `]
})
export class SSHContextMenuComponent {
    @Input() visible = false
    @Input() position: ContextMenuPosition = { x: 0, y: 0 }
    @Input() profile: PartialProfile<SSHProfile> | null = null
    @Input() isPinned = false
    @Input() profileTags: string[] = []
    @Input() allTags: string[] = []

    @Output() closed = new EventEmitter<void>()
    @Output() profileLaunched = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() profileEdited = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() profileDuplicated = new EventEmitter<void>()
    @Output() profileDeleted = new EventEmitter<void>()
    @Output() profilePinned = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() profileUnpinned = new EventEmitter<PartialProfile<SSHProfile>>()
    @Output() profilesChanged = new EventEmitter<void>()
    @Output() tagAdded = new EventEmitter<{ profile: PartialProfile<SSHProfile>, tag: string }>()
    @Output() tagRemoved = new EventEmitter<{ profile: PartialProfile<SSHProfile>, tag: string }>()

    showTagInput = false
    newTagName = ''

    constructor(
        private config: ConfigService,
        private translate: TranslateService,
        private platform: PlatformService,
        private profiles: ProfilesService,
        private app: AppService,
        private notifications: NotificationsService,
    ) {}

    @HostListener('document:click')
    onDocumentClick(): void {
        if (this.visible) {
            this.close()
        }
    }

    close(): void {
        this.visible = false
        this.showTagInput = false
        this.newTagName = ''
        this.closed.emit()
    }

    launch(): void {
        if (this.profile) {
            this.profileLaunched.emit(this.profile)
        }
        this.close()
    }

    async edit(): Promise<void> {
        if (!this.profile) {
            this.close()
            return
        }

        const profileName = this.profile.name

        try {
            const { SettingsTabComponent } = window['nodeRequire']('tabby-settings')

            const existingSettingsTab = this.app.tabs.find(tab => tab instanceof SettingsTabComponent)

            if (existingSettingsTab) {
                this.app.selectTab(existingSettingsTab)
                const settingsComponent = existingSettingsTab as any
                if (settingsComponent.activeTab !== 'profiles') {
                    settingsComponent.activeTab = 'profiles'
                }
            } else {
                this.app.openNewTabRaw({
                    type: SettingsTabComponent,
                    inputs: { activeTab: 'profiles' },
                })
            }

            await new Promise(resolve => setTimeout(resolve, 500))

            let clicked = false
            for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200))
                }

                const profileElements = document.querySelectorAll('.list-group-item.ps-5')

                for (const element of Array.from(profileElements)) {
                    const textContent = element.textContent || ''

                    if (textContent.includes(profileName)) {
                        const nameElement = element.querySelector('.no-wrap')

                        if (nameElement && nameElement.textContent?.trim() === profileName) {
                            try {
                                (nameElement as HTMLElement).click()
                                clicked = true
                                break
                            } catch (err) {
                                try {
                                    (element as HTMLElement).click()
                                    clicked = true
                                    break
                                } catch (err2) {
                                    console.debug('Error clicking profile element:', err2)
                                }
                            }
                        }
                    }
                }
            }

            if (!clicked) {
                this.notifications.info(
                    `Please click on "${profileName}" in the profiles list to edit it`,
                    'Could not auto-select the profile'
                )
            }
        } catch (error) {
            this.notifications.error(
                'Failed to open profile settings',
                error instanceof Error ? error.message : String(error)
            )
        }

        this.close()
    }

    async duplicate(): Promise<void> {
        if (!this.profile) {
            this.close()
            return
        }

        try {
            const baseProfile: PartialProfile<Profile> = deepClone(this.profile)
            delete baseProfile.id
            baseProfile.name = this.translate.instant('{name} copy', this.profile)
            baseProfile.isBuiltin = false
            baseProfile.isTemplate = false

            this.config.store.profiles = this.config.store.profiles || []
            this.config.store.profiles.push(baseProfile)
            await this.config.save()

            this.notifications.notice(`Duplicated "${this.profile.name}"`)
            this.profileDuplicated.emit()
        } catch (error) {
            this.notifications.error(
                'Failed to duplicate profile',
                error instanceof Error ? error.message : String(error)
            )
        }
        this.close()
    }

    copySSHCommand(): void {
        if (!this.profile) {
            this.close()
            return
        }

        try {
            const user = this.profile.options?.user || 'root'
            const host = this.profile.options?.host || 'unknown'
            const port = this.profile.options?.port || 22

            let command = `ssh ${user}@${host}`
            if (port !== 22) {
                command += ` -p ${port}`
            }

            this.platform.setClipboard({ text: command })
            this.notifications.notice('SSH command copied to clipboard')
        } catch (error) {
            this.notifications.error(
                'Failed to copy SSH command',
                error instanceof Error ? error.message : String(error)
            )
        }
        this.close()
    }

    isProfileBlacklisted(): boolean {
        return !!(this.profile?.id && this.config.store.profileBlacklist.includes(this.profile.id))
    }

    blacklist(): void {
        if (this.profile?.id) {
            this.config.store.profileBlacklist = [...this.config.store.profileBlacklist, this.profile.id]
            this.config.save()
            this.notifications.notice(`Hidden "${this.profile.name}" from selector`)
        }
        this.close()
    }

    unblacklist(): void {
        if (this.profile?.id) {
            this.config.store.profileBlacklist = this.config.store.profileBlacklist.filter(x => x !== this.profile!.id)
            this.config.save()
            this.notifications.notice(`"${this.profile.name}" visible in selector`)
        }
        this.close()
    }

    pin(): void {
        if (this.profile) {
            this.profilePinned.emit(this.profile)
        }
        this.close()
    }

    unpin(): void {
        if (this.profile) {
            this.profileUnpinned.emit(this.profile)
        }
        this.close()
    }

    addNewTag(): void {
        const tag = this.newTagName.trim().toLowerCase()
        if (tag && this.profile && !this.profileTags.includes(tag)) {
            this.tagAdded.emit({ profile: this.profile, tag })
            this.newTagName = ''
        }
    }

    addExistingTag(tag: string): void {
        if (this.profile) {
            this.tagAdded.emit({ profile: this.profile, tag })
        }
    }

    removeTag(tag: string): void {
        if (this.profile) {
            this.tagRemoved.emit({ profile: this.profile, tag })
        }
    }

    getUnusedTags(): string[] {
        return this.allTags.filter(t => !this.profileTags.includes(t))
    }

    async deleteProfile(): Promise<void> {
        if (!this.profile || this.profile.isBuiltin) {
            this.close()
            return
        }

        const result = await this.platform.showMessageBox({
            type: 'warning',
            message: this.translate.instant('Delete "{name}"?', this.profile),
            buttons: [
                this.translate.instant('Delete'),
                this.translate.instant('Cancel'),
            ],
            defaultId: 1,
            cancelId: 1,
        })

        if (result.response === 0) {
            try {
                const name = this.profile.name
                this.config.store.profiles = this.config.store.profiles.filter(p => p.id !== this.profile!.id)
                await this.config.save()
                this.notifications.notice(`Deleted "${name}"`)
                this.profileDeleted.emit()
            } catch (error) {
                this.notifications.error(
                    'Failed to delete profile',
                    error instanceof Error ? error.message : String(error)
                )
            }
        }

        this.close()
    }
}
