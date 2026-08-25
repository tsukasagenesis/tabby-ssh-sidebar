/**
 * Works out, for one profile, which settings it inherits from its group and
 * which it stores itself.
 *
 * Deliberately free of Angular and tabby-core imports: it takes plain objects so
 * the classification can be exercised on its own.
 *
 * Tabby resolves a profile's value as "the profile's own key if it has one,
 * otherwise the merged default", where the merge order is
 *   profileDefaults -> provider.configDefaults -> global provider defaults -> group defaults
 * (see ProfilesService.getProfileDefaults and ConfigProxy.__getValue). So a
 * profile that stores its own copy of a value the group also sets will keep that
 * copy when the group changes - which is the case worth surfacing.
 */

export type SettingState =
    /** No stored key: the value comes from the group or from Tabby's defaults */
    | 'inherits'
    /** Stored, and identical to what the group sets: will not follow group edits */
    | 'duplicate'
    /** Stored as empty while the group sets a real value: inherits nothing */
    | 'blank'
    /** Stored and different from the group, or a value the group does not set */
    | 'own'
    /** Stored, but identical to Tabby's own default and not set by the group */
    | 'tidy'

/**
 * Settings that identify a particular host and must never be inherited, however
 * they are classified. A group that sets `host` as a default is a config error
 * rather than something to inherit - dropping a profile's own host would point
 * it at whatever the group happens to say.
 */
export const IDENTITY_KEYS = ['host']

export function isIdentityKey(key: string): boolean {
    return IDENTITY_KEYS.includes(key)
}

/**
 * Whether dropping this row is safe. Only removing a redundant copy, an empty
 * value blocking a real one, or a copy of Tabby's own default can be undone by
 * inheritance; discarding a genuinely different value changes behaviour and
 * belongs in Tabby's profile editor, not here.
 */
export function isSafeToInherit(row: SettingRow): boolean {
    if (isIdentityKey(row.key)) {
        return false
    }
    return row.state === 'duplicate' || row.state === 'blank' || row.state === 'tidy'
}

export interface SettingRow {
    key: string
    /** The value stored on the profile, or undefined when nothing is stored */
    stored: any
    /** What the group provides, or undefined when the group does not set this */
    group: any
    /** What Tabby would fall back to with no group involved */
    fallback: any
    state: SettingState
}

export interface InheritanceReport {
    rows: SettingRow[]
    /** Rows whose state changes behaviour: worth showing by default */
    significant: SettingRow[]
    /** Rows that only tidy the config file: hidden until asked for */
    tidy: SettingRow[]
    counts: Record<SettingState, number>
}

function isEmptyValue(value: any): boolean {
    if (value === '' || value === null || value === undefined) {
        return true
    }
    if (Array.isArray(value)) {
        return value.length === 0
    }
    return false
}

export function deepEqual(a: any, b: any): boolean {
    if (a === b) {
        return true
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a)
        const kb = Object.keys(b)
        return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]))
    }
    return false
}

/** Merges Tabby's default layers, later layers winning, the way configMerge does. */
export function mergeDefaults(layers: any[]): any {
    const out: any = {}
    const assign = (target: any, source: any) => {
        for (const key of Object.keys(source ?? {})) {
            const value = source[key]
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                target[key] = target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
                    ? target[key]
                    : {}
                assign(target[key], value)
            } else {
                target[key] = value
            }
        }
    }
    for (const layer of layers) {
        assign(out, layer)
    }
    return out
}

/**
 * Classifies each option of a profile.
 *
 * @param stored     the profile's own `options` object, exactly as saved
 * @param groupOpts  the group's `defaults[provider].options`, or {} if none
 * @param fallback   the merged defaults with the group layer left out
 */
export function analyseOptions(stored: any, groupOpts: any, fallback: any): InheritanceReport {
    const keys = new Set<string>([
        ...Object.keys(stored ?? {}),
        ...Object.keys(groupOpts ?? {}),
    ])

    const rows: SettingRow[] = []

    for (const key of keys) {
        const hasStored = Object.prototype.hasOwnProperty.call(stored ?? {}, key)
        const hasGroup = Object.prototype.hasOwnProperty.call(groupOpts ?? {}, key)
        const storedValue = (stored ?? {})[key]
        const groupValue = hasGroup ? groupOpts[key] : undefined
        const fallbackValue = (fallback ?? {})[key]

        // A stored object is a container: ConfigProxy walks into it and each
        // sub-key still resolves against the defaults, so it neither duplicates
        // nor blocks inheritance. Not worth reporting on.
        if (hasStored && storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)) {
            continue
        }

        let state: SettingState
        if (!hasStored) {
            state = 'inherits'
        } else if (hasGroup && deepEqual(storedValue, groupValue)) {
            state = 'duplicate'
        } else if (hasGroup && isEmptyValue(storedValue) && !isEmptyValue(groupValue)) {
            state = 'blank'
        } else if (hasGroup) {
            state = 'own'
        } else if (deepEqual(storedValue, fallbackValue)) {
            state = 'tidy'
        } else {
            state = 'own'
        }

        rows.push({
            key,
            stored: hasStored ? storedValue : undefined,
            group: groupValue,
            fallback: fallbackValue,
            state,
        })
    }

    const order: Record<SettingState, number> = {
        blank: 0, duplicate: 1, own: 2, inherits: 3, tidy: 4,
    }
    rows.sort((a, b) => order[a.state] - order[b.state] || a.key.localeCompare(b.key))

    const counts: Record<SettingState, number> = {
        inherits: 0, duplicate: 0, blank: 0, own: 0, tidy: 0,
    }
    for (const row of rows) {
        counts[row.state]++
    }

    return {
        rows,
        significant: rows.filter(r => r.state !== 'tidy'),
        tidy: rows.filter(r => r.state === 'tidy'),
        counts,
    }
}

/** The single worst thing about a profile, for the sidebar marker. */
export function markerFor(report: InheritanceReport): 'blank' | 'duplicate' | null {
    if (report.counts.blank > 0) {
        return 'blank'
    }
    if (report.counts.duplicate > 0) {
        return 'duplicate'
    }
    return null
}
