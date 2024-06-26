import * as validator from '../../env/obj';

export interface SharingSettings {
    filters: boolean;
    charts: boolean;
    comments: boolean;
    bookmarks: boolean;
    readonly: boolean;
}

export interface GitHubRepo {
    uuid: string;
    token: string;
    repo: string;
    owner: string;
    branch: string;
    entry: string | undefined;
    settings: SharingSettings;
}

export function getDefaultSharingSettings(): SharingSettings {
    return { filters: true, charts: true, comments: true, bookmarks: true, readonly: false };
}

export function validateGitHubRepo(repo: GitHubRepo): GitHubRepo {
    validator.isObject(repo);
    repo.token = validator.getAsNotEmptyString(repo, 'token');
    repo.repo = validator.getAsNotEmptyString(repo, 'repo');
    repo.owner = validator.getAsNotEmptyString(repo, 'owner');
    repo.uuid = validator.getAsNotEmptyString(repo, 'uuid');
    repo.entry = validator.getAsNotEmptyStringOrAsUndefined(repo, 'entry');
    if (repo.settings === undefined) {
        repo.settings = getDefaultSharingSettings();
    } else {
        repo.settings = validator.getAsObj(repo, 'settings');
        repo.settings.bookmarks = validator.getAsBool(repo.settings, 'bookmarks');
        repo.settings.charts = validator.getAsBool(repo.settings, 'charts');
        repo.settings.filters = validator.getAsBool(repo.settings, 'filters');
        repo.settings.comments = validator.getAsBool(repo.settings, 'comments');
        repo.settings.readonly =
            typeof repo.settings.readonly === 'boolean' ? repo.settings.readonly : false;
    }
    return repo;
}
