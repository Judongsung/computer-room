import { FILESYSTEM_SEARCH_COPY, FILESYSTEM_SEARCH_KIND_LABEL } from "@client/content/ko/filesystem/search";
import { isFilesystemSearchKind } from "@/domain/filesystem/search/search-query";
import type { useSearchForm } from "@client/hooks/filesystem/search/use-filesystem-search";
import type { SearchDirectory } from "@client/types/filesystem/search/search";

interface SearchFormProps {
  readonly form: ReturnType<typeof useSearchForm>;
  readonly directory: SearchDirectory | null;
}

export function SearchForm({ form, directory }: SearchFormProps) {
  const description = form.query
    ? FILESYSTEM_SEARCH_COPY.EXECUTED(
        form.query.q,
        form.query.directoryId ? directory?.name ?? "" : FILESYSTEM_SEARCH_COPY.ALL,
        FILESYSTEM_SEARCH_KIND_LABEL[form.query.kind],
      )
    : FILESYSTEM_SEARCH_COPY.GUIDE;

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      form.submit();
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
      {directory ? (
        <label>
          {FILESYSTEM_SEARCH_COPY.SCOPE}
          <select
            value={form.scoped ? directory.id : ""}
            onChange={(event) => form.setScoped(event.target.value !== "")}
          >
            <option value="">{FILESYSTEM_SEARCH_COPY.ALL}</option>
            <option value={directory.id}>{directory.name}</option>
          </select>
        </label>
      ) : null}
      <button type="submit">{FILESYSTEM_SEARCH_COPY.SUBMIT}</button>
      {form.error ? <p role="alert">{form.error}</p> : null}
      <p>{description}</p>
    </form>
  );
}
