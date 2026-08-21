import { Injectable, ComponentFactoryResolver, ApplicationRef, Injector, EmbeddedViewRef, ComponentRef } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SSHSidebarComponent } from '../components/sshSidebar.component'

/**
 * Service to manage the SSH sidebar panel lifecycle and state
 *
 * FLEXBOX APPROACH - sidebar inserted inside app-root as first child,
 * app-root becomes horizontal flex container with sidebar on left
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
    ) {}

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

    private createSidebar(): void {
        // Create component
        const componentFactory = this.componentFactoryResolver.resolveComponentFactory(SSHSidebarComponent)
        this.sidebarComponentRef = componentFactory.create(this.injector)

        // Attach to application
        this.appRef.attachView(this.sidebarComponentRef.hostView)

        // Get DOM element
        const domElem = (this.sidebarComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement

        // Create wrapper that will be inserted into app-root flex container
        const wrapper = document.createElement('div')
        wrapper.className = 'ssh-sidebar-wrapper'
        wrapper.style.cssText = `
            width: ${this.SIDEBAR_WIDTH}px;
            min-width: ${this.SIDEBAR_WIDTH}px;
            max-width: ${this.SIDEBAR_WIDTH}px;
            flex: 0 0 ${this.SIDEBAR_WIDTH}px;
            display: flex;
            flex-direction: column;
            background: var(--bs-body-bg, #1e1e1e);
            border-right: 1px solid var(--bs-border-color, #333);
            box-shadow: 2px 0 10px rgba(0,0,0,0.3);
            z-index: 999;
            height: 100%;
            overflow: hidden;
        `

        wrapper.appendChild(domElem)

        // Insert inside Tabby's .window flex row, which already lays out
        // horizontally - so the sidebar becomes a sibling of .content.main
        const window_ = document.querySelector('app-root > .window')
        if (window_) {
            window_.insertBefore(wrapper, window_.firstChild)
        } else {
            // Fallback for layouts without a .window wrapper
            const appRoot = document.querySelector('app-root')
            if (!appRoot) {
                console.error('SSH Sidebar: Could not find app-root or .window element')
                return
            }
            appRoot.insertBefore(wrapper, appRoot.firstChild)
        }

        this.sidebarElement = wrapper

        // Inject CSS so .content.main yields the sidebar's width
        this.injectLayoutCSS()

        // Inject service reference into component so it can call hide()
        if (this.sidebarComponentRef) {
            const component = this.sidebarComponentRef.instance
            component.sidebarService = this
        }
    }

    private destroySidebar(): void {
        // Remove injected CSS - nothing else to restore, since the layout is
        // driven purely by the stylesheet rather than inline styles
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

    private injectLayoutCSS(): void {
        const style = document.createElement('style')
        style.id = 'ssh-sidebar-layout-css'
        style.textContent = `
            /*
             * Tabby's .window is already display:flex flex-direction:row.
             * We just need to ensure .content.main fills the remaining space
             * and doesn't use a fixed width like 100vw.
             */
            app-root > .window > .content.main {
                flex: 1 1 0% !important;
                width: 0 !important;
                min-width: 0 !important;
                max-width: none !important;
            }

            /* Also handle any direct .content child of .window as fallback */
            app-root > .window > .content {
                flex: 1 1 0% !important;
                width: 0 !important;
                min-width: 0 !important;
                max-width: none !important;
            }

            /* Ensure the .window container itself is a proper flex row (should already be) */
            app-root > .window {
                display: flex !important;
                flex-direction: row !important;
                overflow: hidden !important;
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
