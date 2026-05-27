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
    // Default width; mutable so a user-chosen width (persisted in plugin config) can override it.
    private SIDEBAR_WIDTH = 280
    // Allowed resize bounds, shared by the live-drag clamp and the persisted-value validation.
    private readonly MIN_WIDTH = 180
    private readonly MAX_WIDTH = 600

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
        // Restore the persisted sidebar width (if any) before building the wrapper,
        // clamped to the allowed range so a corrupted/out-of-range value can't break the layout.
        const savedConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        if (typeof savedConfig.sidebarWidth === 'number' &&
            savedConfig.sidebarWidth >= this.MIN_WIDTH &&
            savedConfig.sidebarWidth <= this.MAX_WIDTH) {
            this.SIDEBAR_WIDTH = savedConfig.sidebarWidth
        }

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
            position: relative;  /* Anchor for the absolutely-positioned resize handle */
        `

        wrapper.appendChild(domElem)

        // Add the draggable handle on the wrapper's right edge so the user can resize the panel.
        this.addResizeHandle(wrapper)

        // Insert inside app-root as first child (before .content)
        const appRoot = document.querySelector('app-root')
        if (!appRoot) {
            console.error('SSH Sidebar: Could not find app-root element')
            return
        }

        // Insert as first child
        appRoot.insertBefore(wrapper, appRoot.firstChild)

        this.sidebarElement = wrapper

        // Inject CSS to make app-root a flex container
        this.injectLayoutCSS()

        // Directly manipulate .content element's style to remove width: 100vw
        // There are multiple .content elements - target the deeper nested one
        const contentElements = appRoot.querySelectorAll('.content')
        if (contentElements.length > 1) {
            // Select the second (deeper) .content element
            const contentElement = contentElements[1] as HTMLElement
            contentElement.style.width = 'auto'
            contentElement.style.flex = '1 1 auto'
            contentElement.style.minWidth = '0'
        } else if (contentElements.length === 1) {
            // Fallback to first one if only one exists
            const contentElement = contentElements[0] as HTMLElement
            contentElement.style.width = 'auto'
            contentElement.style.flex = '1 1 auto'
            contentElement.style.minWidth = '0'
        }

        // Inject service reference into component so it can call hide()
        if (this.sidebarComponentRef) {
            const component = this.sidebarComponentRef.instance
            component.sidebarService = this
        }
    }

    /**
     * Adds a draggable handle pinned to the right edge of the sidebar wrapper, letting the
     * user resize the panel by dragging. The width is clamped to [MIN_WIDTH, MAX_WIDTH] during
     * the drag and persisted to the plugin config on release so it survives Tabby restarts.
     *
     * @param wrapper The sidebar wrapper element (must be position: relative so the handle anchors to it).
     */
    private addResizeHandle(wrapper: HTMLElement): void {
        const resizer = document.createElement('div')
        resizer.className = 'ssh-sidebar-resizer'
        // Thin transparent strip on the right edge; the col-resize cursor signals it's draggable.
        resizer.style.cssText = `
            width: 8px;
            cursor: col-resize;
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            background-color: transparent;
        `
        wrapper.appendChild(resizer)

        resizer.addEventListener('mousedown', (downEvent: MouseEvent) => {
            // Prevent text selection / native drag while resizing.
            downEvent.preventDefault()
            const startX = downEvent.clientX
            const startWidth = wrapper.getBoundingClientRect().width

            // Live-resize while the mouse moves, staying strictly within the allowed range.
            const onMouseMove = (moveEvent: MouseEvent): void => {
                const newWidth = startWidth + (moveEvent.clientX - startX)
                if (newWidth > this.MIN_WIDTH && newWidth < this.MAX_WIDTH) {
                    wrapper.style.width = `${newWidth}px`
                    wrapper.style.flex = `0 0 ${newWidth}px`
                    // Notify Tabby's terminal frontends so they re-fit to the new content width.
                    window.dispatchEvent(new Event('resize'))
                }
            }

            // On release: detach the document listeners and persist the final width.
            const onMouseUp = (): void => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                const finalWidth = Math.round(wrapper.getBoundingClientRect().width)
                if (finalWidth >= this.MIN_WIDTH && finalWidth <= this.MAX_WIDTH) {
                    const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
                    pluginConfig.sidebarWidth = finalWidth
                    this.saveConfig(pluginConfig)
                    this.SIDEBAR_WIDTH = finalWidth
                }
            }

            // Listen on document (not the handle) so the drag keeps tracking even if the
            // cursor outruns the thin strip.
            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
        })
    }

    private destroySidebar(): void {
        // Restore .content element's original styles
        const appRoot = document.querySelector('app-root')
        if (appRoot) {
            const contentElements = appRoot.querySelectorAll('.content')
            if (contentElements.length > 1) {
                // Restore the second (deeper) .content element
                const contentElement = contentElements[1] as HTMLElement
                contentElement.style.removeProperty('width')
                contentElement.style.removeProperty('flex')
                contentElement.style.removeProperty('min-width')
            } else if (contentElements.length === 1) {
                // Fallback to first one
                const contentElement = contentElements[0] as HTMLElement
                contentElement.style.removeProperty('width')
                contentElement.style.removeProperty('flex')
                contentElement.style.removeProperty('min-width')
            }
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

            /* Override Tabby's width: 100vw on .content - use calc to force correct width */
            app-root > .content,
            app-root > div.content,
            app-root > .content[class],
            app-root > [class*="content"] {
                flex: 1 1 auto !important;
                width: 0 !important;  /* Set to 0, let flex grow it */
                max-width: 100% !important;
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
