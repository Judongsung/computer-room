import { expect, it, vi } from "vitest";
import { readWidgetIdChunks } from "@/infrastructure/widgets/d1-widget-id-query";
import { deferred } from "@test/support/widgets/deferred";

it("waits for each chunk and rejects the complete read when a later chunk fails", async () => {
  const ids = Array.from({ length: 200 }, (_, n) => String(n));
  const first = deferred<readonly string[]>();
  const failure = new Error("read failed");
  const read = vi.fn<(ids: readonly string[]) => Promise<readonly string[]>>()
    .mockImplementationOnce(() => first.promise).mockRejectedValueOnce(failure);
  const result = readWidgetIdChunks(ids, read);
  const rejected = expect(result).rejects.toBe(failure);
  expect(read).toHaveBeenCalledTimes(1);
  first.resolve(ids.slice(0, 99));
  await rejected;
  expect(read).toHaveBeenCalledTimes(2);
});
