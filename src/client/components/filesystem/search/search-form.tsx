import { FILESYSTEM_SEARCH_COPY, FILESYSTEM_SEARCH_KIND_LABEL, FILESYSTEM_SEARCH_MODE_LABEL } from "@client/content/ko/filesystem/search";
import { isFilesystemSearchKind, isFilesystemSearchMode } from "@/domain/filesystem/search/search-query";
import { FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";
import type { useSearchForm } from "@client/hooks/filesystem/search/use-filesystem-search";
import type { SearchDirectory } from "@client/types/filesystem/search/search";

interface SearchFormProps {
  readonly form: ReturnType<typeof useSearchForm>;
  readonly directory: SearchDirectory;
  readonly disabled?: boolean;
}

export function SearchForm({ form, directory, disabled = false }: SearchFormProps) {
  const description = form.query
    ? FILESYSTEM_SEARCH_COPY.EXECUTED(
        form.query.q,
        directory.name,
        FILESYSTEM_SEARCH_KIND_LABEL[form.query.kind],
        FILESYSTEM_SEARCH_MODE_LABEL[form.query.mode ?? FILESYSTEM_SEARCH_MODE.NAME],
      )
    : FILESYSTEM_SEARCH_COPY.GUIDE;

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!disabled) form.submit();
    }}>
      <label>
        {FILESYSTEM_SEARCH_COPY.QUERY}
        <input
          type="search"
          value={form.q}
          onChange={(event) => form.setQ(event.target.value)}
        />
      </label>
      <label>
        {FILESYSTEM_SEARCH_COPY.MODE}
        <select value={form.mode} onChange={(event) => {
          if (isFilesystemSearchMode(event.target.value)) form.setMode(event.target.value);
        }}>
          {Object.entries(FILESYSTEM_SEARCH_MODE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      {form.mode !== FILESYSTEM_SEARCH_MODE.NAME ? <p>{FILESYSTEM_SEARCH_COPY.CONTENT_GUIDE}</p> : null}
      <label>
        {FILESYSTEM_SEARCH_COPY.KIND}
        <select
          value={form.kind}
          onChange={(event) => {
            if (isFilesystemSearchKind(event.target.value)) {
              form.setKind(event.target.value);
            }
          }}
        >
          {Object.entries(FILESYSTEM_SEARCH_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <p>{FILESYSTEM_SEARCH_COPY.SCOPE}: {directory.name}</p>
      <button type="submit" disabled={disabled}>{FILESYSTEM_SEARCH_COPY.SUBMIT}</button>
      {form.error ? <p role="alert">{form.error}</p> : null}
      <p>{description}</p>
    </form>
  );
}
