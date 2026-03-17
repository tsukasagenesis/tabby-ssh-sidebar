export class ProfilesService {}
export class AppService {}
export class ConfigService {}
export class TranslateService {
    instant(key: string, params?: any): string {
        if (params?.name) {
            return key.replace('{name}', params.name)
        }
        return key
    }
}
export class PlatformService {
    setClipboard(_data: any): void {}
    async showMessageBox(_options: any): Promise<any> {
        return { response: 1 }
    }
}
export class NotificationsService {
    notice(_text: string): void {}
    info(_text: string, _details?: string): void {}
    error(_text: string, _details?: string): void {}
}
export class SelectorService {}
export class HostAppService {}
export class BaseComponent {
    constructor() {}
}
export class Profile {}
export type PartialProfile<T> = Partial<T> & { id?: string; name?: string; type?: string; group?: string; isBuiltin?: boolean; isTemplate?: boolean; icon?: string; color?: string; options?: any }
export class ProfileProvider<T> {}
export class ToolbarButtonProvider {
    provide(): any[] { return [] }
}
export type ToolbarButton = any
export type SelectorOption<T> = any
export const Platform = {}
