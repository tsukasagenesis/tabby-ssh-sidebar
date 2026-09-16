import { Injectable, ComponentFactoryResolver, ApplicationRef, Injector, EmbeddedViewRef, ComponentRef } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SSHSidebarComponent } from '../components/sshSidebar.component'

/**
 * Service to manage the SSH sidebar panel lifecycle and state
 *
 * The sidebar is inserted into Tabby's `.window` element, which is the
 * horizontal (row) flex container holding `profile-tree` and `.content.main`.
 * `app-root` itself is a *column* flex container (title bar on top, window
 * below), so it must never be turned into a row container - doing so stacks
 * the title bar beside the terminal and collapses the layout.
 */
@Injectable({ providedIn: 'root' })
export class SSHSidebarService {
    private sidebarComponentRef: ComponentRef<SSHSidebarComponent> | null = null
    private sidebarElement: HTMLElement | null = null
    private styleElement: HTMLStyleElement | null = null
    private isVisible = false
    private readonly SIDEBAR_WIDTH = 280

    constructor(
        private componentFactoryResolver: ComponentFactoryResolver,
        private appRef: ApplicationRef,
        private injector: Injector,
        private config: ConfigService,
    ) { }

    show(): void {
        if (this.isVisible) {
            return
        }

        this.createSidebar()

        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.sidebarVisible = true
        this.saveConfig(pluginConfig)

        this.isVisible = true
    }

    hide(): void {
        if (!this.isVisible) {
            return
        }

        this.destroySidebar()

        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.sidebarVisible = false
        this.saveConfig(pluginConfig)

        this.isVisible = false
    }

    toggle(): void {
        if (this.isVisible) {
            this.hide()
        } else {
            this.show()
        }
    }

    get visible(): boolean {
        return this.isVisible
    }

    initialize(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        // Open sidebar by default on first startup, or if explicitly set to visible

        if (pluginConfig.sidebarVisible !== false) {
            this.show()
        }
    }

    /**
     * Find Tabby's horizontal flex container.
     *
     * Tabby's layout is: app-root (column) > .window (row) > [profile-tree, .content.main]
     * We insert next to `profile-tree` so the sidebar sits in the row flow and the
     * terminal area simply shrinks, without touching any of Tabby's own styles.
     */
    private getWindowContainer(): HTMLElement | null {
        return document.querySelector('app-root .window') as HTMLElement | null
    }

    private createSidebar(): void {
        const container = this.getWindowContainer()
        if (!container) {
            console.error('SSH Sidebar: could not find Tabby\'s .window container')
            return
        }

        // Create component
        const componentFactory = this.componentFactoryResolver.resolveComponentFactory(SSHSidebarComponent)
        this.sidebarComponentRef = componentFactory.create(this.injector)

        // Attach to application
        this.appRef.attachView(this.sidebarComponentRef.hostView)

        // Get DOM element
        const domElem = (this.sidebarComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement

        // Create wrapper that participates in .window's row flex layout
        const wrapper = document.createElement('div')
        wrapper.className = 'ssh-sidebar-wrapper'
        wrapper.style.cssText = `
            width: ${this.SIDEBAR_WIDTH}px;
            flex: 0 0 ${this.SIDEBAR_WIDTH}px;
            min-width: 0;
            height: 100%;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--bs-body-bg, #1e1e1e);
            border-right: 1px solid var(--bs-border-color, #333);
            z-index: 10;
        `

        wrapper.appendChild(domElem)

        // Insert as the first child of the row container (left of profile-tree/content)
        container.insertBefore(wrapper, container.firstChild)

        this.sidebarElement = wrapper

        this.injectLayoutCSS()

        // Inject service reference into component so it can call hide()
        if (this.sidebarComponentRef) {
            const component = this.sidebarComponentRef.instance
            component.sidebarService = this
        }
    }

    private destroySidebar(): void {
        this.removeLayoutCSS()

        if (this.sidebarComponentRef) {
            this.appRef.detachView(this.sidebarComponentRef.hostView)
            this.sidebarComponentRef.destroy()
            this.sidebarComponentRef = null
        }

        if (this.sidebarElement) {
            this.sidebarElement.remove()
            this.sidebarElement = null
        }
    }

    /**
     * Let the main content area shrink next to the sidebar.
     *
     * Tabby sizes `.content.main` with `width: 100%`, which in a row flex
     * container refuses to give up space to a sibling. Overriding the flex
     * basis (rather than forcing a width) keeps Tabby's own sizing intact
     * while letting the terminal fill exactly the remaining width.
     */
    private injectLayoutCSS(): void {
        const style = document.createElement('style')
        style.id = 'ssh-sidebar-layout-css'
        style.textContent = `
            app-root .window > .content.main {
                flex: 1 1 0 !important;
                width: auto !important;
                min-width: 0 !important;
            }
        `

        document.head.appendChild(style)
        this.styleElement = style
    }

    private removeLayoutCSS(): void {
        if (this.styleElement) {
            this.styleElement.remove()
            this.styleElement = null
        }
    }

    private saveConfig(pluginConfig: any): void {
        if (!this.config.store.pluginConfig) {
            this.config.store.pluginConfig = {}
        }
        this.config.store.pluginConfig['ssh-sidebar'] = pluginConfig
        this.config.save()
    }
}
