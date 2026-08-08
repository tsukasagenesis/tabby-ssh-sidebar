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
    private mainElement: HTMLElement | null = null
    private mainElementOriginalStyles: Map<string, string> = new Map()

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
            flex: 0 0 ${this.SIDEBAR_WIDTH}px;  /* Don't grow or shrink */
            display: flex;
            flex-direction: column;
            background: var(--bs-body-bg, #1e1e1e);
            border-right: 1px solid var(--bs-border-color, #333);
            box-shadow: 2px 0 10px rgba(0,0,0,0.3);
            z-index: 999;
        `

        wrapper.appendChild(domElem)

        // Insert inside app-root as first child
        const appRoot = document.querySelector('app-root')
        if (!appRoot) {
            console.error('SSH Sidebar: Could not find app-root element')
            return
        }

        // Save the original main element BEFORE inserting the wrapper.
        // The main element is whatever the first direct child of app-root is
        // (e.g. .window.h-100.d-flex on Tabby 1.0.235), not a class-guessed
        // .content element. See https://github.com/tsukasagenesis/tabby-ssh-sidebar/issues/7
        this.mainElement = appRoot.firstElementChild as HTMLElement | null
        if (this.mainElement) {
            // Preserve original inline styles so they can be restored on hide
            this.mainElementOriginalStyles.clear()
            for (const prop of ['flex', 'width', 'min-width', 'max-width', 'height', 'overflow']) {
                this.mainElementOriginalStyles.set(prop, this.mainElement.style.getPropertyValue(prop))
            }
        }

        // Insert as first child
        appRoot.insertBefore(wrapper, appRoot.firstChild)

        this.sidebarElement = wrapper

        // Inject CSS to make app-root a flex container
        this.injectLayoutCSS()

        // Make the main element fill the remaining horizontal space.
        // This targets the actual first child (any class), so it keeps working
        // across Tabby layout changes. Inline styles win over stylesheet rules.
        if (this.mainElement) {
            this.mainElement.style.setProperty('flex', '1 1 0')
            this.mainElement.style.setProperty('width', 'auto')
            this.mainElement.style.setProperty('min-width', '0')
            this.mainElement.style.setProperty('max-width', 'none')
            this.mainElement.style.setProperty('height', '100%')
            this.mainElement.style.setProperty('overflow', 'hidden')
        }

        // Inject service reference into component so it can call hide()
        if (this.sidebarComponentRef) {
            const component = this.sidebarComponentRef.instance
            component.sidebarService = this
        }
    }

    private destroySidebar(): void {
        // Restore the main element's original inline styles
        if (this.mainElement) {
            for (const prop of ['flex', 'width', 'min-width', 'max-width', 'height', 'overflow']) {
                const original = this.mainElementOriginalStyles.get(prop)
                if (original) {
                    this.mainElement.style.setProperty(prop, original)
                } else {
                    this.mainElement.style.removeProperty(prop)
                }
            }
            this.mainElement = null
            this.mainElementOriginalStyles.clear()
        }

        // Remove injected CSS
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
        // Make app-root a horizontal flex container to hold sidebar and content
        const style = document.createElement('style')
        style.id = 'ssh-sidebar-layout-css'
        style.textContent = `
            /* Make app-root a horizontal flex container */
            app-root {
                display: flex !important;
                flex-direction: row !important;
                width: 100vw !important;
                height: 100vh !important;
                overflow: hidden !important;
            }

            /* Fallback safety net: make whatever element follows the sidebar
               wrapper fill the remaining space, regardless of its class name.
               The primary sizing is done via inline styles on the main element,
               this only guards against Tabby stylesheet rules with !important. */
            app-root > .ssh-sidebar-wrapper + * {
                flex: 1 1 0 !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                height: 100% !important;
                overflow: hidden;
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
