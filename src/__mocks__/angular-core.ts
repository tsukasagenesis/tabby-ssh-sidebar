// Minimal Angular decorators as no-ops for testing
export function Component(_meta: any): ClassDecorator { return (target: any) => target }
export function Injectable(_meta?: any): ClassDecorator { return (target: any) => target }
export function NgModule(_meta: any): ClassDecorator { return (target: any) => target }
export function Input(): PropertyDecorator { return () => {} }
export function Output(): PropertyDecorator { return () => {} }
export function Inject(_token: any): ParameterDecorator { return () => {} }
export function HostBinding(_binding: string): PropertyDecorator { return () => {} }
export function HostListener(_event: string, _args?: string[]): MethodDecorator { return () => {} }
export class EventEmitter<T = any> {
    private handlers: ((value: T) => void)[] = []
    emit(value?: T): void { this.handlers.forEach(h => h(value as T)) }
    subscribe(handler: (value: T) => void): void { this.handlers.push(handler) }
}
export interface OnInit { ngOnInit(): void }
export interface OnDestroy { ngOnDestroy(): void }
export class ComponentFactoryResolver {}
export class ApplicationRef {}
export class Injector {}
export class EmbeddedViewRef<T> {}
export type ComponentRef<T> = any
