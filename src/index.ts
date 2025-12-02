import { NgModule, Injectable } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import {
    ToolbarButtonProvider,
    ToolbarButton,
    ProfilesService,
    SelectorService,
    SelectorOption,
    HostAppService,
    Platform,
    ConfigService,
    AppService,
} from 'tabby-core'
import { SSHProfile } from 'tabby-ssh'
import { SSHSidebarComponent } from './components/sshSidebar.component'
import { SSHSidebarService } from './services/sshSidebar.service'

/**
 * Configuration interface for SSH sidebar settings
 */
export interface SSHSidebarConfig {
    enabled?: boolean
    position?: 'left' | 'right'
    showInToolbar?: boolean
    sidebarVisible?: boolean
    sidebarCollapsed?: boolean
}

/**
 * Toolbar button provider that toggles the SSH sidebar panel
 */
@Injectable()
export class SSHSidebarToolbarButton extends ToolbarButtonProvider {
    weight = 15

    constructor(
        private profiles: ProfilesService,
        private selector: SelectorService,
        private hostApp: HostAppService,
        private config: ConfigService,
        private sidebarService: SSHSidebarService,
    ) {
        super()
    }

    provide(): ToolbarButton[] {
        // Get config settings
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] as SSHSidebarConfig || {}

        // Only show toolbar button if not disabled
        if (pluginConfig.showInToolbar === false) {
            return []
        }

        return [
            {
                icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h13A1.5 1.5 0 0 1 16 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11zM1.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-13z"/>
                    <path d="M3 4.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm2 0h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm0 2h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z"/>
                </svg>`,
                title: 'Toggle SSH Connections Sidebar',
                submenu: async () => {
                    return [
                        {
                            title: this.sidebarService.visible ? 'Hide Sidebar' : 'Show Sidebar',
                            click: () => this.sidebarService.toggle(),
                        },
                        {
                            title: 'Quick Connect...',
                            click: () => this.showSSHConnectionsList(),
                        },
                    ]
                },
                click: () => this.sidebarService.toggle(),
            },
        ]
    }

    /**
     * Shows a selector with all available SSH connections (fallback/alternative method)
     */
    private async showSSHConnectionsList(): Promise<void> {
        try {
            // Get all profiles
            const allProfiles = await this.profiles.getProfiles()

            // Filter for SSH profiles only
            const sshProfiles = allProfiles.filter(profile => profile.type === 'ssh') as SSHProfile[]

            if (sshProfiles.length === 0) {
                console.log('No SSH profiles found')
                return
            }

            // Convert profiles to selector options
            const options: SelectorOption<SSHProfile>[] = sshProfiles.map(profile => {
                const host = profile.options?.host || 'Unknown'
                const user = profile.options?.user || 'root'
                const port = profile.options?.port || 22

                return {
                    name: profile.name,
                    description: `${user}@${host}:${port}`,
                    result: profile,
                    icon: 'server',
                    weight: 0,
                }
            })

            // Sort by name
            options.sort((a, b) => a.name.localeCompare(b.name))

            // Show selector
            const selectedProfile = await this.selector.show<SSHProfile>('Select SSH Connection', options)

            if (selectedProfile) {
                // Launch the selected profile
                await this.profiles.launchProfile(selectedProfile)
            }
        } catch (error) {
            console.error('Error showing SSH connections list:', error)
        }
    }
}

/**
 * Service to initialize the sidebar on app startup
 */
@Injectable()
export class SSHSidebarInitializer {
    constructor(
        private sidebarService: SSHSidebarService,
        private app: AppService,
    ) {
        // Initialize sidebar when app is ready
        this.app.ready$.subscribe(() => {
            setTimeout(() => {
                this.sidebarService.initialize()
            }, 1000)
        })
    }
}

/**
 * Main module for the SSH Sidebar plugin
 */
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
    ],
    declarations: [
        SSHSidebarComponent,
    ],
    providers: [
        {
            provide: ToolbarButtonProvider,
            useClass: SSHSidebarToolbarButton,
            multi: true,
        },
        SSHSidebarService,
        SSHSidebarInitializer,
    ],
})
export default class SSHSidebarModule {
    constructor(
        // Inject initializer to ensure it runs
        _initializer: SSHSidebarInitializer,
    ) {}
}
