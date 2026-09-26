import type { GetServerSidePropsContext } from "next";
import { afterEach, expect, it, vi } from "vitest";
import { getServerSideProps } from "../../pages/testing/credit-policy";

afterEach(() => vi.unstubAllEnvs());

it.each(["production", "test"])("never serves sandbox terms in %s", async mode => {
  vi.stubEnv("NODE_ENV", mode);
  const setHeader = vi.fn();
  const result = await getServerSideProps({ res: { setHeader } } as unknown as GetServerSidePropsContext);
  expect(result).toEqual({ notFound: true });
  expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
});

it("serves the test policy only during local development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const result = await getServerSideProps({ res: { setHeader: vi.fn() } } as unknown as GetServerSidePropsContext);
  expect(result).toEqual({ props: {} });
});
