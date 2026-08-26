import { InheritanceReport, SettingState, isSafeToInherit } from './inheritance'

/** One key/state pairing that can be dropped, and the profiles it applies to. */
export interface NormalizeEntry {
    key: string
    state: SettingState
    /** Ids of profiles where dropping this key is safe */
    profileIds: string[]
}

export interface NormalizePlan {
    /** Removals that change what a profile resolves to */
    significant: NormalizeEntry[]
    /** Removals that only shorten the config file */
    tidy: NormalizeEntry[]
    /** Names of profiles that cannot be rewritten because they have no id */
    skipped: string[]
}

export interface NormalizeCandidate {
    id?: string
    name?: string
    report: InheritanceReport
}

/**
 * Works out what could be dropped across a whole group.
 *
 * Only rows that are individually safe to inherit are included, so a value that
 * genuinely differs from the group is never swept up by a bulk action.
 *
 * Entries are split by key *and* state, because the same key can be a real
 * duplicate of the group on one profile and merely match Tabby's own default on
 * another. Those two carry very different consequences, so they are never
 * presented as one number.
 */
export function buildNormalizePlan(profiles: NormalizeCandidate[]): NormalizePlan {
    const byKeyState = new Map<string, NormalizeEntry>()
    const skipped: string[] = []

    for (const profile of profiles) {
        const safeRows = profile.report.rows.filter(isSafeToInherit)
        if (!safeRows.length) {
            continue
        }
        if (!profile.id) {
            skipped.push(profile.name ?? '(unnamed)')
            continue
        }

        for (const row of safeRows) {
            const mapKey = `${row.key} ${row.state}`
            let entry = byKeyState.get(mapKey)
            if (!entry) {
                entry = { key: row.key, state: row.state, profileIds: [] }
                byKeyState.set(mapKey, entry)
            }
            entry.profileIds.push(profile.id)
        }
    }

    const all = [...byKeyState.values()].sort(
        (a, b) => b.profileIds.length - a.profileIds.length || a.key.localeCompare(b.key),
    )

    return {
        significant: all.filter(e => e.state === 'duplicate' || e.state === 'blank'),
        tidy: all.filter(e => e.state === 'tidy'),
        skipped,
    }
}

export function countSettings(entries: NormalizeEntry[]): number {
    return entries.reduce((total, entry) => total + entry.profileIds.length, 0)
}

/** Distinct profiles touched by the given entries. */
export function countProfiles(entries: NormalizeEntry[]): number {
    const ids = new Set<string>()
    for (const entry of entries) {
        for (const id of entry.profileIds) {
            ids.add(id)
        }
    }
    return ids.size
}
