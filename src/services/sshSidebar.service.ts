import { Injectable, ComponentFactoryResolver, ApplicationRef, Injector, EmbeddedViewRef, ComponentRef } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { SSHSidebarComponent } from '../components/sshSidebar.component'

@Injectable({ providedIn: 'root' })
export class SSHSidebarService {
    private sidebarComponentRef: ComponentRef<SSHSidebarComponent> | null = null
    private sidebarElement: HTMLElement | null = null
    private resizeHandle: HTMLElement | null = null
    private styleElement: HTMLStyleElement | null = null
    private isVisible = false

    private static readonly DEFAULT_WIDTH = 280
    private static readonly MIN_WIDTH = 180
    private static readonly MAX_WIDTH = 600

    private sidebarWidth = SSHSidebarService.DEFAULT_WIDTH

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

        this.loadWidth()
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

    get position(): 'left' | 'right' {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        return pluginConfig.position || 'left'
    }

    initialize(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        if (pluginConfig.sidebarVisible !== false) {
            this.show()
        }
    }

    private loadWidth(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        const raw = pluginConfig.sidebarWidth
        this.sidebarWidth = (typeof raw === 'number' && raw >= SSHSidebarService.MIN_WIDTH && raw <= SSHSidebarService.MAX_WIDTH)
            ? raw
            : SSHSidebarService.DEFAULT_WIDTH
    }

    private saveWidth(): void {
        const pluginConfig = this.config.store.pluginConfig?.['ssh-sidebar'] || {}
        pluginConfig.sidebarWidth = this.sidebarWidth
        this.saveConfig(pluginConfig)
    }

    private createSidebar(): void {
        const componentFactory = this.componentFactoryResolver.resolveComponentFactory(SSHSidebarComponent)
        this.sidebarComponentRef = componentFactory.create(this.injector)
        this.appRef.attachView(this.sidebarComponentRef.hostView)

        const domElem = (this.sidebarComponentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement

        const wrapper = document.createElement('div')
        wrapper.className = 'ssh-sidebar-wrapper'

        // Build wrapper contents based on position
        const isRight = this.position === 'right'

        if (isRight) {
            // Resize handle on the left side for right-positioned sidebar
            this.resizeHandle = this.createResizeHandle()
            wrapper.appendChild(this.resizeHandle)
            wrapper.appendChild(domElem)
        } else {
            wrapper.appendChild(domElem)
            this.resizeHandle = this.createResizeHandle()
            wrapper.appendChild(this.resizeHandle)
        }

        const appRoot = document.querySelector('app-root')
        if (!appRoot) {
            console.error('SSH Sidebar: Could not find app-root element')
            return
        }

        if (isRight) {
            appRoot.appendChild(wrapper)
        } else {
            appRoot.insertBefore(wrapper, appRoot.firstChild)
        }

        this.sidebarElement = wrapper
        this.injectLayoutCSS()
        this.setupResizeListeners()

        if (this.sidebarComponentRef) {
            const component = this.sidebarComponentRef.instance
            component.sidebarService = this
        }
    }

    private createResizeHandle(): HTMLElement {
        const handle = document.createElement('div')
        handle.className = 'ssh-sidebar-resize-handle'
        return handle
    }

    // Stable references for resize listeners — avoids memory leak from per-mousedown closures
    private resizeStartX = 0
    private resizeStartWidth = 0
    private resizeIsRight = false
    private boundOnMouseMove = this.onResizeMouseMove.bind(this)
    private boundOnMouseUp = this.onResizeMouseUp.bind(this)

    private setupResizeListeners(): void {
        if (!this.resizeHandle || !this.sidebarElement) return
        this.resizeIsRight = this.position === 'right'

        this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
            e.preventDefault()
            this.resizeStartX = e.clientX
            this.resizeStartWidth = this.sidebarWidth
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
            document.addEventListener('mousemove', this.boundOnMouseMove)
            document.addEventListener('mouseup', this.boundOnMouseUp)
        })
    }

    private onResizeMouseMove(e: MouseEvent): void {
        const delta = this.resizeIsRight ? (this.resizeStartX - e.clientX) : (e.clientX - this.resizeStartX)
        this.sidebarWidth = Math.min(
            SSHSidebarService.MAX_WIDTH,
            Math.max(SSHSidebarService.MIN_WIDTH, this.resizeStartWidth + delta)
        )
        this.updateSidebarWidth()
    }

    private onResizeMouseUp(): void {
        document.removeEventListener('mousemove', this.boundOnMouseMove)
        document.removeEventListener('mouseup', this.boundOnMouseUp)
        document.body.style.removeProperty('cursor')
        document.body.style.removeProperty('user-select')
        this.saveWidth()
    }

    private updateSidebarWidth(): void {
        if (this.sidebarElement) {
            this.sidebarElement.style.width = `${this.sidebarWidth}px`
            this.sidebarElement.style.flex = `0 0 ${this.sidebarWidth}px`
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

        this.resizeHandle = null
    }

    private injectLayoutCSS(): void {
        const isRight = this.position === 'right'
        const style = document.createElement('style')
        style.id = 'ssh-sidebar-layout-css'
        style.textContent = `
            app-root {
                display: flex !important;
                flex-direction: row !important;
                width: 100vw !important;
                height: 100vh !important;
                overflow: hidden !important;
            }

            .ssh-sidebar-wrapper {
                width: ${this.sidebarWidth}px;
                flex: 0 0 ${this.sidebarWidth}px;
                display: flex;
                flex-direction: row;
                background: var(--bs-body-bg);
                ${isRight ? 'border-left' : 'border-right'}: 1px solid var(--bs-border-color);
                box-shadow: ${isRight ? '-2px' : '2px'} 0 10px rgba(0, 0, 0, 0.3);
                z-index: 999;
            }

            .ssh-sidebar-wrapper > :host,
            .ssh-sidebar-wrapper > ssh-sidebar {
                flex: 1;
                min-width: 0;
            }

            .ssh-sidebar-resize-handle {
                width: 4px;
                cursor: col-resize;
                background: transparent;
                flex-shrink: 0;
                transition: background 0.2s ease;
            }

            .ssh-sidebar-resize-handle:hover {
                background: var(--bs-primary);
            }

            app-root > .content {
                flex: 1 1 auto;
                width: 0 !important;
                max-width: 100%;
                min-width: 0;
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
